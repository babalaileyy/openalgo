/**
 * A backtest's equity curve, its drawdown and its trades, one tab at a time.
 *
 * Inline tabs rather than a stack, because the panel is narrow and each of the
 * three wants its full height: an equity curve squeezed into half of a small
 * box beside its drawdown was easy to miss entirely. The tab last chosen is
 * remembered in this browser, so a trader who reads drawdown first gets it
 * first on the next run.
 */

import { type ReactNode, useState } from 'react'
import type { BacktestOutcome } from '@/lib/trading/backtestRun'
import { cn } from '@/lib/utils'
import { momentText, moneyText, signedMoney, signedPercent } from '@/lib/trading/backtestFormat'
import { BacktestChart, type CurveKind, type CurvePoint, seriesFrom } from './BacktestChart'

type Tab = 'equity' | 'drawdown' | 'trades'

const TABS: { id: Tab; label: string }[] = [
  { id: 'equity', label: '权益' },
  { id: 'drawdown', label: '回撤' },
  { id: 'trades', label: '交易' },
]

const TAB_KEY = 'trading.panel.backtest.tab'

function storedTab(): Tab {
  try {
    const value = window.localStorage.getItem(TAB_KEY)
    return value === 'drawdown' || value === 'trades' ? value : 'equity'
  } catch {
    return 'equity'
  }
}

function rememberTab(tab: Tab): void {
  try {
    window.localStorage.setItem(TAB_KEY, tab)
  } catch {
    // Not remembered; the choice still applies now.
  }
}

interface Props {
  outcome: BacktestOutcome
  /** How the panel writes money, so the trades read as the figures above do. */
  money: (value: unknown) => string
}

export function BacktestResultTabs({ outcome, money }: Props) {
  const [tab, setTab] = useState<Tab>(storedTab)
  const points = (outcome.equity ?? []) as readonly CurvePoint[]
  const trades = outcome.trades ?? []
  const currency = outcome.contract?.currency ?? 'INR'
  const timeZone = outcome.instrument?.timezone ?? 'Asia/Kolkata'

  const choose = (next: Tab) => {
    setTab(next)
    rememberTab(next)
  }

  let body: ReactNode
  if (tab === 'trades') {
    body =
      trades.length === 0 ? (
        <Empty>本次回测没有交易。</Empty>
      ) : (
        <div className="max-h-60 overflow-y-auto rounded border border-border">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-1.5 py-1 text-left font-normal">方向</th>
                <th className="px-1.5 py-1 text-right font-normal">开仓价</th>
                <th className="px-1.5 py-1 text-right font-normal">平仓价</th>
                <th className="px-1.5 py-1 text-right font-normal">净盈亏</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {trades.map((t) => (
                <tr key={String(t.index)} className="border-t border-border">
                  <td className="px-1.5 py-1">{t.side === 'long' ? '多头' : t.side === 'short' ? '空头' : String(t.side)}</td>
                  <td className="px-1.5 py-1 text-right">{money(t.entryPrice)}</td>
                  <td className="px-1.5 py-1 text-right">
                    {t.isOpen ? '未平仓' : money(t.exitPrice)}
                  </td>
                  <td
                    className={cn(
                      'px-1.5 py-1 text-right',
                      Number(t.netProfit) >= 0 ? 'text-emerald-500' : 'text-destructive'
                    )}
                  >
                    {money(t.netProfit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  } else if (seriesFrom(points)[tab].length < 2) {
    body = (
      <Empty>
        {tab === 'equity'
          ? '本次回测的 K 线数量不足，无法绘制权益曲线。'
          : '本次回测的 K 线数量不足，无法绘制回撤曲线。'}
      </Empty>
    )
  } else {
    // Keyed by tab, so switching builds the chart afresh for the series shown.
    body = (
      <div className="flex flex-col gap-1">
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {headline(points, tab, currency, timeZone)}
        </p>
        <BacktestChart
          key={tab}
          points={points}
          show={tab}
          currency={currency}
          timeZone={timeZone}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div role="tablist" aria-label="回测结果" className="flex gap-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => choose(id)}
            className={cn(
              'h-6 rounded px-2 text-[11px] transition-colors',
              tab === id
                ? 'bg-accent font-medium text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            {label}
            {id === 'trades' && trades.length > 0 ? ` (${trades.length})` : ''}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {body}
      </div>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="flex h-24 items-center justify-center rounded border border-dashed border-border px-3 text-center text-[11px] text-muted-foreground">
      {children}
    </p>
  )
}

/**
 * One line over a curve, in words: where equity ended and how far it moved,
 * or how deep the worst drawdown went and when.
 */
export function headline(
  points: readonly CurvePoint[],
  show: CurveKind,
  currency: string,
  timeZone: string
): ReactNode {
  const series = seriesFrom(points)
  if (show === 'equity') {
    const first = series.equity[0]
    const last = series.equity[series.equity.length - 1]
    if (!first || !last) return null
    const change = last.value - first.value
    const pct = first.value !== 0 ? (change / first.value) * 100 : 0
    return (
      <>
        <span className="font-medium text-foreground">权益 {moneyText(last.value, currency)}</span>
        <span className={change >= 0 ? 'text-emerald-500' : 'text-destructive'}>
          {` ${signedMoney(change, currency)} (${signedPercent(pct)})`}
        </span>
        {`，初始权益 ${moneyText(first.value, currency)}`}
      </>
    )
  }
  let deepest: { time: number; value: number } | null = null
  for (const point of series.drawdown) if (!deepest || point.value < deepest.value) deepest = point
  if (!deepest || deepest.value >= 0) return '无回撤：权益未低于此前高点。'
  const at = deepest.time
  const pct = series.drawdownPercent.find((point) => point.time === at)?.value
  return (
    <>
      <span className="font-medium text-foreground">最大回撤 </span>
      <span className="text-destructive">
        {moneyText(deepest.value, currency)}
        {pct !== undefined ? ` (${signedPercent(pct)})` : ''}
      </span>
      {`，发生于 ${momentText(at, timeZone)}`}
    </>
  )
}
