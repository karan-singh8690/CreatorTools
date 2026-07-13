'use client'

import { useAppStore, ViewType } from '@/store/app-store'
import {
  Menu,
  ArrowLeft,
  Settings,
  FileText,
  Zap,
  Combine,
  FileDown,
  ArrowRightLeft,
  ScanLine,
  PenTool,
  Droplets,
  Lock,
  QrCode,
  Image,
  Crop,
  Hash,
  Heading,
  Printer,
  Type,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const viewTitles: Record<ViewType, { title: string; icon: React.ElementType }> = {
  'home': { title: 'CreatorTools', icon: FileText },
  'all-tools': { title: 'Quick Tools', icon: Zap },
  'pdf-viewer': { title: 'PDF Viewer', icon: FileText },
  'combine-files': { title: 'Merge PDF', icon: Combine },
  'batch-print': { title: 'Batch Print', icon: Printer },
  'convert': { title: 'Convert PDF', icon: ArrowRightLeft },
  'ocr': { title: 'OCR PDF', icon: ScanLine },
  'compress': { title: 'Compress PDF', icon: FileDown },
  'qr-generator': { title: 'QR Generator', icon: QrCode },
  'extract-text': { title: 'Extract Text', icon: Type },
  'watermark': { title: 'Watermark', icon: Droplets },
  'security': { title: 'Security', icon: Lock },
  'header-footer': { title: 'Header/Footer', icon: Heading },
  'bates-number': { title: 'Bates Number', icon: Hash },
  'background': { title: 'Background', icon: Image },
  'crop': { title: 'Crop PDF', icon: Crop },
  'sign': { title: 'Sign PDF', icon: PenTool },
  'settings': { title: 'Settings', icon: Settings },
}

export function MobileHeader() {
  const { currentView, setCurrentView, mobileMenuOpen, setMobileMenuOpen } = useAppStore()
  const { title, icon: Icon } = viewTitles[currentView] || viewTitles.home
  const isHome = currentView === 'home'

  return (
    <header className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 safe-area-top">
      <div className="flex items-center h-12 px-3">
        <div className="shrink-0">
          {isHome ? (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-1 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
          ) : (
            <button
              onClick={() => setCurrentView('home')}
              className="p-2 -ml-1 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
          <Icon className="w-4 h-4 text-[#4A90D9] shrink-0" />
          <h1 className="text-sm font-semibold text-gray-900 truncate">{title}</h1>
        </div>
        <div className="shrink-0 w-9">
          {isHome && (
            <button
              onClick={() => setCurrentView('settings')}
              className="p-2 -mr-1 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-4.5 h-4.5 text-gray-500" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
