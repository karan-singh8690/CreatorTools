'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  FileDown,
  Loader2,
  Download,
  ArrowDown,
  CheckCircle2,
  TrendingDown,
  Eye,
  Zap,
  Layers,
  Image as ImageIcon,
  Type,
  Copy,
  BarChart3,
  Clock,
  Shield,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useToolHistory } from '@/hooks/use-tool-history'
import { ToolHistoryPanel } from '@/components/pdf-element/tool-history-panel'

type CompressionPreset = 'high-quality' | 'balanced' | 'maximum'

interface CompressionResult {
  file: PdfFile
  compression: {
    originalSize: number
    compressedSize: number
    savedBytes: number
    savedPercent: string
  }
  operations?: {
    type: string
    description: string
    savedBytes: number
    itemsProcessed: number
  }[]
  durationMs?: number
  preset?: string
}

interface PreviewData {
  preview: {
    estimatedSavings: number
    estimatedOutputSize: number
    originalSize: number
    breakdown: {
      images: { count: number; estimatedSaving: number; totalBytes: number }
      metadata: { hasMetadata: boolean; estimatedSaving: number; totalBytes: number }
      duplicates: { estimatedSaving: number }
      objects: { estimatedSaving: number }
    }
    analysis: {
      imageCount: number
      hasMetadata: boolean
      pageCount: number
      estimatedObjectCount: number
      fontCount: number
      isLinearized: boolean
    }
  }
  fileInfo: { id: string; name: string; size: number; pages: number }
}

const PRESET_CARDS: {
  id: CompressionPreset
  label: string
  description: string
  icon: React.ElementType
  color: string
  quality: string
  savings: string
}[] = [
  {
    id: 'high-quality',
    label: 'High Quality',
    description: 'Minimal compression, preserves original quality',
    icon: Shield,
    color: 'text-green-600 bg-green-50 border-green-200',
    quality: '85% JPEG',
    savings: '~10-20%',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Good compression with acceptable quality',
    icon: Zap,
    color: 'text-[#4A90D9] bg-[#4A90D9]/5 border-[#4A90D9]/20',
    quality: '65% JPEG',
    savings: '~30-50%',
  },
  {
    id: 'maximum',
    label: 'Maximum',
    description: 'Aggressive compression, noticeable quality loss',
    icon: TrendingDown,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    quality: '40% JPEG',
    savings: '~50-70%',
  },
]

// ─── Batch Mode ──────────────────────────────────────────────────────────────

