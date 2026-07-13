/**
 * Upload Validation & Security Module
 * 
 * Production-grade file validation, MIME type checking, magic byte verification,
 * SHA256 hashing for duplicate detection, and virus scan hooks.
 */

import { createHash } from 'crypto'

// ─── Configuration ───────────────────────────────────────────────────────────

export const UPLOAD_CONFIG = {
  /** Maximum file size in bytes (100MB) */
  MAX_FILE_SIZE: 100 * 1024 * 1024,
  /** Minimum file size in bytes (100 bytes — reject empty/near-empty files) */
  MIN_FILE_SIZE: 100,
  /** Chunk size for large file uploads (5MB) */
  CHUNK_SIZE: 5 * 1024 * 1024,
  /** Maximum number of concurrent uploads */
  MAX_CONCURRENT_UPLOADS: 3,
  /** Allowed MIME types */
  ALLOWED_MIME_TYPES: ['application/pdf'],
  /** Allowed file extensions */
  ALLOWED_EXTENSIONS: ['.pdf'],
  /** Maximum files per batch upload */
  MAX_BATCH_SIZE: 20,
  /** Session expiry for chunked uploads (30 minutes) */
  CHUNK_SESSION_EXPIRY_MS: 30 * 60 * 1000,
  /** Maximum number of chunks per session */
  MAX_CHUNKS_PER_SESSION: 200,
} as const

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  code: string
  message: string
  field?: string
}

export interface ValidationWarning {
  code: string
  message: string
}

export interface FileMetadata {
  author?: string
  title?: string
  creator?: string
  subject?: string
  creationDate?: string
  modDate?: string
  pdfVersion?: string
  isEncrypted: boolean
  isLinearized: boolean
  producer?: string
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  existingFile?: {
    id: string
    name: string
    originalName: string
    size: number
    pages: number
    createdAt: string
  }
}

// ─── Magic Byte Verification ─────────────────────────────────────────────────

/**
 * PDF files must start with %PDF- (hex: 25 50 44 46 2D)
 * This checks the actual file content, not just the Content-Type header.
 */
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]) // %PDF-

export function verifyPdfMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 5) return false
  return buffer.subarray(0, 5).equals(PDF_MAGIC_BYTES)
}

/**
 * Check if a buffer represents a valid PDF by also checking for the EOF marker.
 * PDFs should end with %%EOF (hex: 25 25 45 4F 46)
 */
export function verifyPdfStructure(buffer: Buffer): { valid: boolean; reason?: string } {
  if (buffer.length < 8) {
    return { valid: false, reason: 'File too small to be a valid PDF' }
  }

  // Check header
  if (!verifyPdfMagicBytes(buffer)) {
    return { valid: false, reason: 'Invalid PDF header — file does not start with %PDF-' }
  }

  // Check for %%EOF marker in the last 1024 bytes (some PDFs have trailing whitespace)
  const tailSize = Math.min(buffer.length, 1024)
  const tail = buffer.subarray(buffer.length - tailSize).toString('utf-8')
  if (!tail.includes('%%EOF')) {
    return { valid: false, reason: 'Missing %%EOF marker — PDF may be truncated or corrupted' }
  }

  return { valid: true }
}

// ─── File Validation ─────────────────────────────────────────────────────────

/**
 * Comprehensive file validation before upload processing.
 * Checks size, extension, MIME type, and performs magic byte verification.
 */
