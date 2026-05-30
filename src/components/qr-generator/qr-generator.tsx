'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
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

type QrCategory = 'simple' | 'advanced' | 'quick-links' | 'edit'

interface QrType {
  id: string
  label: string
  icon: React.ElementType
  category: QrCategory
  color: string
  description: string
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

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const QR_TYPES: QrType[] = [
  { id: 'url', label: 'Web Links', icon: Globe, category: 'simple', color: '#3B82F6', description: 'Generate QR for any website URL' },
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi, category: 'simple', color: '#10B981', description: 'Wi-Fi QR with/without password' },
  { id: 'text', label: 'Simple Text', icon: Type, category: 'simple', color: '#8B5CF6', description: 'One-click text QR code' },
  { id: 'email', label: 'Email ID', icon: Mail, category: 'simple', color: '#F59E0B', description: 'Email with subject & message' },
  { id: 'phone', label: 'Mobile/Phone', icon: Phone, category: 'simple', color: '#EF4444', description: 'Phone number QR code' },
  { id: 'sms', label: 'SMS', icon: MessageSquare, category: 'simple', color: '#EC4899', description: 'SMS QR code generator' },
  { id: 'whatsapp-chat', label: 'WhatsApp Chat', icon: MessageCircle, category: 'simple', color: '#25D366', description: 'WhatsApp chat QR' },
  { id: 'whatsapp-msg', label: 'WhatsApp Message', icon: Share2, category: 'simple', color: '#128C7E', description: 'Share message via WhatsApp' },
  { id: 'contact', label: 'Contact', icon: User, category: 'advanced', color: '#6366F1', description: 'vCard contact QR' },
  { id: 'skype', label: 'Skype Call', icon: Phone, category: 'advanced', color: '#00AFF0', description: 'Skype call QR code' },
  { id: 'bitcoin', label: 'Bitcoin/Crypto', icon: Bitcoin, category: 'advanced', color: '#F7931A', description: 'Bitcoin & crypto QR' },
  { id: 'youtube', label: 'YouTube', icon: Video, category: 'quick-links', color: '#FF0000', description: 'YouTube video/channel QR' },
]

