/**
 * PDF Bates Numbering Engine — Professional-Grade
 *
 * Implements comprehensive Bates numbering with:
 * 1. Custom prefixes — e.g. "ABC-" → "ABC-0001"
 * 2. Date prefixes — e.g. "2024-01-15-" → "2024-01-15-BATES-0001"
 * 3. Multi-document sequences — Global counter continues across documents
 * 4. Legal templates — Template-to-options helper with built-in presets
 * 5. Rich text formatting — Font family, size, color, bold/italic
 * 6. Conflict detection — Scan for existing Bates-like patterns
 * 7. Batch processing — Process multiple PDFs with shared counter
 * 8. Audit logs — Track all operations with timestamps and ranges
 * 9. Undo support — removeBatesNumber() covers bates stamps with white rect
 * 10. Visual placement controls — Position + marginX/marginY offsets
 */

import {
  PDFDocument,
  PDFPage,
  PDFFont,
  rgb,
  StandardFonts,
} from 'pdf-lib'

// Re-export types and constants for consumers
export type {
  BatesFont,
  BatesPosition,
  BatesNumberFormat,
  BatesPageScope,
  BatesSequenceMode,
  BatesBorderStyle,
  BatesOptions,
  BatesTemplate,
  BatesPreset,
  BatesConflict,
  BatesAuditEntry,
  BatesResult,
  BatesOperation,
  BatesPreview,
  BatchBatesResult,
  BatesUndoInfo,
} from './pdf-bates-number-types'

export {
  BUILTIN_BATES_TEMPLATES,
  getDefaultBatesOptions,
} from './pdf-bates-number-types'

import type {
  BatesFont,
  BatesPosition,
  BatesNumberFormat,
  BatesPageScope,
  BatesSequenceMode,
  BatesBorderStyle,
  BatesOptions,
  BatesTemplate,
  BatesConflict,
  BatesAuditEntry,
  BatesResult,
  BatesOperation,
  BatesPreview,
  BatchBatesResult,
} from './pdf-bates-number-types'

// ─── Font Mapping ────────────────────────────────────────────────────────────

const FONT_MAP: Record<BatesFont, (pdfDoc: PDFDocument) => Promise<PDFFont>> = {
  Helvetica: (doc) => doc.embedFont(StandardFonts.Helvetica),
  HelveticaBold: (doc) => doc.embedFont(StandardFonts.HelveticaBold),
  HelveticaOblique: (doc) => doc.embedFont(StandardFonts.HelveticaOblique),
  HelveticaBoldOblique: (doc) => doc.embedFont(StandardFonts.HelveticaBoldOblique),
  TimesRoman: (doc) => doc.embedFont(StandardFonts.TimesRoman),
  TimesRomanBold: (doc) => doc.embedFont(StandardFonts.TimesRomanBold),
  TimesRomanItalic: (doc) => doc.embedFont(StandardFonts.TimesRomanItalic),
  TimesRomanBoldItalic: (doc) => doc.embedFont(StandardFonts.TimesRomanBoldItalic),
  Courier: (doc) => doc.embedFont(StandardFonts.Courier),
  CourierBold: (doc) => doc.embedFont(StandardFonts.CourierBold),
  CourierOblique: (doc) => doc.embedFont(StandardFonts.CourierOblique),
  CourierBoldOblique: (doc) => doc.embedFont(StandardFonts.CourierBoldOblique),
}

// ─── Date Formatting ─────────────────────────────────────────────────────────

function formatDateCustom(date: Date, format: string): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', String(year))
    .replace('YY', String(year).slice(-2))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

// ─── Bates Number Generation ─────────────────────────────────────────────────

/**
 * Format a numeric Bates counter according to the number format string.
 * e.g. formatBatesNumber(42, '0001') → '0042'
 */
function formatBatesNumber(number: number, format: BatesNumberFormat): string {
  const digits = format.length
  return String(number).padStart(digits, '0')
}

/**
 * Build the full Bates label for a given page number.
 * Combines date prefix + custom prefix + formatted number + suffix.
 */
function generateBatesLabel(options: BatesOptions, number: number): string {
  const formattedNum = formatBatesNumber(number, options.numberFormat)
  let label = ''

  // Feature 2: Date prefix
  if (options.dateFormat && options.dateFormat !== 'none') {
    label += formatDateCustom(new Date(), options.dateFormat)
    if (options.dateSeparator && options.dateSeparator !== 'none') label += options.dateSeparator
  }

  // Feature 1: Custom prefix
  if (options.prefix) {
    label += options.prefix + '-'
  }

  // The formatted number
  label += formattedNum

  // Suffix
  if (options.suffix) {
    label += options.suffix
  }

  return label
}

