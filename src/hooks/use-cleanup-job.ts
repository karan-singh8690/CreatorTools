'use client'

/**
 * useCleanupJob — encapsulates start / poll / cancel logic for the PDF
 * cleanup tool. Mirrors the API contract defined in
 * `@/lib/pdf-cleanup/types.ts`.
 *
 * Two exports:
 *  - `useCleanupJob()` — React hook for a SINGLE primary job (the single-
 *    file mode UI). Tracks status/state in React state.
 *  - `startCleanupJob()` + `pollCleanupStatus()` — pure helpers the batch
 *    view uses to run many jobs in parallel and track each in its own state.
 *
 * Mode → endpoint mapping (see cleanup-pdf.tsx for the full rationale):
 *   watermark   → POST /api/remove-watermark
 *   background  → POST /api/remove-background
 *   clean-scan  → POST /api/clean-scan
 *   full        → POST /api/remove-background
 *                 (the endpoint force-overrides options.mode='background',
 *                  but the orchestrator in lib/pdf-cleanup/index.ts drives
 *                  behavior off the boolean flags removeWatermark /
 *                  removeBackground / cleanScan, which we set to true for
 *                  full mode. Documented in cleanup-pdf.tsx.)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CleanupMode,
  CleanupOptions,
  CleanupStatusResponse,
  ProgressStage,
} from '@/lib/pdf-cleanup/types'

const POLL_INTERVAL_MS = 1000

const MODE_ENDPOINTS: Record<CleanupMode, string> = {
  watermark: '/api/remove-watermark',
  background: '/api/remove-background',
  'clean-scan': '/api/clean-scan',
  /**
   * For `full` mode there is no dedicated endpoint. We POST to
   * /api/remove-background which force-sets options.mode='background';
   * the orchestrator still honors removeWatermark/cleanScan booleans.
   */
  full: '/api/remove-background',
}

export type JobState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'complete'
  | 'error'
  | 'canceled'

/** Map low-level ProgressStage to a friendly user-facing headline label. */
export function stageLabel(stage: ProgressStage | undefined): string {
  switch (stage) {
    case 'queued':
      return 'Queued…'
    case 'uploading':
      return 'Uploading…'
    case 'analyzing':
      return 'Analyzing PDF…'
    case 'detecting-watermarks':
      return 'Detecting watermarks…'
    case 'cleaning-background':
      return 'Cleaning background…'
    case 'cleaning-scan':
      return 'Cleaning scan…'
    case 'running-ocr':
      return 'Running OCR…'
    case 'optimizing':
      return 'Optimizing…'
    case 'preparing-download':
      return 'Finalizing…'
    case 'complete':
      return 'Complete!'
    case 'error':
      return 'Error'
    default:
      return 'Working…'
  }
}

/**
 * Start a cleanup job. Returns the jobId. Throws on non-OK responses with
 * a useful `code` field on the Error object (TOO_LARGE, BAD_TYPE, BAD_PDF,
 * ENCRYPTED, etc.) so the UI can render actionable messages.
 */
export async function startCleanupJob(
  file: File,
  options: CleanupOptions
): Promise<{ jobId: string; totalPages: number; estimatedSeconds: number }> {
  const endpoint = MODE_ENDPOINTS[options.mode]

  const form = new FormData()
  form.append('file', file)
  form.append('options', JSON.stringify(options))

  const res = await fetch(endpoint, { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))

  if (!res.ok || !data?.ok) {
    const err = new Error(
      (data && (data.error || data.message)) || `Request failed (${res.status})`
    ) as Error & { code?: string }
    err.code = data?.code
    throw err
  }

  return {
    jobId: data.jobId as string,
    totalPages: data.totalPages as number,
    estimatedSeconds: data.estimatedSeconds as number,
  }
}

