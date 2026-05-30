'use client'

import { useAppStore, PDFFile } from '@/store/app-store'
import {
  Search,
  List,
  LayoutGrid,
  RefreshCw,
  Star,
  Share2,
  MoreHorizontal,
  FileText,
  FolderOpen,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function RecentFiles() {
  const {
    recentFiles,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    setCurrentView,
    setSelectedPdfFile,
    toggleFileSelection,
    selectedFiles,
  } = useAppStore()

  const [hoveredFile, setHoveredFile] = useState<string | null>(null)

  const filteredFiles = recentFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleFileClick = (file: PDFFile) => {
    setSelectedPdfFile(file)
    setCurrentView('pdf-viewer')
  }

  const starredFiles = filteredFiles.filter((f) => f.starred)
  const unstarredFiles = filteredFiles.filter((f) => !f.starred)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">Recent Files</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 w-48 text-xs bg-white border-gray-200"
            />
          </div>
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'grid' ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'list' ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <List className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[auto_1fr_140px_80px_80px] gap-4 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500">
            <div className="w-5" />
            <div>Name</div>
            <div>Modified Time</div>
            <div>Size</div>
            <div>Actions</div>
          </div>
          {/* File Rows */}
          <div className="divide-y divide-gray-50">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className={cn(
                  'grid grid-cols-[auto_1fr_140px_80px_80px] gap-4 px-4 py-2.5 items-center cursor-pointer transition-colors',
                  hoveredFile === file.id ? 'bg-blue-50/50' : 'hover:bg-gray-50',
                  selectedFiles.includes(file.id) && 'bg-blue-50'
                )}
                onMouseEnter={() => setHoveredFile(file.id)}
                onMouseLeave={() => setHoveredFile(null)}
                onClick={() => handleFileClick(file)}
              >
                <div className="w-5 flex justify-center">
                  <div className="w-6 h-7 bg-[#4A90D9] rounded-sm flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-800 truncate">{file.name}</span>
                  {file.starred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                </div>
                <div className="text-xs text-gray-400">{file.modifiedTime}</div>
                <div className="text-xs text-gray-400">{file.size}</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFileSelection(file.id)
                    }}
                    className={cn(
                      'p-1 rounded transition-colors',
                      file.starred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'
                    )}
                  >
                    <Star className="w-3.5 h-3.5" fill={file.starred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="bg-white rounded-lg border border-gray-100 p-3 cursor-pointer hover:border-[#4A90D9] hover:shadow-sm transition-all group"
              onClick={() => handleFileClick(file)}
            >
              <div className="w-full aspect-[3/4] bg-gray-50 rounded-md mb-2 flex items-center justify-center">
                <div className="flex flex-col items-center gap-1">
                  <FileText className="w-8 h-8 text-[#4A90D9]" />
                  <span className="text-[10px] text-gray-400">{file.pages} pages</span>
                </div>
              </div>
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-800 truncate">{file.name}</div>
                  <div className="text-[10px] text-gray-400">{file.size} · {file.modifiedTime}</div>
                </div>
                {file.starred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0 mt-0.5" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <FolderOpen className="w-12 h-12 mb-3" />
          <p className="text-sm">No files found</p>
        </div>
      )}
    </div>
  )
}
