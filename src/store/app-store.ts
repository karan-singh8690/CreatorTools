import { create } from 'zustand'

export type ViewType = 'home' | 'all-tools' | 'pdf-viewer' | 'combine-files' | 'batch-print' | 'convert' | 'ocr' | 'compress'

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
  progress: number
  status: 'uploading' | 'success' | 'error'
  error?: string
}

// Keep backward-compatible alias
export type PDFFile = PdfFile

/** Format byte size to human-readable string */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/** Format date string to human-readable relative/absolute time */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `Today, ${displayHours}:${minutes} ${ampm}`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

interface AppState {
  // Navigation
  currentView: ViewType
  setCurrentView: (view: ViewType) => void

  // Sidebar
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  activeSidebarItem: string
  setActiveSidebarItem: (item: string) => void

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
  compressFile: (id: string) => Promise<{ file: PdfFile; compression: { originalSize: number; compressedSize: number; savedBytes: number; savedPercent: string } } | null>
  isCompressing: boolean

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void

  // View mode
  viewMode: 'list' | 'grid'
  setViewMode: (mode: 'list' | 'grid') => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  currentView: 'home',
  setCurrentView: (view) => set({ currentView: view }),

  // Sidebar
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  activeSidebarItem: 'recent-files',
  setActiveSidebarItem: (item) => set({ activeSidebarItem: item }),

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
  uploadFiles: async (files: File[], onProgress?: (progresses: UploadProgress[]) => void) => {
    const progresses: UploadProgress[] = files.map((f) => ({
      fileName: f.name,
      progress: 0,
      status: 'uploading' as const,
    }))
    onProgress?.(progresses)

    const uploadedFiles: PdfFile[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        // Simulate progress
        progresses[i] = { ...progresses[i], progress: 30 }
        onProgress?.([...progresses])

        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/files', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))
          throw new Error(errorData.error || 'Upload failed')
        }

        const data = await response.json()
        uploadedFiles.push(data.file)

        progresses[i] = { ...progresses[i], progress: 100, status: 'success' }
        onProgress?.([...progresses])
      } catch (error) {
        progresses[i] = {
          ...progresses[i],
          progress: 100,
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed',
        }
        onProgress?.([...progresses])
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
    // Optimistic update
    const previousFiles = get().recentFiles
    set({
      recentFiles: previousFiles.filter((f) => f.id !== id),
      combineFiles: get().combineFiles.filter((f) => f.id !== id),
      printFiles: get().printFiles.filter((f) => f.id !== id),
    })

    try {
      const response = await fetch(`/api/files/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        // Revert on error
        set({ recentFiles: previousFiles })
        throw new Error('Failed to delete file')
      }
    } catch (error) {
      console.error('Delete file error:', error)
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
  compressFile: async (id: string) => {
    set({ isCompressing: true })
    try {
      const response = await fetch(`/api/files/${id}/compress`, {
        method: 'POST',
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
      }
    } catch (error) {
      console.error('Compress file error:', error)
      return null
    } finally {
      set({ isCompressing: false })
    }
  },
  isCompressing: false,

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // View mode
  viewMode: 'list',
  setViewMode: (mode) => set({ viewMode: mode }),
}))
