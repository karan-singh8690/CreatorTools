/**
 * PDF Header & Footer Engine — Professional-Grade
 *
 * Implements Adobe/SmallPDF-level header/footer management with:
 * 1. Dynamic variables ({filename}, {author}, {title}, etc.)
 * 2. Date/time placeholders ({date}, {time}, {datetime}, custom formats)
 * 3. Total page count ({total_pages}, {page}, {page_of_total})
 * 4. Custom templates (save/load header-footer configurations)
 * 5. Rich text formatting (bold, italic, font size, color, font family per segment)
 * 6. Logos (image in header/footer area)
 * 7. Different first page (separate header/footer for page 1)
 * 8. Odd/even page support (different content for odd vs even pages)
 * 9. Live preview (fast estimation without full render)
 * 10. Bulk processing (multi-file application)
 */

import {
  PDFDocument,
  PDFPage,
  PDFFont,
  rgb,
  StandardFonts,
} from 'pdf-lib'
import sharp from 'sharp'

// Import shared types (safe for server-only — this file is never imported on client)
export type {
  HFFont,
  HFPosition,
  HFZone,
  HFPageScope,
  HFTextSegment,
  HFLogoConfig,
  HFContent,
  HFPageConfig,
  HFTemplate,
  HeaderFooterOptions,
  HeaderFooterPreview,
  HeaderFooterResult,
  HeaderFooterOperation,
  BatchHeaderFooterResult,
} from './pdf-header-footer-types'

export { BUILTIN_TEMPLATES, getDefaultHeaderFooterOptions } from './pdf-header-footer-types'

import type {
  HFFont,
  HFPosition,
  HFPageScope,
  HFTextSegment,
  HFContent,
  HFPageConfig,
  HFTemplate,
  HeaderFooterOptions,
  HeaderFooterPreview,
  HeaderFooterResult,
  HeaderFooterOperation,
  BatchHeaderFooterResult,
} from './pdf-header-footer-types'

// ─── Font Mapping ────────────────────────────────────────────────────────────

const FONT_MAP: Record<HFFont, (pdfDoc: PDFDocument) => Promise<PDFFont>> = {
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

// ─── Dynamic Variable Resolver ───────────────────────────────────────────────

interface DynamicContext {
  currentPage: number
  totalPages: number
  filename: string
  author?: string
  title?: string
  subject?: string
  creator?: string
  producer?: string
  company?: string
}

function resolveDynamicVariables(text: string, ctx: DynamicContext): string {
  const now = new Date()

  let result = text

  // Page number with optional zero-padding: {page:0001}
  result = result.replace(/\{page:(\d+)\}/g, (_match, fmt: string) => {
    return String(ctx.currentPage).padStart(fmt.length, '0')
  })
  result = result.replace('{page}', String(ctx.currentPage))
  result = result.replace('{total_pages}', String(ctx.totalPages))
  result = result.replace('{page_of_total}', `Page ${ctx.currentPage} of ${ctx.totalPages}`)

  // Date/time placeholders with custom formats
  result = result.replace('{date:YYYY-MM-DD}', formatDateCustom(now, 'YYYY-MM-DD'))
  result = result.replace('{date:MM/DD/YYYY}', formatDateCustom(now, 'MM/DD/YYYY'))
  result = result.replace('{date:DD/MM/YYYY}', formatDateCustom(now, 'DD/MM/YYYY'))
  result = result.replace('{date:YYYY}', String(now.getFullYear()))
  result = result.replace('{date:MM}', String(now.getMonth() + 1).padStart(2, '0'))
  result = result.replace('{date:DD}', String(now.getDate()).padStart(2, '0'))
  // Catch-all for any remaining {date:format} patterns
  result = result.replace(/\{date:([^}]+)\}/g, (_match, fmt: string) => {
    return formatDateCustom(now, fmt)
  })
  result = result.replace('{date}', formatDateCustom(now, 'YYYY-MM-DD'))
  result = result.replace('{time}', `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
  result = result.replace('{datetime}', formatDateCustom(now, 'YYYY-MM-DD') + ' ' + `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)

  // Document metadata
  result = result.replace('{filename}', ctx.filename || 'Untitled')
  result = result.replace('{author}', ctx.author || 'Unknown')
  result = result.replace('{title}', ctx.title || ctx.filename || 'Untitled')
  result = result.replace('{subject}', ctx.subject || '')
  result = result.replace('{creator}', ctx.creator || '')
  result = result.replace('{producer}', ctx.producer || '')
  result = result.replace('{company}', ctx.company || '')

  return result
}

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

