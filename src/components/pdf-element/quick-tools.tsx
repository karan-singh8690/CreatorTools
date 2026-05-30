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
  ChevronRight,
  Zap,
  Scan,
  PenTool,
  LayoutTemplate,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface QuickTool {
  id: string
  label: string
  description: string
  icon: React.ElementType
  color: string
  bgColor: string
  gradientFrom: string
  gradientTo: string
  borderColor: string
  view: ViewType
  primary?: boolean
}

const quickTools: QuickTool[] = [
  {
    id: 'edit-pdf',
    label: 'Edit PDF',
    description: 'Edit text and images',
    icon: Pencil,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    gradientFrom: 'from-orange-500/10',
    gradientTo: 'to-orange-50/0',
    borderColor: 'hover:border-orange-300',
    view: 'pdf-viewer',
    primary: true,
  },
  {
    id: 'convert-pdf',
    label: 'Convert PDF',
    description: 'To Word, Excel, PPT & more',
    icon: ArrowRightLeft,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    gradientFrom: 'from-teal-500/10',
    gradientTo: 'to-teal-50/0',
    borderColor: 'hover:border-teal-300',
    view: 'convert',
    primary: true,
  },
  {
    id: 'ocr-pdf',
    label: 'OCR PDF',
    description: 'Make scanned docs searchable',
    icon: ScanLine,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    gradientFrom: 'from-purple-500/10',
    gradientTo: 'to-purple-50/0',
    borderColor: 'hover:border-purple-300',
    view: 'ocr',
    primary: true,
  },
  {
    id: 'summarize-pdf',
    label: 'AI Chat & Summarize',
    description: 'AI-powered PDF analysis',
    icon: Sparkles,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-blue-50/0',
    borderColor: 'hover:border-blue-300',
    view: 'pdf-viewer',
    primary: true,
  },
  {
    id: 'combine-files',
    label: 'Combine Files',
    description: 'Merge into a single PDF',
    icon: Combine,
    color: 'text-[#4A90D9]',
    bgColor: 'bg-blue-50',
    gradientFrom: 'from-sky-500/10',
    gradientTo: 'to-sky-50/0',
    borderColor: 'hover:border-sky-300',
    view: 'combine-files',
    primary: true,
  },
  {
    id: 'compress-pdf',
    label: 'Compress PDF',
    description: 'Reduce file size instantly',
    icon: FileDown,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    gradientFrom: 'from-green-500/10',
    gradientTo: 'to-green-50/0',
    borderColor: 'hover:border-green-300',
    view: 'compress',
    primary: true,
  },
  {
    id: 'batch-pdfs',
    label: 'Batch PDFs',
    description: 'Batch convert, print & more',
    icon: Layers,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    gradientFrom: 'from-emerald-500/10',
    gradientTo: 'to-emerald-50/0',
    borderColor: 'hover:border-emerald-300',
    view: 'batch-print',
  },
  {
    id: 'scan-to-pdf',
    label: 'Scan to PDF',
    description: 'Digitize paper documents',
    icon: Scan,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-blue-50/0',
    borderColor: 'hover:border-blue-300',
    view: 'home',
  },
  {
    id: 'request-esign',
    label: 'Request eSign',
    description: 'Send for e-signatures',
    icon: PenTool,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    gradientFrom: 'from-purple-500/10',
    gradientTo: 'to-purple-50/0',
    borderColor: 'hover:border-purple-300',
    view: 'home',
  },
  {
    id: 'templates',
    label: 'Templates',
    description: 'Ready-made PDF templates',
    icon: LayoutTemplate,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    gradientFrom: 'from-sky-500/10',
    gradientTo: 'to-sky-50/0',
    borderColor: 'hover:border-sky-300',
    view: 'home',
  },
]

const primaryTools = quickTools.filter((t) => t.primary)
const secondaryTools = quickTools.filter((t) => !t.primary)

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

export function QuickTools() {
  const { setCurrentView } = useAppStore()

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            Quick Tools
          </h2>
        </div>
        <motion.button
          onClick={() => setCurrentView('all-tools')}
          className="text-sm font-medium text-[#4A90D9] hover:text-[#3A7BC8] flex items-center gap-1 group/all transition-colors"
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.97 }}
        >
          All Tools
          <ChevronRight className="w-4 h-4 transition-transform group-hover/all:translate-x-0.5" />
        </motion.button>
      </div>

      {/* Primary Tools - Highlighted Row */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {primaryTools.map((tool) => (
          <motion.button
            key={tool.id}
            variants={cardVariants}
            onClick={() => setCurrentView(tool.view)}
            className={cn(
              'relative flex flex-col items-center text-center p-4 rounded-xl border border-gray-100 bg-white overflow-hidden group cursor-pointer',
              tool.borderColor
            )}
            whileHover={{
              scale: 1.04,
              y: -4,
              boxShadow: '0 12px 24px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.02)',
            }}
            whileTap={{ scale: 0.97 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 22,
            }}
          >
            {/* Gradient accent on top */}
            <div
              className={cn(
                'absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                tool.gradientFrom.replace('/10', '/80'),
                tool.gradientTo.replace('/0', '/80')
              )}
            />

            {/* Background radial glow on hover */}
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-b opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                tool.gradientFrom,
                tool.gradientTo
              )}
            />

            {/* Icon */}
            <motion.div
              className={cn(
                'relative z-10 w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-sm',
                tool.bgColor
              )}
              whileHover={{ rotate: [0, -8, 8, -4, 0], scale: 1.1 }}
              transition={{ duration: 0.4 }}
            >
              <tool.icon className={cn('w-5 h-5', tool.color)} />
            </motion.div>

            {/* Label */}
            <span className="relative z-10 text-sm font-semibold text-gray-800 group-hover:text-gray-900 leading-tight">
              {tool.label}
            </span>

            {/* Description */}
            <span className="relative z-10 text-[11px] text-gray-400 mt-1 leading-tight line-clamp-2">
              {tool.description}
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* Secondary Tools - Smaller Cards */}
      {secondaryTools.length > 0 && (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {secondaryTools.map((tool) => (
            <motion.button
              key={tool.id}
              variants={cardVariants}
              onClick={() => setCurrentView(tool.view)}
              className={cn(
                'relative flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-100 bg-white overflow-hidden group cursor-pointer',
                tool.borderColor
              )}
              whileHover={{
                scale: 1.03,
                y: -2,
                boxShadow: '0 8px 16px -6px rgba(0,0,0,0.1)',
              }}
              whileTap={{ scale: 0.97 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 22,
              }}
            >
              {/* Subtle background glow */}
              <div
                className={cn(
                  'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                  tool.gradientFrom,
                  tool.gradientTo
                )}
              />

              {/* Icon */}
              <motion.div
                className={cn(
                  'relative z-10 w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  tool.bgColor
                )}
                whileHover={{ scale: 1.1, rotate: [0, -6, 6, 0] }}
                transition={{ duration: 0.35 }}
              >
                <tool.icon className={cn('w-4 h-4', tool.color)} />
              </motion.div>

              {/* Label & description */}
              <div className="relative z-10 min-w-0 text-left">
                <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 block truncate">
                  {tool.label}
                </span>
                <span className="text-[10px] text-gray-400 leading-tight line-clamp-1">
                  {tool.description}
                </span>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  )
}
