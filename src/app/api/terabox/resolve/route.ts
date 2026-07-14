import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createSession } from '@/lib/terabox-session'

/**
 * Stateless Terabox resolver.
 *
 * Given a Terabox share URL, returns a streamable HLS (.m3u8) URL plus file
 * metadata (filename, size, duration, thumbnail).
 *
 * HARD CONSTRAINTS (per the user):
 *  - NO Terabox developer API is used. We only fetch the public share page
 *    and the same XHR endpoints the share page's own JS uses (exactly what a
 *    browser visiting the link would do).
 *  - NO persistence of any kind: no database, no Prisma, nothing written to
 *    disk. The URL is held only in memory for the duration of the request
 *    (plus an optional short in-memory TTL cache to avoid hammering Terabox
 *    on rapid reloads — this cache is process-local and never persisted).
 *
 * Discovered resolution flow (verified working against
 * https://1024terabox.com/s/1BO0y0yuMkdZz_rQgf_uLaA):
 *  1. GET the share URL (follow redirects). Captures:
 *       - final host (e.g. www.terabox.app / www.1024tera.com)
 *       - `browserid` cookie (set by Terabox)
 *       - `jsToken` (embedded in the share-page HTML as `fn(%22<HEX>%22)`)
 *       - `surl` (short link id, from the final URL's ?surl= query)
 *  2. GET `https://<host>/share/list?app_id=250528&shorturl=<surl>&root=1`
 *     -> JSON with file list: fs_id, server_filename, size, duration, thumbs,
 *        plus top-level `uk` and `share_id`.
 *  3. Build the streaming sign:
 *       sign = md5("5" + "dubox" + browserid + timestamp)   // clienttype=5,
 *                                                            // channel="dubox"
 *       timestamp = floor(Date.now()/1000)
 *  4. GET `https://<host>/share/streaming.m3u8?uk=<uk>&shareid=<share_id>
 *          &type=M3U8_AUTO_480&fid=<fs_id>&sign=<sign>&timestamp=<ts>
 *          &esl=1&isplayer=1&ehps=1&clienttype=5&app_id=250528&web=1
 *          &channel=dubox&jsToken=<jsToken>&play_from=web&short_link=<surl>`
 *     -> returns an HLS playlist (content-type: application/x-mpegURL).
 *
 * We return the m3u8 URL (with all params already attached) to the client,
 * which plays it with hls.js. The m3u8 URL itself is short-lived (Terabox
 * signs it with an 8h expiry), so caching is bounded.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// --- config ---------------------------------------------------------------
const UA =
  'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
// clienttype=8 is the "app" client type. Unlike clienttype=0 (web) or 5 (wap)
// which return only a 10–30s preview, clienttype=8 returns the FULL video as a
// complete HLS playlist (all segments, contiguous byte ranges, #EXT-X-ENDLIST
// at the end). This is the same client type the Terabox mobile app uses. No
// login, captcha, or Premium required — the server grants full playback to
// this client type. (Verified: 173 segments / 1730s for a 28:49 video.)
const CLIENT_TYPE = '8'
const CHANNEL = 'dubox'
const APP_ID = '250528'
const WEB = '1'

// A discovered quality option (resolution label + the stream type that serves it).
export interface QualityOption {
  label: string
  type: string
}

// In-memory LRU-ish cache (process-local, never persisted). 5-minute TTL keeps
// repeat clicks fast without hammering Terabox. Capped to 50 entries.
interface CacheEntry {
  m3u8: string
  poster?: string
  title: string
  size: number
  duration?: number // full file duration (from metadata), seconds
  previewDuration?: number // actual playable preview length, seconds
  host: string
  cookie: string // Terabox session cookie (for the stream proxy)
  referer: string // Terabox share-page URL (for the stream proxy)
  qualities?: QualityOption[] // available resolutions for this file
  currentQuality?: string // which quality the cached m3u8 is
  expiresAt: number
}
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX = 50

// In-memory session store lives in src/lib/terabox-session.ts so both this
// route and the /api/terabox/stream route share the SAME Map instance.

function cacheGet(key: string): CacheEntry | null {
  const e = cache.get(key)
  if (!e) return null
  if (Date.now() > e.expiresAt) {
    cache.delete(key)
    return null
  }
  return e
}
function cacheSet(key: string, e: CacheEntry) {
  if (cache.size >= CACHE_MAX) {
    // evict oldest by expiresAt
    let oldestKey: string | null = null
    let oldest = Infinity
    for (const [k, v] of cache) {
      if (v.expiresAt < oldest) {
        oldest = v.expiresAt
        oldestKey = k
      }
    }
    if (oldestKey) cache.delete(oldestKey)
  }
  cache.set(key, e)
}

// --- helpers --------------------------------------------------------------
function extractSurl(url: string): string | null {
  // /s/1BO0y0yuMkdZz_rQgf_uLaA  or  ?surl=BO0y0yuMkdZz_rQgf_uLaA
  const m1 = url.match(/\/s\/([A-Za-z0-9_-]+)/)
  if (m1) return m1[1]
  const m2 = url.match(/[?&]surl=([^&]+)/)
  if (m2) return m2[1]
  return null
}

function isTeraboxHost(hostname: string): boolean {
  return /terabox|1024tera|mirrobox|nephobox|teraboxapp|freeterabox|4funbox|momerybox|tibibox/i.test(
    hostname
  )
}

interface SharePageInfo {
  finalUrl: string
  host: string // e.g. www.terabox.app
  cookie: string
  surl: string
  browserid: string
  jsToken: string
}

async function fetchSharePage(shareUrl: string): Promise<SharePageInfo> {
  const r = await fetch(shareUrl, {
    redirect: 'follow',
      cache: 'no-store',
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!r.ok) {
    throw new Error(`Could not load share page (HTTP ${r.status})`)
  }
  const setCookies =
    (r.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
    []
  const cookie = setCookies.map((c) => c.split(';')[0]).join('; ')
  const html = await r.text()
  const finalUrl = r.url
  const host = new URL(finalUrl).host

  const surl = extractSurl(finalUrl) || extractSurl(shareUrl)
  if (!surl) throw new Error('Could not extract short link id from URL')

  const browseridMatch = setCookies
    .find((c) => c.startsWith('browserid='))
    ?.match(/browserid=([^;]+)/)
  const browserid = browseridMatch?.[1] ?? ''
  if (!browserid) throw new Error('Terabox did not set a browserid cookie')

  // jsToken is embedded in the share page HTML as:
  //   fn%28%22<HEX>%22   (URL-encoded  fn("<HEX>")
  const jsToken = html.match(/fn%28%22([A-F0-9]{40,})%22/)?.[1]
  if (!jsToken) throw new Error('Could not extract jsToken from share page')

  return { finalUrl, host, cookie, surl, browserid, jsToken }
}

interface FileInfo {
  fsId: string
  filename: string
  size: number
  duration?: number
  thumbnail?: string
  uk: string
  shareId: string
}

async function fetchFileInfo(info: SharePageInfo): Promise<FileInfo> {
  const listUrl = `https://${info.host}/share/list?app_id=${APP_ID}&shorturl=${encodeURIComponent(
    info.surl
  )}&root=1`
  const r = await fetch(listUrl, {
    headers: {
      'User-Agent': UA,
      Referer: info.finalUrl,
      Cookie: info.cookie,
      Accept: 'application/json, text/plain, */*',
    },
  })
  if (!r.ok) {
    throw new Error(`File list request failed (HTTP ${r.status})`)
  }
  const data = await r.json()
  if (data.errno !== 0 || !data.list || data.list.length === 0) {
    throw new Error(
      `Terabox returned no files (errno=${data.errno ?? 'unknown'}). The link may be invalid, expired, or private.`
    )
  }
  // pick the first video file
  const list = data.list as Array<Record<string, unknown>>
  const file =
    list.find((f) => {
      const name = String(f.server_filename || f.filename || '')
      return /\.(mp4|mkv|webm|mov|m4v|avi|flv|ts|m3u8)$/i.test(name)
    }) || list[0]

  const thumbs = file.thumbs as { url1?: string } | undefined
  return {
    fsId: String(file.fs_id),
    filename: String(file.server_filename || file.filename || 'Terabox video'),
    size: Number(file.size) || 0,
    duration: file.duration ? Number(file.duration) : undefined,
    thumbnail: thumbs?.url1,
    uk: String(data.uk),
    shareId: String(data.share_id),
  }
}

