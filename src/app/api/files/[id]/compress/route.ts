import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { compressPdf, getPageCount, extractTextFromPdf } from '@/lib/pdf-utils'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOADS_DIR = '/home/z/my-project/uploads'

export async function POST(
  _request: NextRequest,
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

    // Read the original file
    const fileBuffer = await readFile(file.filePath)

    // Compress the PDF
    const compressedBuffer = await compressPdf(fileBuffer)

    // Ensure uploads directory exists
    await mkdir(UPLOADS_DIR, { recursive: true })

    // Save compressed file
    const uniqueName = `${randomUUID()}.pdf`
    const filePath = path.join(UPLOADS_DIR, uniqueName)
    await writeFile(filePath, compressedBuffer)

    // Get page count
    let pages = 1
    try {
      pages = await getPageCount(compressedBuffer)
    } catch (e) {
      console.error('Page count error:', e)
    }

    // Extract text content
    let textContent: string | null = null
    try {
      textContent = await extractTextFromPdf(compressedBuffer)
      if (textContent && textContent.trim().length === 0) {
        textContent = null
      }
    } catch (e) {
      console.error('Text extraction error:', e)
    }

    // Create new database entry for compressed file
    const compressedName = file.name.replace(/\.pdf$/i, '') + '_compressed.pdf'
    const compressedFile = await db.pdfFile.create({
      data: {
        name: compressedName,
        originalName: compressedName,
        size: compressedBuffer.length,
        mimeType: 'application/pdf',
        pages,
        filePath,
        textContent,
      },
    })

    const savedBytes = file.size - compressedBuffer.length
    const savedPercent = ((savedBytes / file.size) * 100).toFixed(1)

    return NextResponse.json({
      file: compressedFile,
      compression: {
        originalSize: file.size,
        compressedSize: compressedBuffer.length,
        savedBytes,
        savedPercent: `${savedPercent}%`,
      },
    })
  } catch (error) {
    console.error('Compress file error:', error)
    return NextResponse.json(
      { error: 'Failed to compress file' },
      { status: 500 }
    )
  }
}
