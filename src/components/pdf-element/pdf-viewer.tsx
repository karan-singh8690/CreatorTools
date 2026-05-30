'use client'

import { useAppStore, ChatMessage, formatFileSize } from '@/store/app-store'
import {
  Home,
  MessageSquare,
  Pencil,
  ArrowRightLeft,
  Eye,
  FolderTree,
  Wrench,
  Shield,
  LayoutGrid,
  Download,
  Printer,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Send,
  Mic,
  Paperclip,
  MessageCircle,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

// Types for pdfjs-dist (loaded dynamically)
type PDFDocumentProxy = import('pdfjs-dist').PDFDocumentProxy
type PDFPageProxy = import('pdfjs-dist').PDFPageProxy

const MIN_ZOOM = 50
const MAX_ZOOM = 300
const ZOOM_STEP = 25

export function PdfViewer() {
  const {
    selectedPdfFile,
    setCurrentView,
    pdfPage,
    setPdfPage,
    pdfTotalPages,
    setPdfTotalPages,
    chatMessages,
    addChatMessage,
    isChatLoading,
    setIsChatLoading,
  } = useAppStore()

  // UI state
  const [chatInput, setChatInput] = useState('')
  const [chatType, setChatType] = useState('pdf')
  const [showChat, setShowChat] = useState(true)
  const [showPrint, setShowPrint] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // PDF rendering state
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [zoom, setZoom] = useState(100)
  const [isLoading, setIsLoading] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfJsReady, setPdfJsReady] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfJsRef = useRef<typeof import('pdfjs-dist') | null>(null)
  const renderTaskRef = useRef<import('pdfjs-dist').RenderTask | null>(null)
  const printIframeRef = useRef<HTMLIFrameElement | null>(null)

  // Dynamically import pdfjs-dist (client-side only)
  useEffect(() => {
    let cancelled = false
    import('pdfjs-dist').then((mod) => {
      if (cancelled) return
      mod.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.version}/build/pdf.worker.min.mjs`
      pdfJsRef.current = mod
      setPdfJsReady(true)
    }).catch((err) => {
      console.error('Failed to load pdfjs-dist:', err)
      setError('Failed to initialize PDF viewer library.')
    })
    return () => { cancelled = true }
  }, [])

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Update total pages when file changes
  useEffect(() => {
    if (selectedPdfFile) {
      const totalPages = useAppStore.getState().pdfTotalPages
      if (totalPages !== selectedPdfFile.pages) {
        useAppStore.getState().setPdfTotalPages(selectedPdfFile.pages)
      }
    }
  }, [selectedPdfFile])

  // Load PDF document when selected file changes
  useEffect(() => {
    if (!selectedPdfFile || !pdfJsReady || !pdfJsRef.current) {
      setPdfDoc(null)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    const loadPdf = async () => {
      try {
        const pdfjsLib = pdfJsRef.current!
        const url = `/api/files/${selectedPdfFile.id}/download`
        const loadingTask = pdfjsLib.getDocument(url)
        const doc = await loadingTask.promise

        if (cancelled) {
          doc.destroy()
          return
        }

        setPdfDoc(doc)
        setPdfTotalPages(doc.numPages)
        setPdfPage(1)
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load PDF:', err)
          setError('Failed to load PDF file. The file may be corrupted or inaccessible.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadPdf()

    return () => {
      cancelled = true
    }
  }, [selectedPdfFile, pdfJsReady, setPdfPage, setPdfTotalPages])

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return

    // Cancel any ongoing render
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel()
      } catch {
        // ignore cancel errors
      }
      renderTaskRef.current = null
    }

    setIsRendering(true)

    try {
      const page: PDFPageProxy = await pdfDoc.getPage(pdfPage)
      const scale = zoom / 100
      const viewport = page.getViewport({ scale })

      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (!context) return

      // Set canvas dimensions
      const outputScale = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = Math.floor(viewport.width) + 'px'
      canvas.style.height = Math.floor(viewport.height) + 'px'

      const transform = outputScale !== 1
        ? [outputScale, 0, 0, outputScale, 0, 0]
        : undefined

      const renderTask = page.render({
        canvasContext: context,
        viewport,
        transform,
      })

      renderTaskRef.current = renderTask

      await renderTask.promise

      renderTaskRef.current = null
    } catch (err: unknown) {
      // RenderingCancelled is expected when navigating quickly
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'RenderingCancelledException') {
        // This is normal, just ignore
      } else {
        console.error('Failed to render page:', err)
        setError('Failed to render PDF page.')
      }
    } finally {
      setIsRendering(false)
    }
  }, [pdfDoc, pdfPage, zoom])

  // Render page when page or zoom changes
  useEffect(() => {
    if (!pdfDoc) return

    let rafId: number
    rafId = requestAnimationFrame(() => {
      renderPage()
    })

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [pdfDoc, pdfPage, zoom, renderPage])

  // Clean up PDF document on unmount
  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          // ignore
        }
      }
      if (pdfDoc) {
        pdfDoc.destroy()
      }
      if (printIframeRef.current && printIframeRef.current.parentNode) {
        printIframeRef.current.parentNode.removeChild(printIframeRef.current)
        printIframeRef.current = null
      }
    }
  }, [])

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
  const handleZoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
  const handleFitWidth = () => {
    if (!containerRef.current || !pdfDoc) return
    // We need to get the page width at scale=1 to calculate fit-width scale
    pdfDoc.getPage(pdfPage).then((page) => {
      const viewport = page.getViewport({ scale: 1 })
      const containerWidth = containerRef.current!.clientWidth - 48 // padding
      const fitScale = Math.floor((containerWidth / viewport.width) * 100)
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitScale)))
    })
  }
  const handleFitPage = () => {
    if (!containerRef.current || !pdfDoc) return
    pdfDoc.getPage(pdfPage).then((page) => {
      const viewport = page.getViewport({ scale: 1 })
      const containerWidth = containerRef.current!.clientWidth - 48
      const containerHeight = containerRef.current!.clientHeight - 48
      const scaleW = containerWidth / viewport.width
      const scaleH = containerHeight / viewport.height
      const fitScale = Math.floor(Math.min(scaleW, scaleH) * 100)
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitScale)))
    })
  }
  const handleResetZoom = () => setZoom(100)

  // Page navigation handlers
  const handlePrevPage = () => setPdfPage(Math.max(1, pdfPage - 1))
  const handleNextPage = () => setPdfPage(Math.min(pdfTotalPages, pdfPage + 1))
  const handlePageInput = (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 1 && num <= pdfTotalPages) {
      setPdfPage(num)
    }
  }

  // Print handler
  const handlePrint = () => {
    if (!selectedPdfFile) return

    const pdfUrl = `/api/files/${selectedPdfFile.id}/download`

    // Remove existing iframe if any
    if (printIframeRef.current && printIframeRef.current.parentNode) {
      printIframeRef.current.parentNode.removeChild(printIframeRef.current)
    }

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    iframe.style.overflow = 'hidden'

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (err) {
        console.error('Print failed:', err)
        // Fallback: open in new tab
        window.open(pdfUrl, '_blank')
      }
    }

    iframe.src = pdfUrl
    document.body.appendChild(iframe)
    printIframeRef.current = iframe
  }

  const file = selectedPdfFile || { name: 'document.pdf', pages: 1, size: 0, id: '' }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    }

    addChatMessage(userMessage)
    setChatInput('')
    setIsChatLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput.trim(),
          fileName: file.name,
          fileId: file.id || undefined,
          history: chatMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'I apologize, but I was unable to process your request. Please try again.',
        timestamp: new Date(),
      }

      addChatMessage(assistantMessage)
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      addChatMessage(errorMessage)
    } finally {
      setIsChatLoading(false)
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    setChatInput(question)
  }

  const handleDownload = async () => {
    if (!selectedPdfFile) return
    try {
      const response = await fetch(`/api/files/${selectedPdfFile.id}/download?download=1`)
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = selectedPdfFile.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download error:', err)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentView('home')}
            className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors"
            title="Home"
          >
            <Home className="w-4 h-4" />
          </button>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Comment">
            <MessageSquare className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Edit">
            <Pencil className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Convert">
            <ArrowRightLeft className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="View">
            <Eye className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Organize">
            <FolderTree className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Tools">
            <Wrench className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="Protect">
            <Shield className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="All">
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls (center) */}
        {selectedPdfFile && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-30"
              disabled={zoom <= MIN_ZOOM}
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="min-w-[52px] px-2 py-1 rounded hover:bg-gray-100 text-xs font-medium text-gray-600 transition-colors text-center"
              title="Reset to 100%"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-30"
              disabled={zoom >= MAX_ZOOM}
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <button
              onClick={handleFitWidth}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
              title="Fit to Width"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitPage}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
              title="Fit to Page"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowChat(!showChat)}
            className={cn(
              'p-2 rounded transition-colors',
              showChat ? 'bg-red-50 text-red-500 border border-red-200' : 'hover:bg-gray-100 text-gray-500'
            )}
            title="Chat with PDF"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowPrint(!showPrint)}
            className={cn(
              'p-2 rounded transition-colors',
              showPrint ? 'bg-blue-50 text-blue-500 border border-blue-200' : 'hover:bg-gray-100 text-gray-500'
            )}
            title="Print"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="More">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Print Settings Panel (Left) */}
        {showPrint && (
          <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto shrink-0">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Print</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Printer</label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-600 bg-gray-50">
                  PDFelement Printer
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Print Settings</label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-600 bg-gray-50 mb-2">
                  Single side
                </div>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-600 bg-gray-50 mb-2">
                  A4 21 × 29.7 cm
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" className="rounded border-gray-300" />
                    The page size of the source file
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" className="rounded border-gray-300" />
                    Print as image
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Orientation</label>
                <div className="flex gap-2">
                  <div className="w-10 h-14 border-2 border-gray-300 rounded-sm flex items-center justify-center">
                    <div className="w-6 h-8 border border-gray-400 rounded-sm" />
                  </div>
                  <div className="w-14 h-10 border-2 border-gray-300 rounded-sm flex items-center justify-center">
                    <div className="w-8 h-6 border border-gray-400 rounded-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Page Range</label>
                <RadioGroup defaultValue="current" className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="current" id="current" className="h-3.5 w-3.5" />
                    <Label htmlFor="current" className="text-xs text-gray-600 font-normal">Current page</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all" className="h-3.5 w-3.5" />
                    <Label htmlFor="all" className="text-xs text-gray-600 font-normal">All pages</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="custom" className="h-3.5 w-3.5" />
                    <Label htmlFor="custom" className="text-xs text-gray-600 font-normal">Custom</Label>
                  </div>
                </RadioGroup>
              </div>

              <button className="text-xs text-[#4A90D9] hover:underline">
                Show Advanced Settings
              </button>

              <div className="space-y-2 pt-2">
                <Button variant="outline" className="w-full h-8 text-xs">
                  Add as Template
                </Button>
                <Button
                  className="w-full h-8 text-xs bg-[#4A90D9] hover:bg-[#3A7BC8]"
                  onClick={handlePrint}
                  disabled={!selectedPdfFile}
                >
                  Print
                </Button>
                <Button variant="outline" className="w-full h-8 text-xs" onClick={() => setShowPrint(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* PDF Document Viewer (Center) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Canvas Area */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto flex items-start justify-center p-6"
          >
            {!selectedPdfFile ? (
              /* No file selected */
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Eye className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-sm font-medium">No file selected</p>
                <p className="text-xs mt-1">Select a PDF file to view it here</p>
              </div>
            ) : isLoading ? (
              /* Loading PDF */
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Loader2 className="w-10 h-10 animate-spin mb-3 text-[#4A90D9]" />
                <p className="text-sm">Loading PDF...</p>
              </div>
            ) : error ? (
              /* Error state */
              <div className="flex flex-col items-center justify-center h-full text-red-400">
                <AlertCircle className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium text-red-500">Failed to load PDF</p>
                <p className="text-xs mt-1 text-red-400 max-w-sm text-center">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setError(null)
                    // Re-trigger load by toggling file selection
                    const currentFile = selectedPdfFile
                    useAppStore.getState().setSelectedPdfFile(null)
                    setTimeout(() => useAppStore.getState().setSelectedPdfFile(currentFile), 100)
                  }}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </div>
            ) : !pdfJsReady ? (
              /* Waiting for pdfjs */
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#4A90D9]" />
                <p className="text-xs">Initializing PDF viewer...</p>
              </div>
            ) : pdfDoc ? (
              /* PDF Canvas */
              <div className="relative">
                {isRendering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10 rounded-sm">
                    <Loader2 className="w-6 h-6 animate-spin text-[#4A90D9]" />
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  className="shadow-lg rounded-sm bg-white"
                  style={{ display: 'block' }}
                />
              </div>
            ) : null}
          </div>

          {/* Page Navigation Bar */}
          <div className="flex items-center justify-center gap-2 py-2 bg-white border-t border-gray-200 shrink-0">
            <button
              onClick={handlePrevPage}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition-colors"
              disabled={pdfPage <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                max={pdfTotalPages}
                value={pdfPage}
                onChange={(e) => handlePageInput(e.target.value)}
                className="w-12 h-7 text-xs text-center p-0 border-gray-300 rounded"
              />
              <span className="text-xs text-gray-500">/ {pdfTotalPages}</span>
            </div>
            <button
              onClick={handleNextPage}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition-colors"
              disabled={pdfPage >= pdfTotalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <span className="text-[11px] text-gray-400">
              {selectedPdfFile ? `${selectedPdfFile.name} · ${formatFileSize(selectedPdfFile.size)}` : ''}
            </span>
          </div>
        </div>

        {/* Chat with PDF Sidebar (Right) */}
        {showChat && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Chat with PDF</h3>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Type */}
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-[10px] font-medium text-gray-500 mb-2">Choose a Type</p>
              <RadioGroup value={chatType} onValueChange={setChatType} className="flex gap-4">
                <div className="flex items-center space-x-1.5">
                  <RadioGroupItem value="pdf" id="chat-pdf" className="h-3.5 w-3.5" />
                  <Label htmlFor="chat-pdf" className="text-xs text-gray-600 font-normal">Chat with PDF</Label>
                </div>
                <div className="flex items-center space-x-1.5">
                  <RadioGroupItem value="other" id="chat-other" className="h-3.5 w-3.5" />
                  <Label htmlFor="chat-other" className="text-xs text-gray-600 font-normal">Chat with Other</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-3">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-[#4A90D9] text-white'
                          : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-500">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Suggested Questions */}
            {chatMessages.length <= 1 && (
              <div className="px-4 py-2 border-t border-gray-100">
                <div className="space-y-1">
                  <button
                    onClick={() => handleSuggestedQuestion('Can you summarize the content of PDF?')}
                    className="w-full text-left text-[11px] text-[#4A90D9] hover:underline"
                  >
                    Q1: Can you summarize the content of PDF?
                  </button>
                  <button
                    onClick={() => handleSuggestedQuestion('What are the key points?')}
                    className="w-full text-left text-[11px] text-[#4A90D9] hover:underline"
                  >
                    Q2: What are the key points?
                  </button>
                </div>
              </div>
            )}

            {/* Chat Input */}
            <div className="px-4 py-3 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-gray-400">DeepSeek-V3</span>
              </div>
              <div className="flex items-end gap-2">
                <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 shrink-0">
                  <Mic className="w-4 h-4" />
                </button>
                <div className="flex-1 relative">
                  <Textarea
                    placeholder="Ask anything about PDF... Press Enter to send"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    className="min-h-[36px] max-h-[80px] text-xs resize-none pr-8"
                    rows={1}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isChatLoading}
                    className="absolute right-2 bottom-2 p-1 rounded text-[#4A90D9] hover:bg-blue-50 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 shrink-0">
                  <Paperclip className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 truncate">{file.name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
