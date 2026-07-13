'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTimeAgo, formatHistorySize } from '@/lib/tool-history-utils'

// Re-export for backward compatibility
export { getTimeAgo, formatHistorySize }

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToolHistoryItem {
  id: string
  toolId: string           // e.g. 'compress', 'convert', 'watermark'
  toolLabel: string        // e.g. 'Compress PDF', 'Convert PDF'
  summary: string          // Human-readable one-line summary
  details: Record<string, any>  // Tool-specific data (file name, settings, etc.)
  status: 'success' | 'error' | 'partial'
  timestamp: string        // ISO date string
}

const HISTORY_KEY_PREFIX = 'creatortools-history-'
const GLOBAL_HISTORY_KEY = 'creatortools-history-all'
const MAX_ITEMS_PER_TOOL = 50
const MAX_GLOBAL_ITEMS = 200

// ─── Utility Functions ───────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Get all history for a specific tool */
function getToolHistory(toolId: string): ToolHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${HISTORY_KEY_PREFIX}${toolId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Save a history item for a specific tool */
function saveToolHistoryItem(item: ToolHistoryItem): void {
  // Save to tool-specific key
  const toolHistory = getToolHistory(item.toolId)
  toolHistory.unshift(item)
  if (toolHistory.length > MAX_ITEMS_PER_TOOL) {
    toolHistory.splice(MAX_ITEMS_PER_TOOL)
  }
  localStorage.setItem(`${HISTORY_KEY_PREFIX}${item.toolId}`, JSON.stringify(toolHistory))

  // Also save to global history
  const globalHistory = getGlobalHistory()
  globalHistory.unshift(item)
  if (globalHistory.length > MAX_GLOBAL_ITEMS) {
    globalHistory.splice(MAX_GLOBAL_ITEMS)
  }
  localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(globalHistory))
}

/** Get global history (all tools combined) */
function getGlobalHistory(): ToolHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(GLOBAL_HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Delete a single history item by id */
function deleteHistoryItem(id: string): { toolId: string } | null {
  // Find which tool it belongs to by checking global history
  const globalHistory = getGlobalHistory()
  const item = globalHistory.find(h => h.id === id)
  if (!item) return null

  // Remove from global
  const updatedGlobal = globalHistory.filter(h => h.id !== id)
  localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(updatedGlobal))

  // Remove from tool-specific
  const toolHistory = getToolHistory(item.toolId).filter(h => h.id !== id)
  localStorage.setItem(`${HISTORY_KEY_PREFIX}${item.toolId}`, JSON.stringify(toolHistory))

  return { toolId: item.toolId }
}

/** Clear all history for a specific tool */
function clearToolHistory(toolId: string): void {
  localStorage.removeItem(`${HISTORY_KEY_PREFIX}${toolId}`)

  // Also remove from global
  const globalHistory = getGlobalHistory().filter(h => h.toolId !== toolId)
  localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(globalHistory))
}

/** Clear ALL history (all tools) */
function clearAllHistory(): void {
  // Get all keys that start with our prefix
  if (typeof window === 'undefined') return
  const keysToRemove: string[] = [GLOBAL_HISTORY_KEY]
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(HISTORY_KEY_PREFIX)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))
}

/** Get total storage size used by history (approximate) */
function getHistoryStorageSize(): number {
  if (typeof window === 'undefined') return 0
  let totalSize = 0
  const globalData = localStorage.getItem(GLOBAL_HISTORY_KEY)
  if (globalData) totalSize += globalData.length * 2 // UTF-16 = 2 bytes per char

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(HISTORY_KEY_PREFIX)) {
      const data = localStorage.getItem(key)
      if (data) totalSize += data.length * 2
    }
  }
  return totalSize
}

// Utility functions moved to @/lib/tool-history-utils.ts
// They are re-exported above for backward compatibility


// ─── React Hook ──────────────────────────────────────────────────────────────

export function useToolHistory(toolId: string, toolLabel: string) {
  const [history, setHistory] = useState<ToolHistoryItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load history on mount
  useEffect(() => {
    const data = getToolHistory(toolId)
    const timer = requestAnimationFrame(() => {
      setHistory(data)
      setIsLoaded(true)
    })
    return () => cancelAnimationFrame(timer)
  }, [toolId])

  /** Add a new history entry */
  const addHistory = useCallback((
    summary: string,
    details: Record<string, any> = {},
    status: 'success' | 'error' | 'partial' = 'success'
  ) => {
    const item: ToolHistoryItem = {
      id: generateId(),
      toolId,
      toolLabel,
      summary,
      details,
      status,
      timestamp: new Date().toISOString(),
    }
    saveToolHistoryItem(item)
    setHistory(getToolHistory(toolId))
    return item
  }, [toolId, toolLabel])

  /** Delete a single history item */
  const deleteItem = useCallback((id: string) => {
    deleteHistoryItem(id)
    setHistory(getToolHistory(toolId))
  }, [toolId])

  /** Clear all history for this tool */
  const clearHistory = useCallback(() => {
    clearToolHistory(toolId)
    setHistory([])
  }, [toolId])

  return {
    history,
    isLoaded,
    addHistory,
    deleteItem,
    clearHistory,
    count: history.length,
  }
}

// ─── Global History Hook (for home page / settings) ──────────────────────────

export function useGlobalHistory() {
  const [history, setHistory] = useState<ToolHistoryItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const data = getGlobalHistory()
    const timer = requestAnimationFrame(() => {
      setHistory(data)
      setIsLoaded(true)
    })
    return () => cancelAnimationFrame(timer)
  }, [])

  const refresh = useCallback(() => {
    setHistory(getGlobalHistory())
  }, [])

  const deleteItem = useCallback((id: string) => {
    deleteHistoryItem(id)
    setHistory(getGlobalHistory())
  }, [])

  const clearAll = useCallback(() => {
    clearAllHistory()
    setHistory([])
  }, [])

  const clearTool = useCallback((toolId: string) => {
    clearToolHistory(toolId)
    setHistory(getGlobalHistory())
  }, [])

  const storageSize = getHistoryStorageSize()

  // Group by tool
  const byTool = history.reduce<Record<string, ToolHistoryItem[]>>((acc, item) => {
    if (!acc[item.toolId]) acc[item.toolId] = []
    acc[item.toolId].push(item)
    return acc
  }, {})

  // Group by date
  const byDate = history.reduce<Record<string, ToolHistoryItem[]>>((acc, item) => {
    const date = new Date(item.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(item)
    return acc
  }, {})

  return {
    history,
    isLoaded,
    refresh,
    deleteItem,
    clearAll,
    clearTool,
    storageSize,
    byTool,
    byDate,
    count: history.length,
  }
}
