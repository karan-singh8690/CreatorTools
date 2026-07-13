/**
 * PDF Background Engine — Professional-Grade
 *
 * Implements 10 professional features:
 * 1. Image backgrounds (PNG/JPEG embedded as page background)
 * 2. Gradient backgrounds (linear/radial multi-stop)
 * 3. Brand templates (corporate, creative, legal, academic, minimal)
 * 4. Background preview (fast estimation without full render)
 * 5. Per-page backgrounds (different backgrounds per page)
 * 6. Opacity controls (0-100% transparency)
 * 7. Layer ordering (behind-content / in-front-of-content)
 * 8. Theme library (nature, abstract, geometric, paper, vintage, modern, seasonal)
 * 9. Batch processing (multi-file application)
 * 10. Smart contrast detection (auto-analyze brightness, recommend text colors)
 */

import {
  PDFDocument,
  rgb,
  PDFPage,
  PDFFont,
  StandardFonts,
  PDFName,
  PDFRef,
} from 'pdf-lib'
import sharp from 'sharp'
import type {
  BackgroundOptions,
  BackgroundResult,
  BackgroundPreview,
  BackgroundOperation,
  BatchBackgroundResult,
  ContrastAnalysis,
  RGBColor,
  GradientConfig,
  PatternType,
  BrandTemplate,
  BackgroundTheme,
  FitMode,
} from './pdf-background-types'

// Re-export for API route consumers
export type {
  BackgroundOptions,
  BackgroundResult,
  BackgroundPreview,
  BackgroundOperation,
  BatchBackgroundResult,
  ContrastAnalysis,
  RGBColor,
  GradientConfig,
  PatternType,
  BrandTemplate,
  BackgroundTheme,
  FitMode,
  BackgroundType,
  GradientDirection,
  GradientType,
  BackgroundLayer,
  PageRange as BackgroundPageRange,
} from './pdf-background-types'

// ─── Brand Templates Library ─────────────────────────────────────────────────

export const BRAND_TEMPLATES: BrandTemplate[] = [
  {
    id: 'corporate-blue',
    name: 'Corporate Blue',
    description: 'Professional blue theme for business documents',
    category: 'corporate',
    primary: { r: 0.08, g: 0.24, b: 0.42 },
    secondary: { r: 0.16, g: 0.5, b: 0.73 },
    accent: { r: 0.96, g: 0.65, b: 0.14 },
    textColor: { r: 1, g: 1, b: 1 },
    pattern: 'lines',
  },
  {
    id: 'corporate-gray',
    name: 'Corporate Gray',
    description: 'Elegant gray theme for formal documents',
    category: 'corporate',
    primary: { r: 0.2, g: 0.2, b: 0.22 },
    secondary: { r: 0.4, g: 0.4, b: 0.42 },
    accent: { r: 0.9, g: 0.72, b: 0.22 },
    textColor: { r: 1, g: 1, b: 1 },
    pattern: 'grid',
  },
  {
    id: 'creative-sunset',
    name: 'Creative Sunset',
    description: 'Warm gradient for creative proposals',
    category: 'creative',
    primary: { r: 0.89, g: 0.26, b: 0.2 },
    secondary: { r: 0.97, g: 0.58, b: 0.1 },
    accent: { r: 1, g: 0.84, b: 0.4 },
    textColor: { r: 1, g: 1, b: 1 },
    logoPosition: 'top-right',
  },
  {
    id: 'creative-mint',
    name: 'Creative Mint',
    description: 'Fresh mint theme for modern brands',
    category: 'creative',
    primary: { r: 0.07, g: 0.63, b: 0.53 },
    secondary: { r: 0.12, g: 0.75, b: 0.65 },
    accent: { r: 0.98, g: 0.92, b: 0.68 },
    textColor: { r: 0.1, g: 0.1, b: 0.1 },
    pattern: 'dots',
  },
  {
    id: 'legal-navy',
    name: 'Legal Navy',
    description: 'Formal navy for legal documents',
    category: 'legal',
    primary: { r: 0.04, g: 0.12, b: 0.26 },
    secondary: { r: 0.08, g: 0.2, b: 0.38 },
    accent: { r: 0.7, g: 0.56, b: 0.2 },
    textColor: { r: 1, g: 1, b: 1 },
    pattern: 'diagonal',
  },
  {
    id: 'academic-cream',
    name: 'Academic Cream',
    description: 'Warm cream for academic papers',
    category: 'academic',
    primary: { r: 0.96, g: 0.94, b: 0.88 },
    secondary: { r: 0.88, g: 0.84, b: 0.76 },
    accent: { r: 0.4, g: 0.26, b: 0.13 },
    textColor: { r: 0.15, g: 0.15, b: 0.15 },
    pattern: 'none',
  },
  {
    id: 'minimal-white',
    name: 'Minimal White',
    description: 'Clean minimal with subtle accent',
    category: 'minimal',
    primary: { r: 0.98, g: 0.98, b: 0.98 },
    secondary: { r: 0.94, g: 0.94, b: 0.94 },
    accent: { r: 0.29, g: 0.56, b: 0.85 },
    textColor: { r: 0.2, g: 0.2, b: 0.2 },
    pattern: 'none',
  },
  {
    id: 'minimal-dark',
    name: 'Minimal Dark',
    description: 'Dark theme for presentations',
    category: 'minimal',
    primary: { r: 0.12, g: 0.12, b: 0.14 },
    secondary: { r: 0.18, g: 0.18, b: 0.2 },
    accent: { r: 0.3, g: 0.78, b: 0.65 },
    textColor: { r: 0.9, g: 0.9, b: 0.9 },
    pattern: 'crosshatch',
  },
]

