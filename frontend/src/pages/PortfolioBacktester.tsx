/**
 * Portfolio Backtester — build a weighted portfolio, backtest it, read the result.
 *
 * Every tab renders from one response: they are all views of a single
 * simulation, so re-fetching per tab would risk two tabs disagreeing about
 * the same portfolio.
 */
import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  type PortfolioHolding,
  type PriceSource,
  type RebalanceRule,
  downloadTearsheet,
  listBenchmarks,
  runPortfolioBacktest,
} from '@/api/portfolio'
import { ChargeControls } from '@/components/portfolio/ChargeControls'
import { SymbolSearchInput } from '@/components/portfolio/SymbolSearchInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/stores/authStore'
import { usePortfolioBacktestStore } from '@/stores/portfolioBacktestStore'
import { cn } from '@/lib/utils'
import { DEFAULT_CHARGES, buildPortfolioRequest, type ChargeState } from '@/lib/portfolioRequest'

const REBALANCE: { value: RebalanceRule; label: string; note: string }[] = [
  { value: 'never', label: '从不', note: '买入并持有' },
  { value: 'monthly', label: '每月', note: '每年 12 次' },
  { value: 'quarterly', label: '每季度', note: '每年 4 次' },
  { value: 'yearly', label: '每年', note: '每年 1 次' },
]

function todayISO(offsetYears = 0): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - offsetYears)
  return d.toISOString().slice(0, 10)
}

