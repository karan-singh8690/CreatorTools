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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Heading,
  FileText,
  Download,
  Loader2,
  Eye,
  Calendar,
  Hash,
  Type,
  Image as ImageIcon,
  Layers,
  Settings2,
  Zap,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Copy,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToolHistory } from '@/hooks/use-tool-history'
import { ToolHistoryPanel } from '@/components/pdf-element/tool-history-panel'
import {
  BUILTIN_TEMPLATES,
  getDefaultHeaderFooterOptions,
  type HeaderFooterOptions,
  type HFTextSegment,
  type HFContent,
  type HFPageConfig,
  type HFPageScope,
  type HFFont,
  type HFLogoConfig,
  type HeaderFooterPreview,
} from '@/lib/pdf-header-footer-types'

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

const FONT_OPTIONS: { value: HFFont; label: string; style: string }[] = [
  { value: 'Helvetica', label: 'Helvetica', style: 'font-sans' },
  { value: 'HelveticaBold', label: 'Helvetica Bold', style: 'font-sans font-bold' },
  { value: 'HelveticaOblique', label: 'Helvetica Italic', style: 'font-sans italic' },
  { value: 'TimesRoman', label: 'Times Roman', style: 'font-serif' },
  { value: 'TimesRomanBold', label: 'Times Bold', style: 'font-serif font-bold' },
  { value: 'TimesRomanItalic', label: 'Times Italic', style: 'font-serif italic' },
  { value: 'Courier', label: 'Courier', style: 'font-mono' },
  { value: 'CourierBold', label: 'Courier Bold', style: 'font-mono font-bold' },
]

const SCOPE_OPTIONS: { value: HFPageScope; label: string; desc: string }[] = [
  { value: 'all', label: 'All Pages', desc: 'Apply to every page' },
  { value: 'first-only', label: 'First Page Only', desc: 'Different header/footer for page 1' },
  { value: 'not-first', label: 'After First Page', desc: 'Pages 2 and beyond' },
  { value: 'odd', label: 'Odd Pages', desc: 'Pages 1, 3, 5, ...' },
  { value: 'even', label: 'Even Pages', desc: 'Pages 2, 4, 6, ...' },
]

const DYNAMIC_VARS = [
  { tag: '{page}', desc: 'Current page number' },
  { tag: '{total_pages}', desc: 'Total page count' },
  { tag: '{page:0001}', desc: 'Zero-padded page (4 digits)' },
  { tag: '{page_of_total}', desc: 'Page X of Y' },
  { tag: '{filename}', desc: 'PDF filename' },
  { tag: '{date}', desc: 'Current date (YYYY-MM-DD)' },
  { tag: '{time}', desc: 'Current time (HH:MM)' },
  { tag: '{datetime}', desc: 'Date and time' },
  { tag: '{date:MM/DD/YYYY}', desc: 'Custom date format' },
  { tag: '{title}', desc: 'Document title' },
  { tag: '{author}', desc: 'Document author' },
  { tag: '{subject}', desc: 'Document subject' },
]

// ─── Sub-Components ──────────────────────────────────────────────────────────

