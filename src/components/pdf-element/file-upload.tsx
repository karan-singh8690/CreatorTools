'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAppStore, UploadProgress } from '@/store/app-store'
import { FileText, Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

interface FileUploadProps {
  /** Compact mode for sidebar, full mode for main area */
  mode?: 'compact' | 'full'
  /** Callback when upload completes */
  onUploadComplete?: () => void
  /** Additional class names */
  className?: string
}

export function FileUpload({ mode = 'full', onUploadComplete, className }: FileUploadProps) {
  const { uploadFiles, setCurrentView } = useAppStore()
  const [progresses, setProgresses] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return

      setIsUploading(true)
      setProgresses(
        acceptedFiles.map((f) => ({
          fileName: f.name,
          progress: 0,
          status: 'uploading' as const,
        }))
      )

      try {
        const uploaded = await uploadFiles(acceptedFiles, (p) => {
          setProgresses([...p])
        })

        if (uploaded.length > 0) {
          onUploadComplete?.()
          setCurrentView('home')
        }
      } finally {
        setIsUploading(false)
        // Keep progress visible for a moment then clear
        setTimeout(() => {
          setProgresses([])
        }, 3000)
      }
    },
    [uploadFiles, onUploadComplete, setCurrentView]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
    disabled: isUploading,
  })

  const hasProgress = progresses.length > 0
  const allDone = hasProgress && progresses.every((p) => p.status !== 'uploading')
  const hasError = progresses.some((p) => p.status === 'error')

  if (mode === 'compact') {
    return (
      <div className={cn('space-y-2', className)}>
        <div
          {...getRootProps()}
          className={cn(
            'relative cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-all',
            isDragActive && !isDragReject && 'border-[#4A90D9] bg-blue-50/50',
            isDragReject && 'border-red-400 bg-red-50/50',
            !isDragActive && !isDragReject && 'border-gray-600 hover:border-gray-400 bg-transparent',
            isUploading && 'pointer-events-none opacity-70'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-1.5">
            {isUploading ? (
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            ) : isDragActive ? (
              <Upload className="w-5 h-5 text-[#4A90D9]" />
            ) : (
              <FileText className="w-5 h-5 text-gray-500" />
            )}
            <p className="text-[11px] text-gray-400">
              {isUploading
                ? 'Uploading...'
                : isDragActive
                  ? 'Drop PDF here'
                  : 'Drop or click to upload'}
            </p>
          </div>
        </div>

        {/* Compact progress items */}
        {hasProgress && (
          <div className="space-y-1">
            {progresses.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {p.status === 'uploading' && (
                  <Loader2 className="w-3 h-3 text-gray-400 animate-spin shrink-0" />
                )}
                {p.status === 'success' && (
                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                )}
                {p.status === 'error' && (
                  <XCircle className="w-3 h-3 text-red-500 shrink-0" />
                )}
                <span className="text-[10px] text-gray-400 truncate flex-1">{p.fileName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Full mode
  return (
    <div className={cn('space-y-4', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all',
          isDragActive && !isDragReject && 'border-[#4A90D9] bg-blue-50/50 scale-[1.01]',
          isDragReject && 'border-red-400 bg-red-50/50',
          !isDragActive && !isDragReject && 'border-gray-200 hover:border-[#4A90D9] hover:bg-gray-50',
          isUploading && 'pointer-events-none opacity-70'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
              isDragActive && !isDragReject ? 'bg-[#4A90D9]/10' : 'bg-gray-100',
              isDragReject && 'bg-red-100'
            )}
          >
            {isUploading ? (
              <Loader2 className="w-8 h-8 text-[#4A90D9] animate-spin" />
            ) : isDragActive ? (
              <Upload className="w-8 h-8 text-[#4A90D9]" />
            ) : isDragReject ? (
              <XCircle className="w-8 h-8 text-red-400" />
            ) : (
              <FileText className="w-8 h-8 text-gray-400" />
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">
              {isUploading
                ? 'Uploading files...'
                : isDragActive
                  ? 'Drop your PDF files here'
                  : isDragReject
                    ? 'Only PDF files are accepted'
                    : 'Drag & drop PDF files here'}
            </p>
            {!isUploading && !isDragActive && !isDragReject && (
              <p className="text-xs text-gray-400 mt-1">
                or <span className="text-[#4A90D9] underline">browse files</span> from your computer
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Upload progress list */}
      {hasProgress && (
        <div className="space-y-2">
          {progresses.map((p, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                p.status === 'success' && 'border-green-200 bg-green-50/50',
                p.status === 'error' && 'border-red-200 bg-red-50/50',
                p.status === 'uploading' && 'border-gray-200 bg-white'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  p.status === 'success' && 'bg-green-100',
                  p.status === 'error' && 'bg-red-100',
                  p.status === 'uploading' && 'bg-blue-50'
                )}
              >
                {p.status === 'uploading' && (
                  <Loader2 className="w-4 h-4 text-[#4A90D9] animate-spin" />
                )}
                {p.status === 'success' && (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
                {p.status === 'error' && (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 truncate">{p.fileName}</span>
                  {p.status === 'success' && (
                    <span className="text-xs text-green-600 shrink-0">Complete</span>
                  )}
                  {p.status === 'error' && (
                    <span className="text-xs text-red-500 shrink-0">
                      {p.error || 'Failed'}
                    </span>
                  )}
                </div>
                {p.status === 'uploading' && (
                  <Progress value={p.progress} className="h-1.5 mt-1.5" />
                )}
              </div>
            </div>
          ))}

          {allDone && !hasError && (
            <p className="text-xs text-center text-green-600 font-medium pt-1">
              All files uploaded successfully!
            </p>
          )}
          {allDone && hasError && (
            <p className="text-xs text-center text-red-500 font-medium pt-1">
              Some files failed to upload. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