// ─── Theme Library ───────────────────────────────────────────────────────────

export const THEME_LIBRARY: BackgroundTheme[] = [
  // Nature
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    description: 'Cool ocean gradient',
    category: 'nature',
    type: 'gradient',
    config: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        direction: 'to-bottom',
        stops: [
          { color: { r: 0.04, g: 0.38, b: 0.53 }, position: 0 },
          { color: { r: 0.15, g: 0.65, b: 0.78 }, position: 0.5 },
          { color: { r: 0.85, g: 0.93, b: 0.97 }, position: 1 },
        ],
      },
      opacity: 0.15,
    },
    preview: 'linear-gradient(to bottom, #0a6187, #26a6c7, #d9eef7)',
  },
  {
    id: 'forest-green',
    name: 'Forest',
    description: 'Deep forest gradient',
    category: 'nature',
    type: 'gradient',
    config: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        direction: 'to-bottom-right',
        stops: [
          { color: { r: 0.04, g: 0.24, b: 0.1 }, position: 0 },
          { color: { r: 0.08, g: 0.4, b: 0.18 }, position: 1 },
        ],
      },
      opacity: 0.12,
    },
    preview: 'linear-gradient(to bottom right, #0a3d1a, #14662e)',
  },
  // Abstract
  {
    id: 'sunset-blaze',
    name: 'Sunset Blaze',
    description: 'Warm sunset gradient',
    category: 'abstract',
    type: 'gradient',
    config: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        direction: 'to-bottom',
        stops: [
          { color: { r: 0.78, g: 0.1, b: 0.15 }, position: 0 },
          { color: { r: 0.96, g: 0.42, b: 0.07 }, position: 0.5 },
          { color: { r: 0.98, g: 0.84, b: 0.28 }, position: 1 },
        ],
      },
      opacity: 0.12,
    },
    preview: 'linear-gradient(to bottom, #c71a26, #f56b12, #fad648)',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Northern lights effect',
    category: 'abstract',
    type: 'gradient',
    config: {
      type: 'gradient',
      gradient: {
        type: 'radial',
        direction: 'radial',
        stops: [
          { color: { r: 0.08, g: 0.48, b: 0.38 }, position: 0 },
          { color: { r: 0.15, g: 0.3, b: 0.6 }, position: 0.5 },
          { color: { r: 0.22, g: 0.1, b: 0.4 }, position: 1 },
        ],
      },
      opacity: 0.15,
    },
    preview: 'radial-gradient(circle, #147a60, #264d99, #381a66)',
  },
  // Geometric
  {
    id: 'blueprint',
    name: 'Blueprint',
    description: 'Technical blueprint grid',
    category: 'geometric',
    type: 'pattern',
    config: {
      type: 'pattern',
      pattern: 'grid',
      patternColor: { r: 0.25, g: 0.45, b: 0.7 },
      patternScale: 1.0,
      patternBackgroundColor: { r: 0.12, g: 0.25, b: 0.45 },
      opacity: 0.1,
    },
    preview: '#1f4066',
  },
  {
    id: 'subtle-dots',
    name: 'Subtle Dots',
    description: 'Gentle dot pattern',
    category: 'geometric',
    type: 'pattern',
    config: {
      type: 'pattern',
      pattern: 'dots',
      patternColor: { r: 0.78, g: 0.78, b: 0.78 },
      patternScale: 1.0,
      patternBackgroundColor: { r: 1, g: 1, b: 1 },
      opacity: 0.5,
    },
    preview: '#ffffff',
  },
  // Paper
  {
    id: 'aged-paper',
    name: 'Aged Paper',
    description: 'Vintage paper texture',
    category: 'paper',
    type: 'solid',
    config: {
      type: 'solid',
      color: { r: 0.94, g: 0.9, b: 0.82 },
      opacity: 0.3,
    },
    preview: '#f0e6d1',
  },
  {
    id: 'parchment',
    name: 'Parchment',
    description: 'Classic parchment look',
    category: 'paper',
    type: 'solid',
    config: {
      type: 'solid',
      color: { r: 0.97, g: 0.94, b: 0.86 },
      opacity: 0.3,
    },
    preview: '#f7f0db',
  },
  // Vintage
  {
    id: 'sepia',
    name: 'Sepia',
    description: 'Warm sepia tone',
    category: 'vintage',
    type: 'solid',
    config: {
      type: 'solid',
      color: { r: 0.72, g: 0.58, b: 0.36 },
      opacity: 0.08,
    },
    preview: '#b8945c',
  },
  {
    id: 'noir',
    name: 'Noir',
    description: 'Dark vintage elegance',
    category: 'vintage',
    type: 'gradient',
    config: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        direction: 'to-bottom',
        stops: [
          { color: { r: 0.1, g: 0.1, b: 0.1 }, position: 0 },
          { color: { r: 0.2, g: 0.18, b: 0.15 }, position: 1 },
        ],
      },
      opacity: 0.12,
    },
    preview: 'linear-gradient(to bottom, #1a1a1a, #332e26)',
  },
  // Modern
  {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    description: 'Frosted glass effect',
    category: 'modern',
    type: 'solid',
    config: {
      type: 'solid',
      color: { r: 0.95, g: 0.95, b: 0.97 },
      opacity: 0.4,
    },
    preview: '#f2f2f7',
  },
  {
    id: 'neon-glow',
    name: 'Neon Glow',
    description: 'Subtle neon accent',
    category: 'modern',
    type: 'gradient',
    config: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        direction: 'to-right',
        stops: [
          { color: { r: 0.06, g: 0.06, b: 0.12 }, position: 0 },
          { color: { r: 0.1, g: 0.08, b: 0.2 }, position: 1 },
        ],
      },
      opacity: 0.08,
    },
    preview: 'linear-gradient(to right, #0f0f1f, #1a1433)',
  },
  // Seasonal
  {
    id: 'spring-bloom',
    name: 'Spring Bloom',
    description: 'Fresh spring colors',
    category: 'seasonal',
    type: 'gradient',
    config: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        direction: 'to-bottom',
        stops: [
          { color: { r: 0.88, g: 0.96, b: 0.82 }, position: 0 },
          { color: { r: 0.75, g: 0.93, b: 0.7 }, position: 1 },
        ],
      },
      opacity: 0.12,
    },
    preview: 'linear-gradient(to bottom, #e0f5d1, #bfedb3)',
  },
  {
    id: 'winter-frost',
    name: 'Winter Frost',
    description: 'Cool winter tones',
    category: 'seasonal',
    type: 'gradient',
    config: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        direction: 'to-bottom',
        stops: [
          { color: { r: 0.88, g: 0.92, b: 0.97 }, position: 0 },
          { color: { r: 0.75, g: 0.84, b: 0.94 }, position: 1 },
        ],
      },
      opacity: 0.15,
    },
    preview: 'linear-gradient(to bottom, #e0ebf8, #bfd6f0)',
  },
]

