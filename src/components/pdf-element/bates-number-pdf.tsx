'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore, formatFileSize, type PdfFile } from '@/store/app-store'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Hash, FileText, Download, Loader2, Eye, Calendar, Type,
  Layers, Settings2, Zap, CheckCircle2, AlertCircle, Trash2,
  Plus, ChevronDown, ChevronUp, Copy, Sparkles, RotateCcw,
  Undo2, Shield, BookOpen, Scale, Landmark, FileSearch,
  AlertTriangle, Clock, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToolHistory } from '@/hooks/use-tool-history'
import { ToolHistoryPanel } from '@/components/pdf-element/tool-history-panel'
import {
  BUILTIN_BATES_TEMPLATES,
  BATES_DYNAMIC_VARS,
  getDefaultBatesOptions,
  type BatesOptions,
  type BatesFont,
  type BatesPosition,
  type BatesNumberFormat,
  type BatesPageScope,
  type BatesSequenceMode,
  type BatesBorderStyle,
  type BatesPreview,
  type BatesConflict,
  type BatesAuditEntry,
  type BatesTemplate,
  type BatesPreset,
} from '@/lib/pdf-bates-number-types'

// ─── Color presets ───────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { name: 'Black', value: { r: 0, g: 0, b: 0 } },
  { name: 'Dark Gray', value: { r: 0.3, g: 0.3, b: 0.3 } },
  { name: 'Gray', value: { r: 0.5, g: 0.5, b: 0.5 } },
  { name: 'Light Gray', value: { r: 0.7, g: 0.7, b: 0.7 } },
  { name: 'Blue', value: { r: 0.15, g: 0.4, b: 0.75 } },
  { name: 'Red', value: { r: 0.7, g: 0.1, b: 0.1 } },
  { name: 'Green', value: { r: 0.1, g: 0.5, b: 0.2 } },
]

const FONT_OPTIONS: { value: BatesFont; label: string; style: string }[] = [
  { value: 'Helvetica', label: 'Helvetica', style: 'font-sans' },
  { value: 'HelveticaBold', label: 'Helvetica Bold', style: 'font-sans font-bold' },
  { value: 'HelveticaOblique', label: 'Helvetica Italic', style: 'font-sans italic' },
  { value: 'HelveticaBoldOblique', label: 'Helvetica Bold Italic', style: 'font-sans font-bold italic' },
  { value: 'TimesRoman', label: 'Times Roman', style: 'font-serif' },
  { value: 'TimesRomanBold', label: 'Times Bold', style: 'font-serif font-bold' },
  { value: 'TimesRomanItalic', label: 'Times Italic', style: 'font-serif italic' },
  { value: 'TimesRomanBoldItalic', label: 'Times Bold Italic', style: 'font-serif font-bold italic' },
  { value: 'Courier', label: 'Courier', style: 'font-mono' },
  { value: 'CourierBold', label: 'Courier Bold', style: 'font-mono font-bold' },
  { value: 'CourierOblique', label: 'Courier Italic', style: 'font-mono italic' },
  { value: 'CourierBoldOblique', label: 'Courier Bold Italic', style: 'font-mono font-bold italic' },
]

const DATE_FORMAT_OPTIONS = [
  { value: 'none', label: 'None'},
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'YYYY', label: 'YYYY' },
  { value: 'YYYYMMDD', label: 'YYYYMMDD' },
]

const CATEGORY_COLORS: Record<string, string> = {
  standard: 'bg-blue-50 text-blue-600 border-blue-200',
  federal: 'bg-purple-50 text-purple-600 border-purple-200',
  state: 'bg-green-50 text-green-600 border-green-200',
  discovery: 'bg-orange-50 text-orange-600 border-orange-200',
  exhibit: 'bg-pink-50 text-pink-600 border-pink-200',
  custom: 'bg-gray-50 text-gray-600 border-gray-200',
}

const POSITION_LABELS: Record<BatesPosition, string> = {
  'top-left': 'Top Left',
  'top-center': 'Top Center',
  'top-right': 'Top Right',
  'bottom-left': 'Bottom Left',
  'bottom-center': 'Bottom Center',
  'bottom-right': 'Bottom Right',
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  standard: <Hash className="w-3.5 h-3.5" />,
  federal: <Landmark className="w-3.5 h-3.5" />,
  state: <Scale className="w-3.5 h-3.5" />,
  discovery: <FileSearch className="w-3.5 h-3.5" />,
  exhibit: <BookOpen className="w-3.5 h-3.5" />,
  custom: <Settings2 className="w-3.5 h-3.5" />,
}

// ─── Helper: Generate preview text ──────────────────────────────────────────

function generateBatesPreviewText(options: BatesOptions, pageNum: number = 1): string {
  const digits = options.numberFormat.length
  const padded = String(options.startNumber + pageNum - 1).padStart(digits, '0')
  let text = ''
  if (options.dateFormat && options.dateFormat !== 'none') {
    const now = new Date()
    const y = now.getFullYear().toString()
    const m = (now.getMonth() + 1).toString().padStart(2, '0')
    const d = now.getDate().toString().padStart(2, '0')
    let dateStr = options.dateFormat
      .replace('YYYY', y)
      .replace('MM', m)
      .replace('DD', d)
    text += dateStr
    if (options.dateSeparator && options.dateSeparator !== 'none') text += options.dateSeparator
  }
  if (options.prefix) {
    text += options.prefix + '-'
  }
  text += padded
  if (options.suffix) {
    text += '-' + options.suffix
  }
  return text
}

// ─── Placement Diagram Sub-Component ────────────────────────────────────────

