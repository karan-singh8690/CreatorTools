'use client'

import { useRef, useCallback } from 'react'
import { useAppStore, ViewType } from '@/store/app-store'
import {
  FolderOpen,
  Clock,
  Star,
  Combine,
  FileDown,
  ArrowRightLeft,
  ScanLine,
  Printer,
  FileText,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Cloud,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

interface ToolNavItem {
  id: string
  label: string
  icon: React.ElementType
  view: ViewType
}

const recentItems = [
  { id: 'recent-files', label: 'Recent Files', icon: Clock, view: 'home' as ViewType },
  { id: 'starred-files', label: 'Starred Files', icon: Star, view: 'home' as ViewType },
]

const toolItems: ToolNavItem[] = [
  { id: 'combine-files', label: 'Combine Files', icon: Combine, view: 'combine-files' },
  { id: 'compress', label: 'Compress PDF', icon: FileDown, view: 'compress' },
  { id: 'convert', label: 'Convert PDF', icon: ArrowRightLeft, view: 'convert' },
  { id: 'ocr', label: 'OCR PDF', icon: ScanLine, view: 'ocr' },
  { id: 'batch-print', label: 'Batch Print', icon: Printer, view: 'batch-print' },
]

/** Map currentView to sidebar item id for active highlighting */
function getActiveToolId(currentView: ViewType): string | null {
  const mapping: Partial<Record<ViewType, string>> = {
    'combine-files': 'combine-files',
    compress: 'compress',
    convert: 'convert',
    ocr: 'ocr',
    'batch-print': 'batch-print',
  }
  return mapping[currentView] ?? null
}

export function AppSidebar() {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    activeSidebarItem,
    setActiveSidebarItem,
    currentView,
    setCurrentView,
    uploadFiles,
    fetchFiles,
    recentFiles,
  } = useAppStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isUploadingRef = useRef(false)

  const activeToolId = getActiveToolId(currentView)

  const handleOpenPdf = () => {
    fileInputRef.current?.click()
  }

  const handleRecentClick = (id: string, view: ViewType) => {
    setActiveSidebarItem(id)
    setCurrentView(view)
  }

  const handleToolClick = (tool: ToolNavItem) => {
    setActiveSidebarItem(tool.id)
    setCurrentView(tool.view)
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
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#4A90D9] rounded flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-white text-sm font-semibold leading-tight">PDFelement</span>
              <span className="text-gray-500 text-[10px] leading-tight">Wondershare</span>
            </div>
          </div>
        ) : (
          <div className="w-7 h-7 bg-[#4A90D9] rounded flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Open PDF Button */}
      <div className={cn('px-3 pt-3 pb-2', sidebarCollapsed && 'px-2')}>
        <button
          onClick={handleOpenPdf}
          className={cn(
            'w-full flex items-center gap-2 rounded-lg text-sm font-medium transition-all duration-200',
            sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
            'bg-white text-gray-900 hover:bg-gray-100 active:scale-[0.98] shadow-sm'
          )}
        >
          <FolderOpen className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && <span>Open PDF</span>}
        </button>
      </div>

      {/* Separator */}
      <div className="mx-3 border-t border-gray-700/50" />

      {/* Recent Files Section */}
      <div className="px-3 py-3">
        {!sidebarCollapsed && (
          <span className="px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Recent Files
          </span>
        )}
        <div className={cn('mt-1.5 space-y-0.5', !sidebarCollapsed && 'space-y-0.5')}>
          {recentItems.map((item) => {
            const isActive = activeSidebarItem === item.id && currentView === 'home'
            return (
              <button
                key={item.id}
                onClick={() => handleRecentClick(item.id, item.view)}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-lg text-sm transition-all duration-150',
                  sidebarCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
                  isActive
                    ? 'bg-[#3C3C3C] text-white shadow-sm'
                    : 'text-gray-400 hover:bg-[#353535] hover:text-gray-200'
                )}
              >
                <item.icon className={cn('w-4 h-4 shrink-0', isActive && 'text-[#4A90D9]')} />
                {!sidebarCollapsed && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
                {!sidebarCollapsed && item.id === 'starred-files' && starredCount > 0 && (
                  <span className="text-[10px] font-medium text-gray-400 bg-[#3C3C3C] px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {starredCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Separator */}
      <div className="mx-3 border-t border-gray-700/50" />

      {/* Tools Section */}
      <div className="px-3 py-3">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-1.5 px-3 mb-1.5">
            <Wrench className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Tools
            </span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="flex justify-center mb-1">
            <Wrench className="w-3.5 h-3.5 text-gray-500" />
          </div>
        )}
        <div className="space-y-0.5">
          {toolItems.map((tool) => {
            const isActive = activeToolId === tool.id
            return (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool)}
                title={sidebarCollapsed ? tool.label : undefined}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-lg text-sm transition-all duration-150',
                  sidebarCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
                  isActive
                    ? 'bg-[#4A90D9]/15 text-[#6AADFF] shadow-sm border border-[#4A90D9]/20'
                    : 'text-gray-400 hover:bg-[#353535] hover:text-gray-200 border border-transparent'
                )}
              >
                <tool.icon className={cn('w-4 h-4 shrink-0', isActive && 'text-[#4A90D9]')} />
                {!sidebarCollapsed && (
                  <span className="flex-1 text-left truncate">{tool.label}</span>
                )}
                {!sidebarCollapsed && isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4A90D9]" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Cloud Storage Footer */}
      <div className={cn('px-3 py-3 border-t border-gray-700/50', sidebarCollapsed && 'px-2')}>
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
        className="flex items-center justify-center py-2.5 border-t border-gray-700/50 text-gray-500 hover:text-white hover:bg-[#3C3C3C] transition-all duration-150"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
