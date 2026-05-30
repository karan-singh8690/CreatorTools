import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, fileName, history } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Use z-ai-web-dev-sdk for LLM chat
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    // Build conversation messages
    const systemPrompt = `You are Luna, an AI assistant for PDFelement. You help users understand and work with PDF documents. You are currently helping the user with a file named "${fileName || 'document.pdf'}". Be helpful, concise, and professional. If the user asks about the PDF content, provide relevant insights about typical document structures and content analysis capabilities. You can help with:
- Summarizing PDF content
- Answering questions about the document
- Suggesting PDF operations
- Helping with document workflows

Keep your responses concise and helpful.`

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
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
