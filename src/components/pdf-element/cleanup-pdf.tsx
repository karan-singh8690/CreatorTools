'use client'

/**
 * CleanupPdf — PDF Background & Watermark Removal tool.
 *
 * Pipeline:
 *   1. User drops/selects a PDF → POST /api/cleanup/analyze → detection summary
 *   2. User picks mode + quality + advanced options
 *   3. Optional: per-page before/after preview via POST /api/preview-clean
 *   4. User clicks "Start Cleaning" → POST /api/{remove-background | remove-
 *      watermark | clean-scan} (see MODE_ENDPOINTS) → returns jobId
 *   5. Poll GET /api/cleanup/status?jobId=… every 1s until stage=complete|error
 *   6. Show success card with output stats + Download button (→ resultUrl),
 *      or error card with retry.
 *
 * Mode → endpoint mapping lives in @/hooks/use-cleanup-job. Critically, for
 * `full` mode we POST to /api/remove-background (which force-overrides
 * options.mode='background'); the orchestrator in lib/pdf-cleanup/index.ts
 * honors the individual boolean flags (removeWatermark/removeBackground/
 * cleanScan) which we set to true for full mode, so all cleanup paths fire.
 *
 * Batch mode uses the same helpers (startCleanupJob + pollCleanupStatus) but
 * tracks N files independently. Completed results can be downloaded as a ZIP
 * via JSZip.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import JSZip from 'jszip'
import {
  Sparkles,
  Wand2,
  FileText,
  Upload,
  X,
  Loader2,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  Combine,
  ArrowUp,
  ArrowDown,
  Plus,
  Image as ImageIcon,
  ScanLine,
  Eraser,
  Settings2,
  ZoomIn,
  ZoomOut,
  Clock,
  FileArchive,
  Play,
  Trash2,
  AlertTriangle,
  Droplets,
  Palette,
  Type,
  ShieldCheck,
  Eye,
  Grip,
  ListChecks,
} from 'lucide-react'

import { useAppStore, formatFileSize } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  useCleanupJob,
  startCleanupJob,
  startCombineJob,
  pollCleanupStatus,
  cancelCleanupJob,
  stageLabel,
  friendlyError,
} from '@/hooks/use-cleanup-job'
import { BeforeAfterSlider } from '@/components/pdf-element/preview-slider'
import {
  CLEANUP_MODES,
  QUALITY_LEVELS,
  OUTPUT_FORMATS,
  CleanupMode,
  CleanupOptions,
  DEFAULT_OPTIONS,
  DetectionResult,
  PreviewCleanResponse,
  AnalyzeResponse,
  CleanupStatusResponse,
  ProgressStage,
} from '@/lib/pdf-cleanup/types'

const MAX_FILE_BYTES = 500 * 1024 * 1024 // 500 MB

// ─── Mode card icons ─────────────────────────────────────────────────────────
const MODE_ICON: Record<CleanupMode, React.ElementType> = {
  watermark: Eraser,
  background: Palette,
  'clean-scan': ScanLine,
  full: Sparkles,
}

const KIND_LABEL: Record<DetectionResult['kind'], string> = {
  vector: 'Vector',
  scanned: 'Scanned',
  mixed: 'Mixed',
}

const KIND_TONE: Record<DetectionResult['kind'], string> = {
  vector: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  scanned: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  mixed: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
}

// ─── Small UI primitives ─────────────────────────────────────────────────────

function SectionLabel({
  icon: Icon,
  children,
  hint,
}: {
  icon: React.ElementType
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <h3 className="text-xs font-semibold text-foreground">{children}</h3>
      {hint && <span className="text-[10px] text-muted-foreground">· {hint}</span>}
    </div>
  )
}

// ─── Upload zone ─────────────────────────────────────────────────────────────

interface UploadZoneProps {
  onFile: (file: File) => void
  disabled?: boolean
}

function UploadZone({ onFile, disabled }: UploadZoneProps) {
  const { toast } = useToast()
  const onDrop = useCallback(
    (accepted: File[], rejections: { errors: { code: string; message: string }[] }[]) => {
      if (rejections.length > 0) {
        const err = rejections[0].errors[0]
        if (err.code === 'file-too-large') {
          toast({
            title: 'File too large',
            description: 'Max 500 MB per file.',
            variant: 'destructive',
          })
        } else if (err.code === 'file-invalid-type') {
          toast({
            title: 'Unsupported file',
            description: 'Only PDF files are supported.',
            variant: 'destructive',
          })
        } else {
          toast({ title: 'Upload failed', description: err.message, variant: 'destructive' })
        }
        return
      }
      if (accepted.length > 0) onFile(accepted[0])
    },
    [onFile, toast]
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_BYTES,
    multiple: false,
    disabled,
    noClick: true, // we use a Browse button instead of click-anywhere
    noKeyboard: false,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors',
        isDragActive
          ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
          : 'border-border bg-card hover:border-rose-300 dark:hover:border-rose-800',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      <input {...getInputProps()} aria-label="Upload PDF file" />
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/40">
        <Upload className="h-6 w-6 text-rose-600" />
      </div>
      <p className="text-sm font-medium text-foreground">
        {isDragActive ? 'Drop the PDF here…' : 'Drag & drop PDF files here or browse files from your computer'}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Max 500 MB per file · Up to 1000 pages
      </p>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="mt-4 bg-rose-600 hover:bg-rose-700"
        onClick={open}
        disabled={disabled}
      >
        <FileText className="h-3.5 w-3.5" />
        Browse Files
      </Button>
    </div>
  )
}

// ─── File info card ──────────────────────────────────────────────────────────

interface FileInfoCardProps {
  file: File
  detection: DetectionResult | null
  isAnalyzing: boolean
  onClear: () => void
}

function FileInfoCard({ file, detection, isAnalyzing, onClear }: FileInfoCardProps) {
  return (
    <Card className="border-rose-200/60 bg-rose-50/30 dark:border-rose-900/60 dark:bg-rose-950/10">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/60">
              <FileText className="h-5 w-5 text-rose-600" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{file.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {formatFileSize(file.size)}
                {detection && (
                  <>
                    {' · '}
                    {detection.pageCount} page{detection.pageCount !== 1 ? 's' : ''}
                  </>
                )}
                {detection && (
                  <>
                    {' · '}
                    <Clock className="inline h-3 w-3 -translate-y-0.5" /> ~
                    {Math.max(1, Math.round(detection.estimatedSeconds))}s
                  </>
                )}
              </div>
              {detection && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={cn('border', KIND_TONE[detection.kind])}>
                    {KIND_LABEL[detection.kind]}
                  </Badge>
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    <Droplets className="h-3 w-3" />
                    {detection.watermarkCandidates.length} watermark
                    {detection.watermarkCandidates.length !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    <Palette className="h-3 w-3" />
                    {detection.backgroundCandidates.length} background layer
                    {detection.backgroundCandidates.length !== 1 ? 's' : ''}
                  </Badge>
                  {detection.hasTextLayer && (
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      <Type className="h-3 w-3" />
                      Text layer
                    </Badge>
                  )}
                  {detection.hasImages && (
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      <ImageIcon className="h-3 w-3" />
                      Images
                    </Badge>
                  )}
                </div>
              )}
              {isAnalyzing && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analyzing PDF structure…
                </div>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs text-muted-foreground"
            onClick={onClear}
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Mode selector ───────────────────────────────────────────────────────────

interface ModeSelectorProps {
  value: CleanupMode
  onChange: (mode: CleanupMode) => void
}

function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div>
      <SectionLabel icon={Sparkles} hint="Choose what to remove">
        Cleanup Mode
      </SectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CLEANUP_MODES.map((m) => {
          const Icon = MODE_ICON[m.id]
          const active = value === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              aria-pressed={active}
              className={cn(
                'flex flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left transition-all',
                active
                  ? 'border-rose-500 bg-rose-50/60 shadow-sm dark:bg-rose-950/30'
                  : 'border-border bg-card hover:border-rose-300 dark:hover:border-rose-800'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md',
                  active
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span
                className={cn(
                  'text-xs font-semibold',
                  active ? 'text-rose-700 dark:text-rose-300' : 'text-foreground'
                )}
              >
                {m.label}
              </span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                {m.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Quality selector ────────────────────────────────────────────────────────

interface QualitySelectorProps {
  value: CleanupOptions['quality']
  onChange: (q: CleanupOptions['quality']) => void
}

function QualitySelector({ value, onChange }: QualitySelectorProps) {
  return (
    <div>
      <SectionLabel icon={Settings2} hint="Higher = sharper & slower">
        Quality Level
      </SectionLabel>
      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUALITY_LEVELS.map((q) => {
            const active = value === q.id
            return (
              <Tooltip key={q.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onChange(q.id)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-lg border-2 px-3 py-2 text-left transition-all',
                      active
                        ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/30'
                        : 'border-border bg-card hover:border-rose-300 dark:hover:border-rose-800'
                    )}
                  >
                    <div
                      className={cn(
                        'text-xs font-semibold',
                        active ? 'text-rose-700 dark:text-rose-300' : 'text-foreground'
                      )}
                    >
                      {q.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{q.dpi} DPI</div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  {q.description}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
    </div>
  )
}

// ─── Output format selector ──────────────────────────────────────────────────

interface OutputFormatSelectorProps {
  value: CleanupOptions['outputFormat']
  onChange: (f: CleanupOptions['outputFormat']) => void
}

function OutputFormatSelector({ value, onChange }: OutputFormatSelectorProps) {
  return (
    <div>
      <SectionLabel icon={Layers} hint="PDF output style">
        Output Format
      </SectionLabel>
      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {OUTPUT_FORMATS.map((f) => {
            const active = value === f.id
            return (
              <Tooltip key={f.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onChange(f.id)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-lg border-2 px-3 py-2 text-left transition-all',
                      active
                        ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/30'
                        : 'border-border bg-card hover:border-rose-300 dark:hover:border-rose-800'
                    )}
                  >
                    <div
                      className={cn(
                        'text-xs font-semibold',
                        active ? 'text-rose-700 dark:text-rose-300' : 'text-foreground'
                      )}
                    >
                      {f.label}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs">
                  {f.description}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
    </div>
  )
}

// ─── Advanced options ────────────────────────────────────────────────────────

interface AdvancedOptionsProps {
  options: CleanupOptions
  setOptions: React.Dispatch<React.SetStateAction<CleanupOptions>>
}

const CHECKBOX_FIELDS: {
  key: keyof CleanupOptions
  label: string
  hint: string
  icon: React.ElementType
}[] = [
  { key: 'removeWatermark', label: 'Remove Watermark', hint: 'Strip text/logo watermarks', icon: Eraser },
  { key: 'removeBackground', label: 'Remove Background', hint: 'Strip colored backgrounds', icon: Palette },
  { key: 'cleanScan', label: 'Clean Scan', hint: 'Denoise & threshold scanned pages', icon: ScanLine },
  { key: 'improveReadability', label: 'Improve Readability', hint: 'Boost contrast & sharpen text', icon: Type },
  { key: 'preserveImages', label: 'Preserve Images', hint: 'Keep images intact during cleanup', icon: ImageIcon },
  { key: 'preserveColors', label: 'Preserve Colors', hint: 'Keep original color information', icon: Palette },
  { key: 'preserveSignatures', label: 'Preserve Signatures', hint: 'Protect handwritten signature regions', icon: ShieldCheck },
  { key: 'keepTransparency', label: 'Keep Transparency', hint: 'Preserve alpha channel in output', icon: Layers },
  { key: 'runOcr', label: 'Run OCR', hint: 'OCR scanned PDFs to make them searchable (text PDFs already preserved)', icon: ScanLine },
  { key: 'compressAfter', label: 'Compress After Cleaning', hint: 'Run Ghostscript for smaller file', icon: FileArchive },
]

function AdvancedOptions({ options, setOptions }: AdvancedOptionsProps) {
  const [open, setOpen] = useState(false)

  const toggle = (key: keyof CleanupOptions) => (checked: boolean) => {
    setOptions((o) => ({ ...o, [key]: checked }))
  }

  const setRangeField = (field: 'from' | 'to', value: string) => {
    setOptions((o) => {
      const current = o.pageRange ?? { from: 0, to: 0 }
      const num = value === '' ? null : Math.max(1, parseInt(value, 10))
      const next = { ...current, [field]: num ?? 0 }
      // If both fields are blank, treat as "all pages".
      if (next.from === 0 && next.to === 0) {
        return { ...o, pageRange: null }
      }
      return { ...o, pageRange: next }
    })
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5" />
            Advanced Options
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4">
        {/* Toggle checkboxes */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CHECKBOX_FIELDS.map((f) => {
            const val = options[f.key] as boolean
            const Icon = f.icon
            return (
              <label
                key={f.key}
                htmlFor={`opt-${f.key}`}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors',
                  val
                    ? 'border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20'
                    : 'border-border bg-card hover:bg-accent/40'
                )}
              >
                <Checkbox
                  id={`opt-${f.key}`}
                  checked={val}
                  onCheckedChange={(c) => toggle(f.key)(c === true)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{f.label}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{f.hint}</div>
                </div>
              </label>
            )
          })}
        </div>

        <Separator />

        {/* Page range */}
        <div>
          <SectionLabel icon={ListChecks} hint="Leave blank for all pages">
            Page Range
          </SectionLabel>
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="pg-from" className="text-[10px] text-muted-foreground">
                From
              </Label>
              <Input
                id="pg-from"
                type="number"
                min={1}
                placeholder="1"
                className="h-8 w-24"
                value={options.pageRange?.from ?? ''}
                onChange={(e) => setRangeField('from', e.target.value)}
              />
            </div>
            <span className="mt-5 text-xs text-muted-foreground">—</span>
            <div className="flex flex-col gap-1">
              <Label htmlFor="pg-to" className="text-[10px] text-muted-foreground">
                To
              </Label>
              <Input
                id="pg-to"
                type="number"
                min={1}
                placeholder="end"
                className="h-8 w-24"
                value={options.pageRange?.to ?? ''}
                onChange={(e) => setRangeField('to', e.target.value)}
              />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Preview panel ───────────────────────────────────────────────────────────

