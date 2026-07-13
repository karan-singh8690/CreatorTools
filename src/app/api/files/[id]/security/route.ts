import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import {
  applySecurity,
  analyzeSecurityPotential,
  verifyPdfSecurity,
  removeSecurity,
  addAuditEntry,
  getDefaultSecurityOptions,
  type SecurityOptions,
} from '@/lib/pdf-security'

// ─── GET: Security Preview / Verify ─────────────────────────────────────────

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

    if (action === 'verify') {
      // Verify existing security
      const password = url.searchParams.get('password') || undefined
      const verifyResult = await verifyPdfSecurity(Buffer.from(pdfBuffer), password)
      return NextResponse.json({
        verify: verifyResult,
        fileInfo: { id: file.id, name: file.name, size: file.size, pages: file.pages },
      })
    }

    // Default: Preview security changes
    const optionsJson = url.searchParams.get('options')
    const options: SecurityOptions = optionsJson
      ? JSON.parse(optionsJson)
      : getDefaultSecurityOptions()

    const preview = await analyzeSecurityPotential(Buffer.from(pdfBuffer), options)

    return NextResponse.json({
      preview,
      fileInfo: { id: file.id, name: file.name, size: file.size, pages: file.pages },
    })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }
    console.error('Security preview error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze security' },
      { status: 500 }
    )
  }
}

// ─── POST: Apply Security / Remove Security ─────────────────────────────────

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
    const body = await request.json()
    const action = body.action || 'protect'

    if (action === 'unprotect') {
      // Remove security
      const { ownerPassword } = body
      if (!ownerPassword) {
        return NextResponse.json({ error: 'Owner password is required to remove security' }, { status: 400 })
      }

      const result = await removeSecurity(Buffer.from(pdfBuffer), ownerPassword)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 403 })
      }

      // Save decrypted file
      const outputFileName = `decrypted_${randomUUID()}.pdf`
      const { filePath: newFilePath } = await storeFile(result.buffer, outputFileName)

      const decryptedFile = await db.pdfFile.create({
        data: {
          name: file.name.replace('.pdf', '_decrypted.pdf'),
          originalName: file.name.replace('.pdf', '_decrypted.pdf'),
          size: result.buffer.length,
          mimeType: 'application/pdf',
          pages: file.pages,
          filePath: newFilePath,
          starred: false,
          textContent: null,
        },
      })

      addAuditEntry(file.id, file.name, 'unprotect', 'none', [], 'Security removed from document')

      return NextResponse.json({
        file: decryptedFile,
        action: 'unprotected',
      }, { status: 201 })
    }

    // Default: Apply security
    const options: SecurityOptions = body.options || getDefaultSecurityOptions()

    const result = await applySecurity(Buffer.from(pdfBuffer), options)

    // Save the protected file
    const outputFileName = `protected_${randomUUID()}.pdf`
    const { filePath: newFilePath } = await storeFile(result.protectedBuffer, outputFileName)

    const protectedFile = await db.pdfFile.create({
      data: {
        name: file.name.replace('.pdf', '_protected.pdf'),
        originalName: file.name.replace('.pdf', '_protected.pdf'),
        size: result.protectedSize,
        mimeType: 'application/pdf',
        pages: file.pages,
        filePath: newFilePath,
        starred: false,
        textContent: null,
      },
    })

    // Audit log
    const permissions = result.operations.map((op) => op.description)
    addAuditEntry(
      file.id,
      file.name,
      'protect',
      result.securityLevel,
      permissions,
      `Security applied: ${result.securityLevel} level`
    )

    return NextResponse.json({
      file: protectedFile,
      security: {
        originalSize: result.originalSize,
        protectedSize: result.protectedSize,
        sizeIncrease: result.sizeIncrease,
        operations: result.operations,
        durationMs: result.durationMs,
        securityLevel: result.securityLevel,
        ownerPassword: options.ownerPassword ? undefined : 'Auto-generated (see download)',
      },
    }, { status: 201 })
  } catch (error: any) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Security apply error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to apply security' },
      { status: 500 }
    )
  }
}
