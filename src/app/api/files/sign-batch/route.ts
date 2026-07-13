import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import {
  applySignature,
  getDefaultSignatureOptions,
  type SignatureOptions,
} from '@/lib/pdf-signature'

// ─── POST: Batch Signature ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileIds, options: rawOptions } = body

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: 'No file IDs provided' },
        { status: 400 }
      )
    }

    const options: SignatureOptions = rawOptions || getDefaultSignatureOptions('drawn')

    const results: Array<{
      fileId: string
      fileName: string
      success: boolean
      error?: string
      pagesSigned?: number
      signatureId?: string
    }> = []

    // Process files one by one
    for (const fileId of fileIds) {
      const file = await db.pdfFile.findUnique({ where: { id: fileId } })
      if (!file) {
        results.push({
          fileId,
          fileName: 'Unknown',
          success: false,
          error: 'File not found',
        })
        continue
      }

      try {
        const pdfBuffer = await retrieveFile(file.filePath)

        // Apply signature
        const result = await applySignature(Buffer.from(pdfBuffer), options)

        // Save the signed file
        const outputFileName = `signed_${randomUUID()}.pdf`
        const { filePath: newFilePath } = await storeFile(result.signedBuffer, outputFileName)

        // Create DB record
        await db.pdfFile.create({
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

        results.push({
          fileId,
          fileName: file.name,
          success: true,
          pagesSigned: result.pagesSigned,
          signatureId: result.signatureId,
        })
      } catch (error: any) {
        results.push({
          fileId,
          fileName: file.name,
          success: false,
          error: error.message || 'Signature failed',
        })
      }
    }

    return NextResponse.json({
      results,
      summary: {
        total: fileIds.length,
        success: results.filter((r) => r.success).length,
        errors: results.filter((r) => !r.success).length,
      },
    }, { status: 201 })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Batch signature error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to apply batch signature' },
      { status: 500 }
    )
  }
}
