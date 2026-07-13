'use client'

import { useState, useCallback } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  Globe,
  Loader2,
  Download,
  CheckCircle2,
  ArrowRightLeft,
  Clock,
  FileDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { getPartnersForTool } from '@/lib/partners'
import { PartnerRecommendationInline } from './partner-recommendation'

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese',
  'Korean', 'Arabic', 'Hindi', 'Portuguese', 'Italian', 'Dutch',
  'Russian', 'Turkish', 'Vietnamese',
]

type TranslationStep = 'idle' | 'extracting' | 'translating' | 'creating' | 'done' | 'error'

interface TranslationResult {
  file: PdfFile
  translation: {
    sourceLanguage: string
    targetLanguage: string
    pagesTranslated: number
    wordCount: number
    truncated: boolean
  }
}

export function TranslatePdf() {
  const {
    recentFiles,
    translateFile,
    isTranslating,
    setCurrentView,
  } = useAppStore()

  const { toast } = useToast()

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [sourceLanguage, setSourceLanguage] = useState<string>('auto')
  const [targetLanguage, setTargetLanguage] = useState<string>('Spanish')
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [currentStep, setCurrentStep] = useState<TranslationStep>('idle')

  const handleTranslate = useCallback(async () => {
    if (!selectedFile || !targetLanguage) return

    setResult(null)
    setCurrentStep('extracting')

    // Simulate step transitions
    const stepTimer = setTimeout(() => setCurrentStep('translating'), 1500)

    try {
      const response = await translateFile(selectedFile.id, {
        targetLanguage,
        sourceLanguage: sourceLanguage === 'auto' ? undefined : sourceLanguage,
      })

      clearTimeout(stepTimer)

      if (response) {
        setCurrentStep('creating')
        await new Promise((r) => setTimeout(r, 800))
        setCurrentStep('done')
        setResult(response)
        toast({
          title: 'Translation Complete',
          description: `Translated to ${targetLanguage} — ${response.translation.wordCount} words processed`,
        })
      } else {
        setCurrentStep('error')
        toast({
          title: 'Translation Failed',
          description: 'Failed to translate the PDF file. Please try again.',
          variant: 'destructive',
        })
      }
    } catch {
      clearTimeout(stepTimer)
      setCurrentStep('error')
      toast({
        title: 'Translation Failed',
        description: 'An error occurred during translation.',
        variant: 'destructive',
      })
    }
  }, [selectedFile, targetLanguage, sourceLanguage, translateFile, toast])

  const handleDownload = useCallback(() => {
    if (!result) return
    fetch(`/api/files/${result.file.id}/download?download=1`)
      .then((response) => {
        if (!response.ok) throw new Error('Download failed')
        return response.blob()
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      })
      .catch((err) => {
        console.error('Download error:', err)
        toast({
          title: 'Download Failed',
          description: 'Failed to download the translated file',
          variant: 'destructive',
        })
      })

    toast({
      title: 'Download Started',
      description: `Downloading ${result.file.name}`,
    })
  }, [result, toast])

  const estimatedTime = selectedFile
    ? Math.max(5, Math.ceil(selectedFile.pages * 3))
    : 0

  const wordCount = selectedFile
    ? Math.ceil(selectedFile.size / 6) // rough estimate
    : 0

  const stepLabels: Record<TranslationStep, string> = {
    idle: '',
    extracting: 'Extracting text from PDF...',
    translating: `Translating to ${targetLanguage}...`,
    creating: 'Creating translated PDF...',
    done: 'Translation complete!',
    error: 'Translation failed',
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
            <Globe className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Translate PDF</h1>
            <p className="text-xs text-gray-400">AI-powered PDF translation</p>
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
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to translate</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedFile(file)
                        setResult(null)
                        setCurrentStep('idle')
                      }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-teal-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-teal-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-teal-600 truncate">
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
                  <Globe className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to translate it</p>
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
                      <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-teal-600" />
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
                        setResult(null)
                        setCurrentStep('idle')
                      }}
                    >
                      Change File
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Translation Progress */}
              {isTranslating && currentStep !== 'idle' && currentStep !== 'done' && (
                <Card className="border-teal-200 bg-teal-50/30">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-3" />
                      <p className="text-sm font-medium text-gray-700">
                        {stepLabels[currentStep]}
                      </p>

                      {/* Step indicators */}
                      <div className="flex items-center gap-2 mt-4">
                        {(['extracting', 'translating', 'creating'] as TranslationStep[]).map((step, i) => {
                          const stepOrder = ['extracting', 'translating', 'creating']
                          const currentIdx = stepOrder.indexOf(currentStep)
                          const stepIdx = i
                          const isActive = step === currentStep
                          const isDone = stepIdx < currentIdx

                          return (
                            <div key={step} className="flex items-center gap-2">
                              <div
                                className={cn(
                                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all',
                                  isDone
                                    ? 'bg-teal-600 text-white'
                                    : isActive
                                      ? 'bg-teal-500 text-white ring-2 ring-teal-200'
                                      : 'bg-gray-200 text-gray-500'
                                )}
                              >
                                {isDone ? '✓' : i + 1}
                              </div>
                              {i < 2 && (
                                <div
                                  className={cn(
                                    'w-8 h-0.5',
                                    stepIdx < currentIdx ? 'bg-teal-600' : 'bg-gray-200'
                                  )}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Extract
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <ArrowRightLeft className="w-3 h-3" /> Translate
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <FileDown className="w-3 h-3" /> Create PDF
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Translation Result */}
              {result && currentStep === 'done' && (
                <div className="space-y-4">
                  {/* Success Banner */}
                  <Card className="border-teal-200 bg-teal-50/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-teal-800">Translation Complete</p>
                          <p className="text-xs text-teal-600 mt-0.5">
                            Translated {result.translation.wordCount} words to {result.translation.targetLanguage}
                            {result.translation.truncated && ' (partial — document was too long)'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Translation Details */}
                  <Card className="border-gray-200">
                    <CardContent className="p-5 space-y-4">
                      <h4 className="text-sm font-medium text-gray-700">Translation Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Source Language</span>
                            <span className="font-medium text-gray-700">{result.translation.sourceLanguage === 'auto-detected' ? 'Auto-detected' : result.translation.sourceLanguage}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Target Language</span>
                            <span className="font-medium text-teal-600">{result.translation.targetLanguage}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Words Translated</span>
                            <span className="font-medium text-gray-700">{result.translation.wordCount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Pages</span>
                            <span className="font-medium text-gray-700">{result.translation.pagesTranslated}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Download Button */}
                  <div className="flex items-center gap-3">
                    <Button
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Translated PDF
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        setSelectedFile(null)
                        setResult(null)
                        setCurrentStep('idle')
                      }}
                    >
                      Translate Another File
                    </Button>
                  </div>
                </div>
              )}

              {/* Error State */}
              {currentStep === 'error' && (
                <div className="space-y-3">
                  <Card className="border-red-200 bg-red-50/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-red-700">
                        Translation failed. The document may be image-based or the AI translation service is currently unavailable.
                        Try using OCR first, or check out a professional translation service below.
                      </p>
                    </CardContent>
                  </Card>
                  <PartnerRecommendationInline
                    category={getPartnersForTool('translate-pdf')!}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <div className="w-72 bg-white border-l border-gray-200 p-5 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Translation Settings</h3>

          <div className={cn("space-y-5", !selectedFile && "opacity-50 pointer-events-none select-none")}>
            {/* Source Language */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">Source Language</Label>
              <Select
                value={sourceLanguage}
                onValueChange={setSourceLanguage}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Language */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">Target Language</Label>
              <Select
                value={targetLanguage}
                onValueChange={setTargetLanguage}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Language Info */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Supported Languages</label>
              <div className="flex flex-wrap gap-1">
                {LANGUAGES.map((lang) => (
                  <span
                    key={lang}
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded',
                      lang === targetLanguage
                        ? 'bg-teal-100 text-teal-700 font-medium'
                        : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>

            <Separator />

            {/* Estimated Info */}
            {selectedFile ? (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Estimates</label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Est. Time
                    </span>
                    <span className="text-gray-700">~{estimatedTime}s</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Est. Words
                    </span>
                    <span className="text-gray-700">~{wordCount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Pages</span>
                    <span className="text-gray-700">{selectedFile.pages}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <Globe className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">Select a file to view estimates</p>
              </div>
            )}

            {!selectedFile && (
              <>
                <Separator />
                <div className="flex flex-col items-center py-4 text-center">
                  <Globe className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-xs font-medium text-gray-500">Select a file first</p>
                  <p className="text-[10px] text-gray-400 mt-1">Settings will activate once a PDF is chosen</p>
                </div>
              </>
            )}

            {selectedFile && (
              <>
                <Separator />

                {/* Translate Button */}
                <div className="space-y-2">
                  <Button
                    className="w-full h-9 text-xs bg-teal-600 hover:bg-teal-700"
                    disabled={isTranslating}
                    onClick={handleTranslate}
                  >
                    {isTranslating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Translating...
                      </>
                    ) : (
                      <>
                        <Globe className="w-3.5 h-3.5 mr-1" />
                        Translate PDF
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-9 text-xs"
                    onClick={() => {
                      setSelectedFile(null)
                      setResult(null)
                      setCurrentStep('idle')
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
