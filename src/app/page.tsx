'use client'

import { useAppStore } from '@/store/app-store'
import { AppSidebar } from '@/components/pdf-element/app-sidebar'
import { QuickTools } from '@/components/pdf-element/quick-tools'
import { RecentFiles } from '@/components/pdf-element/recent-files'
import { AllTools } from '@/components/pdf-element/all-tools'
import { PdfViewer } from '@/components/pdf-element/pdf-viewer'
import { CombineFiles } from '@/components/pdf-element/combine-files'
import { BatchPrint } from '@/components/pdf-element/batch-print'

export default function Home() {
  const { currentView } = useAppStore()

  const renderMainContent = () => {
    switch (currentView) {
      case 'home':
        return (
          <div className="flex-1 overflow-auto p-6">
            <QuickTools />
            <RecentFiles />
          </div>
        )
      case 'all-tools':
        return <AllTools />
      case 'pdf-viewer':
        return <PdfViewer />
      case 'combine-files':
        return <CombineFiles />
      case 'batch-print':
        return <BatchPrint />
      case 'convert':
      case 'ocr':
      case 'compress':
        return <FeaturePlaceholder />
      default:
        return (
          <div className="flex-1 overflow-auto p-6">
            <QuickTools />
            <RecentFiles />
          </div>
        )
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

function FeaturePlaceholder() {
  const { setCurrentView } = useAppStore()
  const view = useAppStore((s) => s.currentView)

  const featureInfo: Record<string, { title: string; description: string }> = {
    convert: {
      title: 'Convert PDF',
      description: 'Convert PDF files to Word, Excel, PPT, images, and other formats with high accuracy.',
    },
    ocr: {
      title: 'OCR PDF',
      description: 'Convert scanned documents and images into searchable and editable PDF files using advanced OCR technology.',
    },
    compress: {
      title: 'Compress PDF',
      description: 'Reduce PDF file size while maintaining quality for easier sharing and storage.',
    },
  }

  const info = featureInfo[view] || { title: 'Feature', description: 'Coming soon.' }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📄</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">{info.title}</h2>
        <p className="text-sm text-gray-500 mb-6">{info.description}</p>
        <button
          onClick={() => setCurrentView('home')}
          className="text-sm text-[#4A90D9] hover:underline"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  )
}
