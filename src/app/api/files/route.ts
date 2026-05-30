import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOADS_DIR = '/home/z/my-project/uploads'

export async function GET(request: NextRequest) {
  try {
    const searchQuery = request.nextUrl.searchParams.get('search') || ''

    const files = await db.pdfFile.findMany({
      where: searchQuery
        ? {
            OR: [
              { name: { contains: searchQuery } },
              { originalName: { contains: searchQuery } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ files })
  } catch (error) {
    console.error('List files error:', error)
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Ensure uploads directory exists
    await mkdir(UPLOADS_DIR, { recursive: true })

    // Generate unique filename
    const uniqueName = `${randomUUID()}.pdf`
    const filePath = path.join(UPLOADS_DIR, uniqueName)

    // Write file to disk
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, fileBuffer)

    // Simple page count - count /Type /Page entries
    let pages = 1
    try {
      const text = fileBuffer.toString('utf-8', 0, Math.min(fileBuffer.length, 100000))
      const pageMatches = text.match(/\/Type\s*\/Page(?!s)/g)
      if (pageMatches && pageMatches.length > 0) {
        pages = pageMatches.length
      }
    } catch {
      // ignore
    }

    // Save to database - text content will be extracted on demand
    const pdfFile = await db.pdfFile.create({
      data: {
        name: file.name,
        originalName: file.name,
        size: fileBuffer.length,
        mimeType: file.type || 'application/pdf',
        pages,
        filePath,
        textContent: null,
      },
    })

    return NextResponse.json({ file: pdfFile }, { status: 201 })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
