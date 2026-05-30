'use client'

import { useAppStore, PdfFile, formatFileSize, formatDate } from '@/store/app-store'
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
  Trash2,
  Pencil,
  Loader2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function RecentFiles() {
  const {
    recentFiles,
    isLoadingFiles,
    fetchFiles,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    setCurrentView,
    setSelectedPdfFile,
    toggleStar,
    deleteFile,
    renameFile,
  } = useAppStore()

  const [hoveredFile, setHoveredFile] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PdfFile | null>(null)
  const [renameTarget, setRenameTarget] = useState<PdfFile | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'starred'>('all')

  // Fetch files on mount
  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const filteredFiles = recentFiles.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = sidebarFilter === 'all' || file.starred
    return matchesSearch && matchesFilter
  })

  const handleFileClick = (file: PdfFile) => {
    setSelectedPdfFile(file)
    setCurrentView('pdf-viewer')
  }

  const handleRefresh = () => {
    fetchFiles()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteFile(deleteTarget.id)
    setDeleteTarget(null)
  }

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return
    await renameFile(renameTarget.id, renameValue.trim())
    setRenameTarget(null)
    setRenameValue('')
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-800">Recent Files</h2>
          {isLoadingFiles && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
        </div>
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
          <button
            onClick={handleRefresh}
            className={cn(
              'p-1.5 rounded text-gray-400 hover:text-gray-600 transition-colors',
              isLoadingFiles && 'animate-spin'
            )}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={() => setSidebarFilter('all')}
          className={cn(
            'px-3 py-1 text-xs rounded-full transition-colors',
            sidebarFilter === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          )}
        >
          All Files
        </button>
        <button
          onClick={() => setSidebarFilter('starred')}
          className={cn(
            'px-3 py-1 text-xs rounded-full transition-colors',
            sidebarFilter === 'starred'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          )}
        >
          <Star className="w-3 h-3 inline-block mr-1" />
          Starred
        </button>
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
                  hoveredFile === file.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'
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
                <div className="text-xs text-gray-400">{formatDate(file.updatedAt)}</div>
                <div className="text-xs text-gray-400">{formatFileSize(file.size)}</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleStar(file.id)
                    }}
                    className={cn(
                      'p-1 rounded transition-colors',
                      file.starred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'
                    )}
                  >
                    <Star className="w-3.5 h-3.5" fill={file.starred ? 'currentColor' : 'none'} />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded text-gray-300 hover:text-gray-500 transition-colors"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => { setRenameTarget(file); setRenameValue(file.name) }}>
                        <Pencil className="w-3.5 h-3.5 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStar(file.id)}>
                        <Star className="w-3.5 h-3.5 mr-2" />
                        {file.starred ? 'Unstar' : 'Star'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => setDeleteTarget(file)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                  <div className="text-[10px] text-gray-400">{formatFileSize(file.size)} · {formatDate(file.updatedAt)}</div>
                </div>
                {file.starred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0 mt-0.5" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredFiles.length === 0 && !isLoadingFiles && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <FolderOpen className="w-12 h-12 mb-3" />
          <p className="text-sm">No files found</p>
          <p className="text-xs text-gray-300 mt-1">Upload a PDF to get started</p>
        </div>
      )}

      {isLoadingFiles && recentFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <p className="text-sm">Loading files...</p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) { setRenameTarget(null); setRenameValue('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Enter new name"
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenameTarget(null); setRenameValue('') }}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