function extractDynamicVariables(text: string): string[] {
  const matches = text.match(/\{[^}]+\}/g) || []
  return [...new Set(matches)]
}

// ─── Font Resolution ─────────────────────────────────────────────────────────

function resolveFontForSegment(
  segment: HFTextSegment,
  defaultFont: HFFont,
): HFFont {
  let fontName = segment.font || defaultFont

  if (segment.bold || segment.italic) {
    let baseFamily = 'Helvetica'
    if (fontName.startsWith('TimesRoman')) baseFamily = 'TimesRoman'
    else if (fontName.startsWith('Courier')) baseFamily = 'Courier'

    const isBold = segment.bold ?? fontName.includes('Bold')
    const isItalic = segment.italic ?? (fontName.includes('Oblique') || fontName.includes('Italic'))

    if (baseFamily === 'Helvetica') {
      if (isBold && isItalic) fontName = 'HelveticaBoldOblique'
      else if (isBold) fontName = 'HelveticaBold'
      else if (isItalic) fontName = 'HelveticaOblique'
      else fontName = 'Helvetica'
    } else if (baseFamily === 'TimesRoman') {
      if (isBold && isItalic) fontName = 'TimesRomanBoldItalic'
      else if (isBold) fontName = 'TimesRomanBold'
      else if (isItalic) fontName = 'TimesRomanItalic'
      else fontName = 'TimesRoman'
    } else if (baseFamily === 'Courier') {
      if (isBold && isItalic) fontName = 'CourierBoldOblique'
      else if (isBold) fontName = 'CourierBold'
      else if (isItalic) fontName = 'CourierOblique'
      else fontName = 'Courier'
    }
  }

  return fontName
}

// ─── Page Scope Matching ─────────────────────────────────────────────────────

function doesScopeApply(scope: HFPageScope, pageNum: number): boolean {
  switch (scope) {
    case 'all': return true
    case 'first-only': return pageNum === 1
    case 'not-first': return pageNum > 1
    case 'odd': return pageNum % 2 === 1
    case 'even': return pageNum % 2 === 0
    default: return true
  }
}

/**
 * Get the applicable header/footer config for a specific page.
 * More specific scopes override less specific ones for their zone.
 * Priority: first-only/not-first > odd/even > all
 */
function getApplicableConfig(
  pageNum: number,
  pageConfigs: HFPageConfig[],
): { header?: HFContent; footer?: HFContent } {
  let header: HFContent | undefined
  let footer: HFContent | undefined

  // Apply in order of specificity: all → odd/even → first-only/not-first
  for (const config of pageConfigs) {
    if (doesScopeApply(config.scope, pageNum)) {
      if (config.header) header = config.header
      if (config.footer) footer = config.footer
    }
  }

  return { header, footer }
}

// ─── Target Pages ────────────────────────────────────────────────────────────

function getTargetPages(
  totalPages: number,
  pageRange?: string,
  customPages?: number[],
): number[] {
  switch (pageRange) {
    case 'first': return [1]
    case 'last': return [totalPages]
    case 'custom':
      if (!customPages || customPages.length === 0) return Array.from({ length: totalPages }, (_, i) => i + 1)
      return customPages.filter((p) => p >= 1 && p <= totalPages)
    case 'all':
    default:
      return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
}

// ─── Image Optimization ──────────────────────────────────────────────────────

async function optimizeLogoImage(
  imageBuffer: Buffer,
  mimeType?: string,
  maxSize: number = 400,
): Promise<Buffer> {
  try {
    const metadata = await sharp(imageBuffer).metadata()
    const { width = maxSize, height = maxSize } = metadata

    if (width > maxSize || height > maxSize) {
      return await sharp(imageBuffer)
        .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 95 })
        .toBuffer()
    }

    if (mimeType === 'image/png') return imageBuffer
    return await sharp(imageBuffer).png({ quality: 95 }).toBuffer()
  } catch (error) {
    console.error('Logo optimization error:', error)
    return imageBuffer
  }
}

