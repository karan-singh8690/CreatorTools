'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  Download,
  CheckCircle2,
  Eye,
  Layers,
  Palette,
  ChevronRight,
  Upload,
  Clock,
  Sliders,
  Sparkles,
  Grid3X3,
  Paintbrush,
  LayoutTemplate,
  Sun,
  Moon,
  AlertTriangle,
  RotateCw,
  BookOpen,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useToolHistory } from '@/hooks/use-tool-history'
import { ToolHistoryPanel } from '@/components/pdf-element/tool-history-panel'

// ─── Types ───────────────────────────────────────────────────────────────────

type BackgroundType = 'solid' | 'gradient' | 'image' | 'pattern' | 'template'
type GradientDirection =
  | 'to-top' | 'to-bottom' | 'to-left' | 'to-right'
  | 'to-top-left' | 'to-top-right' | 'to-bottom-left' | 'to-bottom-right'
  | 'radial'
type GradientType = 'linear' | 'radial'
type BackgroundLayer = 'behind-content' | 'in-front-of-content'
type PatternType = 'dots' | 'lines' | 'grid' | 'diagonal' | 'crosshatch' | 'zigzag' | 'waves' | 'circles'
type PageRange = 'all' | 'even' | 'odd' | 'first' | 'last' | 'custom'
type FitMode = 'fill' | 'fit' | 'stretch' | 'tile' | 'center'

interface RGBColor { r: number; g: number; b: number }

interface GradientStop { color: RGBColor; position: number }

interface GradientConfig { type: GradientType; direction: GradientDirection; stops: GradientStop[] }

interface BackgroundOptionsState {
  type: BackgroundType
  color: RGBColor
  gradient: GradientConfig
  fitMode: FitMode
  imageScale: number
  pattern: PatternType
  patternColor: RGBColor
  patternScale: number
  patternBackgroundColor: RGBColor
  templateId: string
  opacity: number
  layer: BackgroundLayer
  pageRange: PageRange
  customPages: string
  autoContrast: boolean
  imageFile: File | null
  // Per-page overrides
  perPageMode: boolean
  perPage: Array<{
    pageNumbers: number[]
    background: Omit<BackgroundOptionsState, 'pageRange' | 'customPages' | 'perPage' | 'perPageMode' | 'imageFile'>
  }>
  // Theme
  selectedThemeId: string | null
}

interface BackgroundResultData {
  file: PdfFile
  background: {
    originalSize: number
    outputSize: number
    sizeIncrease: number
    pagesModified: number
    totalPages: number
    contrastAnalysis?: {
      averageBrightness: number
      isDark: boolean
      recommendedTextColor: RGBColor
      contrastRatio: number
      warnings: string[]
    }
    operations: { type: string; description: string; itemsProcessed: number }[]
    durationMs: number
  }
}

