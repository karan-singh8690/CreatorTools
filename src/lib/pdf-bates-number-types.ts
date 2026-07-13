/**
 * Shared types for PDF Bates Numbering feature.
 * This file has NO server-only imports (sharp, fs, etc.)
 * and is safe to import from client components.
 */

// ─── Core Types ──────────────────────────────────────────────────────────────

export type BatesFont =
  | 'Helvetica'
  | 'HelveticaBold'
  | 'HelveticaOblique'
  | 'HelveticaBoldOblique'
  | 'TimesRoman'
  | 'TimesRomanBold'
  | 'TimesRomanItalic'
  | 'TimesRomanBoldItalic'
  | 'Courier'
  | 'CourierBold'
  | 'CourierOblique'
  | 'CourierBoldOblique'

export type BatesPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type BatesNumberFormat = '1' | '01' | '001' | '0001' | '00001'

export type BatesPageScope = 'all' | 'first-only' | 'not-first' | 'odd' | 'even' | 'custom'

export type BatesSequenceMode = 'restart-per-doc' | 'continue-across-docs'

export type BatesBorderStyle = 'none' | 'solid' | 'dashed' | 'underline'

// ─── Options ─────────────────────────────────────────────────────────────────

export interface BatesOptions {
  // Feature 1: Custom prefix
  prefix: string

  // Feature 2: Date prefix
  dateFormat: string           // e.g. 'YYYY-MM-DD', 'MM/DD/YYYY', 'none'
  dateSeparator: string        // e.g. '-', '_', 'none'

  // Core numbering
  startNumber: number          // Starting number (default 1)
  numberFormat: BatesNumberFormat
  suffix: string               // Optional suffix after number

  // Feature 10: Visual placement controls
  position: BatesPosition
  marginX: number              // Horizontal offset from default position (pts)
  marginY: number              // Vertical offset from default position (pts)

  // Typography
  fontSize: number
  fontColor: { r: number; g: number; b: number }
  fontFamily: BatesFont
  opacity: number

  // Page scope
  pageScope: BatesPageScope
  customPageRange: string      // e.g. '1-5, 8, 10-15'

  // Border/box around bates number
  borderStyle: BatesBorderStyle
  borderColor: { r: number; g: number; b: number }

  // Feature 3: Multi-document sequences
  sequenceMode: BatesSequenceMode

  // Feature 8: Audit logging
  enableAuditLog: boolean

  // Feature 9: Undo support
  preserveOriginal: boolean

  // Margins
  margins: {
    top: number
    bottom: number
    left: number
    right: number
  }
}

// ─── Template ────────────────────────────────────────────────────────────────

export interface BatesTemplate {
  id: string
  name: string
  description?: string
  category: 'standard' | 'federal' | 'state' | 'discovery' | 'exhibit' | 'custom'
  options: Partial<BatesOptions>
}

// ─── Preset ──────────────────────────────────────────────────────────────────

export interface BatesPreset {
  id: string
  name: string
  options: BatesOptions
  createdAt: string
  updatedAt: string
}

// ─── Conflict Detection ─────────────────────────────────────────────────────

export interface BatesConflict {
  pageIndex: number
  existingText: string
  zone: 'header' | 'footer' | 'body'
  confidence: 'high' | 'medium' | 'low'
  description: string
}

// ─── Audit Log ──────────────────────────────────────────────────────────────

export interface BatesAuditEntry {
  timestamp: string
  action: 'apply' | 'undo' | 'preview' | 'conflict_detected'
  fileId?: string
  fileName?: string
  details: string
  batesRange?: string
  pagesProcessed?: number
}

// ─── Result Types ────────────────────────────────────────────────────────────

export interface BatesResult {
  outputBuffer?: Buffer
  originalSize: number
  outputSize: number
  sizeIncrease: number
  pagesProcessed: number
  totalPages: number
  batesRange: string             // e.g. "BATES-0001 to BATES-0005"
  firstBatesNumber: string
  lastBatesNumber: string
  conflicts: BatesConflict[]
  auditEntries: BatesAuditEntry[]
  operations: BatesOperation[]
  durationMs: number
}

export interface BatesOperation {
  type: string
  description: string
  itemsProcessed: number
}

export interface BatesPreview {
  totalPages: number
  pagesToProcess: number
  firstPagePreview: string        // Preview of first bates number
  lastPagePreview: string         // Preview of last bates number
  batesRange: string
  conflicts: BatesConflict[]
  dynamicVariables: string[]
  estimatedSizeIncrease: number
  configSummary: string
  hasDatePrefix: boolean
  hasCustomPrefix: boolean
  sequenceMode: BatesSequenceMode
}

export interface BatchBatesResult {
  results: Array<{
    fileId: string
    fileName: string
    success: boolean
    error?: string
    sizeIncrease?: number
    pagesProcessed?: number
    batesRange?: string
    firstBatesNumber?: string
    lastBatesNumber?: string
  }>
  auditEntries: BatesAuditEntry[]
  summary: {
    total: number
    success: number
    errors: number
    totalSizeIncrease: number
    totalPagesProcessed: number
    globalBatesRange: string
  }
}

// ─── Undo Support ───────────────────────────────────────────────────────────

export interface BatesUndoInfo {
  fileId: string
  originalFileId: string         // ID of the pre-bates file
  batesConfig: string            // JSON of the bates options used
  appliedAt: string
  batesRange: string
}

