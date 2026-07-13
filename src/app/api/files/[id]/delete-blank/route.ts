import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'

import { PDFDocument } from 'pdf-lib'
import { storeFile, retrieveFile, stripFileData } from '@/lib/file-storage'
import { randomUUID } from 'crypto'
import { isPageBlank } from '@/lib/pdf-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const threshold = (body.threshold as number) ?? 0.1

    const file = await db.pdfFile.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    const fileBuffer = await retrieveFile(file.filePath)
    const srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true })
    const originalPages = srcDoc.getPageCount()

    if (originalPages === 0) {
      return NextResponse.json(
        { error: 'PDF has no pages' },
        { status: 400 }
      )
    }

    // Identify blank pages using pdf-lib (Node.js compatible, no browser APIs needed)
    const blankPageIndices: number[] = []
    for (let i = 0; i < originalPages; i++) {
      const blank = await isPageBlank(fileBuffer, i, threshold)
      if (blank) {
        blankPageIndices.push(i)
      }
    }

    // If no blank pages found, just return the original file info
    if (blankPageIndices.length === 0) {
      return NextResponse.json({
        file: stripFileData(file),
        deleted: {
          pagesRemoved: 0,
          originalPages,
          newPages: originalPages,
        },
      })
    }

    // Create new PDF without blank pages using pdf-lib
    const newDoc = await PDFDocument.create()
    const pagesToKeep = []
    for (let i = 0; i < originalPages; i++) {
      if (!blankPageIndices.includes(i)) {
        pagesToKeep.push(i)
      }
    }

    if (pagesToKeep.length === 0) {
      // If all pages are blank, keep at least the first page
      pagesToKeep.push(0)
    }

    const copiedPages = await newDoc.copyPages(srcDoc, pagesToKeep)
    copiedPages.forEach((page) => newDoc.addPage(page))

    const resultBuffer = Buffer.from(await newDoc.save())
    const newPages = pagesToKeep.length

    const uniqueName = `${randomUUID()}.pdf`
    const { filePath } = await storeFile(resultBuffer, uniqueName)

    const outputName = file.name.replace(/\.pdf$/i, '') + '_no-blanks.pdf'
    const resultFile = await db.pdfFile.create({
      data: {
        name: outputName,
        originalName: outputName,
        size: resultBuffer.length,
        mimeType: 'application/pdf',
        pages: newPages,
        filePath,
        textContent: null,
      },
    })

    const pagesRemoved = originalPages - newPages

    return NextResponse.json({
      file: stripFileData(resultFile),
      deleted: {
        pagesRemoved,
        originalPages,
        newPages,
      },
    })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Delete blank pages error:', error)
    return NextResponse.json(
      { error: 'Failed to delete blank pages' },
      { status: 500 }
    )
  }
}
