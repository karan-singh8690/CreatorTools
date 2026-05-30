'use client'

import { useAppStore, formatFileSize, formatDate } from '@/store/app-store'
import {
  Plus,
  Trash2,
  X,
  FileText,
  Printer,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { useState, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'

export function BatchPrint() {
  const {
    recentFiles,
    printFiles,
    addPrintFile,
    removePrintFile,
    setCurrentView,
  } = useAppStore()

  const { toast } = useToast()
  const [isPrinting, setIsPrinting] = useState(false)
  const [printedFiles, setPrintedFiles] = useState<Set<string>>(new Set())
  const printIframeRef = useRef<HTMLIFrameElement | null>(null)

  const availableFiles = recentFiles.filter(
    (f) => !printFiles.find((pf) => pf.id === f.id)
  )

  const handleBatchPrint = async () => {
    if (printFiles.length === 0) return

    setIsPrinting(true)
    setPrintedFiles(new Set())

    for (const file of printFiles) {
      try {
        const pdfUrl = `/api/files/${file.id}/download`

        // Remove existing iframe if any
        if (printIframeRef.current && printIframeRef.current.parentNode) {
          printIframeRef.current.parentNode.removeChild(printIframeRef.current)
        }

        // Create a hidden iframe to print each file
        const iframe = document.createElement('iframe')
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = 'none'
        iframe.style.overflow = 'hidden'

        await new Promise<void>((resolve, reject) => {
          iframe.onload = () => {
            try {
              iframe.contentWindow?.focus()
              iframe.contentWindow?.print()
              setPrintedFiles((prev) => new Set([...prev, file.id]))
              resolve()
            } catch (err) {
              // Fallback: open in new tab
              window.open(pdfUrl, '_blank')
              setPrintedFiles((prev) => new Set([...prev, file.id]))
              resolve()
            }
          }
          iframe.onerror = () => reject(new Error(`Failed to load ${file.name}`))
          iframe.src = pdfUrl
          document.body.appendChild(iframe)
          printIframeRef.current = iframe

          // Timeout after 5 seconds per file
          setTimeout(() => resolve(), 5000)
        })

        // Small delay between files
        await new Promise((r) => setTimeout(r, 1000))
      } catch (err) {
        console.error(`Print error for ${file.name}:`, err)
        toast({
          title: 'Print Error',
          description: `Failed to print ${file.name}`,
          variant: 'destructive',
        })
      }
    }

    setIsPrinting(false)
    toast({
      title: 'Batch Print Complete',
      description: `Printed ${printFiles.length} file${printFiles.length !== 1 ? 's' : ''}`,
    })

    // Cleanup iframe
    if (printIframeRef.current && printIframeRef.current.parentNode) {
      printIframeRef.current.parentNode.removeChild(printIframeRef.current)
      printIframeRef.current = null
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
            <Printer className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Batch PDFs</h1>
            <p className="text-xs text-gray-400">Batch convert, create, print, OCR, etc.</p>
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
        {/* File List */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50"
              onClick={() => {
                // Add all available files at once
                availableFiles.forEach((f) => addPrintFile(f))
              }}
              disabled={availableFiles.length === 0}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add All Files
            </Button>
            {printFiles.length > 0 && (
              <span className="text-xs text-gray-400">
                {printFiles.length} file{printFiles.length !== 1 ? 's' : ''} queued
              </span>
            )}
          </div>

          {/* Files Table */}
          {printFiles.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[50px_1fr_100px_100px_80px_50px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
                <div>No.</div>
                <div>Name</div>
                <div>Size</div>
                <div>Pages</div>
                <div>Status</div>
                <div>Action</div>
              </div>
              {printFiles.map((file, index) => (
                <div
                  key={file.id}
                  className="grid grid-cols-[50px_1fr_100px_100px_80px_50px] gap-2 px-4 py-3 border-b border-gray-50 items-center hover:bg-gray-50 transition-colors"
                >
                  <div className="text-xs text-gray-500">{index + 1}</div>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm text-gray-800 truncate">{file.name}</span>
                  </div>
                  <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                  <div className="text-xs text-gray-500">{file.pages} pg</div>
                  <div className="flex items-center gap-1">
                    {printedFiles.has(file.id) ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Done
                      </span>
                    ) : isPrinting ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Printing
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Ready</span>
                    )}
                  </div>
                  <button
                    onClick={() => removePrintFile(file.id)}
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    disabled={isPrinting}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
              <Printer className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-sm mb-3">No files added for printing</p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-emerald-600 border-emerald-300"
                onClick={() => {
                  if (availableFiles.length > 0) {
                    addPrintFile(availableFiles[0])
                  }
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add File
              </Button>
            </div>
          )}

          {/* Available Files to Add */}
          {availableFiles.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-600 mb-3">Available Files</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableFiles.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => addPrintFile(file)}
                    className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-gray-100 hover:border-emerald-400 hover:shadow-sm transition-all text-left"
                  >
                    <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-700 truncate">{file.name}</div>
                      <div className="text-[10px] text-gray-400">{formatFileSize(file.size)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Print Settings Panel */}
        <div className="w-72 bg-white border-l border-gray-200 p-5 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Print Settings</h3>

          <div className="space-y-5">
            {/* Printer */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Printer</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-600 bg-gray-50">
                System Default Printer
              </div>
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="gray-print" />
                  <Label htmlFor="gray-print" className="text-xs text-gray-600 font-normal">
                    Grayscale printing
                  </Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Print Settings */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Paper Size</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-600 bg-gray-50 mb-2">
                A4 21 × 29.7 cm
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="source-size" />
                  <Label htmlFor="source-size" className="text-xs text-gray-600 font-normal">
                    Use page size of source file
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="print-image" />
                  <Label htmlFor="print-image" className="text-xs text-gray-600 font-normal">
                    Print as image
                  </Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Page Range */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Page Range</label>
              <RadioGroup defaultValue="all" className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all-pages" className="h-3.5 w-3.5" />
                  <Label htmlFor="all-pages" className="text-xs text-gray-600 font-normal">All pages</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom-pages" className="h-3.5 w-3.5" />
                  <Label htmlFor="custom-pages" className="text-xs text-gray-600 font-normal">Custom range</Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Print Summary */}
            {printFiles.length > 0 && (
              <Card className="border-gray-200 bg-gray-50">
                <CardContent className="p-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Files</span>
                      <span className="font-medium text-gray-700">{printFiles.length}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Total Pages</span>
                      <span className="font-medium text-gray-700">
                        {printFiles.reduce((sum, f) => sum + f.pages, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Total Size</span>
                      <span className="font-medium text-gray-700">
                        {formatFileSize(printFiles.reduce((sum, f) => sum + f.size, 0))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                className="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-700"
                disabled={printFiles.length === 0 || isPrinting}
                onClick={handleBatchPrint}
              >
                {isPrinting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Printing...
                  </>
                ) : (
                  <>
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    Print {printFiles.length} File{printFiles.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full h-9 text-xs"
                onClick={() => setCurrentView('home')}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
