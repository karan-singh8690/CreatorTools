'use client'

import { useState, useCallback } from 'react'
import { useAppStore, formatFileSize, PdfFile } from '@/store/app-store'
import {
  X,
  FilePlus,
  Loader2,
  Download,
  CheckCircle2,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'

type PageSize = 'A4' | 'Letter' | 'Legal'
type Orientation = 'portrait' | 'landscape'
type Alignment = 'left' | 'center' | 'right'

interface CreateSettings {
  title: string
  content: string
  pageSize: PageSize
  orientation: Orientation
  alignment: Alignment
  bold: boolean
  italic: boolean
}

export function CreatePdf() {
  const {
    createPdfFile,
    isCreating,
    setCurrentView,
  } = useAppStore()

  const { toast } = useToast()

  const [settings, setSettings] = useState<CreateSettings>({
    title: '',
    content: '',
    pageSize: 'A4',
    orientation: 'portrait',
    alignment: 'left',
    bold: false,
    italic: false,
  })
  const [resultFile, setResultFile] = useState<PdfFile | null>(null)

  const charCount = settings.content.length
  const wordCount = settings.content.trim() ? settings.content.trim().split(/\s+/).length : 0
  // Rough estimate: ~3000 chars per A4 page with 12pt font
  const estimatedPages = Math.max(1, Math.ceil((charCount + (settings.title.length * 2)) / 3000))

  const handleCreate = useCallback(async () => {
    if (!settings.title.trim() && !settings.content.trim()) {
      toast({
        title: 'Content Required',
        description: 'Please enter a title or content for the PDF.',
        variant: 'destructive',
      })
      return
    }

    setResultFile(null)
    const result = await createPdfFile({
      title: settings.title,
      content: settings.content,
      pageSize: settings.pageSize,
      orientation: settings.orientation,
    })

    if (result) {
      setResultFile(result)
      toast({
        title: 'PDF Created',
        description: `Created "${result.name}" with ${result.pages} page(s)`,
      })
    } else {
      toast({
        title: 'Create Failed',
        description: 'Failed to create the PDF. Please try again.',
        variant: 'destructive',
      })
    }
  }, [settings, createPdfFile, toast])

  const handleDownload = useCallback(() => {
    if (!resultFile) return
    fetch(`/api/files/${resultFile.id}/download?download=1`)
      .then((response) => {
        if (!response.ok) throw new Error('Download failed')
        return response.blob()
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = resultFile.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      })
      .catch((err) => {
        console.error('Download error:', err)
        toast({
          title: 'Download Failed',
          description: 'Failed to download the PDF',
          variant: 'destructive',
        })
      })

    toast({
      title: 'Download Started',
      description: `Downloading ${resultFile.name}`,
    })
  }, [resultFile, toast])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
            <FilePlus className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Create PDF</h1>
            <p className="text-xs text-gray-400">Create a new PDF document from scratch</p>
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
          {!resultFile ? (
            <div className="space-y-4">
              {/* Title Input */}
              <Card className="border-gray-200">
                <CardContent className="p-5">
                  <Label className="text-xs font-medium text-gray-600 mb-2 block">Document Title</Label>
                  <Input
                    value={settings.title}
                    onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                    placeholder="Enter document title..."
                    className="h-10 text-sm"
                  />
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    The title appears as a 24pt heading at the top of the first page
                  </p>
                </CardContent>
              </Card>

              {/* Toolbar */}
              <Card className="border-gray-200">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant={settings.bold ? 'default' : 'ghost'}
                      size="sm"
                      className={`h-8 w-8 p-0 ${settings.bold ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                      onClick={() => setSettings({ ...settings, bold: !settings.bold })}
                      title="Bold (visual only)"
                    >
                      <Bold className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={settings.italic ? 'default' : 'ghost'}
                      size="sm"
                      className={`h-8 w-8 p-0 ${settings.italic ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                      onClick={() => setSettings({ ...settings, italic: !settings.italic })}
                      title="Italic (visual only)"
                    >
                      <Italic className="w-4 h-4" />
                    </Button>
                    <Separator orientation="vertical" className="h-6 mx-1" />
                    <Button
                      variant={settings.alignment === 'left' ? 'default' : 'ghost'}
                      size="sm"
                      className={`h-8 w-8 p-0 ${settings.alignment === 'left' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                      onClick={() => setSettings({ ...settings, alignment: 'left' })}
                      title="Align Left"
                    >
                      <AlignLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={settings.alignment === 'center' ? 'default' : 'ghost'}
                      size="sm"
                      className={`h-8 w-8 p-0 ${settings.alignment === 'center' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                      onClick={() => setSettings({ ...settings, alignment: 'center' })}
                      title="Align Center"
                    >
                      <AlignCenter className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={settings.alignment === 'right' ? 'default' : 'ghost'}
                      size="sm"
                      className={`h-8 w-8 p-0 ${settings.alignment === 'right' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                      onClick={() => setSettings({ ...settings, alignment: 'right' })}
                      title="Align Right"
                    >
                      <AlignRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Content Textarea */}
              <Card className="border-gray-200">
                <CardContent className="p-5">
                  <Label className="text-xs font-medium text-gray-600 mb-2 block">Content</Label>
                  <textarea
                    value={settings.content}
                    onChange={(e) => setSettings({ ...settings, content: e.target.value })}
                    placeholder="Type your document content here...&#10;&#10;Use double line breaks to create new paragraphs.&#10;Content will be automatically wrapped to fit the page width."
                    className="w-full h-64 p-3 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    style={{
                      fontWeight: settings.bold ? 'bold' : 'normal',
                      fontStyle: settings.italic ? 'italic' : 'normal',
                      textAlign: settings.alignment,
                    }}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span>{charCount} characters</span>
                      <span>{wordCount} words</span>
                      <span>~{estimatedPages} page(s)</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-6 text-gray-400 hover:text-red-500"
                      onClick={() => setSettings({ ...settings, content: '' })}
                    >
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Result View */
            <div className="space-y-4">
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-emerald-800">PDF Created Successfully</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {resultFile.pages} page(s) · {formatFileSize(resultFile.size)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">File Name</span>
                    <span className="font-medium text-gray-700">{resultFile.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">File Size</span>
                    <span className="text-gray-700">{formatFileSize(resultFile.size)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Pages</span>
                    <span className="text-gray-700">{resultFile.pages}</span>
                  </div>
                  {settings.title && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Title</span>
                      <span className="text-gray-700 truncate ml-2 max-w-[200px]">{settings.title}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center gap-3">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    setResultFile(null)
                    setSettings({ ...settings, title: '', content: '' })
                  }}
                >
                  Create Another PDF
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <div className="w-72 bg-white border-l border-gray-200 p-5 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Document Settings</h3>

          <div className="space-y-5">
            {/* Page Size */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">Page Size</Label>
              <RadioGroup
                value={settings.pageSize}
                onValueChange={(v) => setSettings({ ...settings, pageSize: v as PageSize })}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="A4" id="size-a4" className="h-3.5 w-3.5" />
                  <Label htmlFor="size-a4" className="text-xs text-gray-600 font-normal cursor-pointer">
                    A4 (210 × 297 mm)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Letter" id="size-letter" className="h-3.5 w-3.5" />
                  <Label htmlFor="size-letter" className="text-xs text-gray-600 font-normal cursor-pointer">
                    Letter (8.5 × 11 in)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Legal" id="size-legal" className="h-3.5 w-3.5" />
                  <Label htmlFor="size-legal" className="text-xs text-gray-600 font-normal cursor-pointer">
                    Legal (8.5 × 14 in)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Orientation */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">Orientation</Label>
              <RadioGroup
                value={settings.orientation}
                onValueChange={(v) => setSettings({ ...settings, orientation: v as Orientation })}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="portrait" id="orient-portrait" className="h-3.5 w-3.5" />
                  <Label htmlFor="orient-portrait" className="text-xs text-gray-600 font-normal cursor-pointer">
                    Portrait
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="landscape" id="orient-landscape" className="h-3.5 w-3.5" />
                  <Label htmlFor="orient-landscape" className="text-xs text-gray-600 font-normal cursor-pointer">
                    Landscape
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Document Info */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">Document Info</Label>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Characters</span>
                  <span className="text-gray-700">{charCount}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Words</span>
                  <span className="text-gray-700">{wordCount}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Est. Pages</span>
                  <span className="text-emerald-600 font-medium">~{estimatedPages}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Page Preview */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">Page Preview</Label>
              <div className="flex items-center justify-center py-2">
                <div
                  className="border-2 border-emerald-300 bg-emerald-50/50 rounded"
                  style={{
                    width: settings.orientation === 'portrait' ? 60 : 80,
                    height: settings.orientation === 'portrait' ? 80 : 60,
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[8px] text-emerald-400">{settings.pageSize}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Create Button */}
            <div className="space-y-2">
              <Button
                className="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-700"
                disabled={isCreating || (!settings.title.trim() && !settings.content.trim())}
                onClick={handleCreate}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FilePlus className="w-3.5 h-3.5 mr-1" />
                    Create PDF
                  </>
                )}
              </Button>
              {resultFile && (
                <Button
                  variant="outline"
                  className="w-full h-9 text-xs"
                  onClick={() => {
                    setResultFile(null)
                    setSettings({ ...settings, title: '', content: '' })
                  }}
                >
                  Reset Form
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
