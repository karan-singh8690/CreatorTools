'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { useAppStore, ViewType } from '@/store/app-store'
import { useIsMobile } from '@/hooks/use-mobile'
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
  QrCode,
  Type,
  Droplets,
  Lock,
  Heading,
  Hash,
  Image,
  Crop,
  PenTool,
  Sparkles,
  Settings,
  PlayCircle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { formatStorageSize } from '@/lib/bigint-utils'

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
  { id: 'watermark', label: 'Watermark PDF', icon: Droplets, view: 'watermark' },
  { id: 'header-footer', label: 'Header & Footer', icon: Heading, view: 'header-footer' },
  { id: 'bates-number', label: 'Bates Number', icon: Hash, view: 'bates-number' },
  { id: 'background', label: 'Background', icon: Image, view: 'background' },
  { id: 'crop', label: 'Crop Pages', icon: Crop, view: 'crop' },
  { id: 'sign', label: 'Sign Document', icon: PenTool, view: 'sign' },
  { id: 'cleanup', label: 'BG & Watermark Remover', icon: Sparkles, view: 'cleanup' },
  { id: 'terabox-player', label: 'Terabox Player', icon: PlayCircle, view: 'terabox-player' },
  { id: 'security', label: 'Security', icon: Lock, view: 'security' },
  { id: 'convert', label: 'Convert PDF', icon: ArrowRightLeft, view: 'convert' },
  { id: 'ocr', label: 'OCR PDF', icon: ScanLine, view: 'ocr' },
  { id: 'extract-text', label: 'Extract Text', icon: Type, view: 'extract-text' },
  { id: 'batch-print', label: 'Batch Print', icon: Printer, view: 'batch-print' },
  { id: 'qr-generator', label: 'QR Generator', icon: QrCode, view: 'qr-generator' },
  { id: 'settings', label: 'Settings', icon: Settings, view: 'settings' },
]

/** Map currentView to sidebar item id for active highlighting */
function getActiveToolId(currentView: ViewType): string | null {
  const mapping: Partial<Record<ViewType, string>> = {
    'combine-files': 'combine-files',
    compress: 'compress',
    watermark: 'watermark',
    'header-footer': 'header-footer',
    'bates-number': 'bates-number',
    background: 'background',
    crop: 'crop',
    sign: 'sign',
    cleanup: 'cleanup',
    'terabox-player': 'terabox-player',
    security: 'security',
    convert: 'convert',
    ocr: 'ocr',
    'extract-text': 'extract-text',
    'batch-print': 'batch-print',
    'qr-generator': 'qr-generator',
    settings: 'settings',
  }
  return mapping[currentView] ?? null
}

// ─── Sidebar Content (shared between desktop & mobile) ────────────────────────

