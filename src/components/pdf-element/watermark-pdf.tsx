'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  Droplets,
  Loader2,
  Download,
  CheckCircle2,
  Eye,
  Type,
  Image as ImageIcon,
  Hash,
  Layers,
  Shield,
  ChevronRight,
  RotateCw,
  Grid3X3,
  Move,
  Upload,
  Clock,
  Lock,
  Sliders,
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

type WatermarkType = 'text' | 'image' | 'logo' | 'page-number'
type WatermarkPosition =
  | 'center'
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'diagonal'
  | 'tile'
  | 'custom'
type WatermarkFont =
  | 'Helvetica'
  | 'HelveticaBold'
  | 'TimesRoman'
  | 'TimesRomanBold'
  | 'Courier'
  | 'CourierBold'
type WatermarkLayer = 'foreground' | 'background'
type AntiRemovalLevel = 'none' | 'basic' | 'medium' | 'strong'
type PageRange = 'all' | 'first' | 'last' | 'custom'

interface WatermarkOptionsState {
  type: WatermarkType
  text: string
  font: WatermarkFont
  fontSize: number
  fontColor: { r: number; g: number; b: number }
  position: WatermarkPosition
  rotation: number
  opacity: number
  layer: WatermarkLayer
  antiRemoval: AntiRemovalLevel
  pageRange: PageRange
  customPages: string
  page_number_format: string
  page_number_position: string
  logoScale: number
  imageFile: File | null
}

interface WatermarkResultData {
  file: PdfFile
  watermark: {
    originalSize: number
    watermarkedSize: number
    sizeIncrease: number
    pagesWatermarked: number
    totalPages: number
    operations: { type: string; description: string; itemsProcessed: number }[]
    durationMs: number
  }
}