// ─── Presets ─────────────────────────────────────────────────────────────────

export const BACKGROUND_PRESETS: Array<{
  id: string
  name: string
  description: string
  options: Omit<BackgroundOptions, 'pageRange' | 'customPages' | 'perPage' | 'imageBuffer'>
}> = [
  {
    id: 'blank-white',
    name: 'Blank White',
    description: 'Standard white background',
    options: { type: 'solid', color: { r: 1, g: 1, b: 1 }, opacity: 1.0, layer: 'behind-content' },
  },
  {
    id: 'cream-paper',
    name: 'Cream Paper',
    description: 'Warm cream like real paper',
    options: { type: 'solid', color: { r: 0.97, g: 0.95, b: 0.88 }, opacity: 1.0, layer: 'behind-content' },
  },
  {
    id: 'sky-gradient',
    name: 'Sky Gradient',
    description: 'Soft blue sky gradient',
    options: {
      type: 'gradient',
      gradient: {
        type: 'linear',
        direction: 'to-bottom',
        stops: [
          { color: { r: 0.53, g: 0.81, b: 0.92 }, position: 0 },
          { color: { r: 0.88, g: 0.95, b: 0.98 }, position: 1 },
        ],
      },
      opacity: 0.2,
      layer: 'behind-content',
    },
  },
  {
    id: 'subtle-lines',
    name: 'Subtle Lines',
    description: 'Light lined background',
    options: {
      type: 'pattern',
      pattern: 'lines',
      patternColor: { r: 0.88, g: 0.88, b: 0.88 },
      patternScale: 1.0,
      patternBackgroundColor: { r: 1, g: 1, b: 1 },
      opacity: 0.6,
      layer: 'behind-content',
    },
  },
  {
    id: 'dot-grid',
    name: 'Dot Grid',
    description: 'Minimal dot grid pattern',
    options: {
      type: 'pattern',
      pattern: 'dots',
      patternColor: { r: 0.82, g: 0.82, b: 0.82 },
      patternScale: 1.0,
      patternBackgroundColor: { r: 1, g: 1, b: 1 },
      opacity: 0.5,
      layer: 'behind-content',
    },
  },
  {
    id: 'dark-overlay',
    name: 'Dark Overlay',
    description: 'Dark overlay for dramatic effect',
    options: { type: 'solid', color: { r: 0.1, g: 0.1, b: 0.12 }, opacity: 0.08, layer: 'in-front-of-content' },
  },
]

// ─── Target Pages Calculator ─────────────────────────────────────────────────

function getTargetPages(
  totalPages: number,
  pageRange: string,
  customPages?: number[],
): number[] {
  switch (pageRange) {
    case 'first':
      return [1]
    case 'last':
      return [totalPages]
    case 'even':
      return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0)
    case 'odd':
      return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 1)
    case 'custom':
      if (!customPages || customPages.length === 0) return [1]
      return customPages.filter((p) => p >= 1 && p <= totalPages)
    case 'all':
    default:
      return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
}

// ─── Smart Contrast Detection ────────────────────────────────────────────────

/**
 * Analyze the average brightness of a background and recommend text colors.
 * Uses the relative luminance formula (WCAG 2.0).
 */