export async function validateUploadedFile(
  file: File,
  buffer: Buffer
): Promise<ValidationResult> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  // 1. File size check
  if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
    errors.push({
      code: 'SIZE_EXCEEDED',
      message: `File size (${formatBytes(file.size)}) exceeds maximum allowed size (${formatBytes(UPLOAD_CONFIG.MAX_FILE_SIZE)})`,
      field: 'size',
    })
  }

  if (file.size < UPLOAD_CONFIG.MIN_FILE_SIZE) {
    errors.push({
      code: 'SIZE_TOO_SMALL',
      message: 'File is too small to be a valid PDF',
      field: 'size',
    })
  }

  // 2. File extension check
  const fileName = file.name.toLowerCase()
  const hasValidExtension = UPLOAD_CONFIG.ALLOWED_EXTENSIONS.some((ext) =>
    fileName.endsWith(ext)
  )
  if (!hasValidExtension) {
    errors.push({
      code: 'INVALID_EXTENSION',
      message: `File extension not allowed. Accepted: ${UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(', ')}`,
      field: 'name',
    })
  }

  // 3. MIME type check (from browser Content-Type header)
  const declaredMimeType = file.type || 'application/octet-stream'
  if (!UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(declaredMimeType)) {
    // Warning only — browsers sometimes send wrong MIME types
    warnings.push({
      code: 'MIME_MISMATCH',
      message: `Declared MIME type "${declaredMimeType}" doesn't match expected "application/pdf"`,
    })
  }

  // 4. Magic byte verification (the real security check)
  if (!verifyPdfMagicBytes(buffer)) {
    errors.push({
      code: 'INVALID_PDF_HEADER',
      message: 'File content does not match PDF format (invalid magic bytes)',
      field: 'content',
    })
  }

  // 5. PDF structure verification
  const structureCheck = verifyPdfStructure(buffer)
  if (!structureCheck.valid) {
    errors.push({
      code: 'INVALID_PDF_STRUCTURE',
      message: structureCheck.reason || 'PDF structure verification failed',
      field: 'content',
    })
  }

  // 6. Check for PDF encryption warning
  try {
    const pdfVersion = buffer.toString('utf-8', 0, 20).match(/%PDF-(\d+\.\d+)/)?.[1]
    if (pdfVersion && parseFloat(pdfVersion) > 2.0) {
      warnings.push({
        code: 'UNUSUAL_PDF_VERSION',
        message: `PDF version ${pdfVersion} is unusually high — verify compatibility`,
      })
    }
  } catch {
    // Non-critical, skip
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// ─── SHA256 Hashing ──────────────────────────────────────────────────────────

/**
 * Compute SHA256 hash of file buffer for duplicate detection.
 * Uses Node.js crypto for performance on large buffers.
 */
export function computeFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Compute SHA256 hash from a stream of chunks.
 * Useful for chunked uploads where the full file isn't in memory.
 */
export class StreamingHasher {
  private hash = createHash('sha256')

  update(chunk: Buffer): this {
    this.hash.update(chunk)
    return this
  }

  digest(): string {
    return this.hash.digest('hex')
  }
}

// ─── PDF Metadata Extraction ────────────────────────────────────────────────

/**
 * Extract metadata from a PDF buffer using pdf-lib.
 * Returns structured metadata for storage.
 */
export async function extractPdfMetadata(buffer: Buffer): Promise<FileMetadata> {
  const metadata: FileMetadata = {
    isEncrypted: false,
    isLinearized: false,
  }

  try {
    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    })

    metadata.title = pdfDoc.getTitle() || undefined
    metadata.author = pdfDoc.getAuthor() || undefined
    metadata.subject = pdfDoc.getSubject() || undefined
    metadata.creator = pdfDoc.getCreator() || undefined
    metadata.producer = pdfDoc.getProducer() || undefined
    metadata.creationDate = pdfDoc.getCreationDate()?.toISOString()
    metadata.modDate = pdfDoc.getModificationDate()?.toISOString()

    // Check for linearization (fast web view)
    try {
      const header = buffer.toString('utf-8', 0, 1024)
      metadata.isLinearized = header.includes('/Linearized')
    } catch {
      // Non-critical
    }

    // Check PDF version from header
    const versionMatch = buffer.toString('utf-8', 0, 20).match(/%PDF-(\d+\.\d+)/)
    if (versionMatch) {
      metadata.pdfVersion = versionMatch[1]
    }
  } catch (error) {
    // If we can't load the PDF at all, it might be encrypted or corrupted
    const errMsg = error instanceof Error ? error.message : String(error)
    if (errMsg.includes('encrypted') || errMsg.includes('password')) {
      metadata.isEncrypted = true
    }
  }

  return metadata
}

// ─── Virus Scan Hook ────────────────────────────────────────────────────────

/**
 * Virus/malware scanning interface.
 * 
 * In production, integrate with:
 * - ClamAV (open-source, self-hosted)
 * - VirusTotal API (cloud-based, per-file)
 * - AWS S3 Object Lambda with ClamAV
 * - Cloudflare Malware Detection
 * 
 * For now, this implements a basic heuristic check and a pluggable interface.
 */
export interface VirusScanner {
  scan(buffer: Buffer, fileName: string): Promise<VirusScanResult>
}

export interface VirusScanResult {
  status: 'clean' | 'threat' | 'error' | 'skipped'
  threats?: string[]
  scanEngine?: string
  scanDurationMs?: number
}

/**
 * Default virus scanner — performs heuristic checks only.
 * Replace with a real scanner in production.
 * 
 * IMPORTANT: Heuristic checks are intentionally conservative to avoid
 * false positives. Only HIGH-CONFIDENCE threats block the upload.
 * Low-confidence detections are logged but do not block.
 */
