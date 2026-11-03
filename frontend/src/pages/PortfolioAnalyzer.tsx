/**
 * Portfolio Analyzer — the account you actually hold, not one you typed in.
 *
 * The backtester answers "what would this allocation have done". This answers
 * "what am I holding, and is it any good": live weights from the broker, then
 * the same health, risk and crisis analysis run over them.
 *
 * The distinction the page has to keep making is that historical figures
 * describe *today's* holdings run over past prices, not the account's own
 * performance — the broker says what is held now, never when it was bought.
 * Stated plainly rather than left for the reader to assume the stronger claim.
 */
import { useState } from 'react'
import {
  analyseHoldings,
  type HoldingsAnalysis,
  type PriceSource,
} from '@/api/portfolio'
import { CrisisChart } from '@/components/portfolio/CrisisChart'
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
import { cn } from '@/lib/utils'
import { healthGradeTone } from '@/lib/portfolioRequest'

const inr = (v: number) =>
  `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
const pct = (v: number | null | undefined, dp = 2) =>
  v === null || v === undefined ? '-' : `${(v * 100).toFixed(dp)}%`
const num = (v: number | null | undefined, dp = 2) =>
  v === null || v === undefined ? '-' : v.toFixed(dp)

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'bad'
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div
          className={cn(
            'mt-1 text-2xl font-semibold tabular-nums',
            tone === 'good' && 'text-emerald-500',
            tone === 'bad' && 'text-rose-500'
          )}
        >
          {value}
        </div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )
}

export default function PortfolioAnalyzer() {
  const { apiKey } = useAuthStore()
  const [lookback, setLookback] = useState(365)
  const [source, setSource] = useState<PriceSource>('db')
  const [result, setResult] = useState<HoldingsAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!apiKey) {
      setError('未找到 API 密钥，请在 API 密钥页面生成。')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await analyseHoldings({
        apikey: apiKey,
        lookback_days: lookback,
        benchmark: 'NIFTY',
        source,
      })
      if (res.status !== 'success') throw new Error(res.message || 'analysis failed')
      setResult(res)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: unknown } }; message?: string }
      const msg = e.response?.data?.message ?? e.message ?? 'analysis failed'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const s = result?.summary
  const health = result?.analysis?.health
  const m = result?.analysis?.metrics

  return (
    <div className="container mx-auto space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">投资组合分析</h1>
          <p className="text-sm text-muted-foreground">
            分析实时持仓的集中度、联动性、回撤承受能力及其在历史危机中的表现。
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs">回溯天数</Label>
            <Input
              className="w-28"
              type="number"
              value={lookback}
              onChange={(e) => setLookback(Number(e.target.value))}
            />
          </div>
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
          <Button onClick={run} disabled={busy}>
            {busy ? '分析中…' : '分析持仓'}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-rose-500/40">
          <CardContent className="p-4 text-sm text-rose-500">{error}</CardContent>
        </Card>
      )}

      {result && s && (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            <Metric
              label="当前市值"
              value={inr(s.current)}
              sub={`${s.count} 项持仓`}
            />
            <Metric
              label="已投入"
              value={s.invested === null ? '-' : inr(s.invested)}
              sub={s.invested === null ? '交易商未提供均价' : undefined}
            />
            <Metric
              label="总盈亏"
              value={inr(s.pnl)}
              sub={
                s.pnl_pct === null
                  ? '计算百分比需要成本基础'
                  : `${s.pnl_pct.toFixed(2)}%`
              }
              tone={s.pnl >= 0 ? 'good' : 'bad'}
            />
            <Metric
              label="健康状况"
              value={health?.grade ? `${health.score}/100 (${health.grade})` : '-'}
              sub={health ? `${health.pillars.length} 个维度，显示计算公式` : undefined}
              tone={healthGradeTone(health?.grade)}
            />
            <Metric
              label="Effective Bets（有效独立持仓数）"
              value={
                result.analysis
                  ? String(result.analysis.structure.effective_bets)
                  : '-'
              }
              sub={`来自 ${s.count} 项持仓`}
            />
          </div>

          {s.has_cost_basis === false && (
            <Card className="border-amber-500/40">
              <CardContent className="p-4 text-sm">
                <span className="font-medium text-amber-500">无成本基础：</span>
                交易商返回的持仓没有均价，因此无法计算投入金额和收益百分比。基于当前价值的权重、集中度、联动性、健康状况与风险指标不受影响；显示的盈亏来自交易商。
              </CardContent>
            </Card>
          )}

          {result.skipped.length > 0 && (
            <Card className="border-amber-500/40">
              <CardContent className="p-4 text-sm">
                <span className="font-medium text-amber-500">未分析：</span>
                {result.skipped.join(', ')} 所在的交易所不受此工具估值支持。这些持仓列在下方，但不计入上方数据。
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">持仓</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left">交易品种</th>
                      <th className="p-3 text-right">权重</th>
                      <th className="p-3 text-right">数量</th>
                      <th className="p-3 text-right">均价</th>
                      <th className="p-3 text-right">实时</th>
                      <th className="p-3 text-right">已投入</th>
                      <th className="p-3 text-right">当前</th>
                      <th className="p-3 text-right">盈亏</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.holdings.map((h) => (
                      <tr key={`${h.symbol}-${h.exchange}`} className="border-b last:border-0">
                        <td className="p-3">
                          <div className="font-medium">{h.symbol}</div>
                          <div className="text-xs text-muted-foreground">
                            {h.exchange}
                            {h.product ? ` · ${h.product}` : ''}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-xs tabular-nums',
                              h.weight > 0.3
                                ? 'bg-amber-500/15 text-amber-500'
                                : 'text-muted-foreground'
                            )}
                          >
                            {pct(h.weight, 1)}
                          </span>
                        </td>
                        <td className="p-3 text-right tabular-nums">{h.quantity}</td>
                        <td className="p-3 text-right tabular-nums text-muted-foreground">
                          {h.average_price > 0 ? h.average_price.toFixed(2) : '-'}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {h.last_price.toFixed(2)}
                        </td>
                        <td className="p-3 text-right tabular-nums text-muted-foreground">
                          {h.invested > 0 ? inr(h.invested) : '-'}
                        </td>
                        <td className="p-3 text-right tabular-nums">{inr(h.current)}</td>
                        <td
                          className={cn(
                            'p-3 text-right tabular-nums',
                            h.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          )}
                        >
                          {inr(h.pnl)}
                          {h.pnl_pct !== null && (
                            <div className="text-xs">{h.pnl_pct.toFixed(2)}%</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {m && (
            <div className="grid gap-3 md:grid-cols-5">
              <Metric label="CAGR（年化复合增长率）" value={pct(m.cagr)} sub={`回溯 ${lookback} 天`} />
              <Metric label="Volatility（波动率）" value={pct(m.volatility)} />
              <Metric label="Sharpe（夏普比率）" value={num(m.sharpe)} />
              <Metric label="Max Drawdown（最大回撤）" value={pct(m.max_drawdown)} tone="bad" />
              <Metric label="Value at Risk（风险价值）" value={pct(m.value_at_risk)} />
            </div>
          )}

          {result.analysis?.asset_returns?.length ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">资产收益</CardTitle>
                <p className="text-sm text-muted-foreground">
                  按收盘价计算各持仓的独立收益。若历史数据不足以覆盖所选区间，显示暂无数据，不会将较短期限的收益冒充完整区间收益。
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="p-3 text-left">交易品种</th>
                        {(['1W', '1M', '3M', '1Y', '3Y', '5Y'] as const).map((w) => (
                          <th key={w} className="p-3 text-right">
                            {w}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.analysis.asset_returns.map((a) => (
                        <tr key={a.symbol} className="border-b last:border-0">
                          <td className="p-3 font-medium">{a.symbol}</td>
                          {(['1W', '1M', '3M', '1Y', '3Y', '5Y'] as const).map((w) => {
                            const v = a[w]
                            return (
                              <td key={w} className="p-1.5 text-right">
                                {v === null ? (
                                  <span className="text-xs text-muted-foreground">n/a</span>
                                ) : (
                                  <span
                                    className={cn(
                                      'inline-block w-full rounded px-2 py-1 text-right tabular-nums',
                                      v >= 0
                                        ? 'bg-emerald-500/15 text-emerald-400'
                                        : 'bg-rose-500/15 text-rose-400'
                                    )}
                                    style={{
                                      // Stronger colour for a bigger move, so the
                                      // eye lands on what actually moved.
                                      opacity: Math.min(1, 0.45 + Math.abs(v) * 1.2),
                                    }}
                                  >
                                    {v >= 0 ? '+' : ''}
                                    {(v * 100).toFixed(1)}%
                                  </span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {result.analysis?.correlation?.symbols?.length ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">资产相关性矩阵</CardTitle>
                <p className="text-sm text-muted-foreground">
                  展示回溯期内各资产的联动程度。走势高度一致的持仓，即使名称不同，也可能集中暴露于同一种风险。
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="border-separate border-spacing-0.5 text-xs">
                    <thead>
                      <tr>
                        <th className="p-2" />
                        {result.analysis.correlation.symbols.map((c) => (
                          <th key={c} className="p-2 font-medium text-muted-foreground">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.analysis.correlation.symbols.map((row, i) => (
                        <tr key={row}>
                          <td className="whitespace-nowrap p-2 font-medium text-muted-foreground">
                            {row}
                          </td>
                          {result.analysis?.correlation.symbols.map((col, j) => {
                            const v = result.analysis?.correlation.matrix[i]?.[j] ?? null
                            return (
                              <td
                                key={col}
                                title={
                                  v === null
                                    ? '重叠数据不足，无法计算'
                                    : `${row} vs ${col}: ${v.toFixed(2)}`
                                }
                                className="min-w-16 rounded p-2 text-center tabular-nums"
                                style={{
                                  background:
                                    v === null
                                      ? 'transparent'
                                      : `rgba(34,197,94,${Math.min(Math.abs(v), 1) * 0.7})`,
                                }}
                              >
                                {v === null ? '-' : v.toFixed(2)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {health && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">健康状况明细</CardTitle>
                <p className="text-sm text-muted-foreground">
                  每个评分维度均展示输入和公式，便于核对评分依据。
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {health.pillars.map((p) => (
                  <div key={p.key} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{p.label}</span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {p.score === null ? '未测量' : `${p.score}/100`}
                      </span>
                    </div>
                    {p.score !== null && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-muted">
                        <div
                          className={cn(
                            'h-full rounded',
                            p.score >= 70
                              ? 'bg-emerald-500'
                              : p.score >= 40
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                          )}
                          style={{ width: `${p.score}%` }}
                        />
                      </div>
                    )}
                    <p className="mt-2 text-sm">{p.comment}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{p.formula}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {result.analysis?.crisis?.periods?.length ? (
            <>
              {result.analysis.crisis.summary && (
                <div className="grid gap-3 md:grid-cols-3">
                  <Metric
                    label="涵盖的危机次数"
                    value={String(result.analysis.crisis.summary.count)}
                    sub={`在 ${lookback} 天回溯期内`}
                  />
                  <Metric
                    label="跑赢基准"
                    value={pct(result.analysis.crisis.summary.hit_rate, 0)}
                    sub="占上述期间的比例"
                    tone={
                      (result.analysis.crisis.summary.hit_rate ?? 0) >= 0.5
                        ? 'good'
                        : 'bad'
                    }
                  />
                  <Metric
                    label="最差危机表现"
                    value={pct(result.analysis.crisis.summary.worst)}
                    tone="bad"
                  />
                </div>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">历史危机期间</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    展示当前权重在历史危机中的表现及各危机的持续时间。这里只显示回溯期内的危机，可延长回溯期查看更多。
                  </p>
                </CardHeader>
                <CardContent>
                  <CrisisChart periods={result.analysis.crisis.periods} />
                </CardContent>
              </Card>
            </>
          ) : null}

          <p className="text-xs text-muted-foreground">{result.meta.basis}</p>
          {result.analysis_error && (
            <Card className="border-amber-500/40">
              <CardContent className="space-y-1 p-4 text-sm">
                <div>
                  <span className="font-medium text-amber-500">
                    Historical analysis unavailable:{' '}
                  </span>
                  {result.analysis_error}
                </div>
                {source === 'db' && (
                  <div className="text-xs text-muted-foreground">
                    A real account usually holds something nobody has ingested.
                    Switch the data source to <strong>交易商 API</strong> and run
                    again, slower and rate limited, but it covers every symbol you
                    own. The figures above do not depend on this and are unaffected.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
