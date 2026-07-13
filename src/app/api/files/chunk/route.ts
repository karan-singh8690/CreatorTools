import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile, deleteFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import {
  UPLOAD_CONFIG,
  StreamingHasher,
  validateUploadedFile,
  computeFileHash,
  extractPdfMetadata,
  getVirusScanner,
  sanitizeFileName,
} from '@/lib/upload-validation'
import { getPageCount } from '@/lib/pdf-utils'
import { UPLOADS_DIR } from '@/lib/upload-config'
import path from 'path'

// ─── POST: Chunked Upload Operations ─────────────────────────────────────────
// 
// Three operations via `action` field:
// 1. "init"    — Create a new chunked upload session
// 2. "upload"  — Upload a single chunk
// 3. "complete" — Assemble chunks into final file

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // If this is a JSON request, it's an init or complete action
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const action = body.action

      if (action === 'init') return handleInit(body)
      if (action === 'complete') return handleComplete(body)

      return NextResponse.json(
        { error: 'Invalid action. Use "init" or "complete"', code: 'INVALID_ACTION' },
        { status: 400 }
      )
    }

    // If this is a FormData request, it's a chunk upload
    if (contentType.includes('multipart/form-data')) {
      return handleChunkUpload(request)
    }

    return NextResponse.json(
      { error: 'Unsupported content type', code: 'INVALID_CONTENT_TYPE' },
      { status: 400 }
    )
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Chunked upload error:', error)
    return NextResponse.json(
      { error: 'Chunked upload failed', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}

// ─── Init: Create upload session ─────────────────────────────────────────────

async function handleInit(body: {
  fileName: string
  fileSize: number
  totalChunks: number
  fileHash?: string
}) {
  if (!db) {
    return NextResponse.json(
      { error: 'Database not available', code: 'DB_UNAVAILABLE' },
      { status: 503 }
    )
  }

  const { fileName, fileSize, totalChunks, fileHash } = body

  // Validation
  if (!fileName || !fileSize || !totalChunks) {
    return NextResponse.json(
      { error: 'Missing required fields: fileName, fileSize, totalChunks', code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  if (fileSize > UPLOAD_CONFIG.MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File size exceeds maximum of ${UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`, code: 'SIZE_EXCEEDED' },
      { status: 400 }
    )
  }

  if (totalChunks > UPLOAD_CONFIG.MAX_CHUNKS_PER_SESSION) {
    return NextResponse.json(
      { error: `Too many chunks (max ${UPLOAD_CONFIG.MAX_CHUNKS_PER_SESSION})`, code: 'TOO_MANY_CHUNKS' },
      { status: 400 }
    )
  }

  // Check for pre-computed hash duplicate
  if (fileHash) {
    const existing = await db.pdfFile.findFirst({ where: { fileHash } })
    if (existing) {
      return NextResponse.json(
        {
          error: 'Duplicate file detected',
          code: 'DUPLICATE_FILE',
          duplicate: {
            isDuplicate: true,
            existingFile: {
              id: existing.id,
              name: existing.name,
              originalName: existing.originalName,
              size: existing.size,
              pages: existing.pages,
              createdAt: existing.createdAt.toISOString(),
            },
          },
        },
        { status: 409 }
      )
    }
  }

  // Create session — chunks stored in temp directory
  const sessionId = randomUUID()
  const sessionDir = path.join(UPLOADS_DIR, 'chunks', sessionId)

  const session = await db.chunkUploadSession.create({
    data: {
      id: sessionId,
      fileName: sanitizeFileName(fileName),
      fileSize: fileSize,
      fileHash: fileHash || null,
      totalChunks,
      uploadedChunks: '[]',
      status: 'active',
      uploadDir: sessionDir,
    },
  })

  return NextResponse.json({
    sessionId: session.id,
    chunkSize: UPLOAD_CONFIG.CHUNK_SIZE,
    message: 'Upload session initialized',
  })
}

// ─── Chunk Upload: Upload a single chunk ─────────────────────────────────────

async function handleChunkUpload(request: NextRequest) {
  if (!db) {
    return NextResponse.json(
      { error: 'Database not available', code: 'DB_UNAVAILABLE' },
      { status: 503 }
    )
  }

  const formData = await request.formData()
  const sessionId = formData.get('sessionId') as string
  const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10)
  const chunkFile = formData.get('chunk') as File | null

  if (!sessionId || isNaN(chunkIndex) || !chunkFile) {
    return NextResponse.json(
      { error: 'Missing required fields: sessionId, chunkIndex, chunk', code: 'MISSING_FIELDS' },
      { status: 400 }
    )
  }

  // Verify session exists and is active
  const session = await db.chunkUploadSession.findUnique({
    where: { id: sessionId },
  })

  if (!session || session.status !== 'active') {
    return NextResponse.json(
      { error: 'Invalid or expired upload session', code: 'INVALID_SESSION' },
      { status: 404 }
    )
  }

  // Validate chunk index
  if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
    return NextResponse.json(
      { error: `Invalid chunk index ${chunkIndex} (total: ${session.totalChunks})`, code: 'INVALID_CHUNK_INDEX' },
      { status: 400 }
    )
  }

  // Save chunk using storeFile
  const chunkBuffer = Buffer.from(await chunkFile.arrayBuffer())
  const chunkName = `chunk_${chunkIndex}_${sessionId}`
  await storeFile(chunkBuffer, `chunks/${sessionId}/${chunkName}`)

  // Update session with received chunk index
  const uploadedChunks: number[] = JSON.parse(session.uploadedChunks)
  if (!uploadedChunks.includes(chunkIndex)) {
    uploadedChunks.push(chunkIndex)
    uploadedChunks.sort((a, b) => a - b)
  }

  await db.chunkUploadSession.update({
    where: { id: sessionId },
    data: { uploadedChunks: JSON.stringify(uploadedChunks) },
  })

  const progress = Math.round((uploadedChunks.length / session.totalChunks) * 100)

  return NextResponse.json({
    received: true,
    chunkIndex,
    progress,
    uploadedChunks: uploadedChunks.length,
    totalChunks: session.totalChunks,
  })
}

// ─── Complete: Assemble chunks into final file ───────────────────────────────

async function handleComplete(body: {
  sessionId: string
}) {
  if (!db) {
    return NextResponse.json(
      { error: 'Database not available', code: 'DB_UNAVAILABLE' },
      { status: 503 }
    )
  }

  const { sessionId } = body

  const session = await db.chunkUploadSession.findUnique({
    where: { id: sessionId },
  })

  if (!session || session.status !== 'active') {
    return NextResponse.json(
      { error: 'Invalid or expired upload session', code: 'INVALID_SESSION' },
      { status: 404 }
    )
  }

  // Verify all chunks received
  const uploadedChunks: number[] = JSON.parse(session.uploadedChunks)
  if (uploadedChunks.length !== session.totalChunks) {
    return NextResponse.json(
      {
        error: `Missing chunks: ${uploadedChunks.length}/${session.totalChunks} received`,
        code: 'INCOMPLETE_UPLOAD',
        missingChunks: Array.from({ length: session.totalChunks }, (_, i) => i).filter(
          (i) => !uploadedChunks.includes(i)
        ),
      },
      { status: 400 }
    )
  }

  // Update session status to prevent further chunk uploads
  await db.chunkUploadSession.update({
    where: { id: sessionId },
    data: { status: 'completed' },
  })

  try {
    // Assemble chunks into final file
    const chunks: Buffer[] = []
    const hasher = new StreamingHasher()

    for (let i = 0; i < session.totalChunks; i++) {
      const chunkName = `chunk_${i}_${sessionId}`
      const chunkPath = `chunks/${sessionId}/${chunkName}`
      const chunkBuffer = await retrieveFile(null, chunkPath)
      chunks.push(chunkBuffer)
      hasher.update(chunkBuffer)
    }

    const fileBuffer = Buffer.concat(chunks)
    const fileHash = hasher.digest()

    // Validate assembled file
    const fakeFile = {
      name: session.fileName,
      size: fileBuffer.length,
      type: 'application/pdf',
    } as File

    const validation = await validateUploadedFile(fakeFile, fileBuffer)
    if (!validation.valid) {
      await cleanupChunks(sessionId)
      return NextResponse.json(
        {
          error: 'Assembled file validation failed',
          code: 'VALIDATION_FAILED',
          details: validation.errors,
        },
        { status: 400 }
      )
    }

    // Duplicate detection with assembled hash
    const existing = await db.pdfFile.findFirst({ where: { fileHash } })
    if (existing) {
      await cleanupChunks(sessionId)
      return NextResponse.json(
        {
          error: 'Duplicate file detected',
          code: 'DUPLICATE_FILE',
          duplicate: {
            isDuplicate: true,
            existingFile: {
              id: existing.id,
              name: existing.name,
              originalName: existing.originalName,
              size: existing.size,
              pages: existing.pages,
              createdAt: existing.createdAt.toISOString(),
            },
          },
        },
        { status: 409 }
      )
    }

    // Virus scan
    const scanner = getVirusScanner()
    const scanResult = await scanner.scan(fileBuffer, session.fileName)

    if (scanResult.status === 'threat') {
      await cleanupChunks(sessionId)
      return NextResponse.json(
        {
          error: 'Security threat detected',
          code: 'VIRUS_DETECTED',
          threats: scanResult.threats,
        },
        { status: 422 }
      )
    }

    // Save assembled file
    const uniqueName = `${randomUUID()}.pdf`
    const { filePath } = await storeFile(fileBuffer, uniqueName)

    // Extract metadata
    let pages = 1
    try {
      pages = await getPageCount(fileBuffer)
    } catch (e) {
      console.error('Page count error:', e)
    }

    let metadataJson: string | null = null
    try {
      const metadata = await extractPdfMetadata(fileBuffer)
      metadataJson = JSON.stringify(metadata)
    } catch (e) {
      console.error('Metadata extraction error:', e)
    }

    // Save to database
    const pdfFile = await db.pdfFile.create({
      data: {
        name: session.fileName,
        originalName: session.fileName,
        size: fileBuffer.length,
        mimeType: 'application/pdf',
        pages,
        filePath,
        fileHash,
        uploadStatus: 'ready',
        metadata: metadataJson,
        virusScanStatus: scanResult.status === 'skipped' ? 'skipped' : 'clean',
        virusScanResult: scanResult.threats?.join(', ') || null,
        chunkUploadId: sessionId,
        textContent: null,
      },
    })

    // Log successful upload
    try {
      await db.uploadLog.create({
        data: {
          fileId: pdfFile.id,
          fileName: session.fileName,
          fileSize: fileBuffer.length,
          fileHash,
          status: 'completed',
          uploadDurationMs: Date.now() - session.createdAt.getTime(),
        },
      })
    } catch {
      // Non-critical
    }

    // Clean up chunk files
    await cleanupChunks(sessionId)

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
    console.error('Chunk assembly error:', error)
    await cleanupChunks(sessionId)
    return NextResponse.json(
      { error: 'Failed to assemble file', code: 'ASSEMBLY_ERROR' },
      { status: 500 }
    )
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanupChunks(sessionId: string) {
  // Clean up chunk files from storage
  try {
    // Delete each chunk file
    for (let i = 0; i < 100; i++) { // Reasonable upper bound
      try {
        const chunkName = `chunk_${i}_${sessionId}`
        const chunkPath = `chunks/${sessionId}/${chunkName}`
        await deleteFile(chunkPath)
      } catch {
        // Chunk may not exist, continue
      }
    }
  } catch {
    // Best effort cleanup
  }

  try {
    if (!db) return
    await db.chunkUploadSession.update({
      where: { id: sessionId },
      data: { status: 'completed' },
    })
  } catch {
    // Session might already be updated
  }
}
