'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  Loader2,
  Download,
  CheckCircle2,
  Eye,
  Crop as CropIcon,
  RotateCw,
  Sliders,
  Wand2,
  LayoutGrid,
  Undo2,
  Redo2,
  Layers,
  ChevronRight,
  Clock,
  Ruler,
  BoxSelect,
  Scissors,
  Sparkles,
  AlertTriangle,
  Maximize2,
  Move,
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

type CropMode = 'manual' | 'preset' | 'auto-margin' | 'whitespace' | 'ai-suggest'
type CropPresetId = 'letter' | 'a4' | 'legal' | 'a3' | 'a5' | 'tabloid' | 'half-letter' | 'square' | '4x6' | '5x7' | '8x10' | '16x9' | 'no-margins' | '0.5in-margins' | '1in-margins' | 'custom'
type PageRange = 'all' | 'even' | 'odd' | 'first' | 'last' | 'custom'
type RotationAngle = 0 | 90 | 180 | 270
type CropUnit = 'points' | 'inches' | 'mm' | 'percent'

interface CropBox { left: number; bottom: number; right: number; top: number }

interface CropOptionsState {
  mode: CropMode
  cropBox: CropBox
  presetId: CropPresetId
  pageRange: PageRange
  customPages: string
  rotation: RotationAngle
  unit: CropUnit
  marginSensitivity: number
  whitespaceThreshold: number
  useAISuggestion: boolean
  maintainAspectRatio: boolean
  anchor: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  // Per-page overrides
  perPageMode: boolean
  perPage: Array<{
    pageNumbers: number[]
    cropBox: CropBox
    rotation?: RotationAngle
  }>
  // Active page for visual editor
  activePage: number
}

interface CropResultData {
  file: PdfFile
  crop: {
    originalSize: number
    outputSize: number
    sizeIncrease: number
    pagesCropped: number
    totalPages: number
    operations: { type: string; description: string; itemsProcessed: number }[]
    durationMs: number
  }
}

interface PreviewData {
  preview: {
    totalPages: number
    affectedPages: number
    pageDimensions: Array<{ width: number; height: number; rotation: number }>
    originalSize: { width: number; height: number }
    croppedSize: { width: number; height: number }
    areaRemoved: number
    marginDetection?: {
      left: number; bottom: number; right: number; top: number
      contentAreaWidth: number; contentAreaHeight: number; confidence: number
    }
    whitespaceAnalysis?: {
      hasWhitespace: boolean
      whitespaceAmount: string
      suggestedCrop: CropBox
      removedArea: number
    }
    aiSuggestion?: {
      suggestedCrop: CropBox
      confidence: number
      reasoning: string
      detectedElements: string[]
      alternativeCrops: Array<{ crop: CropBox; label: string; description: string }>
    }
    warnings: string[]
  }
  fileInfo: { id: string; name: string; size: number; pages: number }
}

// ─── History for Undo/Redo ───────────────────────────────────────────────────

interface HistoryEntry {
  cropBox: CropBox
  mode: CropMode
  rotation: RotationAngle
  description: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CROP_MODE_CARDS: { id: CropMode; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'manual', label: 'Manual', description: 'Set crop values manually', icon: BoxSelect },
  { id: 'preset', label: 'Preset', description: 'Use size presets', icon: LayoutGrid },
  { id: 'auto-margin', label: 'Auto Margins', description: 'Detect content bounds', icon: Maximize2 },
  { id: 'whitespace', label: 'Whitespace', description: 'Remove whitespace', icon: Scissors },
  { id: 'ai-suggest', label: 'AI Suggest', description: 'Smart crop suggestions', icon: Wand2 },
]

const CROP_PRESETS_UI: { id: CropPresetId; name: string; description: string; category: string }[] = [
  { id: 'letter', name: 'US Letter', description: '8.5×11 in', category: 'Paper' },
  { id: 'a4', name: 'A4', description: '210×297 mm', category: 'Paper' },
  { id: 'legal', name: 'US Legal', description: '8.5×14 in', category: 'Paper' },
  { id: 'a3', name: 'A3', description: '297×420 mm', category: 'Paper' },
  { id: 'a5', name: 'A5', description: '148×210 mm', category: 'Paper' },
  { id: 'tabloid', name: 'Tabloid', description: '11×17 in', category: 'Paper' },
  { id: 'half-letter', name: 'Half Letter', description: '5.5×8.5 in', category: 'Paper' },
  { id: 'square', name: 'Square', description: 'Equal sides', category: 'Photo' },
  { id: '4x6', name: '4×6', description: '4×6 in photo', category: 'Photo' },
  { id: '5x7', name: '5×7', description: '5×7 in photo', category: 'Photo' },
  { id: '8x10', name: '8×10', description: '8×10 in photo', category: 'Photo' },
  { id: '16x9', name: '16:9', description: 'Widescreen', category: 'Ratio' },
  { id: 'no-margins', name: 'No Margins', description: 'Remove all margins', category: 'Margin' },
  { id: '0.5in-margins', name: '0.5" Margins', description: 'Standard half-inch', category: 'Margin' },
  { id: '1in-margins', name: '1" Margins', description: 'Standard one-inch', category: 'Margin' },
]

