import { NextRequest, NextResponse } from 'next/server'
import { getAuditLog } from '@/lib/pdf-security'

/**
 * GET: Retrieve audit log entries
 * Query params: fileId (optional filter)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const fileId = url.searchParams.get('fileId') || undefined
    const limit = parseInt(url.searchParams.get('limit') || '50')

    const entries = getAuditLog(fileId)
    const limitedEntries = entries.slice(-limit)

    return NextResponse.json({
      entries: limitedEntries,
      total: entries.length,
    })
  } catch (error: any) {
    console.error('Audit log error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve audit log' },
      { status: 500 }
    )
  }
}