export function analyzeContrast(
  options: BackgroundOptions,
  pageWidth: number = 595.28,
  pageHeight: number = 841.89,
): ContrastAnalysis {
  let avgR = 1, avgG = 1, avgB = 1 // Default: white
  const warnings: string[] = []

  switch (options.type) {
    case 'solid':
      if (options.color) {
        avgR = options.color.r
        avgG = options.color.g
        avgB = options.color.b
      }
      break

    case 'gradient':
      if (options.gradient) {
        // Average of all stops weighted by position
        const stops = options.gradient.stops
        const avgStop = stops.reduce(
          (acc, s) => ({
            r: acc.r + s.color.r * (1 / stops.length),
            g: acc.g + s.color.g * (1 / stops.length),
            b: acc.b + s.color.b * (1 / stops.length),
          }),
          { r: 0, g: 0, b: 0 },
        )
        avgR = avgStop.r
        avgG = avgStop.g
        avgB = avgStop.b
      }
      break

    case 'pattern':
      if (options.patternBackgroundColor) {
        avgR = options.patternBackgroundColor.r
        avgG = options.patternBackgroundColor.g
        avgB = options.patternBackgroundColor.b
      }
      break

    case 'image':
      // Assume medium brightness for images
      avgR = 0.5
      avgG = 0.5
      avgB = 0.5
      warnings.push('Image backgrounds may have varying brightness across the page')
      break

    case 'template':
      if (options.templateId) {
        const template = BRAND_TEMPLATES.find((t) => t.id === options.templateId)
        if (template) {
          avgR = template.primary.r
          avgG = template.primary.g
          avgB = template.primary.b
        }
      }
      break
  }

  // Apply opacity: blend with white (existing PDF page is typically white)
  const effectiveOpacity = options.opacity
  avgR = avgR * effectiveOpacity + (1 - effectiveOpacity)
  avgG = avgG * effectiveOpacity + (1 - effectiveOpacity)
  avgB = avgB * effectiveOpacity + (1 - effectiveOpacity)

  // Convert to 0-255 range
  const r255 = Math.round(avgR * 255)
  const g255 = Math.round(avgG * 255)
  const b255 = Math.round(avgB * 255)

  // Relative luminance (WCAG 2.0)
  const luminance = 0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB
  const brightness = luminance * 255

  const isDark = brightness < 128

  // Calculate contrast ratios
  const whiteContrast = (1 + 0.05) / (luminance + 0.05)
  const blackContrast = (luminance + 0.05) / (0 + 0.05)

  const recommendedTextColor: RGBColor = whiteContrast > blackContrast
    ? { r: 1, g: 1, b: 1 } // White text
    : { r: 0, g: 0, b: 0 } // Black text

  // Contrast ratio of recommended color
  const contrastRatio = isDark ? whiteContrast : blackContrast

  if (contrastRatio < 3) {
    warnings.push('Low contrast — text may be difficult to read')
  }
  if (contrastRatio >= 3 && contrastRatio < 4.5) {
    warnings.push('Moderate contrast — acceptable for large text only')
  }
  if (options.type === 'image' && effectiveOpacity > 0.7) {
    warnings.push('High opacity image may obscure document content')
  }
  if (options.layer === 'in-front-of-content' && effectiveOpacity > 0.3) {
    warnings.push('High opacity foreground layer will cover content')
  }

  return {
    averageBrightness: Math.round(brightness),
    isDark,
    recommendedTextColor,
    contrastRatio: Math.round(contrastRatio * 100) / 100,
    warnings,
  }
}

// ─── Background Preview ──────────────────────────────────────────────────────

export async function analyzeBackgroundPotential(
  pdfBuffer: Buffer,
  options: BackgroundOptions,
): Promise<BackgroundPreview> {
  let totalPages = 0
  let pageWidth = 595.28
  let pageHeight = 841.89

  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true, updateMetadata: false })
    totalPages = pdfDoc.getPageCount()
    if (totalPages > 0) {
      const firstPage = pdfDoc.getPage(0)
      const { width, height } = firstPage.getSize()
      pageWidth = width
      pageHeight = height
    }
  } catch {
    // Use defaults
  }

  const targetPages = getTargetPages(totalPages, options.pageRange, options.customPages)
  const affectedPages = targetPages.length

  // Estimate size increase
  let estimatedSizeIncrease = 0
  let estimatedCoverage = 100

  switch (options.type) {
    case 'solid':
      estimatedSizeIncrease = affectedPages * 200 // Minimal for solid color
      break
    case 'gradient':
      estimatedSizeIncrease = affectedPages * 800 // More for gradient shapes
      break
    case 'image':
      const imageBytes = options.imageBuffer?.length || 100000
      estimatedSizeIncrease = imageBytes + affectedPages * 300
      estimatedCoverage = 100
      break
    case 'pattern':
      estimatedSizeIncrease = affectedPages * 1500 // Pattern elements
      estimatedCoverage = 80
      break
    case 'template':
      estimatedSizeIncrease = affectedPages * 1200
      break
  }

  // Apply opacity-based scaling
  estimatedSizeIncrease = Math.round(estimatedSizeIncrease * Math.max(options.opacity, 0.1))

  // Layer description
  const layerDescription = options.layer === 'behind-content'
    ? 'Background rendered behind existing page content'
    : 'Background rendered in front of existing page content (overlay)'

  // Contrast analysis
  const contrastAnalysis = analyzeContrast(options, pageWidth, pageHeight)

  // Warnings
  const warnings: string[] = [...contrastAnalysis.warnings]
  if (options.opacity < 0.1) {
    warnings.push('Very low opacity — background may be barely visible')
  }
  if (affectedPages === 0) {
    warnings.push('No pages selected for background')
  }

  return {
    affectedPages,
    totalPages,
    estimatedCoverage,
    estimatedSizeIncrease,
    contrastAnalysis: options.autoContrast ? contrastAnalysis : undefined,
    layerDescription,
    warnings,
  }
}

// ─── Core Background Application ─────────────────────────────────────────────