// ─── Preview / Analysis ──────────────────────────────────────────────────────

export async function analyzeHeaderFooterPotential(
  pdfBuffer: Buffer,
  options: HeaderFooterOptions,
  filename?: string,
): Promise<HeaderFooterPreview> {
  let totalPages = 0
  let title: string | undefined
  let author: string | undefined
  let subject: string | undefined
  let creator: string | undefined
  let producer: string | undefined

  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true, updateMetadata: false })
    totalPages = pdfDoc.getPageCount()
    title = pdfDoc.getTitle() || undefined
    author = pdfDoc.getAuthor() || undefined
    subject = pdfDoc.getSubject() || undefined
    creator = pdfDoc.getCreator() || undefined
    producer = pdfDoc.getProducer() || undefined
  } catch {
    // Use defaults
  }

  const targetPages = getTargetPages(totalPages, options.pageRange, options.customPages)
  let pagesWithHeaders = 0
  let pagesWithFooters = 0
  const allDynamicVars = new Set<string>()
  let firstPageHeaderPreview = ''
  let firstPageFooterPreview = ''
  let hasDifferentFirstPage = false
  let hasOddEven = false
  let hasLogo = false

  for (const pageNum of targetPages) {
    const config = getApplicableConfig(pageNum, options.pageConfigs)

    if (config.header) {
      pagesWithHeaders++
      const segments = [
        ...(config.header.left || []),
        ...(config.header.center || []),
        ...(config.header.right || []),
      ]
      for (const seg of segments) {
        extractDynamicVariables(seg.text).forEach((v) => allDynamicVars.add(v))
      }
      if (pageNum === 1) {
        firstPageHeaderPreview = renderContentPreview(config.header, {
          currentPage: 1, totalPages, filename: filename || 'document.pdf',
          title, author, subject, creator, producer,
        })
      }
    }

    if (config.footer) {
      pagesWithFooters++
      const segments = [
        ...(config.footer.left || []),
        ...(config.footer.center || []),
        ...(config.footer.right || []),
      ]
      for (const seg of segments) {
        extractDynamicVariables(seg.text).forEach((v) => allDynamicVars.add(v))
      }
      if (pageNum === 1) {
        firstPageFooterPreview = renderContentPreview(config.footer, {
          currentPage: 1, totalPages, filename: filename || 'document.pdf',
          title, author, subject, creator, producer,
        })
      }
    }

    if (config.header?.logo || config.footer?.logo) hasLogo = true
  }

  for (const pc of options.pageConfigs) {
    if (pc.scope === 'first-only' || pc.scope === 'not-first') hasDifferentFirstPage = true
    if (pc.scope === 'odd' || pc.scope === 'even') hasOddEven = true
  }

  const textOverheadPerPage = (pagesWithHeaders + pagesWithFooters) * 300
  const logoOverhead = hasLogo ? 15000 : 0
  const estimatedSizeIncrease = textOverheadPerPage + logoOverhead

  const scopeNames = options.pageConfigs.map((pc) => pc.scope).join(', ')
  const configSummary = `${options.pageConfigs.length} config(s) — scopes: ${scopeNames}`

  return {
    pagesWithHeaders,
    pagesWithFooters,
    totalPages,
    dynamicVariables: [...allDynamicVars],
    estimatedSizeIncrease,
    configSummary,
    firstPageHeaderPreview,
    firstPageFooterPreview,
    hasLogo,
    hasDifferentFirstPage,
    hasOddEven,
  }
}

function renderContentPreview(content: HFContent, ctx: DynamicContext): string {
  const parts: string[] = []
  if (content.left) {
    const text = content.left.map((s) => resolveDynamicVariables(s.text, ctx)).join('')
    if (text) parts.push(`← ${text}`)
  }
  if (content.center) {
    const text = content.center.map((s) => resolveDynamicVariables(s.text, ctx)).join('')
    if (text) parts.push(text)
  }
  if (content.right) {
    const text = content.right.map((s) => resolveDynamicVariables(s.text, ctx)).join('')
    if (text) parts.push(`${text} →`)
  }
  return parts.join('  |  ')
}

