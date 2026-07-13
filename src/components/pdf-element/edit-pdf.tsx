'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  Pencil,
  Loader2,
  Download,
  Type,
  ImageIcon,
  Trash2,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Save,
  Plus,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface TextAnnotation {
  id: string
  text: string
  page: number
  x: number
  y: number
  fontSize: number
  color: string
  font: string
}

interface ImageAnnotation {
  id: string
  dataUrl: string
  page: number
  x: number
  y: number
  width: number
  height: number
}

type EditMode = 'select' | 'add-text' | 'add-image'

export function EditPdf() {
  const {
    recentFiles,
    setCurrentView,
  } = useAppStore()

  const { toast } = useToast()

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editMode, setEditMode] = useState<EditMode>('select')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([])
  const [imageAnnotations, setImageAnnotations] = useState<ImageAnnotation[]>([])
  const [deletedPages, setDeletedPages] = useState<Set<number>>(new Set())
  const [rotatedPages, setRotatedPages] = useState<Map<number, number>>(new Map())
  const [resultFile, setResultFile] = useState<PdfFile | null>(null)

  // Text input state
  const [textInput, setTextInput] = useState('')
  const [textFontSize, setTextFontSize] = useState(14)
  const [textColor, setTextColor] = useState('#000000')
  const [textFont, setTextFont] = useState('helvetica')

  // Click placement state
  const [pendingTextPosition, setPendingTextPosition] = useState<{ x: number; y: number } | null>(null)

  const pageAreaRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; width: number; height: number } | null>(null)

  // Computed: effective page list (excluding deleted pages)
  const effectivePages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => !deletedPages.has(p)
  )
  const currentEffectivePage = effectivePages.includes(currentPage) ? currentPage : effectivePages[0] || 1

  // When text is placed, handle it
  useEffect(() => {
    if (pendingTextPosition && textInput.trim()) {
      const annotation: TextAnnotation = {
        id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: textInput,
        page: currentEffectivePage,
        x: pendingTextPosition.x,
        y: pendingTextPosition.y,
        fontSize: textFontSize,
        color: textColor,
        font: textFont,
      }
      setTextAnnotations((prev) => [...prev, annotation])
      setTextInput('')
      setPendingTextPosition(null)
      setEditMode('select')
    }
  }, [pendingTextPosition, textInput, currentEffectivePage, textFontSize, textColor, textFont])

  const handlePageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (editMode === 'add-text') {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 595.28 // A4 width in points
      const y = ((e.clientY - rect.top) / rect.height) * 841.89 // A4 height in points

      // Prompt for text
      const text = window.prompt('Enter text to add:')
      if (text && text.trim()) {
        setTextInput(text)
        setPendingTextPosition({ x, y })
      } else {
        setEditMode('select')
      }
    } else if (editMode === 'add-image' && pendingImage) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 595.28
      const y = ((e.clientY - rect.top) / rect.height) * 841.89 - pendingImage.height

      const annotation: ImageAnnotation = {
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        dataUrl: pendingImage.dataUrl,
        page: currentEffectivePage,
        x,
        y,
        width: pendingImage.width,
        height: pendingImage.height,
      }
      setImageAnnotations((prev) => [...prev, annotation])
      setPendingImage(null)
      setEditMode('select')
    }
  }, [editMode, pendingImage, currentEffectivePage])

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      // Default size for placement
      setPendingImage({ dataUrl, width: 200, height: 150 })
      setEditMode('add-image')
      toast({
        title: 'Image Loaded',
        description: 'Click on the page to place the image',
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [toast])

  const handleDeletePage = useCallback(() => {
    if (effectivePages.length <= 1) {
      toast({
        title: 'Cannot Delete',
        description: 'Cannot delete the last page',
        variant: 'destructive',
      })
      return
    }
    setDeletedPages((prev) => new Set([...prev, currentEffectivePage]))
    // Move to next available page
    const idx = effectivePages.indexOf(currentEffectivePage)
    const nextIdx = idx < effectivePages.length - 1 ? idx + 1 : idx - 1
    setCurrentPage(effectivePages[nextIdx] || 1)
    toast({ title: 'Page Deleted', description: `Page ${currentEffectivePage} marked for deletion` })
  }, [currentEffectivePage, effectivePages, toast])

  const handleRotatePage = useCallback(() => {
    setRotatedPages((prev) => {
      const next = new Map(prev)
      const current = next.get(currentEffectivePage) || 0
      next.set(currentEffectivePage, (current + 90) % 360)
      return next
    })
    toast({ title: 'Page Rotated', description: `Page ${currentEffectivePage} rotated 90°` })
  }, [currentEffectivePage, toast])

  const handleSave = useCallback(async () => {
    if (!selectedFile) return

    setIsEditing(true)
    try {
      // Build operations array
      const operations: Array<Record<string, unknown>> = []

      // Add text annotations
      for (const ann of textAnnotations) {
        operations.push({
          type: 'add-text',
          params: {
            text: ann.text,
            page: ann.page,
            x: ann.x,
            y: ann.y,
            fontSize: ann.fontSize,
            color: ann.color,
            font: ann.font,
          },
        })
      }

      // Add image annotations
      for (const ann of imageAnnotations) {
        operations.push({
          type: 'add-image',
          params: {
            imageDataUrl: ann.dataUrl,
            page: ann.page,
            x: ann.x,
            y: ann.y,
            width: ann.width,
            height: ann.height,
          },
        })
      }

      // Add page rotations
      for (const [page, degrees] of rotatedPages.entries()) {
        operations.push({
          type: 'rotate-page',
          params: { page, degrees },
        })
      }

      // Add page deletions (in reverse order to maintain indices)
      const sortedDeleted = Array.from(deletedPages).sort((a, b) => b - a)
      for (const page of sortedDeleted) {
        operations.push({
          type: 'delete-page',
          params: { page },
        })
      }

      if (operations.length === 0) {
        toast({
          title: 'No Changes',
          description: 'Make some edits before saving',
          variant: 'destructive',
        })
        setIsEditing(false)
        return
      }

      const response = await fetch(`/api/files/${selectedFile.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Edit failed' }))
        throw new Error(errorData.error || 'Edit failed')
      }

      const data = await response.json()
      setResultFile(data.file as PdfFile)

      toast({
        title: 'PDF Edited',
        description: `${operations.length} operation(s) applied successfully`,
      })
    } catch (error) {
      console.error('Edit error:', error)
      toast({
        title: 'Edit Failed',
        description: error instanceof Error ? error.message : 'Failed to edit PDF',
        variant: 'destructive',
      })
    } finally {
      setIsEditing(false)
    }
  }, [selectedFile, textAnnotations, imageAnnotations, deletedPages, rotatedPages, toast])

  const handleDownload = useCallback(() => {
    if (!resultFile) return
    const a = document.createElement('a')
    a.href = `/api/files/${resultFile.id}/download`
    a.download = resultFile.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast({ title: 'Download Started', description: `Downloading ${resultFile.name}` })
  }, [resultFile, toast])

  const handleRemoveAnnotation = useCallback((id: string) => {
    setTextAnnotations((prev) => prev.filter((a) => a.id !== id))
    setImageAnnotations((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handleUndoRotation = useCallback((page: number) => {
    setRotatedPages((prev) => {
      const next = new Map(prev)
      const current = next.get(page) || 0
      const newRotation = (current - 90 + 360) % 360
      if (newRotation === 0) {
        next.delete(page)
      } else {
        next.set(page, newRotation)
      }
      return next
    })
  }, [])

  const handleUndoDelete = useCallback((page: number) => {
    setDeletedPages((prev) => {
      const next = new Set(prev)
      next.delete(page)
      return next
    })
  }, [])

  const pageRotation = rotatedPages.get(currentEffectivePage) || 0

  // Count pending changes
  const pendingChanges = textAnnotations.length + imageAnnotations.length + deletedPages.size + rotatedPages.size

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Pencil className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Edit PDF</h1>
            <p className="text-xs text-gray-400">Add text, images, and modify pages</p>
          </div>
        </div>
        <button
          onClick={() => setCurrentView('home')}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Main Content */}
        <div className="flex-1 p-6 overflow-auto">
          {!selectedFile ? (
            /* File Selection */
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to edit</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedFile(file)
                        setTotalPages(file.pages || 1)
                        setCurrentPage(1)
                        setResultFile(null)
                      }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-blue-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-blue-600 truncate">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {formatFileSize(file.size)} · {file.pages} page{file.pages !== 1 ? 's' : ''}
                        </div>
                        <div className="text-[11px] text-gray-300 mt-0.5">
                          {formatDate(file.updatedAt)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                  <Pencil className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to edit it</p>
                </div>
              )}
            </div>
          ) : resultFile ? (
            /* Result View */
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                <Download className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-800">Edit Complete!</h3>
                <p className="text-sm text-gray-500 mt-1">Your edited PDF is ready</p>
                <p className="text-xs text-gray-400 mt-1">{resultFile.name} · {formatFileSize(resultFile.size)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Edited PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setResultFile(null)
                    setTextAnnotations([])
                    setImageAnnotations([])
                    setDeletedPages(new Set())
                    setRotatedPages(new Map())
                  }}
                >
                  Continue Editing
                </Button>
              </div>
            </div>
          ) : (
            /* Editor View */
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                <Button
                  variant={editMode === 'add-text' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-8 text-xs gap-1.5',
                    editMode === 'add-text' && 'bg-blue-600 hover:bg-blue-700'
                  )}
                  onClick={() => setEditMode(editMode === 'add-text' ? 'select' : 'add-text')}
                >
                  <Type className="w-3.5 h-3.5" />
                  Add Text
                </Button>
                <Button
                  variant={editMode === 'add-image' ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-8 text-xs gap-1.5',
                    editMode === 'add-image' && 'bg-blue-600 hover:bg-blue-700'
                  )}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Add Image
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleDeletePage}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Page
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={handleRotatePage}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Rotate 90°
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setCurrentPage(Math.max(1, currentEffectivePage - 1))}
                  disabled={effectivePages.indexOf(currentEffectivePage) <= 0}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs text-gray-600 min-w-[60px] text-center">
                  Page {currentEffectivePage} / {effectivePages.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => {
                    const idx = effectivePages.indexOf(currentEffectivePage)
                    if (idx < effectivePages.length - 1) {
                      setCurrentPage(effectivePages[idx + 1])
                    }
                  }}
                  disabled={effectivePages.indexOf(currentEffectivePage) >= effectivePages.length - 1}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>

                {pendingChanges > 0 && (
                  <>
                    <Separator orientation="vertical" className="h-6" />
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {pendingChanges} change{pendingChanges !== 1 ? 's' : ''} pending
                    </Badge>
                  </>
                )}

                <div className="flex-1" />

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => {
                    setSelectedFile(null)
                    setTextAnnotations([])
                    setImageAnnotations([])
                    setDeletedPages(new Set())
                    setRotatedPages(new Map())
                  }}
                >
                  Change File
                </Button>
              </div>

              {/* Active Mode Indicator */}
              {editMode !== 'select' && (
                <Card className="border-blue-100 bg-blue-50/50">
                  <CardContent className="p-2 flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs text-blue-700">
                      {editMode === 'add-text' && 'Click on the page area to place text'}
                      {editMode === 'add-image' && 'Click on the page area to place the image'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] ml-auto text-blue-500"
                      onClick={() => {
                        setEditMode('select')
                        setPendingImage(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Page Preview Area */}
              <div className="flex justify-center">
                <div
                  ref={pageAreaRef}
                  className={cn(
                    'relative bg-white shadow-lg border border-gray-200 rounded-sm overflow-hidden',
                    editMode !== 'select' && 'cursor-crosshair'
                  )}
                  style={{
                    width: '100%',
                    maxWidth: '595px',
                    aspectRatio: '595.28 / 841.89',
                    transform: pageRotation ? `rotate(${pageRotation}deg)` : undefined,
                  }}
                  onClick={handlePageClick}
                >
                  {/* PDF page background placeholder */}
                  <div className="absolute inset-0 bg-gray-50 flex items-center justify-center">
                    <div className="text-center">
                      <FileText className="w-16 h-16 text-gray-200 mx-auto" />
                      <p className="text-sm text-gray-300 mt-2">Page {currentEffectivePage}</p>
                      <p className="text-[10px] text-gray-300">of {selectedFile.name}</p>
                    </div>
                  </div>

                  {/* Render text annotations for current page */}
                  {textAnnotations
                    .filter((a) => a.page === currentEffectivePage)
                    .map((ann) => (
                      <div
                        key={ann.id}
                        className="absolute group"
                        style={{
                          left: `${(ann.x / 595.28) * 100}%`,
                          top: `${(ann.y / 841.89) * 100}%`,
                          fontSize: `${ann.fontSize * 0.65}px`,
                          color: ann.color,
                          fontWeight: ann.font === 'bold' ? 'bold' : 'normal',
                          pointerEvents: 'auto',
                        }}
                      >
                        <span className="whitespace-pre-wrap">{ann.text}</span>
                        <button
                          className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveAnnotation(ann.id)
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}

                  {/* Render image annotations for current page */}
                  {imageAnnotations
                    .filter((a) => a.page === currentEffectivePage)
                    .map((ann) => (
                      <div
                        key={ann.id}
                        className="absolute group"
                        style={{
                          left: `${(ann.x / 595.28) * 100}%`,
                          top: `${(ann.y / 841.89) * 100}%`,
                          width: `${(ann.width / 595.28) * 100}%`,
                          height: `${(ann.height / 841.89) * 100}%`,
                        }}
                      >
                        <img
                          src={ann.dataUrl}
                          alt="Placed image"
                          className="w-full h-full object-contain"
                        />
                        <button
                          className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveAnnotation(ann.id)
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              {/* Hidden file input for image upload */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />

              {/* Saving indicator */}
              {isEditing && (
                <Card className="border-gray-200">
                  <CardContent className="p-6 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                    <p className="text-sm font-medium text-gray-700">Applying edits...</p>
                    <p className="text-xs text-gray-400 mt-1">Processing {pendingChanges} operation(s)</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <div className="w-72 bg-white border-l border-gray-200 p-5 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Edit Settings</h3>

          {!selectedFile ? (
            <div className="space-y-5 opacity-50 pointer-events-none select-none">
              {/* Text Settings (disabled preview) */}
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">Text Options</Label>
                <div className="space-y-3">
                  <div>
                    <Label className="text-[10px] text-gray-400 mb-1 block">Font Size</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={textFontSize}
                        onChange={(e) => setTextFontSize(Number(e.target.value) || 12)}
                        min={8}
                        max={72}
                        className="h-7 text-xs w-20"
                      />
                      <span className="text-[10px] text-gray-400">pt</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-400 mb-1 block">Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
                      />
                      <span className="text-[10px] text-gray-500">{textColor}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-400 mb-1 block">Font</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={textFont === 'helvetica' ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-7 text-[10px] flex-1',
                          textFont === 'helvetica' && 'bg-blue-600 hover:bg-blue-700'
                        )}
                        onClick={() => setTextFont('helvetica')}
                      >
                        Regular
                      </Button>
                      <Button
                        variant={textFont === 'bold' ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-7 text-[10px] flex-1',
                          textFont === 'bold' && 'bg-blue-600 hover:bg-blue-700'
                        )}
                        onClick={() => setTextFont('bold')}
                      >
                        Bold
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col items-center py-4 text-center">
                <Pencil className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-medium text-gray-500">Select a file first</p>
                <p className="text-[10px] text-gray-400 mt-1">Settings will activate once a PDF is chosen</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Text Settings */}
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">Text Options</Label>
                <div className="space-y-3">
                  <div>
                    <Label className="text-[10px] text-gray-400 mb-1 block">Font Size</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={textFontSize}
                        onChange={(e) => setTextFontSize(Number(e.target.value) || 12)}
                        min={8}
                        max={72}
                        className="h-7 text-xs w-20"
                      />
                      <span className="text-[10px] text-gray-400">pt</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-400 mb-1 block">Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
                      />
                      <span className="text-[10px] text-gray-500">{textColor}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-400 mb-1 block">Font</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={textFont === 'helvetica' ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-7 text-[10px] flex-1',
                          textFont === 'helvetica' && 'bg-blue-600 hover:bg-blue-700'
                        )}
                        onClick={() => setTextFont('helvetica')}
                      >
                        Regular
                      </Button>
                      <Button
                        variant={textFont === 'bold' ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-7 text-[10px] flex-1',
                          textFont === 'bold' && 'bg-blue-600 hover:bg-blue-700'
                        )}
                        onClick={() => setTextFont('bold')}
                      >
                        Bold
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Page Info */}
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">Page Info</Label>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Current Page</span>
                    <span className="text-gray-700">{currentEffectivePage} of {effectivePages.length}</span>
                  </div>
                  {pageRotation > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Rotation</span>
                      <span className="text-blue-600">{pageRotation}°</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Pending Changes */}
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">Pending Changes</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {textAnnotations.length === 0 && imageAnnotations.length === 0 && deletedPages.size === 0 && rotatedPages.size === 0 && (
                    <p className="text-[11px] text-gray-400">No changes yet. Use the toolbar to add edits.</p>
                  )}

                  {textAnnotations.map((ann) => (
                    <div key={ann.id} className="flex items-center gap-2 p-1.5 bg-blue-50 rounded text-[10px]">
                      <Type className="w-3 h-3 text-blue-500 shrink-0" />
                      <span className="text-blue-700 truncate flex-1">&ldquo;{ann.text}&rdquo; on page {ann.page}</span>
                      <button
                        className="text-blue-400 hover:text-red-500 shrink-0"
                        onClick={() => handleRemoveAnnotation(ann.id)}
                      >
                        <Undo2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {imageAnnotations.map((ann) => (
                    <div key={ann.id} className="flex items-center gap-2 p-1.5 bg-green-50 rounded text-[10px]">
                      <ImageIcon className="w-3 h-3 text-green-500 shrink-0" />
                      <span className="text-green-700 truncate flex-1">Image on page {ann.page}</span>
                      <button
                        className="text-green-400 hover:text-red-500 shrink-0"
                        onClick={() => handleRemoveAnnotation(ann.id)}
                      >
                        <Undo2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {Array.from(deletedPages).map((page) => (
                    <div key={`del-${page}`} className="flex items-center gap-2 p-1.5 bg-red-50 rounded text-[10px]">
                      <Trash2 className="w-3 h-3 text-red-500 shrink-0" />
                      <span className="text-red-700 flex-1">Delete page {page}</span>
                      <button
                        className="text-red-400 hover:text-green-500 shrink-0"
                        onClick={() => handleUndoDelete(page)}
                      >
                        <Undo2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {Array.from(rotatedPages.entries()).map(([page, degrees]) => (
                    <div key={`rot-${page}`} className="flex items-center gap-2 p-1.5 bg-amber-50 rounded text-[10px]">
                      <RotateCw className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="text-amber-700 flex-1">Rotate page {page} by {degrees}°</span>
                      <button
                        className="text-amber-400 hover:text-green-500 shrink-0"
                        onClick={() => handleUndoRotation(page)}
                      >
                        <Undo2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* File Info */}
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">File Information</Label>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">File Name</span>
                    <span className="text-gray-700 truncate ml-2 max-w-[140px]">{selectedFile.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">File Size</span>
                    <span className="text-gray-700">{formatFileSize(selectedFile.size)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Original Pages</span>
                    <span className="text-gray-700">{selectedFile.pages}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Save Button */}
              <div className="space-y-2">
                <Button
                  className="w-full h-9 text-xs bg-blue-600 hover:bg-blue-700"
                  disabled={isEditing || pendingChanges === 0}
                  onClick={handleSave}
                >
                  {isEditing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      Applying Edits...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 mr-1" />
                      Apply Edits ({pendingChanges})
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-9 text-xs"
                  onClick={() => {
                    setSelectedFile(null)
                    setTextAnnotations([])
                    setImageAnnotations([])
                    setDeletedPages(new Set())
                    setRotatedPages(new Map())
                    setResultFile(null)
                  }}
                >
                  Back to File List
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