interface PreviewData {
  preview: {
    affectedPages: number
    totalPages: number
    estimatedCoverage: number
    estimatedDimensions: { width: number; height: number }
    antiRemovalDescription: string
    estimatedSizeIncrease: number
  }
  fileInfo: { id: string; name: string; size: number; pages: number }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WATERMARK_TYPE_CARDS: {
  id: WatermarkType
  label: string
  description: string
  icon: React.ElementType
}[] = [
  { id: 'text', label: 'Text', description: 'Add text watermark', icon: Type },
  { id: 'image', label: 'Image', description: 'Use an image as watermark', icon: ImageIcon },
  { id: 'logo', label: 'Logo', description: 'Brand logo watermark', icon: Droplets },
  { id: 'page-number', label: 'Page Number', description: 'Dynamic page numbering', icon: Hash },
]

const POSITION_OPTIONS: {
  id: WatermarkPosition
  label: string
  icon: React.ElementType
}[] = [
  { id: 'center', label: 'Center', icon: Move },
  { id: 'top-left', label: 'Top Left', icon: Move },
  { id: 'top-center', label: 'Top Center', icon: Move },
  { id: 'top-right', label: 'Top Right', icon: Move },
  { id: 'bottom-left', label: 'Bottom Left', icon: Move },
  { id: 'bottom-center', label: 'Bottom Center', icon: Move },
  { id: 'bottom-right', label: 'Bottom Right', icon: Move },
  { id: 'diagonal', label: 'Diagonal', icon: RotateCw },
  { id: 'tile', label: 'Tile (Repeat)', icon: Grid3X3 },
  { id: 'custom', label: 'Custom', icon: Sliders },
]

const FONT_OPTIONS: { id: WatermarkFont; label: string; sample: string }[] = [
  { id: 'Helvetica', label: 'Helvetica', sample: 'Aa' },
  { id: 'HelveticaBold', label: 'Helvetica Bold', sample: 'Aa' },
  { id: 'TimesRoman', label: 'Times Roman', sample: 'Aa' },
  { id: 'TimesRomanBold', label: 'Times Bold', sample: 'Aa' },
  { id: 'Courier', label: 'Courier', sample: 'Aa' },
  { id: 'CourierBold', label: 'Courier Bold', sample: 'Aa' },
]

const ANTI_REMOVAL_OPTIONS: {
  id: AntiRemovalLevel
  label: string
  description: string
  layers: number
}[] = [
  { id: 'none', label: 'None', description: 'Standard watermark, removable', layers: 1 },
  { id: 'basic', label: 'Basic', description: 'Embedded in content stream', layers: 1 },
  { id: 'medium', label: 'Medium', description: 'Dual-layer with offset', layers: 2 },
  { id: 'strong', label: 'Strong', description: 'Triple-layer, nearly impossible to remove', layers: 3 },
]

const COLOR_PRESETS = [
  { label: 'Gray', r: 0.5, g: 0.5, b: 0.5 },
  { label: 'Red', r: 0.8, g: 0.1, b: 0.1 },
  { label: 'Blue', r: 0.2, g: 0.4, b: 0.8 },
  { label: 'Green', r: 0.1, g: 0.6, b: 0.2 },
  { label: 'Dark', r: 0.15, g: 0.15, b: 0.15 },
  { label: 'Gold', r: 0.7, g: 0.55, b: 0.1 },
]

const DEFAULT_OPTIONS: WatermarkOptionsState = {
  type: 'text',
  text: 'CONFIDENTIAL',
  font: 'HelveticaBold',
  fontSize: 48,
  fontColor: { r: 0.5, g: 0.5, b: 0.5 },
  position: 'diagonal',
  rotation: -45,
  opacity: 0.3,
  layer: 'foreground',
  antiRemoval: 'basic',
  pageRange: 'all',
  customPages: '',
  page_number_format: 'Page {n} of {total}',
  page_number_position: 'footer-center',
  logoScale: 0.15,
  imageFile: null,
}

// ─── Batch Mode View ─────────────────────────────────────────────────────────

function BatchWatermarkView({ onBack, addHistory }: { onBack: () => void; addHistory: (summary: string, details?: Record<string, any>, status?: 'success' | 'error' | 'partial') => any }) {
  const { recentFiles, setCurrentView } = useAppStore()
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [options, setOptions] = useState<WatermarkOptionsState>(DEFAULT_OPTIONS)
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

  const handleBatchWatermark = async () => {
    if (selectedIds.size === 0) return
    setIsProcessing(true)

    try {
      const response = await fetch('/api/files/watermark-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: Array.from(selectedIds),
          options: {
            type: options.type,
            text: options.text,
            font: options.font,
            fontSize: options.fontSize,
            fontColor: options.fontColor,
            position: options.position,
            rotation: options.rotation,
            opacity: options.opacity,
            layer: options.layer,
            antiRemoval: options.antiRemoval,
            pageRange: options.pageRange,
            page_number_format: options.page_number_format,
            page_number_position: options.page_number_position,
            logoScale: options.logoScale,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Batch watermark failed' }))
        throw new Error(errorData.error || 'Batch watermark failed')
      }

      const data = await response.json()
      setResults(data)

      await useAppStore.getState().fetchFiles()

      toast({
        title: 'Batch Watermark Complete',
        description: `${data.summary.success} files watermarked successfully`,
      })

      addHistory(
        `Batch watermarked ${data.summary.success} files`,
        {
          fileCount: data.summary.success,
          totalSizeIncrease: data.summary.totalSizeIncrease,
          errors: data.summary.errors,
          watermarkType: options.type,
        },
        data.summary.errors > 0 ? 'partial' : 'success'
      )
    } catch (error: any) {
      toast({
        title: 'Batch Watermark Failed',
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
          <h3 className="text-sm font-semibold text-gray-900">Batch Watermark</h3>
          <p className="text-xs text-gray-400">Apply the same watermark to multiple PDFs</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={onBack}>
          Single File Mode
        </Button>
      </div>

      {/* Watermark Text Input */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-600">Watermark Text</label>
        <input
          type="text"
          value={options.text}
          onChange={(e) => setOptions({ ...options, text: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
          placeholder="Enter watermark text..."
        />
      </div>

      {/* File list */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {recentFiles.map((file) => (
          <button
            key={file.id}
            onClick={() => toggleFile(file.id)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
              selectedIds.has(file.id) ? 'border-teal-500 bg-teal-50/50' : 'border-gray-100 hover:border-gray-200'
            )}
          >
            <div className={cn(
              'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
              selectedIds.has(file.id) ? 'border-teal-500 bg-teal-500' : 'border-gray-300'
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
        <Card className="border-teal-200 bg-teal-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-800">Batch Complete</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-teal-600">{results.summary.success}</p>
                <p className="text-[10px] text-gray-500">Watermarked</p>
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
              Watermark More
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button
          className="w-full bg-teal-600 hover:bg-teal-700 text-white"
          disabled={selectedIds.size === 0 || isProcessing}
          onClick={handleBatchWatermark}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing {selectedIds.size} Files...
            </>
          ) : (
            <>
              <Droplets className="w-4 h-4 mr-2" />
              Watermark {selectedIds.size} File{selectedIds.size !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WatermarkPdf() {
  const { recentFiles, setCurrentView } = useAppStore()
  const { toast } = useToast()
  const { history, addHistory, deleteItem, clearHistory, isLoaded } = useToolHistory('watermark', 'Watermark PDF')

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [options, setOptions] = useState<WatermarkOptionsState>(DEFAULT_OPTIONS)
  const [result, setResult] = useState<WatermarkResultData | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [showSettingsPanel, setShowSettingsPanel] = useState(true)
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
          `/api/files/${selectedFile.id}/watermark?options=${encodeURIComponent(JSON.stringify(apiOptions))}`
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

    // Debounce
    const timer = setTimeout(fetchPreview, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [selectedFile?.id, options.type, options.position, options.opacity, options.antiRemoval, options.pageRange])

  const buildApiOptions = (opts: WatermarkOptionsState) => ({
    type: opts.type,
    text: opts.text,
    font: opts.font,
    fontSize: opts.fontSize,
    fontColor: opts.fontColor,
    position: opts.position,
    rotation: opts.rotation,
    opacity: opts.opacity,
    layer: opts.layer,
    antiRemoval: opts.antiRemoval,
    pageRange: opts.pageRange,
    customPages: opts.customPages ? opts.customPages.split(',').map(Number) : undefined,
    page_number_format: opts.page_number_format,
    page_number_position: opts.page_number_position,
    logoScale: opts.logoScale,
  })

  const handleApplyWatermark = useCallback(async () => {
    if (!selectedFile) return
    setIsApplying(true)
    setResult(null)

    try {
      const apiOptions = buildApiOptions(options)

      let response: Response

      if (options.imageFile && (options.type === 'image' || options.type === 'logo')) {
        // FormData for image upload
        const formData = new FormData()
        formData.append('options', JSON.stringify(apiOptions))
        formData.append('image', options.imageFile)

        response = await fetch(`/api/files/${selectedFile.id}/watermark`, {
          method: 'POST',
          body: formData,
        })
      } else {
        // JSON for text watermarks
        response = await fetch(`/api/files/${selectedFile.id}/watermark`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ options: apiOptions }),
        })
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Watermark failed' }))
        throw new Error(errorData.error || 'Watermark failed')
      }

      const data = await response.json()
      setResult(data as WatermarkResultData)

      await useAppStore.getState().fetchFiles()

      toast({
        title: 'Watermark Applied',
        description: `Watermarked ${data.watermark.pagesWatermarked} page(s) in ${(data.watermark.durationMs / 1000).toFixed(1)}s`,
      })

      addHistory(
        `Watermarked ${selectedFile.name} — ${options.type} "${options.text || options.type}"`,
        {
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          watermarkType: options.type,
          watermarkText: options.text,
          position: options.position,
          opacity: options.opacity,
          pagesWatermarked: data.watermark.pagesWatermarked,
          sizeIncrease: data.watermark.sizeIncrease,
        },
        'success'
      )
    } catch (error: any) {
      toast({
        title: 'Watermark Failed',
        description: error.message || 'Failed to apply watermark',
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

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File Too Large', description: 'Image must be under 5MB', variant: 'destructive' })
      return
    }

    setOptions({ ...options, imageFile: file })
  }

  if (isBatchMode) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
              <Droplets className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-semibold text-gray-800">Batch Watermark PDFs</h1>
              <p className="text-xs text-gray-400">Apply watermark to multiple files at once</p>
            </div>
          </div>
          <button onClick={() => setCurrentView('home')} className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 md:p-6 md:flex-1 md:min-h-0 md:overflow-auto pb-4 md:pb-0">
          <BatchWatermarkView onBack={() => setIsBatchMode(false)} addHistory={addHistory} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
            <Droplets className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold text-gray-800">Watermark PDF</h1>
            <p className="text-xs text-gray-400">Add professional watermarks to your PDF documents</p>
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
        <div className="p-4 md:p-6 md:flex-1 md:min-h-0 md:overflow-auto pb-4 md:pb-0">
          {!selectedFile ? (
            /* File Selection */
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to watermark</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => { setSelectedFile(file); setResult(null) }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-teal-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-teal-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-teal-600 truncate">{file.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.size)} · {file.pages} page{file.pages !== 1 ? 's' : ''}</div>
                        <div className="text-[11px] text-gray-300 mt-0.5">{formatDate(file.updatedAt)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                  <Droplets className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to add watermarks</p>
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
                      <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-teal-600" />
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

              {/* Watermark Type Selector */}
              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-2">Watermark Type</h4>
                <div className="grid grid-cols-4 gap-2">
                  {WATERMARK_TYPE_CARDS.map((wt) => (
                    <button
                      key={wt.id}
                      onClick={() => setOptions({ ...options, type: wt.id })}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                        options.type === wt.id
                          ? 'border-teal-500 bg-teal-50/50 shadow-sm'
                          : 'border-gray-100 hover:border-gray-200'
                      )}
                    >
                      <wt.icon className={cn(
                        'w-5 h-5',
                        options.type === wt.id ? 'text-teal-600' : 'text-gray-400'
                      )} />
                      <span className={cn(
                        'text-[11px] font-medium',
                        options.type === wt.id ? 'text-teal-700' : 'text-gray-500'
                      )}>
                        {wt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Watermark Preview */}
              {preview && !result && (
                <Card className="border-teal-500/20 bg-teal-50/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-4 h-4 text-teal-600" />
                      <h4 className="text-sm font-medium text-teal-700">Watermark Preview</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Affected Pages</span>
                          <span className="text-xs font-medium text-gray-800">
                            {preview.preview.affectedPages} of {preview.preview.totalPages}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Est. Coverage</span>
                          <span className="text-xs font-medium text-teal-600">~{preview.preview.estimatedCoverage}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Est. Size Increase</span>
                          <span className="text-xs font-medium text-gray-800">
                            {formatFileSize(preview.preview.estimatedSizeIncrease)}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <Shield className="w-3 h-3 text-amber-500" />
                          <span className="line-clamp-2">{preview.preview.antiRemovalDescription}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <Layers className="w-3 h-3 text-teal-500" />
                          {options.layer === 'foreground' ? 'Foreground (overlay)' : 'Background (underlay)'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isLoadingPreview && !preview && !result && (
                <Card className="border-gray-200">
                  <CardContent className="p-4 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
                    <span className="text-xs text-gray-500">Analyzing watermark placement...</span>
                  </CardContent>
                </Card>
              )}

              {/* Watermark Result */}
              {result && (
                <div className="space-y-4">
                  {/* Success Banner */}
                  <Card className="border-teal-200 bg-teal-50/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">Watermark Applied Successfully</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {result.watermark.pagesWatermarked} page(s) watermarked · Size increased by {formatFileSize(result.watermark.sizeIncrease)}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                          <Clock className="w-3 h-3 mr-1" />
                          {(result.watermark.durationMs / 1000).toFixed(1)}s
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Size Comparison */}
                  <Card className="border-gray-200">
                    <CardContent className="p-5 space-y-4">
                      <h4 className="text-sm font-medium text-gray-700">Before & After Comparison</h4>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Before
                          </span>
                          <span className="font-medium text-gray-700">{formatFileSize(result.watermark.originalSize)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-gray-300 rounded-full" style={{ width: '100%' }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-teal-600 flex items-center gap-1">
                            <Droplets className="w-3 h-3" /> After
                          </span>
                          <span className="font-medium text-teal-600">{formatFileSize(result.watermark.watermarkedSize)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min((result.watermark.watermarkedSize / result.watermark.originalSize) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-teal-600">
                            +{formatFileSize(result.watermark.sizeIncrease)}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Size Added</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-800">
                            {result.watermark.pagesWatermarked}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Pages Watermarked</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-800">
                            {result.watermark.totalPages}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Total Pages</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Operations Breakdown */}
                  {result.watermark.operations && result.watermark.operations.length > 0 && (
                    <Card className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Layers className="w-4 h-4 text-gray-500" />
                          <h4 className="text-xs font-medium text-gray-600">Watermark Operations</h4>
                        </div>
                        <div className="space-y-2">
                          {result.watermark.operations.map((op, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <ChevronRight className="w-3 h-3 text-teal-500 mt-0.5 shrink-0" />
                              <p className="text-xs text-gray-700">{op.description}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Download */}
                  <div className="flex items-center gap-3">
                    <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Watermarked PDF
                    </Button>
                    <Button variant="outline" className="text-xs" onClick={() => { setSelectedFile(null); setResult(null); setPreview(null) }}>
                      Watermark Another File
                    </Button>
                  </div>
                </div>
              )}

              {/* Applying State */}
              {isApplying && !result && (
                <Card className="border-gray-200">
                  <CardContent className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-3" />
                    <p className="text-sm font-medium text-gray-700">Applying Watermark...</p>
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
          <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-gray-200 p-4 md:p-5 md:overflow-y-auto shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">Watermark Settings</h3>
            </div>

            <div className="space-y-5">
              {/* Text Input */}
              {(options.type === 'text' || options.type === 'page-number') && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                    {options.type === 'page-number' ? 'Page Number Format' : 'Watermark Text'}
                  </label>
                  <input
                    type="text"
                    value={options.type === 'page-number' ? options.page_number_format : options.text}
                    onChange={(e) =>
                      options.type === 'page-number'
                        ? setOptions({ ...options, page_number_format: e.target.value })
                        : setOptions({ ...options, text: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                    placeholder={options.type === 'page-number' ? 'Page {n} of {total}' : 'Enter watermark text...'}
                  />
                  {options.type === 'page-number' && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Use {'{n}'} for current page, {'{total}'} for total pages
                    </p>
                  )}
                </div>
              )}

              {/* Image Upload */}
              {(options.type === 'image' || options.type === 'logo') && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                    {options.type === 'logo' ? 'Logo Image' : 'Watermark Image'}
                  </label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-200 rounded-lg hover:border-teal-400 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {options.imageFile ? options.imageFile.name : 'Select PNG or JPEG image'}
                    </span>
                  </button>
                  {options.imageFile && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-teal-500" />
                      <span className="text-[10px] text-teal-600">
                        {(options.imageFile.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  )}

                  {/* Logo Scale */}
                  {options.type === 'logo' && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-gray-600">Logo Scale</label>
                        <span className="text-xs font-medium text-gray-800">{Math.round(options.logoScale * 100)}%</span>
                      </div>
                      <Slider
                        value={[options.logoScale * 100]}
                        onValueChange={([v]) => setOptions({ ...options, logoScale: v / 100 })}
                        min={5}
                        max={50}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Position Selector */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Position</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {POSITION_OPTIONS.map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => setOptions({ ...options, position: pos.id })}
                      className={cn(
                        'px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all',
                        options.position === pos.id
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-gray-100 text-gray-500 hover:border-gray-200'
                      )}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Page Number Position (for page-number type) */}
              {options.type === 'page-number' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">Number Position</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'header-center', label: 'Header Center' },
                      { id: 'header-right', label: 'Header Right' },
                      { id: 'footer-center', label: 'Footer Center' },
                      { id: 'footer-right', label: 'Footer Right' },
                    ].map((pos) => (
                      <button
                        key={pos.id}
                        onClick={() => setOptions({ ...options, page_number_position: pos.id })}
                        className={cn(
                          'px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all',
                          options.page_number_position === pos.id
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-gray-100 text-gray-500 hover:border-gray-200'
                        )}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Font Selector */}
              {(options.type === 'text' || options.type === 'page-number') && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">Font</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FONT_OPTIONS.map((font) => (
                      <button
                        key={font.id}
                        onClick={() => setOptions({ ...options, font: font.id })}
                        className={cn(
                          'px-2 py-2 rounded-md border transition-all text-left',
                          options.font === font.id
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-100 hover:border-gray-200'
                        )}
                      >
                        <span className={cn(
                          'text-xs font-medium block',
                          options.font === font.id ? 'text-teal-700' : 'text-gray-600',
                          font.id.includes('Bold') && 'font-bold'
                        )}>
                          {font.sample}
                        </span>
                        <span className="text-[9px] text-gray-400">{font.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Font Size */}
              {(options.type === 'text' || options.type === 'page-number') && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-gray-600">Font Size</label>
                    <span className="text-xs font-medium text-gray-800">{options.fontSize}pt</span>
                  </div>
                  <Slider
                    value={[options.fontSize]}
                    onValueChange={([v]) => setOptions({ ...options, fontSize: v })}
                    min={8}
                    max={120}
                    step={1}
                    className="w-full"
                  />
                </div>
              )}

              {/* Color Presets */}
              {(options.type === 'text' || options.type === 'page-number') && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">Color</label>
                  <div className="flex items-center gap-2">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color.label}
                        onClick={() => setOptions({ ...options, fontColor: { r: color.r, g: color.g, b: color.b } })}
                        className={cn(
                          'w-7 h-7 rounded-full border-2 transition-all',
                          options.fontColor.r === color.r && options.fontColor.g === color.g && options.fontColor.b === color.b
                            ? 'border-teal-500 scale-110 shadow-sm'
                            : 'border-gray-200 hover:scale-105'
                        )}
                        style={{ backgroundColor: `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})` }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Transparency Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Opacity
                  </label>
                  <span className="text-xs font-medium text-gray-800">{Math.round(options.opacity * 100)}%</span>
                </div>
                <Slider
                  value={[options.opacity * 100]}
                  onValueChange={([v]) => setOptions({ ...options, opacity: v / 100 })}
                  min={5}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-gray-300">Subtle</span>
                  <span className="text-[9px] text-gray-300">Solid</span>
                </div>
              </div>

              {/* Rotation */}
              {(options.type === 'text' || options.type === 'image') && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                      <RotateCw className="w-3 h-3" />
                      Rotation
                    </label>
                    <span className="text-xs font-medium text-gray-800">{options.rotation}°</span>
                  </div>
                  <Slider
                    value={[options.rotation]}
                    onValueChange={([v]) => setOptions({ ...options, rotation: v })}
                    min={-180}
                    max={180}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-gray-300">-180°</span>
                    <span className="text-[9px] text-gray-300">0°</span>
                    <span className="text-[9px] text-gray-300">180°</span>
                  </div>
                </div>
              )}

              <Separator />

              {/* Layer Control */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Layer
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: 'foreground' as const, label: 'Foreground', desc: 'Overlay on content' },
                    { id: 'background' as const, label: 'Background', desc: 'Behind content' },
                  ]).map((layer) => (
                    <button
                      key={layer.id}
                      onClick={() => setOptions({ ...options, layer: layer.id })}
                      className={cn(
                        'p-2.5 rounded-lg border-2 text-left transition-all',
                        options.layer === layer.id
                          ? 'border-teal-500 bg-teal-50/50 shadow-sm'
                          : 'border-gray-100 hover:border-gray-200'
                      )}
                    >
                      <p className="text-xs font-medium text-gray-800">{layer.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{layer.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Anti-Removal Protection */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Anti-Removal Protection
                </label>
                <div className="space-y-1.5">
                  {ANTI_REMOVAL_OPTIONS.map((ar) => (
                    <button
                      key={ar.id}
                      onClick={() => setOptions({ ...options, antiRemoval: ar.id })}
                      className={cn(
                        'w-full flex items-center gap-2 p-2 rounded-lg border transition-all text-left',
                        options.antiRemoval === ar.id
                          ? 'border-teal-500 bg-teal-50/50'
                          : 'border-gray-100 hover:border-gray-200'
                      )}
                    >
                      <div className={cn(
                        'w-6 h-6 rounded flex items-center justify-center shrink-0 text-[10px] font-bold',
                        options.antiRemoval === ar.id ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-400'
                      )}>
                        {ar.layers}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700">{ar.label}</p>
                        <p className="text-[10px] text-gray-400">{ar.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Page Range */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Page Range</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { id: 'all' as const, label: 'All Pages' },
                    { id: 'first' as const, label: 'First Only' },
                    { id: 'last' as const, label: 'Last Only' },
                  ]).map((pr) => (
                    <button
                      key={pr.id}
                      onClick={() => setOptions({ ...options, pageRange: pr.id })}
                      className={cn(
                        'px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all',
                        options.pageRange === pr.id
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-gray-100 text-gray-500 hover:border-gray-200'
                      )}
                    >
                      {pr.label}
                    </button>
                  ))}
                </div>
                {options.pageRange === 'custom' && (
                  <input
                    type="text"
                    value={options.customPages}
                    onChange={(e) => setOptions({ ...options, customPages: e.target.value })}
                    className="w-full mt-2 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                    placeholder="e.g., 1,3,5-10"
                  />
                )}
              </div>

              <Separator />

              {/* File Info */}
              {selectedFile && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">File Information</label>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">File Name</span>
                      <span className="text-gray-700 truncate ml-2 max-w-[160px]">{selectedFile.name}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">File Size</span>
                      <span className="text-gray-700">{formatFileSize(selectedFile.size)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Pages</span>
                      <span className="text-gray-700">{selectedFile.pages}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Apply Button */}
              <div className="space-y-2">
                <Button
                  className="w-full h-9 text-xs bg-teal-600 hover:bg-teal-700"
                  disabled={isApplying || (!options.imageFile && (options.type === 'image' || options.type === 'logo'))}
                  onClick={handleApplyWatermark}
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Droplets className="w-3.5 h-3.5 mr-1" />
                      Apply Watermark
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-9 text-xs"
                  onClick={() => { setSelectedFile(null); setResult(null); setPreview(null) }}
                >
                  Back to File List
                </Button>
              </div>

              <Separator />

              {/* History */}
              <ToolHistoryPanel
                history={history}
                onDelete={deleteItem}
                onClearAll={clearHistory}
                toolLabel="Watermark PDF"
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