// ─── Core Header/Footer Application ─────────────────────────────────────────

export async function applyHeaderFooter(
  pdfBuffer: Buffer,
  options: HeaderFooterOptions,
  filename?: string,
): Promise<HeaderFooterResult> {
  const startTime = Date.now()
  const originalSize = pdfBuffer.length
  const operations: HeaderFooterOperation[] = []

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true, updateMetadata: false })
  const totalPages = pdfDoc.getPageCount()

  // Extract document metadata
  const docTitle = pdfDoc.getTitle() || undefined
  const docAuthor = pdfDoc.getAuthor() || undefined
  const docSubject = pdfDoc.getSubject() || undefined
  const docCreator = pdfDoc.getCreator() || undefined
  const docProducer = pdfDoc.getProducer() || undefined

  const margins = {
    headerFromTop: options.margins?.headerFromTop ?? 30,
    footerFromBottom: options.margins?.footerFromBottom ?? 30,
    left: options.margins?.left ?? 40,
    right: options.margins?.right ?? 40,
  }

  const defaultFont = options.defaultFont || 'Helvetica'
  const defaultFontSize = options.defaultFontSize || 9
  const defaultColor = options.defaultColor || { r: 0.3, g: 0.3, b: 0.3 }
  const opacity = options.opacity ?? 1.0

  // Pre-embed all needed fonts
  const neededFonts = new Set<HFFont>([defaultFont])
  for (const pc of options.pageConfigs) {
    const collectFonts = (content?: HFContent) => {
      if (!content) return
      for (const seg of [...(content.left || []), ...(content.center || []), ...(content.right || [])]) {
        neededFonts.add(resolveFontForSegment(seg, defaultFont))
      }
    }
    collectFonts(pc.header)
    collectFonts(pc.footer)
  }

  const fontCache: Record<string, PDFFont> = {}
  for (const fontName of neededFonts) {
    fontCache[fontName] = await FONT_MAP[fontName](pdfDoc)
  }

  // Pre-embed logos
  const logoCache: Record<string, any> = {}
  for (let ci = 0; ci < options.pageConfigs.length; ci++) {
    const pc = options.pageConfigs[ci]
    for (const zone of ['header', 'footer'] as const) {
      const content = pc[zone]
      if (content?.logo?.imageBuffer) {
        const logo = content.logo
        const logoKey = `logo_${ci}_${zone}_${logo.position}_${logo.width}x${logo.height}`
        if (!logoCache[logoKey]) {
          const processedBuffer = await optimizeLogoImage(logo.imageBuffer, logo.imageMimeType)
          if (logo.imageMimeType === 'image/jpeg') {
            logoCache[logoKey] = await pdfDoc.embedJpg(processedBuffer)
          } else {
            logoCache[logoKey] = await pdfDoc.embedPng(processedBuffer)
          }
        }
        logo._cacheKey = logoKey
      }
    }
  }

  // Apply to each page
  const targetPages = getTargetPages(totalPages, options.pageRange, options.customPages)
  let pagesProcessed = 0

  for (const pageNum of targetPages) {
    const pageIndex = pageNum - 1
    if (pageIndex < 0 || pageIndex >= totalPages) continue

    const page = pdfDoc.getPage(pageIndex)
    const { width: pageWidth, height: pageHeight } = page.getSize()

    const config = getApplicableConfig(pageNum, options.pageConfigs)

    const ctx: DynamicContext = {
      currentPage: pageNum,
      totalPages,
      filename: filename || 'document.pdf',
      title: docTitle,
      author: docAuthor,
      subject: docSubject,
      creator: docCreator,
      producer: docProducer,
    }

    // Draw header
    if (config.header) {
      drawContentOnPage(
        page, config.header, 'header', pageWidth, pageHeight,
        margins, fontCache, logoCache, defaultFont, defaultFontSize, defaultColor, opacity, ctx,
      )

      // Separator line under header
      if (options.separatorLine?.enabled) {
        const lineY = pageHeight - margins.headerFromTop - 8
        const lineColor = options.separatorLine.color || { r: 0.8, g: 0.8, b: 0.8 }
        const thickness = options.separatorLine.thickness || 0.5
        page.drawLine({
          start: { x: margins.left, y: lineY },
          end: { x: pageWidth - margins.right, y: lineY },
          thickness,
          color: rgb(lineColor.r, lineColor.g, lineColor.b),
          opacity,
        })
      }
    }

    // Draw footer
    if (config.footer) {
      drawContentOnPage(
        page, config.footer, 'footer', pageWidth, pageHeight,
        margins, fontCache, logoCache, defaultFont, defaultFontSize, defaultColor, opacity, ctx,
      )

      // Separator line above footer
      if (options.separatorLine?.enabled) {
        const lineY = margins.footerFromBottom + 8
        const lineColor = options.separatorLine.color || { r: 0.8, g: 0.8, b: 0.8 }
        const thickness = options.separatorLine.thickness || 0.5
        page.drawLine({
          start: { x: margins.left, y: lineY },
          end: { x: pageWidth - margins.right, y: lineY },
          thickness,
          color: rgb(lineColor.r, lineColor.g, lineColor.b),
          opacity,
        })
      }
    }

    pagesProcessed++
  }

  // Save
  const outputBytes = await pdfDoc.save({ useObjectStreams: true })
  const outputBuffer = Buffer.from(outputBytes)

  // Build operations log
  operations.push({
    type: 'header_footer_apply',
    description: `Applied headers/footers to ${pagesProcessed} pages across ${options.pageConfigs.length} configuration(s)`,
    itemsProcessed: pagesProcessed,
  })

  const hasFirstOnly = options.pageConfigs.some((pc) => pc.scope === 'first-only' || pc.scope === 'not-first')
  const hasOddEven = options.pageConfigs.some((pc) => pc.scope === 'odd' || pc.scope === 'even')
  const hasLogoFlag = options.pageConfigs.some((pc) => pc.header?.logo || pc.footer?.logo)

  if (hasFirstOnly) {
    operations.push({
      type: 'different_first_page',
      description: 'Applied different header/footer for first page',
      itemsProcessed: 1,
    })
  }

  if (hasOddEven) {
    operations.push({
      type: 'odd_even_support',
      description: 'Applied different headers/footers for odd/even pages',
      itemsProcessed: Math.ceil(pagesProcessed / 2),
    })
  }

  if (hasLogoFlag) {
    operations.push({
      type: 'logo_embed',
      description: 'Embedded logo image in header/footer',
      itemsProcessed: 1,
    })
  }

  if (options.separatorLine?.enabled) {
    operations.push({
      type: 'separator_line',
      description: 'Added separator lines between header/footer and content',
      itemsProcessed: pagesProcessed * 2,
    })
  }

  return {
    outputBuffer,
    originalSize,
    outputSize: outputBuffer.length,
    sizeIncrease: outputBuffer.length - originalSize,
    pagesProcessed,
    totalPages,
    operations,
    durationMs: Date.now() - startTime,
  }
}

