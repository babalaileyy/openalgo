/**
 * SIP Backtester — set up a systematic investment plan and see what it would
 * actually have returned.
 *
 * The whole result comes from one response, as with the portfolio backtester:
 * every tab is a view of the same simulation, so fetching per tab would risk
 * two tabs disagreeing about the same SIP.
 */

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { listBenchmarks } from '@/api/portfolio'
import { type PriceSource, runSipBacktest, type SipFrequency } from '@/api/sip'
import { ChargeControls } from '@/components/portfolio/ChargeControls'
import { SymbolSearchInput } from '@/components/portfolio/SymbolSearchInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type ChargeState, DEFAULT_CHARGES } from '@/lib/portfolioRequest'
import { useAuthStore } from '@/stores/authStore'
import { useSipBacktestStore } from '@/stores/sipBacktestStore'

const FREQUENCIES: { value: SipFrequency; label: string; note: string }[] = [
  { value: 'weekly', label: '每周', note: '每年 52 次' },
  { value: 'fortnightly', label: '每两周', note: '每年 26 次' },
  { value: 'monthly', label: '每月', note: '每年 12 次' },
  { value: 'quarterly', label: '每季度', note: '每年 4 次' },
]

function todayISO(offsetYears = 0): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - offsetYears)
  return d.toISOString().slice(0, 10)
}

const inr = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)

export default function SipBacktester() {
  const navigate = useNavigate()
  const { apiKey } = useAuthStore()
  const setResult = useSipBacktestStore((s) => s.setResult)

  const [symbol, setSymbol] = useState('ICICIBANK')
  const [exchange, setExchange] = useState<'NSE' | 'BSE'>('NSE')
  const [amount, setAmount] = useState(10000)
  const [frequency, setFrequency] = useState<SipFrequency>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [stepUp, setStepUp] = useState(0)
  const [benchmark, setBenchmark] = useState('NIFTY')
  const [source, setSource] = useState<PriceSource>('api')
  const [startDate, setStartDate] = useState(todayISO(5))
  const [endDate, setEndDate] = useState(todayISO(0))
  const [charges, setCharges] = useState<ChargeState>(DEFAULT_CHARGES)
  const [costExchange, setCostExchange] = useState<'NSE' | 'BSE'>('NSE')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // From the instrument master rather than hardcoded: which indices exist
  // depends on which broker's master contract was downloaded.
  const { data: benchmarks = [] } = useQuery({
    queryKey: ['portfolio', 'benchmarks'],
    queryFn: () => listBenchmarks(apiKey ?? ''),
    enabled: !!apiKey,
    staleTime: 5 * 60_000,
  })

  // Only monthly and quarterly SIPs have a meaningful day of month; a weekly
  // SIP is defined by its interval, not a calendar date.
  const usesDayOfMonth = frequency === 'monthly' || frequency === 'quarterly'

  const perYear = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4 }[frequency]
  const yearlyOutlay = amount * perYear

  const run = async () => {
    if (!apiKey) {
      setError('未找到 API 密钥，请在 API 密钥页面生成。')
      return
    }
    if (!symbol.trim()) {
      setError('请选择要投资的交易品种。')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const req = {
        apikey: apiKey,
        symbol: symbol.trim().toUpperCase(),
        exchange,
        start_date: startDate,
        end_date: endDate,
        amount: Number(amount),
        frequency,
        day_of_month: usesDayOfMonth ? Number(dayOfMonth) : 1,
        step_up_percent: Number(stepUp),
        // The full statutory schedule, identical to the portfolio
        // backtester's mapping so the same trade costs the same in both.
        cost_model: 'indian_equity' as const,
        cost_exchange: costExchange,
        charges: {
          brokerage:
            charges.brokerageMode === 'flat'
              ? { flat: charges.brokerageFlat, rate: 0 }
              : {
                  flat: 0,
                  rate: charges.brokeragePct / 100,
                  cap: charges.brokerageCap,
                },
          stt: { rate: charges.stt / 100 },
          exchange_txn: { rate: charges.exchangeTxn / 100 },
          stamp_duty: { rate: charges.stampDuty / 100 },
          sebi: { rate: charges.sebiPerCrore / 1_00_00_000 },
        },
        gst_rate: charges.gst / 100,
        slippage: charges.slippage / 100,
        benchmark: benchmark === 'none' ? null : benchmark,
        benchmark_exchange: 'NSE_INDEX',
        source,
        include_grids: true,
      }
      const res = await runSipBacktest(req)
      if (res.status !== 'success') throw new Error('backtest failed')
      setResult(res, req)
      navigate('/sip-backtester/results')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: unknown } }; message?: string }
      const msg = e.response?.data?.message ?? e.message ?? 'backtest failed'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container mx-auto space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SIP（定投计划）回测</h1>
        <p className="text-sm text-muted-foreground">
          计算定期定额投资计划的历史收益。由于各期投入的持有时间不同，使用 XIRR（内部收益率）衡量，避免单独使用 CAGR 高估收益。
        </p>
      </div>

      {/* ── Row 1: benchmark, schedule, period ──────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">基准</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select value={benchmark} onValueChange={setBenchmark}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无</SelectItem>
                {benchmarks.map((b) => (
                  <SelectItem key={`${b.exchange}-${b.symbol}`} value={b.symbol}>
                    {b.symbol}{' '}
                    <span className="text-muted-foreground">
                      {b.exchange.replace('_INDEX', '')}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              基准指数使用相同的定投计划进行比较，而非直接与指数 CAGR 比较。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">定投计划</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select value={frequency} onValueChange={(v) => setFrequency(v as SipFrequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label} <span className="text-muted-foreground">{f.note}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">定投日期</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  disabled={!usesDayOfMonth}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">每年递增比例 %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={stepUp}
                  onChange={(e) => setStepUp(Number(e.target.value))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {usesDayOfMonth
                ? '只能选择每月 1 至 28 日，之后的日期并非每月都有。'
                : '此定投频率不使用每月定投日期。'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">分析区间</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">开始</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">结束</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              首次投入发生在开始日期；若当天不是交易日，则顺延至下一个交易日。
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: the SIP, with charges as a sidebar ───────────────── */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle>定期定额投资计划</CardTitle>
            <CardDescription>NSE 和 BSE 现货股票及 ETF。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">交易品种</Label>
                <SymbolSearchInput
                  className="w-56"
                  value={symbol}
                  exchange={exchange}
                  onSelect={(next: string) => setSymbol(next)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">交易所</Label>
                <Select value={exchange} onValueChange={(v) => setExchange(v as 'NSE' | 'BSE')}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NSE">NSE</SelectItem>
                    <SelectItem value="BSE">BSE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">每期投入金额（₹）</Label>
                <Input
                  className="w-40"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
              <div className="pb-2 text-sm text-muted-foreground">
                每年约 <span className="font-medium">₹{inr(yearlyOutlay)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4 border-t pt-3">
              <div>
                <Label className="text-xs">数据来源</Label>
                <Select value={source} onValueChange={(v) => setSource(v as PriceSource)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="db">Historify（本地）</SelectItem>
                    <SelectItem value="api">交易商 API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <Button onClick={run} disabled={busy}>
                  {busy ? '运行中…' : '运行定投回测'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {source === 'api'
                ? '交易商历史数据已按公司行为调整，需要有效的交易商会话。'
                : 'Historify 无需登录交易商，周末也可进行回测。'}
            </p>
          </CardContent>
        </Card>

        {/* Right: every charge, editable. Levied on each installment. */}
        <ChargeControls
          value={charges}
          onChange={setCharges}
          exchange={costExchange}
          onExchange={setCostExchange}
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
