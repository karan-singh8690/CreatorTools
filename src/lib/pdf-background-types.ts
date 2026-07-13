/**
 * PDF Background Types — Professional-Grade Background System
 *
 * Supports: Image backgrounds, Gradient backgrounds, Brand templates,
 * Background preview, Per-page backgrounds, Opacity controls,
 * Layer ordering, Theme library, Batch processing, Smart contrast detection
 */

// ─── Core Types ─────────────────────────────────────────────────────────────

export type BackgroundType = 'solid' | 'gradient' | 'image' | 'pattern' | 'template'

export type GradientDirection =
  | 'to-top'
  | 'to-bottom'
  | 'to-left'
  | 'to-right'
  | 'to-top-left'
  | 'to-top-right'
  | 'to-bottom-left'
  | 'to-bottom-right'
  | 'radial'

export type GradientType = 'linear' | 'radial'

export type BackgroundLayer = 'behind-content' | 'in-front-of-content'

export type PatternType =
  | 'dots'
  | 'lines'
  | 'grid'
  | 'diagonal'
  | 'crosshatch'
  | 'zigzag'
  | 'waves'
  | 'circles'

export type PageRange = 'all' | 'even' | 'odd' | 'first' | 'last' | 'custom'

export type FitMode = 'fill' | 'fit' | 'stretch' | 'tile' | 'center'

// ─── Color ───────────────────────────────────────────────────────────────────

export interface RGBColor {
  r: number // 0-1
  g: number // 0-1
  b: number // 0-1
}

// ─── Gradient ────────────────────────────────────────────────────────────────

export interface GradientStop {
  color: RGBColor
  position: number // 0-1
}

export interface GradientConfig {
  type: GradientType
  direction: GradientDirection
  stops: GradientStop[]
  angle?: number // Custom angle in degrees (0-360)
}

// ─── Brand Template ──────────────────────────────────────────────────────────

export interface BrandTemplate {
  id: string
  name: string
  description: string
  category: 'corporate' | 'creative' | 'legal' | 'academic' | 'minimal'
  primary: RGBColor
  secondary?: RGBColor
  accent?: RGBColor
  textColor?: RGBColor
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none'
  pattern?: PatternType
}

// ─── Theme Library ───────────────────────────────────────────────────────────

export interface BackgroundTheme {
  id: string
  name: string
  description: string
  category: 'nature' | 'abstract' | 'geometric' | 'paper' | 'vintage' | 'modern' | 'seasonal'
  type: BackgroundType
  config: Omit<BackgroundOptions, 'type' | 'pageRange' | 'customPages' | 'perPage' | 'layer' | 'opacity'>
  preview: string // CSS background value for UI preview
}

// ─── Per-Page Configuration ──────────────────────────────────────────────────

export interface PageBackground {
  pageNumbers: number[] // 1-indexed page numbers
  background: Omit<BackgroundOptions, 'pageRange' | 'customPages' | 'perPage'>
}

// ─── Smart Contrast ──────────────────────────────────────────────────────────

export interface ContrastAnalysis {
  averageBrightness: number // 0-255
  isDark: boolean
  recommendedTextColor: RGBColor
  contrastRatio: number
  warnings: string[]
}

// ─── Main Options ────────────────────────────────────────────────────────────

export interface BackgroundOptions {
  /** Type of background */
  type: BackgroundType

  // ── Solid Color ──
  color?: RGBColor

  // ── Gradient ──
  gradient?: GradientConfig

  // ── Image ──
  imageBuffer?: Buffer
  imageMimeType?: 'image/png' | 'image/jpeg'
  fitMode?: FitMode
  imageScale?: number // 0.1 - 2.0

  // ── Pattern ──
  pattern?: PatternType
  patternColor?: RGBColor
  patternScale?: number // 0.5 - 3.0
  patternBackgroundColor?: RGBColor

  // ── Template ──
  templateId?: string

  // ── Opacity ──
  opacity: number // 0.0 - 1.0

  // ── Layer Ordering ──
  layer: BackgroundLayer

  // ── Page Range ──
  pageRange: PageRange
  customPages?: number[] // 1-indexed

  // ── Per-Page Backgrounds ──
  perPage?: PageBackground[]

  // ── Smart Contrast Detection ──
  autoContrast?: boolean
  contrastTextColor?: RGBColor
}

// ─── Preview ─────────────────────────────────────────────────────────────────

export interface BackgroundPreview {
  affectedPages: number
  totalPages: number
  estimatedCoverage: number // percentage
  estimatedSizeIncrease: number // bytes
  contrastAnalysis?: ContrastAnalysis
  layerDescription: string
  warnings: string[]
}

// ─── Result ──────────────────────────────────────────────────────────────────

export interface BackgroundResult {
  outputBuffer: Buffer
  originalSize: number
  outputSize: number
  sizeIncrease: number
  pagesModified: number
  totalPages: number
  contrastAnalysis?: ContrastAnalysis
  operations: BackgroundOperation[]
  durationMs: number
}

export interface BackgroundOperation {
  type: string
  description: string
  itemsProcessed: number
}

// ─── Batch ───────────────────────────────────────────────────────────────────

export interface BatchBackgroundResult {
  results: Array<{
    fileId: string
    fileName: string
    success: boolean
    error?: string
    sizeIncrease?: number
    pagesModified?: number
  }>
  summary: {
    total: number
    success: number
    errors: number
    totalSizeIncrease: number
  }
}

// ─── Preset ──────────────────────────────────────────────────────────────────

export interface BackgroundPreset {
  id: string
  name: string
  description: string
  options: Omit<BackgroundOptions, 'pageRange' | 'customPages' | 'perPage' | 'imageBuffer'>
  isCustom?: boolean
  createdAt?: string
}

// ─── Default Options ─────────────────────────────────────────────────────────

export function getDefaultBackgroundOptions(type: BackgroundType = 'solid'): BackgroundOptions {
  const base: BackgroundOptions = {
    type,
    opacity: 1.0,
    layer: 'behind-content',
    pageRange: 'all',
    autoContrast: false,
  }

  switch (type) {
    case 'solid':
      return {
        ...base,
        color: { r: 1, g: 1, b: 1 }, // White
      }
    case 'gradient':
      return {
        ...base,
        gradient: {
          type: 'linear',
          direction: 'to-bottom',
          stops: [
            { color: { r: 0.29, g: 0.56, b: 0.85 }, position: 0 },
            { color: { r: 0.18, g: 0.35, b: 0.6 }, position: 1 },
          ],
        },
      }
    case 'image':
      return {
        ...base,
        fitMode: 'fill',
        imageScale: 1.0,
      }
    case 'pattern':
      return {
        ...base,
        pattern: 'dots',
        patternColor: { r: 0.85, g: 0.85, b: 0.85 },
        patternScale: 1.0,
        patternBackgroundColor: { r: 1, g: 1, b: 1 },
      }
    case 'template':
      return {
        ...base,
        templateId: 'corporate-blue',
      }
  }
}
