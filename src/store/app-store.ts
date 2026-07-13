import { create } from 'zustand'
import { loadSettings, formatDateWithFormat } from '@/hooks/use-settings'

export type ViewType = 'home' | 'all-tools' | 'pdf-viewer' | 'combine-files' | 'batch-print' | 'convert' | 'ocr' | 'compress' | 'qr-generator' | 'extract-text' | 'watermark' | 'security' | 'header-footer' | 'bates-number' | 'background' | 'crop' | 'sign' | 'settings'

export interface PdfFile {
  id: string
  name: string
  originalName: string
  size: number
  mimeType: string
  pages: number
  starred: boolean
  textContent: string | null
  filePath: string
  // New production fields
  fileHash?: string | null
  uploadStatus?: string
  metadata?: string | null
  virusScanStatus?: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface UploadProgress {
  fileName: string
  fileSize: number
  progress: number
  status: 'validating' | 'uploading' | 'success' | 'error' | 'duplicate'
  error?: string
  errorCode?: string
  duplicateInfo?: {
    id: string
    name: string
    originalName: string
    size: number
    pages: number
    createdAt: string
  }
  warnings?: { code: string; message: string }[]
}

// Keep backward-compatible alias
export type PDFFile = PdfFile

/** Format byte size to human-readable string (delegates to shared utility) */
export { formatStorageSize as formatFileSize } from '@/lib/bigint-utils'

/** Format date string to human-readable relative/absolute time using user settings */
export function formatDate(dateStr: string): string {
  try {
    const settings = loadSettings()
    return formatDateWithFormat(dateStr, settings.dateFormat)
  } catch {
    // Fallback if localStorage isn't available
    return formatDateWithFormat(dateStr, 'MM/DD/YYYY')
  }
}

// ─── Upload Configuration ────────────────────────────────────────────────────

export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_BATCH_SIZE: 20,
  ALLOWED_TYPES: ['application/pdf'],
  ALLOWED_EXTENSIONS: ['.pdf'],
  CHUNK_THRESHOLD: 20 * 1024 * 1024, // Files > 20MB use chunked upload
  CHUNK_SIZE: 5 * 1024 * 1024, // 5MB chunks
  MAX_CONCURRENT: 3,
} as const

// ─── Client-side SHA256 (Web Crypto API) ─────────────────────────────────────

export async function computeClientHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Upload with real progress using XMLHttpRequest ──────────────────────────

function uploadWithProgress(
  file: File,
  onProgress: (progress: number) => void
): Promise<{ response: Response; data: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    })

    xhr.addEventListener('load', () => {
      const response = new Response(xhr.response, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: new Headers({
          'Content-Type': xhr.getResponseHeader('Content-Type') || 'application/json',
        }),
      })

      let data: any
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        data = { error: 'Invalid response' }
      }

      resolve({ response, data })
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was aborted'))
    })

    xhr.open('POST', '/api/files')
    xhr.responseType = 'text'
    xhr.send(formData)
  })
}

// ─── Chunked Upload for Large Files ──────────────────────────────────────────

