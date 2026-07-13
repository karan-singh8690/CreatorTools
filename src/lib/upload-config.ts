/**
 * Upload configuration for file storage.
 * Uses Vercel Blob in production (Vercel) and local filesystem in development.
 */

export const isVercel = process.env.VERCEL === '1'

// Blob path prefixes for organizing files
export const BLOB_PATHS = {
  pdfs: 'pdfs',
  thumbnails: 'thumbnails',
  chunks: 'chunks',
  temp: 'temp',
} as const

// Local uploads directory (for development only)
export const UPLOADS_DIR = isVercel
  ? '/tmp/uploads'
  : process.cwd() + '/uploads'

// Max file size: 100MB
export const MAX_FILE_SIZE = 100 * 1024 * 1024
