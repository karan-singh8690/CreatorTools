'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore, formatFileSize, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  Loader2,
  Download,
  Code,
  FileCode,
  Globe,
  ChevronRight,
  Heading1,
  List,
  Table2,
  Link2,
  Type,
  Languages,
  Clock,
  BarChart3,
  Copy,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useToolHistory } from '@/hooks/use-tool-history'
import { ToolHistoryPanel } from '@/components/pdf-element/tool-history-panel'

type ExportFormat = 'structured' | 'json' | 'markdown' | 'html'

interface StructuredResult {
  pages: Array<{
    pageNumber: number
    width: number
    height: number
    elements: Array<{
      type: string
      content: string
      level?: number
      href?: string
      rows?: string[][]
      listMarker?: string
      style?: { fontSize: number; fontName: string; isBold: boolean; isItalic: boolean }
      pageNumber: number
    }>
  }>
  metadata: {
    title?: string
    author?: string
    subject?: string
    pageCount: number
    language: string
    totalElements: number
    headingCount: number
    tableCount: number
    linkCount: number
    listCount: number
  }
  durationMs: number
}

const FORMAT_OPTIONS: { id: ExportFormat; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'structured', label: 'Structured', icon: BarChart3, desc: 'Rich preview with detected structure' },
  { id: 'markdown', label: 'Markdown', icon: FileCode, desc: 'Export as .md file' },
  { id: 'html', label: 'HTML', icon: Globe, desc: 'Export as styled .html file' },
  { id: 'json', label: 'JSON', icon: Code, desc: 'Export as structured .json data' },
]

// ─── Structured Element Renderer ─────────────────────────────────────────────