function SegmentEditor({
  segments,
  onChange,
}: {
  segments: HFTextSegment[]
  onChange: (segments: HFTextSegment[]) => void
}) {
  const addSegment = () => {
    onChange([...segments, { text: '', font: 'Helvetica', fontSize: 9, color: { r: 0.3, g: 0.3, b: 0.3 } }])
  }

  const updateSegment = (index: number, updates: Partial<HFTextSegment>) => {
    const newSegments = [...segments]
    newSegments[index] = { ...newSegments[index], ...updates }
    onChange(newSegments)
  }

  const removeSegment = (index: number) => {
    onChange(segments.filter((_, i) => i !== index))
  }

  const insertVariable = (index: number, variable: string) => {
    const seg = segments[index]
    updateSegment(index, { text: seg.text + variable })
  }

  return (
    <div className="space-y-2">
      {segments.map((seg, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex gap-2">
            <Input
              value={seg.text}
              onChange={(e) => updateSegment(i, { text: e.target.value })}
              placeholder="Text or {variable}..."
              className="flex-1 text-xs h-8"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
              onClick={() => removeSegment(i)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>

          <div className="flex gap-2 items-center">
            <Select
              value={seg.font || 'Helvetica'}
              onValueChange={(val) => updateSegment(i, { font: val as HFFont })}
            >
              <SelectTrigger className="w-32 h-7 text-xs">
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

            <Input
              type="number"
              value={seg.fontSize || 9}
              onChange={(e) => updateSegment(i, { fontSize: Number(e.target.value) })}
              className="w-14 h-7 text-xs text-center"
              min={6}
              max={24}
            />

            <div className="flex gap-1">
              {COLOR_PRESETS.slice(0, 5).map((c) => (
                <button
                  key={c.name}
                  onClick={() => updateSegment(i, { color: c.value })}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 transition-all',
                    seg.color && Math.abs(seg.color.r - c.value.r) < 0.01
                      ? 'border-[#4A90D9] scale-110'
                      : 'border-transparent hover:border-gray-300'
                  )}
                  style={{ backgroundColor: `rgb(${c.value.r * 255}, ${c.value.g * 255}, ${c.value.b * 255})` }}
                  title={c.name}
                />
              ))}
            </div>

            <Button
              variant={seg.bold ? 'default' : 'outline'}
              size="sm"
              className="h-7 w-7 p-0 text-xs font-bold"
              onClick={() => updateSegment(i, { bold: !seg.bold })}
            >
              B
            </Button>
            <Button
              variant={seg.italic ? 'default' : 'outline'}
              size="sm"
              className="h-7 w-7 p-0 text-xs italic"
              onClick={() => updateSegment(i, { italic: !seg.italic })}
            >
              I
            </Button>
          </div>

          {/* Quick variable insertion */}
          <div className="flex flex-wrap gap-1">
            {DYNAMIC_VARS.slice(0, 6).map((v) => (
              <button
                key={v.tag}
                onClick={() => insertVariable(i, v.tag)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                title={v.desc}
              >
                {v.tag}
              </button>
            ))}
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={addSegment}
        className="w-full h-7 text-xs"
      >
        <Plus className="w-3 h-3 mr-1" />
        Add Text Segment
      </Button>
    </div>
  )
}

function ContentEditor({
  content,
  onChange,
  label,
}: {
  content: HFContent
  onChange: (content: HFContent) => void
  label: string
}) {
  const [expanded, setExpanded] = useState(true)

  const updateZone = (zone: 'left' | 'center' | 'right', segments: HFTextSegment[]) => {
    onChange({ ...content, [zone]: segments })
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-xs font-medium text-gray-700">{label}</span>
        {expanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
      </button>

      {expanded && (
        <div className="p-3 space-y-3">
          {/* Left zone */}
          <div>
            <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
              ← Left
            </Label>
            <SegmentEditor
              segments={content.left || []}
              onChange={(segs) => updateZone('left', segs)}
            />
          </div>

          {/* Center zone */}
          <div>
            <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
              Center
            </Label>
            <SegmentEditor
              segments={content.center || []}
              onChange={(segs) => updateZone('center', segs)}
            />
          </div>

          {/* Right zone */}
          <div>
            <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
              Right →
            </Label>
            <SegmentEditor
              segments={content.right || []}
              onChange={(segs) => updateZone('right', segs)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function PageConfigEditor({
  config,
  onChange,
  onRemove,
  index,
}: {
  config: HFPageConfig
  onChange: (config: HFPageConfig) => void
  onRemove: () => void
  index: number
}) {
  const [expanded, setExpanded] = useState(index === 0)

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs font-medium text-gray-700"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Config #{index + 1} — {SCOPE_OPTIONS.find((s) => s.value === config.scope)?.label || config.scope}
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
          onClick={onRemove}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          {/* Scope selector */}
          <div>
            <Label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
              Apply to
            </Label>
            <Select
              value={config.scope}
              onValueChange={(val) => onChange({ ...config, scope: val as HFPageScope })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <div>
                      <div className="text-xs font-medium">{s.label}</div>
                      <div className="text-[10px] text-gray-400">{s.desc}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Header content */}
          {config.header && (
            <ContentEditor
              content={config.header}
              onChange={(header) => onChange({ ...config, header })}
              label="Header"
            />
          )}

          {!config.header && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => onChange({ ...config, header: { left: [], center: [], right: [] } })}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Header
            </Button>
          )}

          {/* Footer content */}
          {config.footer && (
            <ContentEditor
              content={config.footer}
              onChange={(footer) => onChange({ ...config, footer })}
              label="Footer"
            />
          )}

          {!config.footer && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => onChange({ ...config, footer: { left: [], center: [], right: [] } })}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Footer
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Preview Panel ───────────────────────────────────────────────────────────

function PreviewPanel({
  preview,
  isLoading,
}: {
  preview: HeaderFooterPreview | null
  isLoading: boolean
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
          <div className="text-lg font-bold text-emerald-600">
            {preview.pagesWithHeaders + preview.pagesWithFooters}
          </div>
          <div className="text-[10px] text-emerald-500">Pages Affected</div>
        </div>
      </div>

      {/* Feature badges */}
      <div className="flex flex-wrap gap-1">
        {preview.hasDifferentFirstPage && (
          <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-600 border-purple-200">
            Different First Page
          </Badge>
        )}
        {preview.hasOddEven && (
          <Badge variant="secondary" className="text-[10px] bg-orange-50 text-orange-600 border-orange-200">
            Odd/Even Pages
          </Badge>
        )}
        {preview.hasLogo && (
          <Badge variant="secondary" className="text-[10px] bg-cyan-50 text-cyan-600 border-cyan-200">
            Logo
          </Badge>
        )}
      </div>

      {/* Preview text */}
      {preview.firstPageHeaderPreview && (
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] font-medium text-gray-500 mb-1">Page 1 Header</div>
          <div className="text-xs text-gray-700 font-mono truncate">
            {preview.firstPageHeaderPreview}
          </div>
        </div>
      )}

      {preview.firstPageFooterPreview && (
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] font-medium text-gray-500 mb-1">Page 1 Footer</div>
          <div className="text-xs text-gray-700 font-mono truncate">
            {preview.firstPageFooterPreview}
          </div>
        </div>
      )}

      {/* Dynamic variables detected */}
      {preview.dynamicVariables.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-2">
          <div className="text-[10px] font-medium text-amber-600 mb-1">Dynamic Variables</div>
          <div className="flex flex-wrap gap-1">
            {preview.dynamicVariables.map((v) => (
              <Badge key={v} variant="outline" className="text-[10px] bg-white">
                {v}
              </Badge>
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

// ─── Batch Mode ──────────────────────────────────────────────────────────────

function BatchHeaderFooter({
  files,
  options,
  onApply,
  isApplying,
}: {
  files: PdfFile[]
  options: HeaderFooterOptions
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

      <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
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
            Apply Header & Footer to {selectedIds.size} Files
          </>
        )}
      </Button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function HeaderFooterPdf() {
  const { recentFiles, setCurrentView, fetchFiles } = useAppStore()
  const { toast } = useToast()
  const { history, addHistory, deleteItem, clearHistory, isLoaded } = useToolHistory('header-footer', 'Header & Footer')

  // State
  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [options, setOptions] = useState<HeaderFooterOptions>(getDefaultHeaderFooterOptions())
  const [preview, setPreview] = useState<HeaderFooterPreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('template')
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [batchResult, setBatchResult] = useState<any>(null)

  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
        `/api/files/${selectedFile.id}/header-footer?options=${encodeURIComponent(optionsJson)}`
      )
      if (response.ok) {
        const data = await response.json()
        setPreview(data.preview)
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

  // Apply header/footer
  const applyHeaderFooter = async () => {
    if (!selectedFile) return

    setIsApplying(true)
    setResult(null)

    try {
      const response = await fetch(`/api/files/${selectedFile.id}/header-footer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Apply failed' }))
        throw new Error(errorData.error || 'Failed to apply header/footer')
      }

      const data = await response.json()
      setResult(data)
      await fetchFiles()

      toast({
        title: 'Header & Footer Applied',
        description: `Processed ${data.headerFooter.pagesProcessed} pages in ${data.headerFooter.durationMs}ms`,
      })

      addHistory(
        `Added header/footer to ${selectedFile.originalName}`,
        {
          fileName: selectedFile.originalName,
          fileSize: selectedFile.size,
          pagesProcessed: data.headerFooter.pagesProcessed,
          configCount: options.pageConfigs.length,
          durationMs: data.headerFooter.durationMs,
          sizeIncrease: data.headerFooter.sizeIncrease,
        },
        'success'
      )
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to apply header/footer',
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
      const response = await fetch('/api/files/header-footer-batch', {
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

  // Load template
  const loadTemplate = (templateId: string) => {
    const template = BUILTIN_TEMPLATES.find((t) => t.id === templateId)
    if (template) {
      const templateOptions = {
        pageConfigs: template.pageConfigs,
        margins: template.margins,
        separatorLine: template.separatorLine,
        defaultFont: 'Helvetica' as HFFont,
        defaultFontSize: 9,
        defaultColor: { r: 0.3, g: 0.3, b: 0.3 },
        opacity: 1.0,
        pageRange: 'all' as const,
      }
      setOptions(templateOptions)
      setActiveTab('config')
    }
  }

  // Add a new page config
  const addPageConfig = () => {
    setOptions({
      ...options,
      pageConfigs: [
        ...options.pageConfigs,
        { scope: 'all', header: { left: [], center: [], right: [] }, footer: { left: [], center: [], right: [] } },
      ],
    })
  }

  // Remove a page config
  const removePageConfig = (index: number) => {
    setOptions({
      ...options,
      pageConfigs: options.pageConfigs.filter((_, i) => i !== index),
    })
  }

  // Update a page config
  const updatePageConfig = (index: number, config: HFPageConfig) => {
    const newConfigs = [...options.pageConfigs]
    newConfigs[index] = config
    setOptions({ ...options, pageConfigs: newConfigs })
  }

  // Reset to defaults
  const resetOptions = () => {
    setOptions(getDefaultHeaderFooterOptions())
    setResult(null)
  }

  const pdfFiles = recentFiles.filter((f) => f.mimeType === 'application/pdf')

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#4A90D9]/10 rounded-lg flex items-center justify-center">
            <Heading className="w-5 h-5 text-[#4A90D9]" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold text-gray-800">Header & Footer</h1>
            <p className="text-xs text-gray-400">Add professional headers and footers to your PDFs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
        {/* Left Panel - File Selection & Results */}
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
                <PreviewPanel preview={preview} isLoading={isLoadingPreview} />
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
                          <span className="ml-1 font-medium">{result.headerFooter.pagesProcessed}/{result.headerFooter.totalPages}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Time:</span>
                          <span className="ml-1 font-medium">{result.headerFooter.durationMs}ms</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Size:</span>
                          <span className="ml-1 font-medium">+{formatFileSize(result.headerFooter.sizeIncrease)}</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="w-full bg-[#4A90D9] hover:bg-[#3A7BC8] text-white h-8 text-xs"
                        onClick={() => window.open(`/api/files/${result.file.id}/download?download=1`, '_blank')}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Operations log */}
                  {result.headerFooter.operations?.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] font-medium text-gray-500">Operations:</div>
                      {result.headerFooter.operations.map((op: any, i: number) => (
                        <div key={i} className="text-[10px] text-gray-400">
                          · {op.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Batch mode */
            <div className="p-4 flex-1 md:overflow-y-auto">
              <BatchHeaderFooter
                files={pdfFiles}
                options={options}
                onApply={handleBatchApply}
                isApplying={isApplying}
              />

              {/* Batch result */}
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
                      Total size increase: +{formatFileSize(batchResult.summary.totalSizeIncrease)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Configuration */}
        <div className="flex-1 md:overflow-y-auto bg-gray-50/50">
          <div className={cn("max-w-3xl mx-auto p-4 md:p-6 pb-4 md:pb-0", !selectedFile && "opacity-50 pointer-events-none select-none")}>
            {!selectedFile && (
              <div className="flex flex-col items-center py-4 text-center mb-4">
                <Heading className="w-8 h-8 text-gray-300 mb-2" />
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
                <TabsTrigger value="config" className="text-xs">
                  <Settings2 className="w-3 h-3 mr-1" />
                  Configuration
                </TabsTrigger>
                <TabsTrigger value="variables" className="text-xs">
                  <Hash className="w-3 h-3 mr-1" />
                  Variables
                </TabsTrigger>
                <TabsTrigger value="settings" className="text-xs">
                  <Type className="w-3 h-3 mr-1" />
                  Settings
                </TabsTrigger>
              </TabsList>

              {/* Templates Tab */}
              <TabsContent value="template" className="space-y-3">
                <div className="text-sm font-medium text-gray-700 mb-3">Choose a Template</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BUILTIN_TEMPLATES.map((template) => (
                    <Card
                      key={template.id}
                      className="cursor-pointer hover:border-[#4A90D9]/50 hover:shadow-md transition-all"
                      onClick={() => loadTemplate(template.id)}
                    >
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-medium">{template.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-[11px] text-gray-400 mb-2">{template.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {template.pageConfigs.some((pc) => pc.scope === 'first-only' || pc.scope === 'not-first') && (
                            <Badge variant="secondary" className="text-[9px] bg-purple-50 text-purple-600">
                              First Page Diff
                            </Badge>
                          )}
                          {template.pageConfigs.some((pc) => pc.scope === 'odd' || pc.scope === 'even') && (
                            <Badge variant="secondary" className="text-[9px] bg-orange-50 text-orange-600">
                              Odd/Even
                            </Badge>
                          )}
                          {template.separatorLine?.enabled && (
                            <Badge variant="secondary" className="text-[9px] bg-green-50 text-green-600">
                              Separator
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[9px] bg-blue-50 text-blue-600">
                            {template.pageConfigs.length} config{template.pageConfigs.length > 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Configuration Tab */}
              <TabsContent value="config" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700">Page Configurations</div>
                  <Button variant="outline" size="sm" onClick={addPageConfig} className="text-xs h-7">
                    <Plus className="w-3 h-3 mr-1" />
                    Add Config
                  </Button>
                </div>

                {options.pageConfigs.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Layers className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-xs">No configurations yet. Add one or select a template.</p>
                  </div>
                )}

                {options.pageConfigs.map((config, index) => (
                  <PageConfigEditor
                    key={index}
                    config={config}
                    index={index}
                    onChange={(c) => updatePageConfig(index, c)}
                    onRemove={() => removePageConfig(index)}
                  />
                ))}

                {/* Apply button (single mode) */}
                {!isBatchMode && (
                  <div className="pt-4">
                    <Button
                      onClick={applyHeaderFooter}
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
                          Apply Header & Footer
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Variables Reference Tab */}
              <TabsContent value="variables" className="space-y-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Dynamic Variables Reference</div>
                <p className="text-xs text-gray-400 mb-4">
                  Insert these placeholders in your text segments. They will be replaced with actual values when the header/footer is applied.
                </p>

                <div className="space-y-1">
                  {DYNAMIC_VARS.map((v) => (
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
                    <div>Example: <code>{'{date:DD/MM/YYYY}'}</code> → 15/03/2025</div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Hash className="w-3 h-3 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700">Bates Numbering</span>
                  </div>
                  <div className="text-[10px] text-purple-600 space-y-0.5">
                    <div>Use <code>{'{page:0001}'}</code> for zero-padded page numbers.</div>
                    <div>The number of zeros determines the padding width.</div>
                    <div>Example: <code>{'{page:001}'}</code> on page 5 → &quot;005&quot;</div>
                  </div>
                </div>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-4">
                <div className="text-sm font-medium text-gray-700 mb-2">General Settings</div>

                <Card>
                  <CardContent className="p-4 space-y-4">
                    {/* Margins */}
                    <div>
                      <Label className="text-xs font-medium text-gray-600 mb-2 block">Margins (points)</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[10px] text-gray-400">Header from Top</Label>
                          <Input
                            type="number"
                            value={options.margins?.headerFromTop ?? 30}
                            onChange={(e) => setOptions({
                              ...options,
                              margins: { ...options.margins, headerFromTop: Number(e.target.value) },
                            })}
                            className="h-8 text-xs"
                            min={10}
                            max={100}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-gray-400">Footer from Bottom</Label>
                          <Input
                            type="number"
                            value={options.margins?.footerFromBottom ?? 30}
                            onChange={(e) => setOptions({
                              ...options,
                              margins: { ...options.margins, footerFromBottom: Number(e.target.value) },
                            })}
                            className="h-8 text-xs"
                            min={10}
                            max={100}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-gray-400">Left Margin</Label>
                          <Input
                            type="number"
                            value={options.margins?.left ?? 40}
                            onChange={(e) => setOptions({
                              ...options,
                              margins: { ...options.margins, left: Number(e.target.value) },
                            })}
                            className="h-8 text-xs"
                            min={20}
                            max={100}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-gray-400">Right Margin</Label>
                          <Input
                            type="number"
                            value={options.margins?.right ?? 40}
                            onChange={(e) => setOptions({
                              ...options,
                              margins: { ...options.margins, right: Number(e.target.value) },
                            })}
                            className="h-8 text-xs"
                            min={20}
                            max={100}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Separator Line */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium text-gray-600">Separator Line</Label>
                        <Switch
                          checked={options.separatorLine?.enabled ?? false}
                          onCheckedChange={(checked) => setOptions({
                            ...options,
                            separatorLine: { ...options.separatorLine, enabled: checked },
                          })}
                        />
                      </div>
                      {options.separatorLine?.enabled && (
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <Label className="text-[10px] text-gray-400">Thickness</Label>
                            <Slider
                              value={[options.separatorLine.thickness || 0.5]}
                              onValueChange={([val]) => setOptions({
                                ...options,
                                separatorLine: { ...options.separatorLine, thickness: val },
                              })}
                              min={0.25}
                              max={2}
                              step={0.25}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gray-400">Color</Label>
                            <div className="flex gap-1 mt-1">
                              {COLOR_PRESETS.slice(0, 4).map((c) => (
                                <button
                                  key={c.name}
                                  onClick={() => setOptions({
                                    ...options,
                                    separatorLine: {
                                      ...options.separatorLine!,
                                      color: c.value,
                                    },
                                  })}
                                  className={cn(
                                    'w-5 h-5 rounded-full border-2',
                                    options.separatorLine?.color &&
                                    Math.abs((options.separatorLine.color?.r || 0) - c.value.r) < 0.05
                                      ? 'border-[#4A90D9] scale-110'
                                      : 'border-transparent'
                                  )}
                                  style={{ backgroundColor: `rgb(${c.value.r * 255}, ${c.value.g * 255}, ${c.value.b * 255})` }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Default Font */}
                    <div>
                      <Label className="text-xs font-medium text-gray-600 mb-2 block">Default Font</Label>
                      <Select
                        value={options.defaultFont || 'Helvetica'}
                        onValueChange={(val) => setOptions({ ...options, defaultFont: val as HFFont })}
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

                    {/* Default Font Size */}
                    <div>
                      <Label className="text-xs font-medium text-gray-600 mb-2 block">
                        Default Font Size: {options.defaultFontSize || 9}pt
                      </Label>
                      <Slider
                        value={[options.defaultFontSize || 9]}
                        onValueChange={([val]) => setOptions({ ...options, defaultFontSize: val })}
                        min={6}
                        max={18}
                        step={1}
                      />
                    </div>

                    {/* Opacity */}
                    <div>
                      <Label className="text-xs font-medium text-gray-600 mb-2 block">
                        Opacity: {Math.round((options.opacity ?? 1.0) * 100)}%
                      </Label>
                      <Slider
                        value={[options.opacity ?? 1.0]}
                        onValueChange={([val]) => setOptions({ ...options, opacity: val })}
                        min={0.1}
                        max={1.0}
                        step={0.05}
                      />
                    </div>

                    {/* Page Range */}
                    <div>
                      <Label className="text-xs font-medium text-gray-600 mb-2 block">Page Range</Label>
                      <Select
                        value={options.pageRange || 'all'}
                        onValueChange={(val) => setOptions({
                          ...options,
                          pageRange: val as 'all' | 'first' | 'last' | 'custom',
                        })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Pages</SelectItem>
                          <SelectItem value="first">First Page Only</SelectItem>
                          <SelectItem value="last">Last Page Only</SelectItem>
                          <SelectItem value="custom">Custom Pages</SelectItem>
                        </SelectContent>
                      </Select>
                      {options.pageRange === 'custom' && (
                        <Input
                          value={options.customPages?.join(', ') || ''}
                          onChange={(e) => setOptions({
                            ...options,
                            customPages: e.target.value.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)),
                          })}
                          placeholder="1, 3, 5-8"
                          className="h-8 text-xs mt-2"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Separator />

            {/* History */}
            <ToolHistoryPanel
              history={history}
              onDelete={deleteItem}
              onClearAll={clearHistory}
              toolLabel="Header & Footer"
              isLoaded={isLoaded}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  )
}
