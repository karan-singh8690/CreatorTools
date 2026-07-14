'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAppStore, type ViewType } from '@/store/app-store'
import { AppSidebar } from '@/components/pdf-element/app-sidebar'
import { MobileHeader } from '@/components/pdf-element/mobile-header'
import { MobileBottomNav } from '@/components/pdf-element/mobile-bottom-nav'
import { RecentFiles } from '@/components/pdf-element/recent-files'
import { AllTools } from '@/components/pdf-element/all-tools'
import { PdfViewer } from '@/components/pdf-element/pdf-viewer'
import { CombineFiles } from '@/components/pdf-element/combine-files'
import { BatchPrint } from '@/components/pdf-element/batch-print'
import { FileUpload } from '@/components/pdf-element/file-upload'
import { ConvertPdf } from '@/components/pdf-element/convert-pdf'
import { CompressPdf } from '@/components/pdf-element/compress-pdf'
import { OcrPdf } from '@/components/pdf-element/ocr-pdf'
import { ExtractText } from '@/components/pdf-element/extract-text'
import { QrGenerator } from '@/components/qr-generator/qr-generator'
import { WatermarkPdf } from '@/components/pdf-element/watermark-pdf'
import { SecurityPdf } from '@/components/pdf-element/security-pdf'
import { HeaderFooterPdf } from '@/components/pdf-element/header-footer-pdf'
import { BatesNumberPdf } from '@/components/pdf-element/bates-number-pdf'
import { BackgroundPdf } from '@/components/pdf-element/background-pdf'
import { CropPdf } from '@/components/pdf-element/crop-pdf'
import { SignPdf } from '@/components/pdf-element/sign-pdf'
import { SettingsPage } from '@/components/pdf-element/settings-page'
import { CleanupPdf } from '@/components/pdf-element/cleanup-pdf'
import { TeraboxPlayer } from '@/components/terabox/terabox-player'
import { motion } from 'framer-motion'

