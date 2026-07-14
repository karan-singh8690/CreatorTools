/**
 * In-memory session store shared across route handlers.
 *
 * Process-local, never persisted to disk. Used by /api/terabox/resolve to
 * stash a Terabox share-page session (cookie + referer) behind an opaque
 * token, and by /api/terabox/stream to look it up when proxying the m3u8 /
 * segments. Without this, the stream proxy can't forward the Terabox
 * browserid cookie that the signed m3u8 URL is bound to.
 *
 * Lives in src/lib (not inside a route file) so both route handlers import
 * the SAME module instance and share the same Map. The Map is hung off
 * globalThis so it survives Next.js dev-mode hot-module reloads (which would
 * otherwise reset module-level state and lose every session).
 */

export interface TeraboxSession {
  cookie: string
  referer: string
  expiresAt: number
}

const SESSION_TTL_MS = 10 * 60 * 1000
const SESSION_MAX = 100

interface Store {
  sessions: Map<string, TeraboxSession>
}

const globalForSessions = globalThis as unknown as { __teraboxSessions?: Store }

const store: Store =
  globalForSessions.__teraboxSessions ??
  (globalForSessions.__teraboxSessions = { sessions: new Map() })

const sessions = store.sessions

export function createSession(cookie: string, referer: string): string {
  const token =
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  const now = Date.now()
  if (sessions.size >= SESSION_MAX) {
    for (const [k, v] of sessions) {
      if (now > v.expiresAt) sessions.delete(k)
    }
    if (sessions.size >= SESSION_MAX) {
      const firstKey = sessions.keys().next().value
      if (firstKey) sessions.delete(firstKey)
    }
  }
  sessions.set(token, { cookie, referer, expiresAt: now + SESSION_TTL_MS })
  return token
}

export function getSession(token: string): TeraboxSession | null {
  const s = sessions.get(token)
  if (!s) return null
  if (Date.now() > s.expiresAt) {
    sessions.delete(token)
    return null
  }
  return s
}
