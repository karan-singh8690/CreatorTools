import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { storeFile, retrieveFile, stripFileData } from '@/lib/file-storage'
import { randomUUID } from 'crypto'

interface EditOperation {
  type: 'add-text' | 'add-image' | 'delete-page' | 'rotate-page' | 'reorder-pages'
  params: Record<string, unknown>
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const operations: EditOperation[] = body.operations

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json(
        { error: 'At least one edit operation is required' },
        { status: 400 }
      )
    }

    const file = await db.pdfFile.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Read the PDF file
    const fileBuffer = await retrieveFile(file.filePath)
    const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true })
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Process each operation sequentially
    for (const op of operations) {
      switch (op.type) {
        case 'add-text': {
          const text = (op.params.text as string) ?? ''
          const page = ((op.params.page as number) ?? 1) - 1 // 0-indexed
          const x = (op.params.x as number) ?? 50
          const y = (op.params.y as number) ?? 50
          const fontSize = (op.params.fontSize as number) ?? 12
          const color = (op.params.color as string) ?? '#000000'
          const fontName = (op.params.font as string) ?? 'helvetica'

          if (!text.trim()) continue

          const pages = pdfDoc.getPages()
          if (page < 0 || page >= pages.length) continue

          const targetPage = pages[page]
          const { height: pageHeight } = targetPage.getSize()

          // PDF Y is from bottom, convert from top-down
          const pdfY = pageHeight - y

          // Parse color
          const parsedColor = parseColor(color)

          // Select font
          const selectedFont = fontName === 'bold' ? boldFont : font

          // Word-wrap and draw text
          const maxWidth = targetPage.getSize().width - x - 50
          const lines = wrapText(text, selectedFont, fontSize, maxWidth)

          for (let i = 0; i < lines.length; i++) {
            try {
              targetPage.drawText(lines[i], {
                x,
                y: pdfY - i * (fontSize + 2),
                size: fontSize,
                font: selectedFont,
                color: rgb(parsedColor.r, parsedColor.g, parsedColor.b),
              })
            } catch {
              // Skip lines that can't be rendered
            }
          }
          break
        }

        case 'add-image': {
          const imageDataUrl = op.params.imageDataUrl as string
          const page = ((op.params.page as number) ?? 1) - 1
          const x = (op.params.x as number) ?? 50
          const y = (op.params.y as number) ?? 50
          const width = (op.params.width as number) ?? 200
          const height = (op.params.height as number) ?? 150

          if (!imageDataUrl) continue

          const dataUrlMatch = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
          if (!dataUrlMatch) continue

          const mimeType = dataUrlMatch[1]
          const base64Data = dataUrlMatch[2]
          const imageBuffer = Buffer.from(base64Data, 'base64')

          const pages = pdfDoc.getPages()
          if (page < 0 || page >= pages.length) continue

          let image
          if (mimeType === 'image/png') {
            image = await pdfDoc.embedPng(imageBuffer)
          } else {
            image = await pdfDoc.embedJpg(imageBuffer)
          }

          const targetPage = pages[page]
          const { height: pageHeight } = targetPage.getSize()
          const pdfY = pageHeight - y - height

          targetPage.drawImage(image, { x, y: pdfY, width, height })
          break
        }

        case 'delete-page': {
          const page = ((op.params.page as number) ?? 1) - 1
          const pages = pdfDoc.getPages()
          if (page >= 0 && page < pages.length && pages.length > 1) {
            pdfDoc.removePage(page)
          }
          break
        }

        case 'rotate-page': {
          const page = ((op.params.page as number) ?? 1) - 1
          const degrees = (op.params.degrees as number) ?? 90

          const pages = pdfDoc.getPages()
          if (page < 0 || page >= pages.length) continue

          const targetPage = pages[page]
          const currentRotation = targetPage.getRotation().angle
          targetPage.setRotation({ angle: (currentRotation + degrees) % 360 })
          break
        }

        case 'reorder-pages': {
          const newOrder = op.params.newOrder as number[]
          if (!newOrder || !Array.isArray(newOrder)) continue

          // Convert to 0-indexed
          const indices = newOrder.map((p) => p - 1)
          const pageCount = pdfDoc.getPageCount()

          // Validate indices
          if (indices.length !== pageCount) continue
          if (!indices.every((i) => i >= 0 && i < pageCount)) continue
          if (new Set(indices).size !== pageCount) continue

          // Copy pages in the new order
          const copiedPages = await pdfDoc.copyPages(pdfDoc, indices)
          // Remove all existing pages
          for (let i = pageCount - 1; i >= 0; i--) {
            pdfDoc.removePage(i)
          }
          // Add pages in new order
          for (const copiedPage of copiedPages) {
            pdfDoc.addPage(copiedPage)
          }
          break
        }

        default:
          // Unknown operation, skip
          break
      }
    }

    const resultBuffer = Buffer.from(await pdfDoc.save())

    // Save the edited file
    const uniqueName = `${randomUUID()}.pdf`
    const { filePath } = await storeFile(resultBuffer, uniqueName)

    const pageCount = pdfDoc.getPageCount()
    const outputName = file.name.replace(/\.pdf$/i, '') + '_edited.pdf'
    const resultFile = await db.pdfFile.create({
      data: {
        name: outputName,
        originalName: outputName,
        size: resultBuffer.length,
        mimeType: 'application/pdf',
        pages: pageCount,
        filePath,
        textContent: null,
      },
    })

    return NextResponse.json({ file: stripFileData(resultFile) })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Edit PDF error:', error)
    return NextResponse.json(
      { error: 'Failed to edit PDF' },
      { status: 500 }
    )
  }
}

function parseColor(hex: string): { r: number; g: number; b: number } {
  try {
    const clean = hex.replace('#', '')
    const r = parseInt(clean.substring(0, 2), 16) / 255
    const g = parseInt(clean.substring(2, 4), 16) / 255
    const b = parseInt(clean.substring(4, 6), 16) / 255
    return { r, g, b }
  } catch {
    return { r: 0, g: 0, b: 0 }
  }
}

function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  if (!text.trim()) return [text]
  if (maxWidth <= 0) maxWidth = 400

  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    try {
      const testWidth = font.widthOfTextAtSize(testLine, fontSize)
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    } catch {
      // If measurement fails, just push the word
      currentLine = testLine
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.length > 0 ? lines : [text]
}
