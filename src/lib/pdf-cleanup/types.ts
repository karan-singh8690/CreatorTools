/**
 * PDF Background & Watermark Removal Tool — shared types & API contract.
 *
 * This module is the single source of truth for the cleanup tool's data
 * shapes. Both the API routes and the React frontend import from here.
 */

// ─── Processing modes ────────────────────────────────────────────────────────

export type CleanupMode =
  | 'watermark' // Remove watermarks only (text/transparent/repeated logos)
  | 'background' // Remove colored/gray backgrounds only
  | 'clean-scan' // Clean scanned pages (denoise, threshold, sharpen)
  | 'full'; // Full AI cleanup (watermarks + backgrounds + scan noise + stamps)

export const CLEANUP_MODES: { id: CleanupMode; label: string; description: string }[] = [
  { id: 'watermark', label: 'Remove Watermark', description: 'Detect & remove text, transparent, rotated & repeated watermark logos' },
  { id: 'background', label: 'Remove Background', description: 'Strip colored backgrounds, gray paper, scanner shadows & textures' },
  { id: 'clean-scan', label: 'Clean Scan', description: 'Denoise, threshold & sharpen scanned pages into clean white paper' },
  { id: 'full', label: 'Full AI Cleanup', description: 'Automatically remove watermarks, backgrounds, stamps & scan artifacts' },
];

// ─── Quality levels ──────────────────────────────────────────────────────────

export type QualityLevel = 'fast' | 'balanced' | 'high' | 'maximum';

export const QUALITY_LEVELS: { id: QualityLevel; label: string; description: string; dpi: number }[] = [
  { id: 'fast', label: 'Fast', description: 'Quickest processing, good quality', dpi: 150 },
  { id: 'balanced', label: 'Balanced', description: 'Recommended for most documents', dpi: 200 },
  { id: 'high', label: 'High Quality', description: 'Sharper text, larger output', dpi: 300 },
  { id: 'maximum', label: 'Maximum Quality', description: 'Archive-grade, slowest', dpi: 400 },
];

// ─── Output formats ──────────────────────────────────────────────────────────

export type OutputFormat =
  | 'original' // Original quality PDF
  | 'compressed' // Compressed PDF (ghostscript)
  | 'searchable' // Searchable PDF (with OCR text layer)
  | 'flattened'; // Flattened PDF (no layers, image-based)

export const OUTPUT_FORMATS: { id: OutputFormat; label: string; description: string }[] = [
  { id: 'original', label: 'Original Quality', description: 'Full fidelity · searchable text preserved' },
  { id: 'compressed', label: 'Compressed', description: 'Smaller file via Ghostscript · searchable text preserved' },
  { id: 'searchable', label: 'Searchable', description: 'Force OCR on scans (text PDFs already preserved)' },
  { id: 'flattened', label: 'Flattened', description: 'Image-only · discards text layer' },
];

// ─── Advanced options ────────────────────────────────────────────────────────

export interface CleanupOptions {
  mode: CleanupMode;
  quality: QualityLevel;
  outputFormat: OutputFormat;

  // Toggle checkboxes
  removeWatermark: boolean;
  removeBackground: boolean;
  cleanScan: boolean;
  improveReadability: boolean;
  preserveImages: boolean;
  preserveColors: boolean;
  preserveSignatures: boolean;
  keepTransparency: boolean;
  runOcr: boolean;
  compressAfter: boolean;

  // Page range (1-indexed, inclusive). null = all pages.
  pageRange: { from: number; to: number } | null;
}

export const DEFAULT_OPTIONS: CleanupOptions = {
  mode: 'full',
  quality: 'balanced',
  outputFormat: 'original',
  removeWatermark: true,
  removeBackground: true,
  cleanScan: false,
  improveReadability: true,
  preserveImages: true,
  preserveColors: false,
  preserveSignatures: true,
  keepTransparency: false,
  runOcr: false,
  compressAfter: false,
  pageRange: null,
};

