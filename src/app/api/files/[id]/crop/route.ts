import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import {
  applyCrop,
  previewCrop,
  getDefaultCropOptions,
  type CropOptions,
} from '@/lib/pdf-crop'

// ─── GET: Crop Preview ───────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const file = await db.pdfFile.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileBuffer = await retrieveFile(file.filePath)

    // Parse options from query params
    const url = new URL(request.url)
    const optionsJson = url.searchParams.get('options')
    const options: CropOptions = optionsJson
      ? JSON.parse(optionsJson)
      : getDefaultCropOptions()

    // Generate crop preview
    const preview = await previewCrop(Buffer.from(fileBuffer), options)

    return NextResponse.json({
      preview,
      fileInfo: {
        id: file.id,
        name: file.name,
        size: file.size,
        pages: file.pages,
      },
    })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }
    console.error('Crop preview error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to preview crop' },
      { status: 500 }
    )
  }
}

// ─── POST: Apply Crop ────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const file = await db.pdfFile.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileBuffer = await retrieveFile(file.filePath)

    // Parse options from request body
    const body = await request.json()
    const options: CropOptions = body.options || getDefaultCropOptions()

    // Apply crop
    const result = await applyCrop(Buffer.from(fileBuffer), options)

    // Save the output file
    const outputFileName = `cropped_${randomUUID()}.pdf`
    const { filePath: newFilePath } = await storeFile(result.outputBuffer, outputFileName)

    // Create a new database record for the cropped file
    const outputFile = await db.pdfFile.create({
      data: {
        name: file.name.replace('.pdf', '_cropped.pdf'),
        originalName: file.name.replace('.pdf', '_cropped.pdf'),
        size: result.outputSize,
        mimeType: 'application/pdf',
        pages: file.pages,
        filePath: newFilePath,
        starred: false,
        textContent: null,
      },
    })

    return NextResponse.json({
      file: outputFile,
      crop: {
        originalSize: result.originalSize,
        outputSize: result.outputSize,
        sizeIncrease: result.sizeIncrease,
        pagesCropped: result.pagesCropped,
        totalPages: result.totalPages,
        operations: result.operations,
        durationMs: result.durationMs,
      },
    }, { status: 201 })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Crop apply error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to apply crop' },
      { status: 500 }
    )
  }
}
