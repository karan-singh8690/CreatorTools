import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'

import { extractTextFromPdf } from '@/lib/pdf-utils'
import { storeFile, retrieveFile, stripFileData } from '@/lib/file-storage'
import { randomUUID } from 'crypto'

type ConvertFormat = 'txt' | 'html' | 'md' | 'csv' | 'docx-approx' | 'xlsx-approx'

const SUPPORTED_FORMATS: ConvertFormat[] = ['txt', 'html', 'md', 'csv', 'docx-approx', 'xlsx-approx']

const MAX_TEXT_LENGTH = 15000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const format = (body.format as ConvertFormat) ?? 'txt'

    if (!SUPPORTED_FORMATS.includes(format)) {
      return NextResponse.json(
        { error: `Unsupported format: ${format}. Supported: ${SUPPORTED_FORMATS.join(', ')}` },
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

    // Read and extract text from PDF - use cached text if available
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

    let outputContent: string
    let mimeType: string
    let extension: string
    let estimatedAccuracy: string

    switch (format) {
      case 'txt': {
        outputContent = extractedText
        mimeType = 'text/plain'
        extension = 'txt'
        estimatedAccuracy = 'High'
        break
      }
      case 'html': {
        outputContent = convertToHtml(extractedText, file.name)
        mimeType = 'text/html'
        extension = 'html'
        estimatedAccuracy = 'High'
        break
      }
      case 'md': {
        outputContent = convertToMarkdown(extractedText)
        mimeType = 'text/markdown'
        extension = 'md'
        estimatedAccuracy = 'High'
        break
      }
      case 'csv': {
        outputContent = convertToCsv(extractedText)
        mimeType = 'text/csv'
        extension = 'csv'
        estimatedAccuracy = 'Best effort'
        break
      }
      case 'docx-approx': {
        const llmResult = await convertWithLLM(extractedText, 'docx')
        outputContent = llmResult
        mimeType = 'text/plain'
        extension = 'txt'
        estimatedAccuracy = 'AI-powered (approximate)'
        break
      }
      case 'xlsx-approx': {
        const llmResult = await convertWithLLM(extractedText, 'xlsx')
        outputContent = llmResult
        mimeType = 'text/csv'
        extension = 'csv'
        estimatedAccuracy = 'AI-powered (approximate)'
        break
      }
      default: {
        outputContent = extractedText
        mimeType = 'text/plain'
        extension = 'txt'
        estimatedAccuracy = 'High'
      }
    }

    // Save the result file
    const uniqueName = `${randomUUID()}.${extension}`
    const resultBuffer = Buffer.from(outputContent, 'utf-8')
    const { filePath } = await storeFile(resultBuffer, uniqueName)

    // Count pages
    const pageMatches = extractedText.match(/--- Page \d+ ---/g)
    const pages = pageMatches ? pageMatches.length : file.pages

    const outputName = file.name.replace(/\.pdf$/i, '') + `_converted.${extension}`
    const resultFile = await db.pdfFile.create({
      data: {
        name: outputName,
        originalName: outputName,
        size: Buffer.byteLength(outputContent, 'utf-8'),
        mimeType,
        pages,
        filePath,
        textContent: outputContent,
      },
    })

    return NextResponse.json({
      file: stripFileData(resultFile),
      conversion: {
        format,
        pages,
        estimatedAccuracy,
      },
    })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Convert file error:', error)
    return NextResponse.json(
      { error: 'Failed to convert file' },
      { status: 500 }
    )
  }
}