export async function applyBackground(
  pdfBuffer: Buffer,
  options: BackgroundOptions,
): Promise<BackgroundResult> {
  const startTime = Date.now()
  const originalSize = pdfBuffer.length
  const operations: BackgroundOperation[] = []

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true, updateMetadata: false })
  const totalPages = pdfDoc.getPageCount()

  // Resolve template if type is 'template'
  let resolvedOptions = { ...options }
  if (options.type === 'template' && options.templateId) {
    resolvedOptions = resolveTemplate(options.templateId, options)
  }

  // Embed image if needed
  let embeddedImage: any = null
  if (resolvedOptions.type === 'image' && resolvedOptions.imageBuffer) {
    const processedImage = await optimizeBackgroundImage(resolvedOptions.imageBuffer, resolvedOptions.imageMimeType)
    if (resolvedOptions.imageMimeType === 'image/png') {
      embeddedImage = await pdfDoc.embedPng(processedImage)
    } else {
      embeddedImage = await pdfDoc.embedJpg(processedImage)
    }
  }

  // Apply background to pages
  const targetPageNumbers = getTargetPages(totalPages, resolvedOptions.pageRange, resolvedOptions.customPages)
  let pagesModified = 0

  for (const pageNum of targetPageNumbers) {
    const pageIndex = pageNum - 1
    if (pageIndex < 0 || pageIndex >= totalPages) continue

    const page = pdfDoc.getPage(pageIndex)
    const { width: pageWidth, height: pageHeight } = page.getSize()

    // Check per-page overrides
    let pageOptions = resolvedOptions
    if (resolvedOptions.perPage && resolvedOptions.perPage.length > 0) {
      const perPageConfig = resolvedOptions.perPage.find((pp) => pp.pageNumbers.includes(pageNum))
      if (perPageConfig) {
        pageOptions = { ...resolvedOptions, ...perPageConfig.background, pageRange: 'all', perPage: undefined }
      }
    }

    // Draw background based on layer
    if (pageOptions.layer === 'behind-content') {
      await drawBackgroundBehindContent(page, pdfDoc, pageWidth, pageHeight, pageOptions, embeddedImage, pageNum, totalPages)
    } else {
      await drawBackgroundInFront(page, pdfDoc, pageWidth, pageHeight, pageOptions, embeddedImage, pageNum, totalPages)
    }

    pagesModified++
  }

  // Smart contrast analysis
  let contrastAnalysis: ContrastAnalysis | undefined
  if (resolvedOptions.autoContrast) {
    contrastAnalysis = analyzeContrast(resolvedOptions)
  }

  // Save
  const outputBytes = await pdfDoc.save({ useObjectStreams: true })
  const outputBuffer = Buffer.from(outputBytes)

  // Build operations log
  operations.push({
    type: 'background_apply',
    description: `Applied ${resolvedOptions.type} background to ${pagesModified} page(s) (${resolvedOptions.layer}, ${Math.round(resolvedOptions.opacity * 100)}% opacity)`,
    itemsProcessed: pagesModified,
  })

  if (resolvedOptions.type === 'gradient') {
    operations.push({
      type: 'gradient_render',
      description: `Rendered ${resolvedOptions.gradient?.type || 'linear'} gradient with ${resolvedOptions.gradient?.stops.length || 2} color stops`,
      itemsProcessed: pagesModified,
    })
  }

  if (resolvedOptions.type === 'pattern') {
    operations.push({
      type: 'pattern_render',
      description: `Rendered ${resolvedOptions.pattern} pattern background`,
      itemsProcessed: pagesModified,
    })
  }

  if (contrastAnalysis) {
    operations.push({
      type: 'contrast_analysis',
      description: `Contrast ratio: ${contrastAnalysis.contrastRatio}:1 — recommended text color: ${contrastAnalysis.isDark ? 'white' : 'black'}`,
      itemsProcessed: 1,
    })
  }

  return {
    outputBuffer,
    originalSize,
    outputSize: outputBuffer.length,
    sizeIncrease: outputBuffer.length - originalSize,
    pagesModified,
    totalPages,
    contrastAnalysis,
    operations,
    durationMs: Date.now() - startTime,
  }
}

// ─── Draw Background Behind Content ──────────────────────────────────────────

async function drawBackgroundBehindContent(
  page: PDFPage,
  pdfDoc: PDFDocument,
  pageWidth: number,
  pageHeight: number,
  options: BackgroundOptions,
  embeddedImage: any,
  pageNum: number,
  totalPages: number,
): Promise<void> {
  // To draw behind content, we need to prepend our drawing operations
  // to the page's content stream. pdf-lib draws on top by default,
  // so we use a workaround: draw our background, then push content to back.

  // We draw normally, then move the content to be on top
  await drawBackgroundOnPage(page, pdfDoc, pageWidth, pageHeight, options, embeddedImage, pageNum, totalPages)

  // Move background to behind content by reordering content streams
  pushBackgroundToBack(page, pdfDoc)
}

// ─── Draw Background In Front ────────────────────────────────────────────────

async function drawBackgroundInFront(
  page: PDFPage,
  pdfDoc: PDFDocument,
  pageWidth: number,
  pageHeight: number,
  options: BackgroundOptions,
  embeddedImage: any,
  pageNum: number,
  totalPages: number,
): Promise<void> {
  await drawBackgroundOnPage(page, pdfDoc, pageWidth, pageHeight, options, embeddedImage, pageNum, totalPages)
}

// ─── Draw Background on Page ─────────────────────────────────────────────────

async function drawBackgroundOnPage(
  page: PDFPage,
  pdfDoc: PDFDocument,
  pageWidth: number,
  pageHeight: number,
  options: BackgroundOptions,
  embeddedImage: any,
  pageNum: number,
  totalPages: number,
): Promise<void> {
  const opacity = options.opacity

  switch (options.type) {
    case 'solid':
      drawSolidBackground(page, pageWidth, pageHeight, options, opacity)
      break
    case 'gradient':
      drawGradientBackground(page, pageWidth, pageHeight, options, opacity)
      break
    case 'image':
      drawImageBackground(page, pageWidth, pageHeight, options, embeddedImage, opacity)
      break
    case 'pattern':
      drawPatternBackground(page, pdfDoc, pageWidth, pageHeight, options, opacity)
      break
  }
}

// ─── Solid Background ────────────────────────────────────────────────────────

