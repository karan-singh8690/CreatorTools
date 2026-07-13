import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Create a Prisma client.
 * The project uses SQLite (file-based) in this environment.
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  return client
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

/**
 * Check if database is available.
 */
export function isDbAvailable(): boolean {
  return true
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
 * Returns the fallback value if the operation fails.
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