/** Cancel a running/complete cleanup job (also deletes the result file). */
export async function cancelCleanupJob(jobId: string): Promise<void> {
  try {
    await fetch(`/api/cleanup/download?jobId=${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    })
  } catch {
    /* best-effort */
  }
}

/** Fetch the current status snapshot for a job (one-shot, no polling). */
export async function fetchCleanupStatus(
  jobId: string
): Promise<CleanupStatusResponse> {
  const res = await fetch(
    `/api/cleanup/status?jobId=${encodeURIComponent(jobId)}`,
    { cache: 'no-store' }
  )
  const data = await res.json().catch(() => ({}))
  return data as CleanupStatusResponse
}

/**
 * Start polling the status endpoint for a job.
 * Returns a `stop()` function — call it on unmount / cancel / new job.
 *
 * Callbacks:
 *  - onUpdate: every poll tick, with the latest status
 *  - onDone:   when stage === 'complete' (called once, then polling stops)
 *  - onError:  when stage === 'error' (called once, then polling stops)
 */
export function pollCleanupStatus(
  jobId: string,
  onUpdate: (status: CleanupStatusResponse) => void,
  onDone?: (status: CleanupStatusResponse) => void,
  onError?: (status: CleanupStatusResponse) => void
): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const tick = async () => {
    if (stopped) return
    let next: CleanupStatusResponse
    try {
      next = await fetchCleanupStatus(jobId)
    } catch {
      // Network blip — keep polling, don't surface to user yet.
      timer = setTimeout(tick, POLL_INTERVAL_MS)
      return
    }
    if (stopped) return
    onUpdate(next)

    if (next.stage === 'complete') {
      stopped = true
      onDone?.(next)
      return
    }
    if (next.stage === 'error') {
      stopped = true
      onError?.(next)
      return
    }
    timer = setTimeout(tick, POLL_INTERVAL_MS)
  }

  // Kick off immediately.
  timer = setTimeout(tick, 0)

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}

// ─── React hook for the single-file primary job ──────────────────────────────

export interface UseCleanupJobReturn {
  state: JobState
  status: CleanupStatusResponse | null
  jobId: string | null
  start: (file: File, options: CleanupOptions) => Promise<void>
  cancel: () => Promise<void>
  reset: () => void
}

/**
 * Tracks a single cleanup job's lifecycle in React state.
 * Use this in the single-file cleanup UI. The batch view uses the lower-
 * level helpers directly so it can manage many jobs in parallel.
 */
export function useCleanupJob(): UseCleanupJobReturn {
  const [state, setState] = useState<JobState>('idle')
  const [status, setStatus] = useState<CleanupStatusResponse | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  const stopPollingRef = useRef<(() => void) | null>(null)

  const stopPolling = useCallback(() => {
    if (stopPollingRef.current) {
      stopPollingRef.current()
      stopPollingRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    stopPolling()
    setState('idle')
    setStatus(null)
    setJobId(null)
  }, [stopPolling])

  const start = useCallback(
    async (file: File, options: CleanupOptions) => {
      // Stop any previous polling.
      stopPolling()
      setState('starting')
      setStatus(null)
      setJobId(null)

      let id: string
      try {
        const r = await startCleanupJob(file, options)
        id = r.jobId
      } catch (e) {
        const err = e as Error & { code?: string }
        setStatus({
          ok: false,
          jobId: '',
          stage: 'error',
          message: err.message,
          percent: 100,
          error: err.message,
        })
        setState('error')
        return
      }

      setJobId(id)
      setState('running')

      stopPollingRef.current = pollCleanupStatus(
        id,
        (s) => {
          setStatus(s)
          // Don't flip state to 'complete'/'error' here; do it in onDone/onError
          // so the user-facing state only changes once.
        },
        (s) => {
          setStatus(s)
          setState('complete')
        },
        (s) => {
          setStatus(s)
          setState('error')
        }
      )
    },
    [stopPolling]
  )

  const cancel = useCallback(async () => {
    if (!jobId) return
    stopPolling()
    await cancelCleanupJob(jobId)
    setState('canceled')
  }, [jobId, stopPolling])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  return { state, status, jobId, start, cancel, reset }
}

/** Friendly message for a known error code returned by the API. */
export function friendlyError(message: string | undefined, code?: string): string {
  if (!message && !code) return 'Something went wrong. Please try again.'
  const m = (message || '').toLowerCase()
  if (code === 'TOO_LARGE' || m.includes('500 mb') || m.includes('too large'))
    return 'This file exceeds the 500 MB limit. Try a smaller file.'
  if (code === 'ENCRYPTED' || m.includes('encrypted'))
    return 'This PDF is encrypted. Please decrypt it first (Security tool) and try again.'
  if (code === 'BAD_PDF' || m.includes('does not appear') || m.includes('valid pdf'))
    return 'This file appears to be corrupted or is not a valid PDF. Try re-saving it.'
  if (code === 'BAD_TYPE' || m.includes('only pdf'))
    return 'Only PDF files are supported.'
  if (code === 'TOO_MANY_PAGES' || m.includes('pages'))
    return 'This PDF has too many pages (max 1000). Try splitting it first.'
  if (m.includes('ghostscript') || m.includes('qpdf'))
    return 'A required backend tool is unavailable. Please try again later.'
  return message || 'An unexpected error occurred.'
}
