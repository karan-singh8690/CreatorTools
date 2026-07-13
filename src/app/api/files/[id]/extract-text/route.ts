import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { retrieveFile } from '@/lib/file-storage'
import { extractTextFromPdf } from '@/lib/pdf-utils'
import {
  extractStructuredText,
  exportToMarkdown,
  exportToHTML,
  exportToJSON,
  type ExportFormat,
} from '@/lib/pdf-extract'

/**
 * GET /api/files/[id]/extract-text
 * 
 * Query params:
 *   format — 'text' | 'json' | 'markdown' | 'html' | 'structured' (default: 'text')
 *   cached — 'true' | 'false' (default: 'true', use cached text for 'text' format)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const format = (request.nextUrl.searchParams.get('format') || 'text') as ExportFormat | 'text' | 'structured'
    const useCache = request.nextUrl.searchParams.get('cached') !== 'false'

    const file = await db.pdfFile.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // ── Plain text format (backward compatible) ──
    if (format === 'text') {
      // Return cached text if available
      if (useCache && file.textContent && file.textContent.trim().length > 0 && !file.textContent.startsWith('[PDF')) {
        return NextResponse.json({
          text: file.textContent,
          pages: file.pages,
          cached: true,
        })
      }

      try {
        const fileBuffer = await retrieveFile(file.filePath)
        const textContent = await extractTextFromPdf(fileBuffer)

        if (textContent && textContent.trim().length > 0 && !textContent.startsWith('[PDF')) {
          // Cache the extracted text
          await db.pdfFile.update({ where: { id }, data: { textContent } })
          return NextResponse.json({ text: textContent, pages: file.pages, cached: false })
        }
      } catch (e) {
        console.error('Text extraction error:', e)
      }

      const fallbackText = `[This PDF document "${file.name}" contains ${file.pages} page(s). Automatic text extraction was unable to retrieve readable text. The document may be image-based or scanned. Try using OCR for better results.]`
      return NextResponse.json({ text: fallbackText, pages: file.pages, cached: false })
    }

    // ── Structured extraction formats ──
    const fileBuffer = await retrieveFile(file.filePath)
    const structuredResult = await extractStructuredText(fileBuffer)

    switch (format) {
      case 'json': {
        const jsonStr = exportToJSON(structuredResult)
        return new NextResponse(jsonStr, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${file.name.replace(/\.pdf$/i, '')}_extracted.json"`,
          },
        })
      }

      case 'markdown': {
        const mdStr = exportToMarkdown(structuredResult)
        return new NextResponse(mdStr, {
          headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': `attachment; filename="${file.name.replace(/\.pdf$/i, '')}_extracted.md"`,
          },
        })
      }

      case 'html': {
        const htmlStr = exportToHTML(structuredResult)
        return new NextResponse(htmlStr, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `attachment; filename="${file.name.replace(/\.pdf$/i, '')}_extracted.html"`,
          },
        })
      }

      case 'structured':
      default: {
        // Return the full structured result as JSON (for UI rendering)
        return NextResponse.json({
          result: structuredResult,
          fileInfo: {
            id: file.id,
            name: file.name,
            size: file.size,
            pages: file.pages,
          },
        })
      }
    }
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', text: '', pages: 0 }, { status: 503 })
    }
    console.error('Extract text error:', error)
    return NextResponse.json(
      { error: 'Failed to extract text' },
      { status: 500 }
    )
  }
}