import {
  FileText,
  Sparkles,
  Upload,
  ArrowRight,
  Zap,
  Shield,
  Clock,
  Star,
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
  PlayCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Tool shortcuts for the home page ────────────────────────────────────────

const popularTools = [
  { id: 'compress', label: 'Compress PDF', desc: 'Reduce file size', icon: FileDown, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-500/20', view: 'compress' as ViewType },
  { id: 'convert', label: 'Convert PDF', desc: 'Word, Excel, PPT', icon: ArrowRightLeft, color: 'text-teal-600', bg: 'bg-teal-50', ring: 'ring-teal-500/20', view: 'convert' as ViewType },
  { id: 'sign', label: 'Sign PDF', desc: 'eSignatures', icon: PenTool, color: 'text-violet-600', bg: 'bg-violet-50', ring: 'ring-violet-500/20', view: 'sign' as ViewType },
  { id: 'combine', label: 'Merge PDF', desc: 'Combine files', icon: Combine, color: 'text-sky-600', bg: 'bg-sky-50', ring: 'ring-sky-500/20', view: 'combine-files' as ViewType },
  { id: 'watermark', label: 'Watermark', desc: 'Add stamps', icon: Droplets, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-500/20', view: 'watermark' as ViewType },
  { id: 'ocr', label: 'OCR PDF', desc: 'Extract text', icon: ScanLine, color: 'text-purple-600', bg: 'bg-purple-50', ring: 'ring-purple-500/20', view: 'ocr' as ViewType },
  { id: 'security', label: 'Security', desc: 'Encrypt & lock', icon: Lock, color: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-500/20', view: 'security' as ViewType },
  { id: 'qr', label: 'QR Code', desc: 'Generate QR', icon: QrCode, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-500/20', view: 'qr-generator' as ViewType },
  { id: 'background', label: 'Background', desc: 'Add colors', icon: Image, color: 'text-pink-600', bg: 'bg-pink-50', ring: 'ring-pink-500/20', view: 'background' as ViewType },
  { id: 'crop', label: 'Crop PDF', desc: 'Trim pages', icon: Crop, color: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-500/20', view: 'crop' as ViewType },
  { id: 'header-footer', label: 'Header/Footer', desc: 'Add headers', icon: Heading, color: 'text-cyan-600', bg: 'bg-cyan-50', ring: 'ring-cyan-500/20', view: 'header-footer' as ViewType },
  { id: 'bates', label: 'Bates Number', desc: 'Page numbering', icon: Hash, color: 'text-slate-600', bg: 'bg-slate-50', ring: 'ring-slate-500/20', view: 'bates-number' as ViewType },
  { id: 'cleanup', label: 'PDF Cleanup', desc: 'Remove watermarks', icon: Sparkles, color: 'text-rose-600', bg: 'bg-rose-50', ring: 'ring-rose-500/20', view: 'cleanup' as ViewType },
  { id: 'terabox', label: 'Terabox Player', desc: 'Stream Terabox videos', icon: PlayCircle, color: 'text-indigo-600', bg: 'bg-indigo-50', ring: 'ring-indigo-500/20', view: 'terabox-player' as ViewType },
]

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
}

/** The home view content - redesigned for user-friendliness */
function HomeView() {
  const { setCurrentView, recentFiles } = useAppStore()

  return (
    <div className="flex-1 overflow-auto pb-16 md:pb-0">
      {/* ─── Hero Section — Clean & Inviting ──────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#4A90D9] via-[#5B9FE6] to-[#3A7BC8] px-4 sm:px-6 md:px-10 pt-5 sm:pt-8 pb-6 sm:pb-10">
        {/* Decorative shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/[0.06] rounded-full" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-white/[0.04] rounded-full" />
          <div className="absolute top-8 right-1/3 w-20 h-20 bg-white/[0.03] rounded-full" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            {/* Top line — hidden on mobile since header shows branding */}
            <motion.div variants={fadeUp} className="hidden sm:flex items-center gap-2 mb-5">
              <img
                src="/logo-horizontal.png"
                alt="CreatorTools"
                width={120}
                height={28}
                className="opacity-80 h-7 w-auto"
              />
            </motion.div>

            {/* Heading */}
            <motion.h1
              variants={fadeUp}
              className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight mb-1.5 sm:mb-2"
            >
              What would you like to do?
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-xs sm:text-sm md:text-base text-white/70 max-w-lg leading-relaxed mb-4 sm:mb-6"
            >
              Upload a PDF to get started, or choose a tool below.
            </motion.p>

            {/* Upload CTA */}
            <motion.div variants={fadeUp}>
              <FileUpload mode="full" className="mb-0" />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 py-5 sm:py-8 space-y-6 sm:space-y-10">

        {/* ─── Popular Tools Grid ─────────────────────────────────────────── */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Popular Tools</h2>
            </div>
            <button
              onClick={() => setCurrentView('all-tools')}
              className="text-xs font-medium text-[#4A90D9] hover:text-[#3A7BC8] flex items-center gap-1 group transition-colors"
            >
              View all
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3 justify-items-center">
            {popularTools.map((tool) => (
              <motion.button
                key={tool.id}
                variants={fadeUp}
                onClick={() => setCurrentView(tool.view)}
                className="group flex flex-col items-center text-center p-2.5 sm:p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-md transition-all cursor-pointer active:scale-95 sm:active:scale-100"
                whileHover={typeof window !== 'undefined' && window.innerWidth >= 640 ? { y: -3 } : undefined}
                whileTap={{ scale: 0.97 }}
              >
                <div className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-1.5 sm:mb-2.5 ring-1', tool.bg, tool.ring)}>
                  <tool.icon className={cn('w-4 h-4 sm:w-5 sm:h-5', tool.color)} />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight">{tool.label}</span>
                <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 hidden sm:block">{tool.desc}</span>
              </motion.button>
            ))}
          </div>
        </motion.section>

        {/* ─── Recent Files ──────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <RecentFiles />
        </motion.section>

        {/* ─── Trust & Security Badges ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">Your Data is Safe</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">256-bit Encryption</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">Files encrypted in transit & at rest</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Auto-Deleted After 30 Days</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">Your files don&apos;t stay on our servers</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                  <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Trusted by 2M+ Users</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">Enterprise-grade PDF tools</p>
                </div>
              </div>
            </div>
            <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                SOC 2 Compliant · GDPR Ready · ISO 27001
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function HomeContent() {
  const { currentView, setCurrentView } = useAppStore()
  const searchParams = useSearchParams()

  // Handle ?tool=<viewId> query param for SEO/sitemap deep links
  useEffect(() => {
    const tool = searchParams.get('tool')
    if (tool) {
      const validViews: ViewType[] = [
        'home', 'all-tools', 'pdf-viewer', 'combine-files', 'batch-print',
        'convert', 'ocr', 'compress', 'qr-generator', 'extract-text',
        'watermark', 'security', 'header-footer', 'bates-number',
        'background', 'crop', 'sign', 'cleanup', 'terabox-player', 'settings',
      ]
      if (validViews.includes(tool as ViewType)) {
        setCurrentView(tool as ViewType)
      }
    }
  }, [searchParams, setCurrentView])

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
      case 'extract-text':
        return <ExtractText />
      case 'watermark':
        return <WatermarkPdf />
      case 'security':
        return <SecurityPdf />
      case 'header-footer':
        return <HeaderFooterPdf />
      case 'bates-number':
        return <BatesNumberPdf />
      case 'background':
        return <BackgroundPdf />
      case 'crop':
        return <CropPdf />
      case 'sign':
        return <SignPdf />
      case 'cleanup':
        return <CleanupPdf />
      case 'terabox-player':
        return <TeraboxPlayer />
      case 'settings':
        return <SettingsPage />
      case 'qr-generator':
        return <QrGenerator />
      default:
        return <HomeView />
    }
  }

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#F5F5F5] dark:bg-gray-950">
      {/* Mobile Header */}
      <MobileHeader />

      {/* Main content area */}
      <div className="flex-1 flex min-w-0 min-h-0">
        {/* Desktop Sidebar */}
        <AppSidebar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {renderMainContent()}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}
