import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { retrieveFile } from '@/lib/file-storage'
import { extractTextFromPdf } from '@/lib/pdf-utils'

const MAX_TEXT_LENGTH = 10000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { format = 'json', query } = body as { format?: 'json' | 'csv' | 'text'; query?: string }

    if (!['json', 'csv', 'text'].includes(format)) {
      return NextResponse.json(
        { error: `Unsupported format: ${format}. Supported: json, csv, text` },
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
    let truncated = false
    if (extractedText.length > MAX_TEXT_LENGTH) {
      extractedText = extractedText.substring(0, MAX_TEXT_LENGTH)
      truncated = true
    }

    // Try to use z-ai-web-dev-sdk for data extraction
    try {
      const { getZai } = await import('@/lib/zai')
      const zai = await getZai()

      const formatInstructions: Record<string, string> = {
        json: 'Return the extracted data as a valid JSON object or array. Use appropriate key names based on the document content.',
        csv: 'Return the extracted data in CSV format with headers on the first line. Use comma as the delimiter.',
        text: 'Return the extracted data as plain, well-structured text with clear labels and formatting.',
      }

      const queryPart = query
        ? `Focus on extracting: ${query}.`
        : 'Extract all relevant structured data from the document.'

      const prompt = `Extract structured data from the following document. Return as ${format}. ${queryPart}

${formatInstructions[format]}

Document content:
${extractedText}

${truncated ? '[Note: The document was truncated due to length. Only the first portion is included.]' : ''}

Only return the extracted data in the requested format. Do not include any explanations or additional commentary.`

      const messages = [
        {
          role: 'assistant' as const,
          content: `You are a data extraction specialist. Extract structured data from documents accurately. Always return data in the exact format requested (JSON, CSV, or text). Do not include any explanations, just the data.`,
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

      const extractedData = response.choices?.[0]?.message?.content || 'No data could be extracted from the document.'

      return NextResponse.json({
        data: extractedData,
        format,
        pageCount: file.pages,
        truncated,
        query: query || null,
      })
    } catch (aiError) {
      console.error('Extract data AI error:', aiError)
      return NextResponse.json(
        { error: 'Data extraction service is currently unavailable. The AI extraction feature requires a connection to the language model service which may not be accessible in this environment.', partnerToolId: 'extract-data' },
        { status: 503 }
      )
    }
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Extract data error:', error)
    return NextResponse.json(
      { error: 'Failed to extract data from file' },
      { status: 500 }
    )
  }
}
