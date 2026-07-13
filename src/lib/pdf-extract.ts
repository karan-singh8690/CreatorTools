/**
 * PDF Structured Text Extraction Engine — Production-Grade
 * 
 * Extracts text from PDFs with full structure preservation:
 * - Formatting (bold, italic, font sizes)
 * - Heading detection (by font size heuristics)
 * - Table detection (by positional analysis)
 * - List detection (bullet/numbered patterns)
 * - Hyperlink extraction (from PDF annotations)
 * - Page break markers
 * - Multi-language support (Unicode/Latin/CJK)
 * 
 * Exports to: Structured JSON, Markdown, HTML
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ElementType =
  | 'heading1' | 'heading2' | 'heading3' | 'heading4'
  | 'paragraph'
  | 'table'
  | 'list_item'
  | 'link'
  | 'page_break'
  | 'image_placeholder'

export type ExportFormat = 'json' | 'markdown' | 'html'

export interface TextStyle {
  fontSize: number
  fontName: string
  isBold: boolean
  isItalic: boolean
  color: string | null
}

export interface ExtractedElement {
  type: ElementType
  content: string
  style?: TextStyle
  level?: number          // For headings (1-4)
  href?: string           // For links
  items?: string[]        // For table rows
  rows?: string[][]       // For tables
  listMarker?: string     // •, -, 1., a), etc.
  pageNumber: number
  position?: {            // Bounding box
    x: number
    y: number
    width: number
    height: number
  }
}

export interface ExtractedPage {
  pageNumber: number
  width: number
  height: number
  elements: ExtractedElement[]
}

export interface ExtractionResult {
  pages: ExtractedPage[]
  metadata: {
    title?: string
    author?: string
    subject?: string
    creator?: string
    producer?: string
    creationDate?: string
    pageCount: number
    language: string
    totalElements: number
    headingCount: number
    tableCount: number
    linkCount: number
    listCount: number
  }
  durationMs: number
}

export interface TextItem {
  str: string
  dir: string
  width: number
  height: number
  transform: number[]
  fontName: string
  hasEOL: boolean
}

// ─── Heading Detection ───────────────────────────────────────────────────────

/**
 * Detect heading level based on font size relative to body text.
 * Uses statistical analysis of the document's font sizes.
 */
function detectHeadingLevel(
  fontSize: number,
  dominantFontSize: number
): ElementType | null {
  const ratio = fontSize / dominantFontSize

  if (ratio >= 2.0) return 'heading1'
  if (ratio >= 1.6) return 'heading2'
  if (ratio >= 1.3) return 'heading3'
  if (ratio >= 1.1 && fontSize > dominantFontSize) return 'heading4'

  return null
}

/**
 * Determine the dominant (body) font size across all pages.
 */
function findDominantFontSize(textItems: TextItem[]): number {
  const sizeCounts = new Map<number, number>()

  for (const item of textItems) {
    if (!item.str.trim()) continue
    const size = Math.round(item.transform[0] * 10) / 10 // Font size from transform matrix
    if (size > 0) {
      sizeCounts.set(size, (sizeCounts.get(size) || 0) + item.str.length)
    }
  }

  // The most common size by total character count is the body text size
  let dominantSize = 12
  let maxChars = 0
  for (const [size, chars] of sizeCounts) {
    if (chars > maxChars) {
      maxChars = chars
      dominantSize = size
    }
  }

  return dominantSize
}

// ─── Style Detection ─────────────────────────────────────────────────────────

function detectStyle(item: TextItem): TextStyle {
  const fontSize = Math.abs(item.transform[0]) || 12
  const fontName = item.fontName || ''
  const lowerFont = fontName.toLowerCase()

  return {
    fontSize: Math.round(fontSize * 10) / 10,
    fontName,
    isBold: lowerFont.includes('bold') || lowerFont.includes('black') || lowerFont.includes('heavy'),
    isItalic: lowerFont.includes('italic') || lowerFont.includes('oblique'),
    color: null,
  }
}

// ─── List Detection ──────────────────────────────────────────────────────────

const BULLET_PATTERNS = /^[•●○◆▪▸►–—·]\s*/
const NUMBERED_PATTERNS = /^(\d+[\.\)]\s|[\(]?\d+[)\.]\s|[ivxIVX]+[\.\)]\s|[a-zA-Z][\.\)]\s)/
const DASH_PATTERNS = /^[-–—]\s+/