export default function PortfolioBacktester() {
  const navigate = useNavigate()
  const { apiKey } = useAuthStore()
  const setBacktestResult = usePortfolioBacktestStore((s) => s.setResult)
  const startDateId = useId()
  const endDateId = useId()
  const sourceId = useId()
  const riskFreeId = useId()

  const [holdings, setHoldings] = useState<PortfolioHolding[]>([
    { symbol: 'NIFTYBEES', exchange: 'NSE', weight: 60 },
    { symbol: 'GOLDBEES', exchange: 'NSE', weight: 40 },
  ])
  const [benchmark, setBenchmark] = useState('NIFTY')
  const [rebalance, setRebalance] = useState<RebalanceRule>('never')
  const [source, setSource] = useState<PriceSource>('api')
  const [startDate, setStartDate] = useState(todayISO(5))
  const [endDate, setEndDate] = useState(todayISO(0))
  const [charges, setCharges] = useState<ChargeState>(DEFAULT_CHARGES)
  const [costExchange, setCostExchange] = useState<'NSE' | 'BSE'>('NSE')
  const [riskFree, setRiskFree] = useState(0)

  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Read from the instrument master rather than hardcoded: which indices
  // exist depends on which broker's master contract was downloaded.
  const { data: benchmarks = [] } = useQuery({
    queryKey: ['portfolio', 'benchmarks'],
    queryFn: () => listBenchmarks(apiKey ?? ''),
    enabled: !!apiKey,
    staleTime: 5 * 60_000,
  })

  const totalWeight = useMemo(
    () => holdings.reduce((s, h) => s + (Number(h.weight) || 0), 0),
    [holdings]
  )

  const setHolding = (i: number, patch: Partial<PortfolioHolding>) =>
    setHoldings((prev) => prev.map((h, n) => (n === i ? { ...h, ...patch } : h)))

  // Editing one weight by hand rescales every other row proportionally, so
  // the total stays at 100 instead of drifting past it one field at a time.
  const setWeight = (i: number, raw: number) =>
    setHoldings((prev) => {
      const newWeight = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0))
      const remaining = 100 - newWeight
      const othersSum = prev.reduce(
        (s, h, n) => (n === i ? s : s + (Number(h.weight) || 0)),
        0
      )
      const otherCount = prev.length - 1
      return prev.map((h, n) => {
        if (n === i) return { ...h, weight: newWeight }
        const w = Number(h.weight) || 0
        const scaled =
          othersSum > 0
            ? (w * remaining) / othersSum
            : otherCount > 0
              ? remaining / otherCount
              : 0
        return { ...h, weight: Number(scaled.toFixed(2)) }
      })
    })

  // New stock takes an equal share; the existing holdings shrink
  // proportionally to make room, so the total stays at 100 instead of
  // just growing by whatever the new row is given.
  const addHolding = () =>
    setHoldings((prev) => {
      const newWeight = Number((100 / (prev.length + 1)).toFixed(2))
      const remaining = 100 - newWeight
      const existingSum = prev.reduce((s, h) => s + (Number(h.weight) || 0), 0)
      const scaled = prev.map((h) => ({
        ...h,
        weight:
          existingSum > 0
            ? Number(((Number(h.weight) || 0) * (remaining / existingSum)).toFixed(2))
            : Number((remaining / prev.length).toFixed(2)),
      }))
      return [...scaled, { symbol: '', exchange: 'NSE', weight: newWeight }]
    })

  const distributeEqually = () =>
    setHoldings((prev) =>
      prev.map((h) => ({ ...h, weight: Number((100 / prev.length).toFixed(2)) }))
    )

  const buildRequest = () =>
    buildPortfolioRequest({
      apiKey: apiKey ?? '',
      holdings,
      startDate,
      endDate,
      benchmark: benchmark === 'none' ? null : benchmark,
      benchmarkExchange:
        benchmarks.find((item) => item.symbol === benchmark)?.exchange ?? 'NSE_INDEX',
      rebalance,
      source,
      charges,
      costExchange,
      riskFree,
    })

  const exportTearsheet = async () => {
    if (!apiKey) {
      setError('未找到 API 密钥，请在 API 密钥页面生成。')
      return
    }
    setExporting(true)
    setError(null)
    try {
      await downloadTearsheet(buildRequest())
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message ?? 'tearsheet export failed')
    } finally {
      setExporting(false)
    }
  }

  const analyse = async () => {
    if (!apiKey) {
      setError('未找到 API 密钥，请在 API 密钥页面生成。')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const req = buildRequest()
      const res = await runPortfolioBacktest(req)
      if (res.status !== 'success') throw new Error(res.message || '回测失败')
      setBacktestResult(res, req)
      navigate('/portfolio-backtester/results')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: unknown } }; message?: string }
      const msg = e.response?.data?.message ?? e.message ?? '回测失败'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container mx-auto space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">投资组合回测</h1>
        <p className="text-sm text-muted-foreground">
          创建投资组合、设置权重并选择基准，查看组合的历史表现。回测会考虑交易成本和再平衡。
        </p>
      </div>

      {/* ── Builder ─────────────────────────────────────────────────── */}
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
              仅使用交易商合约主表中的指数作为基准；以单只股票计算 Alpha 和 Beta 缺乏意义。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">再平衡</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select
              value={rebalance}
              onValueChange={(v) => setRebalance(v as RebalanceRule)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REBALANCE.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label} <span className="text-muted-foreground">{r.note}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              再平衡并非越频繁越好，换仓会产生交易成本。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">分析区间</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor={startDateId} className="text-xs">
                开始日期
              </Label>
              <Input
                id={startDateId}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={endDateId} className="text-xs">
                结束日期
              </Label>
              <Input
                id={endDateId}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {/* Left: holdings and run controls */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">组合持仓</CardTitle>
              <p className="text-sm text-muted-foreground">
                NSE 和 BSE 现货股票及 ETF。
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addHolding}>
                添加股票
              </Button>
              <Button variant="outline" size="sm" onClick={distributeEqually}>
                平均分配权重
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {holdings.map((h, i) => (
              <div key={`row-${i}-${h.symbol}`} className="flex items-center gap-2">
                <SymbolSearchInput
                  className="w-56"
                  value={h.symbol}
                  exchange={h.exchange as 'NSE' | 'BSE'}
                  onSelect={(sym) => setHolding(i, { symbol: sym })}
                />
                <Select
                  value={h.exchange}
                  onValueChange={(v) => setHolding(i, { exchange: v })}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NSE">NSE</SelectItem>
                    <SelectItem value="BSE">BSE</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="w-20"
                  type="number"
                  value={h.weight}
                  onChange={(e) => setWeight(i, Number(e.target.value))}
                />
                <span className="text-xs text-muted-foreground">%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={holdings.length <= 1}
                  onClick={() => setHoldings((p) => p.filter((_, n) => n !== i))}
                >
                  移除
                </Button>
              </div>
            ))}

            <div className="flex flex-wrap items-end gap-4 border-t pt-3">
              <div>
                <Label htmlFor={sourceId} className="text-xs">
                  数据来源
                </Label>
                <Select value={source} onValueChange={(v) => setSource(v as PriceSource)}>
                  <SelectTrigger id={sourceId} className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="db">Historify（本地）</SelectItem>
                    <SelectItem value="api">交易商 API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={riskFreeId} className="text-xs">
                  无风险利率（%）
                </Label>
                <Input
                  id={riskFreeId}
                  className="w-28"
                  type="number"
                  step="0.1"
                  value={riskFree}
                  onChange={(e) => setRiskFree(Number(e.target.value))}
                />
              </div>
              <div className="ml-auto flex items-center gap-3">
                <span
                  className={cn(
                    'text-sm tabular-nums',
                    Math.abs(totalWeight - 100) < 0.01
                      ? 'text-emerald-500'
                      : 'text-muted-foreground'
                  )}
                >
                  权重合计 {totalWeight.toFixed(1)}%
                </span>
                <Button
                  variant="outline"
                  onClick={exportTearsheet}
                  disabled={exporting || busy}
                  title="导出完整的 openstatz 分析报告（独立 HTML 文件）"
                >
                  {exporting ? '生成中…' : '导出分析报告'}
                </Button>
                <Button onClick={analyse} disabled={busy}>
                  {busy ? '分析中…' : '分析投资组合'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              权重会自动归一化，因此合计不必恰好为 100。
            </p>
          </CardContent>
        </Card>

        {/* Right: every charge, editable */}
        <ChargeControls
          value={charges}
          onChange={setCharges}
          exchange={costExchange}
          onExchange={setCostExchange}
        />
      </div>

      {error && (
        <Card className="border-rose-500/40">
          <CardContent className="p-4 text-sm text-rose-500">{error}</CardContent>
        </Card>
      )}
    </div>
  )
}
