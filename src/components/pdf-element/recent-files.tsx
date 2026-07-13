'use client'

import { useAppStore, PdfFile, formatFileSize, formatDate } from '@/store/app-store'
import { shouldConfirmDelete, shouldNotify, playNotificationSound } from '@/hooks/use-settings'
import {
  Search,
  List,
  LayoutGrid,
  RefreshCw,
  Star,
  MoreHorizontal,
  FileText,
  FolderOpen,
  Trash2,
  Pencil,
  Loader2,
  X,
  Download,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useState, useEffect, useCallback } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

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
    fileFilter,
    setFileFilter,
  } = useAppStore()

  const [hoveredFile, setHoveredFile] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PdfFile | null>(null)
  const [renameTarget, setRenameTarget] = useState<PdfFile | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [showClearAll, setShowClearAll] = useState(false)
  const [isClearingAll, setIsClearingAll] = useState(false)

  // Fetch files on mount
  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const filteredFiles = recentFiles.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = fileFilter === 'all' || file.starred
    return matchesSearch && matchesFilter
  })

  const handleFileClick = (file: PdfFile) => {
    setSelectedPdfFile(file)
    setCurrentView('pdf-viewer')
  }

  const handleRefresh = () => {
    fetchFiles()
  }

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) return
    const fileId = deleteTarget.id
    const fileName = deleteTarget.name
    setIsDeleting(true)
    try {
      await deleteFile(fileId)
      setDeleteTarget(null)
      if (shouldNotify('process')) {
        playNotificationSound()
        toast.success(`"${fileName}" deleted`)
      }
    } catch {
      if (shouldNotify('error')) {
        playNotificationSound()
        toast.error('Failed to delete file')
      }
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, isDeleting, deleteFile])

  /** Request delete — if confirmation is disabled, delete immediately */
  const requestDelete = useCallback((file: PdfFile) => {
    if (shouldConfirmDelete()) {
      setDeleteTarget(file)
    } else {
      // Delete immediately without confirmation
      setIsDeleting(true)
      deleteFile(file.id)
        .then(() => {
          if (shouldNotify('process')) {
            playNotificationSound()
            toast.success(`"${file.name}" deleted`)
          }
        })
        .catch(() => {
          if (shouldNotify('error')) {
            playNotificationSound()
            toast.error('Failed to delete file')
          }
        })
        .finally(() => setIsDeleting(false))
    }
  }, [deleteFile])

  const handleRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim() || isRenaming) return
    setIsRenaming(true)
    try {
      await renameFile(renameTarget.id, renameValue.trim())
      setRenameTarget(null)
      setRenameValue('')
      toast.success('File renamed')
    } catch {
      toast.error('Failed to rename file')
    } finally {
      setIsRenaming(false)
    }
  }, [renameTarget, renameValue, isRenaming, renameFile])

  const handleClearAll = useCallback(async () => {
    if (isClearingAll) return
    setIsClearingAll(true)
    try {
      const response = await fetch('/api/files', { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to clear files')
      await fetchFiles()
      setShowClearAll(false)
      toast.success('All files cleared')
    } catch {
      toast.error('Failed to clear all files')
    } finally {
      setIsClearingAll(false)
    }
  }, [isClearingAll, fetchFiles])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <h2 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">Recent Files</h2>
          {isLoadingFiles && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          {recentFiles.length > 0 && (
            <span className="text-xs text-gray-400">({recentFiles.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 w-full sm:w-48 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            />
          </div>
          {recentFiles.length > 0 && (
            <button
              onClick={() => setShowClearAll(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Clear all files"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">Clear All</span>
            </button>
          )}
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
              'p-1.5 rounded transition-colors hidden sm:block',
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
          onClick={() => setFileFilter('all')}
          className={cn(
            'px-3 py-1 text-xs rounded-full transition-colors',
            fileFilter === 'all'
              ? 'bg-gray-800 dark:bg-gray-700 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          )}
        >
          All Files
        </button>
        <button
          onClick={() => setFileFilter('starred')}
          className={cn(
            'px-3 py-1 text-xs rounded-full transition-colors',
            fileFilter === 'starred'
              ? 'bg-gray-800 dark:bg-gray-700 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          )}
        >
          <Star className="w-3 h-3 inline-block mr-1" />
          Starred
        </button>
      </div>

      {/* ─── Mobile Card List ──────────────────────────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {filteredFiles.map((file) => (
          <div
            key={file.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 flex items-center gap-3 cursor-pointer hover:border-[#4A90D9] active:bg-gray-50 dark:active:bg-gray-700 transition-all"
            onClick={() => handleFileClick(file)}
          >
            <div className="w-9 h-10 bg-[#4A90D9] rounded-md flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-800 dark:text-gray-100 truncate font-medium">{file.name}</span>
                {file.starred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {formatFileSize(file.size)} · {formatDate(file.updatedAt)} · {file.pages} pages
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); toggleStar(file.id) }}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  file.starred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'
                )}
                title={file.starred ? 'Unstar' : 'Star'}
              >
                <Star className="w-4 h-4" fill={file.starred ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); requestDelete(file) }}
                className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Desktop List View ───────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_140px_80px_100px] gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
            <div className="w-5" />
            <div>Name</div>
            <div>Modified Time</div>
            <div>Size</div>
            <div>Actions</div>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className={cn(
                  'grid grid-cols-[auto_1fr_140px_80px_100px] gap-4 px-4 py-2.5 items-center cursor-pointer transition-colors',
                  hoveredFile === file.id ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
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
                  <span className="text-sm text-gray-800 dark:text-gray-100 truncate">{file.name}</span>
                  {file.starred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                </div>
                <div className="text-xs text-gray-400">{formatDate(file.updatedAt)}</div>
                <div className="text-xs text-gray-400">{formatFileSize(file.size)}</div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleStar(file.id) }}
                    className={cn('p-1.5 rounded transition-colors', file.starred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500')}
                    title={file.starred ? 'Unstar' : 'Star'}
                  >
                    <Star className="w-3.5 h-3.5" fill={file.starred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); requestDelete(file) }}
                    className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded text-gray-300 hover:text-gray-500 transition-colors" title="More options">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameTarget(file); setRenameValue(file.name) }}>
                        <Pencil className="w-3.5 h-3.5 mr-2" />Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleStar(file.id) }}>
                        <Star className="w-3.5 h-3.5 mr-2" />{file.starred ? 'Unstar' : 'Star'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); requestDelete(file) }}>
                        <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Desktop Grid View ───────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className="hidden sm:grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-3 cursor-pointer hover:border-[#4A90D9] hover:shadow-sm transition-all group relative"
              onClick={() => handleFileClick(file)}
            >
              {/* Action buttons - visible on hover */}
              <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleStar(file.id)
                  }}
                  className={cn(
                    'p-1 rounded bg-white/90 dark:bg-gray-700/90 shadow-sm border border-gray-100 dark:border-gray-600 transition-colors',
                    file.starred ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
                  )}
                  title={file.starred ? 'Unstar' : 'Star'}
                >
                  <Star className="w-3 h-3" fill={file.starred ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    requestDelete(file)
                  }}
                  className="p-1 rounded bg-white/90 dark:bg-gray-700/90 shadow-sm border border-gray-100 dark:border-gray-600 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="w-full aspect-[3/4] bg-gray-50 dark:bg-gray-700/50 rounded-md mb-2 flex items-center justify-center">
                <div className="flex flex-col items-center gap-1">
                  <FileText className="w-8 h-8 text-[#4A90D9]" />
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">{file.pages} pages</span>
                </div>
              </div>
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{file.name}</div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">{formatFileSize(file.size)} · {formatDate(file.updatedAt)}</div>
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

      {/* Delete confirmation dialog - Using Dialog instead of AlertDialog for more control */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open && !isRenaming) { setRenameTarget(null); setRenameValue('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Enter new name"
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename() }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenameTarget(null); setRenameValue('') }} disabled={isRenaming}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!renameValue.trim() || isRenaming}>
              {isRenaming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Renaming...
                </>
              ) : (
                'Rename'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Files confirmation dialog */}
      <Dialog open={showClearAll} onOpenChange={(open) => { if (!open && !isClearingAll) setShowClearAll(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Files</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all {recentFiles.length} files? This action cannot be undone and will free up storage space.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearAll(false)} disabled={isClearingAll}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={isClearingAll}
            >
              {isClearingAll ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Files
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
