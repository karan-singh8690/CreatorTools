/**
 * Shared types for PDF Header & Footer feature.
 * This file has NO server-only imports (sharp, fs, etc.)
 * and is safe to import from client components.
 */

export type HFFont =
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

export type HFPosition = 'left' | 'center' | 'right'
export type HFZone = 'header' | 'footer'
export type HFPageScope = 'all' | 'first-only' | 'odd' | 'even' | 'not-first'

export interface HFTextSegment {
  text: string
  font?: HFFont
  fontSize?: number
  color?: { r: number; g: number; b: number }
  bold?: boolean
  italic?: boolean
}

export interface HFLogoConfig {
  imageBuffer?: Buffer
  imageMimeType?: 'image/png' | 'image/jpeg'
  width: number
  height: number
  position: HFPosition
  verticalOffset?: number
  _cacheKey?: string
}

export interface HFContent {
  left?: HFTextSegment[]
  center?: HFTextSegment[]
  right?: HFTextSegment[]
  logo?: HFLogoConfig
}

export interface HFPageConfig {
  scope: HFPageScope
  header?: HFContent
  footer?: HFContent
}

export interface HFTemplate {
  id: string
  name: string
  description?: string
  pageConfigs: HFPageConfig[]
  margins: {
    headerFromTop: number
    footerFromBottom: number
    left: number
    right: number
  }
  separatorLine?: {
    enabled: boolean
    color?: { r: number; g: number; b: number }
    thickness?: number
  }
}

export interface HeaderFooterOptions {
  pageConfigs: HFPageConfig[]
  margins?: {
    headerFromTop?: number
    footerFromBottom?: number
    left?: number
    right?: number
  }
  separatorLine?: {
    enabled: boolean
    color?: { r: number; g: number; b: number }
    thickness?: number
  }
  defaultFont?: HFFont
  defaultFontSize?: number
  defaultColor?: { r: number; g: number; b: number }
  opacity?: number
  pageRange?: 'all' | 'first' | 'last' | 'custom'
  customPages?: number[]
}

export interface HeaderFooterPreview {
  pagesWithHeaders: number
  pagesWithFooters: number
  totalPages: number
  dynamicVariables: string[]
  estimatedSizeIncrease: number
  configSummary: string
  firstPageHeaderPreview: string
  firstPageFooterPreview: string
  hasLogo: boolean
  hasDifferentFirstPage: boolean
  hasOddEven: boolean
}

export interface HeaderFooterResult {
  outputBuffer: Buffer
  originalSize: number
  outputSize: number
  sizeIncrease: number
  pagesProcessed: number
  totalPages: number
  operations: HeaderFooterOperation[]
  durationMs: number
}

export interface HeaderFooterOperation {
  type: string
  description: string
  itemsProcessed: number
}

export interface BatchHeaderFooterResult {
  results: Array<{
    fileId: string
    fileName: string
    success: boolean
    error?: string
    sizeIncrease?: number
    pagesProcessed?: number
  }>
  summary: {
    total: number
    success: number
    errors: number
    totalSizeIncrease: number
  }
}

// ─── Default Options ─────────────────────────────────────────────────────────

export function getDefaultHeaderFooterOptions(): HeaderFooterOptions {
  return {
    pageConfigs: [
      {
        scope: 'all',
        header: {
          center: [
            { text: '{filename}', font: 'HelveticaBold', fontSize: 9, color: { r: 0.3, g: 0.3, b: 0.3 } },
          ],
        },
        footer: {
          center: [
            { text: 'Page {page} of {total_pages}', font: 'Helvetica', fontSize: 9, color: { r: 0.4, g: 0.4, b: 0.4 } },
          ],
          right: [
            { text: '{date}', font: 'Helvetica', fontSize: 8, color: { r: 0.5, g: 0.5, b: 0.5 } },
          ],
        },
      },
    ],
    margins: {
      headerFromTop: 30,
      footerFromBottom: 30,
      left: 40,
      right: 40,
    },
    separatorLine: {
      enabled: true,
      color: { r: 0.8, g: 0.8, b: 0.8 },
      thickness: 0.5,
    },
    defaultFont: 'Helvetica',
    defaultFontSize: 9,
    defaultColor: { r: 0.3, g: 0.3, b: 0.3 },
    opacity: 1.0,
    pageRange: 'all',
  }
}

// ─── Built-in Templates ──────────────────────────────────────────────────────

