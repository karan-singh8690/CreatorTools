import { NextResponse } from 'next/server'
import { withDb } from '@/lib/db'
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
  const plan = STORAGE_PLANS[DEFAULT_PLAN]
  const totalBytes = plan.totalBytes

  // Use withDb so the route returns empty storage info instead of 500
  // when the database is unavailable (e.g. on Vercel with no DATABASE_URL).
  const result = await withDb(
    async (db) =>
      db.$queryRaw<Array<{ totalSize: number | null; fileCount: number }>>`
        SELECT COALESCE(SUM(size), 0) as totalSize, COUNT(id) as fileCount
        FROM "PdfFile"
        WHERE "uploadStatus" = 'ready'
      `,
    [{ totalSize: 0, fileCount: 0 }] as Array<{ totalSize: number | null; fileCount: number }>
  )

  let usedBytes = bigIntToNumber(result[0]?.totalSize)
  const fileCount = bigIntToNumber(result[0]?.fileCount)

  const isReasonable = usedBytes >= 0 && usedBytes <= MAX_REASONABLE_BYTES
  const dataCorruptionSuspected = !isReasonable && usedBytes > 0

  if (dataCorruptionSuspected) {
    console.error(
      `[Storage API] DATA CORRUPTION SUSPECTED: ${usedBytes} bytes. File count: ${fileCount}.`
    )
  }

  const displayUsedBytes = Math.min(Math.max(usedBytes, 0), totalBytes)
  const availableBytes = Math.max(totalBytes - displayUsedBytes, 0)
  const usedPercent = totalBytes > 0 ? (displayUsedBytes / totalBytes) * 100 : 0

  return NextResponse.json({
    usedBytes: displayUsedBytes,
    totalBytes,
    availableBytes,
    usedPercent: Math.min(usedPercent, 100),
    fileCount,
    plan: { id: DEFAULT_PLAN, name: plan.name },
    _debug: {
      rawUsedBytes: usedBytes,
      dataCorruptionSuspected,
      cappedReason: dataCorruptionSuspected
        ? `Raw value ${usedBytes} bytes exceeded plan limit. Display capped.`
        : null,
    },
  })
}