// ─── Position Calculation (Feature 10) ───────────────────────────────────────

/**
 * Calculate the x,y coordinates for the Bates stamp on a page.
 * Each position respects margins + marginX/marginY offsets.
 */
function calculateBatesPosition(
  position: BatesPosition,
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  textHeight: number,
  margins: BatesOptions['margins'],
  marginX: number,
  marginY: number,
): { x: number; y: number } {
  let x: number
  let y: number

  switch (position) {
    case 'top-left':
      x = margins.left + marginX
      y = pageHeight - margins.top - textHeight + marginY
      break
    case 'top-center':
      x = (pageWidth - textWidth) / 2 + marginX
      y = pageHeight - margins.top - textHeight + marginY
      break
    case 'top-right':
      x = pageWidth - margins.right - textWidth + marginX
      y = pageHeight - margins.top - textHeight + marginY
      break
    case 'bottom-left':
      x = margins.left + marginX
      y = margins.bottom + marginY
      break
    case 'bottom-center':
      x = (pageWidth - textWidth) / 2 + marginX
      y = margins.bottom + marginY
      break
    case 'bottom-right':
      x = pageWidth - margins.right - textWidth + marginX
      y = margins.bottom + marginY
      break
    default:
      // Default to bottom-right
      x = pageWidth - margins.right - textWidth + marginX
      y = margins.bottom + marginY
      break
  }

  return { x, y }
}

// ─── Page Scope Matching ─────────────────────────────────────────────────────

function doesScopeApply(
  scope: BatesPageScope,
  pageNum: number,
  totalPages: number,
  customRange?: string,
): boolean {
  switch (scope) {
    case 'all':
      return true
    case 'first-only':
      return pageNum === 1
    case 'not-first':
      return pageNum > 1
    case 'odd':
      return pageNum % 2 === 1
    case 'even':
      return pageNum % 2 === 0
    case 'custom': {
      if (!customRange || customRange.trim() === '') return true
      const pages = parseCustomPageRange(customRange, totalPages)
      return pages.includes(pageNum)
    }
    default:
      return true
  }
}

// ─── Custom Page Range Parsing ───────────────────────────────────────────────

/**
 * Parse a page range string like "1-5, 8, 10-15" into an array of page numbers.
 */
function parseCustomPageRange(range: string, totalPages: number): number[] {
  const pages: number[] = []
  const parts = range.split(',').map((p) => p.trim()).filter(Boolean)

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim())
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
          if (!pages.includes(i)) pages.push(i)
        }
      }
    } else {
      const num = parseInt(part, 10)
      if (!isNaN(num) && num >= 1 && num <= totalPages && !pages.includes(num)) {
        pages.push(num)
      }
    }
  }

  return pages.sort((a, b) => a - b)
}

// ─── Audit Logging (Feature 8) ───────────────────────────────────────────────

function createAuditEntry(
  action: BatesAuditEntry['action'],
  details: string,
  opts: {
    fileName?: string
    batesRange?: string
    pagesProcessed?: number
  },
): BatesAuditEntry {
  return {
    timestamp: new Date().toISOString(),
    action,
    fileId: undefined,
    fileName: opts.fileName,
    details,
    batesRange: opts.batesRange,
    pagesProcessed: opts.pagesProcessed,
  }
}

// ─── Conflict Detection (Feature 6) ─────────────────────────────────────────

/**
 * Regex patterns used to detect existing Bates-like stamps in PDF content.
 */
const BATES_CONFLICT_PATTERNS: Array<{
  regex: RegExp
  description: string
  confidence: BatesConflict['confidence']
  zone: BatesConflict['zone']
}> = [
  {
    // Matches patterns like "BATES-0001", "PROD_123", "EXH-0042"
    regex: /\b[A-Z]{2,6}[-_]\d{3,6}\b/g,
    description: 'Prefixed Bates pattern (e.g. BATES-0001, PROD_123)',
    confidence: 'high',
    zone: 'footer',
  },
  {
    // Matches patterns like "USDC-2024-01-15-0001" (date-prefixed Bates)
    regex: /\b[A-Z]{2,6}[-_]\d{4}[-_]\d{2}[-_]\d{2}[-_]\d{3,6}\b/g,
    description: 'Date-prefixed Bates pattern (e.g. USDC-2024-01-15-0001)',
    confidence: 'high',
    zone: 'footer',
  },
  {
    // Matches "BATES" keyword near numbers
    regex: /\bBATES\b/gi,
    description: 'BATES keyword detected',
    confidence: 'medium',
    zone: 'footer',
  },
  {
    // Matches standalone 4-7 digit numbers in footer/header zones
    regex: /\b\d{4,7}\b/g,
    description: 'Standalone numeric stamp (4-7 digits)',
    confidence: 'low',
    zone: 'footer',
  },
]

