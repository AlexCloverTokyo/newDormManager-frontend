import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getDormList } from '@/api/dorms'
import { getOccupancy, getFeeRevenue, getAllEmployeesRaw } from '@/api/analytics'
import { usePageTitle } from '@/hooks/usePageTitle'

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[260px] text-gray-400">
      <BarChart3 className="h-10 w-10 mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

const PIE_COLORS = ['#f59e0b', '#60a5fa', '#34d399', '#f87171']

const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  japanese: '日本社員',
  chinese: '中国出張社員',
}

export default function AnalyticsPage() {
  usePageTitle('データ分析')
  const { data: occupancyData, isLoading: loadingOccupancy } = useQuery({
    queryKey: ['analytics/occupancy'],
    queryFn: getOccupancy,
  })

  const { data: revenueData, isLoading: loadingRevenue } = useQuery({
    queryKey: ['analytics/fee-revenue'],
    queryFn: getFeeRevenue,
  })

  const { data: dormsData, isLoading: loadingDorms } = useQuery({
    queryKey: ['dorms'],
    queryFn: () => getDormList(),
  })

  const { data: employeesRaw, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees/all'],
    queryFn: getAllEmployeesRaw,
  })

  const dormUtilData = useMemo(() => {
    if (!dormsData?.items) return []
    return dormsData.items.map((d) => ({
      name: d.name,
      rate:
        d.total_rooms != null && d.total_rooms > 0
          ? Math.round(((d.total_rooms - (d.vacant_count ?? 0)) / d.total_rooms) * 100)
          : 0,
    }))
  }, [dormsData])

  const employeeTypeData = useMemo(() => {
    if (!employeesRaw) return []
    const counts: Record<string, number> = {}
    for (const e of employeesRaw) {
      counts[e.employee_type] = (counts[e.employee_type] ?? 0) + 1
    }
    return Object.entries(counts).map(([type, count]) => ({
      name: EMPLOYEE_TYPE_LABELS[type] ?? type,
      value: count,
    }))
  }, [employeesRaw])

  const revenueMax = useMemo(() => {
    if (!revenueData) return 0
    return Math.max(...revenueData.map((d: { revenue: number }) => d.revenue), 0)
  }, [revenueData])

  const formatRevenue = (v: number) => {
    if (revenueMax >= 100000) return `¥${(v / 10000).toFixed(0)}万`
    if (revenueMax >= 1000) return `¥${(v / 1000).toFixed(0)}千`
    return `¥${v.toLocaleString()}`
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">データ分析</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ① 入居率推移 */}
        <Card className="rounded-lg border border-gray-300 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              入居率推移（直近6か月）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOccupancy ? (
              <Skeleton className="h-[260px]" />
            ) : !occupancyData?.length ? (
              <EmptyChart message="入居データがまだありません" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={occupancyData}>
                  <defs>
                    <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(v) => [`${v}%`, '入居率']} />
                  <Area
                    type="monotone"
                    dataKey="occupancy_rate"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorOccupancy)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ② 月次寮費収入 */}
        <Card className="rounded-lg border border-gray-300 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              月次寮費収入（直近6か月）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRevenue ? (
              <Skeleton className="h-[260px]" />
            ) : !revenueData?.length ? (
              <EmptyChart message="寮費データがまだありません" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(v) => formatRevenue(Number(v))}
                    tick={{ fontSize: 12 }}
                    width={70}
                  />
                  <Tooltip
                    formatter={(v) => [`¥${Number(v).toLocaleString()}`, '寮費収入']}
                  />
                  <Bar dataKey="revenue" fill="#4ade80" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ③ 寮別稼働率 */}
        <Card className="rounded-lg border border-gray-300 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              寮別稼働率（現在）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDorms ? (
              <Skeleton className="h-[260px]" />
            ) : !dormUtilData.length ? (
              <EmptyChart message="寮データがまだありません" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dormUtilData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v}%`, '稼働率']} />
                  <Bar dataKey="rate" fill="#a855f7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ④ 社員区分内訳 */}
        <Card className="rounded-lg border border-gray-300 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              社員区分内訳（在籍全員）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEmployees ? (
              <Skeleton className="h-[260px]" />
            ) : !employeeTypeData.length ? (
              <EmptyChart message="社員データがまだありません" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={employeeTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {employeeTypeData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v}名`, '']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
