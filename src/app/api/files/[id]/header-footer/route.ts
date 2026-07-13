import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import {
  applyHeaderFooter,
  analyzeHeaderFooterPotential,
} from '@/lib/pdf-header-footer'
import type { HeaderFooterOptions } from '@/lib/pdf-header-footer-types'
import { getDefaultHeaderFooterOptions } from '@/lib/pdf-header-footer-types'

// ─── GET: Header/Footer Preview ──────────────────────────────────────────────

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

    const pdfBuffer = await retrieveFile(file.filePath)

    // Parse options from query params
    const url = new URL(request.url)
    const optionsJson = url.searchParams.get('options')
    const options: HeaderFooterOptions = optionsJson
      ? JSON.parse(optionsJson)
      : getDefaultHeaderFooterOptions()

    // Analyze header/footer potential
    const preview = await analyzeHeaderFooterPotential(
      Buffer.from(pdfBuffer),
      options,
      file.originalName,
    )

    return NextResponse.json({
      preview,
      fileInfo: {
        id: file.id,
        name: file.name,
        size: file.size,
        pages: file.pages,
        originalName: file.originalName,
      },
    })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }
    console.error('Header/footer preview error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze header/footer' },
      { status: 500 }
    )
  }
}

// ─── POST: Apply Header/Footer ───────────────────────────────────────────────

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

    const pdfBuffer = await retrieveFile(file.filePath)

    // Parse request body (FormData for logo upload or JSON for text-only)
    const contentType = request.headers.get('content-type') || ''

    let options: HeaderFooterOptions

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const optionsStr = formData.get('options') as string
      options = optionsStr ? JSON.parse(optionsStr) : getDefaultHeaderFooterOptions()

      // Handle logo image upload for each page config
      for (const pc of options.pageConfigs) {
        for (const zone of ['header', 'footer'] as const) {
          const content = pc[zone]
          if (content?.logo && !content.logo.imageBuffer) {
            // Check for uploaded logo in formData
            const logoKey = `logo_${zone}_${pc.scope}`
            const logoFile = formData.get(logoKey) as File | null
            if (logoFile) {
              content.logo.imageBuffer = Buffer.from(await logoFile.arrayBuffer())
              content.logo.imageMimeType = logoFile.type as 'image/png' | 'image/jpeg'
            }
          }
        }
      }
    } else {
      const body = await request.json()
      options = body.options || getDefaultHeaderFooterOptions()
    }

    // Apply header/footer
    const result = await applyHeaderFooter(
      Buffer.from(pdfBuffer),
      options,
      file.originalName,
    )

    // Save the output file
    const outputFileName = `headerfooter_${randomUUID()}.pdf`
    const { filePath: newFilePath } = await storeFile(result.outputBuffer, outputFileName)

    // Create a new database record
    const outputFile = await db.pdfFile.create({
      data: {
        name: file.name.replace('.pdf', '_header_footer.pdf'),
        originalName: file.originalName.replace('.pdf', '_header_footer.pdf'),
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
      headerFooter: {
        originalSize: result.originalSize,
        outputSize: result.outputSize,
        sizeIncrease: result.sizeIncrease,
        pagesProcessed: result.pagesProcessed,
        totalPages: result.totalPages,
        operations: result.operations,
        durationMs: result.durationMs,
      },
    }, { status: 201 })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Header/footer apply error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to apply header/footer' },
      { status: 500 }
    )
  }
}
