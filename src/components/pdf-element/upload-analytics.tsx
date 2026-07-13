'use client'

import { useEffect, useState } from 'react'
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Copy,
  ShieldAlert,
  Clock,
  HardDrive,
  TrendingUp,
  BarChart3,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatStorageSize } from '@/lib/bigint-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AnalyticsData {
  period: string
  dateRange: { start: string; end: string }
  summary: {
    totalFiles: number
    totalUploads: number
    successfulUploads: number
    failedUploads: number
    duplicateRejections: number
    virusDetections: number
    successRate: number
    avgUploadDurationMs: number | null
    totalStorageBytes: number
  }
  errorBreakdown: { type: string; count: number }[]
  uploadStatusBreakdown: { status: string; count: number }[]
  recentLogs: {
    id: string
    fileName: string
    fileSize: number
    status: string
    errorType: string | null
    errorMessage: string | null
    uploadDurationMs: number | null
    createdAt: string
  }[]
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  trend,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  trend?: string
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
            {subtitle && (
              <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', iconColor)}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-[10px] text-green-600 font-medium">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
    started: { label: 'Started', className: 'bg-blue-100 text-blue-700' },
    duplicate_rejected: { label: 'Duplicate', className: 'bg-amber-100 text-amber-700' },
  }
  const c = config[status] || { label: status, className: 'bg-gray-100 text-gray-700' }

  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium', c.className)}>
      {c.label}
    </span>
  )
}

export function UploadAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState('week')

  const fetchAnalytics = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/files/analytics?period=${period}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Analytics fetch error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-400">Loading analytics...</span>
      </div>
    )
  }

  if (!data) return null

  const { summary } = data

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#4A90D9]" />
          <h3 className="text-sm font-semibold text-gray-900">Upload Analytics</h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={fetchAnalytics}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          title="Total Files"
          value={summary.totalFiles}
          subtitle={`${formatStorageSize(summary.totalStorageBytes)} stored`}
          icon={FileText}
          iconColor="bg-[#4A90D9]/10 text-[#4A90D9]"
        />
        <MetricCard
          title="Uploads"
          value={summary.totalUploads}
          subtitle={`${summary.successRate}% success rate`}
          icon={Upload}
          iconColor="bg-green-100 text-green-600"
          trend={summary.successRate >= 90 ? 'Healthy' : undefined}
        />
        <MetricCard
          title="Duplicates"
          value={summary.duplicateRejections}
          subtitle="Rejected by hash"
          icon={Copy}
          iconColor="bg-amber-100 text-amber-600"
        />
        <MetricCard
          title="Threats"
          value={summary.virusDetections}
          subtitle="Malware blocked"
          icon={ShieldAlert}
          iconColor="bg-red-100 text-red-600"
        />
      </div>

      {/* Success Rate Bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Upload Success Rate</span>
            <span className="text-xs font-bold text-gray-900">{summary.successRate}%</span>
          </div>
          <div className="space-y-1.5">
            <Progress value={summary.successRate} className="h-2" />
            <div className="flex items-center gap-4 text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {summary.successfulUploads} succeeded
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-500" />
                {summary.failedUploads} failed
              </span>
              <span className="flex items-center gap-1">
                <Copy className="w-3 h-3 text-amber-500" />
                {summary.duplicateRejections} duplicates
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metric */}
      {summary.avgUploadDurationMs !== null && summary.avgUploadDurationMs > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600">Avg Upload Time</span>
              <span className="text-xs font-bold text-gray-900 ml-auto">
                {summary.avgUploadDurationMs < 1000
                  ? `${Math.round(summary.avgUploadDurationMs)}ms`
                  : `${(summary.avgUploadDurationMs / 1000).toFixed(1)}s`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Breakdown */}
      {data.errorBreakdown.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-600">Error Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {data.errorBreakdown.map((err) => (
                <div key={err.type} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 truncate max-w-[200px]">
                    {err.type?.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-medium text-red-600">{err.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Upload Log */}
      {data.recentLogs.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-600">Recent Upload Log</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {data.recentLogs.slice(0, 20).map((log) => (
                <div key={log.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <StatusBadge status={log.status} />
                  <span className="text-[11px] text-gray-700 truncate flex-1">{log.fileName}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
