import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'

/**
 * GET /api/files/check-duplicate?hash=<sha256>
 * 
 * Pre-upload duplicate detection using SHA256 hash.
 * Client can compute hash before uploading to avoid wasted bandwidth.
 */
export async function GET(request: NextRequest) {
  try {
    const hash = request.nextUrl.searchParams.get('hash')

    if (!hash) {
      return NextResponse.json(
        { error: 'Hash parameter required', code: 'MISSING_HASH' },
        { status: 400 }
      )
    }

    // Validate hash format (SHA256 = 64 hex chars)
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      return NextResponse.json(
        { error: 'Invalid SHA256 hash format', code: 'INVALID_HASH' },
        { status: 400 }
      )
    }

    const existingFile = await db.pdfFile.findFirst({
      where: { fileHash: hash },
    })

    if (existingFile) {
      return NextResponse.json({
        isDuplicate: true,
        existingFile: {
          id: existingFile.id,
          name: existingFile.name,
          originalName: existingFile.originalName,
          size: existingFile.size,
          pages: existingFile.pages,
          createdAt: existingFile.createdAt.toISOString(),
        },
      })
    }

    return NextResponse.json({
      isDuplicate: false,
    })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ isDuplicate: false, dbUnavailable: true }, { status: 503 })
    }
    console.error('Duplicate check error:', error)
    return NextResponse.json(
      { error: 'Failed to check for duplicates', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