async function chunkedUploadWithProgress(
  file: File,
  fileHash: string,
  onProgress: (progress: number) => void
): Promise<{ data: any }> {
  const totalChunks = Math.ceil(file.size / UPLOAD_LIMITS.CHUNK_SIZE)

  // Step 1: Init session
  const initResponse = await fetch('/api/files/chunk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'init',
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      fileHash,
    }),
  })

  if (!initResponse.ok) {
    const errorData = await initResponse.json().catch(() => ({ error: 'Init failed' }))
    // Handle duplicate detection at init stage
    if (initResponse.status === 409) {
      throw Object.assign(new Error(errorData.error || 'Duplicate file'), {
        code: 'DUPLICATE_FILE',
        duplicate: errorData.duplicate,
      })
    }
    throw new Error(errorData.error || 'Failed to initialize chunked upload')
  }

  const { sessionId } = await initResponse.json()

  // Step 2: Upload chunks sequentially
  for (let i = 0; i < totalChunks; i++) {
    const start = i * UPLOAD_LIMITS.CHUNK_SIZE
    const end = Math.min(start + UPLOAD_LIMITS.CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    const chunkFormData = new FormData()
    chunkFormData.append('sessionId', sessionId)
    chunkFormData.append('chunkIndex', String(i))
    chunkFormData.append('chunk', chunk)

    const chunkResponse = await fetch('/api/files/chunk', {
      method: 'POST',
      body: chunkFormData,
    })

    if (!chunkResponse.ok) {
      throw new Error(`Chunk ${i + 1}/${totalChunks} upload failed`)
    }

    // Update progress: chunk progress + overall progress
    const chunkProgress = ((i + 1) / totalChunks) * 100
    onProgress(Math.round(chunkProgress))
  }

  // Step 3: Complete upload
  const completeResponse = await fetch('/api/files/chunk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'complete', sessionId }),
  })

  if (!completeResponse.ok) {
    const errorData = await completeResponse.json().catch(() => ({ error: 'Complete failed' }))
    if (completeResponse.status === 409) {
      throw Object.assign(new Error(errorData.error || 'Duplicate file'), {
        code: 'DUPLICATE_FILE',
        duplicate: errorData.duplicate,
      })
    }
    if (completeResponse.status === 422) {
      throw Object.assign(new Error(errorData.error || 'Security threat'), {
        code: 'VIRUS_DETECTED',
        threats: errorData.threats,
      })
    }
    throw new Error(errorData.error || 'Failed to complete chunked upload')
  }

  const data = await completeResponse.json()
  return { data }
}

// ─── Store Interface ─────────────────────────────────────────────────────────

interface AppState {
  // Navigation
  currentView: ViewType
  setCurrentView: (view: ViewType) => void

  // Sidebar
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  activeSidebarItem: string
  setActiveSidebarItem: (item: string) => void

  // Mobile
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void

  // Files
  recentFiles: PdfFile[]
  isLoadingFiles: boolean
  fetchFiles: (search?: string) => Promise<void>
  uploadFiles: (files: File[], onProgress?: (progresses: UploadProgress[]) => void) => Promise<PdfFile[]>
  toggleStar: (id: string) => Promise<void>
  deleteFile: (id: string) => Promise<void>
  renameFile: (id: string, name: string) => Promise<void>
  selectedFiles: string[]
  toggleFileSelection: (id: string) => void

  // PDF Viewer
  selectedPdfFile: PdfFile | null
  setSelectedPdfFile: (file: PdfFile | null) => void
  pdfPage: number
  setPdfPage: (page: number) => void
  pdfTotalPages: number
  setPdfTotalPages: (pages: number) => void

  // Chat
  chatMessages: ChatMessage[]
  addChatMessage: (message: ChatMessage) => void
  clearChatMessages: () => void
  isChatLoading: boolean
  setIsChatLoading: (loading: boolean) => void

  // Combine Files
  combineFiles: PdfFile[]
  addCombineFile: (file: PdfFile) => void
  removeCombineFile: (id: string) => void
  combineSelectedFiles: () => Promise<PdfFile | null>
  isCombining: boolean

  // Batch Print
  printFiles: PdfFile[]
  addPrintFile: (file: PdfFile) => void
  removePrintFile: (id: string) => void

  // Compress
  compressFile: (id: string, preset?: 'high-quality' | 'balanced' | 'maximum') => Promise<{
    file: PdfFile
    compression: { originalSize: number; compressedSize: number; savedBytes: number; savedPercent: string }
    operations?: { type: string; description: string; savedBytes: number; itemsProcessed: number }[]
    durationMs?: number
    preset?: string
  } | null>
  compressFilePreview: (id: string) => Promise<{
    preview: { estimatedSavings: number; estimatedOutputSize: number; originalSize: number; breakdown: any; analysis: any }
    fileInfo: { id: string; name: string; size: number; pages: number }
  } | null>
  batchCompress: (fileIds: string[], preset: 'high-quality' | 'balanced' | 'maximum') => Promise<{
    results: any[]
    summary: { total: number; success: number; errors: number; totalSavedBytes: number; preset: string }
  } | null>
  isCompressing: boolean
  compressionProgress: { current: number; total: number; fileName: string } | null

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void

