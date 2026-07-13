'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  QrCode,
  Globe,
  Wifi,
  Type,
  Mail,
  Phone,
  MessageSquare,
  User,
  MessageCircle,
  Video,
  Bitcoin,
  Share2,
  Image as ImageIcon,
  Download,
  Copy,
  RotateCcw,
  Palette,
  Frame,
  Stamp,
  Link2,
  Zap,
  Sparkles,
  ChevronRight,
  Check,
  Settings,
  Plus,
  Trash2,
  Smartphone,
  Share,
  Contact,
  DollarSign,
  Play,
  Clock,
  History,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type QrCategory = 'simple' | 'advanced' | 'quick-links' | 'edit' | 'history'

interface QrType {
  id: string
  label: string
  icon: React.ElementType
  category: QrCategory
  color: string
  description: string
  subGroup?: string
}

interface QrCustomization {
  fgColor: string
  bgColor: string
  size: number
  errorLevel: 'L' | 'M' | 'Q' | 'H'
  frameEnabled: boolean
  frameText: string
  frameColor: string
  logoEnabled: boolean
  logoUrl: string
  logoSize: number
}

interface QrTemplate {
  id: string
  name: string
  type: string
  colors: { fg: string; bg: string }
  frame?: { enabled: boolean; text: string; color: string }
  icon: React.ElementType
}

interface QrHistoryItem {
  id: string
  typeId: string
  typeLabel: string
  typeColor: string
  data: string
  dataPreview: string
  customization: QrCustomization
  qrDataUrl: string
  createdAt: string
}

// ──────────────────────────────────────────────
// Constants — Rebalanced Categories
// ──────────────────────────────────────────────

/** Convert hex color to rgba for reliable cross-browser support */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const QR_HISTORY_KEY = 'creatortools-qr-history'
const QR_HISTORY_LIMIT = 50

function getQrHistory(): QrHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QR_HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveQrHistoryItem(item: QrHistoryItem): void {
  const history = getQrHistory()
  history.unshift(item) // newest first
  if (history.length > QR_HISTORY_LIMIT) {
    history.splice(QR_HISTORY_LIMIT) // remove oldest
  }
  localStorage.setItem(QR_HISTORY_KEY, JSON.stringify(history))
}

function deleteQrHistoryItem(id: string): QrHistoryItem[] {
  const history = getQrHistory().filter(h => h.id !== id)
  localStorage.setItem(QR_HISTORY_KEY, JSON.stringify(history))
  return history
}

function clearQrHistory(): void {
  localStorage.removeItem(QR_HISTORY_KEY)
}

function truncatePreview(text: string, maxLen: number = 50): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

function getTimeAgo(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(isoDate).toLocaleDateString()
}

const QR_TYPES: QrType[] = [
  // Simple — core everyday types
  { id: 'url', label: 'Web Links', icon: Globe, category: 'simple', color: '#3B82F6', description: 'Generate QR for any website URL', subGroup: 'basic' },
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi, category: 'simple', color: '#10B981', description: 'Wi-Fi QR with/without password', subGroup: 'basic' },
  { id: 'text', label: 'Simple Text', icon: Type, category: 'simple', color: '#8B5CF6', description: 'One-click text QR code', subGroup: 'basic' },
  { id: 'email', label: 'Email ID', icon: Mail, category: 'simple', color: '#F59E0B', description: 'Email with subject & message', subGroup: 'communication' },
  { id: 'phone', label: 'Mobile/Phone', icon: Phone, category: 'simple', color: '#EF4444', description: 'Phone number QR code', subGroup: 'communication' },
  { id: 'sms', label: 'SMS', icon: MessageSquare, category: 'simple', color: '#EC4899', description: 'SMS QR code generator', subGroup: 'communication' },

  // Advanced — messaging, contacts, crypto, calls
  { id: 'whatsapp-chat', label: 'WhatsApp Chat', icon: MessageCircle, category: 'advanced', color: '#25D366', description: 'Open a WhatsApp chat', subGroup: 'messaging' },
  { id: 'whatsapp-msg', label: 'WhatsApp Message', icon: Share2, category: 'advanced', color: '#128C7E', description: 'Pre-filled WhatsApp message', subGroup: 'messaging' },
  { id: 'skype', label: 'Skype Call', icon: Phone, category: 'advanced', color: '#00AFF0', description: 'Skype call QR code', subGroup: 'calls' },
  { id: 'contact', label: 'Contact (vCard)', icon: Contact, category: 'advanced', color: '#6366F1', description: 'Full vCard contact QR', subGroup: 'professional' },
  { id: 'bitcoin', label: 'Bitcoin/Crypto', icon: Bitcoin, category: 'advanced', color: '#F7931A', description: 'Bitcoin & crypto payment QR', subGroup: 'professional' },

  // Quick Links — social media & sharing
  { id: 'youtube', label: 'YouTube', icon: Play, category: 'quick-links', color: '#FF0000', description: 'YouTube video, channel or playlist', subGroup: 'video' },
  { id: 'social-share', label: 'Social Share', icon: Share, category: 'quick-links', color: '#1877F2', description: 'Share to social platforms', subGroup: 'social' },
  { id: 'app-link', label: 'App Download', icon: Smartphone, category: 'quick-links', color: '#000000', description: 'App store download link', subGroup: 'social' },
]

const SUBGROUP_LABELS: Record<string, Record<string, string>> = {
  simple: {
    basic: 'Basic QR',
    communication: 'Communication',
  },
  advanced: {
    messaging: 'Messaging',
    calls: 'Calls',
    professional: 'Professional',
  },
  'quick-links': {
    video: 'Video',
    social: 'Social',
  },
}