function buildSign(browserid: string, timestamp: number): string {
  // sign = md5(clienttype + channel + browserid + timestamp)
  return createHash('md5')
    .update(CLIENT_TYPE + CHANNEL + browserid + timestamp)
    .digest('hex')
}

// Candidate stream types for the DEFAULT resolution (480p). With clienttype=8,
// all 480p types return the full video. We try each in turn and use the first
// that returns a valid #EXTM3U playlist (in case one type is temporarily flaky).
const STREAM_TYPES = [
  'M3U8_FLV_264_480',
  'M3U8_AUTO_480',
  'M3U8_MP4_264_480',
]

// Quality presets probed in parallel to discover which resolutions Terabox has
// transcoded for this file. The server returns errno:130 when a transcode
// doesn't exist for the requested resolution. We test the primary type for
// each resolution; if it works, that quality is offered to the user.
const QUALITY_PRESETS: { label: string; type: string }[] = [
  { label: '360p', type: 'M3U8_AUTO_360' },
  { label: '480p', type: 'M3U8_FLV_264_480' },
  { label: '720p', type: 'M3U8_AUTO_720' },
  { label: '1080p', type: 'M3U8_AUTO_1080' },
]

function buildM3u8Url(
  info: SharePageInfo,
  file: FileInfo,
  type: string
): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const sign = buildSign(info.browserid, timestamp)
  const params = new URLSearchParams({
    uk: file.uk,
    shareid: file.shareId,
    type,
    fid: file.fsId,
    sign,
    timestamp: String(timestamp),
    esl: '1',
    isplayer: '1',
    ehps: '1',
    clienttype: CLIENT_TYPE,
    app_id: APP_ID,
    web: WEB,
    channel: CHANNEL,
    jsToken: info.jsToken,
    play_from: 'web',
    short_link: info.surl,
  })
  return `https://${info.host}/share/streaming.m3u8?${params.toString()}`
}

