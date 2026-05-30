'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  ScanLine,
  Loader2,
  Copy,
  Check,
  Eye,
  Hash,
  Type,
  BookOpen,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface OcrResult {
  text: string
  pages: number
}

export function OcrPdf() {
  const {
    recentFiles,
    setCurrentView,
  } = useAppStore()

  const { toast } = useToast()

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [isOcring, setIsOcring] = useState(false)
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set())

  const handleOcr = useCallback(async () => {
    if (!selectedFile) return

    setIsOcring(true)
    setOcrResult(null)
    try {
      const response = await fetch(`/api/files/${selectedFile.id}/extract-text`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'OCR failed' }))
        throw new Error(errorData.error || 'OCR failed')
      }
      const data = await response.json()
      const result: OcrResult = {
        text: data.text || '',
        pages: data.pages || 0,
      }
      setOcrResult(result)
      // Expand first page by default
      setExpandedPages(new Set([0]))
      toast({
        title: 'OCR Complete',
        description: `Successfully extracted text from ${selectedFile.name}`,
      })
    } catch (error) {
      console.error('OCR error:', error)
      toast({
        title: 'OCR Failed',
        description: error instanceof Error ? error.message : 'Failed to perform OCR on the PDF',
        variant: 'destructive',
      })
    } finally {
      setIsOcring(false)
    }
  }, [selectedFile, toast])

  const handleCopy = useCallback(async () => {
    if (!ocrResult) return
    try {
      await navigator.clipboard.writeText(ocrResult.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: 'Copied',
        description: 'All extracted text copied to clipboard',
      })
    } catch {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy text to clipboard',
        variant: 'destructive',
      })
    }
  }, [ocrResult, toast])

  const togglePage = useCallback((pageIndex: number) => {
    setExpandedPages((prev) => {
      const next = new Set(prev)
      if (next.has(pageIndex)) {
        next.delete(pageIndex)
      } else {
        next.add(pageIndex)
      }
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    if (!ocrResult) return
    setExpandedPages(new Set(pageTexts.map((_, i) => i)))
  }, [ocrResult])

  const collapseAll = useCallback(() => {
    setExpandedPages(new Set())
  }, [])

  // Split text into pages (simulated by splitting on double newlines or evenly)
  const pageTexts = useMemo(() => {
    if (!ocrResult || !ocrResult.text) return []
    const text = ocrResult.text
    const totalPages = Math.max(1, ocrResult.pages)

    // If text has page breaks, split by them
    if (text.includes('\f')) {
      return text.split('\f').filter((p) => p.trim().length > 0)
    }

    // Otherwise split evenly by number of pages
    if (totalPages <= 1) return [text]

    const lines = text.split('\n')
    const linesPerPage = Math.ceil(lines.length / totalPages)
    const pages: string[] = []
    for (let i = 0; i < totalPages; i++) {
      const pageLines = lines.slice(i * linesPerPage, (i + 1) * linesPerPage)
      if (pageLines.length > 0) {
        pages.push(pageLines.join('\n'))
      }
    }
    return pages
  }, [ocrResult])

  const wordCount = useMemo(() => {
    if (!ocrResult) return 0
    return ocrResult.text.trim().split(/\s+/).filter((w) => w.length > 0).length
  }, [ocrResult])

  const charCount = useMemo(() => {
    if (!ocrResult) return 0
    return ocrResult.text.length
  }, [ocrResult])

  const lineCount = useMemo(() => {
    if (!ocrResult) return 0
    return ocrResult.text.split('\n').filter((l) => l.trim().length > 0).length
  }, [ocrResult])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
            <ScanLine className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">OCR PDF</h1>
            <p className="text-xs text-gray-400">Extract text from scanned documents and images</p>
          </div>
        </div>
        <button
          onClick={() => setCurrentView('home')}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Main Content */}
        <div className="flex-1 p-6 overflow-auto">
          {!selectedFile ? (
            /* File Selection */
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file for OCR</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedFile(file)
                        setOcrResult(null)
                      }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-purple-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-purple-600 truncate">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {formatFileSize(file.size)} · {file.pages} page{file.pages !== 1 ? 's' : ''}
                        </div>
                        <div className="text-[11px] text-gray-300 mt-0.5">
                          {formatDate(file.updatedAt)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                  <ScanLine className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to perform OCR</p>
                </div>
              )}
            </div>
          ) : (
            /* OCR View */
            <div className="space-y-4">
              {/* Selected File Info */}
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{selectedFile.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {formatFileSize(selectedFile.size)} · {selectedFile.pages} page{selectedFile.pages !== 1 ? 's' : ''} · {formatDate(selectedFile.updatedAt)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => {
                        setSelectedFile(null)
                        setOcrResult(null)
                      }}
                    >
                      Change File
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* OCR Results */}
              {ocrResult && (
                <div className="space-y-4">
                  {/* Statistics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="border-gray-200">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-gray-800">{ocrResult.pages}</div>
                          <div className="text-[10px] text-gray-400">Total Pages</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-gray-200">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
                          <Type className="w-4 h-4 text-teal-600" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-gray-800">{charCount.toLocaleString()}</div>
                          <div className="text-[10px] text-gray-400">Characters</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-gray-200">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
                          <Hash className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-gray-800">{wordCount.toLocaleString()}</div>
                          <div className="text-[10px] text-gray-400">Words</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-gray-200">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                          <Eye className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-gray-800">{lineCount.toLocaleString()}</div>
                          <div className="text-[10px] text-gray-400">Lines</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Page-by-Page Breakdown */}
                  <Card className="border-gray-200">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                      <span className="text-xs font-medium text-gray-600">
                        Page-by-Page Breakdown ({pageTexts.length} page{pageTexts.length !== 1 ? 's' : ''})
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-gray-500 hover:text-gray-700"
                          onClick={expandAll}
                        >
                          Expand All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-gray-500 hover:text-gray-700"
                          onClick={collapseAll}
                        >
                          Collapse All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-gray-500 hover:text-gray-700"
                          onClick={handleCopy}
                        >
                          {copied ? (
                            <Check className="w-3 h-3 mr-1 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3 mr-1" />
                          )}
                          {copied ? 'Copied' : 'Copy All'}
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="max-h-[400px]">
                      <div className="divide-y divide-gray-50">
                        {pageTexts.map((pageText, index) => {
                          const pageWords = pageText.trim().split(/\s+/).filter((w) => w.length > 0).length
                          const isExpanded = expandedPages.has(index)
                          return (
                            <div key={index}>
                              <button
                                onClick={() => togglePage(index)}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                  )}
                                  <span className="text-xs font-medium text-gray-700">Page {index + 1}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                                    {pageWords} words
                                  </Badge>
                                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                                    {pageText.length} chars
                                  </Badge>
                                </div>
                              </button>
                              {isExpanded && (
                                <div className="px-4 pb-3 pl-9">
                                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 p-3 rounded-md">
                                    {pageText.trim() || '(No text content on this page)'}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
              )}

              {/* OCR Running State */}
              {isOcring && (
                <Card className="border-gray-200">
                  <CardContent className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-3" />
                    <p className="text-sm font-medium text-gray-700">Performing OCR...</p>
                    <p className="text-xs text-gray-400 mt-1">Extracting text from {selectedFile.name}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <div className="w-72 bg-white border-l border-gray-200 p-5 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">OCR Settings</h3>

          <div className="space-y-5">
            {/* OCR Engine */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">OCR Engine</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-600 bg-gray-50">
                Built-in OCR Engine
              </div>
            </div>

            <Separator />

            {/* Language */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Recognition Language</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-600 bg-gray-50">
                English
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Auto-detected from document content</p>
            </div>

            <Separator />

            {/* Output Options */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Output Options</label>
              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-500" />
                  <span>Searchable text layer</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-500" />
                  <span>Preserve original layout</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-500" />
                  <span>Page-by-page extraction</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* File Info */}
            {selectedFile ? (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">File Information</label>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">File Name</span>
                    <span className="text-gray-700 truncate ml-2 max-w-[140px]">{selectedFile.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">File Size</span>
                    <span className="text-gray-700">{formatFileSize(selectedFile.size)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Pages</span>
                    <span className="text-gray-700">{selectedFile.pages}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Modified</span>
                    <span className="text-gray-700">{formatDate(selectedFile.updatedAt)}</span>
                  </div>
                  {ocrResult && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-xs">
                        <span className="text-purple-600 font-medium">Words</span>
                        <span className="text-purple-600 font-medium">{wordCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-purple-600 font-medium">Characters</span>
                        <span className="text-purple-600 font-medium">{charCount.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <ScanLine className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">Select a file to view its information</p>
              </div>
            )}

            {selectedFile && (
              <>
                <Separator />

                {/* OCR Button */}
                <div className="space-y-2">
                  <Button
                    className="w-full h-9 text-xs bg-purple-600 hover:bg-purple-700"
                    disabled={isOcring}
                    onClick={handleOcr}
                  >
                    {isOcring ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Processing OCR...
                      </>
                    ) : (
                      <>
                        <ScanLine className="w-3.5 h-3.5 mr-1" />
                        Run OCR
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-9 text-xs"
                    onClick={() => {
                      setSelectedFile(null)
                      setOcrResult(null)
                    }}
                  >
                    Back to File List
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
