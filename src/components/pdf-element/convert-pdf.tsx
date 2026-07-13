'use client'

import { useState, useCallback } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  ArrowRightLeft,
  Loader2,
  Download,
  FileCode,
  FileType,
  Copy,
  Check,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useToolHistory } from '@/hooks/use-tool-history'
import { ToolHistoryPanel } from '@/components/pdf-element/tool-history-panel'

type ConvertFormat = 'txt' | 'html'

export function ConvertPdf() {
  const {
    recentFiles,
    setCurrentView,
  } = useAppStore()

  const { toast } = useToast()
  const { history, addHistory, deleteItem, clearHistory, isLoaded } = useToolHistory('convert', 'Convert PDF')

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [format, setFormat] = useState<ConvertFormat>('txt')
  const [isConverting, setIsConverting] = useState(false)
  const [extractedText, setExtractedText] = useState<string | null>(null)
  const [extractedPages, setExtractedPages] = useState<number>(0)
  const [copied, setCopied] = useState(false)

  const handleConvert = useCallback(async () => {
    if (!selectedFile) return

    setIsConverting(true)
    setExtractedText(null)
    try {
      const response = await fetch(`/api/files/${selectedFile.id}/extract-text`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Extraction failed' }))
        throw new Error(errorData.error || 'Extraction failed')
      }
      const data = await response.json()
      setExtractedText(data.text || '')
      setExtractedPages(data.pages || 0)
      addHistory(
        `Converted ${selectedFile.name} to ${format.toUpperCase()}`,
        {
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          format: format.toUpperCase(),
          pages: data.pages || 0,
          wordCount: (data.text || '').trim().split(/\s+/).filter((w: string) => w.length > 0).length,
        },
        'success'
      )
      toast({
        title: 'Conversion Complete',
        description: `Successfully converted ${selectedFile.name} to ${format.toUpperCase()}`,
      })
    } catch (error) {
      console.error('Convert error:', error)
      toast({
        title: 'Conversion Failed',
        description: error instanceof Error ? error.message : 'Failed to extract text from PDF',
        variant: 'destructive',
      })
    } finally {
      setIsConverting(false)
    }
  }, [selectedFile, format, toast, addHistory])

  const handleDownload = useCallback(() => {
    if (!extractedText || !selectedFile) return

    let content: string
    let mimeType: string
    let extension: string

    if (format === 'html') {
      const escapedText = extractedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>\n')
      content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${selectedFile.name} - Extracted Text</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #333; }
    h1 { color: #2b2b2b; border-bottom: 2px solid #4A90D9; padding-bottom: 10px; }
    .content { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${selectedFile.name}</h1>
  <div class="content">${escapedText}</div>
</body>
</html>`
      mimeType = 'text/html'
      extension = 'html'
    } else {
      content = extractedText
      mimeType = 'text/plain'
      extension = 'txt'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = selectedFile.name.replace(/\.pdf$/i, '') + '.' + extension
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: 'Download Started',
      description: `Downloading ${selectedFile.name.replace(/\.pdf$/i, '')}.${extension}`,
    })
  }, [extractedText, selectedFile, format, toast])

  const handleCopy = useCallback(async () => {
    if (!extractedText) return
    try {
      await navigator.clipboard.writeText(extractedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: 'Copied',
        description: 'Text copied to clipboard',
      })
    } catch {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy text to clipboard',
        variant: 'destructive',
      })
    }
  }, [extractedText, toast])

  const wordCount = extractedText
    ? extractedText.trim().split(/\s+/).filter((w) => w.length > 0).length
    : 0
  const charCount = extractedText ? extractedText.length : 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
            <ArrowRightLeft className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold text-gray-800">Convert PDF</h1>
            <p className="text-xs text-gray-400">Convert PDF files to different formats</p>
          </div>
        </div>
        <button
          onClick={() => setCurrentView('home')}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-y-hidden">
        {/* Main Content */}
        <div className="p-4 md:p-6 md:flex-1 md:min-h-0 md:overflow-auto pb-4 md:pb-0">
          {!selectedFile ? (
            /* File Selection */
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to convert</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedFile(file)
                        setExtractedText(null)
                      }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-teal-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-teal-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-teal-600 truncate">
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
                  <FileText className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to convert it</p>
                </div>
              )}
            </div>
          ) : (
            /* Conversion View */
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
                        setExtractedText(null)
                      }}
                    >
                      Change File
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Extracted Text Preview */}
              {extractedText && (
                <div className="space-y-3">
                  {/* Stats Bar */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Info className="w-3.5 h-3.5" />
                      <span>{extractedPages} page{extractedPages !== 1 ? 's' : ''} extracted</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {wordCount} words
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {charCount} characters
                    </Badge>
                  </div>

                  {/* Text Preview */}
                  <Card className="border-gray-200">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                      <span className="text-xs font-medium text-gray-600">Extracted Text Preview</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                          onClick={handleCopy}
                        >
                          {copied ? (
                            <Check className="w-3.5 h-3.5 mr-1 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 mr-1" />
                          )}
                          {copied ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="max-h-96">
                      <CardContent className="p-4">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                          {extractedText}
                        </pre>
                      </CardContent>
                    </ScrollArea>
                  </Card>

                  {/* Download Button */}
                  <div className="flex items-center gap-3">
                    <Button
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download as {format.toUpperCase()}
                    </Button>
                  </div>
                </div>
              )}

              {/* Converting State */}
              {isConverting && (
                <Card className="border-gray-200">
                  <CardContent className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-3" />
                    <p className="text-sm font-medium text-gray-700">Converting PDF...</p>
                    <p className="text-xs text-gray-400 mt-1">Extracting text content from {selectedFile.name}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <div className="w-full md:w-72 bg-white border-t md:border-t-0 md:border-l border-gray-200 p-4 md:p-5 md:overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Conversion Settings</h3>

          {!selectedFile ? (
            <div className="space-y-5 opacity-50 pointer-events-none select-none">
              {/* Format Selection (disabled preview) */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Output Format</label>
                <RadioGroup
                  value={format}
                  onValueChange={(v) => setFormat(v as ConvertFormat)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="txt" id="format-txt" className="h-3.5 w-3.5" />
                    <Label htmlFor="format-txt" className="flex items-center gap-2 text-xs text-gray-600 font-normal cursor-pointer">
                      <FileType className="w-4 h-4 text-gray-400" />
                      Plain Text (.txt)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="html" id="format-html" className="h-3.5 w-3.5" />
                    <Label htmlFor="format-html" className="flex items-center gap-2 text-xs text-gray-600 font-normal cursor-pointer">
                      <FileCode className="w-4 h-4 text-gray-400" />
                      HTML (.html)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div className="flex flex-col items-center py-4 text-center">
                <ArrowRightLeft className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-medium text-gray-500">Select a file first</p>
                <p className="text-[10px] text-gray-400 mt-1">Settings will activate once a PDF is chosen</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Format Selection */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Output Format</label>
                <RadioGroup
                  value={format}
                  onValueChange={(v) => setFormat(v as ConvertFormat)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="txt" id="format-txt" className="h-3.5 w-3.5" />
                    <Label htmlFor="format-txt" className="flex items-center gap-2 text-xs text-gray-600 font-normal cursor-pointer">
                      <FileType className="w-4 h-4 text-gray-400" />
                      Plain Text (.txt)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="html" id="format-html" className="h-3.5 w-3.5" />
                    <Label htmlFor="format-html" className="flex items-center gap-2 text-xs text-gray-600 font-normal cursor-pointer">
                      <FileCode className="w-4 h-4 text-gray-400" />
                      HTML (.html)
                    </Label>
                  </div>
                </RadioGroup>
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

              {/* Convert Button */}
              <div className="space-y-2">
                <Button
                  className="w-full h-9 text-xs bg-teal-600 hover:bg-teal-700"
                  disabled={isConverting}
                  onClick={handleConvert}
                >
                  {isConverting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                      Convert to {format.toUpperCase()}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-9 text-xs"
                  onClick={() => {
                    setSelectedFile(null)
                    setExtractedText(null)
                  }}
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
            toolLabel="Convert PDF"
            isLoaded={isLoaded}
            compact
          />
        </div>
      </div>
    </div>
  )
}
