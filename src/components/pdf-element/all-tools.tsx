'use client'

import { useState } from 'react'
import { useAppStore, ViewType } from '@/store/app-store'
import {
  ArrowRightLeft,
  ScanLine,
  FilePlus,
  FileDown,
  Printer,
  Droplets,
  Image,
  Heading,
  Hash,
  Lock,
  Table2,
  Globe,
  Trash2,
  PenTool,
  Crop,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ComingSoonDialog } from './coming-soon'

interface ToolItem {
  id: string
  label: string
  description: string
  icon: React.ElementType
  badge?: string
  view: ViewType
  comingSoon?: boolean
}

const allTools: ToolItem[] = [
  { id: 'edit', label: 'Edit', description: 'Edit text and images in PDF files.', icon: PenTool, view: 'home', comingSoon: true },
  { id: 'convert', label: 'Convert', description: 'Batch convert PDFs to other formats.', icon: ArrowRightLeft, view: 'convert' },
  { id: 'ocr', label: 'OCR', description: 'Batch convert scanned documents into editable PDFs.', icon: ScanLine, view: 'ocr' },
  { id: 'create', label: 'Create', description: 'Batch create PDFs from other files.', icon: FilePlus, view: 'home', comingSoon: true },
  { id: 'compress', label: 'Compress', description: 'Batch reduce PDFs for size.', icon: FileDown, view: 'compress' },
  { id: 'print', label: 'Print', description: 'Batch print PDFs.', icon: Printer, view: 'batch-print' },
  { id: 'watermark', label: 'Watermark', description: 'Batch manage PDF watermarks.', icon: Droplets, view: 'watermark' },
  { id: 'background', label: 'Background', description: 'Batch manage PDF backgrounds.', icon: Image, view: 'background' },
  { id: 'header-footer', label: 'Header & Footer', description: 'Batch manage PDF headers and footers.', icon: Heading, view: 'header-footer' },
  { id: 'bates-number', label: 'Bates Number', description: 'Batch add PDF Bates numbering.', icon: Hash, view: 'bates-number' },
  { id: 'security', label: 'Security', description: 'Batch protect PDF with a password.', icon: Lock, view: 'security' },
  { id: 'extract-data', label: 'Extract Data', description: 'Batch extract PDF data.', icon: Table2, view: 'home', comingSoon: true },
  { id: 'translate', label: 'Translate PDF', description: 'Batch translate PDFs.', icon: Globe, view: 'home', comingSoon: true },
  { id: 'delete-blank', label: 'Delete Blank Pages', description: 'Batch delete PDF blank pages.', icon: Trash2, view: 'home', comingSoon: true },
  { id: 'sign', label: 'Sign Document', description: 'Sign PDF documents digitally.', icon: PenTool, badge: 'New', view: 'sign' },
  { id: 'crop', label: 'Crop', description: 'Crop PDF pages with visual editor.', icon: Crop, badge: 'New', view: 'crop' },
  { id: 'cleanup', label: 'Background & Watermark Remover', description: 'Remove watermarks, backgrounds & clean scanned pages.', icon: Sparkles, badge: 'New', view: 'cleanup' },
]

export function AllTools() {
  const { setCurrentView } = useAppStore()
  const [comingSoonTool, setComingSoonTool] = useState<ToolItem | null>(null)

  const handleToolClick = (tool: ToolItem) => {
    if (tool.comingSoon) {
      setComingSoonTool(tool)
    } else {
      setCurrentView(tool.view)
    }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-base md:text-lg font-semibold text-gray-800 dark:text-gray-100">Quick Tools</h1>
          <p className="text-[11px] md:text-xs text-gray-400 dark:text-gray-500">CreatorTools PDF Suite</p>
        </div>
        <button
          onClick={() => setCurrentView('home')}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors md:hidden"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCurrentView('home')}
          className="hidden md:block p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tools Grid */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-20 md:pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-4">
          {allTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool)}
              className={cn(
                'flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border transition-all text-left group',
                tool.comingSoon
                  ? 'border-gray-100 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600 hover:shadow-md'
                  : 'border-gray-100 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  tool.comingSoon
                    ? 'bg-amber-50 dark:bg-amber-950/30'
                    : 'bg-emerald-50 dark:bg-emerald-950/30'
                )}
              >
                <tool.icon
                  className={cn(
                    'w-5 h-5',
                    tool.comingSoon ? 'text-amber-500' : 'text-emerald-600'
                  )}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'text-sm font-medium group-hover:text-emerald-600',
                      tool.comingSoon
                        ? 'text-gray-500 group-hover:text-amber-500'
                        : 'text-gray-800 dark:text-gray-100'
                    )}
                  >
                    {tool.label}
                  </span>
                  {tool.badge && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500 text-white">
                      {tool.badge}
                    </span>
                  )}
                  {tool.comingSoon && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">
                      Soon
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-2 leading-tight">
                  {tool.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Coming Soon Dialog */}
      <ComingSoonDialog
        toolName={comingSoonTool?.label ?? ''}
        open={comingSoonTool !== null}
        onOpenChange={(open) => {
          if (!open) setComingSoonTool(null)
        }}
      />
    </div>
  )
}
