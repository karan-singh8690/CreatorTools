import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile, stat } from 'fs/promises'
import { createReadStream } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const file = await db.pdfFile.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Check if physical file exists
    try {
      await stat(file.filePath)
    } catch {
      return NextResponse.json(
        { error: 'Physical file not found' },
        { status: 404 }
      )
    }

    // Check if this is a download request (attachment) vs inline viewing
    const downloadParam = request.nextUrl.searchParams.get('download')
    const disposition = downloadParam === '1'
      ? `attachment; filename="${encodeURIComponent(file.originalName)}"`
      : `inline; filename="${encodeURIComponent(file.originalName)}"`

    // Read and stream the file
    const fileBuffer = await readFile(file.filePath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Download file error:', error)
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    )
  }
}