function detectListItem(text: string): { isListItem: boolean; marker: string; content: string } {
  let match = text.match(BULLET_PATTERNS)
  if (match) {
    return { isListItem: true, marker: match[0].trim(), content: text.replace(BULLET_PATTERNS, '') }
  }

  match = text.match(NUMBERED_PATTERNS)
  if (match) {
    return { isListItem: true, marker: match[0].trim(), content: text.replace(NUMBERED_PATTERNS, '') }
  }

  match = text.match(DASH_PATTERNS)
  if (match) {
    return { isListItem: true, marker: '-', content: text.replace(DASH_PATTERNS, '') }
  }

  return { isListItem: false, marker: '', content: text }
}

// ─── Table Detection ─────────────────────────────────────────────────────────

/**
 * Detect table-like structures by analyzing text positions.
 * Items aligned in rows/columns suggest a table.
 */
function detectTables(
  items: Array<{ str: string; x: number; y: number; width: number; height: number; fontSize: number }>,
  pageWidth: number
): string[][] | null {
  if (items.length < 4) return null

  // Group items by Y position (rows) with tolerance
  const ROW_TOLERANCE = 3
  const rows = new Map<number, typeof items>()

  for (const item of items) {
    const roundedY = Math.round(item.y / ROW_TOLERANCE) * ROW_TOLERANCE
    if (!rows.has(roundedY)) rows.set(roundedY, [])
    rows.get(roundedY)!.push(item)
  }

  const sortedRows = [...rows.entries()]
    .sort((a, b) => b[0] - a[0]) // Y is inverted in PDF coords
    .map(([, items]) => items.sort((a, b) => a.x - b.x))

  // A table needs at least 2 rows with 2+ columns each
  const tableRows = sortedRows.filter(row => row.length >= 2)
  if (tableRows.length < 2) return null

  // Check column alignment consistency
  const colPositions = tableRows.map(row => row.map(item => Math.round(item.x)))
  const firstRowCols = colPositions[0]
  
  // At least 60% of rows should have similar column positions
  let alignedRowCount = 0
  for (const rowCols of colPositions) {
    if (rowCols.length === firstRowCols.length) alignedRowCount++
  }

  if (alignedRowCount / tableRows.length < 0.6) return null

  // Build table data
  return tableRows.map(row => row.map(item => item.str.trim()))
}

// ─── Language Detection ──────────────────────────────────────────────────────

function detectLanguage(text: string): string {
  if (!text || text.length < 10) return 'en'

  // CJK detection
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const hiraganaKatakana = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length
  const hangul = (text.match(/[\uac00-\ud7af\u1100-\u11ff]/g) || []).length
  const arabic = (text.match(/[\u0600-\u06ff]/g) || []).length
  const cyrillic = (text.match(/[\u0400-\u04ff]/g) || []).length
  const thai = (text.match(/[\u0e00-\u0e7f]/g) || []).length
  const devanagari = (text.match(/[\u0900-\u097f]/g) || []).length

  const totalChars = text.replace(/\s/g, '').length
  if (totalChars === 0) return 'en'

  if (cjkChars / totalChars > 0.3) return 'zh'
  if (hiraganaKatakana / totalChars > 0.1) return 'ja'
  if (hangul / totalChars > 0.3) return 'ko'
  if (arabic / totalChars > 0.3) return 'ar'
  if (cyrillic / totalChars > 0.3) return 'ru'
  if (thai / totalChars > 0.3) return 'th'
  if (devanagari / totalChars > 0.3) return 'hi'

  return 'en'
}

// ─── Main Extraction Pipeline ────────────────────────────────────────────────

/**
 * Extract structured text from a PDF buffer.
 * 
 * Pipeline:
 * 1. Load PDF with pdfjs-dist
 * 2. For each page, extract text items with positions and styles
 * 3. Detect headings, lists, tables, links
 * 4. Build structured elements
 * 5. Return rich extraction result
 */
