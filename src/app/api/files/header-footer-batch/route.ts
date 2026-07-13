import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import {
  applyHeaderFooter,
} from '@/lib/pdf-header-footer'
import type { HeaderFooterOptions } from '@/lib/pdf-header-footer-types'

// ─── POST: Batch Apply Header/Footer ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileIds, options } = body as {
      fileIds: string[]
      options: HeaderFooterOptions
    }

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: 'fileIds array is required' },
        { status: 400 }
      )
    }

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
      pagesProcessed?: number
    }> = []

    // Process each file
    for (const file of files) {
      try {
        const pdfBuffer = await retrieveFile(file.filePath)
        const result = await applyHeaderFooter(
          Buffer.from(pdfBuffer),
          options,
          file.originalName,
        )

        // Save the output file
        const outputFileName = `headerfooter_${randomUUID()}.pdf`
        const { filePath: newFilePath } = await storeFile(result.outputBuffer, outputFileName)

        // Create a new database record
        await db.pdfFile.create({
          data: {
            name: file.name.replace('.pdf', '_header_footer.pdf'),
            originalName: file.originalName.replace('.pdf', '_header_footer.pdf'),
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
          fileName: file.originalName,
          success: true,
          sizeIncrease: result.sizeIncrease,
          pagesProcessed: result.pagesProcessed,
        })
      } catch (error: any) {
        results.push({
          fileId: file.id,
          fileName: file.originalName,
          success: false,
          error: error.message || 'Header/footer application failed',
        })
      }
    }

    const summary = {
      total: files.length,
      success: results.filter((r) => r.success).length,
      errors: results.filter((r) => !r.success).length,
      totalSizeIncrease: results.reduce((sum, r) => sum + (r.sizeIncrease || 0), 0),
    }

    return NextResponse.json({ results, summary }, { status: 201 })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Batch header/footer error:', error)
    return NextResponse.json(
      { error: error.message || 'Batch header/footer failed' },
      { status: 500 }
    )
  }
}
