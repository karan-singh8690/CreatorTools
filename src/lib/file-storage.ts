import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import { put, del, head } from '@vercel/blob'
import { isVercel, UPLOADS_DIR, BLOB_PATHS } from '@/lib/upload-config'

/**
 * Check if a URL is a Vercel Blob URL.
 */
export function isBlobUrl(url: string): boolean {
  return url.startsWith('https://') && url.includes('.blob.vercel-storage.com')
}

/**
 * Generate a unique filename to avoid collisions.
 */
function uniqueName(fileName: string): string {
  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `${base}-${timestamp}-${random}${ext}`
}

/**
 * Store a file buffer.
 * - In production (Vercel): uploads to Vercel Blob, returns the blob URL.
 * - In development: writes to local filesystem, returns the local path.
 */
export async function storeFile(
  buffer: Buffer,
  fileName: string
): Promise<{ filePath: string }> {
  if (isVercel) {
    // Upload to Vercel Blob
    const safeName = uniqueName(fileName)
    const blob = await put(`${BLOB_PATHS.pdfs}/${safeName}`, buffer, {
      access: 'public',
      contentType: 'application/pdf',
    })
    return {
      filePath: blob.url,
    }
  }

  // Local filesystem storage
  await mkdir(UPLOADS_DIR, { recursive: true })
  const filePath = path.join(UPLOADS_DIR, fileName)
  await writeFile(filePath, buffer)
  return {
    filePath,
  }
}

/**
 * Retrieve a file buffer.
 * - If the path is a blob URL: fetches the URL.
 * - If the path is a local path: reads from filesystem.
 */
export async function retrieveFile(filePath: string): Promise<Buffer> {
  // Fetch from blob URL
  if (isBlobUrl(filePath)) {
    const response = await fetch(filePath)
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.status} ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  // Read from local filesystem
  try {
    return await readFile(filePath)
  } catch (error) {
    throw new Error(
      `File not found: unable to read from blob or disk. Path: ${filePath}`
    )
  }
}

/**
 * Delete a file.
 * - If the path is a blob URL: deletes from Vercel Blob.
 * - If the path is a local path: deletes from filesystem.
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (isBlobUrl(filePath)) {
    await del(filePath)
    return
  }

  // Local filesystem delete
  try {
    await unlink(filePath)
  } catch (error) {
    // File may already be deleted or not exist — that's OK
    console.warn('[file-storage] Failed to delete local file:', filePath, error)
  }
}

/**
 * Strip large/sensitive fields from a Prisma PdfFile record before returning as JSON.
 * Removes textContent (can be megabytes) and virusScanResult to keep API responses lean.
 */
export function stripFileData(file: Record<string, unknown>) {
  const { textContent, virusScanResult, ...rest } = file
  return rest
}

/**
 * Check if a blob URL exists and get its metadata.
 */
export async function checkBlobExists(url: string): Promise<boolean> {
  if (!isBlobUrl(url)) return false
  try {
    const blob = await head(url)
    return blob !== null
  } catch {
    return false
  }
}