// ─── Processing progress ─────────────────────────────────────────────────────

export type ProgressStage =
  | 'queued'
  | 'uploading'
  | 'analyzing'
  | 'detecting-watermarks'
  | 'cleaning-background'
  | 'cleaning-scan'
  | 'running-ocr'
  | 'optimizing'
  | 'preparing-download'
  | 'complete'
  | 'error';

export interface ProgressUpdate {
  stage: ProgressStage;
  message: string;
  currentPage?: number;
  totalPages?: number;
  percent: number; // 0..100 overall
}

// ─── Detection / analysis results ────────────────────────────────────────────

export type PdfKind = 'vector' | 'scanned' | 'mixed';

export interface DetectionResult {
  kind: PdfKind;
  pageCount: number;
  hasTextLayer: boolean;
  hasImages: boolean;
  /** Detected watermark candidates (text-based). */
  watermarkCandidates: WatermarkCandidate[];
  /** Detected background rectangles (vector). */
  backgroundCandidates: BackgroundCandidate[];
  /** Avg brightness 0..255 of rendered pages (for scanned heuristic). */
  avgBrightness: number;
  estimatedSeconds: number;
}

export interface WatermarkCandidate {
  page: number;
  text: string;
  /** Rotation in degrees. */
  rotation: number;
  fontSize: number;
  opacity: number; // 0..1
  /** Bounding box in PDF points. */
  bbox: { x: number; y: number; width: number; height: number };
  reasons: string[]; // why we think it's a watermark
}

export interface BackgroundCandidate {
  page: number;
  /** Fill color as [r,g,b] 0..255. */
  color: [number, number, number];
  opacity: number;
  bbox: { x: number; y: number; width: number; height: number };
}

// ─── API: request/response shapes ────────────────────────────────────────────

/** POST /api/cleanup/analyze — analyze a PDF (detect watermarks/backgrounds). */
export interface AnalyzeResponse {
  ok: boolean;
  jobId: string;
  detection: DetectionResult;
}

/** POST /api/remove-background | /api/remove-watermark | /api/clean-scan
 *  Multipart form: file=<pdf>, options=<json>.
 *  Returns a job descriptor the client polls. */
export interface CleanupStartResponse {
  ok: boolean;
  jobId: string;
  totalPages: number;
  estimatedSeconds: number;
}

/** GET /api/cleanup/status?jobId=... — poll progress. */
export interface CleanupStatusResponse {
  ok: boolean;
  jobId: string;
  stage: ProgressStage;
  message: string;
  currentPage?: number;
  totalPages?: number;
  percent: number;
  resultUrl?: string; // available when stage === 'complete'
  error?: string;
  outputFileName?: string;
  outputSizeBytes?: number;
  originalSizeBytes?: number;
  reductionPercent?: number;
}

/** POST /api/preview-clean — generate before/after preview for one page.
 *  Multipart form: file=<pdf>, page=<n>, options=<json>. */
export interface PreviewCleanResponse {
  ok: boolean;
  beforeUrl: string;
  afterUrl: string;
  page: number;
  width: number;
  height: number;
}

/** GET /api/cleanup/download?jobId=... — stream the result PDF. */
// (binary PDF stream, Content-Disposition: attachment)

// ─── Watermark heuristics ────────────────────────────────────────────────────

/** Keywords that strongly indicate watermark text. Case-insensitive. */
export const WATERMARK_KEYWORDS = [
  'draft',
  'confidential',
  'sample',
  'do not copy',
  'internal',
  'not for distribution',
  'property of',
  'watermark',
  'trial',
  'evaluation',
  'demo',
  'copy',
  'urgent',
  'void',
  'specimen',
];

export function isLikelyWatermarkText(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length === 0) return false;
  return WATERMARK_KEYWORDS.some((kw) => t.includes(kw));
}