const TEMPLATES: QrTemplate[] = [
  { id: 't-social', name: 'Social Profile', type: 'url', colors: { fg: '#1877F2', bg: '#FFFFFF' }, frame: { enabled: true, text: 'FOLLOW ME', color: '#1877F2' }, icon: User },
  { id: 't-youtube', name: 'YouTube Video', type: 'youtube', colors: { fg: '#FF0000', bg: '#FFFFFF' }, frame: { enabled: true, text: 'WATCH NOW', color: '#FF0000' }, icon: Video },
  { id: 't-app', name: 'App Download', type: 'url', colors: { fg: '#000000', bg: '#FFFFFF' }, frame: { enabled: true, text: 'DOWNLOAD APP', color: '#000000' }, icon: Download },
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

/** QR Code Preview Canvas - uses API to render */
function QrPreview({ qrDataUrl, customization, isLoading }: {
  qrDataUrl: string | null
  customization: QrCustomization
  isLoading: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!qrDataUrl || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      const totalSize = customization.size + (customization.frameEnabled ? 60 : 0)
      canvas.width = totalSize
      canvas.height = totalSize + (customization.frameEnabled ? 36 : 0)

      // Fill background
      ctx.fillStyle = customization.bgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw frame if enabled
      if (customization.frameEnabled) {
        ctx.fillStyle = customization.frameColor
        ctx.fillRect(0, 0, canvas.width, 50)
        // Frame text
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 16px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(customization.frameText || 'SCAN ME', canvas.width / 2, 33)
        // Draw QR below frame
        ctx.drawImage(img, (canvas.width - customization.size) / 2, 56, customization.size, customization.size)
      } else {
        ctx.drawImage(img, 0, 0, customization.size, customization.size)
      }

      // Draw logo if enabled
      if (customization.logoEnabled && customization.logoUrl) {
        const logoImg = new Image()
        logoImg.crossOrigin = 'anonymous'
        logoImg.onload = () => {
          const ls = customization.logoSize
          const x = (canvas.width - ls) / 2
          const y = (customization.frameEnabled ? 56 : 0) + (customization.size - ls) / 2
          // White background for logo
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(x - 4, y - 4, ls + 8, ls + 8)
          ctx.drawImage(logoImg, x, y, ls, ls)
        }
        logoImg.src = customization.logoUrl
      }
    }
    img.src = qrDataUrl
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
      <div className="flex items-center justify-center w-full aspect-square max-w-[320px] bg-white/5 rounded-2xl border-2 border-dashed border-white/10">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <QrCode className="w-16 h-16 stroke-1" />
          <p className="text-sm font-medium">QR Code Preview</p>
          <p className="text-xs text-gray-600">Enter data to generate</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl overflow-hidden shadow-lg border border-white/10">
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
      case 'youtube':
        data = formData.url || ''
        break
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Encryption</Label>
              <Select value={formData.encryption || 'WPA'} onValueChange={(v) => update('encryption', v)}>
                <SelectTrigger className="mt-1.5 h-11 bg-white/5 border-white/10 text-white">
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
                className="mt-1.5 min-h-[120px] resize-none bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Subject</Label>
              <Input
                placeholder="Email subject line"
                value={formData.subject || ''}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Message</Label>
              <Textarea
                placeholder="Email body content"
                value={formData.body || ''}
                onChange={(e) => handleInputChange('body', e.target.value)}
                className="mt-1.5 min-h-[100px] resize-none bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Message</Label>
              <Textarea
                placeholder="Your SMS message"
                value={formData.message || ''}
                onChange={(e) => handleInputChange('message', e.target.value)}
                className="mt-1.5 min-h-[100px] resize-none bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Pre-filled Message</Label>
              <Textarea
                placeholder="Hello! I'd like to know more about..."
                value={formData.message || ''}
                onChange={(e) => handleInputChange('message', e.target.value)}
                className="mt-1.5 min-h-[100px] resize-none bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
                  className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-300">Last Name</Label>
                <Input
                  placeholder="Doe"
                  value={formData.lastName || ''}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Email</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Organization</Label>
              <Input
                placeholder="Company Inc."
                value={formData.org || ''}
                onChange={(e) => handleInputChange('org', e.target.value)}
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Job Title</Label>
              <Input
                placeholder="Software Engineer"
                value={formData.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Website</Label>
              <Input
                placeholder="https://example.com"
                value={formData.website || ''}
                onChange={(e) => handleInputChange('website', e.target.value)}
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500 font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Amount</Label>
              <Input
                type="number"
                placeholder="0.001"
                value={formData.amount || ''}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-300">Label</Label>
              <Input
                placeholder="Payment reference"
                value={formData.label || ''}
                onChange={(e) => handleInputChange('label', e.target.value)}
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            <p className="text-xs text-gray-500">Paste a YouTube video, playlist, or channel URL</p>
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
                className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
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
// Main Component
// ──────────────────────────────────────────────

export function QrGenerator() {
  const [activeCategory, setActiveCategory] = useState<QrCategory>('simple')
  const [activeType, setActiveType] = useState<QrType>(QR_TYPES[0])
  const [qrData, setQrData] = useState<string>('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
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

  const categories = [
    { id: 'simple' as QrCategory, label: 'Simple QR', icon: Zap },
    { id: 'advanced' as QrCategory, label: 'Advanced QR', icon: Settings },
    { id: 'quick-links' as QrCategory, label: 'Quick Links', icon: Link2 },
    { id: 'edit' as QrCategory, label: 'Edit QR', icon: Palette },
  ]

  const filteredTypes = QR_TYPES.filter((t) => t.category === activeCategory)

  const generateQr = useCallback(async (data: string) => {
    if (!data.trim()) return
    setQrData(data)
    setIsLoading(true)
    try {
      // Client-side QR generation using qrcode library
      const QRCode = (await import('qrcode')).default
      const dataUrl = await QRCode.toDataURL(data, {
        width: customization.size,
        margin: 2,
        color: { dark: customization.fgColor, light: customization.bgColor },
        errorCorrectionLevel: customization.errorLevel,
        type: 'image/png',
      })
      setQrDataUrl(dataUrl)
      toast.success('QR Code generated successfully!')
    } catch (error) {
      console.error('QR generation error:', error)
      toast.error('Failed to generate QR code')
    } finally {
      setIsLoading(false)
    }
  }, [customization.size, customization.fgColor, customization.bgColor, customization.errorLevel])

  // Re-generate when customization changes (if we have data)
  useEffect(() => {
    if (qrData) {
      generateQr(qrData)
    }
  }, [customization.fgColor, customization.bgColor, customization.size, customization.errorLevel, qrData, generateQr])

  const handleDownload = useCallback((format: 'png' | 'svg') => {
    if (!qrDataUrl) return

    if (format === 'png') {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const img = new Image()
      img.onload = () => {
        const totalSize = customization.size + (customization.frameEnabled ? 60 : 0)
        canvas.width = totalSize * 2
        canvas.height = totalSize * 2 + (customization.frameEnabled ? 72 : 0)
        ctx.scale(2, 2)

        ctx.fillStyle = customization.bgColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)

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

        if (customization.logoEnabled && customization.logoUrl) {
          const logoImg = new Image()
          logoImg.crossOrigin = 'anonymous'
          logoImg.onload = () => {
            const ls = customization.logoSize
            const x = (totalSize - ls) / 2
            const y = (customization.frameEnabled ? 56 : 0) + (customization.size - ls) / 2
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(x - 6, y - 6, ls + 12, ls + 12)
            ctx.drawImage(logoImg, x, y, ls, ls)

            const link = document.createElement('a')
            const filename = `qrcode-${activeType.id}-${Date.now()}.png`
            link.download = filename
            link.href = canvas.toDataURL('image/png')
            link.click()
            setSavedFileName(filename)
            setShowSaveDialog(true)
          }
          logoImg.src = customization.logoUrl
        } else {
          const link = document.createElement('a')
          const filename = `qrcode-${activeType.id}-${Date.now()}.png`
          link.download = filename
          link.href = canvas.toDataURL('image/png')
          link.click()
          setSavedFileName(filename)
          setShowSaveDialog(true)
        }
      }
      img.src = qrDataUrl
    } else {
      const link = document.createElement('a')
      const filename = `qrcode-${activeType.id}-${Date.now()}.svg`
      link.download = filename
      link.href = qrDataUrl
      link.click()
      setSavedFileName(filename)
      setShowSaveDialog(true)
    }
  }, [qrDataUrl, customization, activeType.id])

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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0F172A]">
      {/* Header */}
      <div className="shrink-0 border-b border-white/10 bg-[#0F172A]/80 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {activeCategory === 'edit' ? 'Edit QR Code' :
                    activeCategory === 'quick-links' ? 'Quick Link QR Code' :
                      activeCategory === 'advanced' ? 'Advanced QR Code' :
                        'QR Code Generator'}
                </h1>
                <p className="text-sm text-gray-400">
                  {activeCategory === 'edit' ? 'Customize Your QR Code' :
                    activeCategory === 'quick-links' ? 'Create Quick Links for Social Media' :
                      activeCategory === 'advanced' ? 'Customize your QR Code' :
                        'Choose from a variety of QR code types'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplates(true)}
                className="text-gray-400 hover:text-white hover:bg-white/10"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Templates
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-gray-400 hover:text-white hover:bg-white/10"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Reset All
              </Button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 mt-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  activeCategory === cat.id
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                )}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col lg:flex-row min-h-full">
          {/* Left Panel - Input & Settings */}
          <div className="flex-1 p-6 space-y-6">
            {/* QR Type Selection (for non-edit categories) */}
            {activeCategory !== 'edit' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-wrap gap-2 mb-6">
                  {filteredTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setActiveType(type)}
                      className={cn(
                        'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 border',
                        activeType.id === type.id
                          ? 'border-orange-500/50 bg-orange-500/10 text-orange-400 shadow-md'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <type.icon className="w-4 h-4" style={{ color: type.color }} />
                      {type.label}
                    </button>
                  ))}
                </div>

                {/* Input Form */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: activeType.color + '20' }}
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
                {/* Colors */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
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
                <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
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
                      >
                        <SelectTrigger className="mt-1.5 h-10 bg-white/5 border-white/10 text-white">
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
                      >
                        <SelectTrigger className="mt-1.5 h-10 bg-white/5 border-white/10 text-white">
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
                <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
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
                          className="mt-1.5 h-10 bg-white/5 border-white/10 text-white"
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
                              className="px-3 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
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
                <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
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
                          <label className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-white/20 hover:border-orange-500/50 bg-white/5 cursor-pointer transition-all duration-200">
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
                              <SelectTrigger className="mt-1.5 h-10 bg-white/5 border-white/10 text-white">
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
              </motion.div>
            )}
          </div>

          {/* Right Panel - Preview & Actions */}
          <div className="w-full lg:w-[420px] shrink-0 border-l border-white/10 bg-[#0B1120] p-6">
            <div className="sticky top-6">
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

              {/* Quick Customization (visible in non-edit mode) */}
              {activeCategory !== 'edit' && (
                <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white">Quick Customize</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveCategory('edit')}
                      className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 text-xs"
                    >
                      More Options <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <Label className="text-[10px] text-gray-500 uppercase">FG Color</Label>
                      <input
                        type="color"
                        value={customization.fgColor}
                        onChange={(e) => setCustomization((p) => ({ ...p, fgColor: e.target.value }))}
                        className="w-full h-8 rounded-lg cursor-pointer border border-white/10"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-[10px] text-gray-500 uppercase">BG Color</Label>
                      <input
                        type="color"
                        value={customization.bgColor}
                        onChange={(e) => setCustomization((p) => ({ ...p, bgColor: e.target.value }))}
                        className="w-full h-8 rounded-lg cursor-pointer border border-white/10"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={customization.frameEnabled}
                      onCheckedChange={(v) => setCustomization((p) => ({ ...p, frameEnabled: v }))}
                    />
                    <Label className="text-xs text-gray-400">Add Frame</Label>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Switch
                      checked={customization.logoEnabled}
                      onCheckedChange={(v) => setCustomization((p) => ({ ...p, logoEnabled: v }))}
                    />
                    <Label className="text-xs text-gray-400">Add Logo</Label>
                    {customization.logoEnabled && (
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
                      ? 'Add logos, colors, and style to your QR'
                      : activeCategory === 'quick-links'
                        ? 'Smart links that connect instantly'
                        : 'Add Text, Frame, Background & More'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="bg-[#1E293B] border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-400" />
              QR Code Templates
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Choose a pre-designed template to quickly create beautiful QR codes
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-orange-500/30 transition-all duration-200 group"
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
            <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
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
