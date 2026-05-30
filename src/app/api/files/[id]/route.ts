import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { unlink } from 'fs/promises'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const file = await db.pdfFile.findUnique({
      where: { id },
    })

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ file })
  } catch (error) {
    console.error('Get file error:', error)
    return NextResponse.json(
      { error: 'Failed to get file' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Verify file exists
    const existing = await db.pdfFile.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: { name?: string; starred?: boolean } = {}

    if (typeof body.starred === 'boolean') {
      updateData.starred = body.starred
    }

    if (typeof body.name === 'string' && body.name.trim()) {
      updateData.name = body.name.trim()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const file = await db.pdfFile.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ file })
  } catch (error) {
    console.error('Update file error:', error)
    return NextResponse.json(
      { error: 'Failed to update file' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const file = await db.pdfFile.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Delete physical file
    try {
      await unlink(file.filePath)
    } catch (e) {
      console.error('Failed to delete physical file:', e)
      // Continue even if physical file deletion fails
    }

    // Delete from database
    await db.pdfFile.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete file error:', error)
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}
