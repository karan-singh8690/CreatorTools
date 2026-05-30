'use client'

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
  X,
  Layers,
  Pencil,
  Sparkles,
  Combine,
  Scan,
  LayoutTemplate,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToolItem {
  id: string
  label: string
  description: string
  icon: React.ElementType
  badge?: string
  view: ViewType
}

const allTools: ToolItem[] = [
  { id: 'edit', label: 'Edit', description: 'Edit text and images in PDF files.', icon: Pencil, view: 'home' },
  { id: 'convert', label: 'Convert', description: 'Batch convert PDFs to other formats.', icon: ArrowRightLeft, view: 'convert' },
  { id: 'ocr', label: 'OCR', description: 'Batch convert scanned documents into editable PDFs.', icon: ScanLine, view: 'ocr' },
  { id: 'create', label: 'Create', description: 'Batch create PDFs from other files.', icon: FilePlus, view: 'home' },
  { id: 'compress', label: 'Compress', description: 'Batch reduce PDFs for size.', icon: FileDown, view: 'compress' },
  { id: 'print', label: 'Print', description: 'Batch print PDFs.', icon: Printer, view: 'batch-print' },
  { id: 'watermark', label: 'Watermark', description: 'Batch manage PDF watermarks.', icon: Droplets, view: 'home' },
  { id: 'background', label: 'Background', description: 'Batch manage PDF backgrounds.', icon: Image, view: 'home' },
  { id: 'header-footer', label: 'Header & Footer', description: 'Batch manage PDF headers and footers.', icon: Heading, view: 'home' },
  { id: 'bates-number', label: 'Bates Number', description: 'Batch add PDF Bates numbering.', icon: Hash, view: 'home' },
  { id: 'security', label: 'Security', description: 'Batch protect PDF with a password.', icon: Lock, view: 'home' },
  { id: 'extract-data', label: 'Extract Data', description: 'Batch extract PDF data.', icon: Table2, view: 'home' },
  { id: 'translate', label: 'Translate PDF', description: 'Batch translate PDFs.', icon: Globe, view: 'home' },
  { id: 'delete-blank', label: 'Delete Blank Pages', description: 'Batch delete PDF blank pages.', icon: Trash2, view: 'home' },
  { id: 'sign', label: 'Sign Document', description: 'Sign PDF documents digitally.', icon: PenTool, badge: 'New', view: 'home' },
  { id: 'crop', label: 'Crop', description: 'Crop PDF pages.', icon: Crop, badge: 'New', view: 'home' },
]

export function AllTools() {
  const { setCurrentView } = useAppStore()

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Quick Tools</h1>
          <p className="text-xs text-gray-400">Wondershare PDFelement</p>
        </div>
        <button
          onClick={() => setCurrentView('home')}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tools Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {allTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setCurrentView(tool.view)}
              className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <tool.icon className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-800 group-hover:text-emerald-600">
                    {tool.label}
                  </span>
                  {tool.badge && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500 text-white">
                      {tool.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-tight">
                  {tool.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