function SidebarContent({ isMobileDrawer, onClose }: { isMobileDrawer: boolean; onClose?: () => void }) {
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
    setFileFilter,
  } = useAppStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isUploadingRef = useRef(false)
  const activeToolId = getActiveToolId(currentView)

  // Prevent hydration mismatch: always render expanded layout during SSR
  // and first client paint, then apply user's saved collapsed state after mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const handleOpenPdf = () => {
    fileInputRef.current?.click()
  }

  const handleRecentClick = (id: string, view: ViewType) => {
    setActiveSidebarItem(id)
    setCurrentView(view)
    if (id === 'starred-files') {
      setFileFilter('starred')
    } else {
      setFileFilter('all')
    }
    onClose?.()
  }

  const handleToolClick = (tool: ToolNavItem) => {
    setActiveSidebarItem(tool.id)
    setCurrentView(tool.view)
    onClose?.()
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

  // Live storage info
  const [storageInfo, setStorageInfo] = useState<{
    usedBytes: number
    totalBytes: number
    usedPercent: number
    fileCount: number
  } | null>(null)

  useEffect(() => {
    let mounted = true
    const fetchStorage = async () => {
      try {
        const res = await fetch('/api/storage')
        if (res.ok && mounted) {
          const data = await res.json()
          setStorageInfo({
            usedBytes: data.usedBytes,
            totalBytes: data.totalBytes,
            usedPercent: data.usedPercent,
            fileCount: data.fileCount,
          })
        }
      } catch {
        // silently ignore
      }
    }
    fetchStorage()
    const interval = setInterval(fetchStorage, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const storageUsed = storageInfo ? formatStorageSize(storageInfo.usedBytes) : '—'
  const storageTotal = storageInfo ? formatStorageSize(storageInfo.totalBytes) : '—'
  const storagePercent = storageInfo ? Math.min(storageInfo.usedPercent, 100) : 0

  // In mobile drawer, always show expanded (not collapsed)
  // Before mount, always show expanded to match server-rendered HTML
  const collapsed = mounted ? (isMobileDrawer ? false : sidebarCollapsed) : false

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-[#2B2B2B] text-gray-300 transition-all duration-300 shrink-0',
        isMobileDrawer ? 'w-72' : (collapsed ? 'w-16' : 'w-56')
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
      <div className={cn('flex items-center gap-2 px-4 pt-4 pb-2', collapsed && 'justify-center px-2')}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="CreatorTools"
              width={32}
              height={32}
              className="rounded"
            />
            <div className="flex flex-col">
              <span className="text-white text-sm font-semibold leading-tight">Creator<span className="text-[#4A90D9]">Tools</span></span>
            </div>
            {isMobileDrawer && (
              <button
                onClick={onClose}
                className="ml-auto p-1 rounded-lg hover:bg-[#3C3C3C] text-gray-400 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <img
            src="/logo.png"
            alt="CreatorTools"
            width={28}
            height={28}
            className="rounded"
          />
        )}
      </div>

      {/* Open PDF Button */}
      <div className={cn('px-3 pt-3 pb-2', collapsed && 'px-2')}>
        <button
          onClick={handleOpenPdf}
          className={cn(
            'w-full flex items-center gap-2 rounded-lg text-sm font-medium transition-all duration-200',
            collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
            'bg-white text-gray-900 hover:bg-gray-100 active:scale-[0.98] shadow-sm'
          )}
        >
          <FolderOpen className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Open PDF</span>}
        </button>
      </div>

      {/* Separator */}
      <div className="mx-3 border-t border-gray-700/50" />

      {/* Recent Files Section */}
      <div className="px-3 py-3">
        {!collapsed && (
          <span className="px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Recent Files
          </span>
        )}
        <div className={cn('mt-1.5 space-y-0.5', !collapsed && 'space-y-0.5')}>
          {recentItems.map((item) => {
            const isActive = activeSidebarItem === item.id && currentView === 'home'
            return (
              <button
                key={item.id}
                onClick={() => handleRecentClick(item.id, item.view)}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-lg text-sm transition-all duration-150',
                  collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
                  isActive
                    ? 'bg-[#3C3C3C] text-white shadow-sm'
                    : 'text-gray-400 hover:bg-[#353535] hover:text-gray-200'
                )}
              >
                <item.icon className={cn('w-4 h-4 shrink-0', isActive && 'text-[#4A90D9]')} />
                {!collapsed && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
                {!collapsed && item.id === 'starred-files' && starredCount > 0 && (
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
      <div className="px-3 py-3 flex-1 overflow-y-auto custom-scrollbar">
        {!collapsed && (
          <div className="flex items-center gap-1.5 px-3 mb-1.5">
            <Wrench className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Tools
            </span>
          </div>
        )}
        {collapsed && (
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
                title={collapsed ? tool.label : undefined}
                className={cn(
                  'w-full flex items-center gap-2.5 rounded-lg text-sm transition-all duration-150',
                  collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
                  isActive
                    ? 'bg-[#4A90D9]/15 text-[#6AADFF] shadow-sm border border-[#4A90D9]/20'
                    : 'text-gray-400 hover:bg-[#353535] hover:text-gray-200 border border-transparent'
                )}
              >
                <tool.icon className={cn('w-4 h-4 shrink-0', isActive && 'text-[#4A90D9]')} />
                {!collapsed && (
                  <span className="flex-1 text-left truncate">{tool.label}</span>
                )}
                {!collapsed && isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4A90D9]" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cloud Storage Footer */}
      <div className={cn('px-3 py-3 border-t border-gray-700/50', collapsed && 'px-2')}>
        {!collapsed ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-[11px] text-gray-500">Cloud Storage</span>
              {storageInfo && (
                <span className="text-[10px] text-gray-600 ml-auto">{storageInfo.fileCount} files</span>
              )}
            </div>
            <Progress value={storagePercent} className="h-1.5 bg-[#3C3C3C]" />
            <span className="text-[10px] text-gray-500">{storageUsed} / {storageTotal}</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <Cloud className="w-4 h-4 text-gray-500" />
          </div>
        )}
      </div>

      {/* Collapse Toggle — desktop only */}
      {!isMobileDrawer && (
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
      )}
    </div>
  )
}

// ─── Main Export ────────────────────────────────────────────────────────────────

export function AppSidebar() {
  const { mobileMenuOpen, setMobileMenuOpen } = useAppStore()
  const isMobile = useIsMobile()

  // Mobile: render as drawer overlay
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        {/* Drawer */}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:hidden',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <SidebarContent isMobileDrawer onClose={() => setMobileMenuOpen(false)} />
        </div>
      </>
    )
  }

  // Desktop: render inline
  return <SidebarContent isMobileDrawer={false} />
}
