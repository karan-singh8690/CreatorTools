'use client'

import { useEffect } from 'react'
import { loadSettings, applyAccentColor } from '@/hooks/use-settings'
import { useAppStore } from '@/store/app-store'
import { useTheme } from 'next-themes'

/**
 * Applies user settings (theme, accent color, sidebar state, etc.) on app startup.
 * Place this once in the root layout so it runs regardless of which page is shown.
 *
 * All side effects run in useEffect (client-only) to avoid hydration mismatches.
 * The Zustand store initializes with safe defaults (false, 'light', etc.) and this
 * component patches the real user preferences after mount.
 */
export function SettingsInitializer() {
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed)
  const { setTheme } = useTheme()

  useEffect(() => {
    try {
      const settings = loadSettings()

      // Apply accent color CSS variable
      applyAccentColor(settings.accentColor)

      // Apply saved sidebar state
      setSidebarCollapsed(settings.sidebarDefaultCollapsed)

      // Apply saved theme via next-themes
      setTheme(settings.theme)
    } catch {
      // ignore
    }
  }, [setSidebarCollapsed, setTheme])

  return null
}