/**
 * Extract text from a single page's content stream.
 * Looks for text between parentheses in PDF content stream operators.
 */
function extractPageText(pageContentStr: string): string {
  const texts: string[] = []
  // Match text in parentheses that appear in PDF text-showing operators (Tj, TJ, ')
  const parenTextRegex = /\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = parenTextRegex.exec(pageContentStr)) !== null) {
    texts.push(match[1])
  }
  // Also match hex strings <...> that might contain text
  const hexTextRegex = /<([0-9A-Fa-f]+)>/g
  while ((match = hexTextRegex.exec(pageContentStr)) !== null) {
    try {
      const hex = match[1]
      let decoded = ''
      for (let i = 0; i < hex.length; i += 4) {
        const code = parseInt(hex.substring(i, i + 4), 16)
        if (code > 0 && code < 0xFFFF) {
          decoded += String.fromCharCode(code)
        }
      }
      if (decoded) texts.push(decoded)
    } catch {
      // Skip unparseable hex strings
    }
  }
  return texts.join(' ')
}

/**
 * Detect existing Bates-like patterns in a PDF buffer.
 * Scans each page's content stream for conflict patterns.
 */
export async function detectConflicts(
  pdfBuffer: Buffer,
  options: BatesOptions,
): Promise<BatesConflict[]> {
  const conflicts: BatesConflict[] = []

  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    })
    const totalPages = pdfDoc.getPageCount()

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const page = pdfDoc.getPage(pageIndex)
      const { width: pageWidth, height: pageHeight } = page.getSize()

      // Get the page content stream
      let pageContentStr = ''
      try {
        const contentsRef = page.node.Contents()
        if (contentsRef) {
          const contentsObject = pdfDoc.context.lookup(contentsRef)
          if (contentsObject) {
            // Try to get the raw content via available methods
            try {
              // pdf-lib internal: content stream objects may have asUint8Array
              const anyObj = contentsObject as unknown as Record<string, unknown>
              if (typeof anyObj.asUint8Array === 'function') {
                const bytes = anyObj.asUint8Array() as Uint8Array
                pageContentStr = Buffer.from(bytes).toString('latin1')
              } else if (typeof anyObj.asString === 'function') {
                pageContentStr = anyObj.asString() as string
              } else {
                pageContentStr = String(contentsObject)
              }
            } catch {
              pageContentStr = String(contentsObject)
            }
          }
        }
      } catch {
        // If we can't extract page content, fall back to raw buffer scanning
        pageContentStr = ''
      }

      // Also scan a section of the raw buffer for this page
      // (fallback approach using the full raw buffer)
      const rawPdfStr = pdfBuffer.toString('latin1')

      // Combine both sources for analysis
      const searchText = pageContentStr + ' ' + rawPdfStr.substring(
        Math.floor((pageIndex / totalPages) * rawPdfStr.length),
        Math.floor(((pageIndex + 1) / totalPages) * rawPdfStr.length),
      )

      // Also extract structured text from parentheses
      const extractedText = extractPageText(searchText)
      const combinedText = searchText + ' ' + extractedText

      // Determine which zone the Bates stamp would go to
      const isTopPosition = options.position.startsWith('top')
      const stampZone: 'header' | 'footer' = isTopPosition ? 'header' : 'footer'

      // Check each conflict pattern
      for (const pattern of BATES_CONFLICT_PATTERNS) {
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
        const matches = combinedText.match(regex)

        if (matches && matches.length > 0) {
          // Deduplicate matches
          const uniqueMatches = Array.from(new Set(matches))

          for (const matchText of uniqueMatches) {
            // Determine zone: if match is in the same area as where we'd stamp,
            // it's a higher concern
            const isNearStampZone =
              (pattern.zone === 'footer' && stampZone === 'footer') ||
              (pattern.zone === 'header' && stampZone === 'header')

            const confidence = isNearStampZone ? pattern.confidence : 'low'

            // Avoid duplicate conflicts for the same page/text
            const isDuplicate = conflicts.some(
              (c) => c.pageIndex === pageIndex && c.existingText === matchText,
            )

            if (!isDuplicate) {
              conflicts.push({
                pageIndex,
                existingText: matchText,
                zone: pattern.zone,
                confidence,
                description: `${pattern.description}: "${matchText}" found on page ${pageIndex + 1}`,
              })
            }
          }
        }
      }
    }
  } catch {
    // If we can't load the PDF at all, return empty conflicts
  }

  return conflicts
}