interface PreviewData {
  preview: {
    affectedPages: number
    totalPages: number
    estimatedCoverage: number
    estimatedSizeIncrease: number
    contrastAnalysis?: {
      averageBrightness: number
      isDark: boolean
      recommendedTextColor: RGBColor
      contrastRatio: number
      warnings: string[]
    }
    layerDescription: string
    warnings: string[]
  }
  fileInfo: { id: string; name: string; size: number; pages: number }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BG_TYPE_CARDS: {
  id: BackgroundType
  label: string
  description: string
  icon: React.ElementType
}[] = [
  { id: 'solid', label: 'Solid Color', description: 'Single color background', icon: Palette },
  { id: 'gradient', label: 'Gradient', description: 'Multi-color gradient', icon: Paintbrush },
  { id: 'image', label: 'Image', description: 'Image as background', icon: ImageIcon },
  { id: 'pattern', label: 'Pattern', description: 'Geometric patterns', icon: Grid3X3 },
  { id: 'template', label: 'Template', description: 'Brand templates', icon: LayoutTemplate },
]

const GRADIENT_DIRECTIONS: { id: GradientDirection; label: string }[] = [
  { id: 'to-bottom', label: '↓ Down' },
  { id: 'to-top', label: '↑ Up' },
  { id: 'to-right', label: '→ Right' },
  { id: 'to-left', label: '← Left' },
  { id: 'to-bottom-right', label: '↘' },
  { id: 'to-bottom-left', label: '↙' },
  { id: 'to-top-right', label: '↗' },
  { id: 'to-top-left', label: '↖' },
  { id: 'radial', label: '◉ Radial' },
]

const PATTERN_OPTIONS: { id: PatternType; label: string }[] = [
  { id: 'dots', label: 'Dots' },
  { id: 'lines', label: 'Lines' },
  { id: 'grid', label: 'Grid' },
  { id: 'diagonal', label: 'Diagonal' },
  { id: 'crosshatch', label: 'Crosshatch' },
  { id: 'zigzag', label: 'Zigzag' },
  { id: 'waves', label: 'Waves' },
  { id: 'circles', label: 'Circles' },
]

const FIT_MODE_OPTIONS: { id: FitMode; label: string; description: string }[] = [
  { id: 'fill', label: 'Fill', description: 'Fill page, crop edges' },
  { id: 'fit', label: 'Fit', description: 'Fit within page' },
  { id: 'stretch', label: 'Stretch', description: 'Stretch to fill' },
  { id: 'tile', label: 'Tile', description: 'Repeat pattern' },
  { id: 'center', label: 'Center', description: 'Center on page' },
]

const COLOR_PRESETS: { label: string; r: number; g: number; b: number }[] = [
  { label: 'White', r: 1, g: 1, b: 1 },
  { label: 'Light Gray', r: 0.94, g: 0.94, b: 0.94 },
  { label: 'Cream', r: 0.97, g: 0.95, b: 0.88 },
  { label: 'Light Blue', r: 0.88, g: 0.95, b: 0.99 },
  { label: 'Light Green', r: 0.88, g: 0.96, b: 0.88 },
  { label: 'Navy', r: 0.06, g: 0.14, b: 0.3 },
  { label: 'Dark', r: 0.12, g: 0.12, b: 0.14 },
  { label: 'Black', r: 0, g: 0, b: 0 },
]

const BRAND_TEMPLATES_UI: {
  id: string
  name: string
  category: string
  primary: RGBColor
  secondary?: RGBColor
}[] = [
  { id: 'corporate-blue', name: 'Corporate Blue', category: 'corporate', primary: { r: 0.08, g: 0.24, b: 0.42 }, secondary: { r: 0.16, g: 0.5, b: 0.73 } },
  { id: 'corporate-gray', name: 'Corporate Gray', category: 'corporate', primary: { r: 0.2, g: 0.2, b: 0.22 }, secondary: { r: 0.4, g: 0.4, b: 0.42 } },
  { id: 'creative-sunset', name: 'Creative Sunset', category: 'creative', primary: { r: 0.89, g: 0.26, b: 0.2 }, secondary: { r: 0.97, g: 0.58, b: 0.1 } },
  { id: 'creative-mint', name: 'Creative Mint', category: 'creative', primary: { r: 0.07, g: 0.63, b: 0.53 }, secondary: { r: 0.12, g: 0.75, b: 0.65 } },
  { id: 'legal-navy', name: 'Legal Navy', category: 'legal', primary: { r: 0.04, g: 0.12, b: 0.26 }, secondary: { r: 0.08, g: 0.2, b: 0.38 } },
  { id: 'academic-cream', name: 'Academic Cream', category: 'academic', primary: { r: 0.96, g: 0.94, b: 0.88 }, secondary: { r: 0.88, g: 0.84, b: 0.76 } },
  { id: 'minimal-white', name: 'Minimal White', category: 'minimal', primary: { r: 0.98, g: 0.98, b: 0.98 }, secondary: { r: 0.94, g: 0.94, b: 0.94 } },
  { id: 'minimal-dark', name: 'Minimal Dark', category: 'minimal', primary: { r: 0.12, g: 0.12, b: 0.14 }, secondary: { r: 0.18, g: 0.18, b: 0.2 } },
]

const THEME_LIBRARY_UI: {
  id: string
  name: string
  category: string
  preview: string
}[] = [
  { id: 'ocean-breeze', name: 'Ocean Breeze', category: 'nature', preview: 'linear-gradient(to bottom, #0a6187, #26a6c7, #d9eef7)' },
  { id: 'forest-green', name: 'Forest', category: 'nature', preview: 'linear-gradient(to bottom right, #0a3d1a, #14662e)' },
  { id: 'sunset-blaze', name: 'Sunset Blaze', category: 'abstract', preview: 'linear-gradient(to bottom, #c71a26, #f56b12, #fad648)' },
  { id: 'aurora', name: 'Aurora', category: 'abstract', preview: 'radial-gradient(circle, #147a60, #264d99, #381a66)' },
  { id: 'blueprint', name: 'Blueprint', category: 'geometric', preview: '#1f4066' },
  { id: 'subtle-dots', name: 'Subtle Dots', category: 'geometric', preview: '#ffffff' },
  { id: 'aged-paper', name: 'Aged Paper', category: 'paper', preview: '#f0e6d1' },
  { id: 'parchment', name: 'Parchment', category: 'paper', preview: '#f7f0db' },
  { id: 'sepia', name: 'Sepia', category: 'vintage', preview: '#b8945c' },
  { id: 'noir', name: 'Noir', category: 'vintage', preview: 'linear-gradient(to bottom, #1a1a1a, #332e26)' },
  { id: 'glassmorphism', name: 'Glassmorphism', category: 'modern', preview: '#f2f2f7' },
  { id: 'neon-glow', name: 'Neon Glow', category: 'modern', preview: 'linear-gradient(to right, #0f0f1f, #1a1433)' },
  { id: 'spring-bloom', name: 'Spring Bloom', category: 'seasonal', preview: 'linear-gradient(to bottom, #e0f5d1, #bfedb3)' },
  { id: 'winter-frost', name: 'Winter Frost', category: 'seasonal', preview: 'linear-gradient(to bottom, #e0ebf8, #bfd6f0)' },
]

const PRESETS_UI: {
  id: string
  name: string
  description: string
  preview: string
}[] = [
  { id: 'blank-white', name: 'Blank White', description: 'Standard white', preview: '#ffffff' },
  { id: 'cream-paper', name: 'Cream Paper', description: 'Warm cream', preview: '#f7f2e0' },
  { id: 'sky-gradient', name: 'Sky Gradient', description: 'Soft blue sky', preview: 'linear-gradient(to bottom, #87cef0, #e0f2fa)' },
  { id: 'subtle-lines', name: 'Subtle Lines', description: 'Light lined', preview: '#ffffff' },
  { id: 'dot-grid', name: 'Dot Grid', description: 'Minimal dots', preview: '#ffffff' },
  { id: 'dark-overlay', name: 'Dark Overlay', description: 'Dramatic dark', preview: 'rgba(0,0,0,0.08)' },
]

const DEFAULT_OPTIONS: BackgroundOptionsState = {
  type: 'solid',
  color: { r: 1, g: 1, b: 1 },
  gradient: {
    type: 'linear',
    direction: 'to-bottom',
    stops: [
      { color: { r: 0.29, g: 0.56, b: 0.85 }, position: 0 },
      { color: { r: 0.18, g: 0.35, b: 0.6 }, position: 1 },
    ],
  },
  fitMode: 'fill',
  imageScale: 1.0,
  pattern: 'dots',
  patternColor: { r: 0.85, g: 0.85, b: 0.85 },
  patternScale: 1.0,
  patternBackgroundColor: { r: 1, g: 1, b: 1 },
  templateId: 'corporate-blue',
  opacity: 1.0,
  layer: 'behind-content',
  pageRange: 'all',
  customPages: '',
  autoContrast: false,
  imageFile: null,
  perPageMode: false,
  perPage: [],
  selectedThemeId: null,
}

// ─── Helper: RGB to CSS ──────────────────────────────────────────────────────

function rgbToCSS(c: RGBColor, alpha: number = 1): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`
}

function rgbToHex(c: RGBColor): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`
}

function hexToRgb(hex: string): RGBColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  }
}