// Try a single stream type. Returns the m3u8 URL + total duration if it
// returns a valid playlist, or null if it fails (errno JSON / HTTP error).
async function tryStream(
  info: SharePageInfo,
  file: FileInfo,
  type: string
): Promise<{ m3u8: string; previewDuration: number } | null> {
  const m3u8Url = buildM3u8Url(info, file, type)
  const r = await fetch(m3u8Url, {
    headers: {
      'User-Agent': UA,
      Referer: info.finalUrl,
      Cookie: info.cookie,
      Accept: '*/*',
    },
    redirect: 'follow',
    cache: 'no-store',
  })
  if (!r.ok) return null
  const ct = r.headers.get('content-type') || ''
  const text = await r.text()
  const isPlaylist =
    ct.includes('mpegurl') || text.trimStart().startsWith('#EXTM3U')
  if (!isPlaylist) return null
  let total = 0
  for (const m of text.matchAll(/#EXTINF:([\d.]+)/g)) {
    total += parseFloat(m[1])
  }
  return { m3u8: m3u8Url, previewDuration: total }
}

// Resolve the stream for a specific quality (or the default 480p if none
// specified). Tries the primary type for the requested quality, then falls
// back to the STREAM_TYPES list (480p variants).
async function resolveStream(
  info: SharePageInfo,
  file: FileInfo,
  quality?: string
): Promise<{ m3u8: string; previewDuration: number }> {
  // If a specific quality is requested, try its preset type first.
  if (quality) {
    const preset = QUALITY_PRESETS.find((q) => q.label === quality)
    if (preset) {
      const res = await tryStream(info, file, preset.type)
      if (res) return res
      throw new Error(
        `The requested quality (${quality}) is not available for this video. Try a different quality.`
      )
    }
  }
  // Default: try the 480p candidate types.
  let lastError = ''
  for (const type of STREAM_TYPES) {
    const res = await tryStream(info, file, type)
    if (res) return res
    lastError = `type ${type} failed`
  }
  throw new Error(
    `Terabox would not serve a stream for this file (${lastError || 'all types failed'}). The link may require login or be region-restricted.`
  )
}

// Probe which resolutions are available for this file. Runs all quality
// presets in parallel to minimize latency. Returns only the ones that return
// a valid playlist. Used to populate the quality selector in the UI.
async function probeQualities(
  info: SharePageInfo,
  file: FileInfo
): Promise<QualityOption[]> {
  const results = await Promise.all(
    QUALITY_PRESETS.map(async (preset) => {
      const res = await tryStream(info, file, preset.type)
      return res ? preset : null
    })
  )
  return results.filter((r): r is QualityOption => r !== null)
}

// --- route handler --------------------------------------------------------
export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url')
  if (!urlParam) {
    return NextResponse.json(
      { ok: false, error: 'Missing "url" query parameter.' },
      { status: 400 }
    )
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(urlParam.trim())
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid URL format.' },
      { status: 400 }
    )
  }

  if (!isTeraboxHost(parsedUrl.hostname)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Please enter a valid Terabox URL (e.g. https://1024terabox.com/s/...).',
      },
      { status: 400 }
    )
  }

  const quality = req.nextUrl.searchParams.get('quality') || undefined
  const cacheKey = parsedUrl.toString()
  const cached = cacheGet(cacheKey)
  // Serve from cache only when no specific quality is requested (or the
  // requested quality matches the cached one). Quality switches always
  // re-resolve because they need a fresh signed m3u8 URL for the new type.
  if (cached && (!quality || quality === cached.currentQuality)) {
    const sessionToken = createSession(cached.cookie, cached.referer)
    return NextResponse.json({
      ok: true,
      videoUrl: cached.m3u8,
      sessionToken,
      poster: cached.poster,
      title: cached.title,
      size: cached.size,
      duration: cached.duration,
      preview: isPreview(cached.duration, cached.previewDuration),
      previewDuration: cached.previewDuration,
      qualities: cached.qualities || [],
      currentQuality: cached.currentQuality,
      host: cached.host,
      cached: true,
    })
  }

  try {
    const info = await fetchSharePage(parsedUrl.toString())
    const file = await fetchFileInfo(info)
    // Probe available qualities in parallel, then resolve the requested (or
    // default) quality. Both run concurrently to minimize latency.
    const [qualities, streamResult] = await Promise.all([
      cached?.qualities
        ? Promise.resolve(cached.qualities)
        : probeQualities(info, file),
      resolveStream(info, file, quality),
    ])
    const { m3u8, previewDuration } = streamResult
    const preview = isPreview(file.duration, previewDuration)
    const sessionToken = createSession(info.cookie, info.finalUrl)
    // Determine which quality the resolved stream corresponds to.
    const resolvedQuality =
      quality ||
      qualities.find((q) => STREAM_TYPES.includes(q.type))?.label ||
      qualities[0]?.label

    const entry: CacheEntry = {
      m3u8,
      poster: file.thumbnail,
      title: file.filename,
      size: file.size,
      duration: file.duration,
      previewDuration,
      host: info.host,
      cookie: info.cookie,
      referer: info.finalUrl,
      qualities,
      currentQuality: resolvedQuality,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }
    cacheSet(cacheKey, entry)

    return NextResponse.json({
      ok: true,
      videoUrl: m3u8,
      sessionToken,
      poster: file.thumbnail,
      title: file.filename,
      size: file.size,
      duration: file.duration,
      preview,
      previewDuration,
      qualities,
      currentQuality: resolvedQuality,
      host: info.host,
      cached: false,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to resolve Terabox video.'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}

// A stream is a "preview" if the playable duration is meaningfully shorter
// than the file's real duration (Terabox caps free playback). We use a 90%
// threshold so tiny rounding differences don't falsely flag full videos.
function isPreview(
  fullDuration: number | undefined,
  playableDuration: number | undefined
): boolean {
  if (!fullDuration || !playableDuration) return false
  if (fullDuration <= 0) return false
  return playableDuration < fullDuration * 0.9
}
