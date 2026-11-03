/**
 * SIP Backtester results.
 *
 * Renders from the stored response rather than re-running: every panel is a
 * view of one simulation, so a re-fetch per tab could show two panels
 * disagreeing about the same SIP.
 *
 * The headline is deliberately written as a sentence a person can read out
 * loud. XIRR is the honest single number for a SIP, but "you put in X, it
 * became Y" is what people actually want first.
 */

import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { MonthlyReturnsHeatmap } from '@/components/portfolio/MonthlyReturnsHeatmap'
import { PortfolioLineChart } from '@/components/portfolio/PortfolioLineChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useSipBacktestStore } from '@/stores/sipBacktestStore'

const inr = (n: number | null | undefined, dp = 0) =>
  n === null || n === undefined
    ? '—'
    : `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: dp }).format(n)}`

const pct = (n: number | null | undefined, dp = 2) =>
  n === null || n === undefined ? '—' : `${(n * 100).toFixed(dp)}%`

const signedPct = (n: number | null | undefined, dp = 2) =>
  n === null || n === undefined ? '—' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(dp)}%`

const frequencyLabel = (value: string) =>
  ({ daily: '每日', weekly: '每周', monthly: '每月', quarterly: '每季度' })[value] ?? value

const chargeLabel = (value: string) =>
  ({ brokerage: '佣金', stt: 'STT（证券交易税）', tax: '税费', gst: 'GST（商品及服务税）',
    stamp_duty: '印花税', exchange_transaction_charges: '交易所交易费',
    transaction_charges: '交易费', sebi_charges: 'SEBI（证券监管）费用' })[value] ?? value.replace(/_/g, ' ')

/** Sessions to a readable duration. ~21 trading sessions to a month. */
const sessionsToText = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—'
  if (n < 21) return `${n} 个交易日`
  const months = Math.round(n / 21)
  if (months < 12) return `${months} 个月`
  const years = (months / 12).toFixed(1)
  return `${years} 年`
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'good' | 'bad' | 'plain'
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          'text-xl font-semibold tabular-nums',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-500',
          tone === 'bad' && 'text-rose-600 dark:text-rose-500'
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

export default function SipBacktesterResults() {
  const navigate = useNavigate()
  const result = useSipBacktestStore((s) => s.result)
  const request = useSipBacktestStore((s) => s.request)
  const [tab, setTab] = useState<'overview' | 'timing' | 'compare' | 'detail'>('overview')

  const valueSeries = useMemo(() => {
    if (!result) return []
    return [
      {
        name: '市值',
        color: '#10b981',
        data: result.curves.value,
      },
      {
        name: '已投入',
        color: '#94a3b8',
        data: result.curves.invested,
      },
      ...(result.benchmark?.curve
        ? [
            {
              name: `${result.benchmark.symbol} SIP`,
              color: '#6366f1',
              data: result.benchmark.curve,
            },
          ]
        : []),
    ]
  }, [result])

  if (!result || !request) {
    return (
      <div className="container mx-auto space-y-4 p-4">
        <h1 className="text-2xl font-bold tracking-tight">SIP（定投计划）回测</h1>
        <p className="text-sm text-muted-foreground">暂无结果，请先运行回测。</p>
        <Button onClick={() => navigate('/sip-backtester')}>设置定投</Button>
      </div>
    )
  }

  const h = result.headline
  const u = result.underwater
  const d = result.drawdown
  const gainPositive = (h.gain ?? 0) >= 0

  return (
    <div className="container mx-auto space-y-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {request.symbol} <span className="text-muted-foreground">{request.exchange}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            每次 {inr(request.amount)} · {frequencyLabel(result.request.frequency)} · {h.start} 至 {h.end}
            {request.step_up_percent ? ` · 每年递增 ${request.step_up_percent}%` : ''}
            {' · '}
            {result.request.source === 'db' ? 'Historify' : 'Broker API'}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/sip-backtester')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> 更改
        </Button>
      </div>

      {/* ── The sentence ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-lg leading-relaxed">
            累计投入 <span className="font-semibold">{inr(h.invested)}</span>，共定投{' '}
            <span className="font-semibold">{h.installments}</span> 期，期末价值为{' '}
            <span
              className={cn(
                'font-semibold',
                gainPositive
                  ? 'text-emerald-600 dark:text-emerald-500'
                  : 'text-rose-600 dark:text-rose-500'
              )}
            >
              {inr(h.final_value)}
            </span>{' '}
            ，为投入金额的 {h.multiple ? `${h.multiple.toFixed(2)} 倍` : '—'}。总投入的绝对收益率为{' '}
            <span className="font-semibold">{signedPct(h.absolute_return)}</span>，年化{' '}
            <span className="font-semibold">XIRR（扩展内部收益率）为 {pct(h.xirr)}</span>，持续{' '}
            {h.years?.toFixed(1)} 年。
          </p>
          {h.cost_advantage !== null && h.cost_advantage < 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              每次按固定金额买入，相比同期平均价格，持仓成本低{' '}
              <span className="font-medium text-emerald-600 dark:text-emerald-500">
                {Math.abs(h.cost_advantage * 100).toFixed(2)}%
              </span>{' '}
              ：平均持仓成本 {inr(h.average_cost, 2)}，同期均价{' '}
              {inr(h.average_price, 2)}。
            </p>
          )}
          {u.ever_underwater && (
            <p className="mt-1 text-sm text-muted-foreground">
              持仓价值低于投入金额的时间占{' '}
              <span className="font-medium">{pct(u.share_below, 0)}</span>，最长连续持续{' '}
              {sessionsToText(u.longest_streak_sessions)}，最大亏损幅度为{' '}
              {pct(u.worst_shortfall)}。
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Headline numbers ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 md:grid-cols-4 lg:grid-cols-9">
          <Stat
            label="XIRR（扩展内部收益率）"
            value={pct(h.xirr)}
            tone={(h.xirr ?? 0) >= 0 ? 'good' : 'bad'}
            hint="考虑现金流的年化收益率"
          />
          <Stat label="已投入" value={inr(h.invested)} />
          <Stat label="当前价值" value={inr(h.final_value)} />
          <Stat
            label="收益"
            value={inr(h.gain)}
            tone={gainPositive ? 'good' : 'bad'}
            hint="当前价值减去投入金额"
          />
          <Stat
            label="绝对收益率"
            value={signedPct(h.absolute_return)}
            tone={gainPositive ? 'good' : 'bad'}
            hint="相对于累计投入"
          />
          <Stat
            label="持仓股数"
            value={h.units ? h.units.toFixed(0) : '—'}
            hint={`平均成本 ${inr(h.average_cost, 2)}`}
          />
          <Stat
            label="未投入现金"
            value={inr(h.cash, 2)}
            hint="按整数股买入后的剩余资金"
          />
          <Stat
            label="最大回撤"
            value={pct(d.max_drawdown)}
            tone="bad"
            hint={
              d.recovered ? `经过 ${sessionsToText(d.recovery_sessions)} 恢复` : '尚未恢复'
            }
          />
          <Stat label="手续费" value={inr(h.charges)} hint="所有定投期的交易手续费" />
        </CardContent>
      </Card>

      {result.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <span className="font-medium">请检查数据。</span> {result.warnings.join(' ')}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b">
        {(
          [
            ['overview', '概览'],
            ['timing', '危机期间开始定投'],
            ['compare', '对比'],
            ['detail', '明细'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'px-3 py-2 text-sm transition-colors',
              tab === key
                ? 'border-b-2 border-primary font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">资产价值与投入金额</CardTitle>
            </CardHeader>
            <CardContent>
              <PortfolioLineChart series={valueSeries} height={340} format={(v) => inr(v)} />
              <p className="mt-2 text-xs text-muted-foreground">灰线表示累计投入金额。绿线低于灰线时，持仓市值低于投入成本。</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">逐年</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1 text-left">年份</th>
                      <th className="py-1 text-right">已投入</th>
                      <th className="py-1 text-right">价值</th>
                      <th className="py-1 text-right">收益</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {result.yearly.map((y) => (
                      <tr key={y.year} className="border-b last:border-0">
                        <td className="py-1">{y.year}</td>
                        <td className="py-1 text-right">{inr(y.invested_to_date)}</td>
                        <td className="py-1 text-right">{inr(y.value)}</td>
                        <td
                          className={cn(
                            'py-1 text-right',
                            (y.gain ?? 0) >= 0
                              ? 'text-emerald-600 dark:text-emerald-500'
                              : 'text-rose-600 dark:text-rose-500'
                          )}
                        >
                          {inr(y.gain)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">逐月</CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyReturnsHeatmap
                  years={result.monthly_heatmap.years}
                  columns={result.monthly_heatmap.columns}
                  values={result.monthly_heatmap.values}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  仅反映市场波动，已扣除当月投入金额，因此不只是展示存款变化。
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Timing ───────────────────────────────────────────────────── */}
      {tab === 'timing' && (
        <div className="space-y-4">
          {result.crisis && result.crisis.periods.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">如果在暴跌期间开始定投，结果会怎样？</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  在数据覆盖的{' '}
                  <span className="font-semibold">{result.crisis.summary.crises} 次危机</span>中，{' '}
                  <span className="font-semibold">在下跌开始时</span>开始定投优于等待危机结束的次数为{' '}
                  <span className="font-semibold">{result.crisis.summary.early_wins}</span> 次
                  {result.crisis.summary.median_advantage !== null && (
                    <>
                      ，XIRR（扩展内部收益率）优势的中位数为{' '}
                      <span className="font-semibold">
                        {signedPct(result.crisis.summary.median_advantage)}
                      </span>{' '}
                      
                    </>
                  )}
                  .
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-1 text-left">危机</th>
                        <th className="py-1 text-right">市场</th>
                        <th className="py-1 text-right">危机开始时投入</th>
                        <th className="py-1 text-right">等待危机结束</th>
                        <th className="py-1 text-right">差额</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {result.crisis.periods.map((c) => (
                        <tr key={c.key} className="border-b last:border-0">
                          <td className="py-1">
                            <div>{c.label}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {c.crisis_start} to {c.crisis_end}
                            </div>
                          </td>
                          <td
                            className={cn(
                              'py-1 text-right',
                              (c.market_move ?? 0) < 0 && 'text-rose-600 dark:text-rose-500'
                            )}
                          >
                            {signedPct(c.market_move, 1)}
                          </td>
                          <td className="py-1 text-right">
                            <div className="font-medium">{pct(c.started_into_it.xirr)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {inr(c.started_into_it.final_value)}
                            </div>
                          </td>
                          <td className="py-1 text-right">
                            <div className="font-medium">{pct(c.waited_for_the_end.xirr)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {inr(c.waited_for_the_end.final_value)}
                            </div>
                          </td>
                          <td
                            className={cn(
                              'py-1 text-right font-medium',
                              c.starting_early_won
                                ? 'text-emerald-600 dark:text-emerald-500'
                                : 'text-muted-foreground'
                            )}
                          >
                            {signedPct(c.xirr_advantage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  两种情形使用相同的每期投入和结束日期，仅开始时间不同。下跌期间开始定投会在下跌过程中买入较低价格的份额；等到恢复后开始则从第一期起按反弹后的价格买入。历史价格未完整覆盖的危机不计入比较。
                </p>
              </CardContent>
            </Card>
          )}

          {result.start_date_heatmap && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">开始定投的时间会影响结果吗？</CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyReturnsHeatmap
                  years={result.start_date_heatmap.rows}
                  columns={result.start_date_heatmap.columns}
                  values={result.start_date_heatmap.values}
                />
                <p className="mt-2 text-xs text-muted-foreground">展示每月开始定投并持有不同期限时的 XIRR（扩展内部收益率）。右侧各列差异缩小说明持有期足够长时，开始日期的影响减弱。</p>
              </CardContent>
            </Card>
          )}

          {result.rolling_xirr && result.rolling_xirr.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">比较历史上的所有区间，而不限于本次区间</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1 text-left">持有期限</th>
                      <th className="py-1 text-right">窗口</th>
                      <th className="py-1 text-right">最差</th>
                      <th className="py-1 text-right">中位数</th>
                      <th className="py-1 text-right">最佳</th>
                      <th className="py-1 text-right">盈利</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {result.rolling_xirr.map((r) => (
                      <tr key={r.years} className="border-b last:border-0">
                        <td className="py-1">
                          {r.years} 年
                        </td>
                        <td className="py-1 text-right">{r.windows}</td>
                        <td className="py-1 text-right text-rose-600 dark:text-rose-500">
                          {pct(r.worst)}
                        </td>
                        <td className="py-1 text-right font-medium">{pct(r.median)}</td>
                        <td className="py-1 text-right text-emerald-600 dark:text-emerald-500">
                          {pct(r.best)}
                        </td>
                        <td className="py-1 text-right">{pct(r.positive_share, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted-foreground">汇总 XIRR（扩展内部收益率）只是分布中的一个结果。最好与最差结果的差距反映了开始时间不同可能带来的收益差异。</p>
              </CardContent>
            </Card>
          )}

          {result.sip_date_heatmap && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">每月哪一天？</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {result.sip_date_heatmap.days.map((day, i) => {
                    const v = result.sip_date_heatmap!.values[i]
                    const best = day === result.sip_date_heatmap!.best_day
                    return (
                      <div
                        key={day}
                        className={cn(
                          'w-16 rounded border px-1 py-1 text-center text-xs tabular-nums',
                          best && 'border-emerald-500 bg-emerald-500/10'
                        )}
                      >
                        <div className="text-muted-foreground">{day}</div>
                        <div className="font-medium">{pct(v, 1)}</div>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  表现最好的是每月 {result.sip_date_heatmap.best_day} 日，最差的是{' '}
                  {result.sip_date_heatmap.worst_day} 日，相差{' '}
                  {pct(result.sip_date_heatmap.spread)}。差异通常较小，选择能坚持投入的日期比追求最佳日期更重要。
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Comparisons ──────────────────────────────────────────────── */}
      {tab === 'compare' && (
        <div className="space-y-4">
          {result.lumpsum && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">定投与一次性投入比较</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Stat label="定投价值" value={inr(result.lumpsum.sip_final_value)} />
                  <Stat label="一次性投入价值" value={inr(result.lumpsum.final_value)} />
                  <Stat
                    label="差额"
                    value={inr(Math.abs(result.lumpsum.difference ?? 0))}
                    tone={result.lumpsum.sip_won ? 'good' : 'bad'}
                    hint={result.lumpsum.sip_won ? '定投领先' : '一次性投入领先'}
                  />
                  <Stat label="一次性投入 XIRR（扩展内部收益率）" value={pct(result.lumpsum.xirr)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  将同样的总金额在 {result.lumpsum.entry_date} 以{' '}
                  {inr(result.lumpsum.entry_price, 2)} 一次性投入。在持续上涨的市场中，一次性投入通常表现更好，因为资金较早投入，复利时间更长。
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">更改定投频率会改善结果吗？</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-1 text-left">频率</th>
                    <th className="py-1 text-right">每期</th>
                    <th className="py-1 text-right">次数</th>
                    <th className="py-1 text-right">已投入</th>
                    <th className="py-1 text-right">价值</th>
                    <th className="py-1 text-right">XIRR（扩展内部收益率）</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {result.frequency_comparison.map((f) => (
                    <tr
                      key={f.frequency}
                      className={cn(
                        'border-b last:border-0',
                        f.frequency === result.request.frequency && 'bg-muted/50 font-medium'
                      )}
                    >
                      <td className="py-1 capitalize">{frequencyLabel(f.frequency)}</td>
                      <td className="py-1 text-right">{inr(f.amount_per_installment)}</td>
                      <td className="py-1 text-right">{f.installments}</td>
                      <td className="py-1 text-right">{inr(f.invested)}</td>
                      <td className="py-1 text-right">{inr(f.final_value)}</td>
                      <td className="py-1 text-right">{pct(f.xirr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">
                已调整各频率的每期金额，使每年投入总额大致相同，避免因投入本金不同而影响比较。
              </p>
            </CardContent>
          </Card>

          {result.charges && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">费用支出</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Stat label="手续费合计" value={inr(result.charges.total)} />
                  <Stat label="每期手续费" value={inr(result.charges.per_installment, 2)} />
                  <Stat
                    label="费用占比"
                    value={pct(result.charges.drag)}
                    hint="占总投入金额的比例"
                  />
                  <Stat
                    label="费用模型"
                    value={result.charges.exchange}
                    hint={result.charges.model.replace('_', ' ')}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.charges.breakdown)
                    .filter(([k, v]) => k !== 'total' && v > 0)
                    .map(([k, v]) => (
                      <div key={k} className="rounded border px-2 py-1 text-xs">
                        <span className="text-muted-foreground">{chargeLabel(k)}</span>{' '}
                        <span className="font-medium tabular-nums">{inr(v, 2)}</span>
                      </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  每次投入都会产生费用，因此费用随投入频率增加。费用会减少实际买入份额，而非另行扣除；相同年投入金额下，较高频率的定投可能产生更多费用。
                </p>
              </CardContent>
            </Card>
          )}

          {result.benchmark && !result.benchmark.error && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  与定投 {result.benchmark.symbol} 对比
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Stat label={`${request.symbol} XIRR（扩展内部收益率）`} value={pct(h.xirr)} />
                <Stat
                  label={`${result.benchmark.symbol} XIRR（扩展内部收益率）`}
                  value={pct(result.benchmark.xirr)}
                />
                <Stat
                  label="超额收益率"
                  value={signedPct(result.benchmark.excess_xirr)}
                  tone={result.benchmark.beat_benchmark ? 'good' : 'bad'}
                />
                <Stat
                  label={`${result.benchmark.symbol} 市值`}
                  value={inr(result.benchmark.headline?.final_value)}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Detail ───────────────────────────────────────────────────── */}
      {tab === 'detail' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">每期投入</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1 text-left">#</th>
                  <th className="py-1 text-left">已计划</th>
                  <th className="py-1 text-left">已执行</th>
                  <th className="py-1 text-right">金额</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {result.installments.map((i, n) => (
                  <tr key={`${i.executed}-${n}`} className="border-b last:border-0">
                    <td className="py-1">{n + 1}</td>
                    <td className="py-1">{i.requested}</td>
                    <td
                      className={cn(
                        'py-1',
                        i.requested !== i.executed && 'text-amber-600 dark:text-amber-500'
                      )}
                    >
                      {i.executed}
                    </td>
                    <td className="py-1 text-right">{inr(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">标出的日期因计划日恰逢节假日或周末而顺延，模拟交易商的实际处理方式。</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
