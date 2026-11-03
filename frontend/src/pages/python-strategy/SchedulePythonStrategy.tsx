import { ArrowLeft, Calendar, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { pythonStrategyApi } from '@/api/python-strategy'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useStrategyExchanges } from '@/hooks/useStrategyExchanges'
import type { PythonStrategy } from '@/types/python-strategy'
import { CRYPTO_EXCHANGE_VALUE, SCHEDULE_DAYS } from '@/types/python-strategy'
import { showToast } from '@/utils/toast'
import { ALL_DAY_START, ALL_DAYS, RunAllDaySwitch } from './RunAllDaySwitch'

export default function SchedulePythonStrategy() {
  const { strategyId } = useParams<{ strategyId: string }>()
  const navigate = useNavigate()
  const [strategy, setStrategy] = useState<PythonStrategy | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exchange, setExchange] = useState<string>('NSE')
  const [startTime, setStartTime] = useState('09:15')
  const [stopTime, setStopTime] = useState('15:30')
  const [selectedDays, setSelectedDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri'])
  const [runAllDay, setRunAllDay] = useState(false)

  const { exchanges: brokerExchanges, getWindow } = useStrategyExchanges()
  const isCrypto = exchange === CRYPTO_EXCHANGE_VALUE
  const allDay = isCrypto && runAllDay
  const sessionWindow = getWindow(exchange)
  // The list is the broker's, but a strategy saved before it was may carry an
  // exchange outside it. Keep that one on offer, or the dropdown would show a
  // different exchange from the one the strategy really runs on.
  const exchanges =
    strategy?.exchange && !brokerExchanges.some((e) => e.value === strategy.exchange)
      ? [
          ...brokerExchanges,
          {
            value: strategy.exchange,
            label: strategy.exchange,
            description: null,
            start_time: null,
            end_time: null,
            window: null,
            is_24x7: strategy.exchange === CRYPTO_EXCHANGE_VALUE,
          },
        ]
      : brokerExchanges

  useEffect(() => {
    const fetchStrategy = async () => {
      if (!strategyId) return
      try {
        setLoading(true)
        const data = await pythonStrategyApi.getStrategy(strategyId)
        setStrategy(data)
        // Pre-fill with existing schedule (schedule is always enabled)
        if (data.exchange) setExchange(data.exchange)
        if (data.schedule_start_time) setStartTime(data.schedule_start_time)
        if (data.schedule_stop_time) setStopTime(data.schedule_stop_time)
        if (data.schedule_days?.length) setSelectedDays(data.schedule_days)
        // A crypto strategy saved with no stop time is one that runs 24/7.
        setRunAllDay(data.exchange === CRYPTO_EXCHANGE_VALUE && !data.schedule_stop_time)
      } catch (_error) {
        showToast.error('加载策略失败', 'pythonStrategy')
        navigate('/python')
      } finally {
        setLoading(false)
      }
    }
    fetchStrategy()
  }, [strategyId, navigate])

  const handleDayToggle = (day: string) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!strategyId) return
    // A 24/7 strategy has no times or days to check.
    if (!allDay) {
      if (selectedDays.length === 0) {
        showToast.error('请至少选择一天', 'pythonStrategy')
        return
      }
      if (!startTime) {
        showToast.error('请选择开始时间', 'pythonStrategy')
        return
      }
      if (!stopTime) {
        showToast.error('请选择停止时间', 'pythonStrategy')
        return
      }
      // Crypto only: Indian exchange schedules are validated as before.
      if (isCrypto && stopTime === startTime) {
        showToast.error(
          '停止时间不能与开始时间相同。若要持续运行，请开启全天候运行。',
          'pythonStrategy'
        )
        return
      }
    }

    try {
      setSaving(true)
      const response = await pythonStrategyApi.scheduleStrategy(strategyId, {
        start_time: allDay ? ALL_DAY_START : startTime,
        stop_time: allDay ? null : stopTime,
        days: allDay ? ALL_DAYS : selectedDays,
        exchange,
      })

      if (response.status === 'success') {
        showToast.success('定时设置已保存', 'pythonStrategy')
        navigate('/python')
      } else {
        showToast.error(response.message || '保存定时设置失败', 'pythonStrategy')
      }
    } catch (_error) {
      showToast.error('保存定时设置失败', 'pythonStrategy')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-2xl space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!strategy) {
    return null
  }

  if (strategy.status === 'running') {
    return (
      <div className="container mx-auto py-6 max-w-2xl space-y-6">
        <Button variant="ghost" asChild>
          <Link to="/python">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回 Python 策略
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              策略运行时无法修改定时设置，请先停止策略。
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link to="/python">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回 Python 策略
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">编辑定时设置</h1>
        <p className="text-muted-foreground">{strategy.name}</p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            定时设置
          </CardTitle>
          <CardDescription>
            设置策略自动启动和停止的时间（印度标准时间）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Exchange */}
            <div className="space-y-2">
              <Label htmlFor="exchange">交易所</Label>
              <select
                id="exchange"
                value={exchange}
                onChange={(e) => {
                  setExchange(e.target.value)
                  // Moving a strategy to CRYPTO offers it the full day by default.
                  if (e.target.value === CRYPTO_EXCHANGE_VALUE) setRunAllDay(true)
                }}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {exchanges.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {isCrypto
                  ? '加密货币全天候交易，可让策略持续运行或限制运行时段。'
                  : '交易所决定策略使用的节假日历和每日交易时段。特殊交易时段也可能允许周末运行，系统以交易日历为准。'}
              </p>
            </div>

            {isCrypto && <RunAllDaySwitch checked={runAllDay} onCheckedChange={setRunAllDay} />}

            {/* Times and days: a 24/7 strategy has neither. */}
            {!allDay && (
              <>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_time" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        开始时间（印度标准时间）
                      </Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stop_time" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        停止时间（印度标准时间）
                      </Label>
                      <Input
                        id="stop_time"
                        type="time"
                        value={stopTime}
                        onChange={(e) => setStopTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  {sessionWindow && !isCrypto && (
                    <p className="text-xs text-muted-foreground">
                      {exchange} 今日交易时间为 {sessionWindow.start} - {sessionWindow.stop}（印度标准时间）。策略将在设定的停止时间或收盘时间中较早的时刻停止。
                    </p>
                  )}
                </div>

                {/* Days Selection */}
                <div className="space-y-3">
                  <Label>运行日期</Label>
                  <div className="flex flex-wrap gap-2">
                    {SCHEDULE_DAYS.map((day) => (
                      <button
                        type="button"
                        key={day.value}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedDays.includes(day.value)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted'
                        }`}
                        onClick={() => handleDayToggle(day.value)}
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center ${
                            selectedDays.includes(day.value)
                              ? 'bg-primary-foreground border-primary-foreground'
                              : 'border-current'
                          }`}
                        >
                          {selectedDays.includes(day.value) && (
                            <svg
                              className="h-3 w-3 text-primary"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium">{{ mon: '周一', tue: '周二', wed: '周三', thu: '周四', fri: '周五', sat: '周六', sun: '周日' }[day.value]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Select */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri'])}
                  >
                    工作日
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDays(['sat', 'sun'])}
                  >
                    周末
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
                    }
                  >
                    每天
                  </Button>
                </div>
              </>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/python')}
              >
                取消
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? '保存中…' : '保存定时设置'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
