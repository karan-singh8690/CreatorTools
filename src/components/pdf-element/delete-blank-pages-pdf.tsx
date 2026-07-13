'use client'

import { useState } from 'react'
import { useAppStore, PdfFile } from '@/store/app-store'
import { PdfToolLayout } from '@/components/pdf-element/pdf-tool-layout'
import { Button } from '@/components/ui/button'
import { Trash2, Info, FileText, FileCheck } from 'lucide-react'
import { toast } from 'sonner'

export function DeleteBlankPagesPdf() {
  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [resultInfo, setResultInfo] = useState<React.ReactNode>(null)

  const handleProcess = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    try {
      const response = await fetch(`/api/files/${selectedFile.id}/delete-blank-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('Failed to delete blank pages')
      const data = await response.json()
      const deletedCount = data.deletedCount || 0
      const originalPages = selectedFile.pages
      const newPages = originalPages - deletedCount
      setDownloadUrl(`/api/files/${data.file.id}/download?download=1`)
      setResultInfo(
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">Blank Pages Removed</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 bg-white rounded-lg border border-emerald-200">
              <p className="text-lg font-bold text-gray-800">{originalPages}</p>
              <p className="text-[10px] text-gray-500">Original Pages</p>
            </div>
            <div className="text-center p-2 bg-white rounded-lg border border-red-200">
              <p className="text-lg font-bold text-red-600">-{deletedCount}</p>
              <p className="text-[10px] text-gray-500">Pages Deleted</p>
            </div>
            <div className="text-center p-2 bg-white rounded-lg border border-emerald-200">
              <p className="text-lg font-bold text-emerald-600">{newPages}</p>
              <p className="text-[10px] text-gray-500">Final Pages</p>
            </div>
          </div>
          {deletedCount === 0 && (
            <p className="text-xs text-gray-500">No blank pages were found in this document.</p>
          )}
        </div>
      )
      toast.success(
        deletedCount > 0
          ? `Removed ${deletedCount} blank page${deletedCount !== 1 ? 's' : ''}`
          : 'No blank pages found'
      )
    } catch (error) {
      toast.error('Failed to delete blank pages')
    } finally {
      setIsProcessing(false)
    }
  }

  const clearResults = () => {
    setDownloadUrl(null)
    setResultInfo(null)
  }

  return (
    <PdfToolLayout
      title="Delete Blank Pages"
      description="Detect and remove blank pages from your PDF"
      icon={Trash2}
      iconColor="text-slate-600"
      iconBg="bg-slate-50"
      selectedFile={selectedFile}
      onFileSelect={setSelectedFile}
      isProcessing={isProcessing}
      downloadUrl={downloadUrl}
      downloadName={`${selectedFile?.originalName?.replace('.pdf', '') || 'result'}_no_blanks.pdf`}
      resultInfo={resultInfo}
      onClearResult={clearResults}
    >
      <div className="space-y-4">
        {/* Info Message */}
        <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-700">
            This tool will scan all pages and remove those that appear to be blank (containing no
            text content). Pages with images or decorative elements will be preserved.
          </p>
        </div>

        {/* File Info */}
        {selectedFile && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <FileText className="w-5 h-5 text-slate-500 shrink-0" />
            <div className="text-xs text-gray-600">
              <span className="font-medium">{selectedFile.pages}</span> page
              {selectedFile.pages !== 1 ? 's' : ''} will be scanned
            </div>
          </div>
        )}

        {/* Scan & Delete Button */}
        <Button
          onClick={handleProcess}
          disabled={isProcessing}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          size="lg"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Scan &amp; Delete Blank Pages
        </Button>
      </div>
    </PdfToolLayout>
  )
}
