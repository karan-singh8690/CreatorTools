/**
 * Shared Local Storage History Utility for CreatorTools
 *
 * Each tool saves user actions to browser localStorage.
 * - User ka history uske browser mein save hoga
 * - Admin access nahi kar sakta
 * - User apna history dekh sakta hai
 * - Clear browser data = history gone
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ToolHistoryEntry {
  id: string
  toolId: string
  toolName: string
  /** What action was performed, e.g. "Compressed report.pdf" */
  action: string
  /** Short description of details, e.g. "Saved 45% — 2.3 MB reduced" */
  details?: string
  /** Status of the operation */
  status: 'success' | 'error' | 'partial'
  /** Any extra metadata specific to the tool (settings used, etc.) */
  metadata?: Record<string, unknown>
  /** ISO timestamp */
  createdAt: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'creatortools-history'
const MAX_ENTRIES_PER_TOOL = 50
const MAX_ENTRIES_GLOBAL = 500

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStorageKey(toolId: string): string {
  return `${STORAGE_PREFIX}-${toolId}`
}

function getGlobalKey(): string {
  return `${STORAGE_PREFIX}-global`
}

function generateId(): string {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ─── Per-Tool History ───────────────────────────────────────────────────────

/**
 * Get history entries for a specific tool
 */
export function getToolHistory(toolId: string): ToolHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(getStorageKey(toolId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Save a new history entry for a tool
 */
export function addToolHistoryEntry(toolId: string, entry: Omit<ToolHistoryEntry, 'id' | 'createdAt'>): ToolHistoryEntry {
  const newEntry: ToolHistoryEntry = {
    ...entry,
    id: generateId(),
    createdAt: new Date().toISOString(),
  }

  // Save to per-tool storage
  const history = getToolHistory(toolId)
  history.unshift(newEntry) // newest first
  if (history.length > MAX_ENTRIES_PER_TOOL) {
    history.splice(MAX_ENTRIES_PER_TOOL)
  }
  localStorage.setItem(getStorageKey(toolId), JSON.stringify(history))

  // Also save to global history
  addToGlobalHistory(newEntry)

  return newEntry
}

/**
 * Delete a specific history entry
 */
export function deleteToolHistoryEntry(toolId: string, entryId: string): ToolHistoryEntry[] {
  const history = getToolHistory(toolId).filter(h => h.id !== entryId)
  localStorage.setItem(getStorageKey(toolId), JSON.stringify(history))

  // Also remove from global
  removeFromGlobalHistory(entryId)

  return history
}

/**
 * Clear all history for a specific tool
 */
export function clearToolHistory(toolId: string): void {
  const entries = getToolHistory(toolId)
  localStorage.removeItem(getStorageKey(toolId))

  // Remove from global too
  const globalHistory = getGlobalHistory().filter(h => !entries.some(e => e.id === h.id))
  localStorage.setItem(getGlobalKey(), JSON.stringify(globalHistory))
}

// ─── Global History (All Tools) ─────────────────────────────────────────────

/**
 * Get history entries across all tools
 */
export function getGlobalHistory(): ToolHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(getGlobalKey())
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function addToGlobalHistory(entry: ToolHistoryEntry): void {
  const history = getGlobalHistory()
  history.unshift(entry)
  if (history.length > MAX_ENTRIES_GLOBAL) {
    history.splice(MAX_ENTRIES_GLOBAL)
  }
  localStorage.setItem(getGlobalKey(), JSON.stringify(history))
}

function removeFromGlobalHistory(entryId: string): void {
  const history = getGlobalHistory().filter(h => h.id !== entryId)
  localStorage.setItem(getGlobalKey(), JSON.stringify(history))
}

/**
 * Clear ALL tool history (global wipe)
 */
export function clearAllHistory(): void {
  if (typeof window === 'undefined') return

  // Remove all creatortools-history keys
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Get total count of history entries across all tools
 */
export function getGlobalHistoryCount(): number {
  return getGlobalHistory().length
}

/**
 * Get count of history entries for a specific tool
 */
export function getToolHistoryCount(toolId: string): number {
  return getToolHistory(toolId).length
}

/**
 * Get storage size used by history in bytes (approximate)
 */
export function getHistoryStorageSize(): number {
  if (typeof window === 'undefined') return 0
  let totalSize = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      const value = localStorage.getItem(key)
      if (value) {
        totalSize += key.length + value.length
      }
    }
  }
  // Each char is ~2 bytes in UTF-16
  return totalSize * 2
}

/**
 * Format relative time (e.g., "2m ago", "Yesterday")
 */
export function getTimeAgo(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Truncate text for preview display
 */
export function truncateText(text: string, maxLen: number = 60): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

// ─── Tool ID Constants ──────────────────────────────────────────────────────

export const TOOL_IDS = {
  COMPRESS: 'compress',
  CONVERT: 'convert',
  OCR: 'ocr',
  COMBINE: 'combine',
  WATERMARK: 'watermark',
  BACKGROUND: 'background',
  HEADER_FOOTER: 'header-footer',
  BATES_NUMBER: 'bates-number',
  SECURITY: 'security',
  SIGN: 'sign',
  CROP: 'crop',
  EXTRACT_TEXT: 'extract-text',
  BATCH_PRINT: 'batch-print',
  EDIT_PDF: 'edit-pdf',
  QR_GENERATOR: 'qr-generator',
} as const

export type ToolId = (typeof TOOL_IDS)[keyof typeof TOOL_IDS]

/**
 * Human-readable tool names
 */
export const TOOL_NAMES: Record<ToolId, string> = {
  [TOOL_IDS.COMPRESS]: 'Compress PDF',
  [TOOL_IDS.CONVERT]: 'Convert PDF',
  [TOOL_IDS.OCR]: 'OCR PDF',
  [TOOL_IDS.COMBINE]: 'Merge PDF',
  [TOOL_IDS.WATERMARK]: 'Watermark PDF',
  [TOOL_IDS.BACKGROUND]: 'Background PDF',
  [TOOL_IDS.HEADER_FOOTER]: 'Header & Footer',
  [TOOL_IDS.BATES_NUMBER]: 'Bates Number',
  [TOOL_IDS.SECURITY]: 'Security PDF',
  [TOOL_IDS.SIGN]: 'Sign PDF',
  [TOOL_IDS.CROP]: 'Crop PDF',
  [TOOL_IDS.EXTRACT_TEXT]: 'Extract Text',
  [TOOL_IDS.BATCH_PRINT]: 'Batch Print',
  [TOOL_IDS.EDIT_PDF]: 'Edit PDF',
  [TOOL_IDS.QR_GENERATOR]: 'QR Generator',
}
