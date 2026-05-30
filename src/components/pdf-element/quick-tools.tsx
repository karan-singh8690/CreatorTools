'use client'

import { useAppStore, ViewType } from '@/store/app-store'
import {
  Pencil,
  ArrowRightLeft,
  ScanLine,
  Sparkles,
  Combine,
  Layers,
  FileDown,
  Scan,
  PenTool,
  LayoutTemplate,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickTool {
  id: string
  label: string
  description: string
  icon: React.ElementType
  color: string
  bgColor: string
  view: ViewType
}

const quickTools: QuickTool[] = [
  {
    id: 'edit-pdf',
    label: 'Edit PDF',
    description: 'Edit text and images in files.',
    icon: Pencil,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    view: 'home',
  },
  {
    id: 'convert-pdf',
    label: 'Convert PDF',
    description: 'Convert PDF to Word, Excel, PPT, etc.',
    icon: ArrowRightLeft,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    view: 'convert',
  },
  {
    id: 'ocr-pdf',
    label: 'OCR PDF',
    description: 'Convert scanned files to searchable and editable PDF files.',
    icon: ScanLine,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    view: 'ocr',
  },
  {
    id: 'summarize-pdf',
    label: 'Summarize PDF',
    description: 'AI summarize your PDF, overview key points, etc.',
    icon: Sparkles,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    view: 'pdf-viewer',
  },
  {
    id: 'combine-files',
    label: 'Combine Files',
    description: 'Combine multiple files into a single PDF.',
    icon: Combine,
    color: 'text-[#4A90D9]',
    bgColor: 'bg-blue-50',
    view: 'combine-files',
  },
  {
    id: 'batch-pdfs',
    label: 'Batch PDFs',
    description: 'Batch convert, create, print PDF, etc.',
    icon: Layers,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    view: 'batch-print',
  },
  {
    id: 'compress-pdf',
    label: 'Compress PDF',
    description: 'Reduce PDF file size for easier sharing.',
    icon: FileDown,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    view: 'compress',
  },
  {
    id: 'scan',
    label: 'Scan',
    description: 'Scan documents to PDF.',
    icon: Scan,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    view: 'home',
  },
  {
    id: 'request-esign',
    label: 'Request eSign',
    description: 'Request electronic signatures.',
    icon: PenTool,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    view: 'home',
  },
  {
    id: 'template',
    label: 'Template',
    description: 'Use templates for PDF creation.',
    icon: LayoutTemplate,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    view: 'home',
  },
]

export function QuickTools() {
  const { setCurrentView } = useAppStore()

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">Quick Tools</h2>
        <button
          onClick={() => setCurrentView('all-tools')}
          className="text-xs text-[#4A90D9] hover:underline flex items-center gap-1"
        >
          <Layers className="w-3.5 h-3.5" />
          All Tools
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {quickTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setCurrentView(tool.view)}
            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-[#4A90D9] hover:shadow-sm transition-all text-left group"
          >
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', tool.bgColor)}>
              <tool.icon className={cn('w-4.5 h-4.5', tool.color)} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-800 group-hover:text-[#4A90D9] truncate">
                {tool.label}
              </div>
              <div className="text-[11px] text-gray-400 line-clamp-2 leading-tight">
                {tool.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
