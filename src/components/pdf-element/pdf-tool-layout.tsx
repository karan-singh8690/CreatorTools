'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore, PdfFile, formatFileSize } from '@/store/app-store'
import { shouldNotify, shouldAutoDownload, applyFileNamePattern, loadSettings, playNotificationSound } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'
import {
  X,
  Upload,
  FileText,
  ArrowLeft,
  Loader2,
  Download,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface PdfToolLayoutProps {
  title: string
  description: string
  icon: React.ElementType
  iconColor?: string
  iconBg?: string
  children: React.ReactNode
  /** If the tool has its own file selection, hide the default one */
  hideFileSelection?: boolean
  /** Selected file from parent */
  selectedFile?: PdfFile | null
  /** Callback when file is selected */
  onFileSelect?: (file: PdfFile) => void
  /** Whether processing is happening */
  isProcessing?: boolean
  /** Download URL for result */
  downloadUrl?: string | null
  /** Download filename */
  downloadName?: string
  /** Result info to display */
  resultInfo?: React.ReactNode
  /** Clear result */
  onClearResult?: () => void
  /** Accept file types */
  accept?: string
}

export function PdfToolLayout({
  title,
  description,
  icon: Icon,
  iconColor = 'text-orange-600',
  iconBg = 'bg-orange-50',
  children,
  hideFileSelection = false,
  selectedFile: externalFile,
  onFileSelect: externalOnFileSelect,
  isProcessing = false,
  downloadUrl,
  downloadName = 'result.pdf',
  resultInfo,
  onClearResult,
  accept = '.pdf,application/pdf',
}: PdfToolLayoutProps) {
  const { setCurrentView, recentFiles, uploadFiles, fetchFiles } = useAppStore()
  const [internalFile, setInternalFile] = useState<PdfFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedFile = externalFile ?? internalFile
  const onFileSelect = externalOnFileSelect ?? setInternalFile

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      setIsUploading(true)
      try {
        const uploaded = await uploadFiles(Array.from(files))
        await fetchFiles()
        if (uploaded.length > 0) {
          onFileSelect(uploaded[0])
          if (shouldNotify('upload')) {
            playNotificationSound()
            toast.success('File uploaded successfully')
          }
        }
      } catch (err) {
        if (shouldNotify('error')) {
          playNotificationSound()
          toast.error('Failed to upload file')
        }
      } finally {
        setIsUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [uploadFiles, fetchFiles, onFileSelect]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.includes('pdf')
      )
      if (files.length === 0) {
        if (shouldNotify('error')) toast.error('Please drop a PDF file')
        return
      }

      setIsUploading(true)
      try {
        const uploaded = await uploadFiles(files)
        await fetchFiles()
        if (uploaded.length > 0) {
          onFileSelect(uploaded[0])
          if (shouldNotify('upload')) {
            playNotificationSound()
            toast.success('File uploaded successfully')
          }
        }
      } catch (err) {
        if (shouldNotify('error')) {
          playNotificationSound()
          toast.error('Failed to upload file')
        }
      } finally {
        setIsUploading(false)
      }
    },
    [uploadFiles, fetchFiles, onFileSelect]
  )

  const handleDownload = useCallback(() => {
    if (!downloadUrl) return
    const settings = loadSettings()
    const finalName = applyFileNamePattern(settings.fileNamePattern, downloadName, title)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = finalName
    a.click()
    if (shouldNotify('process')) {
      playNotificationSound()
      toast.success('Download started')
    }
  }, [downloadUrl, downloadName, title])

  // Auto-download when downloadUrl becomes available and autoDownload is enabled
  const prevDownloadUrl = useRef<string | null>(null)
  useEffect(() => {
    if (downloadUrl && downloadUrl !== prevDownloadUrl.current && shouldAutoDownload()) {
      prevDownloadUrl.current = downloadUrl
      handleDownload()
    }
  }, [downloadUrl, handleDownload])

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('home')}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', iconBg)}>
            <Icon className={cn('w-4.5 h-4.5', iconColor)} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{description}</p>
          </div>
        </div>
        <button
          onClick={() => setCurrentView('home')}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {/* File Selection (if no file selected and not hidden) */}
          {!hideFileSelection && !selectedFile && (
            <div className="mb-6">
              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  'relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer',
                  isDragging
                    ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-950/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 hover:bg-orange-50/20 dark:hover:bg-orange-950/10'
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={accept}
                  className="hidden"
                  onChange={handleFileInput}
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                    <p className="text-sm text-gray-500">Uploading file...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        Drop your PDF here or <span className="text-orange-600 dark:text-orange-400">browse</span>
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Select a PDF file to get started
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Or select from recent files */}
              {recentFiles.length > 0 && (
                <div className="mt-4">
                  <div className="relative">
                    <button
                      onClick={() => setShowFilePicker(!showFilePicker)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span>Select from recent files</span>
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 transition-transform',
                          showFilePicker && 'rotate-180'
                        )}
                      />
                    </button>
                    {showFilePicker && (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg max-h-60 overflow-y-auto">
                        {recentFiles.map((file) => (
                          <button
                            key={file.id}
                            onClick={() => {
                              onFileSelect(file)
                              setShowFilePicker(false)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                          >
                            <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                                {file.originalName}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatFileSize(file.size)} · {file.pages} page
                                {file.pages !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selected file card */}
          {selectedFile && (
            <div className="mb-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-orange-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    {selectedFile.originalName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(selectedFile.size)} · {selectedFile.pages} page
                    {selectedFile.pages !== 1 ? 's' : ''}
                  </p>
                </div>
                {!externalOnFileSelect && (
                  <button
                    onClick={() => {
                      setInternalFile(null)
                      onClearResult?.()
                    }}
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tool-specific children */}
          {(selectedFile || hideFileSelection) && (
            <div className="space-y-6">
              {children}
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="mt-6 flex flex-col items-center gap-3 p-6 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Processing your PDF...</p>
              <p className="text-xs text-gray-400">This may take a moment</p>
            </div>
          )}

          {/* Result */}
          {resultInfo && !isProcessing && (
            <div className="mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
              {resultInfo}
            </div>
          )}

          {/* Download button */}
          {downloadUrl && !isProcessing && (
            <div className="mt-4">
              <Button
                onClick={handleDownload}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                size="lg"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Result
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** A reusable option card for tool settings */
export function OptionCard({
  label,
  description,
  selected,
  onClick,
  icon: Icon,
}: {
  label: string
  description: string
  selected: boolean
  onClick: () => void
  icon?: React.ElementType
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
        selected
          ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-950/20 shadow-sm'
          : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
      )}
    >
      {Icon && (
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            selected ? 'bg-orange-100 dark:bg-orange-900/40' : 'bg-gray-100 dark:bg-gray-800'
          )}
        >
          <Icon className={cn('w-4 h-4', selected ? 'text-orange-600' : 'text-gray-500')} />
        </div>
      )}
      <div className="min-w-0">
        <p
          className={cn(
            'text-sm font-medium',
            selected ? 'text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'
          )}
        >
          {label}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>
      </div>
    </button>
  )
}

/** Reusable input group */
export function InputGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {children}
    </div>
  )
}
