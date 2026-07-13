/**
 * Safely convert a value to a JavaScript number.
 * With PostgreSQL (Int instead of BigInt), this is a simple passthrough.
 * Returns 0 for null/undefined.
 */
export function bigIntToNumber(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return 0
    return value
  }
  return 0
}

/**
 * Identity function — kept for backward compatibility.
 * With PostgreSQL (Int instead of BigInt), serialization is no longer needed
 * since all numeric fields are already JavaScript numbers.
 */
export function serializeBigInt<T>(obj: T): T {
  return obj
}

/**
 * Format bytes to human-readable storage size.
 * Single source of truth for all storage display formatting.
 * Handles NaN, Infinity, negative values, and extremely large values.
 */
export function formatStorageSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  // Clamp index to valid range
  const safeIndex = Math.max(0, Math.min(i, sizes.length - 1))
  return parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(1)) + ' ' + sizes[safeIndex]
}
