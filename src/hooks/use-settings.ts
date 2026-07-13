'use client'

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppSettings {
  // Output / Download
  autoDownload: boolean
  fileNamePattern: string

  // Appearance
  theme: 'light' | 'dark' | 'system'
  accentColor: string
  sidebarDefaultCollapsed: boolean

  // File Handling
  deleteConfirmation: boolean

  // Notifications
  notifyOnUploadComplete: boolean
  notifyOnProcessComplete: boolean
  notifyOnError: boolean
  soundEnabled: boolean

  // Region
  dateFormat: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoDownload: true,
  fileNamePattern: '{originalName}_{date}',

  theme: 'light',
  accentColor: '#4A90D9',
  sidebarDefaultCollapsed: false,

  deleteConfirmation: true,

  notifyOnUploadComplete: true,
  notifyOnProcessComplete: true,
  notifyOnError: true,
  soundEnabled: false,

  dateFormat: 'MM/DD/YYYY',
}

export const STORAGE_KEY = 'creatortools_settings'

// ─── Accent Color Map ────────────────────────────────────────────────────────

export const ACCENT_COLORS = [
  { name: 'Ocean Blue', value: '#4A90D9' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Slate', value: '#64748B' },
  { name: 'Crimson', value: '#DC2626' },
]

// ─── File Name Patterns ──────────────────────────────────────────────────────

export const FILE_NAME_PATTERNS = [
  { label: 'Original + Date', value: '{originalName}_{date}', example: 'report_2024-01-15.pdf' },
  { label: 'Original + Timestamp', value: '{originalName}_{timestamp}', example: 'report_1705312800.pdf' },
  { label: 'Original Only', value: '{originalName}', example: 'report.pdf' },
  { label: 'Tool + Original', value: '{tool}_{originalName}', example: 'compressed_report.pdf' },
  { label: 'Custom Prefix', value: 'PDF_{originalName}', example: 'PDF_report.pdf' },
]

// ─── Core load / save ────────────────────────────────────────────────────────

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    // Dispatch custom event so other hooks/tabs update reactively
    window.dispatchEvent(new CustomEvent('creatortools-settings-changed'))
  } catch {
    // ignore
  }
}

// ─── Apply accent color to CSS custom property ──────────────────────────────

export function applyAccentColor(color: string) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--accent-brand', color)
}

// ─── Apply file name pattern ────────────────────────────────────────────────

export function applyFileNamePattern(
  pattern: string,
  originalName: string,
  toolName?: string
): string {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD
  const timestampStr = String(Math.floor(now.getTime() / 1000))

  // Strip extension from originalName for pattern insertion
  const lastDot = originalName.lastIndexOf('.')
  const baseName = lastDot > 0 ? originalName.substring(0, lastDot) : originalName
  const ext = lastDot > 0 ? originalName.substring(lastDot) : '.pdf'

  let result = pattern
    .replace('{originalName}', baseName)
    .replace('{date}', dateStr)
    .replace('{timestamp}', timestampStr)
    .replace('{tool}', toolName || 'processed')

  // Ensure it ends with the extension
  if (!result.endsWith(ext)) {
    result += ext
  }

  return result
}

// ─── External store for reactive settings ───────────────────────────────────

let listeners: (() => void)[] = []
let cachedSettings: AppSettings | null = null

function getSnapshot(): AppSettings {
  if (cachedSettings === null) {
    cachedSettings = loadSettings()
  }
  return cachedSettings
}

function getServerSnapshot(): AppSettings {
  return DEFAULT_SETTINGS
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

// Listen for storage changes (other tabs) and our custom event
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      cachedSettings = null // invalidate cache
      listeners.forEach((l) => l())
    }
  })
  window.addEventListener('creatortools-settings-changed', () => {
    cachedSettings = null // invalidate cache
    listeners.forEach((l) => l())
  })
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [, forceUpdate] = useState(0)

  // Apply accent color whenever it changes
  useEffect(() => {
    applyAccentColor(settings.accentColor)
  }, [settings.accentColor])

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const current = getSnapshot()
    const next = { ...current, [key]: value }
    saveSettings(next)
    cachedSettings = next
    forceUpdate((n) => n + 1) // trigger re-render
    listeners.forEach((l) => l())
  }, [])

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    const current = getSnapshot()
    const next = { ...current, ...partial }
    saveSettings(next)
    cachedSettings = next
    forceUpdate((n) => n + 1)
    listeners.forEach((l) => l())
  }, [])

  const resetSettings = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS)
    cachedSettings = DEFAULT_SETTINGS
    forceUpdate((n) => n + 1)
    listeners.forEach((l) => l())
  }, [])

  return {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
  }
}

// ─── Helper: Format date with user's preferred format ────────────────────────

export function formatDateWithFormat(dateStr: string, dateFormat: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Relative labels for recent dates
  if (diffDays === 0) {
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `Today, ${displayHours}:${minutes} ${ampm}`
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  // Apply user's preferred date format for older dates
  const yyyy = date.getFullYear().toString()
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  const dd = date.getDate().toString().padStart(2, '0')
  const mmm = date.toLocaleDateString('en-US', { month: 'short' })

  switch (dateFormat) {
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${yyyy}`
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`
    case 'DD-MMM-YYYY':
      return `${dd}-${mmm}-${yyyy}`
    case 'MM/DD/YYYY':
    default:
      return `${mm}/${dd}/${yyyy}`
  }
}

// ─── Helper: Check if notification should be shown ──────────────────────────

export function shouldNotify(type: 'upload' | 'process' | 'error'): boolean {
  const settings = loadSettings()
  switch (type) {
    case 'upload':
      return settings.notifyOnUploadComplete
    case 'process':
      return settings.notifyOnProcessComplete
    case 'error':
      return settings.notifyOnError
  }
}

// ─── Helper: Check delete confirmation ──────────────────────────────────────

export function shouldConfirmDelete(): boolean {
  return loadSettings().deleteConfirmation
}

// ─── Helper: Should auto-download ───────────────────────────────────────────

export function shouldAutoDownload(): boolean {
  return loadSettings().autoDownload
}

// ─── Helper: Play notification sound (if enabled) ──────────────────────────

let audioContext: AudioContext | null = null

export function playNotificationSound() {
  if (typeof window === 'undefined') return
  const settings = loadSettings()
  if (!settings.soundEnabled) return

  try {
    // Use Web Audio API for a short, pleasant notification beep
    if (!audioContext) {
      audioContext = new AudioContext()
    }
    const ctx = audioContext
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    gain.gain.value = 0.1

    oscillator.start(ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    oscillator.stop(ctx.currentTime + 0.15)
  } catch {
    // Silently ignore — audio may not be available
  }
}
