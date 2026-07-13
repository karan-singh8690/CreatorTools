import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile } from '@/lib/file-storage'
import { createPdfFromText, getPageCount, extractTextFromPdf } from '@/lib/pdf-utils'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, fontSize, fontFamily, pageSize, margin } = body

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Create PDF from text
    const resultBuffer = await createPdfFromText({
      title,
      content,
      fontSize,
      fontFamily,
      pageSize,
      margin,
    })

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

    // Create database entry
    const fileName = title ? `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf` : `document_${Date.now()}.pdf`
    const resultFile = await db.pdfFile.create({
      data: {
        name: fileName,
        originalName: fileName,
        size: resultBuffer.length,
        mimeType: 'application/pdf',
        pages,
        filePath,
        textContent,
      },
    })

    return NextResponse.json({ file: resultFile })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Create PDF error:', error)
    return NextResponse.json(
      { error: 'Failed to create PDF' },
      { status: 500 }
    )
  }
}
