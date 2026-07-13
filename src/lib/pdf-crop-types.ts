/**
 * PDF Crop Types — Professional-Grade Crop System
 *
 * Supports: Visual crop editor, Auto margin detection, Crop presets,
 * Batch cropping, Undo/redo, Live preview, Different crop per page,
 * Smart whitespace removal, Rotation-aware cropping, AI-assisted crop suggestions
 */

// ─── Core Types ─────────────────────────────────────────────────────────────

export type CropUnit = 'points' | 'inches' | 'mm' | 'percent' | 'pixels'

export type CropMode = 'manual' | 'preset' | 'auto-margin' | 'whitespace' | 'ai-suggest'

export type CropPresetId =
  | 'letter'
  | 'a4'
  | 'legal'
  | 'a3'
  | 'a5'
  | 'tabloid'
  | 'half-letter'
  | 'square'
  | '4x6'
  | '5x7'
  | '8x10'
  | '16x9'
  | 'no-margins'
  | '0.5in-margins'
  | '1in-margins'
  | 'custom'

export type PageRange = 'all' | 'even' | 'odd' | 'first' | 'last' | 'custom'

export type RotationAngle = 0 | 90 | 180 | 270

// ─── Crop Box ────────────────────────────────────────────────────────────────

export interface CropBox {
  /** Offset from left edge in points (1 point = 1/72 inch) */
  left: number
  /** Offset from bottom edge in points */
  bottom: number
  /** Offset from right edge in points */
  right: number
  /** Offset from top edge in points */
  top: number
}

// ─── Page Dimensions ─────────────────────────────────────────────────────────

export interface PageDimensions {
  width: number
  height: number
  rotation: RotationAngle
}

// ─── Auto Margin Detection ───────────────────────────────────────────────────

export interface MarginDetection {
  left: number
  bottom: number
  right: number
  top: number
  contentAreaWidth: number
  contentAreaHeight: number
  confidence: number // 0-1
}

// ─── Whitespace Analysis ─────────────────────────────────────────────────────

export interface WhitespaceAnalysis {
  hasWhitespace: boolean
  whitespaceAmount: 'none' | 'minimal' | 'moderate' | 'excessive'
  suggestedCrop: CropBox
  removedArea: number // percentage of total area
}

// ─── AI Crop Suggestion ──────────────────────────────────────────────────────

export interface AICropSuggestion {
  suggestedCrop: CropBox
  confidence: number // 0-1
  reasoning: string
  detectedElements: string[] // e.g. ['text-block', 'image', 'header', 'footer']
  alternativeCrops: Array<{
    crop: CropBox
    label: string
    description: string
  }>
}

// ─── Crop Preset ─────────────────────────────────────────────────────────────

export interface CropPreset {
  id: CropPresetId
  name: string
  description: string
  category: 'paper-size' | 'photo-size' | 'margin' | 'aspect-ratio'
  /** Width in points (if fixed size) */
  width?: number
  /** Height in points (if fixed size) */
  height?: number
  /** Margins in points (if margin preset) */
  margins?: CropBox
  /** Aspect ratio as width:height (if aspect ratio preset) */
  aspectRatio?: number
}

// ─── Per-Page Crop ───────────────────────────────────────────────────────────

export interface PageCrop {
  pageNumbers: number[] // 1-indexed
  cropBox: CropBox
  rotation?: RotationAngle
}

// ─── Undo/Redo ───────────────────────────────────────────────────────────────

export interface CropHistoryEntry {
  id: string
  timestamp: number
  description: string
  cropBox: CropBox
  pageRange: PageRange
  customPages?: number[]
  perPage?: PageCrop[]
}

// ─── Main Options ────────────────────────────────────────────────────────────

export interface CropOptions {
  /** Crop mode */
  mode: CropMode

  /** Manual crop box (margins from edges in points) */
  cropBox: CropBox

  /** Preset to use */
  presetId?: CropPresetId

  /** Custom preset dimensions */
  customWidth?: number // in points
  customHeight?: number // in points

  /** Page range */
  pageRange: PageRange
  customPages?: number[]

  /** Per-page crop overrides */
  perPage?: PageCrop[]

  /** Rotation to apply before cropping */
  rotation: RotationAngle

  /** Unit for display */
  unit: CropUnit

  /** Auto margin detection sensitivity (0-1) */
  marginSensitivity: number

  /** Whitespace removal threshold (0-1) */
  whitespaceThreshold: number