  // View mode
  viewMode: 'list' | 'grid'
  setViewMode: (mode: 'list' | 'grid') => void

  // File filter
  fileFilter: 'all' | 'starred'
  setFileFilter: (filter: 'all' | 'starred') => void
}

// Always initialize with false to avoid hydration mismatch.
// SettingsInitializer will apply the user's saved preference on the client after mount.
function getInitialSidebarCollapsed(): boolean {
  return false
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  currentView: 'home',
  setCurrentView: (view) => set({ currentView: view }),

  // Sidebar — initialize from user settings
  sidebarCollapsed: getInitialSidebarCollapsed(),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  activeSidebarItem: 'recent-files',
  setActiveSidebarItem: (item) => set({ activeSidebarItem: item }),

  // Mobile
  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  // Files
  recentFiles: [],
  isLoadingFiles: false,
  fetchFiles: async (search?: string) => {
    set({ isLoadingFiles: true })
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const response = await fetch(`/api/files?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch files')
      const data = await response.json()
      set({ recentFiles: data.files || [] })
    } catch (error) {
      console.error('Fetch files error:', error)
    } finally {
      set({ isLoadingFiles: false })
    }
  },

  // ─── Enhanced Upload with Validation, Progress, Duplicate Detection ──────
  uploadFiles: async (files: File[], onProgress?: (progresses: UploadProgress[]) => void) => {
    // Initialize progress for all files
    const progresses: UploadProgress[] = files.map((f) => ({
      fileName: f.name,
      fileSize: f.size,
      progress: 0,
      status: 'validating' as const,
    }))
    onProgress?.(progresses)

    const uploadedFiles: PdfFile[] = []

    // ── Client-side pre-validation ────────────────────────────────────────
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Check file extension
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
      if (!UPLOAD_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
        progresses[i] = {
          ...progresses[i],
          status: 'error',
          error: `Invalid file type. Only PDF files are accepted.`,
          errorCode: 'INVALID_EXTENSION',
        }
        onProgress?.([...progresses])
        continue
      }

      // Check file size
      if (file.size > UPLOAD_LIMITS.MAX_FILE_SIZE) {
        progresses[i] = {
          ...progresses[i],
          status: 'error',
          error: `File size (${formatFileSize(file.size)}) exceeds limit (${formatFileSize(UPLOAD_LIMITS.MAX_FILE_SIZE)})`,
          errorCode: 'SIZE_EXCEEDED',
        }
        onProgress?.([...progresses])
        continue
      }

      if (file.size < 100) {
        progresses[i] = {
          ...progresses[i],
          status: 'error',
          error: 'File is too small to be a valid PDF',
          errorCode: 'SIZE_TOO_SMALL',
        }
        onProgress?.([...progresses])
        continue
      }
    }

    // ── Process files with concurrent uploads ─────────────────────────────
    const filesToUpload = files.filter((_, i) => progresses[i].status !== 'error')
    const results = new Map<number, { file?: PdfFile; error?: any }>()

    // Process with limited concurrency
    const queue = [...filesToUpload.map((f, idx) => {
      const originalIndex = files.indexOf(f)
      return { file: f, originalIndex }
    })]

    const processFile = async (item: { file: File; originalIndex: number }) => {
      const { file, originalIndex } = item
      const isLargeFile = file.size > UPLOAD_LIMITS.CHUNK_THRESHOLD

      try {
        // Phase 1: Client-side hash for large files (pre-dup check)
        let clientHash: string | undefined
        if (isLargeFile) {
          progresses[originalIndex] = {
            ...progresses[originalIndex],
            progress: 5,
            status: 'validating' as const,
          }
          onProgress?.([...progresses])

          clientHash = await computeClientHash(file)

          // Pre-flight duplicate check for large files
          const checkResponse = await fetch(`/api/files/check-duplicate?hash=${clientHash}`)
          if (checkResponse.ok) {
            const checkData = await checkResponse.json()
            if (checkData.isDuplicate) {
              progresses[originalIndex] = {
                ...progresses[originalIndex],
                progress: 100,
                status: 'duplicate' as const,
                duplicateInfo: checkData.existingFile,
              }
              onProgress?.([...progresses])
              results.set(originalIndex, { error: { code: 'DUPLICATE_FILE', duplicate: checkData } })
              return
            }
          }
        }

        // Phase 2: Upload
        progresses[originalIndex] = {
          ...progresses[originalIndex],
          progress: isLargeFile ? 10 : 0,
          status: 'uploading' as const,
        }
        onProgress?.([...progresses])

        let data: any

        if (isLargeFile && clientHash) {
          // Chunked upload for large files
          const result = await chunkedUploadWithProgress(file, clientHash, (p) => {
            // Map chunk progress to 10-95 range (leave 5% for post-processing)
            const mappedProgress = 10 + Math.round(p * 0.85)
            progresses[originalIndex] = {
              ...progresses[originalIndex],
              progress: mappedProgress,
            }
            onProgress?.([...progresses])
          })
          data = result.data
        } else {
          // Standard upload with real progress
          const result = await uploadWithProgress(file, (p) => {
            // Map XHR progress to 0-95 range
            const mappedProgress = Math.round(p * 0.95)
            progresses[originalIndex] = {
              ...progresses[originalIndex],
              progress: mappedProgress,
            }
            onProgress?.([...progresses])
          })

          if (result.response.status === 409) {
            // Duplicate detected
            progresses[originalIndex] = {
              ...progresses[originalIndex],
              progress: 100,
              status: 'duplicate' as const,
              duplicateInfo: result.data.duplicate?.existingFile,
            }
            onProgress?.([...progresses])
            results.set(originalIndex, { error: { code: 'DUPLICATE_FILE', duplicate: result.data.duplicate } })
            return
          }

          if (result.response.status === 422) {
            // Virus detected
            progresses[originalIndex] = {
              ...progresses[originalIndex],
              progress: 100,
              status: 'error' as const,
              error: result.data.error || 'Security threat detected',
              errorCode: 'VIRUS_DETECTED',
            }
            onProgress?.([...progresses])
            results.set(originalIndex, { error: { code: 'VIRUS_DETECTED' } })
            return
          }

          if (!result.response.ok) {
            const errorMsg = result.data?.error || 'Upload failed'
            const errorCode = result.data?.code || 'UPLOAD_FAILED'
            throw Object.assign(new Error(errorMsg), { code: errorCode })
          }

          data = result.data
        }

        // Phase 3: Success
        progresses[originalIndex] = {
          ...progresses[originalIndex],
          progress: 100,
          status: 'success',
          warnings: data.warnings,
        }
        onProgress?.([...progresses])

        results.set(originalIndex, { file: data.file })
      } catch (error: any) {
        const errorCode = error.code || 'UPLOAD_FAILED'
        const errorMessage = error.message || 'Upload failed'

        // Check if this was a duplicate from chunked upload
        if (errorCode === 'DUPLICATE_FILE' && error.duplicate) {
          progresses[originalIndex] = {
            ...progresses[originalIndex],
            progress: 100,
            status: 'duplicate' as const,
            duplicateInfo: error.duplicate.existingFile,
          }
          onProgress?.([...progresses])
          results.set(originalIndex, { error: { code: 'DUPLICATE_FILE', duplicate: error.duplicate } })
          return
        }

        progresses[originalIndex] = {
          ...progresses[originalIndex],
          progress: 100,
          status: 'error',
          error: errorMessage,
          errorCode,
        }
        onProgress?.([...progresses])
        results.set(originalIndex, { error })
      }
    }

    // Run with limited concurrency
    const executing: Promise<void>[] = []
    for (const item of queue) {
      const p = processFile(item).then(() => {
        executing.splice(executing.indexOf(p), 1)
      })
      executing.push(p)

      if (executing.length >= UPLOAD_LIMITS.MAX_CONCURRENT) {
        await Promise.race(executing)
      }
    }
    await Promise.all(executing)

    // Collect successful uploads
    for (const [_, result] of results) {
      if (result.file) {
        uploadedFiles.push(result.file)
      }
    }

    // Refresh file list after upload
    if (uploadedFiles.length > 0) {
      await get().fetchFiles()
    }

    return uploadedFiles
  },

  toggleStar: async (id: string) => {
    const file = get().recentFiles.find((f) => f.id === id)
    if (!file) return

    // Optimistic update
    set({
      recentFiles: get().recentFiles.map((f) =>
        f.id === id ? { ...f, starred: !f.starred } : f
      ),
    })

    try {
      const response = await fetch(`/api/files/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: !file.starred }),
      })

      if (!response.ok) {
        // Revert on error
        set({
          recentFiles: get().recentFiles.map((f) =>
            f.id === id ? { ...f, starred: file.starred } : f
          ),
        })
        throw new Error('Failed to toggle star')
      }

      const data = await response.json()
      set({
        recentFiles: get().recentFiles.map((f) =>
          f.id === id ? data.file : f
        ),
      })
    } catch (error) {
      console.error('Toggle star error:', error)
    }
  },
  deleteFile: async (id: string) => {
    // Optimistic update - removes file from ALL lists
    const previousFiles = get().recentFiles
    const previousCombine = get().combineFiles
    const previousPrint = get().printFiles
    set({
      recentFiles: previousFiles.filter((f) => f.id !== id),
      combineFiles: previousCombine.filter((f) => f.id !== id),
      printFiles: previousPrint.filter((f) => f.id !== id),
    })

    try {
      const response = await fetch(`/api/files/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        // Revert on error
        set({
          recentFiles: previousFiles,
          combineFiles: previousCombine,
          printFiles: previousPrint,
        })
        const errorData = await response.json().catch(() => ({ error: 'Delete failed' }))
        throw new Error(errorData.error || 'Failed to delete file')
      }
      // Refresh file list from server to ensure consistency
      await get().fetchFiles()
    } catch (error) {
      console.error('Delete file error:', error)
      throw error
    }
  },
  renameFile: async (id: string, name: string) => {
    // Optimistic update
    const previousFiles = get().recentFiles
    set({
      recentFiles: get().recentFiles.map((f) =>
        f.id === id ? { ...f, name } : f
      ),
    })

    try {
      const response = await fetch(`/api/files/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        set({ recentFiles: previousFiles })
        throw new Error('Failed to rename file')
      }

      const data = await response.json()
      set({
        recentFiles: get().recentFiles.map((f) =>
          f.id === id ? data.file : f
        ),
      })
    } catch (error) {
      console.error('Rename file error:', error)
    }
  },
  selectedFiles: [],
  toggleFileSelection: (id) =>
    set((state) => ({
      selectedFiles: state.selectedFiles.includes(id)
        ? state.selectedFiles.filter((fid) => fid !== id)
        : [...state.selectedFiles, id],
    })),

  // PDF Viewer
  selectedPdfFile: null,
  setSelectedPdfFile: (file) => set({ selectedPdfFile: file }),
  pdfPage: 1,
  setPdfPage: (page) => set({ pdfPage: page }),
  pdfTotalPages: 1,
  setPdfTotalPages: (pages) => set({ pdfTotalPages: pages }),

  // Chat
  chatMessages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello, I'm Luna, your AI assistant. How can I help you today?\n\nYou may ask:\n• Can you summarize the content of PDF?\n• What are the key points?",
      timestamp: new Date(),
    },
  ],
  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  clearChatMessages: () => set({ chatMessages: [] }),
  isChatLoading: false,
  setIsChatLoading: (loading) => set({ isChatLoading: loading }),

  // Combine Files
  combineFiles: [],
  addCombineFile: (file) =>
    set((state) => ({ combineFiles: [...state.combineFiles, file] })),
  removeCombineFile: (id) =>
    set((state) => ({ combineFiles: state.combineFiles.filter((f) => f.id !== id) })),
  combineSelectedFiles: async () => {
    const { combineFiles } = get()
    if (combineFiles.length < 2) return null

    set({ isCombining: true })
    try {
      const response = await fetch('/api/files/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: combineFiles.map((f) => f.id) }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Combine failed' }))
        throw new Error(errorData.error || 'Combine failed')
      }

      const data = await response.json()

      // Refresh file list and clear combine list
      await get().fetchFiles()
      set({ combineFiles: [] })

      return data.file as PdfFile
    } catch (error) {
      console.error('Combine files error:', error)
      return null
    } finally {
      set({ isCombining: false })
    }
  },
  isCombining: false,

  // Batch Print
  printFiles: [],
  addPrintFile: (file) =>
    set((state) => ({ printFiles: [...state.printFiles, file] })),
  removePrintFile: (id) =>
    set((state) => ({ printFiles: state.printFiles.filter((f) => f.id !== id) })),

  // Compress
  compressFile: async (id: string, preset: 'high-quality' | 'balanced' | 'maximum' = 'balanced') => {
    set({ isCompressing: true, compressionProgress: { current: 0, total: 1, fileName: 'Compressing...' } })
    try {
      const response = await fetch(`/api/files/${id}/compress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Compress failed' }))
        throw new Error(errorData.error || 'Compress failed')
      }

      const data = await response.json()

      // Refresh file list to include the new compressed file
      await get().fetchFiles()

      return {
        file: data.file as PdfFile,
        compression: data.compression as {
          originalSize: number
          compressedSize: number
          savedBytes: number
          savedPercent: string
        },
        operations: data.operations,
        durationMs: data.durationMs,
        preset: data.preset,
      }
    } catch (error) {
      console.error('Compress file error:', error)
      return null
    } finally {
      set({ isCompressing: false, compressionProgress: null })
    }
  },
  compressFilePreview: async (id: string) => {
    try {
      const response = await fetch(`/api/files/${id}/compress?action=preview`)
      if (!response.ok) throw new Error('Preview failed')
      const data = await response.json()
      return data as {
        preview: { estimatedSavings: number; estimatedOutputSize: number; originalSize: number; breakdown: any; analysis: any }
        fileInfo: { id: string; name: string; size: number; pages: number }
      }
    } catch (error) {
      console.error('Compression preview error:', error)
      return null
    }
  },
  batchCompress: async (fileIds: string[], preset: 'high-quality' | 'balanced' | 'maximum' = 'balanced') => {
    set({ isCompressing: true, compressionProgress: { current: 0, total: fileIds.length, fileName: 'Batch compressing...' } })
    try {
      const response = await fetch('/api/files/compress-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds, preset }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Batch compress failed' }))
        throw new Error(errorData.error || 'Batch compress failed')
      }

      const data = await response.json()

      // Refresh file list
      await get().fetchFiles()

      return data as {
        results: any[]
        summary: { total: number; success: number; errors: number; totalSavedBytes: number; preset: string }
      }
    } catch (error) {
      console.error('Batch compress error:', error)
      return null
    } finally {
      set({ isCompressing: false, compressionProgress: null })
    }
  },
  isCompressing: false,
  compressionProgress: null,

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // View mode
  viewMode: 'list',
  setViewMode: (mode) => set({ viewMode: mode }),

  // File filter
  fileFilter: 'all',
  setFileFilter: (filter) => set({ fileFilter: filter }),
}))
