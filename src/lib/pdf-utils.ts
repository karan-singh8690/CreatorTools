import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { readFile } from 'fs/promises'

/**
 * Create a PDF from text content
 */
export async function createPdfFromText(options: {
  title?: string
  content: string
  fontSize?: number
  fontFamily?: string
  pageSize?: 'letter' | 'a4' | 'legal'
  margin?: number
}): Promise<Buffer> {
  const {
    title,
    content,
    fontSize = 12,
    fontFamily = 'Helvetica',
    pageSize = 'a4',
    margin = 50,
  } = options

  const pdfDoc = await PDFDocument.create()

  // Page dimensions
  const pageSizes: Record<string, { width: number; height: number }> = {
    letter: { width: 612, height: 792 },
    a4: { width: 595.28, height: 841.89 },
    legal: { width: 612, height: 1008 },
  }
  const { width, height } = pageSizes[pageSize] || pageSizes.a4

  // Embed font
  const fontMap: Record<string, () => Promise<import('pdf-lib').PDFFont>> = {
    Helvetica: () => pdfDoc.embedFont(StandardFonts.Helvetica),
    'Courier New': () => pdfDoc.embedFont(StandardFonts.Courier),
    'Times New Roman': () => pdfDoc.embedFont(StandardFonts.TimesRoman),
  }
  const embedFn = fontMap[fontFamily] || fontMap.Helvetica
  const font = await embedFn()

  // Set metadata
  if (title) {
    pdfDoc.setTitle(title)
  }
  pdfDoc.setCreator('CreatorTools')

  const lineHeight = fontSize * 1.4
  const maxTextWidth = width - margin * 2
  let currentPage = pdfDoc.addPage([width, height])
  let y = height - margin

  // Draw title if provided
  if (title) {
    const titleSize = fontSize + 4
    y -= titleSize
    currentPage.drawText(title, {
      x: margin,
      y,
      size: titleSize,
      font,
      color: rgb(0, 0, 0),
    })
    y -= lineHeight // blank line after title
  }

  // Split content into paragraphs and then into lines that fit the page width
  const paragraphs = content.split('\n')

  for (const paragraph of paragraphs) {
    // Word-wrap the paragraph
    const words = paragraph.split(' ')
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const textWidth = font.widthOfTextAtSize(testLine, fontSize)

      if (textWidth > maxTextWidth && currentLine) {
        // Draw current line and start a new one
        if (y < margin + lineHeight) {
          currentPage = pdfDoc.addPage([width, height])
          y = height - margin
        }
        currentPage.drawText(currentLine, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        })
        y -= lineHeight
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    // Draw remaining line in paragraph
    if (currentLine) {
      if (y < margin + lineHeight) {
        currentPage = pdfDoc.addPage([width, height])
        y = height - margin
      }
      currentPage.drawText(currentLine, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      })
      y -= lineHeight
    }

    // Blank line between paragraphs
    y -= lineHeight * 0.5
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

/**
 * Extract page count from a PDF buffer using pdf-lib
 */
export async function getPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  return pdfDoc.getPageCount()
}

/**
 * Extract text content from a PDF buffer using pdfjs-dist
 * Uses dynamic import for compatibility with Next.js server environment
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    // Dynamic import to handle SSR/Node.js compatibility
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

    const data = new Uint8Array(pdfBuffer)
    const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise

    const textParts: string[] = []

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => {
          if ('str' in item) {
            return (item as { str: string }).str
          }
          return ''
        })
        .join(' ')
      if (pageText.trim()) {
        textParts.push(`--- Page ${i} ---\n${pageText}`)
      }
    }

    await doc.destroy()
    return textParts.join('\n\n')
  } catch (error) {
    console.error('Text extraction error:', error)
    // Fallback: try using pdf-lib to get at least basic info
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const pageCount = pdfDoc.getPageCount()
      return `[PDF with ${pageCount} page(s) - text extraction not available for this document]`
    } catch {
      return ''
    }
  }
}

/**
 * Merge multiple PDF buffers into one
 */
