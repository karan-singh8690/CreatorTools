import { NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { bigIntToNumber } from '@/lib/bigint-utils'

const STORAGE_PLANS = {
  free: { name: 'Free', totalBytes: 100 * 1024 * 1024 },       // 100 MB
  pro: { name: 'Pro', totalBytes: 2 * 1024 * 1024 * 1024 },    // 2 GB
  enterprise: { name: 'Enterprise', totalBytes: 50 * 1024 * 1024 * 1024 }, // 50 GB
} as const

type PlanId = keyof typeof STORAGE_PLANS
const DEFAULT_PLAN: PlanId = 'free'

// Maximum reasonable storage for a free plan (500MB hard cap for sanity check)
const MAX_REASONABLE_BYTES = 500 * 1024 * 1024

export async function GET() {
  try {
    // Use raw query for accurate sum (PostgreSQL uses Int, not BigInt)
    const result = await db.$queryRaw<Array<{ totalSize: number | null; fileCount: number }>>`
      SELECT COALESCE(SUM(size), 0) as totalSize, COUNT(id) as fileCount 
      FROM "PdfFile" 
      WHERE "uploadStatus" = 'ready'
    `
    
    // Safely convert to number (handles null, undefined, negative, overflow)
    let usedBytes = bigIntToNumber(result[0]?.totalSize)
    const fileCount = bigIntToNumber(result[0]?.fileCount)

    // Sanity check: if usedBytes is unreasonably large, there's likely corrupt data
    const isReasonable = usedBytes >= 0 && usedBytes <= MAX_REASONABLE_BYTES
    const dataCorruptionSuspected = !isReasonable && usedBytes > 0

    if (dataCorruptionSuspected) {
      console.error(
        `[Storage API] ⚠️ DATA CORRUPTION SUSPECTED: ${usedBytes} bytes (${(usedBytes / 1024 / 1024 / 1024).toFixed(2)} GB). ` +
        `File count: ${fileCount}. Capping display at plan limit. ` +
        `Check PdfFile.size column for invalid entries.`
      )
    }

    const plan = STORAGE_PLANS[DEFAULT_PLAN]
    const totalBytes = plan.totalBytes

    // Cap usedBytes at totalBytes for display (prevents 716GB display bug)
    // If data is corrupt, show plan limit as the maximum
    const displayUsedBytes = Math.min(Math.max(usedBytes, 0), totalBytes)
    const availableBytes = Math.max(totalBytes - displayUsedBytes, 0)
    const usedPercent = totalBytes > 0 ? (displayUsedBytes / totalBytes) * 100 : 0

    return NextResponse.json(
      {
        usedBytes: displayUsedBytes,
        totalBytes,
        availableBytes,
        usedPercent: Math.min(usedPercent, 100),
        fileCount,
        plan: { id: DEFAULT_PLAN, name: plan.name },
        // Debug info — useful for diagnosing storage issues
        _debug: {
          rawUsedBytes: usedBytes,
          dataCorruptionSuspected,
          cappedReason: dataCorruptionSuspected
            ? `Raw value ${usedBytes} bytes exceeded plan limit of ${totalBytes} bytes. Display capped.`
            : null,
        },
      }
    )
  } catch (error) {
    // If Prisma can't connect, return empty storage info
    if (isPrismaInitError(error)) {
      const plan = STORAGE_PLANS[DEFAULT_PLAN]
      return NextResponse.json(
        {
          usedBytes: 0,
          totalBytes: plan.totalBytes,
          availableBytes: plan.totalBytes,
          usedPercent: 0,
          fileCount: 0,
          plan: { id: DEFAULT_PLAN, name: plan.name },
          _debug: { rawUsedBytes: 0, dataCorruptionSuspected: false, cappedReason: null, dbUnavailable: true },
        }
      )
    }
    console.error('Storage info error:', error)
    return NextResponse.json(
      { error: 'Failed to get storage info' },
      { status: 500 }
    )
  }
}