export async function extractStructuredText(pdfBuffer: Buffer): Promise<ExtractionResult> {
  const startTime = Date.now()

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(pdfBuffer)
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise

  const pages: ExtractedPage[] = []
  let totalElements = 0
  let headingCount = 0
  let tableCount = 0
  let linkCount = 0
  let listCount = 0
  let allText = ''

  // First pass: find dominant font size
  const allItems: TextItem[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent()
    for (const item of textContent.items) {
      if ('str' in item && (item as any).str) {
        allItems.push(item as TextItem)
      }
    }
  }
  const dominantFontSize = findDominantFontSize(allItems)

  // Second pass: extract structured content
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent()
    const elements: ExtractedElement[] = []

    // Collect positioned text items for this page
    const pageItems: Array<{
      str: string
      x: number
      y: number
      width: number
      height: number
      fontSize: number
      fontName: string
      style: TextStyle
      hasEOL: boolean
      item: any
    }> = []

    for (const item of textContent.items) {
      if (!('str' in item) || !(item as any).str?.trim()) continue

      const tx = item as any
      const transform = tx.transform
      const fontSize = Math.abs(transform[0]) || 12
      const x = transform[4]
      const y = viewport.height - transform[5] // Flip Y coordinate

      pageItems.push({
        str: tx.str,
        x,
        y,
        width: tx.width || fontSize * tx.str.length * 0.6,
        height: fontSize,
        fontSize,
        fontName: tx.fontName || '',
        style: detectStyle(tx),
        hasEOL: tx.hasEOL || false,
        item: tx,
      })
    }

    // ── Extract hyperlinks from annotations ──
    let links: Array<{ url: string; rect: number[] }> = []
    try {
      const annotations = await page.getAnnotations()
      links = annotations
        .filter((ann: any) => ann.subtype === 'Link' && ann.url)
        .map((ann: any) => ({
          url: ann.url,
          rect: ann.rect,
        }))
    } catch {
      // Some pages don't have annotations
    }

    // ── Group text items into lines by Y position ──
    const LINE_TOLERANCE = 5
    const lineGroups = new Map<number, typeof pageItems>()

    for (const item of pageItems) {
      const roundedY = Math.round(item.y / LINE_TOLERANCE) * LINE_TOLERANCE
      if (!lineGroups.has(roundedY)) lineGroups.set(roundedY, [])
      lineGroups.get(roundedY)!.push(item)
    }

    // Sort lines top to bottom
    const sortedLines = [...lineGroups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x))

    // ── Process each line into structured elements ──
    let previousY = -1
    let inTableRegion = false
    let tableRows: string[][] = []
    let tableStartY = 0

    for (const lineItems of sortedLines) {
      const lineText = lineItems.map(it => it.str).join(' ').trim()
      if (!lineText) continue

      const avgFontSize = lineItems.reduce((s, it) => s + it.fontSize, 0) / lineItems.length
      const lineY = lineItems[0].y
      const style = lineItems[0].style

      // Check for page break (large Y gap)
      if (previousY > 0 && Math.abs(lineY - previousY) > avgFontSize * 3) {
        // If we were collecting table rows, flush the table
        if (inTableRegion && tableRows.length >= 2) {
          elements.push({
            type: 'table',
            content: tableRows.map(row => row.join(' | ')).join('\n'),
            rows: tableRows,
            pageNumber: i,
          })
          tableCount++
          totalElements++
        }
        tableRows = []
        inTableRegion = false
      }
      previousY = lineY

      // ── Detect heading ──
      const headingType = detectHeadingLevel(avgFontSize, dominantFontSize)
      if (headingType) {
        // Flush any pending table
        if (inTableRegion && tableRows.length >= 2) {
          elements.push({
            type: 'table',
            content: tableRows.map(row => row.join(' | ')).join('\n'),
            rows: tableRows,
            pageNumber: i,
          })
          tableCount++
          totalElements++
          tableRows = []
          inTableRegion = false
        }

        const level = parseInt(headingType.replace('heading', ''))
        elements.push({
          type: headingType,
          content: lineText,
          level,
          style,
          pageNumber: i,
        })
        headingCount++
        totalElements++
        allText += lineText + ' '
        continue
      }

      // ── Detect list item ──
      const listCheck = detectListItem(lineText)
      if (listCheck.isListItem) {
        if (inTableRegion && tableRows.length >= 2) {
          elements.push({
            type: 'table',
            content: tableRows.map(row => row.join(' | ')).join('\n'),
            rows: tableRows,
            pageNumber: i,
          })
          tableCount++
          totalElements++
          tableRows = []
          inTableRegion = false
        }

        elements.push({
          type: 'list_item',
          content: listCheck.content,
          listMarker: listCheck.marker,
          style,
          pageNumber: i,
        })
        listCount++
        totalElements++
        allText += listCheck.content + ' '
        continue
      }

      // ── Detect hyperlink ──
      const linkForLine = links.find(link => {
        const [x1, y1, x2, y2] = link.rect
        const flippedY1 = viewport.height - y2
        const flippedY2 = viewport.height - y1
        return lineY >= flippedY1 - 5 && lineY <= flippedY2 + 5
      })

      if (linkForLine) {
        elements.push({
          type: 'link',
          content: lineText,
          href: linkForLine.url,
          style,
          pageNumber: i,
        })
        linkCount++
        totalElements++
        allText += lineText + ' '
        continue
      }

      // ── Table detection: check if line has multiple columns ──
      if (lineItems.length >= 2) {
        const gaps: number[] = []
        for (let j = 1; j < lineItems.length; j++) {
          const gap = lineItems[j].x - (lineItems[j - 1].x + lineItems[j - 1].width)
          gaps.push(gap)
        }

        // Large gaps between items suggest columns
        const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length
        if (avgGap > avgFontSize * 1.5) {
          inTableRegion = true
          tableStartY = lineY
          tableRows.push(lineItems.map(it => it.str.trim()))
          continue // Don't add as paragraph yet — might be part of table
        }
      }

      // ── Flush table if we're no longer in a table region ──
      if (inTableRegion) {
        if (tableRows.length >= 2) {
          elements.push({
            type: 'table',
            content: tableRows.map(row => row.join(' | ')).join('\n'),
            rows: tableRows,
            pageNumber: i,
          })
          tableCount++
          totalElements++
        }
        tableRows = []
        inTableRegion = false
      }

      // ── Regular paragraph ──
      elements.push({
        type: 'paragraph',
        content: lineText,
        style,
        pageNumber: i,
      })
      totalElements++
      allText += lineText + ' '
    }

    // Flush any remaining table
    if (inTableRegion && tableRows.length >= 2) {
      elements.push({
        type: 'table',
        content: tableRows.map(row => row.join(' | ')).join('\n'),
        rows: tableRows,
        pageNumber: i,
      })
      tableCount++
      totalElements++
    }

    // Add page break marker (except for last page)
    if (i < doc.numPages) {
      elements.push({
        type: 'page_break',
        content: `--- Page ${i} / ${doc.numPages} ---`,
        pageNumber: i,
      })
      totalElements++
    }

    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      elements,
    })
  }

  // ── Extract metadata ──
  let metadata: ExtractionResult['metadata'] = {
    pageCount: doc.numPages,
    language: detectLanguage(allText),
    totalElements,
    headingCount,
    tableCount,
    linkCount,
    listCount,
  }

  try {
    const pdfMetadata = await doc.getMetadata()
    const info = pdfMetadata.info as any
    metadata = {
      ...metadata,
      title: info?.Title || undefined,
      author: info?.Author || undefined,
      subject: info?.Subject || undefined,
      creator: info?.Creator || undefined,
      producer: info?.Producer || undefined,
      creationDate: info?.CreationDate || undefined,
    }
  } catch {
    // Non-critical
  }

  await doc.destroy()

  return {
    pages,
    metadata,
    durationMs: Date.now() - startTime,
  }
}

