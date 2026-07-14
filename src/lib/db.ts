import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __dbAvailable?: boolean
}

/**
 * Resolve the database URL for the current environment.
 *
 * - If DATABASE_URL is set and valid, use it.
 * - If it's missing/empty (e.g. on Vercel where env vars aren't configured),
 *   fall back to an ephemeral /tmp SQLite file so Prisma can at least
 *   INITIALIZE without crashing. Data won't persist across cold starts, but
 *   the app won't 500 on every request.
 * - On Vercel the filesystem is read-only except /tmp, so /tmp is the only
 *   place SQLite can write.
 */
function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || ''
  if (url.startsWith('file:')) return url
  // Fallback: ephemeral /tmp SQLite (works on Vercel, persists per warm instance)
  return 'file:/tmp/creatortools-ephemeral.db'
}

/**
 * Whether the database is "really" available (env var was set).
 * When false, routes should return empty/default data gracefully.
 */
export function isDbAvailable(): boolean {
  if (globalForPrisma.__dbAvailable !== undefined) return globalForPrisma.__dbAvailable
  const url = process.env.DATABASE_URL || ''
  const available = url.startsWith('file:')
  globalForPrisma.__dbAvailable = available
  return available
}

/**
 * Create a Prisma client. Uses the resolved DATABASE_URL (with /tmp fallback).
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  return client
}

/**
 * Lazily get the Prisma client. We don't instantiate at module load so that
 * a missing DATABASE_URL doesn't crash every route that imports this module.
 */
function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

/** Backwards-compat: `db` property. Accesses the lazy singleton. */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

/**
 * Check if a caught error is a Prisma initialization error.
 * Use this in catch blocks to return appropriate responses.
 */
export function isPrismaInitError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true
  if (error instanceof Error && error.message?.includes('must start with the protocol')) return true
  if (error instanceof Error && error.message?.includes('Error validating datasource')) return true
  return false
}

/**
 * Run a database operation with graceful fallback.
 * Returns the fallback value if the operation fails (e.g. on Vercel where
 * the DB is ephemeral or unavailable).
 */
export async function withDb<T>(
  operation: (db: PrismaClient) => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await operation(getDb())
  } catch (error) {
    if (isPrismaInitError(error)) {
      console.warn('[DB] Prisma initialization error — database unavailable, returning fallback')
    } else {
      console.error('[DB] Database operation failed:', error)
    }
    return fallback
  }
}
