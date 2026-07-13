'use client'

import { useState, useCallback } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  Trash2,
  Loader2,
  Download,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

interface DeleteBlankResult {
  file: PdfFile
  deletedPages: number
}

export function DeleteBlankPdf() {
  const {
    recentFiles,
    deleteBlankFile,
    isDeleteBlanking,
    setCurrentView,
  } = useAppStore()

  const { toast } = useToast()

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [threshold, setThreshold] = useState(5)
  const [result, setResult] = useState<DeleteBlankResult | null>(null)

  const handleDeleteBlank = useCallback(async () => {
    if (!selectedFile) return

    setResult(null)
    const response = await deleteBlankFile(selectedFile.id, { threshold })

    if (response) {
      setResult(response)
      toast({
        title: 'Blank Pages Deleted',
        description: `${response.deletedPages} blank page${response.deletedPages !== 1 ? 's' : ''} removed from ${selectedFile.name}`,
      })
    } else {
      toast({
        title: 'Delete Blank Pages Failed',
        description: 'Failed to process the PDF file. Please try again.',
        variant: 'destructive',
      })
    }
  }, [selectedFile, threshold, deleteBlankFile, toast])

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
        toast({
          title: 'Download Failed',
          description: 'Failed to download the file',
          variant: 'destructive',
        })
      })

    toast({
      title: 'Download Started',
      description: `Downloading ${result.file.name}`,
    })
  }, [result, toast])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Delete Blank Pages</h1>
            <p className="text-xs text-gray-400">Automatically detect and remove blank PDF pages</p>
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
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to remove blank pages</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedFile(file)
                        setResult(null)
                      }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-slate-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-slate-600 truncate">
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
                  <Trash2 className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to remove blank pages</p>
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
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-slate-600" />
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

              {/* Warning about threshold */}
              {!result && !isDeleteBlanking && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-amber-800">About Blank Page Detection</p>
                        <p className="text-[11px] text-amber-600 mt-1">
                          Blank pages are detected based on the threshold you set. A lower threshold is more aggressive (detects more pages as blank),
                          while a higher threshold is more conservative (only detects pages with very little content).
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Result */}
              {result && (
                <div className="space-y-4">
                  <Card className="border-slate-200 bg-slate-50/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-slate-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">Blank Pages Removed</p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {result.deletedPages} blank page{result.deletedPages !== 1 ? 's' : ''} deleted from {selectedFile.pages} total pages
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-gray-200">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Output File</span>
                        <span className="font-medium text-gray-700">{result.file.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Original Pages</span>
                        <span className="text-gray-700">{selectedFile.pages}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Pages Deleted</span>
                        <Badge variant="secondary" className="text-[10px] h-5">{result.deletedPages} blank</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Remaining Pages</span>
                        <span className="font-medium text-slate-600">{result.file.pages}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">File Size</span>
                        <span className="text-gray-700">{formatFileSize(result.file.size)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-center gap-3">
                    <Button
                      className="bg-slate-700 hover:bg-slate-800 text-white"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Cleaned PDF
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        setSelectedFile(null)
                        setResult(null)
                      }}
                    >
                      Clean Another File
                    </Button>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isDeleteBlanking && !result && (
                <Card className="border-gray-200">
                  <CardContent className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-slate-600 animate-spin mb-3" />
                    <p className="text-sm font-medium text-gray-700">Detecting Blank Pages...</p>
                    <p className="text-xs text-gray-400 mt-1">Scanning {selectedFile.name}</p>
                    <div className="w-48 mt-4">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">This may take a moment...</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <div className="w-72 bg-white border-l border-gray-200 p-5 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Detection Settings</h3>

          <div className="space-y-5">
            {/* Threshold */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium text-gray-600">Blankness Threshold</Label>
                <span className="text-xs text-gray-500">{threshold}%</span>
              </div>
              <Slider
                value={[threshold]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setThreshold(v)}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-400">More aggressive</span>
                <span className="text-[10px] text-gray-400">More conservative</span>
              </div>
            </div>

            <Separator />

            {/* How it works */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">How It Works</Label>
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] text-slate-500">1</span>
                  </div>
                  <span>Scans each page for content density</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] text-slate-500">2</span>
                  </div>
                  <span>Compares against the blankness threshold</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] text-slate-500">3</span>
                  </div>
                  <span>Removes pages below the threshold</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Threshold Guide */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">Threshold Guide</Label>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between p-1.5 bg-red-50 rounded">
                  <span className="text-red-700">0–10%</span>
                  <span className="text-red-600">Very aggressive</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-amber-50 rounded">
                  <span className="text-amber-700">11–30%</span>
                  <span className="text-amber-600">Moderate</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-green-50 rounded">
                  <span className="text-green-700">31–60%</span>
                  <span className="text-green-600">Conservative</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-blue-50 rounded">
                  <span className="text-blue-700">61–100%</span>
                  <span className="text-blue-600">Very conservative</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* File Info or Placeholder */}
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
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <Trash2 className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">Select a file to view its information</p>
              </div>
            )}

            {selectedFile && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Button
                    className="w-full h-9 text-xs bg-slate-700 hover:bg-slate-800"
                    disabled={isDeleteBlanking}
                    onClick={handleDeleteBlank}
                  >
                    {isDeleteBlanking ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Detecting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Delete Blank Pages
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
