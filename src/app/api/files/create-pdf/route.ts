import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { storeFile, stripFileData } from '@/lib/file-storage'
import { randomUUID } from 'crypto'

/** Page dimensions in points for common sizes */
const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
}

const MARGIN = 72 // 1 inch = 72 points

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const title = (body.title as string) ?? ''
    const content = (body.content as string) ?? ''
    const pageSize = (body.pageSize as string) ?? 'A4'
    const orientation = (body.orientation as string) ?? 'portrait'

    if (!title.trim() && !content.trim()) {
      return NextResponse.json(
        { error: 'Title or content is required' },
        { status: 400 }
      )
    }

    // Get page dimensions
    const dims = PAGE_SIZES[pageSize] ?? PAGE_SIZES.A4
    const pageWidth = orientation === 'landscape' ? dims.height : dims.width
    const pageHeight = orientation === 'landscape' ? dims.width : dims.height

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Calculate content area
    const contentWidth = pageWidth - 2 * MARGIN
    const contentBottom = MARGIN

    // Add first page
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
    let currentY = pageHeight - MARGIN

    // Draw title (24pt bold)
    if (title.trim()) {
      const titleSize = 24
      const titleLines = wrapText(title, boldFont, titleSize, contentWidth)

      for (const line of titleLines) {
        if (currentY < contentBottom + titleSize) {
          // Need new page
          currentPage = pdfDoc.addPage([pageWidth, pageHeight])
          currentY = pageHeight - MARGIN
        }
        currentPage.drawText(line, {
          x: MARGIN,
          y: currentY - titleSize,
          size: titleSize,
          font: boldFont,
          color: rgb(0, 0, 0),
        })
        currentY -= titleSize + 6
      }

      // Add spacing after title
      currentY -= 16
    }

    // Draw content (12pt regular)
    const bodySize = 12
    const lineHeight = bodySize + 4

    // Split content by paragraphs (double newline)
    const paragraphs = content.split(/\n\n+/)

    for (const paragraph of paragraphs) {
      // Split by single newlines for hard line breaks
      const hardLines = paragraph.split(/\n/)

      for (const hardLine of hardLines) {
        if (!hardLine.trim() && hardLines.length > 1) {
          // Empty line within paragraph — add some spacing
          currentY -= lineHeight * 0.5
          continue
        }

        const wrappedLines = wrapText(hardLine, font, bodySize, contentWidth)

        for (const line of wrappedLines) {
          if (currentY < contentBottom + bodySize) {
            // Need new page
            currentPage = pdfDoc.addPage([pageWidth, pageHeight])
            currentY = pageHeight - MARGIN
          }
          currentPage.drawText(line, {
            x: MARGIN,
            y: currentY - bodySize,
            size: bodySize,
            font,
            color: rgb(0, 0, 0),
          })
          currentY -= lineHeight
        }
      }

      // Add paragraph spacing
      currentY -= lineHeight * 0.6
    }

    const resultBuffer = Buffer.from(await pdfDoc.save())

    const uniqueName = `${randomUUID()}.pdf`
    const { filePath } = await storeFile(resultBuffer, uniqueName)

    const outputName = title.trim()
      ? title.trim().replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50) + '.pdf'
      : 'document.pdf'

    const pageCount = pdfDoc.getPageCount()

    const resultFile = await db.pdfFile.create({
      data: {
        name: outputName,
        originalName: outputName,
        size: resultBuffer.length,
        mimeType: 'application/pdf',
        pages: pageCount,
        filePath,
        textContent: content.trim() || null,
      },
    })

    return NextResponse.json({ file: stripFileData(resultFile) })
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

/** Word-wrap text to fit within maxWidth using the given font and size */
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  if (!text.trim()) return [text]

  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const testWidth = font.widthOfTextAtSize(testLine, fontSize)

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.length > 0 ? lines : [text]
}