// ─── Export Formatters ───────────────────────────────────────────────────────

/** Export structured extraction result as Markdown */
export function exportToMarkdown(result: ExtractionResult): string {
  const lines: string[] = []

  // Title from metadata
  if (result.metadata.title) {
    lines.push(`# ${result.metadata.title}`)
    lines.push('')
  }

  // Metadata header
  if (result.metadata.author || result.metadata.creationDate) {
    lines.push('> ' + [
      result.metadata.author && `Author: ${result.metadata.author}`,
      result.metadata.creationDate && `Date: ${result.metadata.creationDate}`,
      `Pages: ${result.metadata.pageCount}`,
      `Language: ${result.metadata.language}`,
    ].filter(Boolean).join(' | '))
    lines.push('')
  }

  for (const page of result.pages) {
    for (const el of page.elements) {
      switch (el.type) {
        case 'heading1':
          lines.push(`# ${el.content}`)
          lines.push('')
          break
        case 'heading2':
          lines.push(`## ${el.content}`)
          lines.push('')
          break
        case 'heading3':
          lines.push(`### ${el.content}`)
          lines.push('')
          break
        case 'heading4':
          lines.push(`#### ${el.content}`)
          lines.push('')
          break
        case 'paragraph':
          lines.push(el.content)
          lines.push('')
          break
        case 'list_item':
          lines.push(`${el.listMarker || '-'} ${el.content}`)
          break
        case 'table':
          if (el.rows && el.rows.length > 0) {
            // Header row
            lines.push('| ' + el.rows[0].join(' | ') + ' |')
            lines.push('| ' + el.rows[0].map(() => '---').join(' | ') + ' |')
            // Data rows
            for (let r = 1; r < el.rows.length; r++) {
              lines.push('| ' + el.rows[r].join(' | ') + ' |')
            }
            lines.push('')
          }
          break
        case 'link':
          lines.push(`[${el.content}](${el.href})`)
          lines.push('')
          break
        case 'page_break':
          lines.push(`\n---\n`)
          break
      }
    }
  }

  return lines.join('\n')
}

