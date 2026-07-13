'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAppStore, formatFileSize, formatDate, PdfFile } from '@/store/app-store'
import {
  X,
  FileText,
  Loader2,
  Download,
  CheckCircle2,
  Eye,
  PenTool,
  Type,
  Shield,
  Clock,
  Users,
  Mail,
  Stamp,
  ScrollText,
  Scale,
  Undo2,
  Redo2,
  Layers,
  AlertTriangle,
  Verified,
  ChevronRight,
  Eraser,
  RotateCw,
  Plus,
  Minus,
  Trash2,
  Send,
  Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useToolHistory } from '@/hooks/use-tool-history'
import { ToolHistoryPanel } from '@/components/pdf-element/tool-history-panel'
import type {
  SignatureType,
  SignaturePosition,
  SignatureFont,
  DrawnSignature,
  DrawnPath,
  TypedSignature,
  CertificateInfo,
  SignerInfo,
  ComplianceStandard,
  AuditEvent,
  SignatureVerification,
} from '@/lib/pdf-signature-types'
import { SIGNATURE_FONTS } from '@/lib/pdf-signature-types'

// ─── Types ───────────────────────────────────────────────────────────────────

type SignatureMode = 'draw' | 'type' | 'certificate'
type SignatureTab = 'sign' | 'verify' | 'history' | 'workflow' | 'audit' | 'compliance'

interface SignatureOptionsState {
  type: SignatureMode
  signerName: string
  signerEmail: string
  signerOrganization: string
  signerTitle: string
  reason: string
  location: string
  position: SignaturePosition
  pageRange: 'all' | 'first' | 'last' | 'custom'
  customPages: string
  showDate: boolean
  showName: boolean
  showReason: boolean
  showLocation: boolean
  showOrganization: boolean
  opacity: number
  // Drawn
  penColor: string
  penWidth: number
  // Typed
  typedText: string
  typedFont: SignatureFont
  typedFontSize: number
  typedColor: string
  // Certificate
  certificateType: 'self-signed' | 'ca-issued' | 'p12-file'
  // Timestamp
  enableTimestamp: boolean
  // Audit
  enableAuditTrail: boolean
  // Compliance
  complianceStandards: ComplianceStandard[]
  // Multi-signer
  signers: SignerInfo[]
  // Email
  emailRecipients: EmailRecipient[]
}

interface EmailRecipient {
  email: string
  name: string
  message: string
}

interface SignatureResultData {
  file: PdfFile
  signature: {
    signatureId: string
    signerId: string
    originalSize: number
    signedSize: number
    sizeIncrease: number
    pagesSigned: number
    totalPages: number
    operations: { type: string; description: string; itemsProcessed: number }[]
    auditEvents: AuditEvent[]
    durationMs: number
  }
}

interface PreviewData {
  preview: {
    totalPages: number
    affectedPages: number
    signatureDimensions: { width: number; height: number }
    signaturePosition: { x: number; y: number }
    estimatedSizeIncrease: number
    existingSignatures: number
    existingSignatureDetails: Array<{
      signer: string
      date: string
      type: string
      valid: boolean
    }>
    warnings: string[]
  }
  fileInfo: { id: string; name: string; size: number; pages: number }
}

interface VerificationData {
  verifications: SignatureVerification[]
  fileInfo: { id: string; name: string; size: number; pages: number }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SIGNATURE_MODE_CARDS: { id: SignatureMode; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'draw', label: 'Draw', description: 'Draw your signature', icon: PenTool },
  { id: 'type', label: 'Type', description: 'Type your name', icon: Type },
  { id: 'certificate', label: 'Certificate', description: 'Digital certificate', icon: Shield },
]

const POSITION_OPTIONS: { id: SignaturePosition; label: string }[] = [
  { id: 'bottom-right', label: 'Bottom Right' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'bottom-center', label: 'Bottom Center' },
  { id: 'top-right', label: 'Top Right' },
  { id: 'top-left', label: 'Top Left' },
  { id: 'center', label: 'Center' },
]

const PEN_COLORS = ['#000000', '#1a3a5c', '#0d47a1', '#b71c1c', '#2e7d32', '#4a148c']

const COMPLIANCE_OPTIONS: { id: ComplianceStandard; label: string; description: string }[] = [
  { id: 'ESIGN', label: 'ESIGN Act', description: 'US Electronic Signatures' },
  { id: 'UETA', label: 'UETA', description: 'Uniform Electronic Transactions' },
  { id: 'eIDAS', label: 'eIDAS', description: 'EU Digital Identity' },
  { id: 'PECB', label: 'PECB', description: 'Professional Compliance' },
  { id: 'ISO-32000', label: 'ISO 32000', description: 'PDF Standard' },
]

