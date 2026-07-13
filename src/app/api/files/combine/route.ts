import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { storeFile, retrieveFile } from '@/lib/file-storage'
import { mergePdfs, getPageCount, extractTextFromPdf } from '@/lib/pdf-utils'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileIds } = body as { fileIds: string[] }

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 file IDs are required to combine' },
        { status: 400 }
      )
    }

    // Fetch all files from database
    const files = await db.pdfFile.findMany({
      where: { id: { in: fileIds } },
    })

    if (files.length !== fileIds.length) {
      const foundIds = files.map((f) => f.id)
      const missingIds = fileIds.filter((id) => !foundIds.includes(id))
      return NextResponse.json(
        { error: `Files not found: ${missingIds.join(', ')}` },
        { status: 404 }
      )
    }

    // Sort files by the order of fileIds
    const sortedFiles = fileIds
      .map((id) => files.find((f) => f.id === id))
      .filter(Boolean) as typeof files

    // Read all PDF buffers
    const pdfBuffers: Buffer[] = []
    for (const file of sortedFiles) {
      try {
        const buffer = await retrieveFile(file.filePath)
        pdfBuffers.push(buffer)
      } catch {
        return NextResponse.json(
          { error: `Failed to read file: ${file.name}` },
          { status: 500 }
        )
      }
    }

    // Merge the PDFs
    const mergedBuffer = await mergePdfs(pdfBuffers)

    // Save merged file
    const uniqueName = `${randomUUID()}.pdf`
    const { filePath } = await storeFile(mergedBuffer, uniqueName)

    // Get page count
    let pages = 1
    try {
      pages = await getPageCount(mergedBuffer)
    } catch (e) {
      console.error('Page count error:', e)
    }

    // Extract text content
    let textContent: string | null = null
    try {
      textContent = await extractTextFromPdf(mergedBuffer)
      if (textContent && textContent.trim().length === 0) {
        textContent = null
      }
    } catch (e) {
      console.error('Text extraction error:', e)
    }

    // Create combined file name
    const combinedName = sortedFiles.map((f) => f.name.replace(/\.pdf$/i, '')).join('_') + '_combined.pdf'

    // Create new database entry
    const combinedFile = await db.pdfFile.create({
      data: {
        name: combinedName,
        originalName: combinedName,
        size: mergedBuffer.length,
        mimeType: 'application/pdf',
        pages,
        filePath,
        textContent,
      },
    })

    return NextResponse.json(
      {
        file: combinedFile,
        sourceFiles: sortedFiles.map((f) => ({
          id: f.id,
          name: f.name,
          pages: f.pages,
        })),
      },
      { status: 201 }
    )
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({ error: 'Database not available', code: 'DB_UNAVAILABLE' }, { status: 503 })
    }
    console.error('Combine files error:', error)
    return NextResponse.json(
      { error: 'Failed to combine files' },
      { status: 500 }
    )
  }
}
