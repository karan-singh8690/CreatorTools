import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import {
  applySignature,
  analyzeSignaturePotential,
  verifySignatures,
  getDefaultSignatureOptions,
  type SignatureOptions,
} from '@/lib/pdf-signature'

// ─── GET: Signature Preview / Verification ───────────────────────────────────

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

    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    // Verification mode
    if (action === 'verify') {
      const verifications = await verifySignatures(Buffer.from(pdfBuffer))
      return NextResponse.json({
        verifications,
        fileInfo: {
          id: file.id,
          name: file.name,
          size: file.size,
          pages: file.pages,
        },
      })
    }

    // Preview mode
    const optionsJson = url.searchParams.get('options')
    const options: SignatureOptions = optionsJson
      ? JSON.parse(optionsJson)
      : getDefaultSignatureOptions('drawn')

    const preview = await analyzeSignaturePotential(Buffer.from(pdfBuffer), options)

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
    console.error('Signature preview error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze signature' },
      { status: 500 }
    )
  }
}

// ─── POST: Apply Signature ───────────────────────────────────────────────────

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

    // Parse request body
    const contentType = request.headers.get('content-type') || ''
    let options: SignatureOptions

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const optionsStr = formData.get('options') as string
      options = optionsStr ? JSON.parse(optionsStr) : getDefaultSignatureOptions('drawn')

      // Handle image signature upload
      const imageFile = formData.get('image') as File | null
      if (imageFile && options.type === 'image') {
        const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
        options.imageBuffer = imageBuffer
        options.imageMimeType = imageFile.type as 'image/png' | 'image/jpeg'
      }
    } else {
      const body = await request.json()
      options = body.options || getDefaultSignatureOptions('drawn')
    }

    // Apply signature
    const result = await applySignature(Buffer.from(pdfBuffer), options)

    // Save the signed file
    const outputFileName = `signed_${randomUUID()}.pdf`
    const { filePath: newFilePath } = await storeFile(result.signedBuffer, outputFileName)

    // Create a new database record for the signed file
    const signedFile = await db.pdfFile.create({
      data: {
        name: file.name.replace('.pdf', '_signed.pdf'),
        originalName: file.name.replace('.pdf', '_signed.pdf'),
        size: result.signedSize,
        mimeType: 'application/pdf',
        pages: file.pages,
        filePath: newFilePath,
        starred: false,
        textContent: null,
      },
    })

    return NextResponse.json({
      file: signedFile,
      signature: {
        signatureId: result.signatureId,
        signerId: result.signerId,
        originalSize: result.originalSize,
        signedSize: result.signedSize,
        sizeIncrease: result.sizeIncrease,
        pagesSigned: result.pagesSigned,
        totalPages: result.totalPages,
        operations: result.operations,
        auditEvents: result.auditEvents,
        durationMs: result.durationMs,
      },
    }, { status: 201 })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Signature apply error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to apply signature' },
      { status: 500 }
    )
  }
}