const DEFAULT_OPTIONS: SignatureOptionsState = {
  type: 'draw',
  signerName: '',
  signerEmail: '',
  signerOrganization: '',
  signerTitle: '',
  reason: '',
  location: '',
  position: 'bottom-right',
  pageRange: 'all',
  customPages: '',
  showDate: true,
  showName: true,
  showReason: false,
  showLocation: false,
  showOrganization: false,
  opacity: 1.0,
  penColor: '#000000',
  penWidth: 2,
  typedText: '',
  typedFont: 'DancingScript',
  typedFontSize: 24,
  typedColor: '#000000',
  certificateType: 'self-signed',
  enableTimestamp: true,
  enableAuditTrail: true,
  complianceStandards: ['ESIGN', 'UETA'],
  signers: [],
  emailRecipients: [],
}

// ─── Signature Canvas Component ──────────────────────────────────────────────

function SignatureCanvas({
  paths,
  onPathsChange,
  penColor,
  penWidth,
}: {
  paths: DrawnPath[]
  onPathsChange: (paths: DrawnPath[]) => void
  penColor: string
  penWidth: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const currentPathRef = useRef<DrawnPath | null>(null)

  // Draw existing paths
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const path of paths) {
      if (path.points.length < 2) continue
      ctx.beginPath()
      ctx.strokeStyle = penColor
      ctx.lineWidth = penWidth
      ctx.moveTo(path.points[0].x, path.points[0].y)
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y)
      }
      ctx.stroke()
    }
  }, [paths, penColor, penWidth])

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const point = getCanvasPoint(e)
    setIsDrawing(true)
    currentPathRef.current = {
      points: [point],
      timestamp: Date.now(),
    }
  }

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing || !currentPathRef.current) return
    const point = getCanvasPoint(e)
    currentPathRef.current.points.push(point)

    // Draw in real-time
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pts = currentPathRef.current.points
    if (pts.length < 2) return

    ctx.beginPath()
    ctx.strokeStyle = penColor
    ctx.lineWidth = penWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y)
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
    ctx.stroke()
  }

  const handleEnd = () => {
    if (currentPathRef.current && currentPathRef.current.points.length > 1) {
      onPathsChange([...paths, currentPathRef.current])
    }
    setIsDrawing(false)
    currentPathRef.current = null
  }

  const handleClear = () => {
    onPathsChange([])
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  return (
    <div className="space-y-2">
      <div className="relative bg-white border-2 border-dashed border-gray-200 rounded-lg overflow-hidden" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="w-full cursor-crosshair"
          style={{ minHeight: 120 }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
        {paths.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-300 text-sm">Draw your signature here</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {PEN_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => {/* penColor change handled by parent */}}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-all',
                penColor === color ? 'border-gray-800 scale-110' : 'border-gray-200 hover:border-gray-400'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="outline" size="sm" className="text-[10px] h-7 px-2" onClick={handleClear}>
            <Eraser className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Typed Signature Preview ─────────────────────────────────────────────────

function TypedSignaturePreview({
  text,
  font,
  fontSize,
  color,
}: {
  text: string
  font: SignatureFont
  fontSize: number
  color: string
}) {
  const fontInfo = SIGNATURE_FONTS.find((f) => f.id === font)
  const displayText = text || 'Your Signature'

  // Map to web-safe fonts for preview
  const webFontMap: Record<SignatureFont, string> = {
    DancingScript: '"Dancing Script", cursive',
    GreatVibes: '"Great Vibes", cursive',
    Sacramento: '"Sacramento", cursive',
    AlexBrush: '"Alex Brush", cursive',
    Helvetica: 'Helvetica, Arial, sans-serif',
    TimesRoman: '"Times New Roman", Times, serif',
    Courier: '"Courier New", Courier, monospace',
    Papyrus: 'Papyrus, fantasy',
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 min-h-[80px] flex items-center justify-center">
      <span
        style={{
          fontFamily: webFontMap[font],
          fontSize: `${fontSize}px`,
          color,
          fontStyle: fontInfo?.style === 'script' ? 'italic' : 'normal',
          fontWeight: fontInfo?.style === 'formal' ? 'normal' : 'normal',
        }}
      >
        {displayText}
      </span>
    </div>
  )
}

// ─── Batch Sign View ─────────────────────────────────────────────────────────

function BatchSignView({ onBack }: { onBack: () => void }) {
  const { recentFiles } = useAppStore()
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [options, setOptions] = useState<SignatureOptionsState>(DEFAULT_OPTIONS)
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

  const handleBatchSign = async () => {
    if (selectedIds.size === 0) return
    setIsProcessing(true)

    try {
      const response = await fetch('/api/files/sign-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: Array.from(selectedIds),
          options: buildApiOptions(options),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Batch sign failed' }))
        throw new Error(errorData.error || 'Batch sign failed')
      }

      const data = await response.json()
      setResults(data)
      await useAppStore.getState().fetchFiles()

      toast({
        title: 'Batch Sign Complete',
        description: `${data.summary.success} files signed successfully`,
      })
    } catch (error: any) {
      toast({
        title: 'Batch Sign Failed',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Batch Sign</h3>
          <p className="text-xs text-gray-400">Apply the same signature to multiple PDFs</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={onBack}>
          Single File Mode
        </Button>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {recentFiles.map((file) => (
          <button
            key={file.id}
            onClick={() => toggleFile(file.id)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
              selectedIds.has(file.id) ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-100 hover:border-gray-200'
            )}
          >
            <div className={cn(
              'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
              selectedIds.has(file.id) ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
            )}>
              {selectedIds.has(file.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{file.name}</p>
            </div>
            <span className="text-[10px] text-gray-400 shrink-0">{formatFileSize(file.size)}</span>
          </button>
        ))}
      </div>

      {results ? (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Batch Complete</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-emerald-600">{results.summary.success}</p>
                <p className="text-[10px] text-gray-500">Signed</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-500">{results.summary.errors}</p>
                <p className="text-[10px] text-gray-500">Failed</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => setResults(null)}>
              Sign More
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={selectedIds.size === 0 || isProcessing || !options.signerName}
          onClick={handleBatchSign}
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing {selectedIds.size} Files...</>
          ) : (
            <><PenTool className="w-4 h-4 mr-2" />Sign {selectedIds.size} File{selectedIds.size !== 1 ? 's' : ''}</>
          )}
        </Button>
      )}
    </div>
  )
}

// ─── Verification View ───────────────────────────────────────────────────────

function VerificationView({ fileId }: { fileId: string }) {
  const [verifications, setVerifications] = useState<SignatureVerification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (!fileId || fetched) return

    let cancelled = false

    const doFetch = async () => {
      try {
        const r = await fetch(`/api/files/${fileId}/sign?action=verify`)
        const data = await r.json()
        if (!cancelled) {
          setVerifications(data.verifications || [])
        }
      } catch {
        if (!cancelled) {
          setVerifications([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          setFetched(true)
        }
      }
    }

    doFetch()

    return () => { cancelled = true }
  }, [fileId, fetched])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Verifying signatures...</span>
      </div>
    )
  }

  if (verifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <Shield className="w-10 h-10 mb-2 text-gray-300" />
        <p className="text-sm">No signatures found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {verifications.map((v, i) => (
        <Card key={i} className={cn(
          'border',
          v.isValid ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {v.isValid ? (
                <Verified className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              )}
              <span className={cn('text-sm font-semibold', v.isValid ? 'text-emerald-800' : 'text-red-800')}>
                {v.isValid ? 'Valid Signature' : 'Invalid Signature'}
              </span>
              <Badge variant="outline" className="text-[9px] ml-auto capitalize">
                {v.trustLevel} trust
              </Badge>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Signer</span>
                <span className="font-medium text-gray-700">{v.signer.name}</span>
              </div>
              {v.signer.organization && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Organization</span>
                  <span className="text-gray-700">{v.signer.organization}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="text-gray-700 capitalize">{v.type}</span>
              </div>
              {v.signedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Signed</span>
                  <span className="text-gray-700">{new Date(v.signedAt).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Modified After Signing</span>
                <span className={v.documentModified ? 'text-red-600 font-medium' : 'text-emerald-600'}>
                  {v.documentModified ? 'Yes — Warning' : 'No'}
                </span>
              </div>
              {v.warnings.length > 0 && (
                <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                  {v.warnings.map((w, j) => (
                    <p key={j} className="text-amber-700 text-[10px]">{w}</p>
                  ))}
                </div>
              )}
              {v.errors.length > 0 && (
                <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                  {v.errors.map((e, j) => (
                    <p key={j} className="text-red-700 text-[10px]">{e}</p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Audit Trail View ────────────────────────────────────────────────────────

function AuditTrailView({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <ScrollText className="w-10 h-10 mb-2 text-gray-300" />
        <p className="text-sm">No audit events yet</p>
        <p className="text-xs text-gray-300">Events will appear after signing</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {events.map((event) => (
        <div key={event.id} className="flex gap-3 p-2.5 bg-white rounded-lg border border-gray-100">
          <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
            {event.type.includes('signature') ? (
              <PenTool className="w-3 h-3 text-emerald-600" />
            ) : event.type === 'timestamp_applied' ? (
              <Clock className="w-3 h-3 text-emerald-600" />
            ) : event.type === 'compliance_check' ? (
              <Scale className="w-3 h-3 text-emerald-600" />
            ) : (
              <Eye className="w-3 h-3 text-gray-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700">{event.description}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-gray-400">{event.actorName}</span>
              <span className="text-[10px] text-gray-300">·</span>
              <span className="text-[10px] text-gray-400">{new Date(event.timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Compliance View ─────────────────────────────────────────────────────────

function ComplianceView({ standards }: { standards: ComplianceStandard[] }) {
  const complianceDetails: Record<ComplianceStandard, { name: string; icon: React.ElementType; requirements: string[] }> = {
    ESIGN: { name: 'ESIGN Act (US)', icon: Scale, requirements: ['Intent to Sign', 'Consent', 'Association', 'Record Retention', 'Attribution'] },
    UETA: { name: 'UETA', icon: Scale, requirements: ['Electronic Signature', 'Intent', 'Attribution', 'Alteration Detection'] },
    eIDAS: { name: 'eIDAS (EU)', icon: Globe, requirements: ['Identification', 'Non-Repudiation', 'Integrity', 'Qualified Certificate', 'Timestamp'] },
    PECB: { name: 'PECB', icon: Shield, requirements: ['Audit Logging', 'Access Control', 'Data Protection'] },
    'ISO-32000': { name: 'ISO 32000', icon: FileText, requirements: ['PDF Signature Dictionary', 'Byte Range', 'Certificate Chain', 'Revocation Check'] },
  }

  return (
    <div className="space-y-3">
      {standards.map((standard) => {
        const details = complianceDetails[standard]
        if (!details) return null
        const Icon = details.icon

        return (
          <Card key={standard} className="border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-gray-800">{details.name}</span>
                <Badge variant="outline" className="text-[9px] ml-auto">Active</Badge>
              </div>
              <div className="space-y-1">
                {details.requirements.map((req) => (
                  <div key={req} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span className="text-[11px] text-gray-600">{req}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Multi-Signer View ───────────────────────────────────────────────────────

function MultiSignerView({
  signers,
  onSignersChange,
}: {
  signers: SignerInfo[]
  onSignersChange: (signers: SignerInfo[]) => void
}) {
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const addSigner = () => {
    if (!newName || !newEmail) return
    const signer: SignerInfo = {
      id: crypto.randomUUID().slice(0, 8),
      name: newName,
      email: newEmail,
      signatureType: 'drawn',
      signatureBox: { x: 0, y: 0, width: 180, height: 80, page: 1 },
      status: 'pending',
      order: signers.length + 1,
    }
    onSignersChange([...signers, signer])
    setNewName('')
    setNewEmail('')
  }

  const removeSigner = (id: string) => {
    onSignersChange(signers.filter((s) => s.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Signer name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
        <input
          type="email"
          placeholder="Email address"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        />
        <Button variant="outline" size="sm" className="text-xs" onClick={addSigner} disabled={!newName || !newEmail}>
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>

      {signers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-gray-400">
          <Users className="w-8 h-8 mb-2 text-gray-300" />
          <p className="text-xs">No additional signers</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {signers.map((signer) => (
            <div key={signer.id} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-gray-100">
              <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center text-[10px] font-bold text-emerald-600">
                {signer.order}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{signer.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{signer.email}</p>
              </div>
              <Badge variant="outline" className="text-[9px] capitalize">{signer.status}</Badge>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-red-500" onClick={() => removeSigner(signer.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildApiOptions(opts: SignatureOptionsState) {
  const drawnSignature: DrawnSignature | undefined = opts.type === 'draw' ? {
    paths: [], // Will be populated from canvas state in parent
    color: opts.penColor,
    strokeWidth: opts.penWidth,
  } : undefined

  const typedSignature: TypedSignature | undefined = opts.type === 'type' ? {
    text: opts.typedText || opts.signerName,
    font: opts.typedFont,
    fontSize: opts.typedFontSize,
    color: opts.typedColor,
    italic: false,
    bold: false,
  } : undefined

  const certificate: CertificateInfo | undefined = opts.type === 'certificate' ? {
    type: opts.certificateType,
  } : undefined

  return {
    type: opts.type,
    drawnSignature,
    typedSignature,
    certificate,
    signerName: opts.signerName,
    signerEmail: opts.signerEmail,
    signerOrganization: opts.signerOrganization,
    signerTitle: opts.signerTitle,
    reason: opts.reason,
    location: opts.location,
    position: opts.position,
    pageRange: opts.pageRange,
    customPages: opts.customPages ? opts.customPages.split(',').map(Number) : undefined,
    showDate: opts.showDate,
    showName: opts.showName,
    showReason: opts.showReason,
    showLocation: opts.showLocation,
    showOrganization: opts.showOrganization,
    opacity: opts.opacity,
    enableTimestamp: opts.enableTimestamp,
    enableAuditTrail: opts.enableAuditTrail,
    complianceStandards: opts.complianceStandards,
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SignPdf() {
  const { recentFiles, setCurrentView } = useAppStore()
  const { toast } = useToast()
  const { history, addHistory, deleteItem, clearHistory, isLoaded } = useToolHistory('sign', 'Sign PDF')

  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null)
  const [options, setOptions] = useState<SignatureOptionsState>(DEFAULT_OPTIONS)
  const [result, setResult] = useState<SignatureResultData | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [activeTab, setActiveTab] = useState<SignatureTab>('sign')
  const [drawnPaths, setDrawnPaths] = useState<DrawnPath[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])

  // Fetch preview when file changes
  useEffect(() => {
    if (!selectedFile) return

    let cancelled = false
    const fetchPreview = async () => {
      setIsLoadingPreview(true)
      try {
        const apiOptions = buildApiOptions(options)
        const response = await fetch(
          `/api/files/${selectedFile.id}/sign?options=${encodeURIComponent(JSON.stringify(apiOptions))}`
        )
        if (!response.ok) throw new Error('Preview failed')
        const data = await response.json()
        if (!cancelled) {
          setPreview(data)
        }
      } catch (error) {
        console.error('Preview error:', error)
      } finally {
        if (!cancelled) setIsLoadingPreview(false)
      }
    }

    const timer = setTimeout(fetchPreview, 600)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [selectedFile?.id])

  const handleApplySignature = useCallback(async () => {
    if (!selectedFile) return
    setIsApplying(true)
    setResult(null)

    try {
      const apiOptions = buildApiOptions(options)

      // Include drawn paths if type is drawn
      if (options.type === 'draw' && drawnPaths.length > 0) {
        apiOptions.drawnSignature = {
          paths: drawnPaths,
          color: options.penColor,
          strokeWidth: options.penWidth,
        }
      }

      const response = await fetch(`/api/files/${selectedFile.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: apiOptions }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Sign failed' }))
        throw new Error(errorData.error || 'Sign failed')
      }

      const data = await response.json()
      setResult(data as SignatureResultData)
      setAuditEvents(data.signature.auditEvents || [])
      await useAppStore.getState().fetchFiles()

      toast({
        title: 'Signature Applied',
        description: `Signed ${data.signature.pagesSigned} page(s) in ${(data.signature.durationMs / 1000).toFixed(1)}s`,
      })

      addHistory(
        `Signed ${selectedFile.name} — ${data.signature.pagesSigned} page(s)`,
        {
          fileName: selectedFile.name,
          signer: options.signerName,
          type: options.type,
          pagesSigned: data.signature.pagesSigned,
          totalPages: data.signature.totalPages,
          fileSize: selectedFile.size,
          sizeIncrease: data.signature.sizeIncrease,
          position: options.position,
        }
      )
    } catch (error: any) {
      toast({
        title: 'Signature Failed',
        description: error.message || 'Failed to apply signature',
        variant: 'destructive',
      })
    } finally {
      setIsApplying(false)
    }
  }, [selectedFile, options, drawnPaths, toast, addHistory])

  const handleDownload = useCallback(() => {
    if (!result) return
    fetch(`/api/files/${result.file.id}/download?download=1`)
      .then((r) => { if (!r.ok) throw new Error('Download failed'); return r.blob() })
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
      .catch(() => toast({ title: 'Download Failed', variant: 'destructive' }))
    toast({ title: 'Download Started', description: `Downloading ${result.file.name}` })
  }, [result, toast])

  const toggleCompliance = (standard: ComplianceStandard) => {
    setOptions((prev) => ({
      ...prev,
      complianceStandards: prev.complianceStandards.includes(standard)
        ? prev.complianceStandards.filter((s) => s !== standard)
        : [...prev.complianceStandards, standard],
    }))
  }

  const tabItems: { id: SignatureTab; label: string; icon: React.ElementType }[] = [
    { id: 'sign', label: 'Sign', icon: PenTool },
    { id: 'verify', label: 'Verify', icon: Shield },
    { id: 'workflow', label: 'Workflow', icon: Users },
    { id: 'audit', label: 'Audit', icon: ScrollText },
    { id: 'compliance', label: 'Compliance', icon: Scale },
  ]

  if (isBatchMode) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <PenTool className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-semibold text-gray-800">Batch Sign PDFs</h1>
              <p className="text-xs text-gray-400">Apply signature to multiple files</p>
            </div>
          </div>
          <button onClick={() => setCurrentView('home')} className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-4 md:p-6 md:overflow-auto pb-4 md:pb-0">
          <BatchSignView onBack={() => setIsBatchMode(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
            <PenTool className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-semibold text-gray-800">Sign PDF Document</h1>
            <p className="text-xs text-gray-400">Draw, type, or certificate-based digital signatures</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsBatchMode(true)}>
            <Layers className="w-3.5 h-3.5 mr-1" />
            Batch
          </Button>
          <button onClick={() => setCurrentView('home')} className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-y-hidden">
        {/* Main Content */}
        <div className="md:flex-1 md:min-h-0 md:overflow-auto p-4 md:p-6 pb-4 md:pb-0">
          {!selectedFile ? (
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">Select a file to sign</h3>
              {recentFiles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentFiles.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => { setSelectedFile(file); setResult(null) }}
                      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-100 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-800 group-hover:text-emerald-600 truncate">{file.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{formatFileSize(file.size)} · {file.pages} page{file.pages !== 1 ? 's' : ''}</div>
                        <div className="text-[11px] text-gray-300 mt-0.5">{formatDate(file.updatedAt)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                  <PenTool className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-sm mb-2">No files available</p>
                  <p className="text-xs text-gray-300">Upload a PDF file first to sign documents</p>
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
                      <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{selectedFile.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {formatFileSize(selectedFile.size)} · {selectedFile.pages} page{selectedFile.pages !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs text-gray-500" onClick={() => { setSelectedFile(null); setResult(null); setPreview(null) }}>
                      Change
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {tabItems.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center',
                      activeTab === tab.id
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'sign' && !result && (
                <div className="space-y-4">
                  {/* Signature Mode Selector */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-600 mb-2">Signature Type</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {SIGNATURE_MODE_CARDS.map((sm) => (
                        <button
                          key={sm.id}
                          onClick={() => setOptions({ ...options, type: sm.id })}
                          className={cn(
                            'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all',
                            options.type === sm.id
                              ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                              : 'border-gray-100 hover:border-gray-200'
                          )}
                        >
                          <sm.icon className={cn('w-5 h-5', options.type === sm.id ? 'text-emerald-600' : 'text-gray-400')} />
                          <span className={cn('text-[11px] font-medium', options.type === sm.id ? 'text-emerald-700' : 'text-gray-500')}>
                            {sm.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Signer Info */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-600">Signer Information</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Full Name *"
                        value={options.signerName}
                        onChange={(e) => setOptions({ ...options, signerName: e.target.value })}
                        className="px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={options.signerEmail}
                        onChange={(e) => setOptions({ ...options, signerEmail: e.target.value })}
                        className="px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                      />
                      <input
                        type="text"
                        placeholder="Organization"
                        value={options.signerOrganization}
                        onChange={(e) => setOptions({ ...options, signerOrganization: e.target.value })}
                        className="px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                      />
                      <input
                        type="text"
                        placeholder="Title / Role"
                        value={options.signerTitle}
                        onChange={(e) => setOptions({ ...options, signerTitle: e.target.value })}
                        className="px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  {/* Draw Signature */}
                  {options.type === 'draw' && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-gray-600">Draw Your Signature</h4>
                      <SignatureCanvas
                        paths={drawnPaths}
                        onPathsChange={setDrawnPaths}
                        penColor={options.penColor}
                        penWidth={options.penWidth}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">Pen:</span>
                        {PEN_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setOptions({ ...options, penColor: color })}
                            className={cn(
                              'w-5 h-5 rounded-full border-2 transition-all',
                              options.penColor === color ? 'border-gray-800 scale-110' : 'border-gray-200'
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <span className="text-[10px] text-gray-400 ml-2">Width:</span>
                        <Slider
                          value={[options.penWidth]}
                          onValueChange={([v]) => setOptions({ ...options, penWidth: v })}
                          min={1}
                          max={6}
                          step={0.5}
                          className="w-20"
                        />
                      </div>
                    </div>
                  )}

                  {/* Type Signature */}
                  {options.type === 'type' && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-gray-600">Type Your Signature</h4>
                      <input
                        type="text"
                        placeholder="Type your name"
                        value={options.typedText}
                        onChange={(e) => setOptions({ ...options, typedText: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                      />
                      <TypedSignaturePreview
                        text={options.typedText || options.signerName}
                        font={options.typedFont}
                        fontSize={options.typedFontSize}
                        color={options.typedColor}
                      />
                      <div className="grid grid-cols-4 gap-1.5">
                        {SIGNATURE_FONTS.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setOptions({ ...options, typedFont: f.id })}
                            className={cn(
                              'px-2 py-1.5 rounded border text-[10px] font-medium transition-all',
                              options.typedFont === f.id
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-gray-100 text-gray-500 hover:border-gray-200'
                            )}
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Certificate Signature */}
                  {options.type === 'certificate' && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-medium text-gray-600">Certificate-Based Signing</h4>
                      <Card className="border-emerald-200 bg-emerald-50/30">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-medium text-emerald-700">Digital Certificate</span>
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 p-2 rounded border border-gray-200 bg-white cursor-pointer hover:border-emerald-400 transition-colors">
                              <input
                                type="radio"
                                name="cert-type"
                                checked={options.certificateType === 'self-signed'}
                                onChange={() => setOptions({ ...options, certificateType: 'self-signed' })}
                                className="text-emerald-600"
                              />
                              <div>
                                <p className="text-xs font-medium text-gray-700">Self-Signed Certificate</p>
                                <p className="text-[10px] text-gray-400">Auto-generated on the server</p>
                              </div>
                            </label>
                            <label className="flex items-center gap-2 p-2 rounded border border-gray-200 bg-white cursor-pointer hover:border-emerald-400 transition-colors">
                              <input
                                type="radio"
                                name="cert-type"
                                checked={options.certificateType === 'ca-issued'}
                                onChange={() => setOptions({ ...options, certificateType: 'ca-issued' })}
                                className="text-emerald-600"
                              />
                              <div>
                                <p className="text-xs font-medium text-gray-700">CA-Issued Certificate</p>
                                <p className="text-[10px] text-gray-400">Upload your PKCS#12 file</p>
                              </div>
                            </label>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Position & Page Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-medium text-gray-600 mb-2">Position</h4>
                      <select
                        value={options.position}
                        onChange={(e) => setOptions({ ...options, position: e.target.value as SignaturePosition })}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-white"
                      >
                        {POSITION_OPTIONS.map((p) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-gray-600 mb-2">Page Range</h4>
                      <select
                        value={options.pageRange}
                        onChange={(e) => setOptions({ ...options, pageRange: e.target.value as any })}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-white"
                      >
                        <option value="all">All Pages</option>
                        <option value="first">First Page Only</option>
                        <option value="last">Last Page Only</option>
                        <option value="custom">Custom Pages</option>
                      </select>
                    </div>
                  </div>

                  {options.pageRange === 'custom' && (
                    <input
                      type="text"
                      placeholder="Page numbers (e.g., 1,3,5-8)"
                      value={options.customPages}
                      onChange={(e) => setOptions({ ...options, customPages: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                    />
                  )}

                  {/* Display Options */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-600 mb-2">Display Options</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'showName' as const, label: 'Show Name', default: true },
                        { key: 'showDate' as const, label: 'Show Date', default: true },
                        { key: 'showReason' as const, label: 'Show Reason', default: false },
                        { key: 'showLocation' as const, label: 'Show Location', default: false },
                        { key: 'showOrganization' as const, label: 'Show Organization', default: false },
                        { key: 'enableTimestamp' as const, label: 'Timestamp', default: true },
                      ].map((opt) => (
                        <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={options[opt.key] as boolean}
                            onChange={(e) => setOptions({ ...options, [opt.key]: e.target.checked })}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-xs text-gray-600">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Reason & Location */}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Reason for signing"
                      value={options.reason}
                      onChange={(e) => setOptions({ ...options, reason: e.target.value })}
                      className="px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                    />
                    <input
                      type="text"
                      placeholder="Location (e.g., New York)"
                      value={options.location}
                      onChange={(e) => setOptions({ ...options, location: e.target.value })}
                      className="px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                    />
                  </div>

                  {/* Apply Button */}
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={isApplying || !options.signerName || (options.type === 'draw' && drawnPaths.length === 0 && !options.signerName)}
                    onClick={handleApplySignature}
                  >
                    {isApplying ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Applying Signature...</>
                    ) : (
                      <><PenTool className="w-4 h-4 mr-2" />Apply Signature</>
                    )}
                  </Button>
                </div>
              )}

              {/* Verify Tab */}
              {activeTab === 'verify' && selectedFile && (
                <VerificationView fileId={selectedFile.id} />
              )}

              {/* Workflow Tab */}
              {activeTab === 'workflow' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-medium text-gray-600 mb-2">Multi-Signer Workflow</h4>
                    <p className="text-[11px] text-gray-400 mb-3">Add additional signers for sequential or parallel signing</p>
                    <MultiSignerView
                      signers={options.signers}
                      onSignersChange={(signers) => setOptions({ ...options, signers })}
                    />
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-xs font-medium text-gray-600 mb-2">Email Signing Requests</h4>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="email"
                          placeholder="Recipient email"
                          className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                        />
                        <Button variant="outline" size="sm" className="text-xs">
                          <Send className="w-3 h-3 mr-1" />
                          Send
                        </Button>
                      </div>
                      <p className="text-[10px] text-gray-400">Recipients will receive an email with a link to sign the document</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Audit Tab */}
              {activeTab === 'audit' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-medium text-gray-800">Audit Trail</h4>
                    {options.enableAuditTrail && (
                      <Badge variant="outline" className="text-[9px] text-emerald-600">Enabled</Badge>
                    )}
                  </div>
                  <AuditTrailView events={auditEvents} />
                </div>
              )}

              {/* Compliance Tab */}
              {activeTab === 'compliance' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-medium text-gray-800">Legal Compliance</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {COMPLIANCE_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                          options.complianceStandards.includes(opt.id)
                            ? 'border-emerald-500 bg-emerald-50/30'
                            : 'border-gray-100 hover:border-gray-200'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={options.complianceStandards.includes(opt.id)}
                          onChange={() => toggleCompliance(opt.id)}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <p className="text-xs font-medium text-gray-700">{opt.label}</p>
                          <p className="text-[10px] text-gray-400">{opt.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <ComplianceView standards={options.complianceStandards} />
                </div>
              )}

              {/* Result */}
              {result && (
                <Card className="border-emerald-200 bg-emerald-50/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800">Document Signed Successfully</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Signature ID</span>
                        <span className="font-mono text-gray-700">{result.signature.signatureId.slice(0, 12)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Pages Signed</span>
                        <span className="text-gray-700">{result.signature.pagesSigned} of {result.signature.totalPages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Duration</span>
                        <span className="text-gray-700">{(result.signature.durationMs / 1000).toFixed(1)}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Size Change</span>
                        <span className={result.signature.sizeIncrease > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                          {result.signature.sizeIncrease > 0 ? '+' : ''}{formatFileSize(result.signature.sizeIncrease)}
                        </span>
                      </div>
                    </div>

                    {/* Operations */}
                    {result.signature.operations.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {result.signature.operations.map((op, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500">
                            <ChevronRight className="w-3 h-3 text-emerald-500" />
                            {op.description}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleDownload}>
                        <Download className="w-4 h-4 mr-2" />
                        Download Signed PDF
                      </Button>
                      <Button variant="outline" className="text-xs" onClick={() => { setResult(null); setAuditEvents([]) }}>
                        Sign Again
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Preview Info */}
              {preview && !result && activeTab === 'sign' && (
                <Card className="border-gray-200 bg-gray-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-4 h-4 text-gray-500" />
                      <span className="text-xs font-medium text-gray-700">Signature Preview</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Pages</span>
                        <span className="text-gray-700">{preview.preview.affectedPages} of {preview.preview.totalPages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Est. Size</span>
                        <span className="text-gray-700">+{formatFileSize(preview.preview.estimatedSizeIncrease)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Existing Sigs</span>
                        <span className="text-gray-700">{preview.preview.existingSignatures}</span>
                      </div>
                    </div>
                    {preview.preview.warnings.length > 0 && (
                      <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                        {preview.preview.warnings.map((w, i) => (
                          <p key={i} className="text-[10px] text-amber-700 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {w}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* History Panel */}
              <Separator />
              <ToolHistoryPanel
                history={history}
                onDelete={deleteItem}
                onClearAll={clearHistory}
                toolLabel="Sign PDF"
                isLoaded={isLoaded}
                compact
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
