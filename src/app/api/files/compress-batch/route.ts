import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { getPageCount } from '@/lib/pdf-utils'
import { compressPdfAdvanced, type CompressionPreset } from '@/lib/pdf-compress'
import { randomUUID } from 'crypto'

/**
 * POST /api/files/compress-batch
 * 
 * Batch compress multiple PDFs with the same preset.
 * 
 * Body:
 *   fileIds: string[] — Array of file IDs to compress
 *   preset: CompressionPreset — 'high-quality' | 'balanced' | 'maximum'
 * 
 * Returns results for each file, including failures.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileIds, preset = 'balanced' } = body

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: 'fileIds array is required', code: 'MISSING_FILE_IDS' },
        { status: 400 }
      )
    }

    if (fileIds.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 files per batch', code: 'BATCH_SIZE_EXCEEDED' },
        { status: 400 }
      )
    }

    if (!['high-quality', 'balanced', 'maximum'].includes(preset)) {
      return NextResponse.json(
        { error: 'Invalid preset', code: 'INVALID_PRESET' },
        { status: 400 }
      )
    }

    const results = []

    for (const fileId of fileIds) {
      try {
        const file = await db.pdfFile.findUnique({ where: { id: fileId } })
        if (!file) {
          results.push({
            fileId,
            status: 'error',
            error: 'File not found',
          })
          continue
        }

        const fileBuffer = await retrieveFile(file.filePath)
        const compressResult = await compressPdfAdvanced(fileBuffer, preset as CompressionPreset)

        // Save compressed file
        const uniqueName = `${randomUUID()}.pdf`
        const { filePath: newFilePath } = await storeFile(compressResult.compressedBuffer, uniqueName)

        let pages = 1
        try {
          pages = await getPageCount(compressResult.compressedBuffer)
        } catch {
          // Keep default
        }

        const presetSuffix: Record<string, string> = {
          'high-quality': '_hq',
          'balanced': '_compressed',
          'maximum': '_max',
        }
        const compressedName = file.name.replace(/\.pdf$/i, '') + (presetSuffix[preset] || '_compressed') + '.pdf'

        const compressedFile = await db.pdfFile.create({
          data: {
            name: compressedName,
            originalName: compressedName,
            size: compressResult.compressedSize,
            mimeType: 'application/pdf',
            pages,
            filePath: newFilePath,
            fileHash: null,
            uploadStatus: 'ready',
            virusScanStatus: 'clean',
          },
        })

        results.push({
          fileId,
          status: 'success',
          file: compressedFile,
          compression: {
            originalSize: compressResult.originalSize,
            compressedSize: compressResult.compressedSize,
            savedBytes: compressResult.savedBytes,
            savedPercent: `${compressResult.savedPercent}%`,
          },
          operations: compressResult.operations,
          durationMs: compressResult.durationMs,
        })
      } catch (error) {
        results.push({
          fileId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Compression failed',
        })
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length
    const errorCount = results.filter((r) => r.status === 'error').length
    const totalSavedBytes = results
      .filter((r) => r.status === 'success')
      .reduce((sum, r) => sum + r.compression.savedBytes, 0)

    return NextResponse.json({
      results,
      summary: {
        total: fileIds.length,
        success: successCount,
        errors: errorCount,
        totalSavedBytes,
        preset,
      },
    })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Batch compress error:', error)
    return NextResponse.json(
      { error: 'Batch compression failed', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
