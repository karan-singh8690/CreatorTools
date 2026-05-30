import { PDFDocument } from 'pdf-lib'
import { readFile } from 'fs/promises'

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
