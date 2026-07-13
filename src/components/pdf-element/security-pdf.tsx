'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  Lock,
  Loader2,
  Download,
  CheckCircle2,
  Eye,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Key,
  Printer,
  Copy,
  PenTool,
  Camera,
  Type,
  Clock,
  Users,
  Layers,
  AlertTriangle,
  BarChart3,
  ShieldOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useToolHistory } from '@/hooks/use-tool-history'
import { ToolHistoryPanel } from '@/components/pdf-element/tool-history-panel'

// ─── Types ───────────────────────────────────────────────────────────────────

type EncryptionLevel = 'aes-256' | 'aes-128' | 'rc4-128'
type PrintPermission = 'none' | 'low-res' | 'high-res'
type CopyPermission = 'allowed' | 'restricted'
type ModifyPermission = 'all' | 'annotate' | 'fill-forms' | 'assembly' | 'none'
type ExpirationAction = 'warn' | 'block' | 'degrade'

interface SecurityOptionsState {
  // Encryption
  enableEncryption: boolean
  encryptionLevel: EncryptionLevel
  userPassword: string
  ownerPassword: string

  // Permissions
  printPermission: PrintPermission
  copyPermission: CopyPermission
  modifyPermission: ModifyPermission

  // Screenshot Deterrence
  enableScreenshotDeterrence: boolean
  screenshotWatermarkText: string

  // Digital Signature
  enableSignature: boolean
  signerName: string
  signerEmail: string
  signatureReason: string
  signatureLocation: string

  // Expiration
  enableExpiration: boolean
  expirationDate: string
  expirationAction: ExpirationAction
  expirationMessage: string

  // Role-Based
  enableRoleBased: boolean
  roles: Array<{
    name: string
    password: string
    print: PrintPermission
    copy: CopyPermission
    modify: ModifyPermission
  }>
}

interface SecurityResultData {
  file: PdfFile
  security: {
    originalSize: number
    protectedSize: number
    sizeIncrease: number
    operations: { type: string; description: string; itemsProcessed: number }[]
    durationMs: number
    securityLevel: string
    ownerPassword?: string
  }
}

interface PreviewData {
  preview: {
    currentSecurity: {
      isEncrypted: boolean
      hasOwnerPassword: boolean
      hasUserPassword: boolean
      printPermission: string
      copyPermission: string
      modifyPermission: string
    }
    proposedSecurity: {
      encryptionLevel: string
      permissions: string[]
      hasExpiration: boolean
      hasSignature: boolean
      hasRoleBased: boolean
      hasScreenshotDeterrence: boolean
    }
    estimatedSizeIncrease: number
    warnings: string[]
  }
  fileInfo: { id: string; name: string; size: number; pages: number }
}

