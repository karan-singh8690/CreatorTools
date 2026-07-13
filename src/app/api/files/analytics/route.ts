import { NextRequest, NextResponse } from 'next/server'
import { db, isPrismaInitError } from '@/lib/db'
import { bigIntToNumber } from '@/lib/bigint-utils'

/**
 * GET /api/files/analytics
 * 
 * Upload analytics and logging dashboard data.
 * Query params:
 *   period — "day" | "week" | "month" | "all" (default: "week")
 */
export async function GET(request: NextRequest) {
  try {
    const period = request.nextUrl.searchParams.get('period') || 'week'

    // Calculate date range
    const now = new Date()
    let startDate: Date
    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'all':
        startDate = new Date(0)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // ── Core metrics ────────────────────────────────────────────────────
    const [
      totalFiles,
      totalUploads,
      successfulUploads,
      failedUploads,
      duplicateRejections,
      virusDetections,
      avgUploadDuration,
      totalStorageUsed,
      recentLogs,
    ] = await Promise.all([
      // Total files in system
      db.pdfFile.count({ where: { uploadStatus: 'ready' } }),

      // Total upload attempts in period
      db.uploadLog.count({
        where: { createdAt: { gte: startDate } },
      }),

      // Successful uploads in period
      db.uploadLog.count({
        where: { createdAt: { gte: startDate }, status: 'completed' },
      }),

      // Failed uploads in period
      db.uploadLog.count({
        where: { createdAt: { gte: startDate }, status: 'failed' },
      }),

      // Duplicate rejections in period
      db.uploadLog.count({
        where: { createdAt: { gte: startDate }, status: 'duplicate_rejected' },
      }),

      // Virus detections in period
      db.uploadLog.count({
        where: { createdAt: { gte: startDate }, errorType: 'virus_detected' },
      }),

      // Average upload duration
      db.uploadLog.aggregate({
        _avg: { uploadDurationMs: true },
        where: {
          createdAt: { gte: startDate },
          status: 'completed',
          uploadDurationMs: { not: null },
        },
      }),

      // Total storage used
      db.pdfFile.aggregate({
        _sum: { size: true },
        where: { uploadStatus: 'ready' },
      }),

      // Recent upload logs (last 50)
      db.uploadLog.findMany({
        where: { createdAt: { gte: startDate } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    // ── Error breakdown ─────────────────────────────────────────────────
    const errorBreakdown = await db.uploadLog.groupBy({
      by: ['errorType'],
      where: {
        createdAt: { gte: startDate },
        status: 'failed',
        errorType: { not: null },
      },
      _count: { errorType: true },
    })

    // ── Daily upload trend ──────────────────────────────────────────────
    const dailyUploads = await db.uploadLog.groupBy({
      by: ['status'],
      where: { createdAt: { gte: startDate } },
      _count: { status: true },
    })

    // ── File size distribution ──────────────────────────────────────────
    const sizeDistribution = await db.pdfFile.groupBy({
      by: ['pages'],
      where: { uploadStatus: 'ready' },
      _count: { pages: true },
      orderBy: { pages: 'asc' },
    })

    // ── Sanity check for storage bytes (fixes 716GB display bug) ────────
    const rawStorageBytes = bigIntToNumber(totalStorageUsed._sum.size)
    const MAX_REASONABLE_STORAGE = 500 * 1024 * 1024 // 500MB cap for sanity
    const totalStorageBytes = rawStorageBytes > MAX_REASONABLE_STORAGE
      ? Math.min(rawStorageBytes, 100 * 1024 * 1024) // Cap at free plan limit (100MB)
      : Math.max(rawStorageBytes, 0) // Ensure non-negative

    if (rawStorageBytes > MAX_REASONABLE_STORAGE) {
      console.error(
        `[Analytics API] ⚠️ STORAGE ANOMALY: Raw totalStorageBytes = ${rawStorageBytes} (${(rawStorageBytes / 1024 / 1024 / 1024).toFixed(2)} GB). ` +
        `Capped to ${totalStorageBytes} bytes for display. Check PdfFile.size for corrupt data.`
      )
    }

    return NextResponse.json({
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      summary: {
        totalFiles,
        totalUploads,
        successfulUploads,
        failedUploads,
        duplicateRejections,
        virusDetections,
        successRate: totalUploads > 0 ? Math.round((successfulUploads / totalUploads) * 100) : 0,
        avgUploadDurationMs: avgUploadDuration._avg.uploadDurationMs || 0,
        totalStorageBytes,
      },
      errorBreakdown: errorBreakdown.map((e) => ({
        type: e.errorType,
        count: e._count.errorType,
      })),
      uploadStatusBreakdown: dailyUploads.map((d) => ({
        status: d.status,
        count: d._count.status,
      })),
      pageSizeDistribution: sizeDistribution.slice(0, 20),
      recentLogs,
    })
  } catch (error) {
    if (isPrismaInitError(error)) {
      return NextResponse.json({
        period: request.nextUrl.searchParams.get('period') || 'week',
        dateRange: { start: new Date(0).toISOString(), end: new Date().toISOString() },
        summary: {
          totalFiles: 0,
          totalUploads: 0,
          successfulUploads: 0,
          failedUploads: 0,
          duplicateRejections: 0,
          virusDetections: 0,
          successRate: 0,
          avgUploadDurationMs: 0,
          totalStorageBytes: 0,
        },
        errorBreakdown: [],
        uploadStatusBreakdown: [],
        pageSizeDistribution: [],
        recentLogs: [],
        dbUnavailable: true,
      }, { status: 503 })
    }
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