const TEMPLATES: QrTemplate[] = [
  { id: 't-social', name: 'Social Profile', type: 'url', colors: { fg: '#1877F2', bg: '#FFFFFF' }, frame: { enabled: true, text: 'FOLLOW ME', color: '#1877F2' }, icon: User },
  { id: 't-youtube', name: 'YouTube Video', type: 'youtube', colors: { fg: '#FF0000', bg: '#FFFFFF' }, frame: { enabled: true, text: 'WATCH NOW', color: '#FF0000' }, icon: Video },
  { id: 't-app', name: 'App Download', type: 'app-link', colors: { fg: '#000000', bg: '#FFFFFF' }, frame: { enabled: true, text: 'DOWNLOAD APP', color: '#000000' }, icon: Download },
  { id: 't-wifi', name: 'Wi-Fi Access', type: 'wifi', colors: { fg: '#10B981', bg: '#FFFFFF' }, frame: { enabled: true, text: 'SCAN TO CONNECT', color: '#10B981' }, icon: Wifi },
  { id: 't-email', name: 'Email Me', type: 'email', colors: { fg: '#F59E0B', bg: '#FFFFFF' }, frame: { enabled: true, text: 'EMAIL ME', color: '#F59E0B' }, icon: Mail },
  { id: 't-crypto', name: 'Bitcoin Pay', type: 'bitcoin', colors: { fg: '#F7931A', bg: '#FFFFFF' }, frame: { enabled: true, text: 'PAY WITH BTC', color: '#F7931A' }, icon: Bitcoin },
  { id: 't-whatsapp', name: 'WhatsApp Us', type: 'whatsapp-chat', colors: { fg: '#25D366', bg: '#FFFFFF' }, frame: { enabled: true, text: 'CHAT WITH US', color: '#25D366' }, icon: MessageCircle },
  { id: 't-blog', name: 'Blog Post', type: 'url', colors: { fg: '#8B5CF6', bg: '#FFFFFF' }, frame: { enabled: true, text: 'READ MORE', color: '#8B5CF6' }, icon: Type },
]

const COLOR_PRESETS = [
  '#000000', '#1E293B', '#374151', '#3B82F6', '#2563EB', '#1D4ED8',
  '#10B981', '#059669', '#047857', '#F59E0B', '#D97706', '#B45309',
  '#EF4444', '#DC2626', '#B91C1C', '#8B5CF6', '#7C3AED', '#6D28D9',
  '#EC4899', '#DB2777', '#BE185D', '#F7931A', '#00AFF0', '#25D366',
]

const FRAME_STYLES = [
  { id: 'square', label: 'Square' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'banner', label: 'Banner' },
  { id: 'badge', label: 'Badge' },
]

// ──────────────────────────────────────────────
// Sub-Components
// ──────────────────────────────────────────────

/** Color picker with preset swatches and custom input */
function ColorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [customOpen, setCustomOpen] = useState(false)
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => { onChange(c); setCustomOpen(false) }}
            className={cn(
              'w-7 h-7 rounded-md border-2 transition-all duration-150 hover:scale-110',
              value === c ? 'border-gray-900 ring-2 ring-offset-1 ring-gray-300' : 'border-gray-200'
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        <button
          onClick={() => setCustomOpen(!customOpen)}
          className={cn(
            'w-7 h-7 rounded-md border-2 border-dashed flex items-center justify-center transition-all duration-150',
            customOpen ? 'border-gray-400 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
          )}
        >
          <Plus className="w-3 h-3 text-gray-400" />
        </button>
      </div>
      {customOpen && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 p-0"
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-xs font-mono flex-1"
            placeholder="#000000"
          />
        </div>
      )}
    </div>
  )
}

/**
 * QR Code Preview Canvas
 *
 * FIXES APPLIED:
 * 1. Canvas is ALWAYS in the DOM (not hidden behind conditional) so the ref is always valid
 * 2. Uses a rendering flag to prevent stale draws after unmount/prop change
 * 3. Logo drawing is sequenced properly — redraws full canvas after logo loads
 * 4. Canvas dimensions set with DPR scaling for crisp rendering on HiDPI screens
 */