interface VerifyData {
  verify: {
    isEncrypted: boolean
    encryptionMethod: string
    hasUserPassword: boolean
    hasOwnerPassword: boolean
    permissions: {
      print: string
      copy: string
      modify: string
      annotate: boolean
      fillForms: boolean
      extractContent: boolean
      assemble: boolean
    }
    hasSignature: boolean
    hasExpiration: boolean
    expirationDate: string | null
    isExpired: boolean
    hasRoleBased: boolean
    roles: string[]
    securityScore: number
  }
  fileInfo: { id: string; name: string; size: number; pages: number }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: SecurityOptionsState = {
  enableEncryption: true,
  encryptionLevel: 'aes-256',
  userPassword: '',
  ownerPassword: '',
  printPermission: 'high-res',
  copyPermission: 'restricted',
  modifyPermission: 'annotate',
  enableScreenshotDeterrence: false,
  screenshotWatermarkText: 'PROTECTED DOCUMENT',
  enableSignature: false,
  signerName: '',
  signerEmail: '',
  signatureReason: 'Document protection',
  signatureLocation: '',
  enableExpiration: false,
  expirationDate: '',
  expirationAction: 'warn',
  expirationMessage: 'This document has expired.',
  enableRoleBased: false,
  roles: [
    { name: 'Viewer', password: '', print: 'none', copy: 'restricted', modify: 'none' },
    { name: 'Editor', password: '', print: 'high-res', copy: 'allowed', modify: 'annotate' },
  ],
}

const ENCRYPTION_OPTIONS: {
  id: EncryptionLevel
  label: string
  description: string
  strength: string
}[] = [
  { id: 'aes-256', label: 'AES-256', description: 'Military-grade encryption', strength: 'Maximum' },
  { id: 'aes-128', label: 'AES-128', description: 'Strong encryption, wide compatibility', strength: 'High' },
  { id: 'rc4-128', label: 'RC4-128', description: 'Legacy compatibility', strength: 'Standard' },
]

const PRINT_OPTIONS: { id: PrintPermission; label: string; icon: React.ElementType }[] = [
  { id: 'high-res', label: 'High Quality', icon: Printer },
  { id: 'low-res', label: 'Low Resolution', icon: Printer },
  { id: 'none', label: 'No Printing', icon: ShieldOff },
]

const MODIFY_OPTIONS: { id: ModifyPermission; label: string }[] = [
  { id: 'all', label: 'Full Editing' },
  { id: 'annotate', label: 'Annotations Only' },
  { id: 'fill-forms', label: 'Fill Forms Only' },
  { id: 'assembly', label: 'Page Assembly' },
  { id: 'none', label: 'No Modifications' },
]

const SECURITY_SCORE_COLORS: Record<string, string> = {
  Maximum: 'text-red-600',
  High: 'text-orange-600',
  Medium: 'text-yellow-600',
  Basic: 'text-blue-600',
  Minimal: 'text-gray-500',
}

// ─── Batch Mode ──────────────────────────────────────────────────────────────

function BatchSecurityView({ onBack }: { onBack: () => void }) {
  const { recentFiles } = useAppStore()
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [options] = useState<SecurityOptionsState>(DEFAULT_OPTIONS)
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<any>(null)

  const toggleFile = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBatchProtect = async () => {
    if (selectedIds.size === 0) return
    setIsProcessing(true)
    try {
      const response = await fetch('/api/files/security-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: Array.from(selectedIds), options }),
      })
      if (!response.ok) throw new Error('Batch security failed')
      const data = await response.json()
      setResults(data)
      await useAppStore.getState().fetchFiles()
      toast({ title: 'Batch Protection Complete', description: `${data.summary.success} files protected` })
    } catch (error: any) {
      toast({ title: 'Batch Failed', description: error.message, variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Batch Protect</h3>
          <p className="text-xs text-gray-400">Apply same security settings to multiple PDFs</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={onBack}>Single File</Button>
      </div>
      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {recentFiles.map((file) => (
          <button key={file.id} onClick={() => toggleFile(file.id)}
            className={cn('w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
              selectedIds.has(file.id) ? 'border-amber-500 bg-amber-50/50' : 'border-gray-100 hover:border-gray-200'
            )}>
            <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
              selectedIds.has(file.id) ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
            )}>
              {selectedIds.has(file.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
            <p className="text-xs font-medium text-gray-700 truncate flex-1">{file.name}</p>
            <span className="text-[10px] text-gray-400 shrink-0">{formatFileSize(file.size)}</span>
          </button>
        ))}
      </div>
      {results ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-amber-600" /><span className="text-sm font-medium text-amber-800">Batch Complete</span></div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-lg font-bold text-amber-600">{results.summary.success}</p><p className="text-[10px] text-gray-500">Protected</p></div>
              <div><p className="text-lg font-bold text-gray-800">{formatFileSize(results.summary.totalSizeIncrease)}</p><p className="text-[10px] text-gray-500">Size Added</p></div>
              <div><p className="text-lg font-bold text-red-500">{results.summary.errors}</p><p className="text-[10px] text-gray-500">Failed</p></div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => setResults(null)}>Protect More</Button>
          </CardContent>
        </Card>
      ) : (
        <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white" disabled={selectedIds.size === 0 || isProcessing} onClick={handleBatchProtect}>
          {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><Lock className="w-4 h-4 mr-2" />Protect {selectedIds.size} File{selectedIds.size !== 1 ? 's' : ''}</>}
        </Button>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SecurityPdf() {
  const { recentFiles, setCurrentView } = useAppStore()
  const { toast } = useToast()

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [options, setOptions] = useState<SecurityOptionsState>(DEFAULT_OPTIONS)
  const [result, setResult] = useState<SecurityResultData | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [verifyData, setVerifyData] = useState<VerifyData | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'protect' | 'verify' | 'audit'>('protect')
  const [auditEntries, setAuditEntries] = useState<any[]>([])
  const { history, addHistory, deleteItem, clearHistory, isLoaded } = useToolHistory('security', 'PDF Security')

  // Fetch preview
  useEffect(() => {
    if (!selectedFile) return
    let cancelled = false
    const fetchPreview = async () => {
      setIsLoadingPreview(true)
      try {
        const apiOptions = buildApiOptions(options)
        const response = await fetch(`/api/files/${selectedFile.id}/security?options=${encodeURIComponent(JSON.stringify(apiOptions))}`)
        if (!response.ok) throw new Error('Preview failed')
        const data = await response.json()
        if (!cancelled) setPreview(data)
      } catch (error) {
        console.error('Preview error:', error)
      } finally {
        if (!cancelled) setIsLoadingPreview(false)
      }
    }
    const timer = setTimeout(fetchPreview, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [selectedFile?.id, options.enableEncryption, options.encryptionLevel, options.printPermission, options.copyPermission, options.modifyPermission, options.enableExpiration, options.enableSignature, options.enableRoleBased, options.enableScreenshotDeterrence])

  // Fetch audit log
  useEffect(() => {
    if (activeTab !== 'audit') return
    const fetchAudit = async () => {
      try {
        const response = await fetch('/api/files/security-audit?limit=20')
        if (!response.ok) return
        const data = await response.json()
        setAuditEntries(data.entries || [])
      } catch (error) {
        console.error('Audit fetch error:', error)
      }
    }
    fetchAudit()
  }, [activeTab])

  // Verify file security
  const handleVerify = useCallback(async () => {
    if (!selectedFile) return
    try {
      const response = await fetch(`/api/files/${selectedFile.id}/security?action=verify`)
      if (!response.ok) throw new Error('Verify failed')
      const data = await response.json()
      setVerifyData(data)
    } catch (error: any) {
      toast({ title: 'Verify Failed', description: error.message, variant: 'destructive' })
    }
  }, [selectedFile, toast])

  const buildApiOptions = (opts: SecurityOptionsState) => ({
    enableEncryption: opts.enableEncryption,
    encryptionLevel: opts.encryptionLevel,
    userPassword: opts.userPassword,
    ownerPassword: opts.ownerPassword,
    printPermission: opts.printPermission,
    copyPermission: opts.copyPermission,
    modifyPermission: opts.modifyPermission,
    enableScreenshotDeterrence: opts.enableScreenshotDeterrence,
    screenshotWatermarkText: opts.screenshotWatermarkText,
    enableSignature: opts.enableSignature,
    signerName: opts.signerName,
    signerEmail: opts.signerEmail,
    signatureReason: opts.signatureReason,
    signatureLocation: opts.signatureLocation,
    enableExpiration: opts.enableExpiration,
    expirationDate: opts.expirationDate,
    expirationAction: opts.expirationAction,
    expirationMessage: opts.expirationMessage,
    enableRoleBased: opts.enableRoleBased,
    roles: opts.roles,
    pageRange: 'all' as const,
  })

  const handleApplySecurity = useCallback(async () => {
    if (!selectedFile) return
    setIsApplying(true)
    setResult(null)
    try {
      const apiOptions = buildApiOptions(options)
      const response = await fetch(`/api/files/${selectedFile.id}/security`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: apiOptions }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Security failed' }))
        throw new Error(errorData.error || 'Security failed')
      }
      const data = await response.json()
      setResult(data as SecurityResultData)
      await useAppStore.getState().fetchFiles()
      toast({
        title: 'Security Applied',
        description: `${data.security.securityLevel} protection in ${(data.security.durationMs / 1000).toFixed(1)}s`,
      })
      addHistory(
        `Protected ${selectedFile.name} — ${data.security.securityLevel}`,
        { fileName: selectedFile.name, fileSize: selectedFile.size, encryptionLevel: options.encryptionLevel, securityLevel: data.security.securityLevel, sizeIncrease: data.security.sizeIncrease },
        'success'
      )
    } catch (error: any) {
      toast({ title: 'Security Failed', description: error.message, variant: 'destructive' })
    } finally {
      setIsApplying(false)
    }
  }, [selectedFile, options, toast, addHistory])

  const handleDownload = useCallback(() => {
    if (!result) return
    fetch(`/api/files/${result.file.id}/download?download=1`)
      .then((r) => { if (!r.ok) throw new Error('Download failed'); return r.blob() })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = result.file.name
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      })
      .catch(() => toast({ title: 'Download Failed', variant: 'destructive' }))
    toast({ title: 'Download Started', description: result.file.name })
  }, [result, toast])

  if (isBatchMode) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center"><Lock className="w-4 h-4 text-amber-600" /></div>
            <div><h1 className="text-base md:text-lg font-semibold text-gray-800">Batch Protect PDFs</h1><p className="text-xs text-gray-400">Apply security to multiple files</p></div>
          </div>
          <button onClick={() => setCurrentView('home')} className="p-2 rounded-md hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 md:p-6 md:flex-1 md:min-h-0 md:overflow-auto pb-4 md:pb-0"><BatchSecurityView onBack={() => setIsBatchMode(false)} /></div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center"><Lock className="w-4 h-4 text-amber-600" /></div>
          <div><h1 className="text-base md:text-lg font-semibold text-gray-800">PDF Security</h1><p className="text-xs text-gray-400">Protect, encrypt, and control access to your PDFs</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsBatchMode(true)}><Layers className="w-3.5 h-3.5 mr-1" />Batch Mode</Button>
          <button onClick={() => setCurrentView('home')} className="p-2 rounded-md hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-y-hidden">
        {/* Main Content */}
        <div className="p-4 md:p-6 md:flex-1 md:min-h-0 md:overflow-auto pb-4 md:pb-0">
          {!selectedFile ? (
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to secure</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button key={file.id} onClick={() => { setSelectedFile(file); setResult(null); setVerifyData(null) }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-amber-400 hover:shadow-md transition-all text-left group">
                      <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-amber-600" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-amber-600 truncate">{file.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.size)} · {file.pages} page{file.pages !== 1 ? 's' : ''}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                  <Lock className="w-12 h-12 mb-3 text-gray-300" /><p className="text-sm mb-2">No files available</p><p className="text-xs text-gray-300">Upload a PDF file first to protect it</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File */}
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-amber-600" /></div>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{selectedFile.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{formatFileSize(selectedFile.size)} · {selectedFile.pages} page{selectedFile.pages !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSelectedFile(null); setResult(null); setPreview(null); setVerifyData(null) }}>Change</Button>
                  </div>
                </CardContent>
              </Card>

              {/* Tab Switcher */}
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                {(['protect', 'verify', 'audit'] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={cn('flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
                      activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    )}>{tab}</button>
                ))}
              </div>

              {/* PROTECT TAB */}
              {activeTab === 'protect' && (
                <>
                  {/* Security Preview */}
                  {preview && !result && (
                    <Card className="border-amber-500/20 bg-amber-50/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3"><Eye className="w-4 h-4 text-amber-600" /><h4 className="text-sm font-medium text-amber-700">Security Preview</h4></div>
                        <div className="space-y-2">
                          {preview.preview.proposedSecurity.permissions.map((perm, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Shield className="w-3 h-3 text-amber-500" /><span>{perm}</span>
                            </div>
                          ))}
                          {preview.preview.estimatedSizeIncrease > 0 && (
                            <div className="flex items-center justify-between text-xs mt-2">
                              <span className="text-gray-500">Est. Size Increase</span>
                              <span className="font-medium text-gray-800">+{formatFileSize(preview.preview.estimatedSizeIncrease)}</span>
                            </div>
                          )}
                          {preview.preview.warnings.length > 0 && preview.preview.warnings.map((w, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-600 mt-1">
                              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /><span>{w}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {isLoadingPreview && !preview && !result && (
                    <Card className="border-gray-200"><CardContent className="p-4 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                      <span className="text-xs text-gray-500">Analyzing security options...</span>
                    </CardContent></Card>
                  )}

                  {/* Result */}
                  {result && (
                    <div className="space-y-4">
                      <Card className="border-amber-200 bg-amber-50/50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-800">Security Applied — {result.security.securityLevel} Level</p>
                              <p className="text-xs text-gray-500 mt-0.5">Protected in {(result.security.durationMs / 1000).toFixed(1)}s · +{formatFileSize(result.security.sizeIncrease)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-gray-200"><CardContent className="p-4">
                        <h4 className="text-xs font-medium text-gray-600 mb-3">Security Operations</h4>
                        <div className="space-y-2">
                          {result.security.operations.map((op, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <ChevronRight className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                              <p className="text-xs text-gray-700">{op.description}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent></Card>
                      <div className="flex items-center gap-3">
                        <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleDownload}><Download className="w-4 h-4 mr-2" />Download Protected PDF</Button>
                        <Button variant="outline" className="text-xs" onClick={() => { setSelectedFile(null); setResult(null); setPreview(null) }}>Protect Another</Button>
                      </div>
                    </div>
                  )}

                  {isApplying && !result && (
                    <Card className="border-gray-200"><CardContent className="p-8 flex flex-col items-center">
                      <Loader2 className="w-8 h-8 text-amber-600 animate-spin mb-3" />
                      <p className="text-sm font-medium text-gray-700">Applying Security...</p>
                      <p className="text-xs text-gray-400 mt-1">Encrypting {selectedFile.name}</p>
                    </CardContent></Card>
                  )}
                </>
              )}

              {/* VERIFY TAB */}
              {activeTab === 'verify' && (
                <div className="space-y-4">
                  <Button variant="outline" className="text-xs" onClick={handleVerify} disabled={!!verifyData}>
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                    {verifyData ? 'Verified' : 'Verify Security Status'}
                  </Button>
                  {verifyData && (
                    <Card className="border-gray-200"><CardContent className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-14 h-14 rounded-full flex items-center justify-center border-4',
                          verifyData.verify.securityScore >= 60 ? 'border-green-500' : verifyData.verify.securityScore >= 30 ? 'border-yellow-500' : 'border-red-500'
                        )}>
                          <span className={cn('text-lg font-bold',
                            verifyData.verify.securityScore >= 60 ? 'text-green-600' : verifyData.verify.securityScore >= 30 ? 'text-yellow-600' : 'text-red-600'
                          )}>{verifyData.verify.securityScore}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">Security Score</p>
                          <p className="text-xs text-gray-400">{verifyData.verify.isEncrypted ? 'Document is protected' : 'No protection applied'}</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs"><Key className="w-3 h-3 text-amber-500" /><span className="text-gray-500">Encryption:</span><span className="font-medium text-gray-800">{verifyData.verify.encryptionMethod}</span></div>
                          <div className="flex items-center gap-1.5 text-xs"><Printer className="w-3 h-3 text-blue-500" /><span className="text-gray-500">Print:</span><span className="font-medium text-gray-800">{verifyData.verify.permissions.print}</span></div>
                          <div className="flex items-center gap-1.5 text-xs"><Copy className="w-3 h-3 text-green-500" /><span className="text-gray-500">Copy:</span><span className="font-medium text-gray-800">{verifyData.verify.permissions.copy}</span></div>
                          <div className="flex items-center gap-1.5 text-xs"><PenTool className="w-3 h-3 text-purple-500" /><span className="text-gray-500">Modify:</span><span className="font-medium text-gray-800">{verifyData.verify.permissions.modify}</span></div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs"><Type className="w-3 h-3" /><span className="text-gray-500">Signature:</span><span className="font-medium">{verifyData.verify.hasSignature ? 'Yes' : 'No'}</span></div>
                          <div className="flex items-center gap-1.5 text-xs"><Clock className="w-3 h-3" /><span className="text-gray-500">Expiration:</span><span className="font-medium">{verifyData.verify.hasExpiration ? (verifyData.verify.isExpired ? 'Expired' : 'Active') : 'None'}</span></div>
                          <div className="flex items-center gap-1.5 text-xs"><Users className="w-3 h-3" /><span className="text-gray-500">Roles:</span><span className="font-medium">{verifyData.verify.hasRoleBased ? verifyData.verify.roles.join(', ') : 'None'}</span></div>
                        </div>
                      </div>
                    </CardContent></Card>
                  )}
                </div>
              )}

              {/* AUDIT TAB */}
              {activeTab === 'audit' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-gray-600">Security Audit Log</h4>
                  {auditEntries.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {auditEntries.map((entry: any, i: number) => (
                        <Card key={i} className="border-gray-100"><CardContent className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-[9px]">{entry.action}</Badge>
                            <span className="text-[10px] text-gray-400">{new Date(entry.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-xs font-medium text-gray-700 truncate">{entry.fileName}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{entry.details}</p>
                        </CardContent></Card>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-12 text-gray-400">
                      <BarChart3 className="w-8 h-8 mb-2 text-gray-200" />
                      <p className="text-xs">No security operations recorded yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings Panel */}
        {selectedFile && activeTab === 'protect' && (
          <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-gray-200 p-4 md:p-5 md:overflow-y-auto shrink-0">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Security Settings</h3>
            <div className="space-y-5">

              {/* 1. AES-256 Encryption */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1"><Shield className="w-3 h-3" />Encryption</label>
                  <Switch checked={options.enableEncryption} onCheckedChange={(v) => setOptions({ ...options, enableEncryption: v })} />
                </div>
                {options.enableEncryption && (
                  <div className="space-y-1.5">
                    {ENCRYPTION_OPTIONS.map((enc) => (
                      <button key={enc.id} onClick={() => setOptions({ ...options, encryptionLevel: enc.id })}
                        className={cn('w-full flex items-center gap-2.5 p-2.5 rounded-lg border-2 text-left transition-all',
                          options.encryptionLevel === enc.id ? 'border-amber-500 bg-amber-50/50' : 'border-gray-100 hover:border-gray-200'
                        )}>
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold',
                          options.encryptionLevel === enc.id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'
                        )}>🔒</div>
                        <div>
                          <p className="text-xs font-medium text-gray-800">{enc.label}</p>
                          <p className="text-[10px] text-gray-400">{enc.description}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] ml-auto shrink-0">{enc.strength}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* 2. Owner Password */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block flex items-center gap-1"><Key className="w-3 h-3" />Owner Password</label>
                <input type="password" value={options.ownerPassword} onChange={(e) => setOptions({ ...options, ownerPassword: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                  placeholder="Full control password" />
                <p className="text-[10px] text-gray-400 mt-1">Required to change permissions later</p>
              </div>

              {/* 3. User Password */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block flex items-center gap-1"><Key className="w-3 h-3" />User Password</label>
                <input type="password" value={options.userPassword} onChange={(e) => setOptions({ ...options, userPassword: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                  placeholder="Leave empty for open access" />
                <p className="text-[10px] text-gray-400 mt-1">Required to open the document (leave blank for unrestricted open)</p>
              </div>

              <Separator />

              {/* 4. Print Restrictions */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block flex items-center gap-1"><Printer className="w-3 h-3" />Print Permission</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRINT_OPTIONS.map((pr) => (
                    <button key={pr.id} onClick={() => setOptions({ ...options, printPermission: pr.id })}
                      className={cn('px-2 py-2 rounded-md text-[10px] font-medium border transition-all text-center',
                        options.printPermission === pr.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                      )}>{pr.label}</button>
                  ))}
                </div>
              </div>

              {/* 5. Copy Restrictions */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block flex items-center gap-1"><Copy className="w-3 h-3" />Copy Permission</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([{ id: 'allowed' as const, label: 'Allow Copy' }, { id: 'restricted' as const, label: 'Block Copy' }]).map((cp) => (
                    <button key={cp.id} onClick={() => setOptions({ ...options, copyPermission: cp.id })}
                      className={cn('px-2 py-2 rounded-md text-[10px] font-medium border transition-all text-center',
                        options.copyPermission === cp.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                      )}>{cp.label}</button>
                  ))}
                </div>
              </div>

              {/* Modify Permission */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block flex items-center gap-1"><PenTool className="w-3 h-3" />Modify Permission</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {MODIFY_OPTIONS.map((mp) => (
                    <button key={mp.id} onClick={() => setOptions({ ...options, modifyPermission: mp.id })}
                      className={cn('px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all text-center',
                        options.modifyPermission === mp.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                      )}>{mp.label}</button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* 6. Screenshot Deterrence */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1"><Camera className="w-3 h-3" />Screenshot Deterrence</label>
                  <Switch checked={options.enableScreenshotDeterrence} onCheckedChange={(v) => setOptions({ ...options, enableScreenshotDeterrence: v })} />
                </div>
                {options.enableScreenshotDeterrence && (
                  <div>
                    <input type="text" value={options.screenshotWatermarkText} onChange={(e) => setOptions({ ...options, screenshotWatermarkText: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      placeholder="Watermark text for screenshots" />
                    <p className="text-[10px] text-gray-400 mt-1">Adds subtle repeated watermark overlay</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* 7. Digital Signature */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1"><Type className="w-3 h-3" />Digital Signature</label>
                  <Switch checked={options.enableSignature} onCheckedChange={(v) => setOptions({ ...options, enableSignature: v })} />
                </div>
                {options.enableSignature && (
                  <div className="space-y-2">
                    <input type="text" value={options.signerName} onChange={(e) => setOptions({ ...options, signerName: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      placeholder="Signer name" />
                    <input type="email" value={options.signerEmail} onChange={(e) => setOptions({ ...options, signerEmail: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      placeholder="Signer email" />
                    <input type="text" value={options.signatureReason} onChange={(e) => setOptions({ ...options, signatureReason: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      placeholder="Reason for signing" />
                  </div>
                )}
              </div>

              <Separator />

              {/* 9. Access Expiration */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3" />Access Expiration</label>
                  <Switch checked={options.enableExpiration} onCheckedChange={(v) => setOptions({ ...options, enableExpiration: v })} />
                </div>
                {options.enableExpiration && (
                  <div className="space-y-2">
                    <input type="datetime-local" value={options.expirationDate} onChange={(e) => setOptions({ ...options, expirationDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
                    <div className="grid grid-cols-3 gap-1.5">
                      {([{ id: 'warn' as const, label: 'Warn' }, { id: 'block' as const, label: 'Block' }, { id: 'degrade' as const, label: 'Degrade' }]).map((ea) => (
                        <button key={ea.id} onClick={() => setOptions({ ...options, expirationAction: ea.id })}
                          className={cn('px-2 py-1.5 rounded-md text-[10px] font-medium border transition-all text-center',
                            options.expirationAction === ea.id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'
                          )}>{ea.label}</button>
                      ))}
                    </div>
                    <input type="text" value={options.expirationMessage} onChange={(e) => setOptions({ ...options, expirationMessage: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                      placeholder="Expiration message" />
                  </div>
                )}
              </div>

              <Separator />

              {/* 10. Role-Based Permissions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1"><Users className="w-3 h-3" />Role-Based Access</label>
                  <Switch checked={options.enableRoleBased} onCheckedChange={(v) => setOptions({ ...options, enableRoleBased: v })} />
                </div>
                {options.enableRoleBased && (
                  <div className="space-y-2">
                    {options.roles.map((role, i) => (
                      <div key={i} className="p-2.5 border border-gray-100 rounded-lg">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Shield className="w-3 h-3 text-amber-500" />
                          <span className="text-xs font-medium text-gray-700">{role.name}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <div className="text-[9px] text-gray-400">Print: <span className="text-gray-600">{role.print === 'none' ? '❌' : role.print === 'low-res' ? '⚠️' : '✅'}</span></div>
                          <div className="text-[9px] text-gray-400">Copy: <span className="text-gray-600">{role.copy === 'allowed' ? '✅' : '❌'}</span></div>
                          <div className="text-[9px] text-gray-400">Edit: <span className="text-gray-600">{role.modify === 'none' ? '❌' : '⚠️'}</span></div>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full text-[10px] h-7"
                      onClick={() => setOptions({
                        ...options,
                        roles: [...options.roles, { name: `Role ${options.roles.length + 1}`, password: '', print: 'none', copy: 'restricted', modify: 'none' }]
                      })}>+ Add Role</Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* File Info */}
              {selectedFile && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">File Information</label>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Name</span><span className="text-gray-700 truncate ml-2 max-w-[160px]">{selectedFile.name}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Size</span><span className="text-gray-700">{formatFileSize(selectedFile.size)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-gray-400">Pages</span><span className="text-gray-700">{selectedFile.pages}</span></div>
                  </div>
                </div>
              )}

              {/* Apply Button */}
              <div className="space-y-2">
                <Button className="w-full h-9 text-xs bg-amber-600 hover:bg-amber-700" disabled={isApplying} onClick={handleApplySecurity}>
                  {isApplying ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Applying...</> : <><Lock className="w-3.5 h-3.5 mr-1" />Protect PDF</>}
                </Button>
                <Button variant="outline" className="w-full h-9 text-xs" onClick={() => { setSelectedFile(null); setResult(null); setPreview(null) }}>Back to File List</Button>
              </div>
            </div>
            <Separator />
            <ToolHistoryPanel history={history} onDelete={deleteItem} onClearAll={clearHistory} toolLabel="PDF Security" isLoaded={isLoaded} compact />
          </div>
        )}
      </div>
    </div>
  )
}