// ─── Border Drawing ──────────────────────────────────────────────────────────

function drawBatesBorder(
  page: PDFPage,
  x: number,
  y: number,
  textWidth: number,
  textHeight: number,
  borderStyle: BatesBorderStyle,
  borderColor: { r: number; g: number; b: number },
  opacity: number,
  padding: number = 2,
): void {
  if (borderStyle === 'none') return

  const rectX = x - padding
  const rectY = y - padding
  const rectWidth = textWidth + padding * 2
  const rectHeight = textHeight + padding * 2

  switch (borderStyle) {
    case 'solid': {
      const color = rgb(borderColor.r, borderColor.g, borderColor.b)
      page.drawRectangle({
        x: rectX,
        y: rectY,
        width: rectWidth,
        height: rectHeight,
        borderColor: color,
        borderWidth: 0.5,
        opacity: 0,
        borderOpacity: opacity,
        color: rgb(1, 1, 1),
      })
      break
    }
    case 'dashed': {
      const color = rgb(borderColor.r, borderColor.g, borderColor.b)
      // Draw dashed lines manually with short segments
      const dashLen = 3
      const gapLen = 2
      const corners = [
        // Top line
        { start: { x: rectX, y: rectY + rectHeight }, end: { x: rectX + rectWidth, y: rectY + rectHeight } },
        // Right line
        { start: { x: rectX + rectWidth, y: rectY + rectHeight }, end: { x: rectX + rectWidth, y: rectY } },
        // Bottom line
        { start: { x: rectX, y: rectY }, end: { x: rectX + rectWidth, y: rectY } },
        // Left line
        { start: { x: rectX, y: rectY }, end: { x: rectX, y: rectY + rectHeight } },
      ]
      for (const line of corners) {
        const dx = line.end.x - line.start.x
        const dy = line.end.y - line.start.y
        const totalLen = Math.sqrt(dx * dx + dy * dy)
        const segments = Math.ceil(totalLen / (dashLen + gapLen))
        for (let s = 0; s < segments; s++) {
          const startFrac = s * (dashLen + gapLen) / totalLen
          const endFrac = Math.min((s * (dashLen + gapLen) + dashLen) / totalLen, 1)
          page.drawLine({
            start: {
              x: line.start.x + dx * startFrac,
              y: line.start.y + dy * startFrac,
            },
            end: {
              x: line.start.x + dx * endFrac,
              y: line.start.y + dy * endFrac,
            },
            thickness: 0.5,
            color,
            opacity,
          })
        }
      }
      break
    }
    case 'underline': {
      const color = rgb(borderColor.r, borderColor.g, borderColor.b)
      page.drawLine({
        start: { x: rectX, y: rectY },
        end: { x: rectX + rectWidth, y: rectY },
        thickness: 0.5,
        color,
        opacity,
      })
      break
    }
  }
}

// ─── Core Bates Application ──────────────────────────────────────────────────

/**
 * Apply Bates numbering to a single PDF document.
 *
 * @param pdfBuffer  - Raw PDF bytes
 * @param options    - Bates numbering configuration
 * @param filename   - Optional filename for audit/dynamic variables
 * @param globalStartNumber - Override start number (for multi-doc continuation)
 * @returns BatesResult with output buffer, audit entries, conflicts, etc.
 */
