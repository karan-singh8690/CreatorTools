'use client'

import { useAppStore } from '@/store/app-store'
import { AppSidebar } from '@/components/pdf-element/app-sidebar'
import { QuickTools } from '@/components/pdf-element/quick-tools'
import { RecentFiles } from '@/components/pdf-element/recent-files'
import { AllTools } from '@/components/pdf-element/all-tools'
import { PdfViewer } from '@/components/pdf-element/pdf-viewer'
import { CombineFiles } from '@/components/pdf-element/combine-files'
import { BatchPrint } from '@/components/pdf-element/batch-print'
import { FileUpload } from '@/components/pdf-element/file-upload'
import { ConvertPdf } from '@/components/pdf-element/convert-pdf'
import { CompressPdf } from '@/components/pdf-element/compress-pdf'
import { OcrPdf } from '@/components/pdf-element/ocr-pdf'
import { QrGenerator } from '@/components/qr-generator/qr-generator'
import { motion } from 'framer-motion'
import { FileText, Sparkles } from 'lucide-react'

const fadeSlideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

/** The home view content - extracted to avoid duplication */
function HomeView() {
  return (
    <div className="flex-1 overflow-auto">
      {/* Hero / Welcome Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#4A90D9] via-[#5B9FE6] to-[#3A7BC8] px-8 pt-10 pb-12">
        {/* Decorative background shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/5 rounded-full" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-white/5 rounded-full" />
          <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/[0.03] rounded-full" />
        </div>

        <motion.div
          className="relative z-10 max-w-4xl"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={fadeSlideUp}
            custom={0}
            className="flex items-center gap-3 mb-4"
          >
            <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-white/60 text-xs font-medium tracking-wide uppercase">
                Wondershare
              </span>
            </div>
          </motion.div>

          <motion.h1
            variants={fadeSlideUp}
            custom={1}
            className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-3"
          >
            Welcome to PDFelement
          </motion.h1>

          <motion.p
            variants={fadeSlideUp}
            custom={2}
            className="text-base sm:text-lg text-white/75 max-w-xl leading-relaxed"
          >
            Your all-in-one PDF solution. Create, edit, convert, and sign
            PDF documents with ease.
          </motion.p>

          <motion.div
            variants={fadeSlideUp}
            custom={3}
            className="flex items-center gap-2 mt-5"
          >
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3.5 py-1.5 border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span className="text-xs text-white/90 font-medium">
                AI-Powered Tools
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3.5 py-1.5 border border-white/15">
              <span className="text-xs text-white/90 font-medium">
                10+ PDF Features
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Content Sections */}
      <div className="px-8 py-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <QuickTools />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <FileUpload mode="full" className="mb-0" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <RecentFiles />
        </motion.div>
      </div>
    </div>
  )
}

export default function Home() {
  const { currentView } = useAppStore()

  const renderMainContent = () => {
    switch (currentView) {
      case 'home':
        return <HomeView />
      case 'all-tools':
        return <AllTools />
      case 'pdf-viewer':
        return <PdfViewer />
      case 'combine-files':
        return <CombineFiles />
      case 'batch-print':
        return <BatchPrint />
      case 'convert':
        return <ConvertPdf />
      case 'ocr':
        return <OcrPdf />
      case 'compress':
        return <CompressPdf />
      case 'qr-generator':
        return <QrGenerator />
      default:
        return <HomeView />
    }
  }

  return (
    <div className="h-screen flex bg-[#F5F5F5]">
      <AppSidebar />
      <main className="flex-1 flex min-w-0">
        {renderMainContent()}
      </main>
    </div>
  )
}
