import { ArrowLeft, Clock, Pencil, Save, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { adminApi } from '@/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { MarketTiming, TodayTiming } from '@/types/admin'
import { showToast } from '@/utils/toast'

export default function MarketTimingsPage() {
  const [timings, setTimings] = useState<MarketTiming[]>([])
  const [todayTimings, setTodayTimings] = useState<TodayTiming[]>([])
  const [today, setToday] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Edit state
  const [editingExchange, setEditingExchange] = useState<string | null>(null)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Check timings state
  const [checkDate, setCheckDate] = useState('')
  const [checkTimings, setCheckTimings] = useState<TodayTiming[] | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time fetch of timings on mount; fetchTimings is recreated each render and adding it would re-run the fetch on every render
  useEffect(() => {
    fetchTimings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTimings = async () => {
    try {
      const response = await adminApi.getTimings()
      setTimings(response.data)
      setTodayTimings(response.today_timings)
      setToday(response.today)
    } catch (_error) {
      showToast.error('Failed to load market timings', 'admin')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (timing: MarketTiming) => {
    setEditingExchange(timing.exchange)
    setEditStartTime(timing.start_time)
    setEditEndTime(timing.end_time)
  }

  const handleSaveEdit = async (exchange: string) => {
    if (!editStartTime || !editEndTime) {
      showToast.error('Please enter both start and end times', 'admin')
      return
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(editStartTime) || !timeRegex.test(editEndTime)) {
      showToast.error('Invalid time format. Use HH:MM', 'admin')
      return
    }

    setIsSaving(true)
    try {
      const response = await adminApi.editTiming(exchange, {
        start_time: editStartTime,
        end_time: editEndTime,
      })

      if (response.status === 'success') {
        showToast.success(response.message || 'Timing updated successfully', 'admin')
        setEditingExchange(null)
        fetchTimings()
      } else {
        showToast.error(response.message || '更新交易时段失败', 'admin')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      showToast.error(err.response?.data?.message || '更新交易时段失败', 'admin')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCheckTimings = async () => {
    if (!checkDate) {
      showToast.error('Please select a date', 'admin')
      return
    }

    setIsChecking(true)
    try {
      const response = await adminApi.checkTimings(checkDate)
      setCheckTimings(response.timings)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      showToast.error(err.response?.data?.message || 'Failed to check timings', 'admin')
    } finally {
      setIsChecking(false)
    }
  }

  const getExchangeColor = (exchange: string) => {
    const colors: Record<string, string> = {
      NSE: 'bg-blue-500',
      BSE: 'bg-red-500',
      NFO: 'bg-green-500',
      BFO: 'bg-yellow-500',
      MCX: 'bg-purple-500',
      NCO: 'bg-emerald-500',
      CDS: 'bg-orange-500',
      BCD: 'bg-pink-500',
    }
    return colors[exchange] || 'bg-gray-500'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link to="/admin" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            交易时间
          </h1>
        </div>
        <p className="text-muted-foreground">配置各交易所的交易时段</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Default Timings */}
        <Card>
          <CardHeader>
            <CardTitle>默认交易时间</CardTitle>
            <CardDescription>配置各交易所的默认交易时段</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>交易所</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>结束时间</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timings.map((timing) => (
                    <TableRow key={timing.exchange}>
                      <TableCell>
                        <Badge className={`${getExchangeColor(timing.exchange)} text-white`}>
                          {timing.exchange}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {editingExchange === timing.exchange ? (
                          <Input
                            type="time"
                            value={editStartTime}
                            onChange={(e) => setEditStartTime(e.target.value)}
                            className="w-28 h-8"
                            aria-label={`Start time for ${timing.exchange}`}
                          />
                        ) : (
                          <span className="font-mono">{timing.start_time}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingExchange === timing.exchange ? (
                          <Input
                            type="time"
                            value={editEndTime}
                            onChange={(e) => setEditEndTime(e.target.value)}
                            className="w-28 h-8"
                            aria-label={`End time for ${timing.exchange}`}
                          />
                        ) : (
                          <span className="font-mono">{timing.end_time}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingExchange === timing.exchange ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleSaveEdit(timing.exchange)}
                              disabled={isSaving}
                              title="保存更改"
                              aria-label={`Save timing changes for ${timing.exchange}`}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditingExchange(null)}
                              title="取消编辑"
                              aria-label={`Cancel editing ${timing.exchange}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleEdit(timing)}
                            title="Edit timing"
                            aria-label={`Edit timing for ${timing.exchange}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Today's Timings & Date Check */}
        <div className="space-y-6">
          {/* Today's Timings */}
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Timings</CardTitle>
              <CardDescription>Actual market timings for {today}</CardDescription>
            </CardHeader>
            <CardContent>
              {todayTimings.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  Markets are closed today (Weekend/Holiday)
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTimings.map((timing) => (
                    <div
                      key={timing.exchange}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <Badge className={`${getExchangeColor(timing.exchange)} text-white`}>
                        {timing.exchange}
                      </Badge>
                      <span className="font-mono text-sm">
                        {timing.start_time} - {timing.end_time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Check Timings for Date */}
          <Card>
            <CardHeader>
              <CardTitle>查询指定日期的交易时间</CardTitle>
              <CardDescription>查询指定日期的市场交易时间</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={checkDate}
                  onChange={(e) => {
                    setCheckDate(e.target.value)
                    setCheckTimings(null)
                  }}
                  className="flex-1"
                />
                <Button onClick={handleCheckTimings} disabled={isChecking || !checkDate}>
                  <Search className="h-4 w-4 mr-2" />
                  {isChecking ? 'Checking...' : 'Check'}
                </Button>
              </div>

              {checkTimings !== null && (
                <div className="border-t pt-4">
                  {checkTimings.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      Markets are closed on {checkDate} (Weekend/Holiday)
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium mb-2">Timings for {checkDate}:</p>
                      {checkTimings.map((timing) => (
                        <div
                          key={timing.exchange}
                          className="flex items-center justify-between p-2 bg-muted rounded-md"
                        >
                          <Badge className={`${getExchangeColor(timing.exchange)} text-white`}>
                            {timing.exchange}
                          </Badge>
                          <span className="font-mono text-sm">
                            {timing.start_time} - {timing.end_time}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Info Section */}
      <Card>
        <CardHeader>
          <CardTitle>关于市场交易时间</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">股票市场（NSE、BSE）</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>盘前时段：09:00 - 09:15</li>
                <li>正常交易时段：09:15 - 15:30</li>
                <li>盘后时段：15:40 - 16:00</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">期货及期权市场（NFO、BFO）</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>正常交易时段：09:15 - 15:30</li>
                <li>与股票市场时间相同</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">外汇市场（CDS、BCD）</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>正常交易时段：09:00 - 17:00</li>
                <li>交易时间长于股票市场</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">商品市场（MCX）</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>正常交易时段：09:00 - 23:55</li>
                <li>交易持续至深夜</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