function convertToHtml(text: string, fileName: string): string {
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const pages = escapedText.split(/--- Page \d+ ---/).filter((p) => p.trim().length > 0)
  const pageSections = pages
    .map((pageContent, i) => {
      const lines = pageContent.trim().split('\n')
      const contentLines = lines
        .map((line) => {
          const trimmed = line.trim()
          if (!trimmed) return '<br/>'
          return `<p>${trimmed}</p>`
        })
        .join('\n')
      return `    <section class="page" id="page-${i + 1}">
      <h2>Page ${i + 1}</h2>
${contentLines}
    </section>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName} - Converted from PDF</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #333; background: #fff; }
    h1 { color: #2b2b2b; border-bottom: 2px solid #4A90D9; padding-bottom: 10px; }
    h2 { color: #4A90D9; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 30px; padding-bottom: 5px; border-bottom: 1px solid #eee; }
    .page { margin-bottom: 30px; padding: 20px; border: 1px solid #eee; border-radius: 4px; }
    p { margin: 4px 0; }
    .meta { color: #999; font-size: 12px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>${fileName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
  <div class="meta">Converted from PDF • ${pages.length} page${pages.length !== 1 ? 's' : ''}</div>
${pageSections}
</body>
</html>`
}

function convertToMarkdown(text: string): string {
  const pages = text.split(/--- Page (\d+) ---/).filter((p) => p.trim().length > 0)

  const parts: string[] = []
  for (let i = 0; i < pages.length; i++) {
    const segment = pages[i].trim()
    if (/^\d+$/.test(segment)) {
      parts.push(`\n## Page ${segment}\n`)
    } else {
      parts.push(segment)
    }
  }

  if (parts.length === 0) {
    return text
  }

  return `# Converted PDF Document\n${parts.join('')}`
}

function convertToCsv(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)

  const rows: string[][] = []
  let detectedHeader = false

  for (const line of lines) {
    if (line.match(/^--- Page \d+ ---$/)) continue

    if (line.includes('\t')) {
      const cells = line.split('\t').map((c) => c.trim())
      rows.push(cells)
      detectedHeader = true
      continue
    }

    if (line.includes('|') && line.split('|').length >= 3) {
      const cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0)
      rows.push(cells)
      detectedHeader = true
      continue
    }

    if (line.match(/\S+\s{3,}\S+/)) {
      const cells = line.split(/\s{3,}/).map((c) => c.trim()).filter((c) => c.length > 0)
      rows.push(cells)
      detectedHeader = true
      continue
    }

    rows.push([line])
  }

  const maxCols = Math.max(...rows.map((r) => r.length), 1)
  const normalizedRows = rows.map((r) => {
    while (r.length < maxCols) r.push('')
    return r
  })

  if (!detectedHeader) {
    const headers = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`)
    normalizedRows.unshift(headers)
  }

  return normalizedRows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
}

async function convertWithLLM(text: string, targetFormat: 'docx' | 'xlsx'): Promise<string> {
  let inputText = text
  let truncated = false
  if (inputText.length > MAX_TEXT_LENGTH) {
    inputText = inputText.substring(0, MAX_TEXT_LENGTH)
    truncated = true
  }

  const { getZai } = await import('@/lib/zai')
  const zai = await getZai()

  const formatInstruction = targetFormat === 'docx'
    ? `Restructure the following PDF text content into a well-formatted document structure. Use markdown-like headings (# for main title, ## for sections, ### for subsections), proper paragraph breaks, and organize the content logically as it would appear in a Word document. Preserve all important content. Output the restructured text only.`
    : `Extract all tabular and structured data from the following PDF text content and format it as CSV. If there are no tables, create a logical tabular structure from the content (e.g., key-value pairs as two columns, list items with their attributes). Include appropriate headers. Output CSV only.`

  const messages = [
    {
      role: 'assistant' as const,
      content: targetFormat === 'docx'
        ? 'You are a document restructuring specialist. Convert PDF text into well-organized document format with proper headings, sections, and paragraphs. Output restructured text only.'
        : 'You are a data extraction specialist. Convert PDF text into structured CSV format with appropriate headers and rows. Output CSV only.',
    },
    {
      role: 'user' as const,
      content: `${formatInstruction}\n\n${inputText}${truncated ? '\n\n[Note: Text was truncated due to length. Only the first portion is included.]' : ''}`,
    },
  ]

  const response = await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' },
  })

  return response.choices?.[0]?.message?.content || text
}
