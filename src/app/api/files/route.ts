import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { getPageCount } from '@/lib/pdf-utils'
import { randomUUID } from 'crypto'
import {
  validateUploadedFile,
  computeFileHash,
  extractPdfMetadata,
  getVirusScanner,
  sanitizeFileName,
  UPLOAD_CONFIG,
  type DuplicateCheckResult,
} from '@/lib/upload-validation'
import { storeFile, deleteFile } from '@/lib/file-storage'
import { UPLOADS_DIR } from '@/lib/upload-config'

/** Helper: get client info from request */
function getClientInfo(request: NextRequest) {
  return {
    clientIp: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  }
}

/** Helper: log upload event */
async function logUpload(data: {
  fileId?: string
  fileName: string
  fileSize: number
  fileHash?: string
  status: string
  errorType?: string
  errorMessage?: string
  uploadDurationMs?: number
  clientIp?: string
  userAgent?: string
}) {
  try {
    if (!db) return
    await db.uploadLog.create({ data })
  } catch (error) {
    console.error('Failed to log upload event:', error)
  }
}

// ─── GET: List Files ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const searchQuery = request.nextUrl.searchParams.get('search') || ''
    const statusFilter = request.nextUrl.searchParams.get('status') || ''

    const files = await db.pdfFile.findMany({
      where: {
        ...(searchQuery
          ? {
              OR: [
                { name: { contains: searchQuery, mode: 'insensitive' } },
                { originalName: { contains: searchQuery, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(statusFilter ? { uploadStatus: statusFilter } : { uploadStatus: 'ready' }),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ files })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', files: [] }, { status: 503 })
    }
    console.error('List files error:', error)
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    )
  }
}

// ─── POST: Upload File ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const uploadStart = Date.now()
  let fileName = 'unknown'
  let fileSize = 0
  const { clientIp, userAgent } = getClientInfo(request)

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', code: 'NO_FILE' },
        { status: 400 }
      )
    }

    fileName = file.name
    fileSize = file.size

    // ── Step 1: Read file buffer ──────────────────────────────────────────
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // ── Step 2: File validation (size, extension, MIME, magic bytes) ──────
    const validation = await validateUploadedFile(file, fileBuffer)
    if (!validation.valid) {
      await logUpload({
        fileName,
        fileSize,
        status: 'failed',
        errorType: 'validation_error',
        errorMessage: validation.errors.map((e) => e.message).join('; '),
        uploadDurationMs: Date.now() - uploadStart,
        clientIp,
        userAgent,
      })

      return NextResponse.json(
        {
          error: 'File validation failed',
          code: 'VALIDATION_FAILED',
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      )
    }

    // ── Step 3: Compute SHA256 hash for duplicate detection ───────────────
    const fileHash = computeFileHash(fileBuffer)

    // ── Step 4: Duplicate detection ───────────────────────────────────────
    const existingFile = await db.pdfFile.findFirst({
      where: { fileHash },
    })

    if (existingFile) {
      await logUpload({
        fileName,
        fileSize,
        fileHash,
        status: 'duplicate_rejected',
        uploadDurationMs: Date.now() - uploadStart,
        clientIp,
        userAgent,
      })

      const duplicateResult: DuplicateCheckResult = {
        isDuplicate: true,
        existingFile: {
          id: existingFile.id,
          name: existingFile.name,
          originalName: existingFile.originalName,
          size: existingFile.size,
          pages: existingFile.pages,
          createdAt: existingFile.createdAt.toISOString(),
        },
      }

      return NextResponse.json(
        {
          error: 'Duplicate file detected',
          code: 'DUPLICATE_FILE',
          duplicate: duplicateResult,
          warnings: validation.warnings,
        },
        { status: 409 }
      )
    }

    // ── Step 5: Virus/malware scanning ────────────────────────────────────
    const scanner = getVirusScanner()
    const scanResult = await scanner.scan(fileBuffer, fileName)

    if (scanResult.status === 'threat') {
      await logUpload({
        fileName,
        fileSize,
        fileHash,
        status: 'failed',
        errorType: 'virus_detected',
        errorMessage: `Threats detected: ${scanResult.threats?.join(', ')}`,
        uploadDurationMs: Date.now() - uploadStart,
        clientIp,
        userAgent,
      })

      return NextResponse.json(
        {
          error: 'Security threat detected',
          code: 'VIRUS_DETECTED',
          threats: scanResult.threats,
          scanEngine: scanResult.scanEngine,
        },
        { status: 422 }
      )
    }

    // ── Step 6: Save file ─────────────────────────────────────────────────
    const uniqueName = `${randomUUID()}.pdf`
    const { filePath } = await storeFile(fileBuffer, uniqueName)

    // ── Step 7: Extract PDF metadata ──────────────────────────────────────
    let pages = 1
    try {
      pages = await getPageCount(fileBuffer)
    } catch (e) {
      console.error('Page count error:', e)
      try {
        const text = fileBuffer.toString('utf-8', 0, Math.min(fileBuffer.length, 100000))
        const pageMatches = text.match(/\/Type\s*\/Page(?!s)/g)
        if (pageMatches && pageMatches.length > 0) {
          pages = pageMatches.length
        }
      } catch {
        // Keep default of 1
      }
    }

    let metadataJson: string | null = null
    try {
      const metadata = await extractPdfMetadata(fileBuffer)
      metadataJson = JSON.stringify(metadata)
    } catch (e) {
      console.error('Metadata extraction error:', e)
    }

    // ── Step 8: Save to database ──────────────────────────────────────────
    const safeName = sanitizeFileName(fileName)
    const pdfFile = await db.pdfFile.create({
      data: {
        name: safeName,
        originalName: fileName,
        size: fileBuffer.length,
        mimeType: file.type || 'application/pdf',
        pages,
        filePath,
        fileHash,
        uploadStatus: 'ready',
        metadata: metadataJson,
        virusScanStatus: scanResult.status === 'skipped' ? 'skipped' : 'clean',
        virusScanResult: scanResult.threats?.join(', ') || null,
        textContent: null,
      },
    })

    // ── Step 9: Log successful upload ─────────────────────────────────────
    await logUpload({
      fileId: pdfFile.id,
      fileName,
      fileSize,
      fileHash,
      status: 'completed',
      uploadDurationMs: Date.now() - uploadStart,
      clientIp,
      userAgent,
    })

    return NextResponse.json(
      {
        file: pdfFile,
        metadata: metadataJson ? JSON.parse(metadataJson) : null,
        warnings: validation.warnings,
      },
      { status: 201 }
    )
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Upload error:', error)

    await logUpload({
      fileName,
      fileSize,
      status: 'failed',
      errorType: 'server_error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      uploadDurationMs: Date.now() - uploadStart,
      clientIp,
      userAgent,
    })

    return NextResponse.json(
      { error: 'Failed to upload file', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}

// ─── DELETE: Clear All Files ────────────────────────────────────────────────

export async function DELETE() {
  try {
    const files = await db.pdfFile.findMany({
      select: { id: true, filePath: true },
    })

    // Delete physical files
    let deletedCount = 0
    let failedCount = 0
    for (const file of files) {
      try {
        await deleteFile(file.filePath)
      } catch {
        // Physical file might not exist, continue anyway
      }
    }

    // Delete all from database
    const result = await db.pdfFile.deleteMany({})
    deletedCount = result.count

    // Also clean up upload logs older than 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    await db.uploadLog.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    })

    return NextResponse.json({
      success: true,
      deletedCount,
      failedCount,
    })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Clear all files error:', error)
    return NextResponse.json(
      { error: 'Failed to clear files' },
      { status: 500 }
    )
  }
}
