import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import {
  applyBackground,
  analyzeBackgroundPotential,
  getDefaultBackgroundOptions,
  type BackgroundOptions,
} from '@/lib/pdf-background'

// ─── GET: Background Preview ─────────────────────────────────────────────────

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
    const options: BackgroundOptions = optionsJson
      ? JSON.parse(optionsJson)
      : getDefaultBackgroundOptions('solid')

    // Analyze background potential
    const preview = await analyzeBackgroundPotential(Buffer.from(fileBuffer), options)

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
    console.error('Background preview error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze background' },
      { status: 500 }
    )
  }
}

// ─── POST: Apply Background ──────────────────────────────────────────────────

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

    // Parse request body (FormData for image upload or JSON)
    const contentType = request.headers.get('content-type') || ''

    let options: BackgroundOptions

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const optionsStr = formData.get('options') as string
      options = optionsStr ? JSON.parse(optionsStr) : getDefaultBackgroundOptions('solid')

      // Handle image upload
      const imageFile = formData.get('image') as File | null
      if (imageFile && options.type === 'image') {
        const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
        options.imageBuffer = imageBuffer
        options.imageMimeType = imageFile.type as 'image/png' | 'image/jpeg'
      }
    } else {
      const body = await request.json()
      options = body.options || getDefaultBackgroundOptions('solid')
    }

    // Apply background
    const result = await applyBackground(Buffer.from(fileBuffer), options)

    // Save the output file
    const outputFileName = `background_${randomUUID()}.pdf`
    const { filePath: newFilePath } = await storeFile(result.outputBuffer, outputFileName)

    // Create a new database record for the background-applied file
    const outputFile = await db.pdfFile.create({
      data: {
        name: file.name.replace('.pdf', '_bg.pdf'),
        originalName: file.name.replace('.pdf', '_bg.pdf'),
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
      background: {
        originalSize: result.originalSize,
        outputSize: result.outputSize,
        sizeIncrease: result.sizeIncrease,
        pagesModified: result.pagesModified,
        totalPages: result.totalPages,
        contrastAnalysis: result.contrastAnalysis,
        operations: result.operations,
        durationMs: result.durationMs,
      },
    }, { status: 201 })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Background apply error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to apply background' },
      { status: 500 }
    )
  }
}
