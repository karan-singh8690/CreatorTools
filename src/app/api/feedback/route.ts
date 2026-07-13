import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

// ─── Config ──────────────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FEEDBACK_EMAIL_TO = process.env.FEEDBACK_EMAIL_TO || 'feedback@creatortools.dev'
const FEEDBACK_EMAIL_FROM = process.env.FEEDBACK_EMAIL_FROM || 'onboarding@resend.dev'

// ─── POST /api/feedback ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, email } = body

    // Validate required field
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 422 }
      )
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message is too long (max 5000 characters)' },
        { status: 422 }
      )
    }

    // Validate optional email
    if (email && typeof email === 'string' && email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 422 }
        )
      }
    }

    // If no Resend API key, log feedback and return success (dev mode)
    if (!RESEND_API_KEY) {
      console.log('📧 [Feedback] (No RESEND_API_KEY — logging to console)')
      console.log('  Message:', message.trim())
      console.log('  Email:', email?.trim() || '(not provided)')
      console.log('  Time:', new Date().toISOString())
      return NextResponse.json({ success: true, mode: 'dev-log' })
    }

    // Send email via Resend
    const resend = new Resend(RESEND_API_KEY)

    const senderEmail = email?.trim() || FEEDBACK_EMAIL_FROM

    const { data, error } = await resend.emails.send({
      from: `CreatorTools Feedback <${FEEDBACK_EMAIL_FROM}>`,
      to: [FEEDBACK_EMAIL_TO],
      replyTo: senderEmail,
      subject: `New Feedback${email ? ` from ${email.trim()}` : ''}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #fafafa; border-radius: 12px;">
          <div style="background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
            <h2 style="margin: 0 0 4px; font-size: 18px; color: #111827;">New Feedback Received</h2>
            <p style="margin: 0 0 20px; font-size: 13px; color: #9ca3af;">${new Date().toISOString()}</p>

            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 16px; border: 1px solid #f3f4f6;">
              <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message.trim())}</p>
            </div>

            ${email ? `
            <div style="padding: 12px 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #dbeafe;">
              <p style="margin: 0; font-size: 13px; color: #1d4ed8;">
                <strong>Reply to:</strong> ${escapeHtml(email.trim())}
              </p>
            </div>` : `
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">No email provided — user submitted anonymously.</p>`}
          </div>

          <p style="text-align: center; font-size: 11px; color: #9ca3af; margin-top: 16px;">
            Sent from CreatorTools Feedback System
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json(
        { error: 'Failed to send feedback email' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (err) {
    console.error('Feedback API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
