import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'

import { extractTextFromPdf, getPageCount } from '@/lib/pdf-utils'
import { storeFile, retrieveFile, stripFileData } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const SUPPORTED_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese',
  'Korean', 'Arabic', 'Hindi', 'Portuguese', 'Italian', 'Dutch',
  'Russian', 'Turkish', 'Vietnamese',
]

const CHUNK_SIZE = 3000
const MAX_TEXT_LENGTH = 10000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { targetLanguage, sourceLanguage } = body

    if (!targetLanguage) {
      return NextResponse.json(
        { error: 'Target language is required' },
        { status: 400 }
      )
    }

    if (!SUPPORTED_LANGUAGES.includes(targetLanguage)) {
      return NextResponse.json(
        { error: `Unsupported target language: ${targetLanguage}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}` },
        { status: 400 }
      )
    }

    if (sourceLanguage && !SUPPORTED_LANGUAGES.includes(sourceLanguage)) {
      return NextResponse.json(
        { error: `Unsupported source language: ${sourceLanguage}` },
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

    // Read the PDF file - use cached text if available
    let extractedText = file.textContent

    if (!extractedText || extractedText.trim().length === 0 || extractedText.startsWith('[PDF')) {
      try {
        const fileBuffer = await retrieveFile(file.filePath)
        extractedText = await extractTextFromPdf(fileBuffer)
      } catch (e) {
        console.error('Text extraction error:', e)
      }
    }

    if (!extractedText || extractedText.trim().length === 0 || extractedText.startsWith('[PDF')) {
      return NextResponse.json(
        { error: 'Could not extract text from this PDF. It may be image-based. Try using OCR first.' },
        { status: 400 }
      )
    }

    // Truncate if too long
    let textToTranslate = extractedText
    let truncated = false
    if (textToTranslate.length > MAX_TEXT_LENGTH) {
      textToTranslate = textToTranslate.substring(0, MAX_TEXT_LENGTH)
      truncated = true
    }

    // Try to use z-ai-web-dev-sdk for translation
    let translatedText: string

    try {
      const { getZai } = await import('@/lib/zai')
      const zai = await getZai()

      // Split into chunks and translate each
      const chunks: string[] = []
      for (let i = 0; i < textToTranslate.length; i += CHUNK_SIZE) {
        chunks.push(textToTranslate.slice(i, i + CHUNK_SIZE))
      }

      const translatedChunks: string[] = []

      for (const chunk of chunks) {
        const sourceLangPart = sourceLanguage
          ? `The source language is ${sourceLanguage}.`
          : 'Detect the source language automatically.'

        const prompt = `Translate the following text to ${targetLanguage}. ${sourceLangPart} Preserve the structure and formatting. Only return the translated text, nothing else:

${chunk}`

        const messages = [
          {
            role: 'assistant' as const,
            content: 'You are a professional translator. Translate text accurately while preserving structure and formatting. Only return the translated text.',
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

        const translated = response.choices?.[0]?.message?.content || chunk
        translatedChunks.push(translated)
      }

      translatedText = translatedChunks.join('\n\n')
    } catch (aiError) {
      console.error('Translation AI error:', aiError)
      return NextResponse.json(
        { error: 'Translation service is currently unavailable. The AI translation feature requires a connection to the language model service which may not be accessible in this environment.', partnerToolId: 'translate-pdf' },
        { status: 503 }
      )
    }

    if (truncated) {
      translatedText += '\n\n[Note: The document was too long to translate in full. Only the first portion was translated.]'
    }

    // Create a new PDF with the translated text
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const fontSize = 11
    const margin = 50
    const lineHeight = fontSize * 1.5
    const pageWidth = 595.28 // A4 width
    const pageHeight = 841.89 // A4 height
    const usableWidth = pageWidth - 2 * margin

    // Split translated text into lines that fit the page width
    const paragraphs = translatedText.split('\n')
    const allLines: string[] = []

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        allLines.push('')
        continue
      }

      const words = paragraph.split(' ')
      let currentLine = ''

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const textWidth = font.widthOfTextAtSize(testLine, fontSize)

        if (textWidth > usableWidth) {
          if (currentLine) {
            allLines.push(currentLine)
          }
          currentLine = word
        } else {
          currentLine = testLine
        }
      }

      if (currentLine) {
        allLines.push(currentLine)
      }
    }

    // Write lines to pages
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin

    for (const line of allLines) {
      if (y < margin + lineHeight) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }

      if (line === '') {
        y -= lineHeight * 0.5
        continue
      }

      currentPage.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      })

      y -= lineHeight
    }

    const pdfBytes = await pdfDoc.save()
    const outputBuffer = Buffer.from(pdfBytes)

    // Save the translated PDF
    const uniqueName = `${randomUUID()}.pdf`
    const { filePath } = await storeFile(outputBuffer, uniqueName)

    // Get page count
    let pages = 1
    try {
      pages = await getPageCount(outputBuffer)
    } catch (e) {
      console.error('Page count error:', e)
    }

    // Create database entry
    const translatedName = file.name.replace(/\.pdf$/i, '') + `_${targetLanguage.toLowerCase()}.pdf`
    const translatedFile = await db.pdfFile.create({
      data: {
        name: translatedName,
        originalName: translatedName,
        size: outputBuffer.length,
        mimeType: 'application/pdf',
        pages,
        filePath,
        textContent: translatedText,
      },
    })

    return NextResponse.json({
      file: stripFileData(translatedFile),
      translation: {
        sourceLanguage: sourceLanguage || 'auto-detected',
        targetLanguage,
        pagesTranslated: pages,
        wordCount: extractedText.split(/\s+/).length,
        truncated,
      },
    })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Translate file error:', error)
    return NextResponse.json(
      { error: 'Failed to translate file' },
      { status: 500 }
    )
  }
}