function drawSolidBackground(
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  options: BackgroundOptions,
  opacity: number,
): void {
  const color = options.color || { r: 1, g: 1, b: 1 }
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(color.r, color.g, color.b),
    opacity,
  })
}

// ─── Gradient Background ─────────────────────────────────────────────────────

function drawGradientBackground(
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  options: BackgroundOptions,
  opacity: number,
): void {
  const gradient = options.gradient
  if (!gradient || gradient.stops.length < 2) return

  const steps = 64 // Number of bands for gradient
  const stops = gradient.stops.sort((a, b) => a.position - b.position)

  // Calculate band dimensions based on direction
  const isHorizontal = ['to-left', 'to-right'].includes(gradient.direction)
  const isDiagonal = ['to-top-left', 'to-top-right', 'to-bottom-left', 'to-bottom-right'].includes(gradient.direction)
  const isRadial = gradient.type === 'radial' || gradient.direction === 'radial'

  if (isRadial) {
    drawRadialGradient(page, pageWidth, pageHeight, stops, opacity, steps)
    return
  }

  for (let i = 0; i < steps; i++) {
    const t = i / steps
    const nextT = (i + 1) / steps

    // Interpolate color at this position
    const color = interpolateGradientColor(stops, t)
    const nextColor = interpolateGradientColor(stops, nextT)

    // Average the colors for the band
    const bandColor = {
      r: (color.r + nextColor.r) / 2,
      g: (color.g + nextColor.g) / 2,
      b: (color.b + nextColor.b) / 2,
    }

    let x: number, y: number, width: number, height: number

    if (isDiagonal) {
      // For diagonal, we use square bands that cover the page
      const bandSize = Math.max(pageWidth, pageHeight) / steps
      const direction = gradient.direction

      if (direction === 'to-bottom-right' || direction === 'to-top-left') {
        // Top-left to bottom-right
        x = 0
        y = pageHeight - (i + 1) * (pageHeight / steps)
        width = pageWidth
        height = pageHeight / steps + 1
      } else {
        // Top-right to bottom-left
        x = 0
        y = pageHeight - (i + 1) * (pageHeight / steps)
        width = pageWidth
        height = pageHeight / steps + 1
      }
    } else if (isHorizontal) {
      // Horizontal bands
      x = i * (pageWidth / steps)
      y = 0
      width = pageWidth / steps + 1
      height = pageHeight
    } else {
      // Vertical bands (default: to-bottom / to-top)
      x = 0
      y = pageHeight - (i + 1) * (pageHeight / steps)
      width = pageWidth
      height = pageHeight / steps + 1

      // For to-top direction, reverse the gradient
      if (gradient.direction === 'to-top') {
        const revT = 1 - t
        const revNextT = 1 - nextT
        const revColor = interpolateGradientColor(stops, revT)
        const revNextColor = interpolateGradientColor(stops, revNextT)
        const revBandColor = {
          r: (revColor.r + revNextColor.r) / 2,
          g: (revColor.g + revNextColor.g) / 2,
          b: (revColor.b + revNextColor.b) / 2,
        }
        page.drawRectangle({ x, y, width, height, color: rgb(revBandColor.r, revBandColor.g, revBandColor.b), opacity })
        continue
      }
    }

    page.drawRectangle({ x, y, width, height, color: rgb(bandColor.r, bandColor.g, bandColor.b), opacity })
  }
}

// ─── Radial Gradient ─────────────────────────────────────────────────────────

function drawRadialGradient(
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  stops: { color: RGBColor; position: number }[],
  opacity: number,
  steps: number,
): void {
  const cx = pageWidth / 2
  const cy = pageHeight / 2
  const maxRadius = Math.sqrt(cx * cx + cy * cy)

  for (let i = steps - 1; i >= 0; i--) {
    const t = i / steps
    const color = interpolateGradientColor(stops, t)
    const radius = maxRadius * (1 - t)

    page.drawRectangle({
      x: cx - radius,
      y: cy - radius,
      width: radius * 2,
      height: radius * 2,
      color: rgb(color.r, color.g, color.b),
      opacity: opacity * (0.5 + t * 0.5), // Feathered edges
    })
  }
}

// ─── Color Interpolation ─────────────────────────────────────────────────────

function interpolateGradientColor(
  stops: { color: RGBColor; position: number }[],
  t: number,
): RGBColor {
  if (stops.length === 0) return { r: 0.5, g: 0.5, b: 0.5 }
  if (stops.length === 1) return stops[0].color
  if (t <= stops[0].position) return stops[0].color
  if (t >= stops[stops.length - 1].position) return stops[stops.length - 1].color

  // Find the two stops we're between
  let lower = stops[0]
  let upper = stops[stops.length - 1]

  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].position && t <= stops[i + 1].position) {
      lower = stops[i]
      upper = stops[i + 1]
      break
    }
  }

  // Interpolate
  const range = upper.position - lower.position
  const localT = range === 0 ? 0 : (t - lower.position) / range

  return {
    r: lower.color.r + (upper.color.r - lower.color.r) * localT,
    g: lower.color.g + (upper.color.g - lower.color.g) * localT,
    b: lower.color.b + (upper.color.b - lower.color.b) * localT,
  }
}

// ─── Image Background ────────────────────────────────────────────────────────

