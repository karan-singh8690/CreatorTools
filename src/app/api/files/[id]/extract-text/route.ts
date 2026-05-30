import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    // If we already have text content, return it
    if (file.textContent && file.textContent.trim().length > 0) {
      return NextResponse.json({
        text: file.textContent,
        pages: file.pages,
        cached: true,
      })
    }

    // Return a placeholder - text extraction requires a separate worker process
    const textContent = `[PDF document: ${file.name} with ${file.pages} page(s). Text content extraction is available when you chat with this document using the AI assistant.]`

    return NextResponse.json({
      text: textContent,
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
