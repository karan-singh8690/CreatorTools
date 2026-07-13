'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  PenTool,
  Loader2,
  Download,
  CheckCircle2,
  Eraser,
  Type,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type SignatureMethod = 'draw' | 'type' | 'upload'

interface SignatureSettings {
  method: SignatureMethod
  page: number
  x: number
  y: number
  width: number
  height: number
  typedText: string
}

export function SignDocumentPdf() {
  const {
    recentFiles,
    signFile,
    isSigning,
    setCurrentView,
  } = useAppStore()

  const { toast } = useToast()

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [settings, setSettings] = useState<SignatureSettings>({
    method: 'draw',
    page: 1,
    x: 100,
    y: 100,
    width: 200,
    height: 80,
    typedText: '',
  })
  const [resultFile, setResultFile] = useState<PdfFile | null>(null)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)

  // Draw canvas refs
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  // Initialize draw canvas
  useEffect(() => {
    if (settings.method === 'draw' && drawCanvasRef.current) {
      const canvas = drawCanvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 2
      }
    }
  }, [settings.method])

  // Canvas drawing handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    lastPosRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !drawCanvasRef.current) return
    const canvas = drawCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx || !lastPosRef.current) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const pos = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }

    ctx.beginPath()
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()

    lastPosRef.current = pos
  }, [])

  const handleMouseUp = useCallback(() => {
    isDrawingRef.current = false
    lastPosRef.current = null
    // Save the signature
    if (drawCanvasRef.current) {
      setSignatureDataUrl(drawCanvasRef.current.toDataURL('image/png'))
    }
  }, [])

  // Touch handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const touch = e.touches[0]
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    isDrawingRef.current = true
    lastPosRef.current = {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawingRef.current || !drawCanvasRef.current) return
    const touch = e.touches[0]
    const canvas = drawCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx || !lastPosRef.current) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const pos = {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    }

    ctx.beginPath()
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()

    lastPosRef.current = pos
  }, [])

  const handleTouchEnd = useCallback(() => {
    isDrawingRef.current = false
    lastPosRef.current = null
    if (drawCanvasRef.current) {
      setSignatureDataUrl(drawCanvasRef.current.toDataURL('image/png'))
    }
  }, [])

  // Clear draw canvas
  const handleClearCanvas = useCallback(() => {
    if (!drawCanvasRef.current) return
    const ctx = drawCanvasRef.current.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    setSignatureDataUrl(null)
  }, [])

  // Type signature — render text to canvas
  const renderTypedSignature = useCallback((text: string) => {
    if (!text.trim()) {
      setSignatureDataUrl(null)
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 120
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000000'
    ctx.font = 'italic 36px "Dancing Script", "Brush Script MT", cursive'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)

    setSignatureDataUrl(canvas.toDataURL('image/png'))
  }, [])

  // Handle upload
  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setSignatureDataUrl(result)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleSign = useCallback(async () => {
    if (!selectedFile || !signatureDataUrl) return

    setResultFile(null)
    const result = await signFile(selectedFile.id, {
      signatureDataUrl,
      page: settings.page,
      x: settings.x,
      y: settings.y,
      width: settings.width,
      height: settings.height,
    })

    if (result) {
      setResultFile(result)
      toast({
        title: 'Signature Applied',
        description: `Signature added to page ${settings.page} of ${selectedFile.name}`,
      })
    } else {
      toast({
        title: 'Sign Failed',
        description: 'Failed to add signature to the PDF file. Please try again.',
        variant: 'destructive',
      })
    }
  }, [selectedFile, signatureDataUrl, settings, signFile, toast])

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
          description: 'Failed to download the signed file',
          variant: 'destructive',
        })
      })

    toast({
      title: 'Download Started',
      description: `Downloading ${resultFile.name}`,
    })
  }, [resultFile, toast])

  const hasSignature = !!signatureDataUrl

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-fuchsia-50 rounded-lg flex items-center justify-center">
            <PenTool className="w-4 h-4 text-fuchsia-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Sign Document</h1>
            <p className="text-xs text-gray-400">Add your signature to PDF documents</p>
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
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to sign</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedFile(file)
                        setResultFile(null)
                      }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-fuchsia-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-fuchsia-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-fuchsia-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-fuchsia-600 truncate">
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
                  <PenTool className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to sign it</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File Info */}
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-fuchsia-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-fuchsia-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{selectedFile.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {formatFileSize(selectedFile.size)} · {selectedFile.pages} page{selectedFile.pages !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => {
                        setSelectedFile(null)
                        setResultFile(null)
                      }}
                    >
                      Change File
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Signature Input */}
              {!resultFile && (
                <Card className="border-gray-200">
                  <CardContent className="p-5">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Create Your Signature</h4>

                    {/* Method tabs */}
                    <div className="flex gap-2 mb-4">
                      <Button
                        variant={settings.method === 'draw' ? 'default' : 'outline'}
                        size="sm"
                        className={settings.method === 'draw' ? 'bg-fuchsia-600 hover:bg-fuchsia-700 text-xs' : 'text-xs'}
                        onClick={() => setSettings({ ...settings, method: 'draw' })}
                      >
                        <PenTool className="w-3.5 h-3.5 mr-1" />
                        Draw
                      </Button>
                      <Button
                        variant={settings.method === 'type' ? 'default' : 'outline'}
                        size="sm"
                        className={settings.method === 'type' ? 'bg-fuchsia-600 hover:bg-fuchsia-700 text-xs' : 'text-xs'}
                        onClick={() => setSettings({ ...settings, method: 'type' })}
                      >
                        <Type className="w-3.5 h-3.5 mr-1" />
                        Type
                      </Button>
                      <Button
                        variant={settings.method === 'upload' ? 'default' : 'outline'}
                        size="sm"
                        className={settings.method === 'upload' ? 'bg-fuchsia-600 hover:bg-fuchsia-700 text-xs' : 'text-xs'}
                        onClick={() => setSettings({ ...settings, method: 'upload' })}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1" />
                        Upload
                      </Button>
                    </div>

                    {/* Draw signature */}
                    {settings.method === 'draw' && (
                      <div className="space-y-2">
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                          <canvas
                            ref={drawCanvasRef}
                            width={400}
                            height={120}
                            className="w-full h-[120px] cursor-crosshair touch-none"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-gray-400">Draw your signature above</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] h-6 text-gray-400 hover:text-red-500"
                            onClick={handleClearCanvas}
                          >
                            <Eraser className="w-3 h-3 mr-1" />
                            Clear
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Type signature */}
                    {settings.method === 'type' && (
                      <div className="space-y-3">
                        <Input
                          value={settings.typedText}
                          onChange={(e) => {
                            setSettings({ ...settings, typedText: e.target.value })
                            renderTypedSignature(e.target.value)
                          }}
                          placeholder="Type your name"
                          className="h-9 text-sm"
                        />
                        {signatureDataUrl && (
                          <div className="border border-gray-200 rounded-lg p-3 bg-white flex items-center justify-center">
                            <img
                              src={signatureDataUrl}
                              alt="Typed signature preview"
                              className="max-w-full h-16 object-contain"
                            />
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400">Your name will appear in a script font style</p>
                      </div>
                    )}

                    {/* Upload signature */}
                    {settings.method === 'upload' && (
                      <div className="space-y-3">
                        <input
                          ref={uploadInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          className="hidden"
                          onChange={handleUpload}
                        />
                        <Button
                          variant="outline"
                          className="w-full h-20 border-dashed border-2 text-xs text-gray-500 hover:text-fuchsia-600 hover:border-fuchsia-300"
                          onClick={() => uploadInputRef.current?.click()}
                        >
                          <Upload className="w-5 h-5 mr-2" />
                          Upload Signature Image
                        </Button>
                        {signatureDataUrl && (
                          <div className="border border-gray-200 rounded-lg p-3 bg-white flex items-center justify-center">
                            <img
                              src={signatureDataUrl}
                              alt="Uploaded signature preview"
                              className="max-w-full h-16 object-contain"
                            />
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400">Supports PNG and JPG images</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Result */}
              {resultFile && (
                <div className="space-y-4">
                  <Card className="border-fuchsia-200 bg-fuchsia-50/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-fuchsia-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-fuchsia-800">Signature Applied Successfully</p>
                          <p className="text-xs text-fuchsia-600 mt-0.5">
                            Signature added to page {settings.page}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-gray-200">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Output File</span>
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
                    </CardContent>
                  </Card>

                  <div className="flex items-center gap-3">
                    <Button
                      className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Signed PDF
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        setSelectedFile(null)
                        setResultFile(null)
                        setSignatureDataUrl(null)
                      }}
                    >
                      Sign Another File
                    </Button>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isSigning && !resultFile && (
                <Card className="border-gray-200">
                  <CardContent className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-fuchsia-600 animate-spin mb-3" />
                    <p className="text-sm font-medium text-gray-700">Adding Signature...</p>
                    <p className="text-xs text-gray-400 mt-1">Processing {selectedFile.name}</p>
                    <div className="w-48 mt-4">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-fuchsia-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <div className="w-72 bg-white border-l border-gray-200 p-5 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Signature Settings</h3>

          <div className={cn("space-y-5", !selectedFile && "opacity-50 pointer-events-none select-none")}>
            {/* Page Number */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">Page Number</Label>
              <Input
                type="number"
                min={1}
                max={selectedFile?.pages ?? 1}
                value={settings.page}
                onChange={(e) => setSettings({ ...settings, page: parseInt(e.target.value) || 1 })}
                className="h-8 text-xs"
              />
              {selectedFile && (
                <p className="text-[10px] text-gray-400 mt-1">Total: {selectedFile.pages} page(s)</p>
              )}
            </div>

            <Separator />

            {/* Position X */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium text-gray-600">Position X</Label>
                <span className="text-xs text-gray-500">{settings.x}pt</span>
              </div>
              <Slider
                value={[settings.x]}
                min={0}
                max={500}
                step={5}
                onValueChange={([v]) => setSettings({ ...settings, x: v })}
              />
            </div>

            {/* Position Y */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium text-gray-600">Position Y</Label>
                <span className="text-xs text-gray-500">{settings.y}pt</span>
              </div>
              <Slider
                value={[settings.y]}
                min={0}
                max={700}
                step={5}
                onValueChange={([v]) => setSettings({ ...settings, y: v })}
              />
            </div>

            <Separator />

            {/* Width */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium text-gray-600">Signature Width</Label>
                <span className="text-xs text-gray-500">{settings.width}pt</span>
              </div>
              <Slider
                value={[settings.width]}
                min={50}
                max={500}
                step={10}
                onValueChange={([v]) => setSettings({ ...settings, width: v })}
              />
            </div>

            {/* Height */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium text-gray-600">Signature Height</Label>
                <span className="text-xs text-gray-500">{settings.height}pt</span>
              </div>
              <Slider
                value={[settings.height]}
                min={20}
                max={200}
                step={5}
                onValueChange={([v]) => setSettings({ ...settings, height: v })}
              />
            </div>

            <Separator />

            {/* File Info */}
            {selectedFile ? (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">File Information</label>
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
                    <span className="text-gray-400">Pages</span>
                    <span className="text-gray-700">{selectedFile.pages}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <PenTool className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">Select a file to view its information</p>
              </div>
            )}

            {!selectedFile && (
              <>
                <Separator />
                <div className="flex flex-col items-center py-4 text-center">
                  <PenTool className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-xs font-medium text-gray-500">Select a file first</p>
                  <p className="text-[10px] text-gray-400 mt-1">Settings will activate once a PDF is chosen</p>
                </div>
              </>
            )}

            {selectedFile && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Button
                    className="w-full h-9 text-xs bg-fuchsia-600 hover:bg-fuchsia-700"
                    disabled={isSigning || !hasSignature}
                    onClick={handleSign}
                  >
                    {isSigning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Signing...
                      </>
                    ) : (
                      <>
                        <PenTool className="w-3.5 h-3.5 mr-1" />
                        Apply Signature
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-9 text-xs"
                    onClick={() => {
                      setSelectedFile(null)
                      setResultFile(null)
                      setSignatureDataUrl(null)
                    }}
                  >
                    Back to File List
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