  /** Whether to use AI suggestions */
  useAISuggestion: boolean

  /** Maintain aspect ratio when cropping */
  maintainAspectRatio: boolean
  aspectRatio?: number // width/height

  /** Anchor point for crop (which part of page to keep) */
  anchor: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

// ─── Preview ─────────────────────────────────────────────────────────────────

export interface CropPreview {
  totalPages: number
  affectedPages: number
  pageDimensions: PageDimensions[]
  originalSize: { width: number; height: number }
  croppedSize: { width: number; height: number }
  areaRemoved: number // percentage
  marginDetection?: MarginDetection
  whitespaceAnalysis?: WhitespaceAnalysis
  aiSuggestion?: AICropSuggestion
  warnings: string[]
}

// ─── Result ──────────────────────────────────────────────────────────────────

export interface CropResult {
  outputBuffer: Buffer
  originalSize: number
  outputSize: number
  sizeIncrease: number
  pagesCropped: number
  totalPages: number
  operations: CropOperation[]
  durationMs: number
}

export interface CropOperation {
  type: string
  description: string
  itemsProcessed: number
}

// ─── Batch ───────────────────────────────────────────────────────────────────

export interface BatchCropResult {
  results: Array<{
    fileId: string
    fileName: string
    success: boolean
    error?: string
    pagesCropped?: number
  }>
  summary: {
    total: number
    success: number
    errors: number
  }
}

// ─── Crop Presets Library ────────────────────────────────────────────────────

export const CROP_PRESETS: CropPreset[] = [
  // Paper sizes
  { id: 'letter', name: 'US Letter', description: '8.5 × 11 in', category: 'paper-size', width: 612, height: 792 },
  { id: 'a4', name: 'A4', description: '210 × 297 mm', category: 'paper-size', width: 595.28, height: 841.89 },
  { id: 'legal', name: 'US Legal', description: '8.5 × 14 in', category: 'paper-size', width: 612, height: 1008 },
  { id: 'a3', name: 'A3', description: '297 × 420 mm', category: 'paper-size', width: 841.89, height: 1190.55 },
  { id: 'a5', name: 'A5', description: '148 × 210 mm', category: 'paper-size', width: 419.53, height: 595.28 },
  { id: 'tabloid', name: 'Tabloid', description: '11 × 17 in', category: 'paper-size', width: 792, height: 1224 },
  { id: 'half-letter', name: 'Half Letter', description: '5.5 × 8.5 in', category: 'paper-size', width: 396, height: 612 },
  // Photo sizes
  { id: '4x6', name: '4×6', description: '4 × 6 in photo', category: 'photo-size', width: 288, height: 432 },
  { id: '5x7', name: '5×7', description: '5 × 7 in photo', category: 'photo-size', width: 360, height: 504 },
  { id: '8x10', name: '8×10', description: '8 × 10 in photo', category: 'photo-size', width: 576, height: 720 },
  { id: 'square', name: 'Square', description: 'Equal width and height', category: 'photo-size', width: 612, height: 612 },
  // Margin presets
  { id: 'no-margins', name: 'No Margins', description: 'Remove all margins', category: 'margin', margins: { left: 0, bottom: 0, right: 0, top: 0 } },
  { id: '0.5in-margins', name: '0.5" Margins', description: 'Standard 0.5 inch margins', category: 'margin', margins: { left: 36, bottom: 36, right: 36, top: 36 } },
  { id: '1in-margins', name: '1" Margins', description: 'Standard 1 inch margins', category: 'margin', margins: { left: 72, bottom: 72, right: 72, top: 72 } },
  // Aspect ratio
  { id: '16x9', name: '16:9', description: 'Widescreen ratio', category: 'aspect-ratio', aspectRatio: 16 / 9 },
  { id: 'custom', name: 'Custom', description: 'Custom crop dimensions', category: 'paper-size' },
]

// ─── Default Options ─────────────────────────────────────────────────────────

export function getDefaultCropOptions(): CropOptions {
  return {
    mode: 'manual',
    cropBox: { left: 36, bottom: 36, right: 36, top: 36 }, // 0.5 inch margins
    pageRange: 'all',
    rotation: 0,
    unit: 'points',
    marginSensitivity: 0.5,
    whitespaceThreshold: 0.95,
    useAISuggestion: false,
    maintainAspectRatio: false,
    anchor: 'center',
  }
}
