'use client'

import { useRef, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import {
  FolderOpen,
  FilePlus,
  Clock,
  Star,
  Folder,
  Cloud,
  FileText,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

const sidebarItems = [
  { id: 'open-pdf', label: 'Open PDF', icon: FolderOpen, type: 'button-primary' as const },
  { id: 'create-pdf', label: 'Create PDF', icon: FilePlus, type: 'button-secondary' as const },
]

const recentItems = [
  { id: 'recent-files', label: 'Recent Files', icon: Clock },
  { id: 'starred-files', label: 'Starred Files', icon: Star },
  { id: 'recent-folders', label: 'Recent Folders', icon: Folder },
]

const otherItems = [
  { id: 'cloud', label: 'PDFelement Cloud', icon: Cloud },
  { id: 'agreement', label: 'Agreement', icon: FileText },
]

export function AppSidebar() {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    activeSidebarItem,
    setActiveSidebarItem,
    setCurrentView,
    uploadFiles,
    fetchFiles,
    recentFiles,
  } = useAppStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isUploadingRef = useRef(false)

  const handleItemClick = (id: string, view?: 'home' | 'all-tools' | 'pdf-viewer' | 'combine-files' | 'batch-print') => {
    if (id === 'open-pdf') {
      fileInputRef.current?.click()
      return
    }
    setActiveSidebarItem(id)
    if (view) setCurrentView(view)
    else setCurrentView('home')
  }

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files
      if (!fileList || fileList.length === 0 || isUploadingRef.current) return

      isUploadingRef.current = true
      const files = Array.from(fileList)

      try {
        await uploadFiles(files)
        await fetchFiles()
        setActiveSidebarItem('recent-files')
        setCurrentView('home')
      } catch (error) {
        console.error('Upload error:', error)
      } finally {
        isUploadingRef.current = false
        // Reset input so the same file can be re-selected
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [uploadFiles, fetchFiles, setActiveSidebarItem, setCurrentView]
  )

  const starredCount = recentFiles.filter((f) => f.starred).length

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-[#2B2B2B] text-gray-300 transition-all duration-300 shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Logo */}
      <div className={cn('flex items-center gap-2 px-4 pt-4 pb-2', sidebarCollapsed && 'justify-center px-2')}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#4A90D9] rounded flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-white text-sm font-semibold leading-tight">PDFelement</span>
              <span className="text-gray-500 text-[10px] leading-tight">Wondershare</span>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="w-7 h-7 bg-[#4A90D9] rounded flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className={cn('px-3 py-3 space-y-2', sidebarCollapsed && 'px-2')}>
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleItemClick(item.id)}
            className={cn(
              'w-full flex items-center gap-2 rounded-md text-sm font-medium transition-colors',
              sidebarCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
              item.type === 'button-primary'
                ? 'bg-white text-gray-900 hover:bg-gray-100'
                : 'bg-[#3C3C3C] text-gray-300 hover:bg-[#4A4A4A] border border-gray-600'
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      {/* Recent Section */}
      <div className="px-3 py-2">
        {!sidebarCollapsed && (
          <span className="px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Recent Files
          </span>
        )}
        <div className="mt-1 space-y-0.5">
          {recentItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id, 'home')}
              className={cn(
                'w-full flex items-center gap-2 rounded-md text-sm transition-colors',
                sidebarCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-1.5',
                activeSidebarItem === item.id
                  ? 'bg-[#3C3C3C] text-white'
                  : 'text-gray-400 hover:bg-[#3C3C3C] hover:text-white'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && (
                <span className="flex-1 text-left">{item.label}</span>
              )}
              {!sidebarCollapsed && item.id === 'starred-files' && starredCount > 0 && (
                <span className="text-[10px] text-gray-500 bg-[#3C3C3C] px-1.5 py-0.5 rounded-full">
                  {starredCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Others Section */}
      <div className="px-3 py-2">
        {!sidebarCollapsed && (
          <span className="px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Others
          </span>
        )}
        <div className="mt-1 space-y-0.5">
          {otherItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={cn(
                'w-full flex items-center gap-2 rounded-md text-sm transition-colors',
                sidebarCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-1.5',
                activeSidebarItem === item.id
                  ? 'bg-[#3C3C3C] text-white'
                  : 'text-gray-400 hover:bg-[#3C3C3C] hover:text-white'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Cloud Storage */}
      <div className={cn('px-3 py-3 border-t border-gray-700', sidebarCollapsed && 'px-2')}>
        {!sidebarCollapsed ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[11px] text-gray-500">Cloud Storage</span>
            </div>
            <Progress value={0.05} className="h-1.5 bg-[#3C3C3C]" />
            <span className="text-[10px] text-gray-500">387.4 MB / 716.0 GB</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <Cloud className="w-4 h-4 text-gray-500" />
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="flex items-center justify-center py-2 border-t border-gray-700 text-gray-500 hover:text-white hover:bg-[#3C3C3C] transition-colors"
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </div>
  )
}
