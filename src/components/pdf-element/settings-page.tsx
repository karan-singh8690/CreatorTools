'use client'

import { useCallback, useState, useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { useTheme } from 'next-themes'
import NextImage from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Settings,
  HardDrive,
  Palette,
  Bell,
  RotateCcw,
  Check,
  Moon,
  Sun,
  Monitor,
  Save,
  FileText,
  RefreshCw,
  Lock,
  ShieldCheck,
  Trash2,
  Cloud,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatStorageSize } from '@/lib/bigint-utils'
import {
  useSettings,
  ACCENT_COLORS,
  FILE_NAME_PATTERNS,
  DEFAULT_SETTINGS,
  type AppSettings,
} from '@/hooks/use-settings'

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { settings, updateSetting, updateSettings, resetSettings } = useSettings()
  const [isSaving, setIsSaving] = useState(false)
  const { setTheme, theme: activeTheme, resolvedTheme } = useTheme()
  const { setSidebarCollapsed } = useAppStore()

  // Track the "original" settings to detect changes
  const [savedSnapshot, setSavedSnapshot] = useState<string>(JSON.stringify(settings))

  // next-themes returns undefined on SSR, so we can use that as our "mounted" check
  const mounted = activeTheme !== undefined

  // Detect unsaved changes (derived, not effect-driven)
  const hasChanges = JSON.stringify(settings) !== savedSnapshot

  // Storage info
  const [storageInfo, setStorageInfo] = useState<{
    usedBytes: number
    totalBytes: number
    usedPercent: number
    fileCount: number
  } | null>(null)

  const { fetchFiles } = useAppStore()

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const res = await fetch('/api/storage')
        if (res.ok) {
          const data = await res.json()
          setStorageInfo({
            usedBytes: data.usedBytes,
            totalBytes: data.totalBytes,
            usedPercent: data.usedPercent,
            fileCount: data.fileCount,
          })
        }
      } catch {
        // ignore
      }
    }
    fetchStorage()
  }, [])

  const handleUpdateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    updateSetting(key, value)
    // Apply theme change immediately via next-themes
    if (key === 'theme') {
      setTheme(value as string)
    }
    // Apply sidebar default immediately
    if (key === 'sidebarDefaultCollapsed') {
      setSidebarCollapsed(value as boolean)
    }
  }, [updateSetting, setTheme, setSidebarCollapsed])

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 300))
    // Apply theme via next-themes (already applied, but ensure consistency)
    setTheme(settings.theme)
    // Apply sidebar default
    setSidebarCollapsed(settings.sidebarDefaultCollapsed)
    // Update the saved snapshot — this makes hasChanges = false
    setSavedSnapshot(JSON.stringify(settings))
    setIsSaving(false)
    toast.success('Settings saved successfully')
  }

  const handleReset = () => {
    resetSettings()
    setTheme('light')
    setSidebarCollapsed(false)
    setSavedSnapshot(JSON.stringify(DEFAULT_SETTINGS))
    toast.info('Settings reset to defaults')
  }

  const storageUsed = storageInfo ? formatStorageSize(storageInfo.usedBytes) : '—'
  const storageTotal = storageInfo ? formatStorageSize(storageInfo.totalBytes) : '—'
  const storagePercent = storageInfo ? Math.min(storageInfo.usedPercent, 100) : 0

  return (
    <div className="flex-1 overflow-auto bg-[#F5F5F5] dark:bg-gray-950">
      {/* Header — hidden on mobile since MobileHeader shows title */}
      <div className="hidden md:sticky md:top-0 md:z-10 md:block bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[var(--accent-brand,#4A90D9)]/10 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-[var(--accent-brand,#4A90D9)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Configure your CreatorTools preferences</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-gray-600"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset Defaults
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="bg-[var(--accent-brand,#4A90D9)] hover:opacity-90"
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile save bar */}
      {hasChanges && (
        <div className="md:hidden sticky top-12 z-10 bg-[var(--accent-brand,#4A90D9)] text-white px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-medium">Unsaved changes</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="text-xs px-3 py-1.5 rounded-md bg-white/20 hover:bg-white/30 transition-colors font-medium"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs px-3 py-1.5 rounded-md bg-white text-[var(--accent-brand,#4A90D9)] hover:bg-gray-100 transition-colors font-semibold"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 md:px-8 py-4 md:py-6 max-w-4xl pb-20 md:pb-6">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm p-1 h-auto flex flex-wrap">
            <TabsTrigger value="general" className="data-[state=active]:bg-[var(--accent-brand,#4A90D9)] data-[state=active]:text-white text-xs px-3 md:px-4 py-2 flex-1 min-w-0">
              General
            </TabsTrigger>
            <TabsTrigger value="appearance" className="data-[state=active]:bg-[var(--accent-brand,#4A90D9)] data-[state=active]:text-white text-xs px-3 md:px-4 py-2 flex-1 min-w-0">
              Look
            </TabsTrigger>
            <TabsTrigger value="output" className="data-[state=active]:bg-[var(--accent-brand,#4A90D9)] data-[state=active]:text-white text-xs px-3 md:px-4 py-2 flex-1 min-w-0">
              Output
            </TabsTrigger>
            <TabsTrigger value="storage" className="data-[state=active]:bg-[var(--accent-brand,#4A90D9)] data-[state=active]:text-white text-xs px-3 md:px-4 py-2 flex-1 min-w-0">
              Storage
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-[var(--accent-brand,#4A90D9)] data-[state=active]:text-white text-xs px-3 md:px-4 py-2 flex-1 min-w-0">
              Alerts
            </TabsTrigger>
          </TabsList>

          {/* ─── General Tab ───────────────────────────────────────────────── */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  File Handling
                </CardTitle>
                <CardDescription className="text-xs">
                  How your files are managed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-gray-700 dark:text-gray-300">Delete Confirmation</Label>
                    <p className="text-xs text-gray-400">Ask before deleting files — turn off to delete instantly</p>
                  </div>
                  <Switch
                    checked={settings.deleteConfirmation}
                    onCheckedChange={(v) => handleUpdateSetting('deleteConfirmation', v)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Date Format</Label>
                  <Select value={settings.dateFormat} onValueChange={(v) => handleUpdateSetting('dateFormat', v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      <SelectItem value="DD-MMM-YYYY">DD-MMM-YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-gray-400">Applied to file dates across the app</p>
                </div>
              </CardContent>
            </Card>

            {/* Security Info Card — read-only, no toggles */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-400" />
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Virus Scanning</span>
                  </div>
                  <Badge variant="secondary" className="bg-green-50 text-green-700 text-[10px] border border-green-200">
                    Always On
                  </Badge>
                </div>
                <p className="text-xs text-gray-400">
                  All uploaded files are automatically scanned for security threats. This keeps your documents safe and cannot be disabled.
                </p>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Data Encryption</span>
                  </div>
                  <Badge variant="secondary" className="bg-green-50 text-green-700 text-[10px] border border-green-200">
                    Enabled
                  </Badge>
                </div>
                <p className="text-xs text-gray-400">
                  Your files are encrypted during upload and storage to protect your privacy.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Appearance Tab ─────────────────────────────────────────────── */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Palette className="w-4 h-4 text-gray-400" />
                  Theme
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {!mounted ? (
                  /* Placeholder to avoid hydration mismatch */
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {([
                      { value: 'light' as const, label: 'Light', icon: Sun, desc: 'Classic light mode' },
                      { value: 'dark' as const, label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
                      { value: 'system' as const, label: 'System', icon: Monitor, desc: 'Follow OS setting' },
                    ]).map((theme) => (
                      <div
                        key={theme.value}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200"
                      >
                        <theme.icon className="w-6 h-6 text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">{theme.label}</span>
                        <span className="text-[10px] text-gray-400">{theme.desc}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {([
                      { value: 'light' as const, label: 'Light', icon: Sun, desc: 'Classic light mode' },
                      { value: 'dark' as const, label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
                      { value: 'system' as const, label: 'System', icon: Monitor, desc: 'Follow OS setting' },
                    ]).map((theme) => {
                      const isActive = activeTheme === theme.value
                      return (
                        <button
                          key={theme.value}
                          onClick={() => handleUpdateSetting('theme', theme.value)}
                          className={cn(
                            'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                            isActive
                              ? 'border-[var(--accent-brand,#4A90D9)] bg-[var(--accent-brand,#4A90D9)]/5 shadow-sm'
                              : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                          )}
                        >
                          <theme.icon className={cn(
                            'w-6 h-6',
                            isActive ? 'text-[var(--accent-brand,#4A90D9)]' : 'text-gray-400'
                          )} />
                          <span className={cn(
                            'text-sm font-medium',
                            isActive ? 'text-[var(--accent-brand,#4A90D9)]' : 'text-gray-600 dark:text-gray-300'
                          )}>
                            {theme.label}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{theme.desc}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold">Accent Color</CardTitle>
                <CardDescription className="text-xs">
                  Choose the primary accent color for the interface
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => handleUpdateSetting('accentColor', color.value)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all',
                        settings.accentColor === color.value
                          ? 'border-gray-400 dark:border-gray-500 bg-gray-50 dark:bg-gray-800 shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      <div
                        className="w-5 h-5 rounded-full shrink-0 ring-2 ring-offset-1"
                        style={{
                          backgroundColor: color.value,
                          ringColor: settings.accentColor === color.value ? color.value : 'transparent'
                        }}
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">{color.name}</span>
                      {settings.accentColor === color.value && (
                        <Check className="w-3.5 h-3.5 ml-auto" style={{ color: color.value }} />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold">Layout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-gray-700 dark:text-gray-300">Sidebar Collapsed by Default</Label>
                    <p className="text-xs text-gray-400">Start with sidebar minimized</p>
                  </div>
                  <Switch
                    checked={settings.sidebarDefaultCollapsed}
                    onCheckedChange={(v) => handleUpdateSetting('sidebarDefaultCollapsed', v)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Output Tab ─────────────────────────────────────────────────── */}
          <TabsContent value="output" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-gray-400" />
                  Download Settings
                </CardTitle>
                <CardDescription className="text-xs">
                  Control how processed files are downloaded
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-gray-700 dark:text-gray-300">Auto-download After Processing</Label>
                    <p className="text-xs text-gray-400">Automatically download files after they are processed</p>
                  </div>
                  <Switch
                    checked={settings.autoDownload}
                    onCheckedChange={(v) => handleUpdateSetting('autoDownload', v)}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm text-gray-700 dark:text-gray-300">File Name Pattern</Label>
                  <p className="text-xs text-gray-400">
                    Pattern for naming processed files when downloaded
                  </p>
                  <div className="grid gap-2">
                    {FILE_NAME_PATTERNS.map((pattern) => (
                      <button
                        key={pattern.value}
                        onClick={() => handleUpdateSetting('fileNamePattern', pattern.value)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left',
                          settings.fileNamePattern === pattern.value
                            ? 'border-[var(--accent-brand,#4A90D9)] bg-[var(--accent-brand,#4A90D9)]/5 ring-1 ring-[var(--accent-brand,#4A90D9)]/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                        )}
                      >
                        <div className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                          settings.fileNamePattern === pattern.value
                            ? 'border-[var(--accent-brand,#4A90D9)]'
                            : 'border-gray-300 dark:border-gray-600'
                        )}>
                          {settings.fileNamePattern === pattern.value && (
                            <div className="w-2 h-2 rounded-full bg-[var(--accent-brand,#4A90D9)]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{pattern.label}</span>
                          <span className="text-xs text-gray-400 ml-2 font-mono">{pattern.example}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Storage Tab ────────────────────────────────────────────────── */}
          <TabsContent value="storage" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gray-400" />
                  Cloud Storage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Storage Usage Bar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Storage Used</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{storageUsed} / {storageTotal}</span>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--accent-brand,#4A90D9)] to-[var(--accent-brand,#4A90D9)]/70 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(storagePercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {storageInfo ? `${storageInfo.fileCount} files stored` : 'Loading...'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {storagePercent.toFixed(1)}% used
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Plan Info */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Free Plan</p>
                    <p className="text-xs text-gray-400">Upgrade for more storage and features</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-[var(--accent-brand,#4A90D9)] border-[var(--accent-brand,#4A90D9)]/30 hover:bg-[var(--accent-brand,#4A90D9)]/5">
                    Upgrade Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Notifications Tab ──────────────────────────────────────────── */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-gray-400" />
                  Notification Preferences
                </CardTitle>
                <CardDescription className="text-xs">
                  Control when and how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-gray-700 dark:text-gray-300">Upload Complete</Label>
                    <p className="text-xs text-gray-400">Notify when file upload finishes</p>
                  </div>
                  <Switch
                    checked={settings.notifyOnUploadComplete}
                    onCheckedChange={(v) => handleUpdateSetting('notifyOnUploadComplete', v)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-gray-700 dark:text-gray-300">Processing Complete</Label>
                    <p className="text-xs text-gray-400">Notify when PDF processing finishes</p>
                  </div>
                  <Switch
                    checked={settings.notifyOnProcessComplete}
                    onCheckedChange={(v) => handleUpdateSetting('notifyOnProcessComplete', v)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-gray-700 dark:text-gray-300">Error Alerts</Label>
                    <p className="text-xs text-gray-400">Notify when an error occurs</p>
                  </div>
                  <Switch
                    checked={settings.notifyOnError}
                    onCheckedChange={(v) => handleUpdateSetting('notifyOnError', v)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-gray-700 dark:text-gray-300">Sound Effects</Label>
                    <p className="text-xs text-gray-400">Play sounds for notifications</p>
                  </div>
                  <Switch
                    checked={settings.soundEnabled}
                    onCheckedChange={(v) => handleUpdateSetting('soundEnabled', v)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer — Version Info */}
        <div className="mt-8 pb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <NextImage
                    src="/logo.png"
                    alt="CreatorTools"
                    width={32}
                    height={32}
                    className="rounded-lg"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">CreatorTools</p>
                    <p className="text-xs text-gray-400">PDF Management Suite</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">v2.0.0</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