export async function mergePdfs(pdfBuffers: Buffer[]): Promise<Buffer> {
  const mergedPdf = await PDFDocument.create()

  for (const buffer of pdfBuffers) {
    const pdfDoc = await PDFDocument.load(buffer)
    const copiedPages = await mergedPdf.copyPages(
      pdfDoc,
      pdfDoc.getPageIndices()
    )
    copiedPages.forEach((page) => mergedPdf.addPage(page))
  }

  const mergedBytes = await mergedPdf.save()
  return Buffer.from(mergedBytes)
}

/**
 * Compress a PDF by re-saving with pdf-lib (removes redundancies)
 */
export async function compressPdf(pdfBuffer: Buffer): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
  })

  // Remove metadata to reduce size
  pdfDoc.setTitle('')
  pdfDoc.setAuthor('')
  pdfDoc.setSubject('')
  pdfDoc.setKeywords([])
  pdfDoc.setProducer('')
  pdfDoc.setCreator('')

  const compressedBytes = await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  })

  return Buffer.from(compressedBytes)
}

/**
 * Read a PDF file from disk
 */
export async function readPdfFile(filePath: string): Promise<Buffer> {
  return await readFile(filePath)
}

/**
 * Check if a specific page in a PDF is blank (no visible content)
 * Uses pdfjs-dist to extract text and checks for drawings via pdf-lib
 */
export async function isPageBlank(
  pdfBuffer: Buffer,
  pageIndex: number,
  threshold: number = 0.1
): Promise<boolean> {
  try {
    // Check text content using pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const data = new Uint8Array(pdfBuffer)
    const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise

    if (pageIndex >= doc.numPages) {
      await doc.destroy()
      return true
    }

    const page = await doc.getPage(pageIndex + 1) // pdfjs-dist is 1-indexed
    const textContent = await page.getTextContent()
    const text = textContent.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ')
      .trim()

    await doc.destroy()

    // If page has meaningful text, it's not blank
    if (text.length > 10) {
      return false
    }

    // Additional check: use pdf-lib to see if the page has drawing operators
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
    const pages = pdfDoc.getPages()
    if (pageIndex >= pages.length) return true

    const pageRef = pages[pageIndex]
    const { width, height } = pageRef.getSize()

    // If page has zero dimensions, consider it blank
    if (width === 0 || height === 0) {
      return true
    }

    // Check if the page content stream has any meaningful operators
    // This is a heuristic: if the content stream is very small, the page is likely blank
    const contentStream = pageRef.node.Contents()
    if (!contentStream) {
      // No content stream at all = blank page
      return true
    }

    return false
  } catch (error) {
    console.error('isPageBlank error:', error)
    // If we can't analyze the page, assume it's not blank (safer default)
    return false
  }
}

/**
 * Delete blank pages from a PDF buffer
 * Returns the new PDF buffer and count of deleted pages
 */
export async function deleteBlankPages(
  pdfBuffer: Buffer,
  threshold: number = 0.1
): Promise<{ buffer: Buffer; deletedCount: number }> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
  const totalPages = srcDoc.getPageCount()

  const pagesToKeep: number[] = []
  for (let i = 0; i < totalPages; i++) {
    const blank = await isPageBlank(pdfBuffer, i, threshold)
    if (!blank) {
      pagesToKeep.push(i)
    }
  }

  // If all pages would be deleted, keep the first one
  if (pagesToKeep.length === 0) {
    pagesToKeep.push(0)
  }

  const newDoc = await PDFDocument.create()
  const copiedPages = await newDoc.copyPages(srcDoc, pagesToKeep)
  copiedPages.forEach((page) => newDoc.addPage(page))

  const resultBuffer = Buffer.from(await newDoc.save())
  const deletedCount = totalPages - pagesToKeep.length

  return { buffer: resultBuffer, deletedCount }
}
