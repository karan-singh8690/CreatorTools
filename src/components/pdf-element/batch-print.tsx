'use client'

import { useAppStore, formatFileSize } from '@/store/app-store'
import {
  Plus,
  Trash2,
  X,
  FileText,
  Printer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'

export function BatchPrint() {
  const {
    recentFiles,
    printFiles,
    addPrintFile,
    removePrintFile,
    setCurrentView,
  } = useAppStore()

  const availableFiles = recentFiles.filter(
    (f) => !printFiles.find((pf) => pf.id === f.id)
  )

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
              className="text-xs text-[#4A90D9] border-[#4A90D9] hover:bg-blue-50"
              onClick={() => {
                if (availableFiles.length > 0) {
                  addPrintFile(availableFiles[0])
                }
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add file
            </Button>
          </div>

          {/* Files Table */}
          {printFiles.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[50px_1fr_100px_100px_50px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
                <div>No.</div>
                <div>Name</div>
                <div>Size</div>
                <div>Status</div>
                <div>Action</div>
              </div>
              {printFiles.map((file, index) => (
                <div
                  key={file.id}
                  className="grid grid-cols-[50px_1fr_100px_100px_50px] gap-2 px-4 py-3 border-b border-gray-50 items-center hover:bg-gray-50 transition-colors"
                >
                  <div className="text-xs text-gray-500">{index + 1}</div>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-[#4A90D9] shrink-0" />
                    <span className="text-sm text-gray-800 truncate">{file.name}</span>
                  </div>
                  <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                  <div className="text-xs text-gray-400">Ready</div>
                  <button
                    onClick={() => removePrintFile(file.id)}
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
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
                className="text-xs text-[#4A90D9] border-[#4A90D9]"
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
                    className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-gray-100 hover:border-[#4A90D9] hover:shadow-sm transition-all text-left"
                  >
                    <FileText className="w-4 h-4 text-[#4A90D9] shrink-0" />
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
                PDFelement Printer
              </div>
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="gray-print" />
                  <Label htmlFor="gray-print" className="text-xs text-gray-600 font-normal">
                    Gray print
                  </Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Print Settings */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Print Settings</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-600 bg-gray-50 mb-2">
                A4 21 × 29.7 cm
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="source-size" />
                  <Label htmlFor="source-size" className="text-xs text-gray-600 font-normal">
                    The page size of the source file
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

            {/* Orientation */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Orientation</label>
              <button className="text-xs text-[#4A90D9] hover:underline">
                Hide Advanced Settings
              </button>
            </div>

            <Separator />

            {/* Print Content */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Print Content</label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="doc-content" defaultChecked />
                  <Label htmlFor="doc-content" className="text-xs text-gray-600 font-normal">
                    Document
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="comment-content" defaultChecked />
                  <Label htmlFor="comment-content" className="text-xs text-gray-600 font-normal">
                    Comment
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="form-content" defaultChecked />
                  <Label htmlFor="form-content" className="text-xs text-gray-600 font-normal">
                    Form
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
                  <Label htmlFor="custom-pages" className="text-xs text-gray-600 font-normal">Custom</Label>
                </div>
              </RadioGroup>
            </div>

            <Button
              className="w-full h-9 text-xs bg-gray-800 hover:bg-gray-700 mt-2"
              disabled={printFiles.length === 0}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
