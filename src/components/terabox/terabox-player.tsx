'use client'

/**
 * Terabox Player — "view only" streaming tool.
 *
 * - NO Terabox developer API is called from the browser.
 * - NO link/video storage anywhere (no DB, no Prisma). The share URL is sent
 *   to our own stateless /api/terabox/resolve endpoint, which fetches the
 *   public Terabox share page server-side (like a browser), derives a
 *   short-lived HLS stream URL, and returns it. Nothing is persisted.
 * - The returned .m3u8 is played with hls.js inside a plain <video> element.
 *
 * Adapted from a standalone page into a CreatorTools view component.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import Hls from 'hls.js'
import { X } from 'lucide-react'
import { useAppStore } from '@/store/app-store'

const VIDEO_POSTER =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNsaWNrIFBsYXkgVmlkZW8gdG8gc3RhcnQgc3RyZWFtaW5nPC90ZXh0Pjwvc3ZnPg=='

const TERABOX_HOST_RE =
  /terabox|1024tera|mirrobox|nephobox|teraboxapp|freeterabox|4funbox|momerybox|tibibox/i

function isValidTeraboxUrl(raw: string): boolean {
  if (!raw) return false
  let u = raw.trim()
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try {
    const parsed = new URL(u)
    if (TERABOX_HOST_RE.test(parsed.hostname)) return true
    return /\/s\/|surl=|\/wap\/share\//i.test(parsed.pathname + parsed.search)
  } catch {
    return TERABOX_HOST_RE.test(u)
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

interface QualityOption {
  label: string
  type: string
}

interface ResolveResult {
  ok: boolean
  videoUrl?: string
  sessionToken?: string
  poster?: string
  title?: string
  size?: number
  duration?: number
  preview?: boolean
  previewDuration?: number
  qualities?: QualityOption[]
  currentQuality?: string
  host?: string
  cached?: boolean
  error?: string
}

export function TeraboxPlayer() {
  const { setCurrentView } = useAppStore()
  const [inputUrl, setInputUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [result, setResult] = useState<ResolveResult | null>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [hlsError, setHlsError] = useState('')
  const [switchingQuality, setSwitchingQuality] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const attachHls = useCallback((m3u8Url: string) => {
    const video = videoRef.current
    if (!video) return
    setHlsError('')
    setPlayerReady(false)

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (isSafari && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = m3u8Url
      setPlayerReady(true)
      setResolving(false)
      return
    }

    if (!Hls.isSupported()) {
      setHlsError('This browser cannot play HLS video. Try Chrome, Edge, or Firefox.')
      setResolving(false)
      return
    }

    if ((video as unknown as { _hls?: Hls })._hls) {
      ;(video as unknown as { _hls: Hls })._hls.destroy()
      ;(video as unknown as { _hls?: Hls })._hls = undefined
    }
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
    ;(video as unknown as { _hls: Hls })._hls = hls
    hls.loadSource(m3u8Url)
    hls.attachMedia(video)
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setPlayerReady(true)
      setResolving(false)
      void video.play().catch(() => {
        /* autoplay may be blocked until user interaction */
      })
    })
    hls.on(Hls.Events.ERROR, (_evt: unknown, data: { fatal: boolean; details: string }) => {
      if (data.fatal) {
        setHlsError(
          `Playback error: ${data.details}. The stream may have expired — click Play again.`
        )
        setResolving(false)
      }
    })
  }, [])

  useEffect(() => {
    return () => {
      const v = videoRef.current
      if (v && (v as unknown as { _hls?: Hls })._hls) {
        ;(v as unknown as { _hls: Hls })._hls.destroy()
      }
    }
  }, [])

  const buildProxyUrl = useCallback((data: ResolveResult) => {
    return `/api/terabox/stream?u=${encodeURIComponent(
      data.videoUrl!
    )}${data.sessionToken ? `&t=${encodeURIComponent(data.sessionToken)}` : ''}`
  }, [])

  const handlePlay = useCallback(async () => {
    const url = inputUrl.trim()
    if (!url) {
      setError('Please enter a Terabox URL')
      setResult(null)
      return
    }
    if (!isValidTeraboxUrl(url)) {
      setError(
        'Please enter a valid Terabox URL (e.g. https://1024terabox.com/s/...)'
      )
      setResult(null)
      return
    }
    setError('')
    setResult(null)
    setPlayerReady(false)
    setHlsError('')
    setLoading(true)
    setResolving(true)

    try {
      const res = await fetch(
        `/api/terabox/resolve?url=${encodeURIComponent(url)}`
      )
      const data: ResolveResult = await res.json()
      if (!data.ok || !data.videoUrl) {
        setError(data.error || 'Failed to resolve Terabox video.')
        setResolving(false)
        return
      }
      setResult(data)
      const proxiedM3u8 = buildProxyUrl(data)
      setTimeout(() => {
        attachHls(proxiedM3u8)
      }, 50)
    } catch {
      setError('Network error while resolving the video. Please try again.')
      setResolving(false)
    } finally {
      setLoading(false)
    }
  }, [inputUrl, attachHls, buildProxyUrl])

  const handleQualityChange = useCallback(
    async (quality: string) => {
      if (!inputUrl || switchingQuality) return
      if (quality === result?.currentQuality) return
      const video = videoRef.current
      const currentTime = video?.currentTime || 0
      const wasPaused = video?.paused ?? true

      setSwitchingQuality(true)
      setHlsError('')
      try {
        const res = await fetch(
          `/api/terabox/resolve?url=${encodeURIComponent(
            inputUrl
          )}&quality=${encodeURIComponent(quality)}`
        )
        const data: ResolveResult = await res.json()
        if (!data.ok || !data.videoUrl) {
          setHlsError(data.error || `Could not switch to ${quality}.`)
          return
        }
        setResult(data)
        const proxiedM3u8 = buildProxyUrl(data)
        setTimeout(() => {
          attachHls(proxiedM3u8)
          const v = videoRef.current
          if (v) {
            const onLoaded = () => {
              v.currentTime = currentTime
              if (!wasPaused) v.play().catch(() => {})
              v.removeEventListener('loadedmetadata', onLoaded)
            }
            v.addEventListener('loadedmetadata', onLoaded)
          }
        }, 50)
      } catch {
        setHlsError('Network error while switching quality.')
      } finally {
        setSwitchingQuality(false)
      }
    },
    [inputUrl, result?.currentQuality, switchingQuality, attachHls, buildProxyUrl]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputUrl(e.target.value)
      if (error) setError('')
    },
    [error]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') void handlePlay()
    },
    [handlePlay]
  )

  const posterSrc = result?.poster || VIDEO_POSTER
  const showPlayer = Boolean(result?.videoUrl)

  return (
    <div className="h-full flex flex-col">
      {/* Header with close button (matches CreatorTools tool layout) */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border bg-background">
        <div>
          <h1 className="text-base md:text-lg font-semibold text-foreground flex items-center gap-2">
            <i className="fas fa-play-circle" style={{ color: '#ff6b6b' }} />
            Terabox Player
          </h1>
          <p className="text-xs text-muted-foreground">Stream Terabox videos instantly without ads</p>
        </div>
        <button
          onClick={() => setCurrentView('home')}
          className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close tool"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable player area with the custom terabox styling */}
      <div className="flex-1 overflow-y-auto">
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/terabox-style.css" />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
        />

        <div className="container">
          <main className="main-content">
            <div className="input-section">
              <div className="input-container">
                <input
                  type="url"
                  id="teraboxUrl"
                  placeholder="Paste your Terabox link here... (e.g., https://1024terabox.com/s/1abc123def)"
                  className="url-input"
                  value={inputUrl}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  id="playBtn"
                  className="play-button"
                  onClick={handlePlay}
                  disabled={loading}
                >
                  <i className="fas fa-play"></i>
                  {loading ? 'Resolving...' : 'Play Video'}
                </button>
              </div>

              {resolving && (
                <div className="loading show">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Resolving video stream...</span>
                </div>
              )}

              {error && (
                <div className="error-message show">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>{error}</span>
                </div>
              )}

              {hlsError && (
                <div className="error-message show">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span>{hlsError}</span>
                </div>
              )}
            </div>

            <div className="video-section" id="videoSection">
              <div className="video-container">
                {showPlayer ? (
                  <video
                    ref={videoRef}
                    className="video-player"
                    controls
                    playsInline
                    poster={posterSrc}
                    preload="metadata"
                  />
                ) : (
                  <div
                    className="video-player"
                    style={{
                      height: 'min(70vh, 540px)',
                      minHeight: '320px',
                      backgroundImage: `url("${VIDEO_POSTER}")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }}
                    role="img"
                    aria-label="Click Play Video to start streaming"
                  />
                )}
                <div className="video-info" id="videoInfo">
                  <h3 id="videoTitle">
                    {result
                      ? result.title || 'Now playing'
                      : 'Ready to play'}
                  </h3>
                  <p id="videoDescription">
                    {result ? (
                      <>
                        {inputUrl}
                        {result.size ? ` · ${formatBytes(result.size)}` : ''}
                        {result.duration
                          ? ` · ${formatDuration(result.duration)}`
                          : ''}
                        {result.host ? ` · via ${result.host}` : ''}
                      </>
                    ) : (
                      'Enter a Terabox URL above to start streaming'
                    )}
                  </p>
                  {result?.preview && (
                    <div
                      className="error-message show"
                      style={{
                        marginTop: '0.75rem',
                        background: 'rgba(251, 191, 36, 0.15)',
                        color: '#fbbf24',
                        borderColor: 'rgba(251, 191, 36, 0.35)',
                        textAlign: 'left',
                      }}
                    >
                      <i className="fas fa-clock"></i>
                      <span>
                        Showing a {formatDuration(result.previewDuration)} preview
                        of a {formatDuration(result.duration)} video.
                      </span>
                    </div>
                  )}
                  {result?.qualities && result.qualities.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        display: 'flex',
                        gap: '0.5rem',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          opacity: 0.7,
                          fontSize: '0.85rem',
                          marginRight: '0.25rem',
                        }}
                      >
                        <i className="fas fa-video" style={{ marginRight: '0.4rem' }}></i>
                        Quality:
                      </span>
                      {result.qualities.map((q) => {
                        const isActive = q.label === result.currentQuality
                        return (
                          <button
                            key={q.label}
                            onClick={() => handleQualityChange(q.label)}
                            disabled={switchingQuality || isActive}
                            style={{
                              padding: '0.35rem 0.9rem',
                              borderRadius: '8px',
                              border: isActive
                                ? '1px solid rgba(255, 107, 107, 0.6)'
                                : '1px solid rgba(255, 255, 255, 0.25)',
                              background: isActive
                                ? 'linear-gradient(45deg, #ff6b6b, #feca57)'
                                : 'rgba(255, 255, 255, 0.08)',
                              color: '#fff',
                              fontSize: '0.85rem',
                              fontWeight: isActive ? 600 : 400,
                              cursor: isActive || switchingQuality ? 'default' : 'pointer',
                              opacity: switchingQuality && !isActive ? 0.5 : 1,
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {switchingQuality && !isActive ? (
                              <i className="fas fa-spinner fa-spin" style={{ fontSize: '0.75rem' }}></i>
                            ) : null}
                            {q.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>

          <footer className="footer">
            <p>&copy; 2024 Terabox Player - For educational purposes only</p>
            <div className="disclaimer">
              <small>
                This tool only displays videos by reading the public Terabox share
                page server-side. It does not call any Terabox developer API, does
                not store links or videos, and does not host any content. Stream
                URLs are short-lived and held only in memory. Please respect
                content creators and copyright laws.
              </small>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