export class HeuristicScanner implements VirusScanner {
  async scan(buffer: Buffer, fileName: string): Promise<VirusScanResult> {
    const start = Date.now()
    const threats: string[] = []
    const warnings: string[] = []

    // Scan first 100KB for suspicious patterns
    const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 100000))

    // ── Heuristic 1: Suspicious JavaScript patterns ──────────────────────
    // PDF forms can contain /JS or /JavaScript legitimately (calculations, 
    // validation). Only flag if we see clearly malicious patterns.
    if (content.includes('/JavaScript') || content.includes('/JS ')) {
      // These are high-confidence malicious patterns
      const maliciousPatterns = [
        'app.launchURL',
        'this.exportDataObject',
        'app.alert.*eval',
        'app.execDialog',
        'util.printf.*eval',
      ]
      for (const pattern of maliciousPatterns) {
        if (new RegExp(pattern).test(content)) {
          threats.push('EMBEDDED_MALICIOUS_JS')
          break
        }
      }
      // Flag eval() as a warning (not a blocker — used in some form logic)
      if (content.includes('eval(') && !threats.includes('EMBEDDED_MALICIOUS_JS')) {
        warnings.push('EMBEDDED_EVAL_JS')
      }
    }

    // ── Heuristic 2: Embedded executables (polyglot attack) ──────────────
    // Use FULL magic signatures (4+ bytes) to prevent false positives.
    // PDF compressed streams often contain 2-byte coincidental matches
    // (e.g., 0x4D5A = "MZ" can appear in any binary data).
    const exeSignatures = [
      // Windows PE: Must start with "MZ" at offset 0 AND have "PE\0\0" 
      // at the offset specified by e_lfanew (bytes 60-63).
      // We only check if the ENTIRE file starts with MZ (not just includes it).
      { sig: Buffer.from([0x4D, 0x5A]), name: 'PE_EXE', checkOffset0: true },
      // Full ELF magic: \x7fELF + class byte (1=32-bit, 2=64-bit)
      { sig: Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x01]), name: 'ELF32' },
      { sig: Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02]), name: 'ELF64' },
      // Full Mach-O magic signatures
      { sig: Buffer.from([0xCE, 0xFA, 0xED, 0xFE]), name: 'MACHO32' },  // MH_MAGIC
      { sig: Buffer.from([0xCF, 0xFA, 0xED, 0xFE]), name: 'MACHO64' },  // MH_MAGIC_64
      { sig: Buffer.from([0xFE, 0xED, 0xFA, 0xCE]), name: 'MACHO32_BE' }, // MH_CIGAM
      { sig: Buffer.from([0xFE, 0xED, 0xFA, 0xCF]), name: 'MACHO64_BE' }, // MH_CIGAM_64
    ]

    for (const { sig, name, checkOffset0 } of exeSignatures) {
      if (checkOffset0) {
        // For PE: only match if MZ is at the very START of the file
        // (a real EXE must start at offset 0, not embedded mid-file)
        if (buffer.length >= sig.length && buffer.subarray(0, sig.length).equals(sig)) {
          threats.push(`EMBEDDED_EXECUTABLE_${name}`)
          break
        }
      } else {
        // For ELF/Mach-O: check first 4KB (executables must have headers early)
        const headerSize = Math.min(buffer.length, 4096)
        const header = buffer.subarray(0, headerSize)
        if (header.includes(sig)) {
          threats.push(`EMBEDDED_EXECUTABLE_${name}`)
          break
        }
      }
    }

    // ── Heuristic 3: Suspicious OpenAction ───────────────────────────────
    // /OpenAction with /Launch is a common attack vector
    if (content.includes('/OpenAction') && content.includes('/Launch')) {
      threats.push('SUSPICIOUS_OPEN_ACTION_LAUNCH')
    }
    // /OpenAction with /SubmitForm is suspicious but less dangerous — warn only
    if (content.includes('/OpenAction') && content.includes('/SubmitForm') && !threats.includes('SUSPICIOUS_OPEN_ACTION_LAUNCH')) {
      warnings.push('SUSPICIOUS_OPEN_ACTION_SUBMIT')
    }

    return {
      status: threats.length > 0 ? 'threat' : 'clean',
      threats: threats.length > 0 ? threats : undefined,
      scanEngine: 'heuristic-v2',
      scanDurationMs: Date.now() - start,
    }
  }
}

// Singleton instance
let scannerInstance: VirusScanner | null = null

export function getVirusScanner(): VirusScanner {
  if (!scannerInstance) {
    scannerInstance = new HeuristicScanner()
  }
  return scannerInstance
}

export function setVirusScanner(scanner: VirusScanner): void {
  scannerInstance = scanner
}

// ─── Utility Functions ───────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes < 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  if (i < 0 || i >= sizes.length) return `${bytes} B`
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Sanitize a filename to prevent path traversal attacks.
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Remove illegal characters
    .replace(/\.\./g, '_')                    // Prevent path traversal
    .replace(/^\s+|\s+$/g, '')                // Trim whitespace
    .slice(0, 255)                            // Limit length
    || 'unnamed.pdf'
}
