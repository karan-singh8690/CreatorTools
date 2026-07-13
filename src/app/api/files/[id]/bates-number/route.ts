import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import {
  applyBatesNumber,
  analyzeBatesPotential,
} from '@/lib/pdf-bates-number'
import type { BatesOptions } from '@/lib/pdf-bates-number-types'
import { getDefaultBatesOptions } from '@/lib/pdf-bates-number-types'

// ─── GET: Bates Number Preview ──────────────────────────────────────────────

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
    const options: BatesOptions = optionsJson
      ? JSON.parse(optionsJson)
      : getDefaultBatesOptions()

    // Analyze bates numbering potential
    const preview = await analyzeBatesPotential(
      Buffer.from(fileBuffer),
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
    console.error('Bates number preview error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze bates numbering' },
      { status: 500 }
    )
  }
}

// ─── POST: Apply Bates Number ───────────────────────────────────────────────

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

    // Parse request body
    const body = await request.json()
    const options: BatesOptions = body.options || getDefaultBatesOptions()
    const globalStartNumber = body.globalStartNumber as number | undefined

    // Apply bates numbering
    const result = await applyBatesNumber(
      Buffer.from(fileBuffer),
      options,
      file.originalName,
      globalStartNumber,
    )

    // Save the output file
    const outputFileName = `bates_${randomUUID()}.pdf`
    const { filePath: newFilePath } = await storeFile(result.outputBuffer!, outputFileName)

    // Create a new database record
    const outputFile = await db.pdfFile.create({
      data: {
        name: file.name.replace('.pdf', '_bates.pdf'),
        originalName: file.originalName.replace('.pdf', '_bates.pdf'),
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
      bates: {
        originalSize: result.originalSize,
        outputSize: result.outputSize,
        sizeIncrease: result.sizeIncrease,
        pagesProcessed: result.pagesProcessed,
        totalPages: result.totalPages,
        batesRange: result.batesRange,
        firstBatesNumber: result.firstBatesNumber,
        lastBatesNumber: result.lastBatesNumber,
        conflicts: result.conflicts,
        auditEntries: result.auditEntries,
        operations: result.operations,
        durationMs: result.durationMs,
      },
    }, { status: 201 })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Bates number apply error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to apply bates numbering' },
      { status: 500 }
    )
  }
}
