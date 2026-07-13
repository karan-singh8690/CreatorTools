import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { retrieveFile } from '@/lib/file-storage'
import { extractTextFromPdf } from '@/lib/pdf-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, fileName, fileId, history } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Fetch PDF text content if fileId is provided
    let pdfTextContent: string | null = null
    let pdfFileName = fileName || 'document.pdf'
    let pdfPageCount = 0

    if (fileId) {
      const pdfFile = await db.pdfFile.findUnique({
        where: { id: fileId },
      })
      if (pdfFile) {
        pdfFileName = pdfFile.name
        pdfPageCount = pdfFile.pages
        pdfTextContent = pdfFile.textContent

        // If no text content cached or it's a placeholder, extract using pdfjs-dist
        if (!pdfTextContent || pdfTextContent.startsWith('[PDF')) {
          try {
            const buffer = await retrieveFile(pdfFile.filePath)
            const extracted = await extractTextFromPdf(buffer)
            if (extracted && extracted.trim().length > 0 && !extracted.startsWith('[PDF')) {
              pdfTextContent = extracted
              // Cache the extracted text
              await db.pdfFile.update({
                where: { id: fileId },
                data: { textContent: extracted },
              })
            }
          } catch (e) {
            console.error('Chat text extraction error:', e)
          }
        }
      }
    }

    // Use z-ai-web-dev-sdk for LLM chat
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    // Build the system prompt with PDF context
    let systemPrompt = `You are Luna, an AI assistant for CreatorTools. You help users understand and work with PDF documents. You are currently helping the user with a file named "${pdfFileName}"${pdfPageCount > 0 ? ` (${pdfPageCount} pages)` : ''}.

Be helpful, concise, and professional. You can help with:
- Summarizing PDF content
- Answering questions about the document
- Suggesting PDF operations
- Helping with document workflows

Keep your responses concise and helpful.`

    // If we have PDF text content, include it in the context
    if (pdfTextContent && pdfTextContent.trim().length > 0 && !pdfTextContent.startsWith('[PDF')) {
      const maxTextLength = 50000
      const truncatedText = pdfTextContent.length > maxTextLength
        ? pdfTextContent.substring(0, maxTextLength) + '\n\n[... Content truncated due to length ...]'
        : pdfTextContent

      systemPrompt += `\n\nHere is the text content extracted from the PDF file "${pdfFileName}":\n\n${truncatedText}\n\nUse this content to answer the user's questions about the document.`
    } else if (fileId) {
      systemPrompt += `\n\nNote: No text content could be automatically extracted from this PDF. It may be a scanned document or contain only images. Let the user know that text extraction was not possible and suggest using OCR.`
    }

    // Build conversation messages
    const messages = [
      {
        role: 'assistant' as const,
        content: systemPrompt,
      },
      ...(history || []).map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ]

    const response = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    })

    const assistantMessage = response.choices?.[0]?.message?.content || 'I apologize, but I was unable to process your request. Please try again.'

    return NextResponse.json({ message: assistantMessage })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
