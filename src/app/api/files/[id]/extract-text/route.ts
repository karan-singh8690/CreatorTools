import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile } from 'fs/promises'
import { extractTextFromPdf } from '@/lib/pdf-utils'

export async function GET(
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

    // If we already have cached text content, return it
    if (file.textContent && file.textContent.trim().length > 0 && !file.textContent.startsWith('[PDF')) {
      return NextResponse.json({
        text: file.textContent,
        pages: file.pages,
        cached: true,
      })
    }

    // Actually extract text from the PDF file
    try {
      const fileBuffer = await readFile(file.filePath)
      const textContent = await extractTextFromPdf(fileBuffer)

      if (textContent && textContent.trim().length > 0 && !textContent.startsWith('[PDF')) {
        // Cache the extracted text in the database
        await db.pdfFile.update({
          where: { id },
          data: { textContent },
        })

        return NextResponse.json({
          text: textContent,
          pages: file.pages,
          cached: false,
        })
      }
    } catch (e) {
      console.error('Text extraction error:', e)
    }

    // Fallback: return a message indicating no text could be extracted
    const fallbackText = `[This PDF document "${file.name}" contains ${file.pages} page(s). Automatic text extraction was unable to retrieve readable text. The document may be image-based or scanned. Try using OCR for better results.]`

    return NextResponse.json({
      text: fallbackText,
      pages: file.pages,
      cached: false,
    })
  } catch (error) {
    console.error('Extract text error:', error)
    return NextResponse.json(
      { error: 'Failed to extract text' },
      { status: 500 }
    )
  }
}