interface PreviewPanelProps {
  file: File
  pageCount: number
  options: CleanupOptions
}

function PreviewPanel({ file, pageCount, options }: PreviewPanelProps) {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(false)
  const [preview, setPreview] = useState<PreviewCleanResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPreview = useCallback(
    async (targetPage: number, opts: CleanupOptions) => {
      if (!file) return
      setLoading(true)
      setError(null)
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('page', String(targetPage))
        form.append('options', JSON.stringify(opts))
        const res = await fetch('/api/preview-clean', { method: 'POST', body: form })
        const data = (await res.json().catch(() => ({}))) as PreviewCleanResponse & {
          error?: string
        }
        if (!res.ok || !data?.ok) {
          throw new Error(data.error || 'Preview failed')
        }
        setPreview(data)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Preview failed'
        setError(msg)
        setPreview(null)
      } finally {
        setLoading(false)
      }
    },
    [file]
  )

  // Debounced fetch on page/options change.
  useEffect(() => {
    const t = setTimeout(() => {
      void fetchPreview(page, options)
    }, 400)
    return () => clearTimeout(t)
  }, [page, file, options.mode, options.quality, options.removeWatermark, options.removeBackground, options.cleanScan, options.improveReadability, options.preserveColors, options.keepTransparency, fetchPreview])

  const goPrev = () => setPage((p) => Math.max(1, p - 1))
  const goNext = () => setPage((p) => Math.min(pageCount, p + 1))

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex h-full flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-rose-600" />
            <h3 className="text-sm font-semibold text-foreground">Before / After Preview</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom((z) => !z)}
              aria-label={zoom ? 'Zoom out' : 'Zoom in'}
              title={zoom ? 'Zoom out' : 'Zoom in'}
            >
              {zoom ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => void fetchPreview(page, options)}
              disabled={loading}
              aria-label="Refresh preview"
              title="Refresh preview"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Page navigation */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={page <= 1 || loading}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </Button>
          <span className="text-xs font-medium text-muted-foreground">
            Page <span className="text-foreground">{page}</span> of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={page >= pageCount || loading}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Slider */}
        <div
          className={cn(
            'mx-auto flex flex-1 items-center justify-center',
            zoom && 'max-h-[70vh] overflow-auto'
          )}
        >
          {error ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <AlertCircle className="h-6 w-6 text-amber-500" />
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchPreview(page, options)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : (
            <BeforeAfterSlider
              beforeUrl={preview?.beforeUrl || ''}
              afterUrl={preview?.afterUrl || ''}
              width={preview?.width}
              height={preview?.height}
              loading={loading || !preview}
              className={cn('w-full', zoom ? 'max-w-none' : 'max-w-md')}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Processing / progress panel ─────────────────────────────────────────────

interface ProcessingPanelProps {
  file: File
  options: CleanupOptions
  onStart: () => void
  // From useCleanupJob
  state: ReturnType<typeof useCleanupJob>['state']
  status: CleanupStatusResponse | null
  onCancel: () => void
  onReset: () => void
  isStarting: boolean
}

function ProcessingPanel({
  file,
  options,
  onStart,
  state,
  status,
  onCancel,
  onReset,
  isStarting,
}: ProcessingPanelProps) {
  const { toast } = useToast()

  const handleDownload = () => {
    if (!status?.resultUrl) return
    // Open the result URL — Content-Disposition: attachment triggers download.
    const a = document.createElement('a')
    a.href = status.resultUrl!
    a.download = status.outputFileName || `${file.name.replace(/\.pdf$/i, '')}-cleaned.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast({ title: 'Download started', description: a.download })
  }

  // ── Idle: show Start button ────────────────────────────────────────────────
  if (state === 'idle' || state === 'canceled') {
    return (
      <div className="space-y-3">
        <Button
          type="button"
          size="lg"
          className="w-full bg-rose-600 text-white hover:bg-rose-700"
          onClick={onStart}
          disabled={isStarting}
        >
          {isStarting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting…
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              Start Cleaning
            </>
          )}
        </Button>
        {state === 'canceled' && (
          <p className="text-center text-[11px] text-muted-foreground">
            Job was canceled. Click Start to retry.
          </p>
        )}
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state === 'error') {
    const msg = friendlyError(status?.error || status?.message, undefined)
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-destructive">Cleaning Failed</h4>
              <p className="mt-1 text-xs text-muted-foreground">{msg}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="default" onClick={onStart}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
                <Button size="sm" variant="outline" onClick={onReset}>
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  if (state === 'complete' && status) {
    const orig = status.originalSizeBytes ?? file.size
    const out = status.outputSizeBytes ?? 0
    const reduction = status.reductionPercent ?? (orig > 0 ? Math.max(0, Math.round((1 - out / orig) * 100)) : 0)
    return (
      <Card className="border-emerald-300/60 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Cleanup Complete!
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your cleaned PDF is ready to download.
              </p>

              {/* Stats grid */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border bg-card p-2 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground">Original</div>
                  <div className="text-xs font-semibold text-foreground">{formatFileSize(orig)}</div>
                </div>
                <div className="rounded-lg border border-border bg-card p-2 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground">Cleaned</div>
                  <div className="text-xs font-semibold text-foreground">{formatFileSize(out)}</div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
                  <div className="text-[10px] uppercase text-muted-foreground">Reduction</div>
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {reduction}%
                  </div>
                </div>
              </div>

              <div className="mt-2 truncate text-[11px] text-muted-foreground">
                <FileText className="mr-1 inline h-3 w-3" />
                {status.outputFileName || 'cleaned.pdf'}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={handleDownload}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button size="sm" variant="outline" onClick={onReset}>
                  Clean Another
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Running / starting ────────────────────────────────────────────────────
  const pct = status?.percent ?? 0
  const stage = status?.stage ?? 'queued'
  const isStartingStage = state === 'starting' && !status
  return (
    <Card className="border-rose-200/60 dark:border-rose-900/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
            <span className="text-sm font-medium text-foreground">
              {isStartingStage ? 'Starting…' : stageLabel(stage)}
            </span>
          </div>
          <span className="text-xs font-semibold text-rose-600">{Math.round(pct)}%</span>
        </div>

        <Progress
          value={pct}
          className="mt-3 h-2 bg-rose-100 dark:bg-rose-950/40"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Cleanup progress"
        />

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="truncate">
            {status?.message || (isStartingStage ? 'Submitting job…' : 'Working…')}
          </span>
          {status?.currentPage && status?.totalPages ? (
            <span>
              Page {status.currentPage} / {status.totalPages}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Batch view ──────────────────────────────────────────────────────────────

type BatchFileStatus = 'queued' | 'running' | 'complete' | 'error' | 'canceled'

interface BatchFileEntry {
  id: string
  file: File
  status: BatchFileStatus
  percent: number
  stage?: ProgressStage
  message?: string
  jobId?: string
  resultUrl?: string
  outputFileName?: string
  outputSizeBytes?: number
  originalSizeBytes?: number
  reductionPercent?: number
  error?: string
}

function BatchView({ options }: { options: CleanupOptions }) {
  const { toast } = useToast()
  const [entries, setEntries] = useState<BatchFileEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const stopFnsRef = useRef<Map<string, () => void>>(new Map())
  const concurrencyRef = useRef(2)

  const onDrop = useCallback((accepted: File[]) => {
    const newEntries: BatchFileEntry[] = accepted.map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      status: 'queued',
      percent: 0,
      originalSizeBytes: f.size,
    }))
    setEntries((prev) => [...prev, ...newEntries])
  }, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: MAX_FILE_BYTES,
    multiple: true,
    noClick: true,
  })

  const removeEntry = useCallback((id: string) => {
    const stop = stopFnsRef.current.get(id)
    if (stop) {
      stop()
      stopFnsRef.current.delete(id)
    }
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const updateEntry = useCallback((id: string, patch: Partial<BatchFileEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }, [])

  const processEntry = useCallback(
    async (entry: BatchFileEntry) => {
      updateEntry(entry.id, { status: 'running', percent: 0, error: undefined })
      try {
        const { jobId } = await startCleanupJob(entry.file, options)
        updateEntry(entry.id, { jobId })
        await new Promise<void>((resolve) => {
          const stop = pollCleanupStatus(
            jobId,
            (s) => {
              updateEntry(entry.id, {
                percent: s.percent,
                stage: s.stage,
                message: s.message,
              })
              if (s.outputFileName) updateEntry(entry.id, { outputFileName: s.outputFileName })
              if (s.outputSizeBytes !== undefined)
                updateEntry(entry.id, { outputSizeBytes: s.outputSizeBytes })
              if (s.originalSizeBytes !== undefined)
                updateEntry(entry.id, { originalSizeBytes: s.originalSizeBytes })
              if (s.reductionPercent !== undefined)
                updateEntry(entry.id, { reductionPercent: s.reductionPercent })
              if (s.resultUrl) updateEntry(entry.id, { resultUrl: s.resultUrl })
            },
            () => {
              updateEntry(entry.id, { status: 'complete', percent: 100 })
              stopFnsRef.current.delete(jobId)
              resolve()
            },
            (s) => {
              updateEntry(entry.id, {
                status: 'error',
                percent: 100,
                error: s.error || s.message,
              })
              stopFnsRef.current.delete(jobId)
              resolve()
            }
          )
          stopFnsRef.current.set(jobId, stop)
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to start'
        updateEntry(entry.id, { status: 'error', percent: 100, error: msg })
      }
    },
    [options, updateEntry]
  )

  const processAll = useCallback(async () => {
    const pending = entries.filter((e) => e.status === 'queued' || e.status === 'error')
    if (pending.length === 0) return
    setIsProcessing(true)
    toast({ title: 'Batch started', description: `Processing ${pending.length} file(s)…` })

    // Simple concurrency-limited queue.
    const queue = [...pending]
    const workers: Promise<void>[] = []
    for (let i = 0; i < concurrencyRef.current; i++) {
      workers.push(
        (async () => {
          while (queue.length > 0) {
            const next = queue.shift()
            if (!next) break
            await processEntry(next)
          }
        })()
      )
    }
    await Promise.all(workers)
    setIsProcessing(false)
    toast({ title: 'Batch complete', description: 'All files processed.' })
  }, [entries, processEntry, toast])

  const cancelEntry = useCallback(
    async (id: string) => {
      const entry = entries.find((e) => e.id === id)
      if (!entry) return
      const stop = entry.jobId ? stopFnsRef.current.get(entry.jobId) : undefined
      if (stop) stop()
      if (entry.jobId) {
        stopFnsRef.current.delete(entry.jobId)
        await cancelCleanupJob(entry.jobId)
      }
      updateEntry(id, { status: 'canceled', percent: 100 })
    },
    [entries, updateEntry]
  )

  const retryEntry = useCallback(
    async (id: string) => {
      const entry = entries.find((e) => e.id === id)
      if (!entry) return
      updateEntry(id, { status: 'queued', percent: 0, error: undefined })
      // Process immediately (bypasses batch concurrency queue).
      void processEntry({ ...entry, status: 'queued', percent: 0, error: undefined })
    },
    [entries, processEntry, updateEntry]
  )

  const downloadEntry = useCallback((entry: BatchFileEntry) => {
    if (!entry.resultUrl) return
    const a = document.createElement('a')
    a.href = entry.resultUrl
    a.download = entry.outputFileName || `${entry.file.name.replace(/\.pdf$/i, '')}-cleaned.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  const downloadAllAsZip = useCallback(async () => {
    const completed = entries.filter((e) => e.status === 'complete' && e.resultUrl)
    if (completed.length === 0) return
    setDownloadingZip(true)
    try {
      const zip = new JSZip()
      const usedNames = new Set<string>()
      for (const e of completed) {
        const res = await fetch(e.resultUrl!)
        if (!res.ok) continue
        const buf = await res.arrayBuffer()
        let name = e.outputFileName || `${e.file.name.replace(/\.pdf$/i, '')}-cleaned.pdf`
        // de-dup
        let n = 1
        while (usedNames.has(name)) {
          name = name.replace(/\.pdf$/i, `-${n}.pdf`)
          n++
        }
        usedNames.add(name)
        zip.file(name, buf)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cleaned-pdfs-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'ZIP downloaded', description: `${completed.length} files` })
    } catch (e) {
      toast({
        title: 'ZIP failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setDownloadingZip(false)
    }
  }, [entries, toast])

  const completedCount = entries.filter((e) => e.status === 'complete').length
  const errorCount = entries.filter((e) => e.status === 'error').length
  const allDone = entries.length > 0 && completedCount + errorCount === entries.length

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors',
          isDragActive
            ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
            : 'border-border bg-card hover:border-rose-300 dark:hover:border-rose-800'
        )}
      >
        <input {...getInputProps()} aria-label="Upload PDF files for batch processing" />
        <Upload className="mb-2 h-6 w-6 text-rose-600" />
        <p className="text-xs font-medium text-foreground">
          {isDragActive ? 'Drop PDFs here…' : 'Add multiple PDF files for batch cleanup'}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={open}
          disabled={isProcessing}
        >
          <FileText className="h-3.5 w-3.5" />
          Add Files
        </Button>
      </div>

      {/* File list */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {entries.length} file(s) · {completedCount} done · {errorCount} failed
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                stopFnsRef.current.forEach((s) => s())
                stopFnsRef.current.clear()
                setEntries([])
              }}
              disabled={isProcessing}
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </Button>
          </div>

          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {entries.map((e) => (
              <BatchFileRow
                key={e.id}
                entry={e}
                onCancel={() => void cancelEntry(e.id)}
                onRetry={() => void retryEntry(e.id)}
                onDownload={() => downloadEntry(e)}
                onRemove={() => removeEntry(e.id)}
              />
            ))}
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => void processAll()}
              disabled={isProcessing || entries.every((e) => e.status !== 'queued' && e.status !== 'error')}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Process All
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void downloadAllAsZip()}
              disabled={!allDone || downloadingZip}
            >
              {downloadingZip ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileArchive className="h-3.5 w-3.5" />
              )}
              Download All as ZIP
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface BatchFileRowProps {
  entry: BatchFileEntry
  onCancel: () => void
  onRetry: () => void
  onDownload: () => void
  onRemove: () => void
}

