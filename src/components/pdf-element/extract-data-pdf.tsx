'use client'

import { useState, useCallback } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  Database,
  Loader2,
  CheckCircle2,
  Copy,
  Download,
  Search,
  Braces,
  FileSpreadsheet,
  FileType,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getPartnersForTool } from '@/lib/partners'
import { PartnerRecommendationInline } from './partner-recommendation'

type ExtractFormat = 'json' | 'csv' | 'text'

interface ExtractionResult {
  data: string
  format: string
  pageCount: number
  truncated: boolean
  query: string | null
}

const formatIcons: Record<ExtractFormat, React.ElementType> = {
  json: Braces,
  csv: FileSpreadsheet,
  text: FileType,
}

const formatLabels: Record<ExtractFormat, string> = {
  json: 'JSON',
  csv: 'CSV',
  text: 'Plain Text',
}

export function ExtractDataPdf() {
  const {
    recentFiles,
    extractDataFile,
    isExtractingData,
    setCurrentView,
  } = useAppStore()

  const { toast } = useToast()

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [format, setFormat] = useState<ExtractFormat>('json')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [hasError, setHasError] = useState(false)

  const handleExtract = useCallback(async () => {
    if (!selectedFile) return

    setResult(null)
    setHasError(false)
    const response = await extractDataFile(selectedFile.id, {
      format,
      query: query.trim() || undefined,
    })

    if (response) {
      setResult(response)
      toast({
        title: 'Extraction Complete',
        description: `Data extracted in ${format.toUpperCase()} format from ${response.pageCount} page(s)`,
      })
    } else {
      setHasError(true)
      toast({
        title: 'Extraction Failed',
        description: 'Failed to extract data from the PDF file. Please try again.',
        variant: 'destructive',
      })
    }
  }, [selectedFile, format, query, extractDataFile, toast])

  const handleCopyToClipboard = useCallback(async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.data)
      toast({
        title: 'Copied to Clipboard',
        description: 'Extracted data has been copied',
      })
    } catch {
      toast({
        title: 'Copy Failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      })
    }
  }, [result, toast])

  const handleDownload = useCallback(() => {
    if (!result) return

    const extensions: Record<string, string> = {
      json: 'json',
      csv: 'csv',
      text: 'txt',
    }
    const ext = extensions[result.format] || 'txt'
    const fileName = selectedFile
      ? selectedFile.name.replace(/\.pdf$/i, '') + `_extracted.${ext}`
      : `extracted_data.${ext}`

    const blob = new Blob([result.data], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    toast({
      title: 'Download Started',
      description: `Downloading ${fileName}`,
    })
  }, [result, selectedFile, toast])

  const FormatIcon = formatIcons[format]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
            <Database className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Extract Data</h1>
            <p className="text-xs text-gray-400">AI-powered data extraction from PDF</p>
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
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to extract data from</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedFile(file)
                        setResult(null)
                      }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-orange-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-orange-600 truncate">
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
                  <Database className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to extract data</p>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => {
                        setSelectedFile(null)
                        setResult(null)
                      }}
                    >
                      Change File
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Extraction Result */}
              {result && (
                <div className="space-y-4">
                  {/* Success Banner */}
                  <Card className="border-orange-200 bg-orange-50/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-orange-600 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-orange-800">Data Extracted Successfully</p>
                          <p className="text-xs text-orange-600 mt-0.5">
                            Format: {result.format.toUpperCase()} · Pages: {result.pageCount}
                            {result.truncated && ' · (Partial — document was truncated)'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Extracted Data Code Block */}
                  <Card className="border-gray-200">
                    <CardContent className="p-0">
                      {/* Code block header */}
                      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                        <div className="flex items-center gap-2">
                          <FormatIcon className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-xs font-medium text-gray-600">{formatLabels[result.format as ExtractFormat]}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] text-gray-500 hover:text-gray-700"
                            onClick={handleCopyToClipboard}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] text-gray-500 hover:text-gray-700"
                            onClick={handleDownload}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                      {/* Code block content */}
                      <div className="p-4 max-h-96 overflow-auto">
                        <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                          {result.data}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    <Button
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download as {formatLabels[result.format as ExtractFormat]}
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs"
                      onClick={handleCopyToClipboard}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy to Clipboard
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        setSelectedFile(null)
                        setResult(null)
                      }}
                    >
                      Extract Another File
                    </Button>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isExtractingData && !result && (
                <Card className="border-gray-200">
                  <CardContent className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-3" />
                    <p className="text-sm font-medium text-gray-700">Extracting Data...</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Analyzing {selectedFile.name} with AI
                    </p>
                    <div className="w-48 mt-4">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">This may take a moment...</p>
                  </CardContent>
                </Card>
              )}

              {/* Error State with Partner Recommendation */}
              {hasError && !result && !isExtractingData && (
                <div className="space-y-3">
                  <Card className="border-red-200 bg-red-50/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-red-700">
                        Data extraction failed. The document may be image-based or the AI extraction service is currently unavailable.
                        Try using OCR first, or check out a professional data extraction service below.
                      </p>
                    </CardContent>
                  </Card>
                  <PartnerRecommendationInline
                    category={getPartnersForTool('extract-data')!}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <div className="w-72 bg-white border-l border-gray-200 p-5 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Extraction Settings</h3>

          {!selectedFile ? (
            <div className="space-y-5 opacity-50 pointer-events-none select-none">
              {/* Output Format (disabled preview) */}
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">Output Format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => setFormat(v as ExtractFormat)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">
                      <span className="flex items-center gap-2">
                        <Braces className="w-3.5 h-3.5" /> JSON
                      </span>
                    </SelectItem>
                    <SelectItem value="csv">
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                      </span>
                    </SelectItem>
                    <SelectItem value="text">
                      <span className="flex items-center gap-2">
                        <FileType className="w-3.5 h-3.5" /> Plain Text
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Query (disabled preview) */}
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">
                  Extraction Query <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='e.g., "Extract invoice numbers and dates"'
                    className="h-8 text-xs pl-8"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  Specify what data to extract, or leave empty to extract all structured data.
                </p>
              </div>

              <Separator />

              {/* Format Descriptions (disabled preview) */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Format Details</label>
                <div className="space-y-2">
                  <div
                    className={cn(
                      'p-2.5 rounded-lg border transition-all',
                      format === 'json' ? 'border-orange-200 bg-orange-50/50' : 'border-gray-100'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Braces className="w-3 h-3 text-orange-500" />
                      <span className="text-xs font-medium text-gray-700">JSON</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-tight">
                      Structured key-value pairs, ideal for programmatic use
                    </p>
                  </div>
                  <div
                    className={cn(
                      'p-2.5 rounded-lg border transition-all',
                      format === 'csv' ? 'border-orange-200 bg-orange-50/50' : 'border-gray-100'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileSpreadsheet className="w-3 h-3 text-orange-500" />
                      <span className="text-xs font-medium text-gray-700">CSV</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-tight">
                      Tabular format with headers, ideal for spreadsheets
                    </p>
                  </div>
                  <div
                    className={cn(
                      'p-2.5 rounded-lg border transition-all',
                      format === 'text' ? 'border-orange-200 bg-orange-50/50' : 'border-gray-100'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileType className="w-3 h-3 text-orange-500" />
                      <span className="text-xs font-medium text-gray-700">Plain Text</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-tight">
                      Well-structured text with labels, ideal for reading
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col items-center py-4 text-center">
                <Database className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-medium text-gray-500">Select a file first</p>
                <p className="text-[10px] text-gray-400 mt-1">Settings will activate once a PDF is chosen</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Output Format */}
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">Output Format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => setFormat(v as ExtractFormat)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">
                      <span className="flex items-center gap-2">
                        <Braces className="w-3.5 h-3.5" /> JSON
                      </span>
                    </SelectItem>
                    <SelectItem value="csv">
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                      </span>
                    </SelectItem>
                    <SelectItem value="text">
                      <span className="flex items-center gap-2">
                        <FileType className="w-3.5 h-3.5" /> Plain Text
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Query */}
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">
                  Extraction Query <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='e.g., "Extract invoice numbers and dates"'
                    className="h-8 text-xs pl-8"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  Specify what data to extract, or leave empty to extract all structured data.
                </p>
              </div>

              <Separator />

              {/* Format Descriptions */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Format Details</label>
                <div className="space-y-2">
                  <div
                    className={cn(
                      'p-2.5 rounded-lg border transition-all',
                      format === 'json' ? 'border-orange-200 bg-orange-50/50' : 'border-gray-100'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Braces className="w-3 h-3 text-orange-500" />
                      <span className="text-xs font-medium text-gray-700">JSON</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-tight">
                      Structured key-value pairs, ideal for programmatic use
                    </p>
                  </div>
                  <div
                    className={cn(
                      'p-2.5 rounded-lg border transition-all',
                      format === 'csv' ? 'border-orange-200 bg-orange-50/50' : 'border-gray-100'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileSpreadsheet className="w-3 h-3 text-orange-500" />
                      <span className="text-xs font-medium text-gray-700">CSV</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-tight">
                      Tabular format with headers, ideal for spreadsheets
                    </p>
                  </div>
                  <div
                    className={cn(
                      'p-2.5 rounded-lg border transition-all',
                      format === 'text' ? 'border-orange-200 bg-orange-50/50' : 'border-gray-100'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileType className="w-3 h-3 text-orange-500" />
                      <span className="text-xs font-medium text-gray-700">Plain Text</span>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-tight">
                      Well-structured text with labels, ideal for reading
                    </p>
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
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Button
                  className="w-full h-9 text-xs bg-orange-600 hover:bg-orange-700"
                  disabled={isExtractingData}
                  onClick={handleExtract}
                >
                  {isExtractingData ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5 mr-1" />
                      Extract Data
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-9 text-xs"
                  onClick={() => {
                    setSelectedFile(null)
                    setResult(null)
                  }}
                >
                  Back to File List
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
