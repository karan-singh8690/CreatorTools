import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/terabox-session'

/**
 * Same-origin HLS proxy.
 *
 * The browser cannot fetch the Terabox m3u8 / .ts segments directly because
 * Terabox does not send CORS headers. This route fetches them server-side and
 * streams the bytes back to the browser with permissive CORS, so hls.js can
 * load the playlist and segments from same-origin.
 *
 * It also rewrites the segment URLs inside the m3u8 playlist so that every
 * segment request is routed back through this proxy.
 *
 * Constraints honored: nothing is persisted (no DB, no disk). Each request is
 * a single pass-through fetch.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UA =
  'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

const PROXY_PATH = '/api/terabox/stream'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  }
}

function rewritePlaylist(playlist: string, sessionToken: string): string {
  // Rewrite every URL in the playlist (segment lines + key lines) to go
  // through our proxy, carrying the session token so the proxy can forward
  // the Terabox cookie + referer when fetching each segment.
  const appendToken = (proxyUrl: string) =>
    sessionToken ? `${proxyUrl}&t=${encodeURIComponent(sessionToken)}` : proxyUrl
  return playlist
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        // Rewrite URI="..." inside #EXT-X-KEY / #EXT-X-MAP tags
        return line.replace(/URI="([^"]+)"/g, (_m, url: string) => {
          return `URI="${appendToken(
            `${PROXY_PATH}?u=${encodeURIComponent(url)}`
          )}"`
        })
      }
      if (/^https?:\/\//i.test(trimmed)) {
        return appendToken(`${PROXY_PATH}?u=${encodeURIComponent(trimmed)}`)
      }
      // relative URL — can't safely resolve without a base; leave as-is
      return line
    })
    .join('\n')
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('u')
  if (!target) {
    return NextResponse.json(
      { error: 'Missing "u" query parameter.' },
      { status: 400, headers: corsHeaders() }
    )
  }

  let targetUrl: URL
  try {
    targetUrl = new URL(target)
  } catch {
    return NextResponse.json(
      { error: 'Invalid target URL.' },
      { status: 400, headers: corsHeaders() }
    )
  }

  // Only allow proxying to known Terabox / segment CDN hosts, to avoid an
  // open proxy. The m3u8 lives on the share host; segments live on
  // *.freeterabox.com / *.terabox.com / data.* hosts.
  const allowedHostRe =
    /(terabox|1024tera|freeterabox|teraboxapp|teraboxcdn|data\.terabox|mirrobox|nephobox|4funbox)/i
  if (!allowedHostRe.test(targetUrl.hostname)) {
    return NextResponse.json(
      { error: 'Proxy target not allowed.' },
      { status: 403, headers: corsHeaders() }
    )
  }

  // Forward the Range header so seek works for segment byte-ranges.
  const upstreamHeaders: Record<string, string> = {
    'User-Agent': UA,
    Accept: '*/*',
  }
  const range = req.headers.get('range')
  if (range) upstreamHeaders['Range'] = range

  // The Terabox m3u8 / segments are bound to the share-page session (browserid
  // cookie). The resolve route stashed that session behind an opaque token;
  // look it up here and forward the cookie + referer upstream.
  const sessionToken = req.nextUrl.searchParams.get('t')
  if (sessionToken) {
    const session = getSession(sessionToken)
    if (session) {
      upstreamHeaders['Cookie'] = session.cookie
      upstreamHeaders['Referer'] = session.referer
    }
  }

  let upstream: Response
  try {
    upstream = await fetch(targetUrl.toString(), {
      headers: upstreamHeaders,
      redirect: 'follow',
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch upstream media.' },
      { status: 502, headers: corsHeaders() }
    )
  }

  // If it's a playlist (m3u8), rewrite segment URLs and return as text.
  const ct = upstream.headers.get('content-type') || ''
  if (ct.includes('mpegurl') || targetUrl.pathname.endsWith('.m3u8')) {
    const text = await upstream.text()
    const rewritten = rewritePlaylist(text, sessionToken || '')
    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'Cache-Control': 'no-store',
        ...corsHeaders(),
      },
    })
  }

  // Otherwise stream bytes (segment .ts / .mp4 / etc.) through verbatim,
  // forwarding content-type, content-length, and content-range.
  const respHeaders: Record<string, string> = {
    'Cache-Control': 'public, max-age=3600',
    ...corsHeaders(),
  }
  for (const h of [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
  ]) {
    const v = upstream.headers.get(h)
    if (v) respHeaders[h] = v
  }

  // We need to honor the upstream status (e.g. 206 Partial Content) for Range
  // requests so seeking works.
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  })
}
