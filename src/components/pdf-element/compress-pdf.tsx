'use client'

import { useState, useCallback } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

type CompressionLevel = 'low' | 'medium' | 'high'

interface CompressionResult {
  file: PdfFile
  compression: {
    originalSize: number
    compressedSize: number
    savedBytes: number
    savedPercent: string
  }
}

export function CompressPdf() {
  const {
    recentFiles,
    compressFile,
    isCompressing,
    setCurrentView,
  } = useAppStore()

  const { toast } = useToast()

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium')
  const [result, setResult] = useState<CompressionResult | null>(null)

  const handleCompress = useCallback(async () => {
    if (!selectedFile) return

    setResult(null)
    const response = await compressFile(selectedFile.id)

    if (response) {
      setResult(response)
      toast({
        title: 'Compression Complete',
        description: `Saved ${response.compression.savedPercent}% — ${formatFileSize(response.compression.savedBytes)} reduced`,
      })
    } else {
      toast({
        title: 'Compression Failed',
        description: 'Failed to compress the PDF file. Please try again.',
        variant: 'destructive',
      })
    }
  }, [selectedFile, compressFile, toast])

  const handleDownload = useCallback(() => {
    if (!result) return
    // Trigger download of the compressed file
    const a = document.createElement('a')
    a.href = `/api/files/${result.file.id}/download`
    a.download = result.file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    toast({
      title: 'Download Started',
      description: `Downloading ${result.file.name}`,
    })
  }, [result, toast])

  const savedPercentNum = result
    ? parseFloat(result.compression.savedPercent)
    : 0

  const compressionRatio = result
    ? (result.compression.compressedSize / result.compression.originalSize) * 100
    : 100

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
            <FileDown className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Compress PDF</h1>
            <p className="text-xs text-gray-400">Reduce PDF file size for easier sharing</p>
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
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to compress</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedFile(file)
                        setResult(null)
                      }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-green-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-green-600 truncate">
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
                  <FileDown className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to compress it</p>
                </div>
              )}
            </div>
          ) : (
            /* Compression View */
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
                          Current size: {formatFileSize(selectedFile.size)} · {selectedFile.pages} page{selectedFile.pages !== 1 ? 's' : ''}
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

              {/* Compression Result */}
              {result && (
                <div className="space-y-4">
                  {/* Success Banner */}
                  <Card className="border-green-200 bg-green-50/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-green-800">Compression Successful</p>
                          <p className="text-xs text-green-600 mt-0.5">
                            Reduced by {result.compression.savedPercent}% — saved {formatFileSize(result.compression.savedBytes)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Size Comparison */}
                  <Card className="border-gray-200">
                    <CardContent className="p-5 space-y-4">
                      <h4 className="text-sm font-medium text-gray-700">Size Comparison</h4>

                      {/* Original */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Original Size</span>
                          <span className="font-medium text-gray-700">{formatFileSize(result.compression.originalSize)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full bg-gray-300 rounded-full transition-all duration-500"
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>

                      {/* Compressed */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Compressed Size</span>
                          <span className="font-medium text-green-600">{formatFileSize(result.compression.compressedSize)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${compressionRatio}%` }}
                          />
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

                  {/* Download Button */}
                  <div className="flex items-center gap-3">
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Compressed PDF
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        setSelectedFile(null)
                        setResult(null)
                      }}
                    >
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
                      <Progress value={45} className="h-1.5" />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <div className="w-72 bg-white border-l border-gray-200 p-5 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Compression Settings</h3>

          <div className="space-y-5">
            {/* Compression Level */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Compression Level</label>
              <RadioGroup
                value={compressionLevel}
                onValueChange={(v) => setCompressionLevel(v as CompressionLevel)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="low" id="level-low" className="h-3.5 w-3.5" />
                  <Label htmlFor="level-low" className="text-xs text-gray-600 font-normal cursor-pointer">
                    Low — Best quality
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="level-medium" className="h-3.5 w-3.5" />
                  <Label htmlFor="level-medium" className="text-xs text-gray-600 font-normal cursor-pointer">
                    Medium — Recommended
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="high" id="level-high" className="h-3.5 w-3.5" />
                  <Label htmlFor="level-high" className="text-xs text-gray-600 font-normal cursor-pointer">
                    High — Smallest size
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Compression Details */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">What Gets Compressed</label>
              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-green-500" />
                  <span>Image resolution & quality</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-green-500" />
                  <span>Font subsetting</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-green-500" />
                  <span>Duplicate object removal</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-green-500" />
                  <span>Metadata cleanup</span>
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
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <FileDown className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">Select a file to view its information</p>
              </div>
            )}

            {selectedFile && (
              <>
                <Separator />

                {/* Compress Button */}
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
