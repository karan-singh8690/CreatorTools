import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import { applyBatesNumber } from '@/lib/pdf-bates-number'
import type { BatesOptions } from '@/lib/pdf-bates-number-types'
import { getDefaultBatesOptions } from '@/lib/pdf-bates-number-types'

// ─── POST: Batch Apply Bates Numbering ──────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileIds, options: rawOptions } = body
    const options: BatesOptions = rawOptions || getDefaultBatesOptions()

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'No files specified' }, { status: 400 })
    }

    const results: Array<{
      fileId: string
      fileName: string
      success: boolean
      error?: string
      sizeIncrease?: number
      pagesProcessed?: number
      batesRange?: string
      firstBatesNumber?: string
      lastBatesNumber?: string
      outputId?: string
    }> = []

    let globalCounter = options.startNumber
    const auditEntries: Array<{
      timestamp: string
      action: 'apply' | 'undo' | 'preview' | 'conflict_detected'
      fileId?: string
      fileName?: string
      details: string
      batesRange?: string
      pagesProcessed?: number
    }> = []

    let totalSizeIncrease = 0
    let totalPagesProcessed = 0
    let globalFirstBates = ''
    let globalLastBates = ''

    // Process each file individually to save output buffers
    for (const fileId of fileIds) {
      const file = await db.pdfFile.findUnique({ where: { id: fileId } })
      if (!file) {
        results.push({ fileId, fileName: 'Unknown', success: false, error: 'File not found' })
        continue
      }

      const pdfBuffer = await retrieveFile(file.filePath)

      try {
        const result = await applyBatesNumber(Buffer.from(pdfBuffer), options, file.originalName, globalCounter)

        // Save the output file
        const outputFileName = `bates_${randomUUID()}.pdf`
        const { filePath: newFilePath } = await storeFile(result.outputBuffer!, outputFileName)

        // Create a new database record
        const outputFile = await db.pdfFile.create({
          data: {
            name: file.name.replace('.pdf', '_bates.pdf'),
            originalName: file.originalName.replace('.pdf', '_bates.pdf'),
            size: result.outputSize,
            mimeType: 'application/pdf',
            pages: file.pages,
            filePath: newFilePath,
            starred: false,
            textContent: null,
          },
        })

        results.push({
          fileId,
          fileName: file.originalName,
          success: true,
          sizeIncrease: result.sizeIncrease,
          pagesProcessed: result.pagesProcessed,
          batesRange: result.batesRange,
          firstBatesNumber: result.firstBatesNumber,
          lastBatesNumber: result.lastBatesNumber,
          outputId: outputFile.id,
        })

        totalSizeIncrease += result.sizeIncrease
        totalPagesProcessed += result.pagesProcessed

        if (!globalFirstBates) globalFirstBates = result.firstBatesNumber
        globalLastBates = result.lastBatesNumber

        // Advance global counter for continue-across-docs mode
        if (options.sequenceMode === 'continue-across-docs') {
          globalCounter += result.pagesProcessed
        }

        // Collect audit entries
        if (result.auditEntries) {
          for (const entry of result.auditEntries) {
            auditEntries.push({
              ...entry,
              fileId: file.id,
            })
          }
        }
      } catch (error: any) {
        results.push({
          fileId,
          fileName: file.originalName,
          success: false,
          error: error.message || 'Bates numbering failed',
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const errorCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      results,
      auditEntries,
      summary: {
        total: fileIds.length,
        success: successCount,
        errors: errorCount,
        totalSizeIncrease,
        totalPagesProcessed,
        globalBatesRange: globalFirstBates && globalLastBates
          ? `${globalFirstBates} → ${globalLastBates}`
          : '',
      },
    }, { status: 201 })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Batch bates number error:', error)
    return NextResponse.json(
      { error: error.message || 'Batch operation failed' },
      { status: 500 }
    )
  }
}