const UNIT_OPTIONS: { id: CropUnit; label: string }[] = [
  { id: 'points', label: 'pt' },
  { id: 'inches', label: 'in' },
  { id: 'mm', label: 'mm' },
  { id: 'percent', label: '%' },
]

const DEFAULT_OPTIONS: CropOptionsState = {
  mode: 'manual',
  cropBox: { left: 36, bottom: 36, right: 36, top: 36 },
  presetId: 'a4',
  pageRange: 'all',
  customPages: '',
  rotation: 0,
  unit: 'inches',
  marginSensitivity: 0.5,
  whitespaceThreshold: 0.95,
  useAISuggestion: false,
  maintainAspectRatio: false,
  anchor: 'center',
  perPageMode: false,
  perPage: [],
  activePage: 1,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ptsToUnit(pts: number, unit: CropUnit): number {
  switch (unit) {
    case 'inches': return Math.round((pts / 72) * 1000) / 1000
    case 'mm': return Math.round((pts / 72 * 25.4) * 10) / 10
    case 'percent': return Math.round(pts * 100) / 100 // handled separately with page dims
    default: return Math.round(pts)
  }
}

function unitToPts(value: number, unit: CropUnit): number {
  switch (unit) {
    case 'inches': return value * 72
    case 'mm': return value * 72 / 25.4
    case 'percent': return value // handled separately
    default: return value
  }
}

function buildApiOptions(opts: CropOptionsState) {
  return {
    mode: opts.mode,
    cropBox: opts.cropBox,
    presetId: opts.presetId,
    pageRange: opts.pageRange,
    customPages: opts.customPages ? opts.customPages.split(',').map(Number) : undefined,
    rotation: opts.rotation,
    unit: opts.unit,
    marginSensitivity: opts.marginSensitivity,
    whitespaceThreshold: opts.whitespaceThreshold,
    useAISuggestion: opts.useAISuggestion,
    maintainAspectRatio: opts.maintainAspectRatio,
    anchor: opts.anchor,
    perPage: opts.perPage,
  }
}

// ─── Visual Crop Editor Component ────────────────────────────────────────────

function VisualCropEditor({
  cropBox,
  pageWidth,
  pageHeight,
  onChange,
  unit,
}: {
  cropBox: CropBox
  pageWidth: number
  pageHeight: number
  onChange: (box: CropBox) => void
  unit: CropUnit
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [initialBox, setInitialBox] = useState<CropBox>(cropBox)

  // Scale factor: fit the page into the editor area
  const editorWidth = 320
  const editorHeight = 420
  const scaleX = editorWidth / pageWidth
  const scaleY = editorHeight / pageHeight
  const scale = Math.min(scaleX, scaleY)

  const displayWidth = pageWidth * scale
  const displayHeight = pageHeight * scale
  const offsetX = (editorWidth - displayWidth) / 2
  const offsetY = (editorHeight - displayHeight) / 2

  // Convert crop box to display coordinates
  const topY = offsetY + cropBox.top * scale
  const bottomY = offsetY + displayHeight - cropBox.bottom * scale
  const leftX = offsetX + cropBox.left * scale
  const rightX = offsetX + displayWidth - cropBox.right * scale

  const handleMouseDown = (handle: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(handle)
    setDragStart({ x: e.clientX, y: e.clientY })
    setInitialBox({ ...cropBox })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const dx = (e.clientX - dragStart.x) / scale
    const dy = (e.clientY - dragStart.y) / scale

    const newBox = { ...initialBox }

    switch (isDragging) {
      case 'left':
        newBox.left = Math.max(0, Math.min(initialBox.left + dx, pageWidth - newBox.right - 10))
        break
      case 'right':
        newBox.right = Math.max(0, Math.min(initialBox.right - dx, pageWidth - newBox.left - 10))
        break
      case 'top':
        newBox.top = Math.max(0, Math.min(initialBox.top + dy, pageHeight - newBox.bottom - 10))
        break
      case 'bottom':
        newBox.bottom = Math.max(0, Math.min(initialBox.bottom - dy, pageHeight - newBox.top - 10))
        break
      case 'top-left':
        newBox.left = Math.max(0, Math.min(initialBox.left + dx, pageWidth - newBox.right - 10))
        newBox.top = Math.max(0, Math.min(initialBox.top + dy, pageHeight - newBox.bottom - 10))
        break
      case 'top-right':
        newBox.right = Math.max(0, Math.min(initialBox.right - dx, pageWidth - newBox.left - 10))
        newBox.top = Math.max(0, Math.min(initialBox.top + dy, pageHeight - newBox.bottom - 10))
        break
      case 'bottom-left':
        newBox.left = Math.max(0, Math.min(initialBox.left + dx, pageWidth - newBox.right - 10))
        newBox.bottom = Math.max(0, Math.min(initialBox.bottom - dy, pageHeight - newBox.top - 10))
        break
      case 'bottom-right':
        newBox.right = Math.max(0, Math.min(initialBox.right - dx, pageWidth - newBox.left - 10))
        newBox.bottom = Math.max(0, Math.min(initialBox.bottom - dy, pageHeight - newBox.top - 10))
        break
    }

    onChange(newBox)
  }, [isDragging, dragStart, initialBox, scale, pageWidth, pageHeight, onChange])

  const handleMouseUp = useCallback(() => {
    setIsDragging(null)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const handleStyle = (position: string): React.CSSProperties => {
    const size = 10
    const base: React.CSSProperties = {
      position: 'absolute',
      width: size,
      height: size,
      backgroundColor: '#ea580c',
      border: '2px solid white',
      borderRadius: 2,
      cursor: getCursor(position),
      zIndex: 20,
    }

    switch (position) {
      case 'top-left': return { ...base, left: leftX - size / 2, top: topY - size / 2 }
      case 'top-right': return { ...base, left: rightX - size / 2, top: topY - size / 2 }
      case 'bottom-left': return { ...base, left: leftX - size / 2, top: bottomY - size / 2 }
      case 'bottom-right': return { ...base, left: rightX - size / 2, top: bottomY - size / 2 }
      case 'left': return { ...base, left: leftX - size / 2, top: (topY + bottomY) / 2 - size / 2 }
      case 'right': return { ...base, left: rightX - size / 2, top: (topY + bottomY) / 2 - size / 2 }
      case 'top': return { ...base, left: (leftX + rightX) / 2 - size / 2, top: topY - size / 2 }
      case 'bottom': return { ...base, left: (leftX + rightX) / 2 - size / 2, top: bottomY - size / 2 }
      default: return base
    }
  }

  const getCursor = (pos: string): string => {
    switch (pos) {
      case 'top-left': case 'bottom-right': return 'nwse-resize'
      case 'top-right': case 'bottom-left': return 'nesw-resize'
      case 'left': case 'right': return 'ew-resize'
      case 'top': case 'bottom': return 'ns-resize'
      default: return 'move'
    }
  }

  return (
    <div
      ref={editorRef}
      className="relative bg-gray-50 border border-gray-200 rounded-lg select-none overflow-hidden"
      style={{ width: editorWidth, height: editorHeight }}
    >
      {/* Page representation */}
      <div
        className="absolute bg-white border border-gray-300 shadow-sm"
        style={{
          left: offsetX,
          top: offsetY,
          width: displayWidth,
          height: displayHeight,
        }}
      >
        {/* Simulated document content lines */}
        <div className="p-4 space-y-2 opacity-30">
          <div className="h-1.5 bg-gray-400 rounded w-3/4" />
          <div className="h-1.5 bg-gray-400 rounded w-full" />
          <div className="h-1.5 bg-gray-400 rounded w-5/6" />
          <div className="h-1.5 bg-gray-400 rounded w-2/3" />
          <div className="h-3" />
          <div className="h-1.5 bg-gray-400 rounded w-full" />
          <div className="h-1.5 bg-gray-400 rounded w-4/5" />
          <div className="h-1.5 bg-gray-400 rounded w-3/4" />
          <div className="h-3" />
          <div className="h-1.5 bg-gray-400 rounded w-full" />
          <div className="h-1.5 bg-gray-400 rounded w-1/2" />
        </div>
      </div>

      {/* Shaded overlay — areas being cropped */}
      {/* Top shade */}
      <div className="absolute bg-orange-500/15" style={{ left: offsetX, top: offsetY, width: displayWidth, height: cropBox.top * scale }} />
      {/* Bottom shade */}
      <div className="absolute bg-orange-500/15" style={{ left: offsetX, top: bottomY, width: displayWidth, height: cropBox.bottom * scale }} />
      {/* Left shade */}
      <div className="absolute bg-orange-500/15" style={{ left: offsetX, top: topY, width: cropBox.left * scale, height: bottomY - topY }} />
      {/* Right shade */}
      <div className="absolute bg-orange-500/15" style={{ left: rightX, top: topY, width: cropBox.right * scale, height: bottomY - topY }} />

      {/* Crop border */}
      <div
        className="absolute border-2 border-orange-500 border-dashed"
        style={{
          left: leftX,
          top: topY,
          width: rightX - leftX,
          height: bottomY - topY,
        }}
      />

      {/* Dimension labels */}
      <div className="absolute text-[9px] font-medium text-orange-600 bg-white/80 px-1 rounded" style={{ left: leftX, top: topY - 14 }}>
        {ptsToUnit(cropBox.left, unit)}{unit === 'percent' ? '%' : unit} × {ptsToUnit(cropBox.top, unit)}{unit === 'percent' ? '%' : unit}
      </div>
      <div className="absolute text-[9px] font-medium text-orange-600 bg-white/80 px-1 rounded" style={{ right: editorWidth - rightX, top: bottomY + 2 }}>
        {ptsToUnit(cropBox.right, unit)}{unit === 'percent' ? '%' : unit} × {ptsToUnit(cropBox.bottom, unit)}{unit === 'percent' ? '%' : unit}
      </div>

      {/* Drag handles */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right', 'top', 'bottom'].map((handle) => (
        <div
          key={handle}
          style={handleStyle(handle)}
          onMouseDown={(e) => handleMouseDown(handle, e)}
        />
      ))}

      {/* Center crop size label */}
      <div className="absolute text-[10px] font-medium text-gray-500 bg-white/90 px-2 py-0.5 rounded border border-gray-200" style={{
        left: (leftX + rightX) / 2 - 30,
        top: (topY + bottomY) / 2 - 8,
      }}>
        {ptsToUnit(pageWidth - cropBox.left - cropBox.right, unit)} × {ptsToUnit(pageHeight - cropBox.top - cropBox.bottom, unit)} {unit}
      </div>
    </div>
  )
}

// ─── Batch View ──────────────────────────────────────────────────────────────

function BatchCropView({ onBack }: { onBack: () => void }) {
  const { recentFiles, setCurrentView } = useAppStore()
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [options, setOptions] = useState<CropOptionsState>(DEFAULT_OPTIONS)
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

  const handleBatchCrop = async () => {
    if (selectedIds.size === 0) return
    setIsProcessing(true)

    try {
      const response = await fetch('/api/files/crop-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: Array.from(selectedIds),
          options: buildApiOptions(options),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Batch crop failed' }))
        throw new Error(errorData.error || 'Batch crop failed')
      }

      const data = await response.json()
      setResults(data)
      await useAppStore.getState().fetchFiles()

      toast({
        title: 'Batch Crop Complete',
        description: `${data.summary.success} files cropped successfully`,
      })
    } catch (error: any) {
      toast({
        title: 'Batch Crop Failed',
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
          <h3 className="text-sm font-semibold text-gray-900">Batch Crop</h3>
          <p className="text-xs text-gray-400">Apply the same crop to multiple PDFs</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={onBack}>
          Single File Mode
        </Button>
      </div>

      {/* Quick crop values */}
      <div className="grid grid-cols-4 gap-2">
        {(['left', 'bottom', 'right', 'top'] as const).map((side) => (
          <div key={side}>
            <label className="text-[10px] text-gray-500 capitalize">{side}</label>
            <input
              type="number"
              value={ptsToUnit(options.cropBox[side], options.unit)}
              onChange={(e) => setOptions({
                ...options,
                cropBox: { ...options.cropBox, [side]: unitToPts(Number(e.target.value), options.unit) },
              })}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
              step={options.unit === 'inches' ? 0.1 : 1}
            />
          </div>
        ))}
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {recentFiles.map((file) => (
          <button
            key={file.id}
            onClick={() => toggleFile(file.id)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
              selectedIds.has(file.id) ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-100 hover:border-gray-200'
            )}
          >
            <div className={cn(
              'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
              selectedIds.has(file.id) ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
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
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Batch Complete</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-emerald-600">{results.summary.success}</p>
                <p className="text-[10px] text-gray-500">Cropped</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-500">{results.summary.errors}</p>
                <p className="text-[10px] text-gray-500">Failed</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => setResults(null)}>
              Crop More
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={selectedIds.size === 0 || isProcessing}
          onClick={handleBatchCrop}
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing {selectedIds.size} Files...</>
          ) : (
            <><CropIcon className="w-4 h-4 mr-2" />Crop {selectedIds.size} File{selectedIds.size !== 1 ? 's' : ''}</>
          )}
        </Button>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CropPdf() {
  const { recentFiles, setCurrentView } = useAppStore()
  const { toast } = useToast()
  const { history: toolHistory, addHistory, deleteItem, clearHistory, isLoaded } = useToolHistory('crop', 'Crop PDF')

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [options, setOptions] = useState<CropOptionsState>(DEFAULT_OPTIONS)
  const [result, setResult] = useState<CropResultData | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'settings' | 'presets' | 'ai'>('settings')

  // Undo/Redo history
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(entry)
      return newHistory
    })
    setHistoryIndex((prev) => prev + 1)
  }, [historyIndex])

  const undo = useCallback(() => {
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    const entry = history[newIndex]
    setOptions((prev) => ({
      ...prev,
      cropBox: entry.cropBox,
      mode: entry.mode,
      rotation: entry.rotation,
    }))
    setHistoryIndex(newIndex)
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    const entry = history[newIndex]
    setOptions((prev) => ({
      ...prev,
      cropBox: entry.cropBox,
      mode: entry.mode,
      rotation: entry.rotation,
    }))
    setHistoryIndex(newIndex)
  }, [history, historyIndex])

  // Initialize history
  useEffect(() => {
    if (history.length === 0) {
      setHistory([{
        cropBox: DEFAULT_OPTIONS.cropBox,
        mode: DEFAULT_OPTIONS.mode,
        rotation: DEFAULT_OPTIONS.rotation,
        description: 'Initial state',
      }])
      setHistoryIndex(0)
    }
  }, [])

  // Fetch preview when file or options change
  useEffect(() => {
    if (!selectedFile) return

    let cancelled = false
    const fetchPreview = async () => {
      setIsLoadingPreview(true)
      try {
        const apiOptions = buildApiOptions(options)
        const response = await fetch(
          `/api/files/${selectedFile.id}/crop?options=${encodeURIComponent(JSON.stringify(apiOptions))}`
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
  }, [selectedFile?.id, options.mode, options.cropBox, options.rotation, options.pageRange, options.presetId, options.marginSensitivity, options.whitespaceThreshold])

  const handleApplyCrop = useCallback(async () => {
    if (!selectedFile) return
    setIsApplying(true)
    setResult(null)

    try {
      const apiOptions = buildApiOptions(options)
      const response = await fetch(`/api/files/${selectedFile.id}/crop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: apiOptions }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Crop failed' }))
        throw new Error(errorData.error || 'Crop failed')
      }

      const data = await response.json()
      setResult(data as CropResultData)
      await useAppStore.getState().fetchFiles()

      toast({
        title: 'Crop Applied',
        description: `Cropped ${data.crop.pagesCropped} page(s) in ${(data.crop.durationMs / 1000).toFixed(1)}s`,
      })

      addHistory(
        `Cropped ${selectedFile.name} — ${data.crop.pagesCropped} page(s)`,
        {
          fileName: selectedFile.name,
          cropLeft: ptsToUnit(options.cropBox.left, options.unit),
          cropBottom: ptsToUnit(options.cropBox.bottom, options.unit),
          cropRight: ptsToUnit(options.cropBox.right, options.unit),
          cropTop: ptsToUnit(options.cropBox.top, options.unit),
          unit: options.unit,
          pagesCropped: data.crop.pagesCropped,
          totalPages: data.crop.totalPages,
          fileSize: selectedFile.size,
          mode: options.mode,
          rotation: options.rotation,
        }
      )
    } catch (error: any) {
      toast({
        title: 'Crop Failed',
        description: error.message || 'Failed to apply crop',
        variant: 'destructive',
      })
    } finally {
      setIsApplying(false)
    }
  }, [selectedFile, options, toast, addHistory])

  const handleDownload = useCallback(() => {
    if (!result) return
    fetch(`/api/files/${result.file.id}/download?download=1`)
      .then((r) => { if (!r.ok) throw new Error('Download failed'); return r.blob() })
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
      .catch(() => toast({ title: 'Download Failed', variant: 'destructive' }))
    toast({ title: 'Download Started', description: `Downloading ${result.file.name}` })
  }, [result, toast])

  const handleCropBoxChange = useCallback((newBox: CropBox) => {
    setOptions((prev) => ({ ...prev, cropBox: newBox }))
  }, [])

  const handleCropBoxInputChange = useCallback((side: keyof CropBox, value: number, unit: CropUnit) => {
    const pts = unitToPts(value, unit)
    const newBox = { ...options.cropBox, [side]: pts }
    setOptions((prev) => ({ ...prev, cropBox: newBox }))
    pushHistory({ cropBox: newBox, mode: options.mode, rotation: options.rotation, description: `Changed ${side} to ${value} ${unit}` })
  }, [options.cropBox, options.mode, options.rotation, pushHistory])

  const handleApplyAISuggestion = useCallback((crop: CropBox) => {
    setOptions((prev) => ({ ...prev, cropBox: { ...crop } }))
    pushHistory({ cropBox: { ...crop }, mode: options.mode, rotation: options.rotation, description: 'Applied AI suggestion' })
    toast({ title: 'AI Suggestion Applied', description: 'Crop box updated' })
  }, [options.mode, options.rotation, pushHistory, toast])

  // Page dimensions for visual editor
  const pageWidth = preview?.preview?.originalSize?.width || 612
  const pageHeight = preview?.preview?.originalSize?.height || 792

  if (isBatchMode) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CropIcon className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-semibold text-gray-800">Batch Crop PDFs</h1>
              <p className="text-xs text-gray-400">Apply crop to multiple files at once</p>
            </div>
          </div>
          <button onClick={() => setCurrentView('home')} className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-4 md:p-6 pb-4 md:pb-0 md:overflow-auto">
          <BatchCropView onBack={() => setIsBatchMode(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
            <CropIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold text-gray-800">Crop PDF Pages</h1>
            <p className="text-xs text-gray-400">Crop, trim, and resize your PDF pages</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <Button variant="outline" size="sm" className="text-xs px-2" onClick={undo} disabled={historyIndex <= 0} title="Undo">
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs px-2" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo">
            <Redo2 className="w-3.5 h-3.5" />
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsBatchMode(true)}>
            <Layers className="w-3.5 h-3.5 mr-1" />
            Batch
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
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to crop</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => { setSelectedFile(file); setResult(null) }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-emerald-600 truncate">{file.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.size)} · {file.pages} page{file.pages !== 1 ? 's' : ''}</div>
                        <div className="text-[11px] text-gray-300 mt-0.5">{formatDate(file.updatedAt)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                  <CropIcon className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to crop pages</p>
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
                      <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{selectedFile.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {formatFileSize(selectedFile.size)} · {selectedFile.pages} page{selectedFile.pages !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs text-gray-500" onClick={() => { setSelectedFile(null); setResult(null); setPreview(null) }}>
                      Change
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Crop Mode Selector */}
              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-2">Crop Mode</h4>
                <div className="grid grid-cols-5 gap-2">
                  {CROP_MODE_CARDS.map((cm) => (
                    <button
                      key={cm.id}
                      onClick={() => {
                        setOptions({ ...options, mode: cm.id })
                        pushHistory({ cropBox: options.cropBox, mode: cm.id, rotation: options.rotation, description: `Switched to ${cm.label} mode` })
                      }}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                        options.mode === cm.id
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                          : 'border-gray-100 hover:border-gray-200'
                      )}
                    >
                      <cm.icon className={cn('w-5 h-5', options.mode === cm.id ? 'text-emerald-600' : 'text-gray-400')} />
                      <span className={cn('text-[11px] font-medium', options.mode === cm.id ? 'text-emerald-700' : 'text-gray-500')}>
                        {cm.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Crop Editor + Live Preview */}
              {selectedFile && !result && (
                <Card className="border-emerald-500/20 bg-emerald-50/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-sm font-medium text-emerald-700">Visual Crop Editor</h4>
                      <Badge variant="outline" className="text-[9px] ml-auto">Drag handles to adjust</Badge>
                    </div>
                    <div className="flex gap-4">
                      <VisualCropEditor
                        cropBox={options.cropBox}
                        pageWidth={pageWidth}
                        pageHeight={pageHeight}
                        onChange={(newBox) => {
                          handleCropBoxChange(newBox)
                        }}
                        unit={options.unit}
                      />
                      <div className="flex-1 space-y-2">
                        {preview && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">Original</span>
                              <span className="text-xs font-medium text-gray-800">
                                {ptsToUnit(preview.preview.originalSize.width, 'inches')} × {ptsToUnit(preview.preview.originalSize.height, 'inches')} in
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">After Crop</span>
                              <span className="text-xs font-medium text-emerald-600">
                                {ptsToUnit(preview.preview.croppedSize.width, 'inches')} × {ptsToUnit(preview.preview.croppedSize.height, 'inches')} in
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">Area Removed</span>
                              <span className="text-xs font-medium text-amber-600">{preview.preview.areaRemoved}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">Affected Pages</span>
                              <span className="text-xs font-medium text-gray-800">{preview.preview.affectedPages} of {preview.preview.totalPages}</span>
                            </div>
                            <Separator />
                            {preview.preview.marginDetection && options.mode === 'auto-margin' && (
                              <div className="p-2 bg-white rounded border border-gray-100">
                                <p className="text-[10px] font-medium text-gray-600 mb-1">Detected Margins</p>
                                <p className="text-[9px] text-gray-500">
                                  L: {ptsToUnit(preview.preview.marginDetection.left, 'inches')}" · R: {ptsToUnit(preview.preview.marginDetection.right, 'inches')}" · T: {ptsToUnit(preview.preview.marginDetection.top, 'inches')}" · B: {ptsToUnit(preview.preview.marginDetection.bottom, 'inches')}"
                                </p>
                                <p className="text-[9px] text-gray-400">Confidence: {Math.round(preview.preview.marginDetection.confidence * 100)}%</p>
                              </div>
                            )}
                            {preview.preview.whitespaceAnalysis && options.mode === 'whitespace' && (
                              <div className="p-2 bg-white rounded border border-gray-100">
                                <p className="text-[10px] font-medium text-gray-600 mb-1">Whitespace Analysis</p>
                                <p className="text-[9px] text-gray-500 capitalize">Amount: {preview.preview.whitespaceAnalysis.whitespaceAmount}</p>
                                <p className="text-[9px] text-gray-500">Removable area: {preview.preview.whitespaceAnalysis.removedArea}%</p>
                              </div>
                            )}
                            {preview.preview.aiSuggestion && options.mode === 'ai-suggest' && (
                              <div className="p-2 bg-white rounded border border-gray-100">
                                <p className="text-[10px] font-medium text-gray-600 mb-1">AI Suggestion</p>
                                <p className="text-[9px] text-gray-500">{preview.preview.aiSuggestion.reasoning}</p>
                                <p className="text-[9px] text-gray-400">Confidence: {Math.round(preview.preview.aiSuggestion.confidence * 100)}%</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {preview.preview.aiSuggestion.detectedElements.map((el) => (
                                    <Badge key={el} variant="outline" className="text-[8px]">{el}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {preview.preview.warnings.length > 0 && (
                              <div className="space-y-1">
                                {preview.preview.warnings.map((w, i) => (
                                  <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-600">
                                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span>{w}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        {isLoadingPreview && (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                            <span className="text-xs text-gray-500">Analyzing...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Alternative Crops */}
              {preview?.preview?.aiSuggestion && options.mode === 'ai-suggest' && !result && (
                <Card className="border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <h4 className="text-xs font-medium text-gray-600">AI Crop Alternatives</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ crop: preview.preview.aiSuggestion.suggestedCrop, label: 'Recommended', description: 'AI primary suggestion' },
                        ...preview.preview.aiSuggestion.alternativeCrops
                      ].map((alt, i) => (
                        <button
                          key={i}
                          onClick={() => handleApplyAISuggestion(alt.crop)}
                          className="p-3 rounded-lg border border-gray-100 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all text-left"
                        >
                          <p className="text-[11px] font-medium text-gray-700">{alt.label}</p>
                          <p className="text-[9px] text-gray-400">{alt.description}</p>
                          <p className="text-[9px] text-gray-500 mt-1">
                            L:{ptsToUnit(alt.crop.left, 'inches')}" R:{ptsToUnit(alt.crop.right, 'inches')}" T:{ptsToUnit(alt.crop.top, 'inches')}" B:{ptsToUnit(alt.crop.bottom, 'inches')}"
                          </p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Crop Result */}
              {result && (
                <div className="space-y-4">
                  <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">Crop Applied Successfully</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {result.crop.pagesCropped} page(s) cropped · Size changed by {formatFileSize(result.crop.sizeIncrease)}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                          <Clock className="w-3 h-3 mr-1" />{(result.crop.durationMs / 1000).toFixed(1)}s
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {result.crop.operations.length > 0 && (
                    <Card className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Layers className="w-4 h-4 text-gray-500" />
                          <h4 className="text-xs font-medium text-gray-600">Crop Operations</h4>
                        </div>
                        <div className="space-y-2">
                          {result.crop.operations.map((op, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <ChevronRight className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                              <p className="text-xs text-gray-700">{op.description}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex items-center gap-3">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Cropped PDF
                    </Button>
                    <Button variant="outline" className="text-xs" onClick={() => { setSelectedFile(null); setResult(null); setPreview(null) }}>
                      Crop Another File
                    </Button>
                  </div>
                </div>
              )}

              {isApplying && !result && (
                <Card className="border-gray-200">
                  <CardContent className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                    <p className="text-sm font-medium text-gray-700">Applying Crop...</p>
                    <p className="text-xs text-gray-400 mt-1">Processing {selectedFile.name}</p>
                    <div className="w-48 mt-4"><Progress value={50} className="h-1.5" /></div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        {selectedFile && (
          <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col shrink-0 md:overflow-y-hidden">
            {/* Tab Selector */}
            <div className="flex border-b border-gray-100">
              {[
                { id: 'settings' as const, label: 'Crop', icon: Sliders },
                { id: 'presets' as const, label: 'Presets', icon: LayoutGrid },
                { id: 'ai' as const, label: 'AI', icon: Wand2 },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] font-medium border-b-2 transition-all',
                    activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'
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
                  {/* Crop Box Inputs */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-600">Crop Margins</label>
                      <select
                        value={options.unit}
                        onChange={(e) => setOptions({ ...options, unit: e.target.value as CropUnit })}
                        className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u.id} value={u.id}>{u.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['left', 'bottom', 'right', 'top'] as const).map((side) => (
                        <div key={side}>
                          <label className="text-[10px] text-gray-400 capitalize">{side}</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={ptsToUnit(options.cropBox[side], options.unit)}
                              onChange={(e) => handleCropBoxInputChange(side, Number(e.target.value), options.unit)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                              step={options.unit === 'inches' ? 0.1 : options.unit === 'mm' ? 1 : 5}
                              min={0}
                            />
                            <span className="text-[9px] text-gray-400">{options.unit === 'percent' ? '%' : options.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rotation */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-2 block">Rotation</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([0, 90, 180, 270] as RotationAngle[]).map((angle) => (
                        <button
                          key={angle}
                          onClick={() => {
                            setOptions({ ...options, rotation: angle })
                            pushHistory({ cropBox: options.cropBox, mode: options.mode, rotation: angle, description: `Rotated ${angle}°` })
                          }}
                          className={cn(
                            'flex flex-col items-center gap-1 px-2 py-2 rounded-md border transition-all',
                            options.rotation === angle
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-gray-100 text-gray-500 hover:border-gray-200'
                          )}
                        >
                          <RotateCw className={cn('w-3.5 h-3.5', angle === 0 && 'opacity-30')} style={{ transform: `rotate(${angle}deg)` }} />
                          <span className="text-[10px] font-medium">{angle}°</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

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
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
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
                        className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                        placeholder="e.g., 1,3,5-8"
                      />
                    )}
                  </div>

                  {/* Anchor Point */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-2 block">Anchor Point</label>
                    <div className="grid grid-cols-5 gap-1">
                      {([
                        { id: 'top-left', label: '↖' },
                        { id: 'top-right', label: '↗' },
                        { id: 'center', label: '⊙' },
                        { id: 'bottom-left', label: '↙' },
                        { id: 'bottom-right', label: '↘' },
                      ] as const).map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setOptions({ ...options, anchor: a.id })}
                          className={cn(
                            'px-2 py-2 rounded-md border transition-all text-sm',
                            options.anchor === a.id
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-gray-100 text-gray-400 hover:border-gray-200'
                          )}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auto Margin Sensitivity */}
                  {(options.mode === 'auto-margin') && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-gray-600">Margin Sensitivity</label>
                        <span className="text-xs font-medium text-gray-800">{Math.round(options.marginSensitivity * 100)}%</span>
                      </div>
                      <Slider
                        value={[options.marginSensitivity * 100]}
                        onValueChange={([v]) => setOptions({ ...options, marginSensitivity: v / 100 })}
                        min={10}
                        max={100}
                        step={5}
                      />
                    </div>
                  )}

                  {/* Whitespace Threshold */}
                  {options.mode === 'whitespace' && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-gray-600">Whitespace Threshold</label>
                        <span className="text-xs font-medium text-gray-800">{Math.round(options.whitespaceThreshold * 100)}%</span>
                      </div>
                      <Slider
                        value={[options.whitespaceThreshold * 100]}
                        onValueChange={([v]) => setOptions({ ...options, whitespaceThreshold: v / 100 })}
                        min={50}
                        max={100}
                        step={5}
                      />
                    </div>
                  )}

                  {/* Maintain Aspect Ratio */}
                  <button
                    onClick={() => setOptions({ ...options, maintainAspectRatio: !options.maintainAspectRatio })}
                    className={cn(
                      'w-full flex items-center gap-2 p-3 rounded-lg border-2 transition-all',
                      options.maintainAspectRatio
                        ? 'border-emerald-500 bg-emerald-50/50'
                        : 'border-gray-100 hover:border-gray-200'
                    )}
                  >
                    <Ruler className={cn('w-4 h-4', options.maintainAspectRatio ? 'text-emerald-600' : 'text-gray-400')} />
                    <div className="text-left">
                      <p className={cn('text-[11px] font-medium', options.maintainAspectRatio ? 'text-emerald-700' : 'text-gray-600')}>
                        Maintain Aspect Ratio
                      </p>
                      <p className="text-[9px] text-gray-400">Keep page proportions when cropping</p>
                    </div>
                    <div className={cn(
                      'ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      options.maintainAspectRatio ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                    )}>
                      {options.maintainAspectRatio && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  </button>

                  {/* Apply Button */}
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={isApplying}
                    onClick={handleApplyCrop}
                  >
                    {isApplying ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Applying...</>
                    ) : (
                      <><CropIcon className="w-4 h-4 mr-2" />Apply Crop</>
                    )}
                  </Button>
                </div>
              )}

              {/* ─── Presets Tab ──────────────────────────────────────────── */}
              {activeTab === 'presets' && (
                <div className="space-y-3">
                  <p className="text-[10px] text-gray-400">Click a preset to apply it instantly</p>
                  {['Paper', 'Photo', 'Ratio', 'Margin'].map((cat) => {
                    const presets = CROP_PRESETS_UI.filter((p) => p.category === cat)
                    return (
                      <div key={cat}>
                        <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{cat}</h4>
                        <div className="space-y-1">
                          {presets.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => {
                                setOptions({ ...options, mode: 'preset', presetId: preset.id })
                                pushHistory({ cropBox: options.cropBox, mode: 'preset' as CropMode, rotation: options.rotation, description: `Applied ${preset.name} preset` })
                              }}
                              className={cn(
                                'w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left',
                                options.presetId === preset.id && options.mode === 'preset'
                                  ? 'border-emerald-500 bg-emerald-50/50'
                                  : 'border-gray-100 hover:border-gray-200'
                              )}
                            >
                              <div className="w-8 h-8 bg-gray-50 rounded flex items-center justify-center shrink-0">
                                <CropIcon className="w-3.5 h-3.5 text-gray-400" />
                              </div>
                              <div>
                                <p className="text-[11px] font-medium text-gray-700">{preset.name}</p>
                                <p className="text-[9px] text-gray-400">{preset.description}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ─── AI Tab ────────────────────────────────────────────── */}
              {activeTab === 'ai' && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-700">AI-Assisted Crop</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      AI analyzes your PDF content and suggests optimal crop boxes. It detects text blocks, images, headers, footers, and whitespace to recommend the best crop for readability.
                    </p>
                  </div>

                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      setOptions({ ...options, mode: 'ai-suggest' })
                      pushHistory({ cropBox: options.cropBox, mode: 'ai-suggest', rotation: options.rotation, description: 'Enabled AI suggestions' })
                    }}
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    {options.mode === 'ai-suggest' ? 'AI Mode Active' : 'Enable AI Suggestions'}
                  </Button>

                  {preview?.preview?.aiSuggestion && options.mode === 'ai-suggest' && (
                    <Card className="border-emerald-200">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-medium text-gray-600 mb-2">AI Analysis</p>
                        <p className="text-[10px] text-gray-500 mb-2">{preview.preview.aiSuggestion.reasoning}</p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {preview.preview.aiSuggestion.detectedElements.map((el) => (
                            <Badge key={el} variant="outline" className="text-[8px]">{el}</Badge>
                          ))}
                        </div>
                        <p className="text-[9px] text-gray-400">Confidence: {Math.round(preview.preview.aiSuggestion.confidence * 100)}%</p>
                        <Separator className="my-2" />
                        <p className="text-[10px] font-medium text-gray-600 mb-1.5">Alternatives</p>
                        <div className="space-y-1">
                          {preview.preview.aiSuggestion.alternativeCrops.map((alt, i) => (
                            <button
                              key={i}
                              onClick={() => handleApplyAISuggestion(alt.crop)}
                              className="w-full p-2 rounded border border-gray-100 hover:border-emerald-400 transition-all text-left"
                            >
                              <p className="text-[10px] font-medium text-gray-700">{alt.label}</p>
                              <p className="text-[8px] text-gray-400">{alt.description}</p>
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* History Panel */}
              <Separator />
              <ToolHistoryPanel
                history={toolHistory}
                onDelete={deleteItem}
                onClearAll={clearHistory}
                toolLabel="Crop PDF"
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
