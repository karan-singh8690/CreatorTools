import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { getPageCount, extractTextFromPdf } from '@/lib/pdf-utils'
import {
  compressPdfAdvanced,
  analyzeCompressionPotential,
  type CompressionPreset,
} from '@/lib/pdf-compress'
import { randomUUID } from 'crypto'

/**
 * GET /api/files/[id]/compress
 * 
 * Compression preview — analyze compression potential without actually compressing.
 * Query params:
 *   action=preview — Get estimated savings (default)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const action = request.nextUrl.searchParams.get('action') || 'preview'

    if (action !== 'preview') {
      return NextResponse.json(
        { error: 'Invalid action. Use action=preview' },
        { status: 400 }
      )
    }

    const file = await db.pdfFile.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileBuffer = await retrieveFile(file.filePath)
    const preview = await analyzeCompressionPotential(fileBuffer)

    return NextResponse.json({
      preview,
      fileInfo: {
        id: file.id,
        name: file.name,
        size: file.size,
        pages: file.pages,
      },
    })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }
    console.error('Compression preview error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze compression potential' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/files/[id]/compress
 * 
 * Compress a PDF file with the specified preset.
 * 
 * Body:
 *   preset: 'high-quality' | 'balanced' | 'maximum' (default: 'balanced')
 *   replace: boolean — Replace original file instead of creating a new one (default: false)
 * 
 * Returns:
 *   file: PdfFile — The compressed file record
 *   compression: { originalSize, compressedSize, savedBytes, savedPercent }
 *   operations: CompressionOperation[] — Detailed breakdown
 *   durationMs: number — Time taken
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Parse request body for preset
    let preset: CompressionPreset = 'balanced'
    let replace = false

    try {
      const body = await request.json()
      if (body.preset && ['high-quality', 'balanced', 'maximum'].includes(body.preset)) {
        preset = body.preset
      }
      if (typeof body.replace === 'boolean') {
        replace = body.replace
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    const file = await db.pdfFile.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read the original file
    const fileBuffer = await retrieveFile(file.filePath)

    // Compress with advanced engine
    const result = await compressPdfAdvanced(fileBuffer, preset)

    // Save compressed file
    const uniqueName = `${randomUUID()}.pdf`
    const { filePath: newFilePath } = await storeFile(result.compressedBuffer, uniqueName)

    // Get page count
    let pages = 1
    try {
      pages = await getPageCount(result.compressedBuffer)
    } catch (e) {
      console.error('Page count error:', e)
    }

    // Extract text content
    let textContent: string | null = null
    try {
      textContent = await extractTextFromPdf(result.compressedBuffer)
      if (textContent && textContent.trim().length === 0) {
        textContent = null
      }
    } catch (e) {
      console.error('Text extraction error:', e)
    }

    if (replace) {
      // Replace original file
      const updatedFile = await db.pdfFile.update({
        where: { id },
        data: {
          size: result.compressedSize,
          pages,
          textContent,
          filePath: newFilePath,
        },
      })

      return NextResponse.json({
        file: updatedFile,
        compression: {
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          savedBytes: result.savedBytes,
          savedPercent: `${result.savedPercent}%`,
        },
        operations: result.operations,
        durationMs: result.durationMs,
        preset,
      })
    }

    // Create new database entry for compressed file
    const presetSuffix: Record<CompressionPreset, string> = {
      'high-quality': '_hq',
      'balanced': '_compressed',
      'maximum': '_max',
    }
    const compressedName = file.name.replace(/\.pdf$/i, '') + (presetSuffix[preset] || '_compressed') + '.pdf'

    const compressedFile = await db.pdfFile.create({
      data: {
        name: compressedName,
        originalName: compressedName,
        size: result.compressedSize,
        mimeType: 'application/pdf',
        pages,
        filePath: newFilePath,
        textContent,
        fileHash: null,
        uploadStatus: 'ready',
        virusScanStatus: 'clean',
      },
    })

    return NextResponse.json({
      file: compressedFile,
      compression: {
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        savedBytes: result.savedBytes,
        savedPercent: `${result.savedPercent}%`,
      },
      operations: result.operations,
      durationMs: result.durationMs,
      preset,
    })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Compress file error:', error)
    return NextResponse.json(
      { error: 'Failed to compress file' },
      { status: 500 }
    )
  }
}