function ElementRenderer({ el }: { el: StructuredResult['pages'][0]['elements'][0] }) {
  switch (el.type) {
    case 'heading1':
      return <h1 className="text-xl font-bold text-gray-900 mt-4 mb-1">{el.content}</h1>
    case 'heading2':
      return <h2 className="text-lg font-bold text-gray-800 mt-3 mb-1">{el.content}</h2>
    case 'heading3':
      return <h3 className="text-base font-semibold text-gray-800 mt-2 mb-0.5">{el.content}</h3>
    case 'heading4':
      return <h4 className="text-sm font-semibold text-gray-700 mt-2 mb-0.5">{el.content}</h4>
    case 'paragraph': {
      const isBold = el.style?.isBold
      const isItalic = el.style?.isItalic
      return (
        <p className={cn(
          'text-sm text-gray-700 leading-relaxed mb-1.5',
          isBold && 'font-semibold',
          isItalic && 'italic',
        )}>
          {el.content}
        </p>
      )
    }
    case 'list_item':
      return (
        <div className="flex items-start gap-2 text-sm text-gray-700 mb-0.5 ml-2">
          <span className="text-[#4A90D9] font-medium shrink-0">{el.listMarker || '•'}</span>
          <span>{el.content}</span>
        </div>
      )
    case 'table':
      return el.rows && el.rows.length > 0 ? (
        <div className="overflow-x-auto my-2">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {el.rows[0].map((cell, ci) => (
                  <th key={ci} className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {el.rows.slice(1).map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-gray-200 px-3 py-1.5 text-gray-600">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null
    case 'link':
      return (
        <div className="flex items-center gap-1.5 text-sm mb-1">
          <Link2 className="w-3 h-3 text-[#4A90D9] shrink-0" />
          <a href={el.href} target="_blank" rel="noopener noreferrer" className="text-[#4A90D9] underline hover:no-underline">
            {el.content}
          </a>
        </div>
      )
    case 'page_break':
      return (
        <div className="flex items-center gap-2 py-3 text-gray-400">
          <div className="flex-1 border-t border-dashed border-gray-200" />
          <span className="text-[10px]">Page {el.pageNumber}</span>
          <div className="flex-1 border-t border-dashed border-gray-200" />
        </div>
      )
    default:
      return null
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ExtractText() {
  const { recentFiles, setCurrentView } = useAppStore()
  const { toast } = useToast()
  const { history, addHistory, deleteItem, clearHistory, isLoaded } = useToolHistory('extract-text', 'Extract Text')

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [result, setResult] = useState<StructuredResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('structured')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!selectedFile) { setResult(null); return }

    let cancelled = false
    const fetchStructured = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/files/${selectedFile.id}/extract-text?format=structured`)
        if (!res.ok) throw new Error('Extraction failed')
        const data = await res.json()
        if (!cancelled) {
          setResult(data.result)
          // Compute word count from extracted elements
          const wordCount = data.result.pages
            .flatMap((p: any) => p.elements.map((el: any) => el.content).filter(Boolean))
            .join(' ')
            .split(/\s+/)
            .filter(Boolean).length
          addHistory(
            `Extracted text from ${selectedFile.name} — ${data.result.metadata.pageCount} page(s)`,
            {
              fileName: selectedFile.name,
              pages: data.result.metadata.pageCount,
              wordCount,
              totalElements: data.result.metadata.totalElements,
              language: data.result.metadata.language,
              fileSize: selectedFile.size,
            }
          )
        }
      } catch (err) {
        console.error('Extraction error:', err)
        if (!cancelled) setResult(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    fetchStructured()
    return () => { cancelled = true }
  }, [selectedFile?.id])

  const handleExport = useCallback(async (exportFormat: ExportFormat) => {
    if (!selectedFile) return

    if (exportFormat === 'structured') {
      // Already loaded in UI
      return
    }

    try {
      const res = await fetch(`/api/files/${selectedFile.id}/extract-text?format=${exportFormat}`)
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      const ext = exportFormat === 'markdown' ? 'md' : exportFormat === 'html' ? 'html' : 'json'
      a.download = selectedFile.name.replace(/\.pdf$/i, '') + `_extracted.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({ title: 'Export Complete', description: `Downloaded as ${ext.toUpperCase()}` })
    } catch (err) {
      toast({ title: 'Export Failed', variant: 'destructive' })
    }
  }, [selectedFile, toast])

  const handleCopyAll = useCallback(async () => {
    if (!result) return
    const allText = result.pages
      .flatMap(p => p.elements.map(el => el.content))
      .filter(Boolean)
      .join('\n')
    await navigator.clipboard.writeText(allText)
    setCopied(true)
    toast({ title: 'Copied to Clipboard' })
    setTimeout(() => setCopied(false), 2000)
  }, [result, toast])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#4A90D9]/10 rounded-lg flex items-center justify-center">
            <Type className="w-4 h-4 text-[#4A90D9]" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold text-gray-800">Extract Text</h1>
            <p className="text-xs text-gray-400">Structured text extraction with formatting preservation</p>
          </div>
        </div>
        <button onClick={() => setCurrentView('home')} className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-y-hidden">
        {/* Main Content */}
        <div className="p-4 md:p-6 md:flex-1 md:min-h-0 md:overflow-auto pb-4 md:pb-0">
          {!selectedFile ? (
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to extract text</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setSelectedFile(file)}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-[#4A90D9] hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-[#4A90D9]/10 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-[#4A90D9]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-[#4A90D9] truncate">{file.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.size)} · {file.pages} page{file.pages !== 1 ? 's' : ''}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                  <Type className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF first</p>
                </div>
              )}
            </div>
          ) : isLoading ? (
            <Card className="border-gray-200">
              <CardContent className="p-12 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-[#4A90D9] animate-spin mb-4" />
                <p className="text-sm font-medium text-gray-700">Extracting structured text...</p>
                <p className="text-xs text-gray-400 mt-1">Analyzing {selectedFile.name} for headings, tables, lists, links</p>
              </CardContent>
            </Card>
          ) : result ? (
            <div className="space-y-4">
              {/* Metadata Banner */}
              <Card className="border-[#4A90D9]/20 bg-[#4A90D9]/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-[#4A90D9]" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {result.metadata.pageCount} pages · {result.metadata.language.toUpperCase()} · Extracted in {(result.durationMs / 1000).toFixed(1)}s
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSelectedFile(null); setResult(null) }}>
                      Change File
                    </Button>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {result.metadata.headingCount > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Heading1 className="w-3 h-3" /> {result.metadata.headingCount} headings
                      </Badge>
                    )}
                    {result.metadata.tableCount > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Table2 className="w-3 h-3" /> {result.metadata.tableCount} tables
                      </Badge>
                    )}
                    {result.metadata.listCount > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <List className="w-3 h-3" /> {result.metadata.listCount} list items
                      </Badge>
                    )}
                    {result.metadata.linkCount > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Link2 className="w-3 h-3" /> {result.metadata.linkCount} links
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Languages className="w-3 h-3" /> {result.metadata.language.toUpperCase()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Extracted Content */}
              <Card className="border-gray-200">
                <CardContent className="p-6">
                  <div className="space-y-0.5">
                    {result.pages.flatMap(page => page.elements).map((el, i) => (
                      <ElementRenderer key={i} el={el} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-6 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Extraction Failed</p>
                  <p className="text-xs text-amber-600 mt-0.5">Could not extract text from this PDF. It may be image-based — try OCR instead.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-full md:w-72 bg-white border-t md:border-t-0 md:border-l border-gray-200 p-4 md:p-5 md:overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Export Settings</h3>

          {!selectedFile ? (
            <div className="space-y-5 opacity-50 pointer-events-none select-none">
              {/* Format Selection (disabled preview) */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Export Format</label>
                <div className="space-y-1.5">
                  {FORMAT_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left',
                        format === f.id ? 'border-[#4A90D9] bg-[#4A90D9]/5' : 'border-gray-100 hover:border-gray-200'
                      )}
                    >
                      <f.icon className={cn('w-4 h-4 shrink-0', format === f.id ? 'text-[#4A90D9]' : 'text-gray-400')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-medium', format === f.id ? 'text-[#4A90D9]' : 'text-gray-700')}>{f.label}</p>
                        <p className="text-[10px] text-gray-400">{f.desc}</p>
                      </div>
                      {format === f.id && <ChevronRight className="w-3 h-3 text-[#4A90D9]" />}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex flex-col items-center py-4 text-center">
                <Type className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-medium text-gray-500">Select a file first</p>
                <p className="text-[10px] text-gray-400 mt-1">Settings will activate once a PDF is chosen</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Format Selection */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Export Format</label>
                <div className="space-y-1.5">
                  {FORMAT_OPTIONS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left',
                        format === f.id ? 'border-[#4A90D9] bg-[#4A90D9]/5' : 'border-gray-100 hover:border-gray-200'
                      )}
                    >
                      <f.icon className={cn('w-4 h-4 shrink-0', format === f.id ? 'text-[#4A90D9]' : 'text-gray-400')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-medium', format === f.id ? 'text-[#4A90D9]' : 'text-gray-700')}>{f.label}</p>
                        <p className="text-[10px] text-gray-400">{f.desc}</p>
                      </div>
                      {format === f.id && <ChevronRight className="w-3 h-3 text-[#4A90D9]" />}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* File Info */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">File Information</label>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name</span>
                    <span className="text-gray-700 truncate ml-2 max-w-[140px]">{selectedFile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Size</span>
                    <span className="text-gray-700">{formatFileSize(selectedFile.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pages</span>
                    <span className="text-gray-700">{selectedFile.pages}</span>
                  </div>
                  {result && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Elements</span>
                        <span className="text-gray-700">{result.metadata.totalElements}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Language</span>
                        <span className="text-gray-700">{result.metadata.language.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Time</span>
                        <span className="text-gray-700">{(result.durationMs / 1000).toFixed(1)}s</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                {format !== 'structured' && (
                  <Button
                    className="w-full h-9 text-xs bg-[#4A90D9] hover:bg-[#3A7BC8]"
                    onClick={() => handleExport(format)}
                    disabled={isLoading}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Export as {FORMAT_OPTIONS.find(f => f.id === format)?.label}
                  </Button>
                )}
                {result && (
                  <Button
                    variant="outline"
                    className="w-full h-9 text-xs"
                    onClick={handleCopyAll}
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copy All Text
                      </>
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full h-9 text-xs"
                  onClick={() => { setSelectedFile(null); setResult(null) }}
                >
                  Back to File List
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* History Panel */}
          <ToolHistoryPanel
            history={history}
            onDelete={deleteItem}
            onClearAll={clearHistory}
            toolLabel="Extract Text"
            isLoaded={isLoaded}
            compact
          />
        </div>
      </div>
    </div>
  )
}