export async function applyBatesNumber(
  pdfBuffer: Buffer,
  options: BatesOptions,
  filename?: string,
  globalStartNumber?: number,
): Promise<BatesResult> {
  const startTime = Date.now()
  const originalSize = pdfBuffer.length
  const auditEntries: BatesAuditEntry[] = []
  const operations: BatesOperation[] = []

  // Load the PDF
  const pdfDoc = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
    updateMetadata: false,
  })
  const totalPages = pdfDoc.getPageCount()

  // Determine the starting Bates number
  const startNumber = globalStartNumber ?? options.startNumber

  // Feature 8: Audit — log the start of the operation
  if (options.enableAuditLog) {
    auditEntries.push(
      createAuditEntry('apply', `Starting Bates numbering for "${filename || 'document'}"`, {
        fileName: filename,
        pagesProcessed: 0,
      }),
    )
  }

  // Feature 6: Conflict detection
  const conflicts = await detectConflicts(pdfBuffer, options)

  if (conflicts.length > 0 && options.enableAuditLog) {
    const highConflicts = conflicts.filter((c) => c.confidence === 'high')
    auditEntries.push(
      createAuditEntry('conflict_detected', `Found ${conflicts.length} potential conflict(s), ${highConflicts.length} high confidence`, {
        fileName: filename,
      }),
    )
  }

  // Embed the font
  const font = await FONT_MAP[options.fontFamily](pdfDoc)

  // Determine which pages get Bates numbers based on scope
  const pagesToProcess: number[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (doesScopeApply(options.pageScope, i, totalPages, options.customPageRange)) {
      pagesToProcess.push(i)
    }
  }

  // Track the Bates numbers we assign
  let currentNumber = startNumber
  const assignedBates: string[] = []
  let pagesProcessed = 0

  // Apply Bates numbers to each applicable page
  for (const pageNum of pagesToProcess) {
    const pageIndex = pageNum - 1
    if (pageIndex < 0 || pageIndex >= totalPages) continue

    const page = pdfDoc.getPage(pageIndex)
    const { width: pageWidth, height: pageHeight } = page.getSize()

    // Generate the Bates label for this page
    const batesLabel = generateBatesLabel(options, currentNumber)
    assignedBates.push(batesLabel)

    // Measure text dimensions
    const textWidth = font.widthOfTextAtSize(batesLabel, options.fontSize)
    const textHeight = font.heightAtSize(options.fontSize)

    // Calculate position
    const { x, y } = calculateBatesPosition(
      options.position,
      pageWidth,
      pageHeight,
      textWidth,
      textHeight,
      options.margins,
      options.marginX,
      options.marginY,
    )

    // Draw the Bates number text
    page.drawText(batesLabel, {
      x,
      y,
      size: options.fontSize,
      font,
      color: rgb(options.fontColor.r, options.fontColor.g, options.fontColor.b),
      opacity: options.opacity,
    })

    // Feature: Border/box around Bates number
    drawBatesBorder(
      page,
      x,
      y,
      textWidth,
      textHeight,
      options.borderStyle,
      options.borderColor,
      options.opacity,
    )

    currentNumber++
    pagesProcessed++
  }

  // Build the Bates range string
  const firstBatesNumber = assignedBates.length > 0 ? assignedBates[0] : ''
  const lastBatesNumber = assignedBates.length > 0 ? assignedBates[assignedBates.length - 1] : ''
  const batesRange = firstBatesNumber && lastBatesNumber
    ? firstBatesNumber === lastBatesNumber
      ? firstBatesNumber
      : `${firstBatesNumber} to ${lastBatesNumber}`
    : ''

  // Save the modified PDF
  const outputBytes = await pdfDoc.save({ useObjectStreams: true })
  const outputBuffer = Buffer.from(outputBytes)

  // Build operations log
  operations.push({
    type: 'bates_apply',
    description: `Applied Bates numbering "${batesRange}" to ${pagesProcessed} page(s)`,
    itemsProcessed: pagesProcessed,
  })

  if (options.dateFormat && options.dateFormat !== 'none') {
    operations.push({
      type: 'date_prefix',
      description: `Used date prefix with format "${options.dateFormat}"`,
      itemsProcessed: pagesProcessed,
    })
  }

  if (options.prefix) {
    operations.push({
      type: 'custom_prefix',
      description: `Used custom prefix "${options.prefix}"`,
      itemsProcessed: pagesProcessed,
    })
  }

  if (conflicts.length > 0) {
    operations.push({
      type: 'conflict_detection',
      description: `Detected ${conflicts.length} potential conflict(s) before applying`,
      itemsProcessed: conflicts.length,
    })
  }

  // Feature 8: Audit — log the completion
  if (options.enableAuditLog) {
    auditEntries.push(
      createAuditEntry('apply', `Completed Bates numbering: ${batesRange}`, {
        fileName: filename,
        batesRange,
        pagesProcessed,
      }),
    )
  }

  return {
    outputBuffer,
    originalSize,
    outputSize: outputBuffer.length,
    sizeIncrease: outputBuffer.length - originalSize,
    pagesProcessed,
    totalPages,
    batesRange,
    firstBatesNumber,
    lastBatesNumber,
    conflicts,
    auditEntries,
    operations,
    durationMs: Date.now() - startTime,
  }
}

