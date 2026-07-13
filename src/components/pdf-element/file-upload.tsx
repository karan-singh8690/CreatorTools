'use client'

import { useCallback, useState, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAppStore, UploadProgress, UPLOAD_LIMITS, formatFileSize } from '@/store/app-store'
import {
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Copy,
  Shield,
  ShieldCheck,
  ShieldAlert,
  FileSearch,
  Layers,
  Hash,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface FileUploadProps {
  /** Compact mode for sidebar, full mode for main area */
  mode?: 'compact' | 'full'
  /** Callback when upload completes */
  onUploadComplete?: () => void
  /** Additional class names */
  className?: string
}

// ─── Status Icon Component ───────────────────────────────────────────────────

function StatusIcon({ status, className }: { status: UploadProgress['status']; className?: string }) {
  switch (status) {
    case 'validating':
      return <FileSearch className={cn('animate-pulse', className)} />
    case 'uploading':
      return <Loader2 className={cn('animate-spin', className)} />
    case 'success':
      return <CheckCircle2 className={cn('text-green-600', className)} />
    case 'error':
      return <XCircle className={cn('text-red-500', className)} />
    case 'duplicate':
      return <Copy className={cn('text-amber-500', className)} />
  }
}

function ScanIcon({ status }: { status?: string }) {
  switch (status) {
    case 'clean':
      return <ShieldCheck className="w-3 h-3 text-green-500" />
    case 'threat':
      return <ShieldAlert className="w-3 h-3 text-red-500" />
    default:
      return <Shield className="w-3 h-3 text-gray-400" />
  }
}

// ─── Compact Mode ────────────────────────────────────────────────────────────

function CompactUpload({ onUploadComplete, className }: Omit<FileUploadProps, 'mode'>) {
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
          fileSize: f.size,
          progress: 0,
          status: 'validating' as const,
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
        setTimeout(() => {
          setProgresses([])
        }, 5000)
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
    maxSize: UPLOAD_LIMITS.MAX_FILE_SIZE,
  })

  const hasProgress = progresses.length > 0
  const allDone = hasProgress && progresses.every((p) => p.status !== 'uploading' && p.status !== 'validating')
  const successCount = progresses.filter((p) => p.status === 'success').length
  const errorCount = progresses.filter((p) => p.status === 'error').length
  const dupCount = progresses.filter((p) => p.status === 'duplicate').length

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
              <StatusIcon status={p.status} className="w-3 h-3 shrink-0" />
              <span className="text-[10px] text-gray-400 truncate flex-1">{p.fileName}</span>
              {p.status === 'uploading' && (
                <span className="text-[9px] text-[#4A90D9] shrink-0">{p.progress}%</span>
              )}
            </div>
          ))}
          {allDone && (
            <p className="text-[9px] text-center text-gray-400 pt-0.5">
              {successCount > 0 && <span className="text-green-500">{successCount} uploaded</span>}
              {dupCount > 0 && <span className="text-amber-500 ml-1">{dupCount} duplicate{dupCount > 1 ? 's' : ''}</span>}
              {errorCount > 0 && <span className="text-red-500 ml-1">{errorCount} failed</span>}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Full Mode ───────────────────────────────────────────────────────────────

function FullUpload({ onUploadComplete, className }: Omit<FileUploadProps, 'mode'>) {
  const { uploadFiles, setCurrentView } = useAppStore()
  const [progresses, setProgresses] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOverWindow, setIsDragOverWindow] = useState(false)
  const dragCounterRef = useRef(0)

  // Global drag-and-drop overlay
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current++
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragOverWindow(true)
      }
    }
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        setIsDragOverWindow(false)
      }
    }
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragOverWindow(false)
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (acceptedFiles.length === 0 && rejectedFiles.length > 0) {
        // Show rejection reasons
        const rejectedProgresses: UploadProgress[] = rejectedFiles.map((r) => ({
          fileName: r.file?.name || 'Unknown file',
          fileSize: r.file?.size || 0,
          progress: 100,
          status: 'error' as const,
          error: r.errors?.[0]?.message || 'File not accepted. Only PDF files up to 100MB are allowed.',
          errorCode: r.errors?.[0]?.code,
        }))
        setProgresses(rejectedProgresses)
        setTimeout(() => setProgresses([]), 8000)
        return
      }

      if (acceptedFiles.length === 0) return

      setIsUploading(true)
      setProgresses(
        acceptedFiles.map((f) => ({
          fileName: f.name,
          fileSize: f.size,
          progress: 0,
          status: 'validating' as const,
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
        // Keep results visible longer for review
        setTimeout(() => {
          setProgresses([])
        }, 8000)
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
    maxSize: UPLOAD_LIMITS.MAX_FILE_SIZE,
    maxFiles: UPLOAD_LIMITS.MAX_BATCH_SIZE,
  })

  const hasProgress = progresses.length > 0
  const allDone = hasProgress && progresses.every((p) => p.status !== 'uploading' && p.status !== 'validating')
  const successCount = progresses.filter((p) => p.status === 'success').length
  const errorCount = progresses.filter((p) => p.status === 'error').length
  const dupCount = progresses.filter((p) => p.status === 'duplicate').length
  const totalFiles = progresses.length
  const overallProgress = hasProgress
    ? Math.round(progresses.reduce((acc, p) => acc + p.progress, 0) / totalFiles)
    : 0

  return (
    <>
      {/* Global drag overlay */}
      {isDragOverWindow && !isUploading && (
        <div className="fixed inset-0 z-50 bg-[#4A90D9]/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-dashed border-[#4A90D9] p-12 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-20 h-20 rounded-2xl bg-[#4A90D9]/10 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-10 h-10 text-[#4A90D9] animate-bounce" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-1">Drop your PDF files</h3>
            <p className="text-sm text-gray-500">Release to upload • Max 100MB per file</p>
          </div>
        </div>
      )}

      <div className={cn('space-y-4', className)}>
        {/* Upload Zone */}
        <div
          {...getRootProps()}
          className={cn(
            'relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all group',
            isDragActive && !isDragReject && 'border-[#4A90D9] bg-[#4A90D9]/5 scale-[1.01] shadow-lg shadow-[#4A90D9]/10',
            isDragReject && 'border-red-400 bg-red-50/50',
            !isDragActive && !isDragReject && 'border-gray-200 hover:border-[#4A90D9] hover:bg-gray-50/50',
            isUploading && 'pointer-events-none opacity-80'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center transition-all',
                isDragActive && !isDragReject ? 'bg-[#4A90D9]/10 scale-110' : 'bg-gray-100 group-hover:bg-[#4A90D9]/5',
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
                <FileText className="w-8 h-8 text-gray-400 group-hover:text-[#4A90D9] transition-colors" />
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700">
                {isUploading
                  ? `Uploading ${totalFiles} file${totalFiles > 1 ? 's' : ''}... (${overallProgress}%)`
                  : isDragActive
                    ? 'Drop your PDF files here'
                    : isDragReject
                      ? 'Only PDF files are accepted'
                      : 'Drag & drop PDF files here'}
              </p>
              {!isUploading && !isDragActive && !isDragReject && (
                <p className="text-xs text-gray-400 mt-1">
                  or <span className="text-[#4A90D9] underline">browse files</span> from your computer
                  <span className="mx-1.5">•</span>
                  Max {formatFileSize(UPLOAD_LIMITS.MAX_FILE_SIZE)} per file
                  <span className="mx-1.5">•</span>
                  Up to {UPLOAD_LIMITS.MAX_BATCH_SIZE} files
                </p>
              )}
            </div>

            {/* Security badges */}
            {!isUploading && !isDragActive && (
              <div className="flex items-center gap-3 mt-1">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Virus Scan</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">All uploads are scanned for malware and suspicious content</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Hash className="w-3 h-3" />
                        <span>Duplicate Detection</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">SHA256 hash comparison prevents duplicate file uploads</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Layers className="w-3 h-3" />
                        <span>Chunked Upload</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">Files over 20MB are uploaded in chunks for reliability</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>

          {/* Overall progress bar during upload */}
          {isUploading && hasProgress && (
            <div className="mt-4">
              <Progress value={overallProgress} className="h-2" />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-gray-400">
                  {successCount + dupCount + errorCount} / {totalFiles} files processed
                </span>
                <span className="text-[10px] text-[#4A90D9] font-medium">{overallProgress}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Upload Queue / Results */}
        {hasProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isUploading ? 'Upload Queue' : 'Upload Results'}
              </h4>
              {allDone && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-gray-400 hover:text-gray-600"
                  onClick={() => setProgresses([])}
                >
                  Clear
                </Button>
              )}
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
              {progresses.map((p, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition-all',
                    p.status === 'success' && 'border-green-200 bg-green-50/50',
                    p.status === 'error' && 'border-red-200 bg-red-50/50',
                    p.status === 'duplicate' && 'border-amber-200 bg-amber-50/50',
                    (p.status === 'uploading' || p.status === 'validating') && 'border-gray-200 bg-white'
                  )}
                >
                  {/* Status Icon */}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      p.status === 'success' && 'bg-green-100',
                      p.status === 'error' && 'bg-red-100',
                      p.status === 'duplicate' && 'bg-amber-100',
                      p.status === 'uploading' && 'bg-[#4A90D9]/5',
                      p.status === 'validating' && 'bg-gray-100'
                    )}
                  >
                    <StatusIcon
                      status={p.status}
                      className={cn(
                        'w-4 h-4',
                        p.status === 'uploading' && 'text-[#4A90D9]',
                        p.status === 'validating' && 'text-gray-500',
                      )}
                    />
                  </div>

                  {/* File Info + Progress */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm text-gray-700 truncate">{p.fileName}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {formatFileSize(p.fileSize)}
                        </span>
                      </div>

                      {/* Status badge */}
                      {p.status === 'success' && (
                        <span className="text-xs text-green-600 shrink-0 font-medium">Complete</span>
                      )}
                      {p.status === 'error' && (
                        <span className="text-xs text-red-500 shrink-0">{p.error || 'Failed'}</span>
                      )}
                      {p.status === 'duplicate' && (
                        <span className="text-xs text-amber-600 shrink-0 font-medium">Duplicate</span>
                      )}
                      {(p.status === 'uploading' || p.status === 'validating') && (
                        <span className="text-xs text-[#4A90D9] shrink-0 font-medium">{p.progress}%</span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {(p.status === 'uploading' || p.status === 'validating') && (
                      <Progress value={p.progress} className="h-1.5 mt-1.5" />
                    )}

                    {/* Duplicate details */}
                    {p.status === 'duplicate' && p.duplicateInfo && (
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-amber-700">
                        <Copy className="w-3 h-3" />
                        <span>
                          Already uploaded as <strong>{p.duplicateInfo.name}</strong> ({p.duplicateInfo.pages} pages, {formatFileSize(p.duplicateInfo.size)})
                        </span>
                      </div>
                    )}

                    {/* Validation warnings */}
                    {p.warnings && p.warnings.length > 0 && p.status === 'success' && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-500">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{p.warnings[0].message}</span>
                      </div>
                    )}

                    {/* Validation phase indicator */}
                    {p.status === 'validating' && (
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400">
                        <FileSearch className="w-3 h-3" />
                        <span>Validating file integrity & checking for duplicates...</span>
                      </div>
                    )}

                    {/* Security scan status */}
                    {p.status === 'success' && (
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-green-500">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Security scan passed</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary bar */}
            {allDone && (
              <div className={cn(
                'flex items-center justify-center gap-4 py-2 rounded-lg text-xs font-medium',
                errorCount > 0 || dupCount > 0 ? 'bg-gray-50' : 'bg-green-50'
              )}>
                {successCount > 0 && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {successCount} uploaded
                  </span>
                )}
                {dupCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Copy className="w-3.5 h-3.5" />
                    {dupCount} duplicate{dupCount > 1 ? 's' : ''}
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <XCircle className="w-3.5 h-3.5" />
                    {errorCount} failed
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function FileUpload({ mode = 'full', onUploadComplete, className }: FileUploadProps) {
  if (mode === 'compact') {
    return <CompactUpload onUploadComplete={onUploadComplete} className={className} />
  }
  return <FullUpload onUploadComplete={onUploadComplete} className={className} />
}