function BatchFileRow({ entry, onCancel, onRetry, onDownload, onRemove }: BatchFileRowProps) {
  const status = entry.status
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-foreground">{entry.file.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {formatFileSize(entry.file.size)}
            {entry.outputSizeBytes !== undefined && status === 'complete' && (
              <>
                {' → '}
                {formatFileSize(entry.outputSizeBytes)}
                {entry.reductionPercent !== undefined && entry.reductionPercent > 0 && (
                  <span className="text-emerald-600"> (-{entry.reductionPercent}%)</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Status pill */}
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
            status === 'queued' && 'bg-muted text-muted-foreground',
            status === 'running' && 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
            status === 'complete' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
            status === 'error' && 'bg-destructive/15 text-destructive',
            status === 'canceled' && 'bg-muted text-muted-foreground'
          )}
        >
          {status === 'running' ? stageLabel(entry.stage) : status}
        </span>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {status === 'running' && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel} aria-label="Cancel">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          {status === 'error' && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRetry} aria-label="Retry">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          {status === 'complete' && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDownload} aria-label="Download">
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
          {(status === 'complete' || status === 'canceled' || status === 'error') && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove} aria-label="Remove">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {(status === 'running' || status === 'complete') && (
        <Progress
          value={entry.percent}
          className="mt-2 h-1"
          role="progressbar"
          aria-valuenow={Math.round(entry.percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress for ${entry.file.name}`}
        />
      )}
      {status === 'error' && entry.error && (
        <div className="mt-2 flex items-start gap-1.5 text-[10px] text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-2">{friendlyError(entry.error)}</span>
        </div>
      )}
    </div>
  )
}

// ─── Combine view (merge multiple PDFs + clean) ───────────────────────────────

interface CombineFileEntry {
  id: string
  file: File
}

function CombineView({ options }: { options: CleanupOptions }) {
  const { toast } = useToast()
  const [entries, setEntries] = useState<CombineFileEntry[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<CleanupStatusResponse | null>(null)
  const [state, setState] = useState<'idle' | 'starting' | 'running' | 'complete' | 'error' | 'canceled'>('idle')
  const stopRef = useRef<(() => void) | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    const newEntries: CombineFileEntry[] = accepted.map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
    }))
    setEntries((prev) => [...prev, ...newEntries])
  }, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    noClick: true,
  })

  const moveEntry = useCallback((id: string, dir: 'up' | 'down') => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx < 0) return prev
      const newIdx = dir === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const copy = [...prev]
      ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
      return copy
    })
  }, [])

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const totalSize = entries.reduce((s, e) => s + e.file.size, 0)

  const handleCombine = useCallback(async () => {
    if (entries.length < 2) return
    setIsProcessing(true)
    setState('starting')
    setStatus(null)
    try {
      const { jobId } = await startCombineJob(
        entries.map((e) => e.file),
        options
      )
      setState('running')
      const stop = pollCleanupStatus(
        jobId,
        (s) => {
          setStatus(s)
          if (s.stage === 'complete') {
            setState('complete')
            setIsProcessing(false)
            toast({ title: 'Combine & Clean complete!', description: s.outputFileName })
          } else if (s.stage === 'error') {
            setState('error')
            setIsProcessing(false)
            toast({ title: 'Processing failed', description: s.error, variant: 'destructive' })
          }
        },
        (err) => {
          setState('error')
          setIsProcessing(false)
          setStatus((prev) => ({
            ok: false,
            jobId,
            stage: 'error',
            message: err.message,
            percent: 100,
            error: err.message,
          }))
          toast({ title: 'Polling error', description: err.message, variant: 'destructive' })
        }
      )
      stopRef.current = stop
    } catch (err) {
      setState('error')
      setIsProcessing(false)
      const msg = err instanceof Error ? err.message : 'Failed to start'
      setStatus({
        ok: false,
        jobId: '',
        stage: 'error',
        message: msg,
        percent: 100,
        error: msg,
      })
      toast({ title: 'Failed to start', description: msg, variant: 'destructive' })
    }
  }, [entries, options, toast])

  const handleCancel = useCallback(() => {
    stopRef.current?.()
    if (status?.jobId) cancelCleanupJob(status.jobId)
    setState('canceled')
    setIsProcessing(false)
  }, [status])

  const handleDownload = useCallback(() => {
    if (!status?.resultUrl) return
    const a = document.createElement('a')
    a.href = status.resultUrl
    a.download = status.outputFileName || 'combined-cleaned.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast({ title: 'Download started', description: a.download })
  }, [status, toast])

  // ── Complete state ──
  if (state === 'complete' && status) {
    const orig = status.originalSizeBytes ?? totalSize
    const out = status.outputSizeBytes ?? 0
    const reduction = status.reductionPercent ?? (orig > 0 ? Math.max(0, Math.round((1 - out / orig) * 100)) : 0)
    return (
      <div className="space-y-3">
        <Card className="border-emerald-300/60 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Combined & Cleaned!
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Merged {entries.length} files → {status.outputFileName}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span>Original: {formatFileSize(orig)}</span>
                  <span>Output: {formatFileSize(out)}</span>
                  {reduction > 0 && (
                    <Badge variant="secondary" className="text-[10px] text-emerald-700">
                      {reduction}% smaller
                    </Badge>
                  )}
                </div>
                <Button size="sm" className="mt-3 bg-rose-600 text-white hover:bg-rose-700" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Button variant="outline" size="sm" className="w-full" onClick={() => { setState('idle'); setStatus(null); setEntries([]) }}>
          Start New
        </Button>
      </div>
    )
  }

  // ── Error state ──
  if (state === 'error') {
    const msg = friendlyError(status?.error || status?.message, undefined)
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-destructive">Combine Failed</h4>
              <p className="mt-1 text-xs text-muted-foreground">{msg}</p>
              <Button size="sm" variant="default" className="mt-3" onClick={handleCombine}>
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Running state ──
  if (state === 'running' || state === 'starting') {
    const pct = status?.percent ?? 0
    const stage = status?.stage ?? 'queued'
    return (
      <Card className="border-rose-200/60 dark:border-rose-900/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
              <span className="text-sm font-medium">
                {state === 'starting' ? 'Starting…' : stageLabel(stage)}
              </span>
            </div>
            <span className="text-xs font-semibold text-rose-600">{Math.round(pct)}%</span>
          </div>
          <Progress value={pct} className="mt-3 h-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Combine progress" />
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate">{status?.message || 'Working…'}</span>
            {status?.currentPage && status?.totalPages ? (
              <span>Page {status.currentPage} / {status.totalPages}</span>
            ) : null}
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="outline" onClick={handleCancel}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Idle: file list + upload ──
  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
          isDragActive
            ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/20'
            : 'border-border hover:border-rose-300 dark:hover:border-rose-800'
        )}
        onClick={open}
      >
        <input {...getInputProps()} />
        <Combine className="mx-auto h-10 w-10 text-rose-500" />
        <p className="mt-2 text-sm font-medium">
          {isDragActive ? 'Drop PDFs here…' : 'Drag & drop PDFs to combine'}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          or click to browse · 2+ files required
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3">
          <Plus className="h-3.5 w-3.5" />
          Browse Files
        </Button>
      </div>

      {entries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {entries.length} file{entries.length === 1 ? '' : 's'} · {formatFileSize(totalSize)}
            </span>
            <Button variant="ghost" size="sm" className="text-[11px]" onClick={() => setEntries([])}>
              Clear all
            </Button>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {entries.map((entry, idx) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-card p-2"
              >
                <span className="w-5 shrink-0 text-center text-[11px] font-semibold text-muted-foreground">
                  {idx + 1}
                </span>
                <FileText className="h-4 w-4 shrink-0 text-rose-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{entry.file.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(entry.file.size)}</p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    onClick={() => moveEntry(entry.id, 'up')}
                    disabled={idx === 0}
                    className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveEntry(entry.id, 'down')}
                    disabled={idx === entries.length - 1}
                    className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Button
            className="w-full bg-rose-600 text-white hover:bg-rose-700"
            disabled={entries.length < 2 || isProcessing}
            onClick={handleCombine}
          >
            <Combine className="h-4 w-4" />
            Combine & Clean {entries.length} Files
          </Button>
          <p className="text-center text-[10px] text-muted-foreground">
            Files merge in the order shown · cleanup options apply to the merged result
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CleanupPdf() {
  const { setCurrentView } = useAppStore()
  const { toast } = useToast()
  const { state, status, start, cancel, reset } = useCleanupJob()

  const [file, setFile] = useState<File | null>(null)
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [options, setOptions] = useState<CleanupOptions>(DEFAULT_OPTIONS)
  const [tab, setTab] = useState<'single' | 'batch' | 'combine'>('single')
  const [isStarting, setIsStarting] = useState(false)

  // ── Handle new file drop ──────────────────────────────────────────────────
  const handleFile = useCallback(
    async (f: File) => {
      // Reset state
      reset()
      setFile(f)
      setDetection(null)
      setIsAnalyzing(true)
      try {
        const form = new FormData()
        form.append('file', f)
        const res = await fetch('/api/cleanup/analyze', { method: 'POST', body: form })
        const data = (await res.json().catch(() => ({}))) as AnalyzeResponse & { error?: string }
        if (!res.ok || !data?.ok) {
          throw new Error(data.error || 'Analysis failed')
        }
        setDetection(data.detection)
        toast({
          title: 'Upload complete',
          description: `${f.name} · ${data.detection.pageCount} pages · ${data.detection.watermarkCandidates.length} watermark(s) detected`,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Analysis failed'
        toast({ title: 'Analysis failed', description: msg, variant: 'destructive' })
        setDetection(null)
      } finally {
        setIsAnalyzing(false)
      }
    },
    [reset, toast]
  )

  // ── Mode change syncs checkboxes ──────────────────────────────────────────
  const handleModeChange = useCallback((mode: CleanupMode) => {
    setOptions((o) => {
      const next: CleanupOptions = { ...o, mode }
      if (mode === 'watermark') {
        next.removeWatermark = true
        next.removeBackground = false
        next.cleanScan = false
      } else if (mode === 'background') {
        next.removeWatermark = false
        next.removeBackground = true
        next.cleanScan = false
      } else if (mode === 'clean-scan') {
        next.removeWatermark = false
        next.removeBackground = false
        next.cleanScan = true
      } else {
        // full
        next.removeWatermark = true
        next.removeBackground = true
        next.cleanScan = true
      }
      return next
    })
  }, [])

  // ── Start cleaning (single) ───────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!file) return
    setIsStarting(true)
    try {
      await start(file, options)
    } finally {
      setIsStarting(false)
    }
  }, [file, options, start])

  const handleReset = useCallback(() => {
    reset()
  }, [reset])

  const handleClearFile = useCallback(() => {
    setFile(null)
    setDetection(null)
    reset()
  }, [reset])

  const pageCount = detection?.pageCount ?? 0
  const isBusy = state === 'running' || state === 'starting'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/60">
            <Sparkles className="h-4 w-4 text-rose-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground md:text-lg">
              PDF Background &amp; Watermark Remover
            </h1>
            <p className="text-[11px] text-muted-foreground md:text-xs">
              Strip watermarks, backgrounds, and scan artifacts — automatically.
            </p>
          </div>
        </div>
        <button
          onClick={() => setCurrentView('home')}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close tool"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          {!file ? (
            // ── Initial: upload zone ──
            <div className="space-y-4">
              <Tabs value={tab} onValueChange={(v) => setTab(v as 'single' | 'batch' | 'combine')}>
                <TabsList className="w-full max-w-md">
                  <TabsTrigger value="single" className="flex-1">
                    <FileText className="h-3.5 w-3.5" />
                    Single File
                  </TabsTrigger>
                  <TabsTrigger value="batch" className="flex-1">
                    <Layers className="h-3.5 w-3.5" />
                    Batch
                  </TabsTrigger>
                  <TabsTrigger value="combine" className="flex-1">
                    <Combine className="h-3.5 w-3.5" />
                    Combine
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="single" className="mt-4">
                  <UploadZone onFile={handleFile} />
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <FeatureBullet
                      icon={Eraser}
                      title="Watermark Removal"
                      desc="Text, transparent, rotated & repeated logos"
                    />
                    <FeatureBullet
                      icon={Palette}
                      title="Background Cleanup"
                      desc="Strip colored backgrounds & scanner shadows"
                    />
                    <FeatureBullet
                      icon={ScanLine}
                      title="Scan Enhancement"
                      desc="Denoise, threshold & sharpen scanned pages"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="batch" className="mt-4">
                  <Card>
                    <CardContent className="p-4">
                      <BatchView options={options} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="combine" className="mt-4">
                  <Card>
                    <CardContent className="p-4">
                      <CombineView options={options} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Mode/quality selectors visible in batch & combine tabs */}
              {(tab === 'batch' || tab === 'combine') && (
                <Card className="mt-4">
                  <CardContent className="space-y-4 p-4">
                    <ModeSelector value={options.mode} onChange={handleModeChange} />
                    <QualitySelector
                      value={options.quality}
                      onChange={(q) => setOptions((o) => ({ ...o, quality: q }))}
                    />
                    <OutputFormatSelector
                      value={options.outputFormat}
                      onChange={(f) => setOptions((o) => ({ ...o, outputFormat: f }))}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            // ── File selected: main workflow ──
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* LEFT: file info + controls + processing */}
              <div className="space-y-4">
                <FileInfoCard
                  file={file}
                  detection={detection}
                  isAnalyzing={isAnalyzing}
                  onClear={handleClearFile}
                />

                <ModeSelector value={options.mode} onChange={handleModeChange} />

                <QualitySelector
                  value={options.quality}
                  onChange={(q) => setOptions((o) => ({ ...o, quality: q }))}
                />

                <OutputFormatSelector
                  value={options.outputFormat}
                  onChange={(f) => setOptions((o) => ({ ...o, outputFormat: f }))}
                />

                <AdvancedOptions options={options} setOptions={setOptions} />

                <ProcessingPanel
                  file={file}
                  options={options}
                  onStart={() => void handleStart()}
                  state={state}
                  status={status}
                  onCancel={() => void cancel()}
                  onReset={handleReset}
                  isStarting={isStarting}
                />
              </div>

              {/* RIGHT: preview */}
              <div className="lg:sticky lg:top-6 lg:h-fit">
                {pageCount > 0 ? (
                  <PreviewPanel file={file} pageCount={pageCount} options={options} />
                ) : (
                  <Card className="flex h-64 items-center justify-center">
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          Analyzing PDF…
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-amber-500" />
                          Upload a PDF to see a preview.
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Tip card */}
                <Card className="mt-4 border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <Grip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Drag the slider handle to compare the original (left) with the cleaned page (right). Use ← → arrow keys for fine control.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tiny feature bullet for the empty state ─────────────────────────────────

function FeatureBullet({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType
  title: string
  desc: string
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-rose-50 dark:bg-rose-950/40">
        <Icon className="h-3.5 w-3.5 text-rose-600" />
      </div>
      <div>
        <div className="text-xs font-semibold text-foreground">{title}</div>
        <div className="text-[10px] leading-tight text-muted-foreground">{desc}</div>
      </div>
    </div>
  )
}
