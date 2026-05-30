import { create } from 'zustand'

export type ViewType = 'home' | 'all-tools' | 'pdf-viewer' | 'combine-files' | 'batch-print' | 'convert' | 'ocr' | 'compress'

export interface PDFFile {
  id: string
  name: string
  size: string
  modifiedTime: string
  pages: number
  starred: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
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
  recentFiles: PDFFile[]
  selectedFiles: string[]
  toggleFileSelection: (id: string) => void

  // PDF Viewer
  selectedPdfFile: PDFFile | null
  setSelectedPdfFile: (file: PDFFile | null) => void
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
  combineFiles: PDFFile[]
  addCombineFile: (file: PDFFile) => void
  removeCombineFile: (id: string) => void

  // Batch Print
  printFiles: PDFFile[]
  addPrintFile: (file: PDFFile) => void
  removePrintFile: (id: string) => void

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void

  // View mode
  viewMode: 'list' | 'grid'
  setViewMode: (mode: 'list' | 'grid') => void
}

const sampleFiles: PDFFile[] = [
  { id: '1', name: 'education.pdf', size: '3.6 MB', modifiedTime: 'Today, 12:45', pages: 12, starred: true },
  { id: '2', name: 'communication.pdf', size: '4.1 MB', modifiedTime: 'Today, 12:45', pages: 8, starred: false },
  { id: '3', name: 'marketing.pdf', size: '3.8 MB', modifiedTime: 'Today, 13:45', pages: 15, starred: false },
  { id: '4', name: 'User Guide Book.pdf', size: '4.5 MB', modifiedTime: 'Sep 4', pages: 24, starred: true },
  { id: '5', name: 'annual-report-2024.pdf', size: '2.8 MB', modifiedTime: 'Sep 3', pages: 42, starred: false },
  { id: '6', name: 'project-proposal.pdf', size: '1.6 MB', modifiedTime: 'Sep 2', pages: 6, starred: false },
  { id: '7', name: 'client-contact.pdf', size: '500.6 KB', modifiedTime: 'Sep 1', pages: 2, starred: false },
  { id: '8', name: 'clinical-laboratory.pdf', size: '5.2 MB', modifiedTime: 'Aug 30', pages: 18, starred: false },
]

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  currentView: 'home',
  setCurrentView: (view) => set({ currentView: view }),

  // Sidebar
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  activeSidebarItem: 'recent-files',
  setActiveSidebarItem: (item) => set({ activeSidebarItem: item }),

  // Files
  recentFiles: sampleFiles,
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

  // Batch Print
  printFiles: [],
  addPrintFile: (file) =>
    set((state) => ({ printFiles: [...state.printFiles, file] })),
  removePrintFile: (id) =>
    set((state) => ({ printFiles: state.printFiles.filter((f) => f.id !== id) })),

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // View mode
  viewMode: 'list',
  setViewMode: (mode) => set({ viewMode: mode }),
}))