// ─── Default Options ─────────────────────────────────────────────────────────

export function getDefaultBatesOptions(): BatesOptions {
  return {
    prefix: 'BATES',
    dateFormat: 'none',
    dateSeparator: '-',
    startNumber: 1,
    numberFormat: '0001',
    suffix: '',
    position: 'bottom-right',
    marginX: 0,
    marginY: 0,
    fontSize: 9,
    fontColor: { r: 0.2, g: 0.2, b: 0.2 },
    fontFamily: 'CourierBold',
    opacity: 1.0,
    pageScope: 'all',
    customPageRange: '',
    borderStyle: 'none',
    borderColor: { r: 0.5, g: 0.5, b: 0.5 },
    sequenceMode: 'continue-across-docs',
    enableAuditLog: true,
    preserveOriginal: true,
    margins: {
      top: 30,
      bottom: 30,
      left: 40,
      right: 40,
    },
  }
}

// ─── Built-in Legal Templates ────────────────────────────────────────────────

export const BUILTIN_BATES_TEMPLATES: BatesTemplate[] = [
  {
    id: 'standard-bates',
    name: 'Standard Bates',
    description: 'Classic Bates numbering with 4-digit zero-padded numbers',
    category: 'standard',
    options: {
      prefix: 'BATES',
      numberFormat: '0001',
      position: 'bottom-right',
      fontFamily: 'CourierBold',
      fontSize: 9,
      borderStyle: 'none',
    },
  },
  {
    id: 'federal-court',
    name: 'Federal Court Filing',
    description: 'Compliant with federal court Bates numbering requirements',
    category: 'federal',
    options: {
      prefix: 'USDC',
      numberFormat: '0001',
      position: 'bottom-center',
      fontFamily: 'CourierBold',
      fontSize: 8,
      borderStyle: 'underline',
      dateFormat: 'YYYY-MM-DD',
      dateSeparator: '-',
    },
  },
  {
    id: 'state-court',
    name: 'State Court Filing',
    description: 'Standard state court Bates numbering format',
    category: 'state',
    options: {
      prefix: 'SC',
      numberFormat: '0001',
      position: 'bottom-right',
      fontFamily: 'Courier',
      fontSize: 9,
      borderStyle: 'none',
    },
  },
  {
    id: 'discovery-production',
    name: 'Discovery Production',
    description: 'Bates numbering for legal discovery document production',
    category: 'discovery',
    options: {
      prefix: 'PROD',
      numberFormat: '0001',
      position: 'bottom-right',
      fontFamily: 'CourierBold',
      fontSize: 9,
      borderStyle: 'solid',
      dateFormat: 'YYYY-MM-DD',
      dateSeparator: '_',
      suffix: '',
    },
  },
  {
    id: 'exhibit-marking',
    name: 'Exhibit Marking',
    description: 'Exhibit-style Bates numbering with date prefix',
    category: 'exhibit',
    options: {
      prefix: 'EXH',
      numberFormat: '001',
      position: 'top-right',
      fontFamily: 'HelveticaBold',
      fontSize: 10,
      borderStyle: 'solid',
      dateFormat: 'YYYY',
      dateSeparator: '-',
    },
  },
  {
    id: 'confidential-bates',
    name: 'Confidential Bates',
    description: 'Bates numbering with confidentiality watermark integration',
    category: 'discovery',
    options: {
      prefix: 'CONF-BATES',
      numberFormat: '0001',
      position: 'bottom-left',
      fontFamily: 'CourierBold',
      fontSize: 8,
      borderStyle: 'underline',
    },
  },
  {
    id: 'simple-numeric',
    name: 'Simple Numeric',
    description: 'Plain numeric stamp without prefix, 6-digit padding',
    category: 'standard',
    options: {
      prefix: '',
      numberFormat: '000001',
      position: 'bottom-center',
      fontFamily: 'Helvetica',
      fontSize: 9,
      borderStyle: 'none',
    },
  },
  {
    id: 'date-prefixed',
    name: 'Date-Prefixed Bates',
    description: 'Bates number with date prefix for chronological filing',
    category: 'standard',
    options: {
      prefix: 'BATES',
      numberFormat: '0001',
      position: 'bottom-right',
      fontFamily: 'CourierBold',
      fontSize: 8,
      borderStyle: 'none',
      dateFormat: 'YYYY-MM-DD',
      dateSeparator: '-',
    },
  },
]

// ─── Dynamic Variables ───────────────────────────────────────────────────────

export const BATES_DYNAMIC_VARS = [
  { tag: '{bates}', desc: 'Full Bates number (prefix + formatted number + suffix)' },
  { tag: '{bates_number}', desc: 'Just the formatted number without prefix/suffix' },
  { tag: '{bates_prefix}', desc: 'The prefix text' },
  { tag: '{bates_suffix}', desc: 'The suffix text' },
  { tag: '{date}', desc: 'Current date (YYYY-MM-DD)' },
  { tag: '{date:MM/DD/YYYY}', desc: 'Custom date format' },
  { tag: '{time}', desc: 'Current time (HH:MM)' },
  { tag: '{datetime}', desc: 'Date and time' },
  { tag: '{filename}', desc: 'PDF filename' },
  { tag: '{page}', desc: 'Page number in current document' },
  { tag: '{total_pages}', desc: 'Total pages in current document' },
  { tag: '{global_page}', desc: 'Sequential page across all documents' },
]
