'use client'

/**
 * BeforeAfterSlider — draggable before/after image comparison slider.
 *
 * Props:
 *  - beforeUrl / afterUrl: image URLs (or base64 data URIs).
 *  - width / height: intrinsic image dims (for aspect-ratio placeholder).
 *  - loading: shows a spinner overlay when true.
 *
 * Pointer-event driven (works for both mouse + touch). The before image
 * is the bottom layer; the after image is clipped to the slider's left
 * portion via `clip-path: inset()`. Keyboard accessible: ←/→ arrows
 * move the handle by 5%.
 */

import { useCallback, useRef, useState } from 'react'
import { Loader2, MoveHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BeforeAfterSliderProps {
  beforeUrl: string
  afterUrl: string
  width?: number
  height?: number
  loading?: boolean
  className?: string
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  width,
  height,
  loading = false,
  className,
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50) // 0..100
  const draggingRef = useRef(false)

  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.max(0, Math.min(100, pct)))
  }, [])

  // ── Pointer handlers (mouse + touch unified via Pointer Events) ──────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (loading) return
      draggingRef.current = true
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      setFromClientX(e.clientX)
    },
    [loading, setFromClientX]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return
      setFromClientX(e.clientX)
    },
    [setFromClientX]
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  }, [])

  // ── Keyboard arrows ───────────────────────────────────────────────────────
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPos((p) => Math.max(0, p - 5))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPos((p) => Math.min(100, p + 5))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setPos(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setPos(100)
    }
  }, [])

  // NOTE: we deliberately do NOT reset `pos` when images change — keeping
  // the user's chosen comparison position across page navigation is good UX.

  const aspectStyle: React.CSSProperties =
    width && height
      ? { aspectRatio: `${width} / ${height}` }
      : { aspectRatio: '1 / 1.414' /* A4 fallback */ }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full select-none overflow-hidden rounded-lg border bg-muted/40',
        loading && 'pointer-events-none',
        className
      )}
      style={aspectStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="slider"
      tabIndex={0}
      aria-label="Before/after comparison slider. Use left and right arrow keys to adjust."
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${Math.round(pos)}% after`}
      onKeyDown={onKeyDown}
    >
      {/* BEFORE (bottom layer, full) */}
      <img
        src={beforeUrl}
        alt="Before cleanup"
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain bg-white"
      />
      {/* AFTER (top layer, clipped to left of handle) */}
      <img
        src={afterUrl}
        alt="After cleanup"
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain bg-white"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />

      {/* Labels */}
      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
        Before
      </span>
      <span className="pointer-events-none absolute right-2 top-2 rounded bg-rose-600/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
        After
      </span>

      {/* Handle */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-rose-600 shadow-[0_0_0_1px_rgba(255,255,255,0.5)]"
        style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-rose-600 bg-white shadow-md">
          <MoveHorizontal className="h-4 w-4 text-rose-600" />
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-rose-600" />
          <span className="text-xs font-medium text-muted-foreground">
            Generating preview…
          </span>
        </div>
      )}

      {/* sr-only description */}
      <span className="sr-only">
        Drag the handle to compare the original page with the cleaned version.
        Current position: {Math.round(pos)}% after.
      </span>
    </div>
  )
}