// ─── Preview / Analysis ──────────────────────────────────────────────────────

/**
 * Analyze a PDF for Bates numbering potential without actually applying stamps.
 * Returns a preview with estimated ranges, conflicts, and configuration summary.
 */
export async function analyzeBatesPotential(
  pdfBuffer: Buffer,
  options: BatesOptions,
  filename?: string,
  globalStartNumber?: number,
): Promise<BatesPreview> {
  let totalPages = 0

  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    })
    totalPages = pdfDoc.getPageCount()
  } catch {
    // Use 0 as fallback
  }

  const startNumber = globalStartNumber ?? options.startNumber

  // Determine pages in scope
  const pagesToProcess: number[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (doesScopeApply(options.pageScope, i, totalPages, options.customPageRange)) {
      pagesToProcess.push(i)
    }
  }
  const numPagesToProcess = pagesToProcess.length

  // Generate preview labels
  const firstLabel = generateBatesLabel(options, startNumber)
  const lastLabel = generateBatesLabel(options, startNumber + numPagesToProcess - 1)
  const batesRange = firstLabel === lastLabel
    ? firstLabel
    : `${firstLabel} to ${lastLabel}`

  // Feature 6: Conflict detection
  const conflicts = await detectConflicts(pdfBuffer, options)

  // Collect dynamic variables that would be used
  const dynamicVariables: string[] = []
  if (options.dateFormat && options.dateFormat !== 'none') {
    dynamicVariables.push('{date}')
    dynamicVariables.push(`{date:${options.dateFormat}}`)
  }
  if (options.prefix) {
    dynamicVariables.push('{bates_prefix}')
  }
  dynamicVariables.push('{bates}')
  dynamicVariables.push('{bates_number}')
  if (options.suffix) {
    dynamicVariables.push('{bates_suffix}')
  }
  dynamicVariables.push('{page}')
  dynamicVariables.push('{total_pages}')

  // Estimate size increase: text per page + font overhead
  const textOverheadPerPage = 200 // approximate bytes per Bates stamp
  const fontOverhead = 8000 // approximate bytes for standard font embedding
  const estimatedSizeIncrease = fontOverhead + numPagesToProcess * textOverheadPerPage

  // Build config summary
  const parts: string[] = []
  parts.push(`Position: ${options.position}`)
  parts.push(`Format: ${options.numberFormat}`)
  parts.push(`Prefix: "${options.prefix || '(none)'}"`)
  if (options.dateFormat && options.dateFormat !== 'none') parts.push(`Date prefix: ${options.dateFormat}`)
  parts.push(`Scope: ${options.pageScope}`)
  parts.push(`Font: ${options.fontFamily} ${options.fontSize}pt`)
  if (options.borderStyle !== 'none') parts.push(`Border: ${options.borderStyle}`)
  const configSummary = parts.join(' | ')

  return {
    totalPages,
    pagesToProcess: numPagesToProcess,
    firstPagePreview: firstLabel,
    lastPagePreview: lastLabel,
    batesRange,
    conflicts,
    dynamicVariables,
    estimatedSizeIncrease,
    configSummary,
    hasDatePrefix: !!options.dateFormat && options.dateFormat !== 'none',
    hasCustomPrefix: !!options.prefix,
    sequenceMode: options.sequenceMode,
  }
}

// ─── Batch Processing (Feature 7 + Feature 3) ───────────────────────────────

/**
 * Apply Bates numbering to multiple PDF documents with a shared sequential counter.
 *
 * When sequenceMode is 'continue-across-docs', the counter continues from document
 * to document. When 'restart-per-doc', each document starts from startNumber.
 */