/** Export structured extraction result as HTML */
export function exportToHTML(result: ExtractionResult): string {
  const parts: string[] = []

  parts.push('<!DOCTYPE html>')
  parts.push('<html lang="' + result.metadata.language + '">')
  parts.push('<head>')
  parts.push('<meta charset="UTF-8">')
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">')
  if (result.metadata.title) parts.push(`<title>${escapeHTML(result.metadata.title)}</title>`)
  parts.push('<style>')
  parts.push('body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #333; }')
  parts.push('table { border-collapse: collapse; width: 100%; margin: 1rem 0; }')
  parts.push('th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }')
  parts.push('th { background: #f5f5f5; font-weight: 600; }')
  parts.push('.page-break { border-top: 2px dashed #ccc; margin: 2rem 0; padding-top: 0.5rem; color: #999; font-size: 0.8em; }')
  parts.push('a { color: #4A90D9; }')
  parts.push('.meta { color: #666; font-size: 0.9em; margin-bottom: 2rem; }')
  parts.push('</style>')
  parts.push('</head>')
  parts.push('<body>')

  if (result.metadata.title) {
    parts.push(`<h1>${escapeHTML(result.metadata.title)}</h1>`)
  }

  if (result.metadata.author || result.metadata.creationDate) {
    parts.push('<div class="meta">')
    if (result.metadata.author) parts.push(`<span>Author: ${escapeHTML(result.metadata.author)}</span> · `)
    parts.push(`<span>Pages: ${result.metadata.pageCount}</span> · `)
    parts.push(`<span>Language: ${result.metadata.language}</span>`)
    parts.push('</div>')
  }

  for (const page of result.pages) {
    for (const el of page.elements) {
      switch (el.type) {
        case 'heading1':
          parts.push(`<h1>${formatHTML(el)}</h1>`)
          break
        case 'heading2':
          parts.push(`<h2>${formatHTML(el)}</h2>`)
          break
        case 'heading3':
          parts.push(`<h3>${formatHTML(el)}</h3>`)
          break
        case 'heading4':
          parts.push(`<h4>${formatHTML(el)}</h4>`)
          break
        case 'paragraph':
          parts.push(`<p>${formatHTML(el)}</p>`)
          break
        case 'list_item':
          parts.push(`<li>${escapeHTML(el.content)}</li>`)
          break
        case 'table':
          if (el.rows && el.rows.length > 0) {
            parts.push('<table>')
            parts.push('<thead><tr>' + el.rows[0].map(c => `<th>${escapeHTML(c)}</th>`).join('') + '</tr></thead>')
            parts.push('<tbody>')
            for (let r = 1; r < el.rows.length; r++) {
              parts.push('<tr>' + el.rows[r].map(c => `<td>${escapeHTML(c)}</td>`).join('') + '</tr>')
            }
            parts.push('</tbody></table>')
          }
          break
        case 'link':
          parts.push(`<p><a href="${escapeHTML(el.href || '#')}" target="_blank">${escapeHTML(el.content)}</a></p>`)
          break
        case 'page_break':
          parts.push(`<div class="page-break">Page ${el.pageNumber}</div>`)
          break
      }
    }
  }

  parts.push('</body>')
  parts.push('</html>')

  return parts.join('\n')
}

/** Export structured extraction result as JSON */
export function exportToJSON(result: ExtractionResult): string {
  return JSON.stringify(result, null, 2)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatHTML(el: ExtractedElement): string {
  let text = escapeHTML(el.content)
  if (el.style?.isBold) text = `<strong>${text}</strong>`
  if (el.style?.isItalic) text = `<em>${text}</em>`
  return text
}
