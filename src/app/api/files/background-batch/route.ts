import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import {
  applyBackground,
  getDefaultBackgroundOptions,
  type BackgroundOptions,
} from '@/lib/pdf-background'

/**
 * Batch background API — Apply the same background to multiple PDFs.
 *
 * POST body: { fileIds: string[], options: BackgroundOptions }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileIds, options: rawOptions } = body

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'fileIds array is required' }, { status: 400 })
    }

    if (fileIds.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 files per batch' }, { status: 400 })
    }

    const options: BackgroundOptions = rawOptions || getDefaultBackgroundOptions('solid')

    // Fetch all files
    const files = await db.pdfFile.findMany({
      where: { id: { in: fileIds } },
    })

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files found' }, { status: 404 })
    }

    const results: Array<{
      fileId: string
      fileName: string
      success: boolean
      error?: string
      sizeIncrease?: number
      pagesModified?: number
    }> = []

    for (const file of files) {
      try {
        const pdfBuffer = await retrieveFile(file.filePath)
        const result = await applyBackground(Buffer.from(pdfBuffer), options)

        // Save output file
        const outputFileName = `background_${randomUUID()}.pdf`
        const { filePath: newFilePath } = await storeFile(result.outputBuffer, outputFileName)

        // Create database record
        await db.pdfFile.create({
          data: {
            name: file.name.replace('.pdf', '_bg.pdf'),
            originalName: file.name.replace('.pdf', '_bg.pdf'),
            size: result.outputSize,
            mimeType: 'application/pdf',
            pages: file.pages,
            filePath: newFilePath,
            starred: false,
            textContent: null,
          },
        })

        results.push({
          fileId: file.id,
          fileName: file.name,
          success: true,
          sizeIncrease: result.sizeIncrease,
          pagesModified: result.pagesModified,
        })
      } catch (error: any) {
        results.push({
          fileId: file.id,
          fileName: file.name,
          success: false,
          error: error.message || 'Background failed',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const errorCount = results.filter((r) => !r.success).length
    const totalSizeIncrease = results.reduce((sum, r) => sum + (r.sizeIncrease || 0), 0)

    return NextResponse.json({
      results,
      summary: {
        total: fileIds.length,
        success: successCount,
        errors: errorCount,
        totalSizeIncrease,
      },
    })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Batch background error:', error)
    return NextResponse.json(
      { error: error.message || 'Batch background failed' },
      { status: 500 }
    )
  }
}