export async function batchApplyBatesNumber(
  pdfBuffers: Array<{ id: string; name: string; buffer: Buffer }>,
  options: BatesOptions,
): Promise<BatchBatesResult> {
  const results: BatchBatesResult['results'] = []
  const auditEntries: BatesAuditEntry[] = []
  let globalCounter = options.startNumber
  let totalSizeIncrease = 0
  let totalPagesProcessed = 0
  let globalFirstBates = ''
  let globalLastBates = ''
  let successCount = 0
  let errorCount = 0

  // Feature 8: Audit — log batch start
  if (options.enableAuditLog) {
    auditEntries.push(
      createAuditEntry('apply', `Starting batch Bates numbering for ${pdfBuffers.length} document(s)`, {
        fileName: '(batch)',
        pagesProcessed: 0,
      }),
    )
  }

  for (const { id, name, buffer } of pdfBuffers) {
    try {
      const result = await applyBatesNumber(buffer, options, name, globalCounter)

      results.push({
        fileId: id,
        fileName: name,
        success: true,
        sizeIncrease: result.sizeIncrease,
        pagesProcessed: result.pagesProcessed,
        batesRange: result.batesRange,
        firstBatesNumber: result.firstBatesNumber,
        lastBatesNumber: result.lastBatesNumber,
      })

      // Feature 3: Multi-document sequence continuation
      if (options.sequenceMode === 'continue-across-docs') {
        globalCounter += result.pagesProcessed
      }
      // 'restart-per-doc': globalCounter stays at options.startNumber

      totalSizeIncrease += result.sizeIncrease
      totalPagesProcessed += result.pagesProcessed
      successCount++

      // Track global range
      if (!globalFirstBates && result.firstBatesNumber) {
        globalFirstBates = result.firstBatesNumber
      }
      if (result.lastBatesNumber) {
        globalLastBates = result.lastBatesNumber
      }

      // Merge audit entries
      if (result.auditEntries.length > 0) {
        auditEntries.push(...result.auditEntries)
      }
    } catch (error: any) {
      errorCount++
      results.push({
        fileId: id,
        fileName: name,
        success: false,
        error: error.message || 'Bates numbering failed',
      })

      if (options.enableAuditLog) {
        auditEntries.push(
          createAuditEntry('apply', `Failed to process "${name}": ${error.message || 'Unknown error'}`, {
            fileName: name,
          }),
        )
      }
    }
  }

  const globalBatesRange = globalFirstBates && globalLastBates
    ? globalFirstBates === globalLastBates
      ? globalFirstBates
      : `${globalFirstBates} to ${globalLastBates}`
    : ''

  // Feature 8: Audit — log batch completion
  if (options.enableAuditLog) {
    auditEntries.push(
      createAuditEntry('apply', `Completed batch: ${successCount} success, ${errorCount} error(s), global range: ${globalBatesRange || 'N/A'}`, {
        fileName: '(batch)',
        batesRange: globalBatesRange,
        pagesProcessed: totalPagesProcessed,
      }),
    )
  }

  return {
    results,
    auditEntries,
    summary: {
      total: pdfBuffers.length,
      success: successCount,
      errors: errorCount,
      totalSizeIncrease,
      totalPagesProcessed,
      globalBatesRange,
    },
  }
}

// ─── Undo Support (Feature 9) ───────────────────────────────────────────────

/**
 * Remove Bates numbering stamps from a previously processed PDF.
 *
 * Since pdf-lib cannot selectively remove drawn elements, this uses a "cover"
 * approach: it draws a white rectangle over the area where the Bates stamp
 * would appear, effectively hiding it.
 *
 * @param pdfBuffer - The PDF with existing Bates stamps
 * @param batesInfo - Information about the Bates stamps to remove
 * @returns BatesResult with the cleaned PDF
 */
