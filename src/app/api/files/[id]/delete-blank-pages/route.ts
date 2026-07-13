import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile, stripFileData } from '@/lib/file-storage'
import { deleteBlankPages, getPageCount, extractTextFromPdf } from '@/lib/pdf-utils'
import { randomUUID } from 'crypto'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const file = await db.pdfFile.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Read the original file
    const fileBuffer = await retrieveFile(file.filePath)

    // Delete blank pages
    const { buffer: resultBuffer, deletedCount } = await deleteBlankPages(fileBuffer)

    // Save result file
    const uniqueName = `${randomUUID()}.pdf`
    const { filePath } = await storeFile(resultBuffer, uniqueName)

    // Get page count
    let pages = 1
    try {
      pages = await getPageCount(resultBuffer)
    } catch (e) {
      console.error('Page count error:', e)
    }

    // Extract text content
    let textContent: string | null = null
    try {
      textContent = await extractTextFromPdf(resultBuffer)
      if (textContent && textContent.trim().length === 0) {
        textContent = null
      }
    } catch (e) {
      console.error('Text extraction error:', e)
    }

    // Create new database entry
    const resultName = file.name.replace(/\.pdf$/i, '') + '_no-blanks.pdf'
    const resultFile = await db.pdfFile.create({
      data: {
        name: resultName,
        originalName: resultName,
        size: resultBuffer.length,
        mimeType: 'application/pdf',
        pages,
        filePath,
        textContent,
      },
    })

    return NextResponse.json({ file: stripFileData(resultFile), deletedCount })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Delete blank pages error:', error)
    return NextResponse.json(
      { error: 'Failed to delete blank pages' },
      { status: 500 }
    )
  }
}