// ─── Content Drawing ─────────────────────────────────────────────────────────

function drawContentOnPage(
  page: PDFPage,
  content: HFContent,
  zone: 'header' | 'footer',
  pageWidth: number,
  pageHeight: number,
  margins: { headerFromTop: number; footerFromBottom: number; left: number; right: number },
  fontCache: Record<string, PDFFont>,
  logoCache: Record<string, any>,
  defaultFont: HFFont,
  defaultFontSize: number,
  defaultColor: { r: number; g: number; b: number },
  opacity: number,
  ctx: DynamicContext,
): void {
  const contentWidth = pageWidth - margins.left - margins.right
  const baseY = zone === 'header'
    ? pageHeight - margins.headerFromTop
    : margins.footerFromBottom

  // Draw logo if present
  if (content.logo?._cacheKey && logoCache[content.logo._cacheKey]) {
    const embeddedLogo = logoCache[content.logo._cacheKey]
    const logoX = content.logo.position === 'left'
      ? margins.left
      : content.logo.position === 'right'
        ? pageWidth - margins.right - content.logo.width
        : (pageWidth - content.logo.width) / 2
    const logoY = zone === 'header'
      ? baseY - content.logo.height - (content.logo.verticalOffset || 5)
      : baseY + (content.logo.verticalOffset || 5)

    page.drawImage(embeddedLogo, {
      x: logoX,
      y: logoY,
      width: content.logo.width,
      height: content.logo.height,
      opacity,
    })
  }

  // Draw text segments in each position
  const positions: HFPosition[] = ['left', 'center', 'right']

  for (const position of positions) {
    const segments = content[position]
    if (!segments || segments.length === 0) continue

    // Calculate total text width
    let totalTextWidth = 0
    const resolvedTexts: string[] = []

    for (const seg of segments) {
      const resolvedText = resolveDynamicVariables(seg.text, ctx)
      resolvedTexts.push(resolvedText)
      const fontName = resolveFontForSegment(seg, defaultFont)
      const font = fontCache[fontName]
      const fontSize = seg.fontSize || defaultFontSize
      totalTextWidth += font.widthOfTextAtSize(resolvedText, fontSize)
    }

    // Calculate X position
    let x: number
    switch (position) {
      case 'left':
        x = margins.left
        break
      case 'center':
        x = margins.left + (contentWidth - totalTextWidth) / 2
        break
      case 'right':
        x = pageWidth - margins.right - totalTextWidth
        break
    }

    // Draw each segment
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const text = resolvedTexts[i]
      if (!text) continue

      const fontName = resolveFontForSegment(seg, defaultFont)
      const font = fontCache[fontName]
      const fontSize = seg.fontSize || defaultFontSize
      const color = seg.color || defaultColor

      const textHeight = font.heightAtSize(fontSize)
      const y = zone === 'header'
        ? baseY - textHeight
        : baseY

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
        opacity,
      })

      // Advance X for next segment
      x += font.widthOfTextAtSize(text, fontSize)
    }
  }
}