function PlacementDiagram({
  position,
  marginX,
  marginY,
  onPositionChange,
  onMarginXChange,
  onMarginYChange,
  previewText,
}: {
  position: BatesPosition
  marginX: number
  marginY: number
  onPositionChange: (pos: BatesPosition) => void
  onMarginXChange: (val: number) => void
  onMarginYChange: (val: number) => void
  previewText: string
}) {
  const positions: BatesPosition[] = [
    'top-left', 'top-center', 'top-right',
    'bottom-left', 'bottom-center', 'bottom-right',
  ]

  const posCoords: Record<BatesPosition, { top?: string; bottom?: string; left?: string; right?: string; x: string; y: string }> = {
    'top-left': { top: '12%', left: '8%', x: 'left', y: 'top' },
    'top-center': { top: '12%', left: '50%', x: 'center', y: 'top' },
    'top-right': { top: '12%', right: '8%', x: 'right', y: 'top' },
    'bottom-left': { bottom: '12%', left: '8%', x: 'left', y: 'bottom' },
    'bottom-center': { bottom: '12%', left: '50%', x: 'center', y: 'bottom' },
    'bottom-right': { bottom: '12%', right: '8%', x: 'right', y: 'bottom' },
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        {/* Page diagram */}
        <div className="relative w-48 bg-white border-2 border-gray-300 rounded shadow-sm" style={{ aspectRatio: '8.5/11' }}>
          {/* Page content lines */}
          <div className="absolute inset-4 flex flex-col gap-1.5 opacity-20">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-px bg-gray-400 rounded" style={{ width: `${70 + Math.random() * 30}%` }} />
            ))}
          </div>

          {/* Position dots */}
          {positions.map((pos) => {
            const coords = posCoords[pos]
            const isActive = position === pos
            const style: React.CSSProperties = {
              position: 'absolute',
              ...(coords.top !== undefined ? { top: coords.top } : {}),
              ...(coords.bottom !== undefined ? { bottom: coords.bottom } : {}),
              ...(coords.left !== undefined ? { left: coords.left } : {}),
              ...(coords.right !== undefined ? { right: coords.right } : {}),
              transform: coords.left === '50%' ? 'translateX(-50%)' : undefined,
            }

            return (
              <button
                key={pos}
                onClick={() => onPositionChange(pos)}
                style={style}
                className={cn(
                  'z-10 transition-all duration-150',
                  isActive
                    ? 'px-2 py-1 rounded-md bg-[#4A90D9] text-white text-[9px] font-bold shadow-md ring-2 ring-[#4A90D9]/30'
                    : 'w-3 h-3 rounded-full bg-gray-300 hover:bg-[#4A90D9] hover:scale-125 border-2 border-white shadow-sm'
                )}
                title={POSITION_LABELS[pos]}
              >
                {isActive ? previewText : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* Margin sliders */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[10px] text-gray-500 uppercase tracking-wider">Margin X</Label>
            <span className="text-[10px] text-gray-400">{marginX}pt</span>
          </div>
          <Slider
            value={[marginX]}
            onValueChange={([v]) => onMarginXChange(v)}
            min={-50}
            max={50}
            step={1}
            className="w-full"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[10px] text-gray-500 uppercase tracking-wider">Margin Y</Label>
            <span className="text-[10px] text-gray-400">{marginY}pt</span>
          </div>
          <Slider
            value={[marginY]}
            onValueChange={([v]) => onMarginYChange(v)}
            min={-50}
            max={50}
            step={1}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Preview Panel Sub-Component ────────────────────────────────────────────

function PreviewPanel({
  preview,
  isLoading,
  conflicts,
}: {
  preview: BatesPreview | null
  isLoading: boolean
  conflicts: BatesConflict[]
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#4A90D9]" />
        <span className="ml-2 text-xs text-gray-400">Analyzing...</span>
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="text-center py-8">
        <Eye className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Select a file to preview</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-blue-600">{preview.totalPages}</div>
          <div className="text-[10px] text-blue-500">Total Pages</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-emerald-600">{preview.pagesToProcess}</div>
          <div className="text-[10px] text-emerald-500">Pages to Stamp</div>
        </div>
      </div>

      {/* Bates range preview */}
      <div className="bg-gray-50 rounded-lg p-2">
        <div className="text-[10px] font-medium text-gray-500 mb-1">Bates Range</div>
        <div className="text-xs text-gray-700 font-mono truncate">{preview.batesRange}</div>
      </div>

      {/* First / Last page preview */}
      <div className="bg-gray-50 rounded-lg p-2">
        <div className="text-[10px] font-medium text-gray-500 mb-1">First Page</div>
        <div className="text-xs text-gray-700 font-mono truncate">{preview.firstPagePreview}</div>
      </div>
      <div className="bg-gray-50 rounded-lg p-2">
        <div className="text-[10px] font-medium text-gray-500 mb-1">Last Page</div>
        <div className="text-xs text-gray-700 font-mono truncate">{preview.lastPagePreview}</div>
      </div>

      {/* Feature badges */}
      <div className="flex flex-wrap gap-1">
        {preview.hasCustomPrefix && (
          <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-600 border-purple-200">
            Custom Prefix
          </Badge>
        )}
        {preview.hasDatePrefix && (
          <Badge variant="secondary" className="text-[10px] bg-cyan-50 text-cyan-600 border-cyan-200">
            Date Prefix
          </Badge>
        )}
        {preview.sequenceMode === 'continue-across-docs' && (
          <Badge variant="secondary" className="text-[10px] bg-orange-50 text-orange-600 border-orange-200">
            Continuous
          </Badge>
        )}
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 rounded-lg p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            <span className="text-[10px] font-medium text-red-600">{conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {conflicts.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[8px] px-1 py-0 h-4',
                    c.confidence === 'high' && 'bg-red-100 text-red-600 border-red-300',
                    c.confidence === 'medium' && 'bg-yellow-100 text-yellow-600 border-yellow-300',
                    c.confidence === 'low' && 'bg-gray-100 text-gray-500 border-gray-300',
                  )}
                >
                  {c.confidence}
                </Badge>
                <span className="text-gray-500">pg {c.pageIndex + 1}:</span>
                <span className="text-gray-700 truncate">{c.existingText}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Size estimate */}
      <div className="text-[10px] text-gray-400">
        Est. size increase: +{formatFileSize(preview.estimatedSizeIncrease)}
      </div>
    </div>
  )
}

// ─── Batch Mode Sub-Component ───────────────────────────────────────────────

function BatchBatesNumber({
  files,
  options,
  onApply,
  isApplying,
}: {
  files: PdfFile[]
  options: BatesOptions
  onApply: (fileIds: string[]) => void
  isApplying: boolean
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleFile = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const selectAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)))
    }
  }

  // Compute global bates range preview using reduce to avoid mutation
  const sortedFiles = files.filter((f) => selectedIds.has(f.id))
  const rangePreview = sortedFiles.reduce<{ lines: string[]; nextStart: number }>(
    (acc, f) => {
      const start = acc.nextStart
      const end = start + f.pages - 1
      const digits = options.numberFormat.length
      const prefix = options.prefix ? options.prefix + '-' : ''
      const line = `${prefix}${String(start).padStart(digits, '0')} → ${prefix}${String(end).padStart(digits, '0')}`
      return { lines: [...acc.lines, line], nextStart: end + 1 }
    },
    { lines: [], nextStart: options.startNumber }
  ).lines

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Select Files</Label>
          <Badge variant="secondary" className="text-xs">
            {selectedIds.size} selected
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={selectAll} className="text-xs h-7">
          {selectedIds.size === files.length ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
        {files.map((file) => (
          <button
            key={file.id}
            onClick={() => toggleFile(file.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
              selectedIds.has(file.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
            )}
          >
            <div className={cn(
              'w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
              selectedIds.has(file.id) ? 'bg-[#4A90D9] border-[#4A90D9]' : 'border-gray-300'
            )}>
              {selectedIds.has(file.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{file.originalName}</div>
              <div className="text-[10px] text-gray-400">{file.pages} pages · {formatFileSize(file.size)}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Global bates range preview */}
      {options.sequenceMode === 'continue-across-docs' && rangePreview.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowRight className="w-3 h-3 text-amber-600" />
            <span className="text-[10px] font-medium text-amber-700">Global Numbering Sequence</span>
          </div>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {sortedFiles.map((f, i) => (
              <div key={f.id} className="flex items-center justify-between text-[10px]">
                <span className="text-gray-600 truncate max-w-28">{f.originalName}</span>
                <span className="font-mono text-amber-700">{rangePreview[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        onClick={() => onApply([...selectedIds])}
        disabled={selectedIds.size === 0 || isApplying}
        className="w-full bg-[#4A90D9] hover:bg-[#3A7BC8] text-white"
      >
        {isApplying ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing {selectedIds.size} files...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 mr-2" />
            Apply Bates Number to {selectedIds.size} Files
          </>
        )}
      </Button>
    </div>
  )
}

// ─── Audit Tab Sub-Component ────────────────────────────────────────────────

function AuditTab({ entries }: { entries: BatesAuditEntry[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpand = (ts: string) => {
    const next = new Set(expanded)
    if (next.has(ts)) next.delete(ts)
    else next.add(ts)
    setExpanded(next)
  }

  const actionBadgeClass: Record<string, string> = {
    apply: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    undo: 'bg-orange-50 text-orange-600 border-orange-200',
    preview: 'bg-blue-50 text-blue-600 border-blue-200',
    conflict_detected: 'bg-red-50 text-red-600 border-red-200',
  }

  const actionIcon: Record<string, React.ReactNode> = {
    apply: <CheckCircle2 className="w-3 h-3" />,
    undo: <Undo2 className="w-3 h-3" />,
    preview: <Eye className="w-3 h-3" />,
    conflict_detected: <AlertTriangle className="w-3 h-3" />,
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-400">No audit entries yet</p>
        <p className="text-xs text-gray-300 mt-1">Entries will appear when you apply or undo Bates numbering</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-700">Audit Log</div>
        <Badge variant="secondary" className="text-[10px]">{entries.length} entries</Badge>
      </div>
      <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
        {entries.map((entry, i) => (
          <div key={entry.timestamp + i} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleExpand(entry.timestamp + i)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 transition-colors"
            >
              <div className={cn('p-1 rounded', actionBadgeClass[entry.action]?.split(' ')[0])}>
                {actionIcon[entry.action]}
              </div>
              <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 h-4', actionBadgeClass[entry.action])}>
                {entry.action.replace('_', ' ')}
              </Badge>
              <span className="text-[10px] text-gray-500 flex-1 text-left truncate">{entry.details}</span>
              <span className="text-[9px] text-gray-300">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              {expanded.has(entry.timestamp + i) ? <ChevronUp className="w-3 h-3 text-gray-300" /> : <ChevronDown className="w-3 h-3 text-gray-300" />}
            </button>
            {expanded.has(entry.timestamp + i) && (
              <div className="px-3 py-2 bg-gray-50 border-t text-[10px] space-y-1">
                {entry.fileName && (
                  <div><span className="text-gray-400">File:</span> <span className="text-gray-600">{entry.fileName}</span></div>
                )}
                {entry.batesRange && (
                  <div><span className="text-gray-400">Range:</span> <span className="text-gray-600 font-mono">{entry.batesRange}</span></div>
                )}
                {entry.pagesProcessed !== undefined && (
                  <div><span className="text-gray-400">Pages:</span> <span className="text-gray-600">{entry.pagesProcessed}</span></div>
                )}
                <div><span className="text-gray-400">Time:</span> <span className="text-gray-600">{new Date(entry.timestamp).toLocaleString()}</span></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function BatesNumberPdf() {
  const { recentFiles, fetchFiles } = useAppStore()
  const { toast } = useToast()

  // State
  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [options, setOptions] = useState<BatesOptions>(getDefaultBatesOptions())
  const [preview, setPreview] = useState<BatesPreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('template')
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [batchResult, setBatchResult] = useState<any>(null)
  const [savedPresets, setSavedPresets] = useState<BatesPreset[]>([])
  const [showUndoConfirm, setShowUndoConfirm] = useState(false)
  const [auditEntries, setAuditEntries] = useState<BatesAuditEntry[]>([])
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { history, addHistory, deleteItem, clearHistory, isLoaded } = useToolHistory('bates-number', 'Bates Numbering')

  // Load presets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bates-presets')
      if (stored) setSavedPresets(JSON.parse(stored))
    } catch {}
  }, [])

  // Save presets to localStorage
  const persistPresets = (presets: BatesPreset[]) => {
    setSavedPresets(presets)
    try { localStorage.setItem('bates-presets', JSON.stringify(presets)) } catch {}
  }

  // Fetch preview when options or file changes
  const fetchPreview = useCallback(async () => {
    if (!selectedFile) {
      setPreview(null)
      return
    }
    setIsLoadingPreview(true)
    try {
      const optionsJson = JSON.stringify(options)
      const response = await fetch(
        `/api/files/${selectedFile.id}/bates-number?options=${encodeURIComponent(optionsJson)}`
      )
      if (response.ok) {
        const data = await response.json()
        setPreview(data.preview)
        if (data.preview?.conflicts) {
          // Conflict detected — add audit entry
          if (data.preview.conflicts.length > 0 && options.enableAuditLog) {
            setAuditEntries((prev) => [
              {
                timestamp: new Date().toISOString(),
                action: 'conflict_detected',
                fileId: selectedFile.id,
                fileName: selectedFile.originalName,
                details: `${data.preview.conflicts.length} conflict(s) detected`,
                pagesProcessed: data.preview.pagesToProcess,
              },
              ...prev,
            ])
          }
        }
      }
    } catch (error) {
      console.error('Preview error:', error)
    } finally {
      setIsLoadingPreview(false)
    }
  }, [selectedFile, options])

  useEffect(() => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = setTimeout(fetchPreview, 500)
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    }
  }, [fetchPreview])

  // Apply Bates number
  const handleApplyBates = async () => {
    if (!selectedFile) return
    setIsApplying(true)
    setResult(null)

    try {
      const globalStartNumber = options.startNumber
      const response = await fetch(`/api/files/${selectedFile.id}/bates-number`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options, globalStartNumber }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Apply failed' }))
        throw new Error(errorData.error || 'Failed to apply Bates numbering')
      }

      const data = await response.json()
      setResult(data)
      await fetchFiles()

      if (options.enableAuditLog) {
        setAuditEntries((prev) => [
          {
            timestamp: new Date().toISOString(),
            action: 'apply',
            fileId: selectedFile.id,
            fileName: selectedFile.originalName,
            details: `Applied ${data.batesNumber?.batesRange || 'Bates numbers'}`,
            batesRange: data.batesNumber?.batesRange,
            pagesProcessed: data.batesNumber?.pagesProcessed,
          },
          ...prev,
        ])
      }

      toast({
        title: 'Bates Numbering Applied',
        description: `${data.batesNumber?.pagesProcessed} pages stamped in ${data.batesNumber?.durationMs}ms`,
      })
      addHistory(
        `Bates numbered ${selectedFile.originalName} — ${data.batesNumber?.batesRange}`,
        { fileName: selectedFile.originalName, fileSize: selectedFile.size, startNumber: options.startNumber, prefix: options.prefix, pagesProcessed: data.batesNumber?.pagesProcessed, batesRange: data.batesNumber?.batesRange },
        'success'
      )
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to apply Bates numbering',
        variant: 'destructive',
      })
    } finally {
      setIsApplying(false)
    }
  }

  // Batch apply
  const handleBatchApply = async (fileIds: string[]) => {
    setIsApplying(true)
    setBatchResult(null)

    try {
      const response = await fetch('/api/files/bates-number-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds, options }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Batch failed' }))
        throw new Error(errorData.error || 'Batch operation failed')
      }

      const data = await response.json()
      setBatchResult(data)
      await fetchFiles()

      if (options.enableAuditLog && data.auditEntries) {
        setAuditEntries((prev) => [...data.auditEntries, ...prev])
      }

      toast({
        title: 'Batch Complete',
        description: `${data.summary.success} of ${data.summary.total} files processed successfully`,
      })
    } catch (error: any) {
      toast({
        title: 'Batch Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsApplying(false)
    }
  }

  // Undo
  const handleUndo = async () => {
    if (!selectedFile) return
    setIsApplying(true)

    try {
      const response = await fetch(`/api/files/${selectedFile.id}/bates-number`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'undo',
          batesInfo: { prefix: options.prefix, numberFormat: options.numberFormat, position: options.position },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Undo failed' }))
        throw new Error(errorData.error || 'Failed to undo Bates numbering')
      }

      const data = await response.json()
      setResult(null)
      await fetchFiles()
      await fetchPreview()

      if (options.enableAuditLog) {
        setAuditEntries((prev) => [
          {
            timestamp: new Date().toISOString(),
            action: 'undo',
            fileId: selectedFile.id,
            fileName: selectedFile.originalName,
            details: `Undone Bates numbering`,
            batesRange: data.batesNumber?.batesRange,
            pagesProcessed: data.batesNumber?.pagesProcessed,
          },
          ...prev,
        ])
      }

      toast({ title: 'Undo Successful', description: 'Bates numbering has been removed' })
    } catch (error: any) {
      toast({
        title: 'Undo Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsApplying(false)
      setShowUndoConfirm(false)
    }
  }

  // Load template
  const loadTemplate = (templateId: string) => {
    const template = BUILTIN_BATES_TEMPLATES.find((t) => t.id === templateId)
    if (template) {
      setOptions({ ...getDefaultBatesOptions(), ...template.options })
      setActiveTab('format')
      toast({ title: 'Template Loaded', description: template.name })
    }
  }

  // Save preset
  const savePreset = (name: string) => {
    const preset: BatesPreset = {
      id: `preset-${Date.now()}`,
      name,
      options: { ...options },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    persistPresets([...savedPresets, preset])
    toast({ title: 'Preset Saved', description: name })
  }

  // Load preset
  const loadPreset = (presetId: string) => {
    const preset = savedPresets.find((p) => p.id === presetId)
    if (preset) {
      setOptions({ ...preset.options })
      toast({ title: 'Preset Loaded', description: preset.name })
    }
  }

  // Delete preset
  const deletePreset = (presetId: string) => {
    persistPresets(savedPresets.filter((p) => p.id !== presetId))
  }

  // Reset
  const resetOptions = () => {
    setOptions(getDefaultBatesOptions())
    setResult(null)
  }

  // Update helper
  const updateOption = <K extends keyof BatesOptions>(key: K, value: BatesOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }))
  }

  const pdfFiles = recentFiles.filter((f) => f.mimeType === 'application/pdf')

  // Preview text for placement diagram
  const previewText = generateBatesPreviewText(options)

  return (
    <div className="h-full flex flex-col">
      {/* Undo confirmation dialog */}
      {showUndoConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <Card className="w-80 shadow-xl">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Undo2 className="w-4 h-4 text-orange-500" />
                Confirm Undo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <p className="text-xs text-gray-500">
                This will remove the Bates numbering from the current file. The original document will be restored. Are you sure?
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowUndoConfirm(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="text-xs h-8 bg-orange-500 hover:bg-orange-600 text-white" onClick={handleUndo}>
                  <Undo2 className="w-3 h-3 mr-1" />
                  Undo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#4A90D9]/10 rounded-lg flex items-center justify-center">
            <Hash className="w-5 h-5 text-[#4A90D9]" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold text-gray-800">Bates Numbering</h1>
            <p className="text-xs text-gray-400">Add professional Bates numbers to your PDFs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUndoConfirm(true)}
              disabled={isApplying}
              className="text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              <Undo2 className="w-3 h-3 mr-1" />
              Undo
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBatchMode(!isBatchMode)}
            className={cn('text-xs', isBatchMode && 'bg-[#4A90D9]/10 border-[#4A90D9]/30 text-[#4A90D9]')}
          >
            <Layers className="w-3 h-3 mr-1" />
            {isBatchMode ? 'Single Mode' : 'Batch Mode'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetOptions}
            className="text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-y-hidden">
        {/* Left Panel */}
        <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-100 bg-white flex flex-col md:overflow-y-hidden">
          {!isBatchMode ? (
            <>
              {/* File Selector */}
              <div className="p-4 border-b border-gray-100">
                <Label className="text-xs font-medium text-gray-500 mb-2 block">Select PDF</Label>
                <Select
                  value={selectedFile?.id || ''}
                  onValueChange={(id) => {
                    const file = pdfFiles.find((f) => f.id === id)
                    setSelectedFile(file || null)
                    setResult(null)
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Choose a file..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pdfFiles.map((file) => (
                      <SelectItem key={file.id} value={file.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="w-3 h-3 text-gray-400" />
                          <span className="truncate max-w-40">{file.originalName}</span>
                          <span className="text-gray-400 text-[10px]">{file.pages}p</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-1.5 mb-3">
                  <Eye className="w-3.5 h-3.5 text-[#4A90D9]" />
                  <span className="text-xs font-medium text-gray-700">Live Preview</span>
                </div>
                <PreviewPanel
                  preview={preview}
                  isLoading={isLoadingPreview}
                  conflicts={preview?.conflicts || []}
                />
              </div>

              {/* Result */}
              {result && (
                <div className="p-4 flex-1">
                  <div className="flex items-center gap-1.5 mb-3">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-medium text-gray-700">Result</span>
                  </div>
                  <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardContent className="p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Pages:</span>
                          <span className="ml-1 font-medium">{result.batesNumber?.pagesProcessed}/{result.batesNumber?.totalPages}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Time:</span>
                          <span className="ml-1 font-medium">{result.batesNumber?.durationMs}ms</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Size:</span>
                          <span className="ml-1 font-medium">+{formatFileSize(result.batesNumber?.sizeIncrease || 0)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Range:</span>
                          <span className="ml-1 font-medium font-mono text-[10px]">{result.batesNumber?.batesRange}</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="w-full bg-[#4A90D9] hover:bg-[#3A7BC8] text-white h-8 text-xs"
                        onClick={() => window.open(`/api/files/${result.file?.id}/download?download=1`, '_blank')}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Operations */}
                  {result.batesNumber?.operations?.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] font-medium text-gray-500">Operations:</div>
                      {result.batesNumber.operations.map((op: any, i: number) => (
                        <div key={i} className="text-[10px] text-gray-400">· {op.description}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Batch mode */
            <div className="p-4 flex-1 md:overflow-y-auto">
              <BatchBatesNumber
                files={pdfFiles}
                options={options}
                onApply={handleBatchApply}
                isApplying={isApplying}
              />

              {batchResult && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-medium">Batch Result</span>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 space-y-1">
                    <div className="text-xs">
                      <span className="text-emerald-600 font-medium">{batchResult.summary.success}</span>
                      <span className="text-gray-500">/{batchResult.summary.total} successful</span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Total pages: {batchResult.summary.totalPagesProcessed} · Size: +{formatFileSize(batchResult.summary.totalSizeIncrease)}
                    </div>
                    {batchResult.summary.globalBatesRange && (
                      <div className="text-[10px] text-gray-400">
                        Range: <span className="font-mono">{batchResult.summary.globalBatesRange}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <Separator />
          <ToolHistoryPanel history={history} onDelete={deleteItem} onClearAll={clearHistory} toolLabel="Bates Numbering" isLoaded={isLoaded} compact />
        </div>

        {/* Right Panel - Configuration */}
        <div className="flex-1 md:overflow-y-auto bg-gray-50/50">
          <div className={cn("max-w-3xl mx-auto p-4 md:p-6 pb-4 md:pb-0", !selectedFile && "opacity-50 pointer-events-none select-none")}>
            {!selectedFile && (
              <div className="flex flex-col items-center py-4 text-center mb-4">
                <Hash className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-medium text-gray-500">Select a file first</p>
                <p className="text-[10px] text-gray-400 mt-1">Settings will activate once a PDF is chosen</p>
              </div>
            )}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="template" className="text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="format" className="text-xs">
                  <Type className="w-3 h-3 mr-1" />
                  Format
                </TabsTrigger>
                <TabsTrigger value="placement" className="text-xs">
                  <Settings2 className="w-3 h-3 mr-1" />
                  Placement
                </TabsTrigger>
                <TabsTrigger value="variables" className="text-xs">
                  <Hash className="w-3 h-3 mr-1" />
                  Variables
                </TabsTrigger>
                <TabsTrigger value="audit" className="text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  Audit
                </TabsTrigger>
              </TabsList>

              {/* ─── Templates Tab ─────────────────────────────────────────── */}
              <TabsContent value="template" className="space-y-3">
                <div className="text-sm font-medium text-gray-700 mb-3">Choose a Legal Template</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BUILTIN_BATES_TEMPLATES.map((template) => (
                    <Card
                      key={template.id}
                      className="cursor-pointer hover:border-[#4A90D9]/50 hover:shadow-md transition-all"
                      onClick={() => loadTemplate(template.id)}
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn('p-1.5 rounded', CATEGORY_COLORS[template.category]?.split(' ')[0])}>
                            {CATEGORY_ICONS[template.category]}
                          </div>
                          <CardTitle className="text-xs font-medium">{template.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-[11px] text-gray-400 mb-2">{template.description}</p>
                        <Badge
                          variant="outline"
                          className={cn('text-[9px]', CATEGORY_COLORS[template.category])}
                        >
                          {template.category}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Saved presets */}
                {savedPresets.length > 0 && (
                  <div className="mt-6">
                    <div className="text-sm font-medium text-gray-700 mb-3">Saved Presets</div>
                    <div className="space-y-2">
                      {savedPresets.map((preset) => (
                        <div key={preset.id} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-100">
                          <button
                            onClick={() => loadPreset(preset.id)}
                            className="text-xs font-medium text-gray-700 hover:text-[#4A90D9] transition-colors"
                          >
                            {preset.name}
                          </button>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-gray-300">{new Date(preset.updatedAt).toLocaleDateString()}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                              onClick={() => deletePreset(preset.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ─── Format Tab ────────────────────────────────────────────── */}
              <TabsContent value="format" className="space-y-5">
                {/* Feature 1: Custom Prefix */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <Type className="w-3.5 h-3.5 text-[#4A90D9]" />
                      Custom Prefix
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={options.prefix.length > 0}
                        onCheckedChange={(checked) => updateOption('prefix', checked ? 'BATES' : '')}
                      />
                      <Label className="text-xs text-gray-600">Enable prefix</Label>
                    </div>
                    {options.prefix.length > 0 && (
                      <>
                        <Input
                          value={options.prefix}
                          onChange={(e) => updateOption('prefix', e.target.value)}
                          placeholder="e.g. BATES, EXH, PROD"
                          className="h-8 text-xs"
                        />
                        <div className="bg-gray-50 rounded-lg p-2">
                          <span className="text-[10px] text-gray-400">Preview: </span>
                          <span className="text-xs font-mono text-[#4A90D9]">{previewText}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Feature 2: Date Prefix */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#4A90D9]" />
                      Date Prefix
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div>
                      <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Date Format</Label>
                      <Select
                        value={options.dateFormat}
                        onValueChange={(val) => updateOption('dateFormat', val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATE_FORMAT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {options.dateFormat && options.dateFormat !== 'none' && (
                      <>
                        <div>
                          <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Date Separator</Label>
                          <Select
                            value={options.dateSeparator}
                            onValueChange={(val) => updateOption('dateSeparator', val)}
                          >
                            <SelectTrigger className="h-8 text-xs w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="-">Dash (-)</SelectItem>
                              <SelectItem value="_">Underscore (_)</SelectItem>
                              <SelectItem value="/">Slash (/)</SelectItem>
                              <SelectItem value=".">Dot (.)</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <span className="text-[10px] text-gray-400">Preview: </span>
                          <span className="text-xs font-mono text-[#4A90D9]">{previewText}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Core Numbering */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-[#4A90D9]" />
                      Number Format
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Start Number</Label>
                        <Input
                          type="number"
                          value={options.startNumber}
                          onChange={(e) => updateOption('startNumber', Math.max(1, Number(e.target.value)))}
                          className="h-8 text-xs"
                          min={1}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Number Format</Label>
                        <Select
                          value={options.numberFormat}
                          onValueChange={(val) => updateOption('numberFormat', val as BatesNumberFormat)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1, 2, 3 ...</SelectItem>
                            <SelectItem value="01">01, 02, 03 ...</SelectItem>
                            <SelectItem value="001">001, 002, 003 ...</SelectItem>
                            <SelectItem value="0001">0001, 0002, 0003 ...</SelectItem>
                            <SelectItem value="00001">00001, 00002, 00003 ...</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Suffix (optional)</Label>
                      <Input
                        value={options.suffix}
                        onChange={(e) => updateOption('suffix', e.target.value)}
                        placeholder="e.g. A, CONF"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-[10px] text-gray-400">Preview: </span>
                      <span className="text-xs font-mono text-[#4A90D9]">{previewText}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Feature 3: Multi-Document Sequences */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-[#4A90D9]" />
                      Multi-Document Sequence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <RadioGroup
                      value={options.sequenceMode}
                      onValueChange={(val) => updateOption('sequenceMode', val as BatesSequenceMode)}
                      className="space-y-2"
                    >
                      <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <RadioGroupItem value="continue-across-docs" id="seq-continue" className="mt-0.5" />
                        <div>
                          <Label htmlFor="seq-continue" className="text-xs font-medium cursor-pointer">Continue across documents</Label>
                          <p className="text-[10px] text-gray-400">Numbering continues from where the previous document left off</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <RadioGroupItem value="restart-per-doc" id="seq-restart" className="mt-0.5" />
                        <div>
                          <Label htmlFor="seq-restart" className="text-xs font-medium cursor-pointer">Restart per document</Label>
                          <p className="text-[10px] text-gray-400">Each document starts numbering from the start number</p>
                        </div>
                      </div>
                    </RadioGroup>

                    {isBatchMode && options.sequenceMode === 'continue-across-docs' && (
                      <div className="bg-amber-50 rounded-lg p-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ArrowRight className="w-3 h-3 text-amber-600" />
                          <span className="text-[10px] font-medium text-amber-700">Continuous numbering across batch</span>
                        </div>
                        <p className="text-[10px] text-amber-600">Numbers will flow seamlessly across all selected documents</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Page Scope */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-[#4A90D9]" />
                      Page Scope
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <Select
                      value={options.pageScope}
                      onValueChange={(val) => updateOption('pageScope', val as BatesPageScope)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Pages</SelectItem>
                        <SelectItem value="first-only">First Page Only</SelectItem>
                        <SelectItem value="not-first">After First Page</SelectItem>
                        <SelectItem value="odd">Odd Pages</SelectItem>
                        <SelectItem value="even">Even Pages</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>

                    {options.pageScope === 'custom' && (
                      <div>
                        <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Page Range</Label>
                        <Input
                          value={options.customPageRange}
                          onChange={(e) => updateOption('customPageRange', e.target.value)}
                          placeholder="e.g. 1-5, 8, 10-15"
                          className="h-8 text-xs"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Feature 5: Rich Text Formatting */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <Type className="w-3.5 h-3.5 text-[#4A90D9]" />
                      Text Formatting
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Font Family</Label>
                        <Select
                          value={options.fontFamily}
                          onValueChange={(val) => updateOption('fontFamily', val as BatesFont)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FONT_OPTIONS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                <span className={f.style}>{f.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Font Size</Label>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[options.fontSize]}
                            onValueChange={([v]) => updateOption('fontSize', v)}
                            min={6}
                            max={24}
                            step={1}
                            className="flex-1"
                          />
                          <span className="text-xs text-gray-500 w-8 text-right">{options.fontSize}pt</span>
                        </div>
                      </div>
                    </div>

                    {/* Color presets */}
                    <div>
                      <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">Color</Label>
                      <div className="flex gap-1.5">
                        {COLOR_PRESETS.map((c) => (
                          <button
                            key={c.name}
                            onClick={() => updateOption('fontColor', c.value)}
                            className={cn(
                              'w-7 h-7 rounded-full border-2 transition-all',
                              options.fontColor && Math.abs(options.fontColor.r - c.value.r) < 0.01
                                ? 'border-[#4A90D9] scale-110 shadow-md'
                                : 'border-transparent hover:border-gray-300'
                            )}
                            style={{ backgroundColor: `rgb(${c.value.r * 255}, ${c.value.g * 255}, ${c.value.b * 255})` }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Opacity */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-[10px] text-gray-500 uppercase tracking-wider">Opacity</Label>
                        <span className="text-xs text-gray-400">{Math.round(options.opacity * 100)}%</span>
                      </div>
                      <Slider
                        value={[options.opacity]}
                        onValueChange={([v]) => updateOption('opacity', v)}
                        min={0.1}
                        max={1.0}
                        step={0.05}
                      />
                    </div>

                    {/* Live preview of formatted text */}
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="text-[10px] text-gray-400 mb-1">Formatted Preview</div>
                      <div
                        className="text-sm"
                        style={{
                          fontFamily: options.fontFamily.startsWith('Courier') ? 'monospace' : options.fontFamily.startsWith('Times') ? 'serif' : 'sans-serif',
                          fontWeight: options.fontFamily.includes('Bold') ? 'bold' : 'normal',
                          fontStyle: options.fontFamily.includes('Oblique') || options.fontFamily.includes('Italic') ? 'italic' : 'normal',
                          fontSize: `${options.fontSize}pt`,
                          color: `rgb(${options.fontColor.r * 255}, ${options.fontColor.g * 255}, ${options.fontColor.b * 255})`,
                          opacity: options.opacity,
                        }}
                      >
                        {previewText}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Preset Save */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <Copy className="w-3.5 h-3.5 text-[#4A90D9]" />
                      Save as Preset
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex gap-2">
                      <Input
                        id="preset-name-input"
                        placeholder="Preset name..."
                        className="flex-1 h-8 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.trim()
                            if (val) savePreset(val)
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => {
                          const input = document.getElementById('preset-name-input') as HTMLInputElement
                          if (input?.value.trim()) savePreset(input.value.trim())
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Save
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Apply button (single mode) */}
                {!isBatchMode && (
                  <div className="pt-2">
                    <Button
                      onClick={handleApplyBates}
                      disabled={!selectedFile || isApplying}
                      className="w-full bg-[#4A90D9] hover:bg-[#3A7BC8] text-white h-10"
                    >
                      {isApplying ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Apply Bates Numbering
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* ─── Placement Tab ─────────────────────────────────────────── */}
              <TabsContent value="placement" className="space-y-5">
                {/* Feature 10: Visual Placement Controls */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <Settings2 className="w-3.5 h-3.5 text-[#4A90D9]" />
                      Visual Placement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <PlacementDiagram
                      position={options.position}
                      marginX={options.marginX}
                      marginY={options.marginY}
                      onPositionChange={(pos) => updateOption('position', pos)}
                      onMarginXChange={(val) => updateOption('marginX', val)}
                      onMarginYChange={(val) => updateOption('marginY', val)}
                      previewText={previewText}
                    />
                  </CardContent>
                </Card>

                {/* Border style */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-[#4A90D9]" />
                      Border Style
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div>
                      <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Style</Label>
                      <Select
                        value={options.borderStyle}
                        onValueChange={(val) => updateOption('borderStyle', val as BatesBorderStyle)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="solid">Solid</SelectItem>
                          <SelectItem value="dashed">Dashed</SelectItem>
                          <SelectItem value="underline">Underline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {options.borderStyle !== 'none' && (
                      <div>
                        <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">Border Color</Label>
                        <div className="flex gap-1.5">
                          {COLOR_PRESETS.map((c) => (
                            <button
                              key={c.name}
                              onClick={() => updateOption('borderColor', c.value)}
                              className={cn(
                                'w-6 h-6 rounded-full border-2 transition-all',
                                options.borderColor && Math.abs(options.borderColor.r - c.value.r) < 0.01
                                  ? 'border-[#4A90D9] scale-110'
                                  : 'border-transparent hover:border-gray-300'
                              )}
                              style={{ backgroundColor: `rgb(${c.value.r * 255}, ${c.value.g * 255}, ${c.value.b * 255})` }}
                              title={c.name}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Border preview */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-[10px] text-gray-400 mb-1">Border Preview</div>
                      <div className="inline-block">
                        <span
                          className="text-sm font-mono px-2 py-1"
                          style={{
                            border: options.borderStyle === 'none' ? 'none' :
                              options.borderStyle === 'underline' ? `2px solid rgb(${options.borderColor.r * 255}, ${options.borderColor.g * 255}, ${options.borderColor.b * 255})` :
                              options.borderStyle === 'dashed' ? `1px dashed rgb(${options.borderColor.r * 255}, ${options.borderColor.g * 255}, ${options.borderColor.b * 255})` :
                              `1px solid rgb(${options.borderColor.r * 255}, ${options.borderColor.g * 255}, ${options.borderColor.b * 255})`,
                            borderBottom: options.borderStyle === 'underline' ? `2px solid rgb(${options.borderColor.r * 255}, ${options.borderColor.g * 255}, ${options.borderColor.b * 255})` : undefined,
                          }}
                        >
                          {previewText}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Margins */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <Settings2 className="w-3.5 h-3.5 text-[#4A90D9]" />
                      Page Margins
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                        <div key={side}>
                          <div className="flex items-center justify-between mb-1">
                            <Label className="text-[10px] text-gray-500 uppercase tracking-wider">{side}</Label>
                            <span className="text-[10px] text-gray-400">{options.margins[side]}pt</span>
                          </div>
                          <Slider
                            value={[options.margins[side]]}
                            onValueChange={([v]) =>
                              setOptions((prev) => ({
                                ...prev,
                                margins: { ...prev.margins, [side]: v },
                              }))
                            }
                            min={0}
                            max={100}
                            step={5}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Options */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-[#4A90D9]" />
                      Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs text-gray-600">Enable Audit Log</Label>
                        <p className="text-[10px] text-gray-400">Track all Bates numbering operations</p>
                      </div>
                      <Switch
                        checked={options.enableAuditLog}
                        onCheckedChange={(checked) => updateOption('enableAuditLog', checked)}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs text-gray-600">Preserve Original</Label>
                        <p className="text-[10px] text-gray-400">Keep a copy of the original file for undo</p>
                      </div>
                      <Switch
                        checked={options.preserveOriginal}
                        onCheckedChange={(checked) => updateOption('preserveOriginal', checked)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Apply button (single mode) */}
                {!isBatchMode && (
                  <div className="pt-2">
                    <Button
                      onClick={handleApplyBates}
                      disabled={!selectedFile || isApplying}
                      className="w-full bg-[#4A90D9] hover:bg-[#3A7BC8] text-white h-10"
                    >
                      {isApplying ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Apply Bates Numbering
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* ─── Variables Tab ─────────────────────────────────────────── */}
              <TabsContent value="variables" className="space-y-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Dynamic Variables Reference</div>
                <p className="text-xs text-gray-400 mb-4">
                  These variables are available for use in prefix and suffix fields. They will be replaced with actual values when Bates numbering is applied.
                </p>

                <div className="space-y-1">
                  {BATES_DYNAMIC_VARS.map((v) => (
                    <div key={v.tag} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-gray-100">
                      <code className="text-xs font-mono text-[#4A90D9] bg-blue-50 px-2 py-0.5 rounded">
                        {v.tag}
                      </code>
                      <span className="text-xs text-gray-500">{v.desc}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3 h-3 text-amber-600" />
                    <span className="text-xs font-medium text-amber-700">Date Format Codes</span>
                  </div>
                  <div className="text-[10px] text-amber-600 space-y-0.5">
                    <div><code>YYYY</code> = 4-digit year, <code>YY</code> = 2-digit year</div>
                    <div><code>MM</code> = month (01-12), <code>DD</code> = day (01-31)</div>
                    <div><code>HH</code> = hours (00-23), <code>mm</code> = minutes (00-59)</div>
                    <div>Example: <code>{'{'}date:MM/DD/YYYY{'}'}</code> → 01/15/2025</div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Hash className="w-3 h-3 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">Number Format Examples</span>
                  </div>
                  <div className="text-[10px] text-blue-600 space-y-0.5">
                    <div>Format <code>1</code> → 1, 2, 3, ...</div>
                    <div>Format <code>01</code> → 01, 02, 03, ...</div>
                    <div>Format <code>001</code> → 001, 002, 003, ...</div>
                    <div>Format <code>0001</code> → 0001, 0002, 0003, ... (standard)</div>
                    <div>Format <code>00001</code> → 00001, 00002, 00003, ...</div>
                  </div>
                </div>
              </TabsContent>

              {/* ─── Audit Tab ─────────────────────────────────────────────── */}
              <TabsContent value="audit">
                <AuditTab entries={auditEntries} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
