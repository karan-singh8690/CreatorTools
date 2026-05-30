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

export default function Home() {
  const { currentView } = useAppStore()

  const renderMainContent = () => {
    switch (currentView) {
      case 'home':
        return (
          <div className="flex-1 overflow-auto p-6">
            <QuickTools />
            <FileUpload mode="full" className="mb-6" />
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
        return <ConvertPdf />
      case 'ocr':
        return <OcrPdf />
      case 'compress':
        return <CompressPdf />
      default:
        return (
          <div className="flex-1 overflow-auto p-6">
            <QuickTools />
            <FileUpload mode="full" className="mb-6" />
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