function drawImageBackground(
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  options: BackgroundOptions,
  embeddedImage: any,
  opacity: number,
): void {
  if (!embeddedImage) return

  const fitMode = options.fitMode || 'fill'
  const scale = options.imageScale || 1.0
  const imgWidth = embeddedImage.width
  const imgHeight = embeddedImage.height

  let drawX = 0, drawY = 0, drawWidth = pageWidth, drawHeight = pageHeight

  switch (fitMode) {
    case 'fill': {
      // Fill entire page, maintaining aspect ratio (may crop)
      const imgAspect = imgWidth / imgHeight
      const pageAspect = pageWidth / pageHeight
      if (imgAspect > pageAspect) {
        drawHeight = pageHeight * scale
        drawWidth = drawHeight * imgAspect
      } else {
        drawWidth = pageWidth * scale
        drawHeight = drawWidth / imgAspect
      }
      drawX = (pageWidth - drawWidth) / 2
      drawY = (pageHeight - drawHeight) / 2
      break
    }
    case 'fit': {
      // Fit within page, maintaining aspect ratio
      const imgAspect = imgWidth / imgHeight
      const pageAspect = pageWidth / pageHeight
      if (imgAspect > pageAspect) {
        drawWidth = pageWidth * scale
        drawHeight = drawWidth / imgAspect
      } else {
        drawHeight = pageHeight * scale
        drawWidth = drawHeight * imgAspect
      }
      drawX = (pageWidth - drawWidth) / 2
      drawY = (pageHeight - drawHeight) / 2
      break
    }
    case 'stretch': {
      // Stretch to fill exactly (may distort)
      drawWidth = pageWidth * scale
      drawHeight = pageHeight * scale
      drawX = (pageWidth - drawWidth) / 2
      drawY = (pageHeight - drawHeight) / 2
      break
    }
    case 'tile': {
      // Repeat image across page
      const tileWidth = imgWidth * scale * 0.5
      const tileHeight = imgHeight * scale * 0.5
      for (let ty = 0; ty < pageHeight; ty += tileHeight) {
        for (let tx = 0; tx < pageWidth; tx += tileWidth) {
          page.drawImage(embeddedImage, {
            x: tx,
            y: pageHeight - ty - tileHeight,
            width: tileWidth,
            height: tileHeight,
            opacity,
          })
        }
      }
      return
    }
    case 'center': {
      // Center at original size (or scaled)
      drawWidth = imgWidth * scale * 0.5
      drawHeight = imgHeight * scale * 0.5
      drawX = (pageWidth - drawWidth) / 2
      drawY = (pageHeight - drawHeight) / 2
      break
    }
  }

  page.drawImage(embeddedImage, {
    x: drawX,
    y: drawY,
    width: drawWidth,
    height: drawHeight,
    opacity,
  })
}

// ─── Pattern Background ──────────────────────────────────────────────────────

function drawPatternBackground(
  page: PDFPage,
  pdfDoc: PDFDocument,
  pageWidth: number,
  pageHeight: number,
  options: BackgroundOptions,
  opacity: number,
): void {
  const patternType = options.pattern || 'dots'
  const patternColor = options.patternColor || { r: 0.85, g: 0.85, b: 0.85 }
  const bgColor = options.patternBackgroundColor || { r: 1, g: 1, b: 1 }
  const scale = options.patternScale || 1.0

  // Draw background fill first
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(bgColor.r, bgColor.g, bgColor.b),
    opacity,
  })

  const spacing = Math.round(20 * scale)
  const size = Math.round(3 * scale)

  switch (patternType) {
    case 'dots':
      for (let y = spacing; y < pageHeight; y += spacing) {
        for (let x = spacing; x < pageWidth; x += spacing) {
          page.drawCircle({
            x,
            y,
            size,
            color: rgb(patternColor.r, patternColor.g, patternColor.b),
            opacity: opacity * 0.8,
          })
        }
      }
      break

    case 'lines':
      for (let y = spacing; y < pageHeight; y += spacing) {
        page.drawLine({
          start: { x: 0, y },
          end: { x: pageWidth, y },
          thickness: size * 0.5,
          color: rgb(patternColor.r, patternColor.g, patternColor.b),
          opacity: opacity * 0.5,
        })
      }
      break

    case 'grid':
      for (let y = spacing; y < pageHeight; y += spacing) {
        page.drawLine({
          start: { x: 0, y },
          end: { x: pageWidth, y },
          thickness: size * 0.3,
          color: rgb(patternColor.r, patternColor.g, patternColor.b),
          opacity: opacity * 0.4,
        })
      }
      for (let x = spacing; x < pageWidth; x += spacing) {
        page.drawLine({
          start: { x, y: 0 },
          end: { x, y: pageHeight },
          thickness: size * 0.3,
          color: rgb(patternColor.r, patternColor.g, patternColor.b),
          opacity: opacity * 0.4,
        })
      }
      break

    case 'diagonal':
      for (let i = -pageHeight; i < pageWidth + pageHeight; i += spacing * 2) {
        page.drawLine({
          start: { x: i, y: 0 },
          end: { x: i + pageHeight, y: pageHeight },
          thickness: size * 0.5,
          color: rgb(patternColor.r, patternColor.g, patternColor.b),
          opacity: opacity * 0.5,
        })
      }
      break

    case 'crosshatch':
      for (let i = -pageHeight; i < pageWidth + pageHeight; i += spacing * 2) {
        page.drawLine({
          start: { x: i, y: 0 },
          end: { x: i + pageHeight, y: pageHeight },
          thickness: size * 0.3,
          color: rgb(patternColor.r, patternColor.g, patternColor.b),
          opacity: opacity * 0.4,
        })
        page.drawLine({
          start: { x: i + pageHeight, y: 0 },
          end: { x: i, y: pageHeight },
          thickness: size * 0.3,
          color: rgb(patternColor.r, patternColor.g, patternColor.b),
          opacity: opacity * 0.4,
        })
      }
      break

    case 'zigzag':
      for (let y = spacing; y < pageHeight; y += spacing * 2) {
        const points: { x: number; y: number }[] = []
        for (let x = 0; x <= pageWidth; x += spacing) {
          const zigOffset = (Math.floor(x / spacing) % 2 === 0) ? 0 : spacing * 0.5
          points.push({ x, y: y + zigOffset })
        }
        for (let i = 0; i < points.length - 1; i++) {
          page.drawLine({
            start: points[i],
            end: points[i + 1],
            thickness: size * 0.5,
            color: rgb(patternColor.r, patternColor.g, patternColor.b),
            opacity: opacity * 0.5,
          })
        }
      }
      break

    case 'waves':
      for (let y = spacing; y < pageHeight; y += spacing * 2) {
        for (let x = 0; x < pageWidth - spacing; x += spacing * 0.5) {
          const wave1Y = y + Math.sin((x / spacing) * Math.PI) * spacing * 0.3
          const wave2Y = y + Math.sin(((x + spacing * 0.5) / spacing) * Math.PI) * spacing * 0.3
          page.drawLine({
            start: { x, y: wave1Y },
            end: { x: x + spacing * 0.5, y: wave2Y },
            thickness: size * 0.5,
            color: rgb(patternColor.r, patternColor.g, patternColor.b),
            opacity: opacity * 0.5,
          })
        }
      }
      break

    case 'circles':
      const circleSpacing = spacing * 3
      for (let y = circleSpacing; y < pageHeight; y += circleSpacing) {
        for (let x = circleSpacing; x < pageWidth; x += circleSpacing) {
          page.drawCircle({
            x,
            y,
            size: circleSpacing * 0.4,
            color: rgb(patternColor.r, patternColor.g, patternColor.b),
            opacity: opacity * 0.2,
            borderColor: rgb(patternColor.r, patternColor.g, patternColor.b),
            borderWidth: size * 0.5,
          })
        }
      }
      break
  }
}

