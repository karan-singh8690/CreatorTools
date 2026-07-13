import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { extractTextFromPdf, getPageCount } from '@/lib/pdf-utils'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'

const MAX_TEXT_LENGTH = 15000
const MIN_CHARS_PER_PAGE = 10 // Lowered threshold - even short text is still text

const SUPPORTED_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese',
  'Korean', 'Arabic', 'Hindi', 'Portuguese', 'Italian', 'Dutch',
  'Russian', 'Turkish', 'Vietnamese',
]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const language = (body.language as string) ?? 'English'
    const makeSearchable = (body.makeSearchable as boolean) ?? false

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return NextResponse.json(
        { error: `Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}` },
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

    const fileBuffer = await retrieveFile(file.filePath)
    let extractedText = await extractTextFromPdf(fileBuffer)
    const pageCount = file.pages || await getPageCount(fileBuffer).catch(() => 1)

    // Detect if the PDF is scanned/image-based
    const isScanned = !extractedText ||
      extractedText.trim().length === 0 ||
      extractedText.startsWith('[PDF') ||
      (extractedText.trim().length / pageCount) < MIN_CHARS_PER_PAGE

    let confidence: string
    let finalText: string

    if (isScanned) {
      // Scanned PDF - try LLM, fall back gracefully if unavailable
      confidence = 'Low (scanned/image PDF detected)'
      try {
        finalText = await ocrWithLLM(extractedText, file.name, language, pageCount)
      } catch (llmError) {
        console.error('OCR LLM fallback error:', llmError)
        // If LLM fails (e.g. API unreachable on Vercel), still return what we have
        const partialText = extractedText && !extractedText.startsWith('[PDF')
          ? extractedText
          : ''
        finalText = partialText || `[This scanned PDF "${file.name}" contains ${pageCount} page(s). AI-powered OCR is currently unavailable. The document may be image-based. Please try again later or use a dedicated OCR service. Language: ${language}]`
        confidence = 'Low (AI OCR unavailable - could not connect to language model)'
      }
    } else {
      // Text-based PDF - high confidence extraction
      confidence = 'High (text-based PDF detected)'
      finalText = extractedText
    }

    // Cache the extracted text
    await db.pdfFile.update({
      where: { id },
      data: { textContent: finalText },
    })

    let searchableFileId: string | null = null

    // Create searchable PDF if requested
    if (makeSearchable && finalText.trim().length > 0) {
      try {
        const searchablePdfBuffer = await createSearchablePdf(fileBuffer, finalText)
        const uniqueName = `${randomUUID()}.pdf`
        const { filePath } = await storeFile(searchablePdfBuffer, uniqueName)

        const searchablePages = await getPageCount(searchablePdfBuffer).catch(() => pageCount)
        const outputName = file.name.replace(/\.pdf$/i, '') + '_searchable.pdf'
        const searchableFile = await db.pdfFile.create({
          data: {
            name: outputName,
            originalName: outputName,
            size: searchablePdfBuffer.length,
            mimeType: 'application/pdf',
            pages: searchablePages,
            filePath,
            textContent: finalText,
          },
        })
        searchableFileId = searchableFile.id
      } catch (e) {
        console.error('Create searchable PDF error:', e)
      }
    }

    return NextResponse.json({
      text: finalText,
      isScanned,
      pagesProcessed: pageCount,
      confidence,
      searchableFileId,
    })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('OCR file error:', error)
    return NextResponse.json(
      { error: 'Failed to perform OCR' },
      { status: 500 }
    )
  }
}

async function ocrWithLLM(
  existingText: string,
  fileName: string,
  language: string,
  pageCount: number
): Promise<string> {
  let inputText = existingText || ''
  let truncated = false
  if (inputText.length > MAX_TEXT_LENGTH) {
    inputText = inputText.substring(0, MAX_TEXT_LENGTH)
    truncated = true
  }

  const { getZai } = await import('@/lib/zai')
  const zai = await getZai()

  const hasSomeText = inputText.trim().length > 0 && !inputText.startsWith('[PDF')

  const prompt = hasSomeText
    ? `The following is partially extracted text from a scanned/image-based PDF named "${fileName}" (${pageCount} pages). The document appears to be scanned, so text extraction was incomplete. Please analyze the available text metadata and describe the document content as thoroughly as possible. The document language is ${language}. Output the reconstructed/extracted text content:

${inputText}${truncated ? '\n\n[Note: Text was truncated due to length.]' : ''}`
    : `A PDF document named "${fileName}" (${pageCount} pages) appears to be a scanned/image-based document with no extractable text. The document language is ${language}. Since this is a scanned document, please provide a general description of what such documents typically contain, noting that the actual content could not be extracted through automated text extraction. Recommend using a dedicated OCR service for accurate results.`

  const messages = [
    {
      role: 'assistant' as const,
      content: 'You are an OCR assistant. Analyze partially extracted text from scanned PDFs and provide the best possible text reconstruction. If the text is very limited, explain that the document is image-based and recommend dedicated OCR tools.',
    },
    {
      role: 'user' as const,
      content: prompt,
    },
  ]

  const response = await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' },
  })

  const result = response.choices?.[0]?.message?.content

  if (!result) {
    return `[This scanned PDF "${fileName}" contains ${pageCount} page(s). Automated text extraction could not retrieve readable text. The document may be image-based. Please use a dedicated OCR service for better results. Language: ${language}]`
  }

  return `[OCR Analysis - Scanned Document: ${fileName}]\n[Language: ${language}]\n[Note: This document appears to be scanned. The following is AI-assisted text reconstruction.]\n\n${result}`
}

async function createSearchablePdf(originalBuffer: Buffer, text: string): Promise<Buffer> {
  // Load original PDF and add invisible text layer
  const pdfDoc = await PDFDocument.load(originalBuffer, { ignoreEncryption: true })
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()

  // Split text by page markers
  const pageTexts = text.split(/--- Page \d+ ---/).filter((p) => p.trim().length > 0)

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const { width, height } = page.getSize()
    const pageText = pageTexts[i] || ''

    if (!pageText.trim()) continue

    // Draw text at very small size and nearly invisible (this makes it searchable)
    const fontSize = 2
    const lines = pageText.split('\n').filter((l) => l.trim().length > 0)
    const lineHeight = 4
    let y = height - 10

    for (const line of lines) {
      if (y < 10) break
      try {
        // Draw in very light gray (nearly invisible but searchable)
        page.drawText(line.trim().substring(0, 500), {
          x: 5,
          y,
          size: fontSize,
          font,
          color: rgb(1, 1, 1), // white - invisible on white background
        })
      } catch {
        // Skip lines that can't be rendered with the font
      }
      y -= lineHeight
    }
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