// ─── Helper: Build API Options ───────────────────────────────────────────────

function buildApiOptions(opts: BackgroundOptionsState) {
  const base: any = {
    type: opts.type,
    opacity: opts.opacity,
    layer: opts.layer,
    pageRange: opts.pageRange,
    customPages: opts.customPages ? opts.customPages.split(',').map(Number) : undefined,
    autoContrast: opts.autoContrast,
  }

  switch (opts.type) {
    case 'solid':
      return { ...base, color: opts.color }
    case 'gradient':
      return { ...base, gradient: opts.gradient }
    case 'image':
      return { ...base, fitMode: opts.fitMode, imageScale: opts.imageScale }
    case 'pattern':
      return {
        ...base,
        pattern: opts.pattern,
        patternColor: opts.patternColor,
        patternScale: opts.patternScale,
        patternBackgroundColor: opts.patternBackgroundColor,
      }
    case 'template':
      return { ...base, templateId: opts.templateId }
  }
}

// ─── Batch View ──────────────────────────────────────────────────────────────

function BatchBackgroundView({ onBack }: { onBack: () => void }) {
  const { recentFiles, setCurrentView } = useAppStore()
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [options, setOptions] = useState<BackgroundOptionsState>(DEFAULT_OPTIONS)
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<any>(null)

  const toggleFile = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBatchBackground = async () => {
    if (selectedIds.size === 0) return
    setIsProcessing(true)

    try {
      const response = await fetch('/api/files/background-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: Array.from(selectedIds),
          options: buildApiOptions(options),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Batch background failed' }))
        throw new Error(errorData.error || 'Batch background failed')
      }

      const data = await response.json()
      setResults(data)
      await useAppStore.getState().fetchFiles()

      toast({
        title: 'Batch Background Complete',
        description: `${data.summary.success} files processed successfully`,
      })
    } catch (error: any) {
      toast({
        title: 'Batch Background Failed',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Batch Background</h3>
          <p className="text-xs text-gray-400">Apply the same background to multiple PDFs</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={onBack}>
          Single File Mode
        </Button>
      </div>

      {/* Quick background type selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600">Background Type</label>
        <div className="grid grid-cols-5 gap-1.5">
          {BG_TYPE_CARDS.map((bt) => (
            <button
              key={bt.id}
              onClick={() => setOptions({ ...options, type: bt.id })}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all',
                options.type === bt.id
                  ? 'border-orange-500 bg-orange-50/50'
                  : 'border-gray-100 hover:border-gray-200'
              )}
            >
              <bt.icon className={cn('w-4 h-4', options.type === bt.id ? 'text-orange-600' : 'text-gray-400')} />
              <span className={cn('text-[9px] font-medium', options.type === bt.id ? 'text-orange-700' : 'text-gray-500')}>
                {bt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Color picker for solid */}
      {options.type === 'solid' && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-600">Background Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={rgbToHex(options.color)}
              onChange={(e) => setOptions({ ...options, color: hexToRgb(e.target.value) })}
              className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
            />
            <div className="flex gap-1 flex-wrap flex-1">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setOptions({ ...options, color: { r: preset.r, g: preset.g, b: preset.b } })}
                  className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: rgbToCSS(preset) }}
                  title={preset.label}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {recentFiles.map((file) => (
          <button
            key={file.id}
            onClick={() => toggleFile(file.id)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
              selectedIds.has(file.id) ? 'border-orange-500 bg-orange-50/50' : 'border-gray-100 hover:border-gray-200'
            )}
          >
            <div className={cn(
              'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
              selectedIds.has(file.id) ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
            )}>
              {selectedIds.has(file.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{file.name}</p>
            </div>
            <span className="text-[10px] text-gray-400 shrink-0">{formatFileSize(file.size)}</span>
          </button>
        ))}
      </div>

      {results ? (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Batch Complete</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-orange-600">{results.summary.success}</p>
                <p className="text-[10px] text-gray-500">Processed</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800">{formatFileSize(results.summary.totalSizeIncrease)}</p>
                <p className="text-[10px] text-gray-500">Size Added</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-500">{results.summary.errors}</p>
                <p className="text-[10px] text-gray-500">Failed</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => setResults(null)}>
              Process More
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button
          className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          disabled={selectedIds.size === 0 || isProcessing}
          onClick={handleBatchBackground}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing {selectedIds.size} Files...
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4 mr-2" />
              Apply Background to {selectedIds.size} File{selectedIds.size !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function BackgroundPdf() {
  const { recentFiles, setCurrentView } = useAppStore()
  const { toast } = useToast()
  const { history, addHistory, deleteItem, clearHistory, isLoaded } = useToolHistory('background', 'Background PDF')

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [options, setOptions] = useState<BackgroundOptionsState>(DEFAULT_OPTIONS)
  const [result, setResult] = useState<BackgroundResultData | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [showSettingsPanel, setShowSettingsPanel] = useState(true)
  const [activeTab, setActiveTab] = useState<'settings' | 'themes' | 'templates' | 'presets'>('settings')
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Fetch preview when file or options change
  useEffect(() => {
    if (!selectedFile) return

    let cancelled = false
    const fetchPreview = async () => {
      setIsLoadingPreview(true)
      try {
        const apiOptions = buildApiOptions(options)
        const response = await fetch(
          `/api/files/${selectedFile.id}/background?options=${encodeURIComponent(JSON.stringify(apiOptions))}`
        )
        if (!response.ok) throw new Error('Preview failed')
        const data = await response.json()
        if (!cancelled) {
          setPreview(data)
        }
      } catch (error) {
        console.error('Preview error:', error)
      } finally {
        if (!cancelled) setIsLoadingPreview(false)
      }
    }

    const timer = setTimeout(fetchPreview, 600)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [selectedFile?.id, options.type, options.opacity, options.layer, options.pageRange, options.pattern, options.templateId])

  const handleApplyBackground = useCallback(async () => {
    if (!selectedFile) return
    setIsApplying(true)
    setResult(null)

    try {
      const apiOptions = buildApiOptions(options)

      let response: Response

      if (options.imageFile && options.type === 'image') {
        const formData = new FormData()
        formData.append('options', JSON.stringify(apiOptions))
        formData.append('image', options.imageFile)

        response = await fetch(`/api/files/${selectedFile.id}/background`, {
          method: 'POST',
          body: formData,
        })
      } else {
        response = await fetch(`/api/files/${selectedFile.id}/background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ options: apiOptions }),
        })
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Background failed' }))
        throw new Error(errorData.error || 'Background failed')
      }

      const data = await response.json()
      setResult(data as BackgroundResultData)
      await useAppStore.getState().fetchFiles()

      toast({
        title: 'Background Applied',
        description: `Modified ${data.background.pagesModified} page(s) in ${(data.background.durationMs / 1000).toFixed(1)}s`,
      })

      addHistory(
        `Applied ${options.type} background to ${selectedFile.name}`,
        {
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          backgroundType: options.type,
          color: options.type === 'solid' ? rgbToHex(options.color) : undefined,
          opacity: options.opacity,
          pagesModified: data.background.pagesModified,
          sizeIncrease: data.background.sizeIncrease,
        },
        'success'
      )
    } catch (error: any) {
      toast({
        title: 'Background Failed',
        description: error.message || 'Failed to apply background',
        variant: 'destructive',
      })
    } finally {
      setIsApplying(false)
    }
  }, [selectedFile, options, toast, addHistory])

  const handleDownload = useCallback(() => {
    if (!result) return
    fetch(`/api/files/${result.file.id}/download?download=1`)
      .then((response) => {
        if (!response.ok) throw new Error('Download failed')
        return response.blob()
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      })
      .catch((err) => {
        console.error('Download error:', err)
        toast({ title: 'Download Failed', variant: 'destructive' })
      })

    toast({ title: 'Download Started', description: `Downloading ${result.file.name}` })
  }, [result, toast])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid File', description: 'Please select a PNG or JPEG image', variant: 'destructive' })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File Too Large', description: 'Image must be under 10MB', variant: 'destructive' })
      return
    }

    setOptions({ ...options, imageFile: file })
  }

  const handleApplyTheme = (themeId: string) => {
    const theme = THEME_LIBRARY_UI.find((t) => t.id === themeId)
    if (!theme) return

    // Apply theme by converting to appropriate options
    if (theme.preview.startsWith('linear-gradient') || theme.preview.startsWith('radial-gradient')) {
      setOptions({
        ...options,
        type: 'gradient',
        selectedThemeId: themeId,
        gradient: {
          type: theme.preview.includes('radial') ? 'radial' : 'linear',
          direction: theme.preview.includes('radial') ? 'radial' : 'to-bottom',
          stops: [
            { color: { r: 0.29, g: 0.56, b: 0.85 }, position: 0 },
            { color: { r: 0.18, g: 0.35, b: 0.6 }, position: 1 },
          ],
        },
        opacity: 0.15,
      })
    } else {
      setOptions({
        ...options,
        type: 'solid',
        selectedThemeId: themeId,
        color: hexToRgb(theme.preview),
        opacity: 0.3,
      })
    }

    setActiveTab('settings')
    toast({ title: 'Theme Applied', description: `${theme.name} theme applied` })
  }

  const handleApplyTemplate = (templateId: string) => {
    setOptions({ ...options, type: 'template', templateId })
    setActiveTab('settings')
  }

  const handleApplyPreset = (presetId: string) => {
    const preset = PRESETS_UI.find((p) => p.id === presetId)
    if (!preset) return

    switch (presetId) {
      case 'blank-white':
        setOptions({ ...options, type: 'solid', color: { r: 1, g: 1, b: 1 }, opacity: 1.0 })
        break
      case 'cream-paper':
        setOptions({ ...options, type: 'solid', color: { r: 0.97, g: 0.95, b: 0.88 }, opacity: 1.0 })
        break
      case 'sky-gradient':
        setOptions({
          ...options, type: 'gradient', opacity: 0.2,
          gradient: {
            type: 'linear', direction: 'to-bottom',
            stops: [
              { color: { r: 0.53, g: 0.81, b: 0.92 }, position: 0 },
              { color: { r: 0.88, g: 0.95, b: 0.98 }, position: 1 },
            ],
          },
        })
        break
      case 'subtle-lines':
        setOptions({ ...options, type: 'pattern', pattern: 'lines', patternColor: { r: 0.88, g: 0.88, b: 0.88 }, patternBackgroundColor: { r: 1, g: 1, b: 1 }, opacity: 0.6 })
        break
      case 'dot-grid':
        setOptions({ ...options, type: 'pattern', pattern: 'dots', patternColor: { r: 0.82, g: 0.82, b: 0.82 }, patternBackgroundColor: { r: 1, g: 1, b: 1 }, opacity: 0.5 })
        break
      case 'dark-overlay':
        setOptions({ ...options, type: 'solid', color: { r: 0.1, g: 0.1, b: 0.12 }, opacity: 0.08, layer: 'in-front-of-content' })
        break
    }
    setActiveTab('settings')
  }

  // ─── Visual Preview ──────────────────────────────────────────────────────

  const getPreviewCSS = () => {
    switch (options.type) {
      case 'solid':
        return { backgroundColor: rgbToCSS(options.color, options.opacity) }
      case 'gradient': {
        const stops = options.gradient.stops
          .map((s) => `${rgbToCSS(s.color)} ${Math.round(s.position * 100)}%`)
          .join(', ')
        const dir = options.gradient.direction === 'radial'
          ? 'radial-gradient(circle'
          : `linear-gradient(${options.gradient.direction.replace('to-', 'to ')}`
        return { background: `${dir}, ${stops})`, opacity: options.opacity }
      }
      case 'pattern':
        return { backgroundColor: rgbToCSS(options.patternBackgroundColor, options.opacity) }
      case 'image':
        return { backgroundColor: '#e5e7eb', opacity: options.opacity }
      case 'template': {
        const tmpl = BRAND_TEMPLATES_UI.find((t) => t.id === options.templateId)
        return tmpl ? { backgroundColor: rgbToCSS(tmpl.primary, options.opacity) } : {}
      }
      default:
        return {}
    }
  }

  if (isBatchMode) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-semibold text-gray-800">Batch Background PDFs</h1>
              <p className="text-xs text-gray-400">Apply background to multiple files at once</p>
            </div>
          </div>
          <button onClick={() => setCurrentView('home')} className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-4 md:p-6 pb-4 md:pb-0 md:overflow-auto">
          <BatchBackgroundView onBack={() => setIsBatchMode(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold text-gray-800">PDF Background</h1>
            <p className="text-xs text-gray-400">Add professional backgrounds to your PDF documents</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsBatchMode(true)}>
            <Layers className="w-3.5 h-3.5 mr-1" />
            Batch Mode
          </Button>
          <button onClick={() => setCurrentView('home')} className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-y-hidden">
        {/* Main Content */}
        <div className="md:flex-1 md:min-h-0 md:overflow-auto p-4 md:p-6 pb-4 md:pb-0">
          {!selectedFile ? (
            /* File Selection */
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to add background</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => { setSelectedFile(file); setResult(null) }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-orange-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-orange-600 truncate">{file.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.size)} · {file.pages} page{file.pages !== 1 ? 's' : ''}</div>
                        <div className="text-[11px] text-gray-300 mt-0.5">{formatDate(file.updatedAt)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                  <ImageIcon className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to add backgrounds</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File Info */}
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{selectedFile.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {formatFileSize(selectedFile.size)} · {selectedFile.pages} page{selectedFile.pages !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs text-gray-500 hover:text-gray-700" onClick={() => { setSelectedFile(null); setResult(null); setPreview(null) }}>
                      Change File
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Background Type Selector */}
              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-2">Background Type</h4>
                <div className="grid grid-cols-5 gap-2">
                  {BG_TYPE_CARDS.map((bt) => (
                    <button
                      key={bt.id}
                      onClick={() => setOptions({ ...options, type: bt.id })}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                        options.type === bt.id
                          ? 'border-orange-500 bg-orange-50/50 shadow-sm'
                          : 'border-gray-100 hover:border-gray-200'
                      )}
                    >
                      <bt.icon className={cn(
                        'w-5 h-5',
                        options.type === bt.id ? 'text-orange-600' : 'text-gray-400'
                      )} />
                      <span className={cn(
                        'text-[11px] font-medium',
                        options.type === bt.id ? 'text-orange-700' : 'text-gray-500'
                      )}>
                        {bt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Preview */}
              {selectedFile && !result && (
                <Card className="border-orange-500/20 bg-orange-50/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-4 h-4 text-orange-600" />
                      <h4 className="text-sm font-medium text-orange-700">Background Preview</h4>
                    </div>
                    <div className="flex gap-4">
                      {/* Visual preview of background */}
                      <div className="w-32 h-44 rounded-lg border border-gray-200 overflow-hidden relative shadow-sm">
                        <div className="absolute inset-0 flex items-center justify-center" style={getPreviewCSS()}>
                          {/* Simulated document lines */}
                          <div className="space-y-2 px-3 w-full">
                            <div className="h-2 bg-gray-300/60 rounded w-3/4" />
                            <div className="h-2 bg-gray-300/60 rounded w-full" />
                            <div className="h-2 bg-gray-300/60 rounded w-5/6" />
                            <div className="h-2 bg-gray-300/60 rounded w-2/3" />
                            <div className="h-3" />
                            <div className="h-2 bg-gray-300/60 rounded w-full" />
                            <div className="h-2 bg-gray-300/60 rounded w-4/5" />
                            <div className="h-2 bg-gray-300/60 rounded w-3/4" />
                          </div>
                        </div>
                        {options.layer === 'in-front-of-content' && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Badge variant="outline" className="text-[8px] bg-white/80">Overlay</Badge>
                          </div>
                        )}
                      </div>
                      {/* Preview stats */}
                      <div className="flex-1 space-y-2">
                        {preview && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">Affected Pages</span>
                              <span className="text-xs font-medium text-gray-800">
                                {preview.preview.affectedPages} of {preview.preview.totalPages}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">Est. Coverage</span>
                              <span className="text-xs font-medium text-orange-600">~{preview.preview.estimatedCoverage}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">Est. Size Increase</span>
                              <span className="text-xs font-medium text-gray-800">
                                {formatFileSize(preview.preview.estimatedSizeIncrease)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                              <Layers className="w-3 h-3 text-orange-500" />
                              {options.layer === 'behind-content' ? 'Behind content' : 'In front of content (overlay)'}
                            </div>
                          </>
                        )}
                        {/* Contrast indicator */}
                        {options.autoContrast && preview?.preview.contrastAnalysis && (
                          <div className="mt-2 p-2 bg-white rounded border border-gray-100">
                            <div className="flex items-center gap-1.5 mb-1">
                              {preview.preview.contrastAnalysis.isDark ? (
                                <Moon className="w-3 h-3 text-blue-500" />
                              ) : (
                                <Sun className="w-3 h-3 text-amber-500" />
                              )}
                              <span className="text-[10px] font-medium text-gray-700">
                                Contrast: {preview.preview.contrastAnalysis.contrastRatio}:1
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: rgbToCSS(preview.preview.contrastAnalysis.recommendedTextColor) }} />
                              <span className="text-[10px] text-gray-500">
                                Recommended text: {preview.preview.contrastAnalysis.isDark ? 'White' : 'Black'}
                              </span>
                            </div>
                          </div>
                        )}
                        {preview?.preview.warnings && preview.preview.warnings.length > 0 && (
                          <div className="space-y-1">
                            {preview.preview.warnings.map((w, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-600">
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isLoadingPreview && !preview && !result && (
                <Card className="border-gray-200">
                  <CardContent className="p-4 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
                    <span className="text-xs text-gray-500">Analyzing background placement...</span>
                  </CardContent>
                </Card>
              )}

              {/* Background Result */}
              {result && (
                <div className="space-y-4">
                  <Card className="border-orange-200 bg-orange-50/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-orange-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">Background Applied Successfully</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {result.background.pagesModified} page(s) modified · Size increased by {formatFileSize(result.background.sizeIncrease)}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                          <Clock className="w-3 h-3 mr-1" />
                          {(result.background.durationMs / 1000).toFixed(1)}s
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-gray-200">
                    <CardContent className="p-5 space-y-4">
                      <h4 className="text-sm font-medium text-gray-700">Before & After Comparison</h4>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Before
                          </span>
                          <span className="font-medium text-gray-700">{formatFileSize(result.background.originalSize)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-gray-300 rounded-full" style={{ width: '100%' }} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-orange-600 flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" /> After
                          </span>
                          <span className="font-medium text-orange-600">{formatFileSize(result.background.outputSize)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min((result.background.outputSize / result.background.originalSize) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-600">
                            +{formatFileSize(result.background.sizeIncrease)}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Size Added</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-800">
                            {result.background.pagesModified}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Pages Modified</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-800">
                            {result.background.totalPages}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Total Pages</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contrast Analysis Result */}
                  {result.background.contrastAnalysis && (
                    <Card className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Wand2 className="w-4 h-4 text-orange-500" />
                          <h4 className="text-xs font-medium text-gray-600">Smart Contrast Analysis</h4>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <p className="text-lg font-bold text-gray-800">{result.background.contrastAnalysis.averageBrightness}</p>
                            <p className="text-[10px] text-gray-400">Avg Brightness</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <p className="text-lg font-bold text-gray-800">{result.background.contrastAnalysis.contrastRatio}:1</p>
                            <p className="text-[10px] text-gray-400">Contrast Ratio</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: rgbToCSS(result.background.contrastAnalysis.recommendedTextColor) }} />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Recommended Text</p>
                          </div>
                        </div>
                        {result.background.contrastAnalysis.warnings.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {result.background.contrastAnalysis.warnings.map((w, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-600">
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {result.background.operations && result.background.operations.length > 0 && (
                    <Card className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Layers className="w-4 h-4 text-gray-500" />
                          <h4 className="text-xs font-medium text-gray-600">Background Operations</h4>
                        </div>
                        <div className="space-y-2">
                          {result.background.operations.map((op, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <ChevronRight className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" />
                              <p className="text-xs text-gray-700">{op.description}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex items-center gap-3">
                    <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF with Background
                    </Button>
                    <Button variant="outline" className="text-xs" onClick={() => { setSelectedFile(null); setResult(null); setPreview(null) }}>
                      Apply to Another File
                    </Button>
                  </div>
                </div>
              )}

              {isApplying && !result && (
                <Card className="border-gray-200">
                  <CardContent className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-3" />
                    <p className="text-sm font-medium text-gray-700">Applying Background...</p>
                    <p className="text-xs text-gray-400 mt-1">Processing {selectedFile.name}</p>
                    <div className="w-48 mt-4">
                      <Progress value={50} className="h-1.5" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        {showSettingsPanel && selectedFile && (
          <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col shrink-0 md:overflow-y-hidden">
            {/* Tab Selector */}
            <div className="flex border-b border-gray-100">
              {[
                { id: 'settings' as const, label: 'Settings', icon: Sliders },
                { id: 'themes' as const, label: 'Themes', icon: Sparkles },
                { id: 'templates' as const, label: 'Brands', icon: LayoutTemplate },
                { id: 'presets' as const, label: 'Presets', icon: BookOpen },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] font-medium border-b-2 transition-all',
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  )}
                >
                  <tab.icon className="w-3 h-3" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 md:overflow-y-auto p-4">
              {/* ─── Settings Tab ──────────────────────────────────────────── */}
              {activeTab === 'settings' && (
                <div className="space-y-5">
                  {/* Solid Color */}
                  {options.type === 'solid' && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-2 block">Background Color</label>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="color"
                          value={rgbToHex(options.color)}
                          onChange={(e) => setOptions({ ...options, color: hexToRgb(e.target.value) })}
                          className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                        />
                        <span className="text-xs text-gray-500">{rgbToHex(options.color)}</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            onClick={() => setOptions({ ...options, color: { r: preset.r, g: preset.g, b: preset.b } })}
                            className={cn(
                              'w-7 h-7 rounded-lg border-2 transition-all hover:scale-110',
                              rgbToHex(options.color) === rgbToHex(preset) ? 'border-orange-500 scale-110' : 'border-gray-200'
                            )}
                            style={{ backgroundColor: rgbToCSS(preset) }}
                            title={preset.label}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gradient */}
                  {options.type === 'gradient' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-2 block">Gradient Direction</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {GRADIENT_DIRECTIONS.map((dir) => (
                            <button
                              key={dir.id}
                              onClick={() => setOptions({
                                ...options,
                                gradient: {
                                  ...options.gradient,
                                  direction: dir.id,
                                  type: dir.id === 'radial' ? 'radial' : 'linear',
                                },
                              })}
                              className={cn(
                                'px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all',
                                options.gradient.direction === dir.id
                                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                                  : 'border-gray-100 text-gray-500 hover:border-gray-200'
                              )}
                            >
                              {dir.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-2 block">Color Stops</label>
                        {options.gradient.stops.map((stop, idx) => (
                          <div key={idx} className="flex items-center gap-2 mb-2">
                            <input
                              type="color"
                              value={rgbToHex(stop.color)}
                              onChange={(e) => {
                                const newStops = [...options.gradient.stops]
                                newStops[idx] = { ...stop, color: hexToRgb(e.target.value) }
                                setOptions({ ...options, gradient: { ...options.gradient, stops: newStops } })
                              }}
                              className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                            />
                            <div className="flex-1">
                              <Slider
                                value={[stop.position * 100]}
                                onValueChange={([v]) => {
                                  const newStops = [...options.gradient.stops]
                                  newStops[idx] = { ...stop, position: v / 100 }
                                  setOptions({ ...options, gradient: { ...options.gradient, stops: newStops } })
                                }}
                                min={0}
                                max={100}
                                step={1}
                              />
                            </div>
                            <span className="text-[10px] text-gray-400 w-8">{Math.round(stop.position * 100)}%</span>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-[10px] mt-1"
                          onClick={() => {
                            const lastStop = options.gradient.stops[options.gradient.stops.length - 1]
                            setOptions({
                              ...options,
                              gradient: {
                                ...options.gradient,
                                stops: [...options.gradient.stops, { color: { r: 0.5, g: 0.5, b: 0.5 }, position: Math.min((lastStop?.position ?? 0.5) + 0.2, 1) }],
                              },
                            })
                          }}
                          disabled={options.gradient.stops.length >= 5}
                        >
                          + Add Color Stop
                        </Button>
                      </div>

                      {/* Gradient Preview */}
                      <div
                        className="h-16 rounded-lg border border-gray-200"
                        style={{
                          background: `${options.gradient.type === 'radial' ? 'radial-gradient(circle' : 'linear-gradient(to bottom'}, ${options.gradient.stops.map((s) => `${rgbToCSS(s.color)} ${Math.round(s.position * 100)}%`).join(', ')}))`,
                        }}
                      />
                    </div>
                  )}

                  {/* Image */}
                  {options.type === 'image' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Background Image</label>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/png,image/jpeg"
                          className="hidden"
                          onChange={handleImageSelect}
                        />
                        <button
                          onClick={() => imageInputRef.current?.click()}
                          className="w-full flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-200 rounded-lg hover:border-orange-400 transition-colors"
                        >
                          <Upload className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {options.imageFile ? options.imageFile.name : 'Select PNG or JPEG image'}
                          </span>
                        </button>
                        {options.imageFile && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-orange-500" />
                            <span className="text-[10px] text-orange-600">
                              {(options.imageFile.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-2 block">Fit Mode</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {FIT_MODE_OPTIONS.map((fm) => (
                            <button
                              key={fm.id}
                              onClick={() => setOptions({ ...options, fitMode: fm.id })}
                              className={cn(
                                'px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all',
                                options.fitMode === fm.id
                                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                                  : 'border-gray-100 text-gray-500 hover:border-gray-200'
                              )}
                              title={fm.description}
                            >
                              {fm.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs text-gray-600">Image Scale</label>
                          <span className="text-xs font-medium text-gray-800">{Math.round(options.imageScale * 100)}%</span>
                        </div>
                        <Slider
                          value={[options.imageScale * 100]}
                          onValueChange={([v]) => setOptions({ ...options, imageScale: v / 100 })}
                          min={10}
                          max={200}
                          step={5}
                        />
                      </div>
                    </div>
                  )}

                  {/* Pattern */}
                  {options.type === 'pattern' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-2 block">Pattern Type</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {PATTERN_OPTIONS.map((pt) => (
                            <button
                              key={pt.id}
                              onClick={() => setOptions({ ...options, pattern: pt.id })}
                              className={cn(
                                'px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all',
                                options.pattern === pt.id
                                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                                  : 'border-gray-100 text-gray-500 hover:border-gray-200'
                              )}
                            >
                              {pt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-2 block">Pattern Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={rgbToHex(options.patternColor)}
                            onChange={(e) => setOptions({ ...options, patternColor: hexToRgb(e.target.value) })}
                            className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                          />
                          <span className="text-xs text-gray-500">{rgbToHex(options.patternColor)}</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-2 block">Background Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={rgbToHex(options.patternBackgroundColor)}
                            onChange={(e) => setOptions({ ...options, patternBackgroundColor: hexToRgb(e.target.value) })}
                            className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                          />
                          <span className="text-xs text-gray-500">{rgbToHex(options.patternBackgroundColor)}</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs text-gray-600">Pattern Scale</label>
                          <span className="text-xs font-medium text-gray-800">{Math.round(options.patternScale * 100)}%</span>
                        </div>
                        <Slider
                          value={[options.patternScale * 100]}
                          onValueChange={([v]) => setOptions({ ...options, patternScale: v / 100 })}
                          min={50}
                          max={300}
                          step={10}
                        />
                      </div>
                    </div>
                  )}

                  {/* Template */}
                  {options.type === 'template' && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-2 block">Select Brand Template</label>
                      <div className="space-y-1.5">
                        {BRAND_TEMPLATES_UI.map((tmpl) => (
                          <button
                            key={tmpl.id}
                            onClick={() => setOptions({ ...options, templateId: tmpl.id })}
                            className={cn(
                              'w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left',
                              options.templateId === tmpl.id
                                ? 'border-orange-500 bg-orange-50/50'
                                : 'border-gray-100 hover:border-gray-200'
                            )}
                          >
                            <div className="flex gap-1 shrink-0">
                              <div className="w-5 h-5 rounded" style={{ backgroundColor: rgbToCSS(tmpl.primary) }} />
                              {tmpl.secondary && <div className="w-5 h-5 rounded" style={{ backgroundColor: rgbToCSS(tmpl.secondary) }} />}
                            </div>
                            <div>
                              <p className="text-[11px] font-medium text-gray-700">{tmpl.name}</p>
                              <p className="text-[9px] text-gray-400 capitalize">{tmpl.category}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ─── Common Controls ────────────────────────────────────── */}

                  <Separator />

                  {/* Opacity */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-gray-600">Opacity</label>
                      <span className="text-xs font-medium text-gray-800">{Math.round(options.opacity * 100)}%</span>
                    </div>
                    <Slider
                      value={[options.opacity * 100]}
                      onValueChange={([v]) => setOptions({ ...options, opacity: v / 100 })}
                      min={1}
                      max={100}
                      step={1}
                    />
                  </div>

                  {/* Layer Ordering */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-2 block">Layer Order</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setOptions({ ...options, layer: 'behind-content' })}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                          options.layer === 'behind-content'
                            ? 'border-orange-500 bg-orange-50/50'
                            : 'border-gray-100 hover:border-gray-200'
                        )}
                      >
                        <Layers className={cn('w-5 h-5', options.layer === 'behind-content' ? 'text-orange-600' : 'text-gray-400')} />
                        <span className={cn('text-[10px] font-medium', options.layer === 'behind-content' ? 'text-orange-700' : 'text-gray-500')}>
                          Behind Content
                        </span>
                      </button>
                      <button
                        onClick={() => setOptions({ ...options, layer: 'in-front-of-content' })}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                          options.layer === 'in-front-of-content'
                            ? 'border-orange-500 bg-orange-50/50'
                            : 'border-gray-100 hover:border-gray-200'
                        )}
                      >
                        <Paintbrush className={cn('w-5 h-5', options.layer === 'in-front-of-content' ? 'text-orange-600' : 'text-gray-400')} />
                        <span className={cn('text-[10px] font-medium', options.layer === 'in-front-of-content' ? 'text-orange-700' : 'text-gray-500')}>
                          In Front (Overlay)
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Page Range */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-2 block">Page Range</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['all', 'even', 'odd', 'first', 'last', 'custom'] as PageRange[]).map((pr) => (
                        <button
                          key={pr}
                          onClick={() => setOptions({ ...options, pageRange: pr })}
                          className={cn(
                            'px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all capitalize',
                            options.pageRange === pr
                              ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : 'border-gray-100 text-gray-500 hover:border-gray-200'
                          )}
                        >
                          {pr}
                        </button>
                      ))}
                    </div>
                    {options.pageRange === 'custom' && (
                      <input
                        type="text"
                        value={options.customPages}
                        onChange={(e) => setOptions({ ...options, customPages: e.target.value })}
                        className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                        placeholder="e.g., 1,3,5-8"
                      />
                    )}
                  </div>

                  {/* Smart Contrast Detection */}
                  <div>
                    <button
                      onClick={() => setOptions({ ...options, autoContrast: !options.autoContrast })}
                      className={cn(
                        'w-full flex items-center gap-2 p-3 rounded-lg border-2 transition-all',
                        options.autoContrast
                          ? 'border-orange-500 bg-orange-50/50'
                          : 'border-gray-100 hover:border-gray-200'
                      )}
                    >
                      <Wand2 className={cn('w-4 h-4', options.autoContrast ? 'text-orange-600' : 'text-gray-400')} />
                      <div className="text-left">
                        <p className={cn('text-[11px] font-medium', options.autoContrast ? 'text-orange-700' : 'text-gray-600')}>
                          Smart Contrast Detection
                        </p>
                        <p className="text-[9px] text-gray-400">Auto-analyze brightness and recommend text colors</p>
                      </div>
                      <div className={cn(
                        'ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center',
                        options.autoContrast ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                      )}>
                        {options.autoContrast && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  </div>

                  {/* Apply Button */}
                  <Button
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                    disabled={isApplying}
                    onClick={handleApplyBackground}
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Paintbrush className="w-4 h-4 mr-2" />
                        Apply Background
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* ─── Themes Tab ──────────────────────────────────────────── */}
              {activeTab === 'themes' && (
                <div className="space-y-3">
                  <p className="text-[10px] text-gray-400">Click a theme to apply it instantly</p>
                  {['nature', 'abstract', 'geometric', 'paper', 'vintage', 'modern', 'seasonal'].map((cat) => {
                    const themes = THEME_LIBRARY_UI.filter((t) => t.category === cat)
                    if (themes.length === 0) return null
                    return (
                      <div key={cat}>
                        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 capitalize">{cat}</h4>
                        <div className="grid grid-cols-2 gap-1.5">
                          {themes.map((theme) => (
                            <button
                              key={theme.id}
                              onClick={() => handleApplyTheme(theme.id)}
                              className={cn(
                                'rounded-lg border-2 overflow-hidden transition-all hover:scale-[1.02]',
                                options.selectedThemeId === theme.id ? 'border-orange-500' : 'border-gray-100 hover:border-gray-200'
                              )}
                            >
                              <div className="h-12 w-full" style={{ background: theme.preview }} />
                              <div className="px-2 py-1.5 bg-white">
                                <p className="text-[10px] font-medium text-gray-700 truncate">{theme.name}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ─── Templates Tab ────────────────────────────────────────── */}
              {activeTab === 'templates' && (
                <div className="space-y-3">
                  <p className="text-[10px] text-gray-400">Professional brand templates</p>
                  {['corporate', 'creative', 'legal', 'academic', 'minimal'].map((cat) => {
                    const templates = BRAND_TEMPLATES_UI.filter((t) => t.category === cat)
                    return (
                      <div key={cat}>
                        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 capitalize">{cat}</h4>
                        <div className="space-y-1.5">
                          {templates.map((tmpl) => (
                            <button
                              key={tmpl.id}
                              onClick={() => handleApplyTemplate(tmpl.id)}
                              className={cn(
                                'w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left',
                                options.templateId === tmpl.id && options.type === 'template'
                                  ? 'border-orange-500 bg-orange-50/50'
                                  : 'border-gray-100 hover:border-gray-200'
                              )}
                            >
                              <div className="flex gap-1 shrink-0">
                                <div className="w-6 h-6 rounded" style={{ backgroundColor: rgbToCSS(tmpl.primary) }} />
                                {tmpl.secondary && <div className="w-6 h-6 rounded" style={{ backgroundColor: rgbToCSS(tmpl.secondary) }} />}
                              </div>
                              <div>
                                <p className="text-[11px] font-medium text-gray-700">{tmpl.name}</p>
                                <p className="text-[9px] text-gray-400 capitalize">{cat}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ─── Presets Tab ──────────────────────────────────────────── */}
              {activeTab === 'presets' && (
                <div className="space-y-3">
                  <p className="text-[10px] text-gray-400">Quick-apply background presets</p>
                  <div className="space-y-1.5">
                    {PRESETS_UI.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleApplyPreset(preset.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-orange-300 transition-all text-left group"
                      >
                        <div
                          className="w-10 h-10 rounded-lg border border-gray-200 shrink-0"
                          style={{ background: preset.preview }}
                        />
                        <div>
                          <p className="text-[11px] font-medium text-gray-700 group-hover:text-orange-600">{preset.name}</p>
                          <p className="text-[9px] text-gray-400">{preset.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* History */}
              <ToolHistoryPanel
                history={history}
                onDelete={deleteItem}
                onClearAll={clearHistory}
                toolLabel="Background PDF"
                isLoaded={isLoaded}
                compact
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
