'use client'

import { useAppStore } from '@/store/app-store'
import {
  Plus,
  Trash2,
  FolderOpen,
  X,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'

export function CombineFiles() {
  const {
    recentFiles,
    combineFiles,
    addCombineFile,
    removeCombineFile,
    setCurrentView,
  } = useAppStore()

  const availableFiles = recentFiles.filter(
    (f) => !combineFiles.find((cf) => cf.id === f.id)
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Combine Files</h1>
          <p className="text-xs text-gray-400">Combine multiple files into a single PDF</p>
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
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-[#4A90D9] border-[#4A90D9] hover:bg-blue-50"
                onClick={() => {
                  if (availableFiles.length > 0) {
                    addCombineFile(availableFiles[0])
                  }
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add File
              </Button>
              <div className="flex items-center gap-2">
                <Checkbox id="add-toc" />
                <Label htmlFor="add-toc" className="text-xs text-gray-600 font-normal">
                  Add a new table of the content page generated from bookmarks
                </Label>
              </div>
            </div>
          </div>

          {/* Files Table */}
          {combineFiles.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[50px_1fr_100px_100px_140px_50px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
                <div>No.</div>
                <div>Name</div>
                <div>Page Count</div>
                <div>Page Range</div>
                <div>Modified Time</div>
                <div>Action</div>
              </div>
              {combineFiles.map((file, index) => (
                <div
                  key={file.id}
                  className="grid grid-cols-[50px_1fr_100px_100px_140px_50px] gap-2 px-4 py-3 border-b border-gray-50 items-center hover:bg-gray-50 transition-colors"
                >
                  <div className="text-xs text-gray-500">{index + 1}</div>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-[#4A90D9] shrink-0" />
                    <span className="text-sm text-gray-800 truncate">{file.name}</span>
                  </div>
                  <div className="text-xs text-gray-500">{file.pages}</div>
                  <div className="text-xs text-gray-500">All</div>
                  <div className="text-xs text-gray-400">{file.modifiedTime}</div>
                  <button
                    onClick={() => removeCombineFile(file.id)}
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
              <FileText className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-sm mb-3">No files added yet</p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-[#4A90D9] border-[#4A90D9]"
                onClick={() => {
                  if (availableFiles.length > 0) {
                    addCombineFile(availableFiles[0])
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
                    onClick={() => addCombineFile(file)}
                    className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-gray-100 hover:border-[#4A90D9] hover:shadow-sm transition-all text-left"
                  >
                    <FileText className="w-4 h-4 text-[#4A90D9] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-700 truncate">{file.name}</div>
                      <div className="text-[10px] text-gray-400">{file.size}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <div className="w-72 bg-white border-l border-gray-200 p-5 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Settings</h3>

          <div className="space-y-5">
            {/* Output Folder */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Output Folder</label>
              <div className="flex gap-2">
                <Input
                  value="~/Desktop/PDFelement/Combine"
                  readOnly
                  className="text-xs h-8"
                />
                <Button variant="outline" size="sm" className="h-8 px-2 shrink-0">
                  <FolderOpen className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Page Size */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Page Size</label>
              <RadioGroup defaultValue="keep" className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="keep" id="keep-size" className="h-3.5 w-3.5" />
                  <Label htmlFor="keep-size" className="text-xs text-gray-600 font-normal">
                    Keep Original Page Size
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="merge" id="merge-size" className="h-3.5 w-3.5" />
                  <Label htmlFor="merge-size" className="text-xs text-gray-600 font-normal">
                    Merge page size
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Bookmarks */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Bookmarks</label>
              <RadioGroup defaultValue="keep-bookmarks" className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="keep-bookmarks" id="keep-bm" className="h-3.5 w-3.5" />
                  <Label htmlFor="keep-bm" className="text-xs text-gray-600 font-normal">
                    Keep bookmarks
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no-bookmarks" id="no-bm" className="h-3.5 w-3.5" />
                  <Label htmlFor="no-bm" className="text-xs text-gray-600 font-normal">
                    Do not keep bookmarks
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="one-level" id="one-level" className="h-3.5 w-3.5" />
                  <Label htmlFor="one-level" className="text-xs text-gray-600 font-normal">
                    Retain only one level of bookmarks (like names)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button variant="outline" className="w-full h-9 text-xs">
                Preview
              </Button>
              <Button
                className="w-full h-9 text-xs bg-[#4A90D9] hover:bg-[#3A7BC8]"
                disabled={combineFiles.length === 0}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