// ─── Batch Header/Footer ────────────────────────────────────────────────────

export async function batchApplyHeaderFooter(
  pdfBuffers: Array<{ id: string; name: string; buffer: Buffer }>,
  options: HeaderFooterOptions,
): Promise<BatchHeaderFooterResult> {
  const results: BatchHeaderFooterResult['results'] = []

  for (const { id, name, buffer } of pdfBuffers) {
    try {
      const result = await applyHeaderFooter(buffer, options, name)
      results.push({
        fileId: id,
        fileName: name,
        success: true,
        sizeIncrease: result.sizeIncrease,
        pagesProcessed: result.pagesProcessed,
      })
    } catch (error: any) {
      results.push({
        fileId: id,
        fileName: name,
        success: false,
        error: error.message || 'Header/footer application failed',
      })
    }
  }

  return {
    results,
    summary: {
      total: pdfBuffers.length,
      success: results.filter((r) => r.success).length,
      errors: results.filter((r) => !r.success).length,
      totalSizeIncrease: results.reduce((sum, r) => sum + (r.sizeIncrease || 0), 0),
    },
  }
}

// ─── Template Helpers ────────────────────────────────────────────────────────

export function templateToOptions(template: HFTemplate): HeaderFooterOptions {
  return {
    pageConfigs: template.pageConfigs,
    margins: template.margins,
    separatorLine: template.separatorLine,
    defaultFont: 'Helvetica',
    defaultFontSize: 9,
    defaultColor: { r: 0.3, g: 0.3, b: 0.3 },
    opacity: 1.0,
  }
}

export function optionsToTemplate(
  options: HeaderFooterOptions,
  name: string,
  description?: string,
): HFTemplate {
  return {
    id: `custom_${Date.now()}`,
    name,
    description,
    pageConfigs: options.pageConfigs,
    margins: options.margins || {
      headerFromTop: 30,
      footerFromBottom: 30,
      left: 40,
      right: 40,
    },
    separatorLine: options.separatorLine || { enabled: false },
  }
}