export async function removeBatesNumber(
  pdfBuffer: Buffer,
  batesInfo: {
    prefix: string
    numberFormat: BatesNumberFormat
    position: BatesPosition
  },
): Promise<BatesResult> {
  const startTime = Date.now()
  const originalSize = pdfBuffer.length
  const auditEntries: BatesAuditEntry[] = []
  const operations: BatesOperation[] = []

  // Load the PDF
  const pdfDoc = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
    updateMetadata: false,
  })
  const totalPages = pdfDoc.getPageCount()

  // We need a font to measure text dimensions for cover rectangle
  const font = await FONT_MAP.CourierBold(pdfDoc)

  // Audit: log the start
  auditEntries.push(
    createAuditEntry('undo', `Starting Bates number removal for ${totalPages} page(s)`, {
      pagesProcessed: 0,
    }),
  )

  let pagesProcessed = 0

  // Cover rectangles on each page
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const page = pdfDoc.getPage(pageIndex)
    const { width: pageWidth, height: pageHeight } = page.getSize()

    // We need to guess what the Bates text was to size the cover rectangle.
    // Since we don't know the exact options, we generate a representative label
    // using a plausible number and use it for width estimation.
    // We'll use a wider estimate to ensure we cover the stamp.
    const estimateNumber = batesInfo.numberFormat.length > 1
      ? parseInt('9'.repeat(batesInfo.numberFormat.length), 10)
      : 9999
    const estimateLabel = batesInfo.prefix
      ? `${batesInfo.prefix}-${'9'.repeat(batesInfo.numberFormat.length)}`
      : '9'.repeat(Math.max(batesInfo.numberFormat.length, 4))

    // Use a generous font size estimate
    const estimatedFontSize = 10
    const textWidth = font.widthOfTextAtSize(estimateLabel, estimatedFontSize)
    const textHeight = font.heightAtSize(estimatedFontSize)

    // Calculate the position using default margins
    const margins = { top: 30, bottom: 30, left: 40, right: 40 }
    const { x, y } = calculateBatesPosition(
      batesInfo.position,
      pageWidth,
      pageHeight,
      textWidth,
      textHeight,
      margins,
      0,
      0,
    )

    // Draw a white rectangle to cover the Bates stamp
    const padding = 4
    page.drawRectangle({
      x: x - padding,
      y: y - padding,
      width: textWidth + padding * 2,
      height: textHeight + padding * 2,
      color: rgb(1, 1, 1), // White
      opacity: 1,
      borderWidth: 0,
    })

    pagesProcessed++
  }

  // Save
  const outputBytes = await pdfDoc.save({ useObjectStreams: true })
  const outputBuffer = Buffer.from(outputBytes)

  operations.push({
    type: 'bates_undo',
    description: `Removed Bates stamps from ${pagesProcessed} page(s) by covering with white rectangles`,
    itemsProcessed: pagesProcessed,
  })

  // Audit: log completion
  auditEntries.push(
    createAuditEntry('undo', `Completed Bates number removal for ${pagesProcessed} page(s)`, {
      pagesProcessed,
    }),
  )

  return {
    outputBuffer,
    originalSize,
    outputSize: outputBuffer.length,
    sizeIncrease: outputBuffer.length - originalSize,
    pagesProcessed,
    totalPages,
    batesRange: '',
    firstBatesNumber: '',
    lastBatesNumber: '',
    conflicts: [],
    auditEntries,
    operations,
    durationMs: Date.now() - startTime,
  }
}

// ─── Template Helper (Feature 4) ─────────────────────────────────────────────

/**
 * Convert a BatesTemplate (which has partial options) into a full BatesOptions
 * object by merging with defaults.
 */
export function templateToOptions(template: BatesTemplate): BatesOptions {
  const defaults = getDefaultBatesOptionsFromTypes()

  return {
    prefix: template.options.prefix ?? defaults.prefix,
    dateFormat: template.options.dateFormat ?? defaults.dateFormat,
    dateSeparator: template.options.dateSeparator ?? defaults.dateSeparator,
    startNumber: template.options.startNumber ?? defaults.startNumber,
    numberFormat: template.options.numberFormat ?? defaults.numberFormat,
    suffix: template.options.suffix ?? defaults.suffix,
    position: template.options.position ?? defaults.position,
    marginX: template.options.marginX ?? defaults.marginX,
    marginY: template.options.marginY ?? defaults.marginY,
    fontSize: template.options.fontSize ?? defaults.fontSize,
    fontColor: template.options.fontColor ?? defaults.fontColor,
    fontFamily: template.options.fontFamily ?? defaults.fontFamily,
    opacity: template.options.opacity ?? defaults.opacity,
    pageScope: template.options.pageScope ?? defaults.pageScope,
    customPageRange: template.options.customPageRange ?? defaults.customPageRange,
    borderStyle: template.options.borderStyle ?? defaults.borderStyle,
    borderColor: template.options.borderColor ?? defaults.borderColor,
    sequenceMode: template.options.sequenceMode ?? defaults.sequenceMode,
    enableAuditLog: template.options.enableAuditLog ?? defaults.enableAuditLog,
    preserveOriginal: template.options.preserveOriginal ?? defaults.preserveOriginal,
    margins: template.options.margins ?? defaults.margins,
  }
}

/**
 * Internal helper to get default BatesOptions.
 * Uses the same values as getDefaultBatesOptions() from the types file,
 * but avoids circular imports when the types file function is not available.
 */
function getDefaultBatesOptionsFromTypes(): BatesOptions {
  return {
    prefix: 'BATES',
    dateFormat: 'none',
    dateSeparator: '-',
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