function QrPreview({ qrDataUrl, customization, isLoading }: {
  qrDataUrl: string | null
  customization: QrCustomization
  isLoading: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Track the current render ID to cancel stale draws
  const renderIdRef = useRef(0)

  // FIX: Auto-scroll preview into view when QR code is generated
  // On mobile, the preview is below the fold, so the user can't see it after generation
  useEffect(() => {
    if (qrDataUrl && containerRef.current) {
      // Use a short delay to let the canvas render first
      const timer = setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [qrDataUrl])

  useEffect(() => {
    if (!qrDataUrl || !canvasRef.current) return

    // Increment render ID to invalidate any in-flight draws
    const currentRenderId = ++renderIdRef.current

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      // FIX: Check if this render is still current (props haven't changed while image was loading)
      if (currentRenderId !== renderIdRef.current) return

      const totalSize = customization.size + (customization.frameEnabled ? 60 : 0)
      const canvasHeight = totalSize + (customization.frameEnabled ? 36 : 0)

      // FIX: Use devicePixelRatio for crisp rendering on Retina/HiDPI screens
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      canvas.width = totalSize * dpr
      canvas.height = canvasHeight * dpr
      canvas.style.width = `${totalSize}px`
      canvas.style.height = `${canvasHeight}px`
      ctx.scale(dpr, dpr)

      // Draw background
      ctx.fillStyle = customization.bgColor
      ctx.fillRect(0, 0, totalSize, canvasHeight)

      // Draw frame header (if enabled)
      if (customization.frameEnabled) {
        ctx.fillStyle = customization.frameColor
        ctx.fillRect(0, 0, totalSize, 50)
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 16px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(customization.frameText || 'SCAN ME', totalSize / 2, 33)
        ctx.drawImage(img, (totalSize - customization.size) / 2, 56, customization.size, customization.size)
      } else {
        ctx.drawImage(img, 0, 0, customization.size, customization.size)
      }

      // FIX: Logo is drawn synchronously with proper sequencing
      // If logo is enabled, we load it and redraw the entire canvas after it loads
      if (customization.logoEnabled && customization.logoUrl) {
        const logoImg = new Image()
        logoImg.crossOrigin = 'anonymous'
        logoImg.onload = () => {
          // Check again if still current after logo loads
          if (currentRenderId !== renderIdRef.current) return

          const ls = customization.logoSize
          const x = (totalSize - ls) / 2
          const y = (customization.frameEnabled ? 56 : 0) + (customization.size - ls) / 2
          // White background behind logo for visibility
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(x - 6, y - 6, ls + 12, ls + 12)
          ctx.drawImage(logoImg, x, y, ls, ls)
        }
        logoImg.src = customization.logoUrl
      }
    }
    img.src = qrDataUrl

    // FIX: Cleanup — increment renderId to cancel any in-flight image loads
    return () => {
      renderIdRef.current++
    }
  }, [qrDataUrl, customization])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full aspect-square max-w-[320px] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Generating...</span>
        </div>
      </div>
    )
  }

  if (!qrDataUrl) {
    return (
      <div className="flex items-center justify-center w-full aspect-square max-w-[320px] bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-600/30">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <QrCode className="w-16 h-16 stroke-1" />
          <p className="text-sm font-medium">QR Code Preview</p>
          <p className="text-xs text-gray-600">Enter data to generate</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-3">
      <div className="rounded-2xl overflow-hidden shadow-lg border border-white/10">
        {/*
          FIX: Canvas is ALWAYS rendered (not conditionally hidden)
          so the ref is always valid when qrDataUrl is set
        */}
        <canvas ref={canvasRef} className="block" />
      </div>
      <div className="flex items-center gap-1.5 text-green-400">
        <Check className="w-4 h-4" />
        <span className="text-sm font-medium">QR Code generated successfully</span>
      </div>
      <p className="text-xs text-gray-500">Click the save button to download</p>
    </div>
  )
}

/** Input form for each QR type */
function QrInputForm({ type, onGenerate }: { type: QrType; onGenerate: (data: string) => void }) {
  const [formData, setFormData] = useState<Record<string, string>>({})

  const update = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleInputChange = (key: string, value: string) => {
    update(key, value)
  }

  const handleGenerate = () => {
    let data = ''
    switch (type.id) {
      case 'url':
        data = formData.url || ''
        break
      case 'wifi': {
        const ssid = formData.ssid || ''
        const pass = formData.password || ''
        const hidden = formData.hidden === 'true' ? 'H:true;' : ''
        const enc = formData.encryption || 'WPA'
        data = `WIFI:T:${enc};S:${ssid};P:${pass};${hidden};`
        break
      }
      case 'text':
        data = formData.text || ''
        break
      case 'email': {
        const email = formData.email || ''
        const subject = formData.subject ? `?subject=${encodeURIComponent(formData.subject)}` : ''
        const body = formData.body ? `${subject ? '&' : '?'}body=${encodeURIComponent(formData.body)}` : ''
        data = `mailto:${email}${subject}${body}`
        break
      }
      case 'phone':
        data = `tel:${formData.phone || ''}`
        break
      case 'sms':
        data = `smsto:${formData.phone || ''}:${formData.message || ''}`
        break
      case 'whatsapp-chat':
        data = `https://wa.me/${(formData.phone || '').replace(/[^0-9]/g, '')}`
        break
      case 'whatsapp-msg':
        data = `https://wa.me/${(formData.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(formData.message || '')}`
        break
      case 'contact': {
        const vcard = [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `N:${formData.lastName || ''};${formData.firstName || ''};;;`,
          `FN:${formData.firstName || ''} ${formData.lastName || ''}`,
          formData.phone ? `TEL;TYPE=CELL:${formData.phone}` : '',
          formData.email ? `EMAIL:${formData.email}` : '',
          formData.org ? `ORG:${formData.org}` : '',
          formData.title ? `TITLE:${formData.title}` : '',
          formData.website ? `URL:${formData.website}` : '',
          'END:VCARD',
        ].filter(Boolean).join('\n')
        data = vcard
        break
      }
      case 'skype':
        data = `skype:${formData.username || ''}?call`
        break
      case 'bitcoin':
        data = `bitcoin:${formData.address || ''}?amount=${formData.amount || ''}&label=${formData.label || ''}`
        break
      case 'youtube': {
        const ytUrl = formData.url || ''
        data = ytUrl
        break
      }
      case 'social-share': {
        const shareUrl = formData.url || ''
        const shareText = formData.text ? `&text=${encodeURIComponent(formData.text)}` : ''
        data = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shareUrl)}${shareText}`
        // For QR content, just encode the share URL directly
        data = shareUrl
        break
      }
      case 'app-link': {
        data = formData.url || ''
        break
      }
      default:
        data = formData.url || formData.text || ''
    }
    if (!data) {
      toast.error('Please fill in the required fields')
      return
    }
    onGenerate(data)
  }

  const renderFields = () => {
    switch (type.id) {
      case 'url':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">Website Address</Label>
              <Input
                placeholder="https://www.google.com"
                value={formData.url || ''}
                onChange={(e) => handleInputChange('url', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        )
      case 'wifi':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">Network Name (SSID)</Label>
              <Input
                placeholder="MyWiFiNetwork"
                value={formData.ssid || ''}
                onChange={(e) => handleInputChange('ssid', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Encryption</Label>
              <Select value={formData.encryption || 'WPA'} onValueChange={(v) => update('encryption', v)}>
                <SelectTrigger className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WPA">WPA/WPA2</SelectItem>
                  <SelectItem value="WEP">WEP</SelectItem>
                  <SelectItem value="nopass">None (Open)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Password</Label>
              <Input
                type="password"
                placeholder="Enter Wi-Fi password"
                value={formData.password || ''}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.hidden === 'true'}
                onCheckedChange={(v) => update('hidden', v ? 'true' : 'false')}
              />
              <Label className="text-sm text-gray-300">Hidden Network</Label>
            </div>
          </div>
        )
      case 'text':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">Text Content</Label>
              <Textarea
                placeholder="This is a simple text QR Code"
                value={formData.text || ''}
                onChange={(e) => handleInputChange('text', e.target.value)}
                className="mt-1.5 min-h-[120px] resize-none bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
                rows={5}
              />
            </div>
            <p className="text-xs text-gray-500">{(formData.text || '').length} characters</p>
          </div>
        )
      case 'email':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">Email Address</Label>
              <Input
                type="email"
                placeholder="hello@example.com"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Subject</Label>
              <Input
                placeholder="Email subject line"
                value={formData.subject || ''}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Message</Label>
              <Textarea
                placeholder="Email body content"
                value={formData.body || ''}
                onChange={(e) => handleInputChange('body', e.target.value)}
                className="mt-1.5 min-h-[100px] resize-none bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
                rows={4}
              />
            </div>
          </div>
        )
      case 'phone':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">Phone Number</Label>
              <Input
                type="tel"
                placeholder="+1 234 567 8900"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        )
      case 'sms':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">Phone Number</Label>
              <Input
                type="tel"
                placeholder="+1 234 567 8900"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Message</Label>
              <Textarea
                placeholder="Your SMS message"
                value={formData.message || ''}
                onChange={(e) => handleInputChange('message', e.target.value)}
                className="mt-1.5 min-h-[100px] resize-none bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
                rows={4}
              />
            </div>
          </div>
        )
      case 'whatsapp-chat':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">WhatsApp Number</Label>
              <Input
                type="tel"
                placeholder="1234567890 (with country code, no +)"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <p className="text-xs text-gray-500">Enter number with country code but without + or spaces</p>
          </div>
        )
      case 'whatsapp-msg':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">WhatsApp Number</Label>
              <Input
                type="tel"
                placeholder="1234567890 (with country code, no +)"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Pre-filled Message</Label>
              <Textarea
                placeholder="Hello! I'd like to know more about..."
                value={formData.message || ''}
                onChange={(e) => handleInputChange('message', e.target.value)}
                className="mt-1.5 min-h-[100px] resize-none bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
                rows={4}
              />
            </div>
          </div>
        )
      case 'contact':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-gray-300">First Name</Label>
                <Input
                  placeholder="John"
                  value={formData.firstName || ''}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-300">Last Name</Label>
                <Input
                  placeholder="Doe"
                  value={formData.lastName || ''}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Phone</Label>
              <Input
                type="tel"
                placeholder="+1 234 567 8900"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Email</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Organization</Label>
              <Input
                placeholder="Company Inc."
                value={formData.org || ''}
                onChange={(e) => handleInputChange('org', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Job Title</Label>
              <Input
                placeholder="Software Engineer"
                value={formData.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Website</Label>
              <Input
                placeholder="https://example.com"
                value={formData.website || ''}
                onChange={(e) => handleInputChange('website', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        )
      case 'skype':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">Skype Username</Label>
              <Input
                placeholder="skype_username"
                value={formData.username || ''}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <p className="text-xs text-gray-500">Scanning will initiate a Skype call to this user</p>
          </div>
        )
      case 'bitcoin':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">Wallet Address</Label>
              <Input
                placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                value={formData.address || ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500 font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Amount</Label>
              <Input
                type="number"
                placeholder="0.001"
                value={formData.amount || ''}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Label</Label>
              <Input
                placeholder="Payment reference"
                value={formData.label || ''}
                onChange={(e) => handleInputChange('label', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        )
      case 'youtube':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">YouTube Video/Channel Link</Label>
              <Input
                placeholder="https://youtube.com/watch?v=..."
                value={formData.url || ''}
                onChange={(e) => handleInputChange('url', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Link Type</Label>
              <Select value={formData.linkType || 'video'} onValueChange={(v) => update('linkType', v)}>
                <SelectTrigger className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="channel">Channel</SelectItem>
                  <SelectItem value="playlist">Playlist</SelectItem>
                  <SelectItem value="shorts">Shorts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500">Paste a YouTube video, playlist, or channel URL</p>
          </div>
        )
      case 'social-share':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">Share URL</Label>
              <Input
                placeholder="https://example.com/page"
                value={formData.url || ''}
                onChange={(e) => handleInputChange('url', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Share Text (Optional)</Label>
              <Input
                placeholder="Check this out!"
                value={formData.text || ''}
                onChange={(e) => handleInputChange('text', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Platform</Label>
              <Select value={formData.platform || 'any'} onValueChange={(v) => update('platform', v)}>
                <SelectTrigger className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Platform</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-500">Scanning opens the link for sharing on the selected platform</p>
          </div>
        )
      case 'app-link':
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">App Download URL</Label>
              <Input
                placeholder="https://apps.apple.com/app/..."
                value={formData.url || ''}
                onChange={(e) => handleInputChange('url', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">App Name (Optional)</Label>
              <Input
                placeholder="My App"
                value={formData.appName || ''}
                onChange={(e) => handleInputChange('appName', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
            <p className="text-xs text-gray-500">Use your App Store or Google Play URL</p>
          </div>
        )
      default:
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-gray-300">Content</Label>
              <Input
                placeholder="Enter data..."
                value={formData.text || ''}
                onChange={(e) => handleInputChange('text', e.target.value)}
                className="mt-1.5 h-11 bg-slate-800/60 border-slate-600/40 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        )
    }
  }

  return (
    <div className="space-y-4">
      {renderFields()}
      <Button
        onClick={handleGenerate}
        className="w-full h-12 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
      >
        <QrCode className="w-4 h-4 mr-2" />
        Generate QR Code
      </Button>
    </div>
  )
}

// ──────────────────────────────────────────────
// QR Type Card — Grid item with icon, label, description
// ──────────────────────────────────────────────

function QrTypeCard({ type, isActive, onClick, className }: { type: QrType; isActive: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center text-center p-3 gap-2 rounded-xl transition-all duration-200 border w-full',
        'sm:flex sm:items-center sm:text-left sm:gap-3 sm:flex-row',
        isActive
          ? 'border-orange-500/50 bg-orange-500/10 shadow-md ring-1 ring-orange-500/20'
          : 'border-slate-700/50 bg-slate-800/40 hover:bg-slate-700/40 hover:border-slate-600/50',
        className
      )}
    >
      <div
        className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mx-auto sm:mx-0"
        style={{ backgroundColor: hexToRgba(type.color, isActive ? 0.19 : 0.08) }}
      >
        <type.icon className="w-4 h-4" style={{ color: type.color }} />
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className={cn(
          'text-sm font-medium truncate',
          isActive ? 'text-orange-400' : 'text-gray-300'
        )}>
          {type.label}
        </p>
        <p className="text-[11px] text-gray-500 truncate">{type.description}</p>
      </div>
      {isActive && (
        <div className="shrink-0 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  )
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

export function QrGenerator() {
  const [activeCategory, setActiveCategory] = useState<QrCategory>('simple')
  const [activeType, setActiveType] = useState<QrType>(QR_TYPES[0])
  const [qrData, setQrData] = useState<string>('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  // FIX: Store the raw SVG string separately for proper SVG download
  // (previously, SVG download was using the PNG data URL which results in a corrupt file)
  const [qrSvgString, setQrSvgString] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [customization, setCustomization] = useState<QrCustomization>({
    fgColor: '#000000',
    bgColor: '#FFFFFF',
    size: 256,
    errorLevel: 'M',
    frameEnabled: false,
    frameText: 'SCAN ME',
    frameColor: '#000000',
    logoEnabled: false,
    logoUrl: '',
    logoSize: 64,
  })
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [savedFileName, setSavedFileName] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [qrHistory, setQrHistory] = useState<QrHistoryItem[]>([])

  // Load history from localStorage on mount
  useEffect(() => {
    setQrHistory(getQrHistory())
  }, [])

  const categories = [
    { id: 'simple' as QrCategory, label: 'Simple QR', icon: Zap, description: 'URL, Wi-Fi, Text, Email, Phone, SMS' },
    { id: 'advanced' as QrCategory, label: 'Advanced QR', icon: Settings, description: 'WhatsApp, Skype, vCard, Crypto' },
    { id: 'quick-links' as QrCategory, label: 'Quick Links', icon: Link2, description: 'YouTube, Social, App Links' },
    { id: 'edit' as QrCategory, label: 'Edit & Style', icon: Palette, description: 'Colors, Frame, Logo, Size' },
    { id: 'history' as QrCategory, label: 'History', icon: Clock, description: 'Your past QR codes' },
  ]

  const filteredTypes = QR_TYPES.filter((t) => t.category === activeCategory)

  // Group types by subGroup for visual separation
  const groupedTypes = filteredTypes.reduce<Record<string, QrType[]>>((acc, type) => {
    const group = type.subGroup || 'default'
    if (!acc[group]) acc[group] = []
    acc[group].push(type)
    return acc
  }, {})

  const generateQr = useCallback(async (data: string, saveHistory: boolean = true) => {
    if (!data.trim()) return
    setQrData(data)
    setIsLoading(true)
    try {
      const QRCode = (await import('qrcode')).default

      // FIX: Generate BOTH PNG (for canvas preview + PNG download) and SVG (for SVG download)
      // Previously only generated PNG data URL, so SVG download was corrupt
      const [dataUrl, svgString] = await Promise.all([
        QRCode.toDataURL(data, {
          width: customization.size,
          margin: 2,
          color: { dark: customization.fgColor, light: customization.bgColor },
          errorCorrectionLevel: customization.errorLevel,
          type: 'image/png',
        }),
        QRCode.toString(data, {
          type: 'svg',
          margin: 2,
          width: customization.size,
          color: { dark: customization.fgColor, light: customization.bgColor },
          errorCorrectionLevel: customization.errorLevel,
        }),
      ])

      setQrDataUrl(dataUrl)
      setQrSvgString(svgString)
      toast.success('QR Code generated successfully!')

      // Only save to history on explicit user action (not auto-regeneration from customization changes)
      if (saveHistory) {
        const historyItem: QrHistoryItem = {
          id: `qr-${Date.now()}`,
          typeId: activeType.id,
          typeLabel: activeType.label,
          typeColor: activeType.color,
          data: data,
          dataPreview: truncatePreview(data),
          customization: { ...customization },
          qrDataUrl: dataUrl,
          createdAt: new Date().toISOString(),
        }
        saveQrHistoryItem(historyItem)
        setQrHistory(getQrHistory())
      }
    } catch (error) {
      console.error('QR generation error:', error)
      toast.error('Failed to generate QR code')
    } finally {
      setIsLoading(false)
    }
  }, [customization.size, customization.fgColor, customization.bgColor, customization.errorLevel, activeType.id, activeType.label, activeType.color])

  // Auto-regenerate when customization changes (do NOT save to history — this is just a re-render)
  useEffect(() => {
    if (qrData) {
      generateQr(qrData, false)
    }
  }, [customization.fgColor, customization.bgColor, customization.size, customization.errorLevel, qrData, generateQr])

  const handleDownload = useCallback((format: 'png' | 'svg') => {
    if (!qrDataUrl) return

    if (format === 'png') {
      // FIX: Use a Promise-based approach to ensure the image is FULLY loaded
      // before we try to draw it and call canvas.toDataURL()
      // The old code had a race condition where canvas.toDataURL() could be called
      // before img.onload fired, resulting in blank/white downloads.
      const renderAndDownload = async () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // FIX: Load the QR image as a Promise so we KNOW it's ready before drawing
        const loadQrImage = (): Promise<HTMLImageElement> =>
          new Promise((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = reject
            img.src = qrDataUrl
          })

        try {
          const img = await loadQrImage()

          const totalSize = customization.size + (customization.frameEnabled ? 60 : 0)
          const canvasHeight = totalSize + (customization.frameEnabled ? 36 : 0)

          // FIX: Use 2x resolution for crisp downloads (HiDPI support)
          const scale = 2
          canvas.width = totalSize * scale
          canvas.height = canvasHeight * scale
          canvas.style.width = `${totalSize}px`
          canvas.style.height = `${canvasHeight}px`
          ctx.scale(scale, scale)

          // Draw background
          ctx.fillStyle = customization.bgColor
          ctx.fillRect(0, 0, totalSize, canvasHeight)

          // Draw frame header (if enabled)
          if (customization.frameEnabled) {
            ctx.fillStyle = customization.frameColor
            ctx.fillRect(0, 0, totalSize, 50)
            ctx.fillStyle = '#FFFFFF'
            ctx.font = 'bold 16px system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(customization.frameText || 'SCAN ME', totalSize / 2, 33)
            ctx.drawImage(img, (totalSize - customization.size) / 2, 56, customization.size, customization.size)
          } else {
            ctx.drawImage(img, 0, 0, customization.size, customization.size)
          }

          // FIX: If logo is enabled, load it as a Promise too
          // Only trigger download AFTER logo is drawn (no more race condition)
          if (customization.logoEnabled && customization.logoUrl) {
            const loadLogo = (): Promise<HTMLImageElement> =>
              new Promise((resolve, reject) => {
                const logoImg = new Image()
                logoImg.crossOrigin = 'anonymous'
                logoImg.onload = () => resolve(logoImg)
                logoImg.onerror = reject
                logoImg.src = customization.logoUrl
              })

            try {
              const logoImg = await loadLogo()
              const ls = customization.logoSize
              const x = (totalSize - ls) / 2
              const y = (customization.frameEnabled ? 56 : 0) + (customization.size - ls) / 2
              // White background behind logo for visibility
              ctx.fillStyle = '#FFFFFF'
              ctx.fillRect(x - 6, y - 6, ls + 12, ls + 12)
              ctx.drawImage(logoImg, x, y, ls, ls)
            } catch {
              // Logo failed to load — continue without it
              console.warn('Logo failed to load, downloading without logo')
            }
          }

          // FIX: Now that ALL drawing is complete, trigger the download
          // canvas.toDataURL() will capture the FULLY rendered canvas
          const link = document.createElement('a')
          const filename = `qrcode-${activeType.id}-${Date.now()}.png`
          link.download = filename
          link.href = canvas.toDataURL('image/png')
          link.click()
          setSavedFileName(filename)
          setShowSaveDialog(true)
        } catch (error) {
          console.error('PNG download error:', error)
          toast.error('Failed to download QR code')
        }
      }

      renderAndDownload()
    } else {
      // FIX: SVG download now uses the actual SVG string from QRCode.toString()
      // Previously, it was using qrDataUrl (a PNG data URL) with a .svg extension,
      // which resulted in a corrupt/invalid SVG file
      const link = document.createElement('a')
      const filename = `qrcode-${activeType.id}-${Date.now()}.svg`
      link.download = filename

      if (qrSvgString) {
        // Convert SVG string to a proper data URL
        const svgBlob = new Blob([qrSvgString], { type: 'image/svg+xml;charset=utf-8' })
        const svgUrl = URL.createObjectURL(svgBlob)
        link.href = svgUrl
        link.click()
        // Clean up the object URL after a short delay
        setTimeout(() => URL.revokeObjectURL(svgUrl), 1000)
      } else {
        // Fallback: if SVG string not available, download as PNG
        link.download = filename.replace('.svg', '.png')
        link.href = qrDataUrl
        link.click()
      }

      setSavedFileName(filename)
      setShowSaveDialog(true)
    }
  }, [qrDataUrl, qrSvgString, customization, activeType.id])

  const handleCopyToClipboard = useCallback(async () => {
    if (!qrDataUrl) return
    try {
      const response = await fetch(qrDataUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast.success('QR Code copied to clipboard!')
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }, [qrDataUrl])

  const handleReset = () => {
    setQrData('')
    setQrDataUrl(null)
    setCustomization({
      fgColor: '#000000',
      bgColor: '#FFFFFF',
      size: 256,
      errorLevel: 'M',
      frameEnabled: false,
      frameText: 'SCAN ME',
      frameColor: '#000000',
      logoEnabled: false,
      logoUrl: '',
      logoSize: 64,
    })
  }

  const applyTemplate = (template: QrTemplate) => {
    setCustomization((prev) => ({
      ...prev,
      fgColor: template.colors.fg,
      bgColor: template.colors.bg,
      frameEnabled: template.frame?.enabled ?? false,
      frameText: template.frame?.text ?? 'SCAN ME',
      frameColor: template.frame?.color ?? '#000000',
    }))
    const matchingType = QR_TYPES.find((t) => t.id === template.type)
    if (matchingType) {
      setActiveType(matchingType)
      setActiveCategory(matchingType.category)
    }
    setShowTemplates(false)
    toast.success(`Template "${template.name}" applied!`)
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCustomization((prev) => ({ ...prev, logoUrl: reader.result as string, logoEnabled: true }))
    }
    reader.readAsDataURL(file)
  }

  const handleCategoryChange = (catId: QrCategory) => {
    setActiveCategory(catId)
    if (catId === 'history') {
      setQrHistory(getQrHistory())
    }
    if (catId !== 'edit' && catId !== 'history') {
      const typesInCat = QR_TYPES.filter((t) => t.category === catId)
      if (typesInCat.length > 0 && !typesInCat.find((t) => t.id === activeType.id)) {
        setActiveType(typesInCat[0])
      }
    }
  }

  const handleDeleteHistoryItem = (id: string) => {
    const updated = deleteQrHistoryItem(id)
    setQrHistory(updated)
    toast.success('QR removed from history')
  }

  const handleClearHistory = () => {
    clearQrHistory()
    setQrHistory([])
    toast.success('All QR history cleared')
  }

  const handleReuseHistoryItem = (item: QrHistoryItem) => {
    // Find and set the QR type
    const matchingType = QR_TYPES.find(t => t.id === item.typeId)
    if (matchingType) {
      setActiveType(matchingType)
      // Set the correct category for this type
      setActiveCategory(matchingType.category)
    }
    // Apply customization
    setCustomization(item.customization)
    // Regenerate with saved data
    generateQr(item.data)
    toast.success('QR re-generated from history')
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[#0F172A]">
      {/* Header */}
      <div className="shrink-0 border-b border-white/10 bg-[#0F172A]/80 backdrop-blur-sm">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-white truncate">
                  {activeCategory === 'edit' ? 'Edit & Style' :
                    activeCategory === 'quick-links' ? 'Quick Links' :
                      activeCategory === 'advanced' ? 'Advanced QR' :
                        activeCategory === 'history' ? 'QR History' :
                          'QR Generator'}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplates(true)}
                className="text-gray-400 hover:text-white hover:bg-white/10 h-8 w-8 sm:w-auto p-0 sm:p-2"
              >
                <Sparkles className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Templates</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-gray-400 hover:text-white hover:bg-white/10 h-8 w-8 sm:w-auto p-0 sm:p-2"
              >
                <RotateCcw className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            </div>
          </div>

          {/* Category Tabs — scrollable on mobile */}
          <div className="flex gap-1 mt-3 overflow-x-auto pb-1 -mb-1 scrollbar-none w-full">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={cn(
                  'flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0',
                  activeCategory === cat.id
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                )}
              >
                <cat.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="sm:hidden">{cat.id === 'quick-links' ? 'Links' : cat.id === 'edit' ? 'Style' : cat.id === 'history' ? 'History' : cat.label.replace(' QR', '')}</span>
                <span className="hidden sm:inline">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-16 md:pb-0">
        <div className="flex flex-col lg:flex-row min-h-full min-w-0">
          {/* Left Panel — Input & Settings */}
          <div className="flex-1 p-4 sm:p-6 space-y-5 min-w-0 lg:max-w-2xl lg:mx-auto">
            {/* QR Type Selection — Card grid with sub-group labels */}
            {activeCategory !== 'edit' && activeCategory !== 'history' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {Object.entries(groupedTypes).map(([groupKey, types]) => (
                  <div key={groupKey}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">
                        {SUBGROUP_LABELS[activeCategory]?.[groupKey] || groupKey}
                      </span>
                      <div className="flex-1 h-px bg-slate-600/30" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                      {types.map((type, idx) => (
                        <QrTypeCard
                          key={type.id}
                          type={type}
                          isActive={activeType.id === type.id}
                          onClick={() => setActiveType(type)}
                          className={types.length % 2 !== 0 && idx === types.length - 1 ? 'col-span-2 sm:flex-row sm:col-span-1' : ''}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Input Form */}
                <Card className="bg-slate-800/40 border-slate-700/50 backdrop-blur-sm mt-4">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: hexToRgba(activeType.color, 0.12) }}
                      >
                        <activeType.icon className="w-4 h-4" style={{ color: activeType.color }} />
                      </div>
                      <div>
                        <CardTitle className="text-white text-base">{activeType.label}</CardTitle>
                        <CardDescription className="text-gray-400 text-xs">{activeType.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <QrInputForm type={activeType} onGenerate={generateQr} />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Edit/Customize Panel */}
            {activeCategory === 'edit' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                {/* Ghost Controls Guard — disable customization when no QR generated */}
                {!qrDataUrl && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300 text-sm">
                    <QrCode className="w-4 h-4 shrink-0" />
                    <span>Generate a QR code first, then customize its appearance here.</span>
                  </div>
                )}

                <div className={cn(!qrDataUrl && 'opacity-40 pointer-events-none select-none')}>
                {/* Colors */}
                <Card className="bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Palette className="w-4 h-4 text-purple-400" />
                      Colors
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ColorPicker
                      label="QR Code Color"
                      value={customization.fgColor}
                      onChange={(v) => setCustomization((p) => ({ ...p, fgColor: v }))}
                    />
                    <ColorPicker
                      label="Background Color"
                      value={customization.bgColor}
                      onChange={(v) => setCustomization((p) => ({ ...p, bgColor: v }))}
                    />
                  </CardContent>
                </Card>

                {/* Size & Error Level */}
                <Card className="bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Settings className="w-4 h-4 text-blue-400" />
                      Size & Quality
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">QR Code Size</Label>
                      <Select
                        value={String(customization.size)}
                        onValueChange={(v) => setCustomization((p) => ({ ...p, size: Number(v) }))}
                        disabled={!qrDataUrl}
                      >
                        <SelectTrigger className="mt-1.5 h-10 bg-slate-800/60 border-slate-600/40 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="128">128 x 128</SelectItem>
                          <SelectItem value="192">192 x 192</SelectItem>
                          <SelectItem value="256">256 x 256 (Recommended)</SelectItem>
                          <SelectItem value="384">384 x 384</SelectItem>
                          <SelectItem value="512">512 x 512 (High Quality)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Error Correction</Label>
                      <Select
                        value={customization.errorLevel}
                        onValueChange={(v) => setCustomization((p) => ({ ...p, errorLevel: v as 'L' | 'M' | 'Q' | 'H' }))}
                        disabled={!qrDataUrl}
                      >
                        <SelectTrigger className="mt-1.5 h-10 bg-slate-800/60 border-slate-600/40 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="L">Low (7%)</SelectItem>
                          <SelectItem value="M">Medium (15%) - Recommended</SelectItem>
                          <SelectItem value="Q">Quartile (25%)</SelectItem>
                          <SelectItem value="H">High (30%) - Best for logos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Frame */}
                <Card className="bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-base flex items-center gap-2">
                        <Frame className="w-4 h-4 text-green-400" />
                        Frame
                      </CardTitle>
                      <Switch
                        checked={customization.frameEnabled}
                        onCheckedChange={(v) => setCustomization((p) => ({ ...p, frameEnabled: v }))}
                      />
                    </div>
                  </CardHeader>
                  {customization.frameEnabled && (
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Frame Text</Label>
                        <Input
                          value={customization.frameText}
                          onChange={(e) => setCustomization((p) => ({ ...p, frameText: e.target.value }))}
                          className="mt-1.5 h-10 bg-slate-800/60 border-slate-600/40 text-white"
                          placeholder="SCAN ME"
                        />
                      </div>
                      <ColorPicker
                        label="Frame Color"
                        value={customization.frameColor}
                        onChange={(v) => setCustomization((p) => ({ ...p, frameColor: v }))}
                      />
                      <div>
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Frame Style</Label>
                        <div className="grid grid-cols-4 gap-2 mt-1.5">
                          {FRAME_STYLES.map((style) => (
                            <button
                              key={style.id}
                              className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/60 border border-slate-600/40 text-gray-300 hover:bg-slate-700/40 transition-all"
                            >
                              {style.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Logo */}
                <Card className="bg-slate-800/40 border-slate-700/50 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-base flex items-center gap-2">
                        <Stamp className="w-4 h-4 text-orange-400" />
                        Custom Logo
                      </CardTitle>
                      <Switch
                        checked={customization.logoEnabled}
                        onCheckedChange={(v) => setCustomization((p) => ({ ...p, logoEnabled: v }))}
                      />
                    </div>
                  </CardHeader>
                  {customization.logoEnabled && (
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Upload Logo</Label>
                        <div className="mt-1.5">
                          <label className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-slate-600/40 hover:border-orange-500/50 bg-slate-800/40 cursor-pointer transition-all duration-200">
                            <ImageIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-400">
                              {customization.logoUrl ? 'Change Logo' : 'Select Logo Image'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleLogoUpload}
                            />
                          </label>
                        </div>
                      </div>
                      {customization.logoUrl && (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-white/20">
                              <img src={customization.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCustomization((p) => ({ ...p, logoUrl: '', logoEnabled: false }))}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                          <div>
                            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Logo Size</Label>
                            <Select
                              value={String(customization.logoSize)}
                              onValueChange={(v) => setCustomization((p) => ({ ...p, logoSize: Number(v) }))}
                            >
                              <SelectTrigger className="mt-1.5 h-10 bg-slate-800/60 border-slate-600/40 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="32">Small (32px)</SelectItem>
                                <SelectItem value="48">Medium (48px)</SelectItem>
                                <SelectItem value="64">Large (64px)</SelectItem>
                                <SelectItem value="80">Extra Large (80px)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </CardContent>
                  )}
                </Card>
                </div>{/* End ghost controls guard */}
              </motion.div>
            )}

            {/* History Panel */}
            {activeCategory === 'history' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Header with clear button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-medium text-white">
                      {qrHistory.length} QR Code{qrHistory.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {qrHistory.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearHistory}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>

                {/* History List */}
                {qrHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-4">
                      <History className="w-8 h-8 text-gray-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-400 mb-1">No QR History Yet</p>
                    <p className="text-xs text-gray-500 max-w-[250px]">
                      Your generated QR codes will appear here. Start creating!
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveCategory('simple')}
                      className="mt-4 border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
                    >
                      Create QR Code
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {qrHistory.map((item) => {
                      const matchedType = QR_TYPES.find(t => t.id === item.typeId)
                      const TypeIcon = matchedType?.icon || QrCode
                      const timeAgo = getTimeAgo(item.createdAt)

                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/50 bg-slate-800/40 hover:bg-slate-700/40 transition-all group"
                        >
                          {/* QR Thumbnail */}
                          <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                            {item.qrDataUrl ? (
                              <img src={item.qrDataUrl} alt="QR" className="w-full h-full object-contain" />
                            ) : (
                              <QrCode className="w-6 h-6 text-gray-300" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <TypeIcon className="w-3 h-3 shrink-0" style={{ color: item.typeColor }} />
                              <span className="text-xs font-medium text-gray-300">{item.typeLabel}</span>
                            </div>
                            <p className="text-[11px] text-gray-500 truncate">{item.dataPreview}</p>
                            <p className="text-[10px] text-gray-600 mt-0.5">{timeAgo}</p>
                          </div>

                          {/* Actions */}
                          <div className="shrink-0 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleReuseHistoryItem(item)}
                              className="p-1.5 rounded-lg hover:bg-orange-500/10 text-orange-400 transition-colors"
                              title="Re-generate"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteHistoryItem(item.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                              title="Delete"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Right Panel — Preview & Actions */}
          <div className="w-full lg:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0B1120] p-4 sm:p-6 lg:sticky lg:top-0 lg:self-start lg:max-h-screen lg:overflow-y-auto">
            <div>
              {/* Preview */}
              <div className="flex flex-col items-center">
                <QrPreview
                  qrDataUrl={qrDataUrl}
                  customization={customization}
                  isLoading={isLoading}
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-6 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleDownload('png')}
                    disabled={!qrDataUrl || isLoading}
                    className="h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl shadow-md"
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Download PNG
                  </Button>
                  <Button
                    onClick={handleCopyToClipboard}
                    disabled={!qrDataUrl || isLoading}
                    variant="outline"
                    className="h-11 border-white/20 text-white hover:bg-white/10 rounded-xl font-semibold"
                  >
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copy
                  </Button>
                </div>
                <Button
                  onClick={() => handleDownload('svg')}
                  disabled={!qrDataUrl || isLoading}
                  variant="outline"
                  className="w-full h-11 border-white/20 text-white hover:bg-white/10 rounded-xl font-semibold"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download SVG
                </Button>
              </div>

              {/* Quick Customize (visible in non-edit mode) — Ghost Controls Guard */}
              {activeCategory !== 'edit' && activeCategory !== 'history' && (
                <div className={cn(
                  "mt-6 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50",
                  !qrDataUrl && "opacity-40 pointer-events-none select-none"
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white">Quick Customize</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveCategory('edit')}
                      disabled={!qrDataUrl}
                      className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 text-xs"
                    >
                      More Options <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                  </div>
                  {!qrDataUrl && (
                    <p className="text-[11px] text-orange-300/70 mb-2">Generate a QR code first to customize</p>
                  )}
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <Label className="text-[10px] text-gray-500 uppercase">FG Color</Label>
                      <input
                        type="color"
                        value={customization.fgColor}
                        onChange={(e) => setCustomization((p) => ({ ...p, fgColor: e.target.value }))}
                        className="w-full h-8 rounded-lg cursor-pointer border border-white/10"
                        disabled={!qrDataUrl}
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-[10px] text-gray-500 uppercase">BG Color</Label>
                      <input
                        type="color"
                        value={customization.bgColor}
                        onChange={(e) => setCustomization((p) => ({ ...p, bgColor: e.target.value }))}
                        className="w-full h-8 rounded-lg cursor-pointer border border-white/10"
                        disabled={!qrDataUrl}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={customization.frameEnabled}
                      onCheckedChange={(v) => setCustomization((p) => ({ ...p, frameEnabled: v }))}
                      disabled={!qrDataUrl}
                    />
                    <Label className="text-xs text-gray-400">Add Frame</Label>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Switch
                      checked={customization.logoEnabled}
                      onCheckedChange={(v) => setCustomization((p) => ({ ...p, logoEnabled: v }))}
                      disabled={!qrDataUrl}
                    />
                    <Label className="text-xs text-gray-400">Add Logo</Label>
                    {customization.logoEnabled && qrDataUrl && (
                      <label className="ml-auto text-xs text-orange-400 cursor-pointer hover:text-orange-300">
                        Upload
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Info Footer */}
              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500">
                  {activeCategory === 'simple'
                    ? 'Create QR in seconds — no setup needed'
                    : activeCategory === 'advanced'
                      ? 'WhatsApp, Skype, vCard & crypto QR codes'
                      : activeCategory === 'quick-links'
                        ? 'Smart links for YouTube, social & apps'
                        : 'Add colors, frame, logo & more'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Templates Dialog — Ghost Controls Guard */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="bg-[#1E293B] border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-400" />
              QR Code Templates
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {!qrDataUrl
                ? 'Generate a QR code first, then apply a template to style it.'
                : 'Choose a pre-designed template to quickly style your QR code.'}
            </DialogDescription>
          </DialogHeader>
          {!qrDataUrl ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <QrCode className="w-12 h-12 text-gray-500 mb-3" />
              <p className="text-sm text-gray-400">No QR code generated yet</p>
              <p className="text-xs text-gray-500 mt-1">Go back and create a QR code first, then apply templates.</p>
            </div>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 max-h-96 overflow-y-auto">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-700/40 hover:border-orange-500/30 transition-all duration-200 group"
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: template.colors.fg + '20' }}
                >
                  <template.icon className="w-7 h-7" style={{ color: template.colors.fg }} />
                </div>
                <span className="text-xs font-medium text-gray-300 group-hover:text-white">{template.name}</span>
                {template.frame && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-white/20 text-gray-400">
                    + Frame
                  </Badge>
                )}
              </button>
            ))}
          </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTemplates(false)}
              className="border-white/20 text-gray-300 hover:bg-white/10"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Confirmation Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-[#1E293B] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              QR Code Saved
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Your QR code has been saved successfully.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
              <QrCode className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-mono text-gray-300">{savedFileName}</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowSaveDialog(false)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
