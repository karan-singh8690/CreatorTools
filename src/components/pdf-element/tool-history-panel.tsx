'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  History,
  X,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Search,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToolHistoryItem } from '@/hooks/use-tool-history'
import { getTimeAgo, formatHistorySize } from '@/lib/tool-history-utils'
import { cn } from '@/lib/utils'

// ─── Status Icon ─────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: ToolHistoryItem['status'] }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
    case 'partial':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
  }
}

// ─── Detail Row ──────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-0.5">
      <span className="text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-gray-700 dark:text-gray-200 font-medium truncate ml-2 max-w-[180px] text-right">{String(value)}</span>
    </div>
  )
}

// ─── History Item Card ───────────────────────────────────────────────────────

function HistoryItemCard({
  item,
  onDelete,
  onRestore,
}: {
  item: ToolHistoryItem
  onDelete: (id: string) => void
  onRestore?: (item: ToolHistoryItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { details } = item

  // Render detail fields based on what's available
  const detailEntries = Object.entries(details).filter(
    ([key, val]) => val !== undefined && val !== null && val !== '' && key !== 'id'
  )

  return (
    <div className="group rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-600 transition-all">
      {/* Main Row */}
      <div className="flex items-start gap-2.5 p-3">
        <StatusIcon status={item.status} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-800 dark:text-gray-100 line-clamp-2 leading-snug">
            {item.summary}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {getTimeAgo(item.timestamp)}
            </span>
            {details.fileSize && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {formatHistorySize(Number(details.fileSize))}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onRestore && (
            <button
              onClick={() => onRestore(item)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500 transition-colors"
              title="Restore settings"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          {detailEntries.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && detailEntries.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-gray-50 dark:border-gray-700">
              {detailEntries.map(([key, val]) => (
                <DetailRow
                  key={key}
                  label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                  value={typeof val === 'object' ? JSON.stringify(val) : String(val)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main ToolHistoryPanel Component ─────────────────────────────────────────

interface ToolHistoryPanelProps {
  /** Tool-specific history items */
  history: ToolHistoryItem[]
  /** Delete a single item */
  onDelete: (id: string) => void
  /** Clear all history for this tool */
  onClearAll: () => void
  /** Restore previous settings (optional) */
  onRestore?: (item: ToolHistoryItem) => void
  /** Tool label for the header */
  toolLabel: string
  /** Whether history is loaded */
  isLoaded?: boolean
  /** Custom class */
  className?: string
  /** Compact mode (for sidebar) */
  compact?: boolean
}

export function ToolHistoryPanel({
  history,
  onDelete,
  onClearAll,
  onRestore,
  toolLabel,
  isLoaded = true,
  className,
  compact = false,
}: ToolHistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showConfirmClear, setShowConfirmClear] = useState(false)

  const filteredHistory = searchQuery
    ? history.filter(item =>
        item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Object.values(item.details).some(v =>
          String(v).toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : history

  // Group by date
  const grouped = filteredHistory.reduce<Record<string, ToolHistoryItem[]>>((acc, item) => {
    const date = new Date(item.timestamp)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)

    let label: string
    if (diffDays === 0) label = 'Today'
    else if (diffDays === 1) label = 'Yesterday'
    else if (diffDays < 7) label = 'This Week'
    else label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    if (!acc[label]) acc[label] = []
    acc[label].push(item)
    return acc
  }, {})

  if (!isLoaded) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-500" />
          <h3 className={cn('font-semibold text-gray-800 dark:text-gray-100', compact ? 'text-xs' : 'text-sm')}>
            {toolLabel} History
          </h3>
          {history.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
              {history.length}
            </span>
          )}
        </div>
        {history.length > 0 && (
          <div className="flex items-center gap-1">
            {!showConfirmClear ? (
              <button
                onClick={() => setShowConfirmClear(true)}
                className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                Clear All
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { onClearAll(); setShowConfirmClear(false) }}
                  className="text-[10px] font-medium text-red-500 hover:text-red-600 px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1.5 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      {history.length > 3 && (
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history..."
            className="h-8 text-xs pl-8 bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 focus:border-gray-200 dark:focus:border-gray-500"
          />
        </div>
      )}

      {/* History List */}
      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <History className="w-8 h-8 mb-2 text-gray-200 dark:text-gray-600" />
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {history.length === 0 ? 'No history yet' : 'No matching results'}
          </p>
          <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">
            {history.length === 0
              ? `Your ${toolLabel} actions will appear here`
              : 'Try a different search term'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                {dateLabel}
              </p>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <HistoryItemCard
                    key={item.id}
                    item={item}
                    onDelete={onDelete}
                    onRestore={onRestore}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
