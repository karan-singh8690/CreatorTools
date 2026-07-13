import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import {
  applyWatermark,
  analyzeWatermarkPotential,
  getDefaultWatermarkOptions,
  type WatermarkOptions,
} from '@/lib/pdf-watermark'

// ─── GET: Watermark Preview ──────────────────────────────────────────────────

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
    const options: WatermarkOptions = optionsJson
      ? JSON.parse(optionsJson)
      : getDefaultWatermarkOptions('text')

    // Analyze watermark potential
    const preview = await analyzeWatermarkPotential(Buffer.from(fileBuffer), options)

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
    console.error('Watermark preview error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze watermark' },
      { status: 500 }
    )
  }
}

// ─── POST: Apply Watermark ───────────────────────────────────────────────────

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

    // Parse request body (FormData for image upload or JSON for text)
    const contentType = request.headers.get('content-type') || ''

    let options: WatermarkOptions

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const optionsStr = formData.get('options') as string
      options = optionsStr ? JSON.parse(optionsStr) : getDefaultWatermarkOptions('text')

      // Handle image/logo upload
      const imageFile = formData.get('image') as File | null
      if (imageFile && (options.type === 'image' || options.type === 'logo')) {
        const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
        options.imageBuffer = imageBuffer
        options.imageMimeType = imageFile.type as 'image/png' | 'image/jpeg'

        // Get image dimensions using sharp
        const sharp = (await import('sharp')).default
        const metadata = await sharp(imageBuffer).metadata()
        options.imageWidth = metadata.width
        options.imageHeight = metadata.height
      }
    } else {
      const body = await request.json()
      options = body.options || getDefaultWatermarkOptions('text')
    }

    // Apply watermark
    const result = await applyWatermark(Buffer.from(fileBuffer), options)

    // Save the watermarked file
    const outputFileName = `watermarked_${randomUUID()}.pdf`
    const { filePath: newFilePath } = await storeFile(result.watermarkedBuffer, outputFileName)

    // Create a new database record for the watermarked file
    const watermarkedFile = await db.pdfFile.create({
      data: {
        name: file.name.replace('.pdf', '_watermarked.pdf'),
        originalName: file.name.replace('.pdf', '_watermarked.pdf'),
        size: result.watermarkedSize,
        mimeType: 'application/pdf',
        pages: file.pages,
        filePath: newFilePath,
        starred: false,
        textContent: null,
      },
    })

    return NextResponse.json({
      file: watermarkedFile,
      watermark: {
        originalSize: result.originalSize,
        watermarkedSize: result.watermarkedSize,
        sizeIncrease: result.sizeIncrease,
        pagesWatermarked: result.pagesWatermarked,
        totalPages: result.totalPages,
        operations: result.operations,
        durationMs: result.durationMs,
      },
    }, { status: 201 })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Watermark apply error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to apply watermark' },
      { status: 500 }
    )
  }
}