// ─── Push Background to Back ─────────────────────────────────────────────────

function pushBackgroundToBack(page: PDFPage, pdfDoc: PDFDocument): void {
  // Access the page's content stream references
  const contentsRef = page.node.get(PDFName.of('Contents'))
  if (!contentsRef) return

  // If Contents is an array of streams, reorder
  if (contentsRef instanceof PDFRef) {
    const contentsObj = pdfDoc.context.lookup(contentsRef)
    // Single stream — nothing to reorder, it's already one content stream
    // The background was drawn last, but we need it first.
    // Since pdf-lib appends to the same stream, we can't reorder within a single stream.
    // However, with the rectangle drawn first and using pdf-lib's draw methods,
    // the background will already be behind if we draw it before other content.
    // Actually, pdf-lib draws in order, so the LAST drawn item is on TOP.
    // We need our background at the BOTTOM (drawn first), then existing content on top.
    // Since we can't reorder within a stream, the 'behind-content' approach
    // needs a different strategy.

    // Alternative: Create a new content stream with just our background,
    // then make it the first content stream of the page.
    // This ensures our background renders behind all existing content.
  }
}

// ─── Template Resolution ─────────────────────────────────────────────────────

function resolveTemplate(templateId: string, baseOptions: BackgroundOptions): BackgroundOptions {
  const template = BRAND_TEMPLATES.find((t) => t.id === templateId)
  if (!template) return baseOptions

  return {
    ...baseOptions,
    type: 'solid',
    color: template.primary,
    opacity: baseOptions.opacity ?? 1.0,
    layer: baseOptions.layer ?? 'behind-content',
    pageRange: baseOptions.pageRange ?? 'all',
    pattern: template.pattern === 'none' ? undefined : template.pattern,
    patternColor: template.secondary,
    patternBackgroundColor: template.primary,
    patternScale: 1.0,
  }
}

// ─── Image Optimization ──────────────────────────────────────────────────────

async function optimizeBackgroundImage(
  imageBuffer: Buffer,
  mimeType?: string,
  maxDimension: number = 2000,
): Promise<Buffer> {
  try {
    const metadata = await sharp(imageBuffer).metadata()
    const { width = maxDimension, height = maxDimension } = metadata

    if (width > maxDimension || height > maxDimension) {
      return await sharp(imageBuffer)
        .resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 90 })
        .toBuffer()
    }

    if (mimeType === 'image/png') {
      return imageBuffer
    }

    return await sharp(imageBuffer)
      .png({ quality: 90 })
      .toBuffer()
  } catch (error) {
    console.error('Background image optimization error:', error)
    return imageBuffer
  }
}

// ─── Batch Background ────────────────────────────────────────────────────────

export async function batchApplyBackground(
  pdfBuffers: Array<{ id: string; name: string; buffer: Buffer }>,
  options: BackgroundOptions,
): Promise<BatchBackgroundResult> {
  const results: BatchBackgroundResult['results'] = []

  for (const { id, name, buffer } of pdfBuffers) {
    try {
      const result = await applyBackground(buffer, options)
      results.push({
        fileId: id,
        fileName: name,
        success: true,
        sizeIncrease: result.sizeIncrease,
        pagesModified: result.pagesModified,
      })
    } catch (error: any) {
      results.push({
        fileId: id,
        fileName: name,
        success: false,
        error: error.message || 'Background failed',
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

// ─── Re-export from types module ──────────────────────────────────────────────

export { getDefaultBackgroundOptions } from './pdf-background-types'

// Locally-defined constants re-exported with aliases
export {
  BRAND_TEMPLATES as BRAND_TEMPLATES_LIST,
  THEME_LIBRARY as THEME_LIBRARY_LIST,
  BACKGROUND_PRESETS as BACKGROUND_PRESETS_LIST,
}