function BatchCompressView({ onBack, addHistory }: { onBack: () => void; addHistory: (summary: string, details?: Record<string, any>, status?: 'success' | 'error' | 'partial') => void }) {
  const { recentFiles, batchCompress, isCompressing, compressionProgress } = useAppStore()
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [preset, setPreset] = useState<CompressionPreset>('balanced')
  const [results, setResults] = useState<any>(null)

  const toggleFile = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBatchCompress = async () => {
    if (selectedIds.size === 0) return
    const result = await batchCompress(Array.from(selectedIds), preset)
    if (result) {
      setResults(result)
      addHistory(
        `Batch compressed ${result.summary.success} files — saved ${formatFileSize(result.summary.totalSavedBytes)}`,
        {
          fileCount: result.summary.success,
          totalSavedBytes: result.summary.totalSavedBytes,
          errors: result.summary.errors,
          preset: preset,
        },
        result.summary.errors > 0 ? 'partial' : 'success'
      )
      toast({
        title: 'Batch Compression Complete',
        description: `${result.summary.success} files compressed, saved ${formatFileSize(result.summary.totalSavedBytes)}`,
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Batch Compress</h3>
          <p className="text-xs text-gray-400">Select multiple files to compress at once</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={onBack}>
            Single File Mode
          </Button>
        </div>
      </div>

      {/* Preset selector */}
      <div className="grid grid-cols-3 gap-2">
        {PRESET_CARDS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={cn(
              'p-3 rounded-lg border-2 text-left transition-all',
              preset === p.id ? 'border-[#4A90D9] shadow-sm' : 'border-gray-100 hover:border-gray-200'
            )}
          >
            <p className="text-xs font-medium text-gray-800">{p.label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{p.quality} · {p.savings}</p>
          </button>
        ))}
      </div>

      {/* File list */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {recentFiles.map((file) => (
          <button
            key={file.id}
            onClick={() => toggleFile(file.id)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
              selectedIds.has(file.id) ? 'border-[#4A90D9] bg-[#4A90D9]/5' : 'border-gray-100 hover:border-gray-200'
            )}
          >
            <div className={cn(
              'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
              selectedIds.has(file.id) ? 'border-[#4A90D9] bg-[#4A90D9]' : 'border-gray-300'
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
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Batch Complete</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-green-600">{results.summary.success}</p>
                <p className="text-[10px] text-gray-500">Compressed</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800">{formatFileSize(results.summary.totalSavedBytes)}</p>
                <p className="text-[10px] text-gray-500">Total Saved</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-500">{results.summary.errors}</p>
                <p className="text-[10px] text-gray-500">Failed</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => setResults(null)}>
              Compress More
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          disabled={selectedIds.size === 0 || isCompressing}
          onClick={handleBatchCompress}
        >
          {isCompressing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Compressing {compressionProgress?.current || 0}/{compressionProgress?.total || selectedIds.size}...
            </>
          ) : (
            <>
              <ArrowDown className="w-4 h-4 mr-2" />
              Compress {selectedIds.size} File{selectedIds.size !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CompressPdf() {
  const {
    recentFiles,
    compressFile,
    compressFilePreview,
    isCompressing,
    compressionProgress,
    setCurrentView,
  } = useAppStore()

  const { toast } = useToast()
  const { history, addHistory, deleteItem, clearHistory, isLoaded } = useToolHistory('compress', 'Compress PDF')

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [compressionPreset, setCompressionPreset] = useState<CompressionPreset>('balanced')
  const [result, setResult] = useState<CompressionResult | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isBatchMode, setIsBatchMode] = useState(false)

  // Fetch preview when file changes
  useEffect(() => {
    if (!selectedFile) return

    let cancelled = false
    const fetchPreview = async () => {
      setIsLoadingPreview(true)
      const data = await compressFilePreview(selectedFile.id)
      if (!cancelled) {
        setPreview(data || null)
        setIsLoadingPreview(false)
      }
    }

    fetchPreview()
    return () => { cancelled = true }
  }, [selectedFile?.id, compressFilePreview])

  const handleCompress = useCallback(async () => {
    if (!selectedFile) return

    setResult(null)
    const response = await compressFile(selectedFile.id, compressionPreset)

    if (response) {
      setResult(response)
      addHistory(
        `Compressed ${selectedFile.name} — saved ${response.compression.savedPercent}%`,
        {
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          originalSize: response.compression.originalSize,
          compressedSize: response.compression.compressedSize,
          savedPercent: response.compression.savedPercent,
          savedBytes: response.compression.savedBytes,
          preset: compressionPreset,
          pages: selectedFile.pages,
        },
        'success'
      )
      toast({
        title: 'Compression Complete',
        description: `Saved ${response.compression.savedPercent}% — ${formatFileSize(response.compression.savedBytes)} reduced in ${response.durationMs ? (response.durationMs / 1000).toFixed(1) + 's' : 'a moment'}`,
      })
    } else {
      toast({
        title: 'Compression Failed',
        description: 'Failed to compress the PDF file. Please try again.',
        variant: 'destructive',
      })
    }
  }, [selectedFile, compressionPreset, compressFile, toast, addHistory])

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

  const savedPercentNum = result ? parseFloat(result.compression.savedPercent) : 0
  const compressionRatio = result ? (result.compression.compressedSize / result.compression.originalSize) * 100 : 100

  if (isBatchMode) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <FileDown className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-semibold text-gray-800">Batch Compress PDFs</h1>
              <p className="text-xs text-gray-400">Reduce multiple files at once</p>
            </div>
          </div>
          <button onClick={() => setCurrentView('home')} className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 md:p-6 md:flex-1 md:min-h-0 md:overflow-auto pb-4 md:pb-0">
          <BatchCompressView onBack={() => setIsBatchMode(false)} addHistory={addHistory} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
            <FileDown className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold text-gray-800">Compress PDF</h1>
            <p className="text-xs text-gray-400">Reduce PDF file size for easier sharing</p>
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
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to compress</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => { setSelectedFile(file); setResult(null) }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-green-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-green-600 truncate">{file.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.size)} · {file.pages} page{file.pages !== 1 ? 's' : ''}</div>
                        <div className="text-[11px] text-gray-300 mt-0.5">{formatDate(file.updatedAt)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                  <FileDown className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to compress it</p>
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
                      <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-green-600" />
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

              {/* Compression Preview */}
              {preview && !result && (
                <Card className="border-[#4A90D9]/20 bg-[#4A90D9]/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-4 h-4 text-[#4A90D9]" />
                      <h4 className="text-sm font-medium text-[#4A90D9]">Compression Preview</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Estimated Savings</span>
                          <span className="text-sm font-bold text-[#4A90D9]">~{preview.preview.estimatedSavings}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Est. Output Size</span>
                          <span className="text-xs font-medium text-gray-800">{formatFileSize(preview.preview.estimatedOutputSize)}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {preview.preview.analysis.imageCount > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                            <ImageIcon className="w-3 h-3 text-green-500" />
                            {preview.preview.analysis.imageCount} images ({formatFileSize(preview.preview.breakdown.images.totalBytes)})
                          </div>
                        )}
                        {preview.preview.analysis.hasMetadata && (
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                            <Type className="w-3 h-3 text-amber-500" />
                            Metadata detected
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <Copy className="w-3 h-3 text-[#4A90D9]" />
                          {preview.preview.analysis.estimatedObjectCount} objects
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isLoadingPreview && !preview && !result && (
                <Card className="border-gray-200">
                  <CardContent className="p-4 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-[#4A90D9] animate-spin" />
                    <span className="text-xs text-gray-500">Analyzing compression potential...</span>
                  </CardContent>
                </Card>
              )}

              {/* Compression Result */}
              {result && (
                <div className="space-y-4">
                  {/* Success Banner */}
                  <Card className={cn(
                    'border-2',
                    savedPercentNum > 0 ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50'
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {savedPercentNum > 0 ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                        ) : (
                          <Shield className="w-5 h-5 text-gray-500 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {savedPercentNum > 0 ? 'Compression Successful' : 'Already Optimized'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {savedPercentNum > 0
                              ? `Reduced by ${result.compression.savedPercent}% — saved ${formatFileSize(result.compression.savedBytes)}`
                              : 'This file is already optimally compressed. No further savings possible.'}
                          </p>
                        </div>
                        {result.durationMs && (
                          <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                            <Clock className="w-3 h-3 mr-1" />
                            {(result.durationMs / 1000).toFixed(1)}s
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Size Comparison */}
                  <Card className="border-gray-200">
                    <CardContent className="p-5 space-y-4">
                      <h4 className="text-sm font-medium text-gray-700">Before & After Comparison</h4>

                      {/* Before */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Before
                          </span>
                          <span className="font-medium text-gray-700">{formatFileSize(result.compression.originalSize)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-gray-300 rounded-full" style={{ width: '100%' }} />
                        </div>
                      </div>

                      {/* After */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-green-600 flex items-center gap-1">
                            <FileDown className="w-3 h-3" /> After
                          </span>
                          <span className="font-medium text-green-600">{formatFileSize(result.compression.compressedSize)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${compressionRatio}%` }} />
                        </div>
                      </div>

                      <Separator />

                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{result.compression.savedPercent}%</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Space Saved</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-800">{formatFileSize(result.compression.savedBytes)}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Bytes Saved</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-800">{formatFileSize(result.compression.compressedSize)}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Final Size</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Operations Breakdown */}
                  {result.operations && result.operations.length > 0 && (
                    <Card className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <BarChart3 className="w-4 h-4 text-gray-500" />
                          <h4 className="text-xs font-medium text-gray-600">Compression Operations</h4>
                        </div>
                        <div className="space-y-2">
                          {result.operations.map((op, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <ChevronRight className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-700">{op.description}</p>
                                {op.savedBytes > 0 && (
                                  <p className="text-[10px] text-green-600">Saved {formatFileSize(op.savedBytes)}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Download */}
                  <div className="flex items-center gap-3">
                    <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Compressed PDF
                    </Button>
                    <Button variant="outline" className="text-xs" onClick={() => { setSelectedFile(null); setResult(null); setPreview(null) }}>
                      Compress Another File
                    </Button>
                  </div>
                </div>
              )}

              {/* Compressing State */}
              {isCompressing && !result && (
                <Card className="border-gray-200">
                  <CardContent className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-green-600 animate-spin mb-3" />
                    <p className="text-sm font-medium text-gray-700">Compressing PDF...</p>
                    <p className="text-xs text-gray-400 mt-1">Optimizing {selectedFile.name}</p>
                    <div className="w-48 mt-4">
                      <Progress value={compressionProgress ? (compressionProgress.current / compressionProgress.total) * 100 : 30} className="h-1.5" />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      {compressionProgress?.fileName || 'Processing...'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-gray-200 p-4 md:p-5 md:overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Compression Settings</h3>

          {!selectedFile ? (
            /* No file selected — show disabled preview with hint */
            <div className="space-y-5 opacity-50 pointer-events-none select-none">
              {/* Preset Cards (disabled preview) */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-3 block">Quality Preset</label>
                <div className="space-y-2">
                  {PRESET_CARDS.map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        'w-full p-3 rounded-lg border-2 text-left',
                        compressionPreset === p.id
                          ? p.color + ' shadow-sm'
                          : 'border-gray-100'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center',
                          compressionPreset === p.id ? p.color.split(' ').slice(1).join(' ') : 'bg-gray-100'
                        )}>
                          <p.icon className={cn(
                            'w-4 h-4',
                            compressionPreset === p.id ? p.color.split(' ')[0] : 'text-gray-400'
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-800">{p.label}</p>
                            <span className="text-[10px] text-gray-400">{p.savings}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">{p.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex flex-col items-center py-4 text-center">
                <FileDown className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-medium text-gray-500">Select a file first</p>
                <p className="text-[10px] text-gray-400 mt-1">Settings will activate once a PDF is chosen</p>
              </div>
            </div>
          ) : (
            /* File selected — full interactive settings */
            <div className="space-y-5">
              {/* Preset Cards */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-3 block">Quality Preset</label>
                <div className="space-y-2">
                  {PRESET_CARDS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setCompressionPreset(p.id)}
                      className={cn(
                        'w-full p-3 rounded-lg border-2 text-left transition-all',
                        compressionPreset === p.id
                          ? p.color + ' shadow-sm'
                          : 'border-gray-100 hover:border-gray-200'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center',
                          compressionPreset === p.id ? p.color.split(' ').slice(1).join(' ') : 'bg-gray-100'
                        )}>
                          <p.icon className={cn(
                            'w-4 h-4',
                            compressionPreset === p.id ? p.color.split(' ')[0] : 'text-gray-400'
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-800">{p.label}</p>
                            <span className="text-[10px] text-gray-400">{p.savings}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">{p.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* What Gets Compressed */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">What Gets Compressed</label>
                <div className="space-y-1.5 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-3.5 h-3.5 text-green-500" />
                    <span>Image recompression (sharp JPEG)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Type className="w-3.5 h-3.5 text-green-500" />
                    <span>Font & metadata cleanup</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5 text-green-500" />
                    <span>Duplicate object removal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-green-500" />
                    <span>Object stream consolidation</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Preset Details */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">
                  {compressionPreset === 'high-quality' ? 'High Quality' : compressionPreset === 'balanced' ? 'Balanced' : 'Maximum'} Settings
                </label>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">JPEG Quality</span>
                    <span className="text-gray-700 font-medium">
                      {compressionPreset === 'high-quality' ? '85%' : compressionPreset === 'balanced' ? '65%' : '40%'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max DPI</span>
                    <span className="text-gray-700 font-medium">
                      {compressionPreset === 'high-quality' ? '300' : compressionPreset === 'balanced' ? '200' : '150'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Image Downscale</span>
                    <span className="text-gray-700 font-medium">
                      {compressionPreset === 'high-quality' ? '3000px' : compressionPreset === 'balanced' ? '2000px' : '1200px'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Remove Metadata</span>
                    <span className="text-green-600 font-medium">Yes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Object Streams</span>
                    <span className="text-green-600 font-medium">Yes</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* File Info */}
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
                  {preview && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Images</span>
                        <span className="text-gray-700">{preview.preview.analysis.imageCount}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Objects</span>
                        <span className="text-gray-700">{preview.preview.analysis.estimatedObjectCount}</span>
                      </div>
                    </>
                  )}
                  {result && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600 font-medium">Saved</span>
                        <span className="text-green-600 font-medium">{result.compression.savedPercent}%</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Button
                  className="w-full h-9 text-xs bg-green-600 hover:bg-green-700"
                  disabled={isCompressing}
                  onClick={handleCompress}
                >
                  {isCompressing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      Compressing...
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-3.5 h-3.5 mr-1" />
                      Compress PDF
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
            </div>
          )}

          <Separator />
          <ToolHistoryPanel
            history={history}
            onDelete={deleteItem}
            onClearAll={clearHistory}
            toolLabel="Compress PDF"
            isLoaded={isLoaded}
            compact
          />
        </div>
      </div>
    </div>
  )
}