export const BUILTIN_TEMPLATES: HFTemplate[] = [
  {
    id: 'simple-page-number',
    name: 'Simple Page Number',
    description: 'Centered page number in footer',
    pageConfigs: [
      {
        scope: 'all',
        footer: {
          center: [
            { text: '{page}', font: 'Helvetica', fontSize: 10, color: { r: 0.3, g: 0.3, b: 0.3 } },
          ],
        },
      },
    ],
    margins: { headerFromTop: 30, footerFromBottom: 30, left: 40, right: 40 },
    separatorLine: { enabled: false },
  },
  {
    id: 'page-of-total',
    name: 'Page X of Y',
    description: 'Page number with total count',
    pageConfigs: [
      {
        scope: 'all',
        footer: {
          center: [
            { text: 'Page {page} of {total_pages}', font: 'Helvetica', fontSize: 9, color: { r: 0.3, g: 0.3, b: 0.3 } },
          ],
        },
      },
    ],
    margins: { headerFromTop: 30, footerFromBottom: 30, left: 40, right: 40 },
    separatorLine: { enabled: false },
  },
  {
    id: 'professional-report',
    name: 'Professional Report',
    description: 'Title in header, page number and date in footer',
    pageConfigs: [
      {
        scope: 'first-only',
        header: {
          left: [
            { text: '{title}', font: 'HelveticaBold', fontSize: 10, color: { r: 0.2, g: 0.2, b: 0.2 } },
          ],
          right: [
            { text: '{date}', font: 'Helvetica', fontSize: 8, color: { r: 0.5, g: 0.5, b: 0.5 } },
          ],
        },
      },
      {
        scope: 'not-first',
        header: {
          left: [
            { text: '{filename}', font: 'Helvetica', fontSize: 8, color: { r: 0.4, g: 0.4, b: 0.4 } },
          ],
          right: [
            { text: '{date}', font: 'Helvetica', fontSize: 8, color: { r: 0.5, g: 0.5, b: 0.5 } },
          ],
        },
      },
      {
        scope: 'all',
        footer: {
          center: [
            { text: 'Page {page} of {total_pages}', font: 'Helvetica', fontSize: 9, color: { r: 0.3, g: 0.3, b: 0.3 } },
          ],
        },
      },
    ],
    margins: { headerFromTop: 35, footerFromBottom: 30, left: 50, right: 50 },
    separatorLine: { enabled: true, color: { r: 0.85, g: 0.85, b: 0.85 }, thickness: 0.5 },
  },
  {
    id: 'legal-bates',
    name: 'Legal / Bates Numbering',
    description: 'Bates numbering with confidentiality notice',
    pageConfigs: [
      {
        scope: 'all',
        header: {
          center: [
            { text: 'CONFIDENTIAL', font: 'HelveticaBold', fontSize: 8, color: { r: 0.7, g: 0.1, b: 0.1 } },
          ],
        },
        footer: {
          left: [
            { text: 'BATES-{page:0001}', font: 'CourierBold', fontSize: 9, color: { r: 0.2, g: 0.2, b: 0.2 } },
          ],
          right: [
            { text: '{date}', font: 'Courier', fontSize: 8, color: { r: 0.4, g: 0.4, b: 0.4 } },
          ],
        },
      },
    ],
    margins: { headerFromTop: 25, footerFromBottom: 25, left: 50, right: 50 },
    separatorLine: { enabled: true, color: { r: 0.7, g: 0.1, b: 0.1 }, thickness: 0.75 },
  },
  {
    id: 'book-style',
    name: 'Book Style',
    description: 'Odd/even page headers with chapter info, centered page numbers',
    pageConfigs: [
      {
        scope: 'odd',
        header: {
          right: [
            { text: '{filename}', font: 'HelveticaOblique', fontSize: 9, color: { r: 0.3, g: 0.3, b: 0.3 } },
          ],
        },
      },
      {
        scope: 'even',
        header: {
          left: [
            { text: '{title}', font: 'HelveticaOblique', fontSize: 9, color: { r: 0.3, g: 0.3, b: 0.3 } },
          ],
        },
      },
      {
        scope: 'all',
        footer: {
          center: [
            { text: '{page}', font: 'Helvetica', fontSize: 9, color: { r: 0.3, g: 0.3, b: 0.3 } },
          ],
        },
      },
    ],
    margins: { headerFromTop: 35, footerFromBottom: 30, left: 50, right: 50 },
    separatorLine: { enabled: false },
  },
  {
    id: 'corporate-letterhead',
    name: 'Corporate Letterhead',
    description: 'First page with company header, subsequent pages with simple footer',
    pageConfigs: [
      {
        scope: 'first-only',
        header: {
          left: [
            { text: 'ACME Corporation', font: 'HelveticaBold', fontSize: 12, color: { r: 0.1, g: 0.1, b: 0.1 } },
          ],
          right: [
            { text: '{date}', font: 'Helvetica', fontSize: 9, color: { r: 0.4, g: 0.4, b: 0.4 } },
          ],
        },
      },
      {
        scope: 'not-first',
        header: {
          left: [
            { text: 'ACME Corporation', font: 'Helvetica', fontSize: 8, color: { r: 0.5, g: 0.5, b: 0.5 } },
          ],
        },
      },
      {
        scope: 'all',
        footer: {
          center: [
            { text: 'ACME Corp. — Page {page} of {total_pages}', font: 'Helvetica', fontSize: 8, color: { r: 0.4, g: 0.4, b: 0.4 } },
          ],
        },
      },
    ],
    margins: { headerFromTop: 40, footerFromBottom: 30, left: 50, right: 50 },
    separatorLine: { enabled: true, color: { r: 0.85, g: 0.85, b: 0.85 }, thickness: 0.5 },
  },
]
