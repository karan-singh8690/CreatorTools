import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Build the database URL for the current environment.
 *
 * On Vercel (serverless) with Neon PostgreSQL, use the pooled connection URL
 * with `?pgbouncer=true&connect_timeout=15` for connection pooling. This
 * prevents exhausting the connection pool on serverless cold starts.
 *
 * On local dev / Docker, use the DATABASE_URL as-is.
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || ''
  if (!url) {
    // No DATABASE_URL — will fail gracefully via withDb fallback.
    return ''
  }
  // On Vercel with Neon, add pooling params if not already present.
  if (process.env.VERCEL === '1' && url.includes('neon.tech')) {
    if (!url.includes('pgbouncer=true')) {
      const sep = url.includes('?') ? '&' : '?'
      return url + sep + 'pgbouncer=true&connect_timeout=15'
    }
  }
  return url
}

/**
 * Create a Prisma client for PostgreSQL.
 */
function createPrismaClient(): PrismaClient {
  const url = getDatabaseUrl()
  const client = new PrismaClient({
    ...(url ? { datasourceUrl: url } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  return client
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

/**
 * Check if database is available (DATABASE_URL is set).
 */
export function isDbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

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
 * Returns the fallback value if the operation fails (e.g. DATABASE_URL
 * not configured, connection refused, etc.).
 */
export async function withDb<T>(
  operation: (db: PrismaClient) => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await operation(db)
  } catch (error) {
    if (isPrismaInitError(error)) {
      console.warn('[DB] Prisma initialization error — database unavailable')
    } else {
      console.error('[DB] Database operation failed:', error)
    }
    return fallback
  }
}
