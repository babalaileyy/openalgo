// pages/strategy/Detail.tsx
// One strategy: live state, configuration, and every order, fill and event it
// has produced.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  buildRoundTrips,
  closeLeg,
  type DerivedPosition,
  deleteStrategy,
  derivePositions,
  deriveTrades,
  fetchStrategyOrderbook,
  fetchStrategyPositions,
  fetchStrategyTradebook,
  getStrategy,
  killSwitch,
  LIVE_POLL_MS,
  listEvents,
  listOrders,
  listRuns,
  type RoundTrip,
  reconcileBrokerOrders,
  reconcileBrokerTrades,
  rotateWebhookToken,
  SAFETY_POLL_MS,
  type StrategyLiveState,
  type StrategyLiveStatus,
  setLiveEnabled,
  startRun,
  stopRun,
  strategyQueryKeys,
  unlockWebhook,
  useBrokerBook,
  useStrategyLive,
} from '@/api/strategy_module'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  defaultQtyMode,
  favorablePeakPoints,
  formatDuration,
  formatIst,
  formatLivePnl,
  formatPnl,
  formatPrice,
  isDerivativeExchange,
  type Leg,
  type LegState,
  type Order,
  pnlToneClass,
  type QtyMode,
  type ReconciledBrokerOrder,
  type ReconciledBrokerTrade,
  type RiskUnit,
  type Run,
  type RunMode,
  type Strategy,
  type StrategyEvent,
  type StrategyStatus,
  universeTabLabel,
} from '@/types/strategy_module'
import { showToast } from '@/utils/toast'

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function statusBadgeVariant(
  status: StrategyStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'running':
      return 'default'
    case 'paused':
      return 'secondary'
    case 'errored':
      return 'destructive'
    default:
      return 'outline'
  }
}

function orderStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'complete') return 'default'
  if (status === 'rejected') return 'destructive'
  if (status === 'cancelled') return 'outline'
  return 'secondary'
}

function brokerNumber(value: number | null, fractionDigits = 2): string {
  return value === null ? 'Unavailable' : value.toFixed(fractionDigits)
}

function severityClass(severity: string): string {
  if (severity === 'critical') return 'text-red-600'
  if (severity === 'warn') return 'text-amber-600'
  return 'text-muted-foreground'
}

function liveStatusBadge(status: StrategyLiveStatus): {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
} {
  switch (status) {
    case 'live':
      return { label: 'live', variant: 'default' }
    case 'connecting':
      return { label: 'connecting', variant: 'secondary' }
    // Named for what it is. The numbers are still correct, just slower, and
    // saying "live" while the socket is down is the failure this badge exists
    // to make visible.
    case 'polling':
      return { label: 'polling', variant: 'secondary' }
    case 'error':
      return { label: 'error', variant: 'destructive' }
    default:
      return { label: 'idle', variant: 'outline' }
  }
}

/** What the badge means, spelled out for the tooltip. */
function liveStatusHint(status: StrategyLiveStatus): string {
  switch (status) {
    case 'live':
      return 'Streaming from the strategy room on the shared connection.'
    case 'connecting':
      return 'Connected, waiting for the first snapshot.'
    case 'polling':
      return `Socket unavailable, so the checkpoint is being read every ${LIVE_POLL_MS / 1000}s instead. The numbers are current, just slower.`
    case 'error':
      return 'Could not subscribe to this strategy. The figures below may be stale.'
    default:
      return 'Not streaming: the strategy is not running.'
  }
}

function RiskRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
  bold,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad' | 'warn' | 'neutral'
  bold?: boolean
}) {
  return (
    <div className={cn('rounded-md p-3', bold ? 'border-2 bg-muted/40' : 'border bg-muted/30')}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 font-mono',
          bold ? 'text-xl font-bold' : 'text-lg font-semibold',
          tone === 'good' && 'text-green-600',
          tone === 'bad' && 'text-red-600',
          tone === 'warn' && 'text-amber-600'
        )}
      >
        {value}
      </p>
    </div>
  )
}

/**
 * A confirmation for an action that moves money or destroys history.
 *
 * Kept as its own component so the verb on the button is always the verb of the
 * action: "Stop run", "Close all", "KILL". A dialog whose button says OK makes
 * the operator reconstruct what they are agreeing to from the prose above it.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
            className={cn(destructive && 'min-w-[120px]')}
          >
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Live tab
// ---------------------------------------------------------------------------

/**
 * A leg's trailing stop, as three readings rather than one number: whether it
 * has armed, where it arms, and how far the leg has moved towards arming. The
 * middle number is the one an operator watches; the stop price alone does not
 * say whether it is going to move.
 */
function TrailCell({ leg, live }: { leg: Leg; live: LegState | undefined }) {
  const trailX = leg.trail?.x ?? 0
  const trailY = leg.trail?.y ?? 0
  if (!trailX || trailX <= 0) return <span className="text-muted-foreground">—</span>

  // The unit the leg is configured in. Printing "pts" on a percent leg
  // described a 2 percent stop as a two rupee one, so the label follows the
  // leg. The two numbers beside it then have to follow as well: `trail.x` is
  // stored in the leg's own unit, while `favorablePeakPoints` always returns
  // price points, so on a percent leg they are not the same quantity and
  // labelling both "%" would be its own lie.
  const percent = (leg.risk_unit ?? 'points') === 'percent'
  const unit = percent ? '%' : 'pts'

  const entry = live?.entry_avg ?? null
  const peakPts = live ? favorablePeakPoints(live) : 0
  const armed = Boolean(live?.trail_active)
  const effectiveSl = live?.effective_sl ?? null

  // A percent trail arms a percentage of entry away, not that many rupees.
  // Both the arming price and the progress toward it need converting, and
  // neither can be shown at all until a fill gives us an entry to measure
  // against, which is the same rule risk_adapter applies.
  const armDistance = percent ? (entry ? (entry * trailX) / 100 : null) : trailX
  const armPrice =
    entry && armDistance != null
      ? leg.position === 'B'
        ? entry + armDistance
        : entry - armDistance
      : null
  const peakShown = percent ? (entry ? (peakPts / entry) * 100 : null) : peakPts

  return (
    <div className="flex flex-col items-end gap-0.5 leading-tight">
      {armed ? (
        <>
          <span className="text-amber-600">
            trailing{effectiveSl != null && ` @ ${effectiveSl.toFixed(2)}`}
          </span>
          <span className="text-[10px] text-muted-foreground">peak +{peakPts.toFixed(2)} pts</span>
        </>
      ) : (
        <>
          {armPrice != null ? (
            <span className="text-muted-foreground">trails from {armPrice.toFixed(2)}</span>
          ) : (
            <span className="text-muted-foreground">等待触发移动止损</span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {peakShown != null ? peakShown.toFixed(2) : '—'} / {trailX} {unit}
            {trailY > 0 && ` · step ${trailY}`}
          </span>
        </>
      )}
    </div>
  )
}

function LiveTab({
  strategy,
  orders,
  live,
  lastRun,
  closingLegId,
  onCloseLeg,
}: {
  strategy: Strategy
  orders: Order[]
  live: StrategyLiveState
  /** The most recent run, so a stopped strategy still shows its last result. */
  lastRun: Run | null
  closingLegId: number | null
  onCloseLeg: (legId: number) => void
}) {
  const isRunning = strategy.status === 'running'
  const isStopped = strategy.status === 'stopped'

  // The REST fallback for a leg that has no live state yet. Scoped to the
  // current run: without that filter an exit from a previous run marks the leg
  // closed and the Close leg button stays disabled on a leg that is open.
  const currentRunOrders = strategy.current_run_id
    ? orders.filter(
        (order) =>
          order.run_id === strategy.current_run_id &&
          (order.kind === 'entry' || order.kind.startsWith('exit'))
      )
    : []
  const entryByLeg = new Map<number, Order>()
  const exitByLeg = new Map<number, Order>()
  for (const order of currentRunOrders) {
    if (order.kind === 'entry') {
      if (!entryByLeg.has(order.leg_id)) entryByLeg.set(order.leg_id, order)
    } else if (order.status !== 'rejected') {
      exitByLeg.set(order.leg_id, order)
    }
  }

  const liveByLegId = new Map<number, LegState>()
  for (const leg of live.legs) liveByLegId.set(Number(leg.leg_id), leg)

  const badge = liveStatusBadge(live.status)
  // A checkpoint is live authority only while the strategy is running. The
  // checkpoint endpoint deliberately keeps the last sample after stop, so a
  // stopped page can still retain the curve without presenting that sample as
  // the final result.
  const checkpoint = isStopped ? null : live.checkpoint

  // While a run is active the checkpoint is the truth. Once it stops, the run
  // row carries the finalised realized P&L, and unrealized is zero by
  // definition because nothing is open.
  const showLast = isStopped && lastRun != null
  const pnlRealized = showLast ? lastRun.pnl_realized : (checkpoint?.pnl_realized ?? null)
  const pnlUnrealized = showLast ? 0 : (checkpoint?.pnl_unrealized ?? null)
  const pnlTotal = showLast ? lastRun.pnl_realized : (checkpoint?.pnl_total ?? null)
  const pnlPeak = showLast ? lastRun.pnl_peak : (checkpoint?.pnl_peak ?? null)
  const pnlTrough = showLast ? lastRun.pnl_trough : (checkpoint?.pnl_trough ?? null)
  const formatCurrentPnl = showLast ? formatPnl : formatLivePnl

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Live P&amp;L</CardTitle>
            <CardDescription>
              {isRunning
                ? 'Realized + Unrealized = Total, streamed from the engine while the run is active.'
                : 'Last run — realized P&L from the most recent run; resets on the next Start.'}
            </CardDescription>
          </div>
          <Badge
            variant={badge.variant}
            className="text-[10px]"
            title={liveStatusHint(live.status)}
          >
            {badge.label}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Realized', value: pnlRealized },
              { label: 'Unrealized', value: pnlUnrealized },
              { label: 'Total P&L', value: pnlTotal },
            ].map((metric) => (
              <div key={metric.label} className="rounded-md border bg-muted/30 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {metric.label}
                </p>
                <p
                  className={cn(
                    'mt-1 font-mono text-2xl font-semibold',
                    pnlToneClass(metric.value)
                  )}
                >
                  {formatCurrentPnl(metric.value)}
                </p>
              </div>
            ))}
          </div>
          {(checkpoint || showLast) && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <span>
                峰值：<span className="font-mono">{formatCurrentPnl(pnlPeak)}</span>
              </span>
              <span>
                谷值：<span className="font-mono">{formatCurrentPnl(pnlTrough)}</span>
              </span>
              {checkpoint && (
                <span>
                  更新时间：<span className="font-mono">{formatIst(checkpoint.ts)}</span>
                </span>
              )}
              {showLast && lastRun?.stopped_at && (
                <span>
                  停止时间：<span className="font-mono">{formatIst(lastRun.stopped_at)}</span>
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>策略腿</CardTitle>
          <CardDescription>
            {isRunning
              ? 'Active run — LTP, MTM and effective SL from the engine.'
              : 'Run inactive — start the strategy to see live state here.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>交易品种</TableHead>
                  <TableHead>持仓</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">入场价</TableHead>
                  <TableHead className="text-right">最新成交价</TableHead>
                  <TableHead className="text-right">盯市盈亏</TableHead>
                  <TableHead className="text-right">有效止损</TableHead>
                  <TableHead className="text-right">有效止盈</TableHead>
                  <TableHead className="text-right">移动止损</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {strategy.legs.map((leg) => {
                  const legLive = isRunning ? liveByLegId.get(leg.id) : undefined
                  const entry = entryByLeg.get(leg.id)
                  const exit = exitByLeg.get(leg.id)
                  const isOpen = !!entry && entry.status !== 'rejected' && !exit
                  const state =
                    legLive?.status ??
                    (!entry
                      ? 'configured'
                      : entry.status === 'rejected'
                        ? 'rejected'
                        : exit
                          ? 'closed'
                          : 'open')
                  const symbol = legLive?.symbol ?? entry?.symbol ?? leg.symbol ?? '—'
                  // A resolved quantity is already the number of shares or
                  // contracts sent. Only the configured fallback still needs
                  // saying: leg.lots is a share count on a cash leg and a lot
                  // count on every other, and this column showed both as a
                  // bare number.
                  const resolvedQty = legLive?.qty ?? entry?.qty ?? leg.qty ?? null
                  const qty = resolvedQty ?? leg.lots ?? '—'
                  const qtyUnit =
                    resolvedQty != null || leg.lots == null
                      ? null
                      : leg.segment === 'cash'
                        ? 'shares'
                        : 'lots'
                  const mtm = legLive?.mtm

                  return (
                    <TableRow key={leg.id}>
                      <TableCell className="font-mono">{leg.id}</TableCell>
                      <TableCell className="font-mono text-xs">{symbol}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {legLive?.position ?? leg.position ?? leg.side ?? '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {qty}
                        {qtyUnit && (
                          <span className="ml-1 text-[10px] text-muted-foreground">{qtyUnit}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPrice(legLive?.entry_avg)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPrice(legLive?.ltp)}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono', pnlToneClass(mtm))}>
                        {formatLivePnl(mtm)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPrice(legLive?.effective_sl)}
                        {Boolean(legLive?.trail_active) && (
                          <span className="ml-1 text-[10px] text-amber-600">（移动止损）</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPrice(legLive?.effective_target)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <TrailCell leg={leg} live={legLive} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            state === 'open'
                              ? 'default'
                              : state === 'rejected'
                                ? 'destructive'
                                : 'outline'
                          }
                        >
                          {state}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isOpen || closingLegId === leg.id || !isRunning}
                          onClick={() => onCloseLeg(leg.id)}
                          title={
                            !isOpen
                              ? 'Leg is not open'
                              : !isRunning
                                ? 'Strategy not running'
                                : undefined
                          }
                        >
                          {closingLegId === leg.id ? 'Closing…' : 'Close leg'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Setup tab
// ---------------------------------------------------------------------------

/**
 * Which unit a signal leg's stored quantity is in.
 *
 * Mirrors the validator's venue default, so a leg saved before the mode
 * existed still reads correctly rather than defaulting everything to units.
 */
function qtyModeFor(leg: Leg): QtyMode {
  if (!isDerivativeExchange(leg.exchange)) return 'units'
  return leg.qty_mode ?? defaultQtyMode(leg.exchange)
}

function SetupTab({ strategy }: { strategy: Strategy }) {
  const navigate = useNavigate()
  const isStopped = strategy.status !== 'running'
  const isSignal = strategy.strategy_kind === 'signal'
  const scheduler = strategy.scheduler

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>策略配置</CardTitle>
            <CardDescription>显示上次保存的完整配置。停止后可编辑。</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!isStopped}
            title={!isStopped ? `策略处于 ${strategy.status} 状态时无法编辑` : undefined}
            onClick={() => navigate(`/strategy/${strategy.id}/edit`)}
          >
            编辑
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <RiskRow label="名称" value={strategy.name} />
          <RiskRow label="策略类别" value={strategy.strategy_kind} />
          <RiskRow label="交易范围" value={universeTabLabel(strategy.universe_tab)} />
          <RiskRow
            label="标的"
            value={`${strategy.underlying} (${strategy.underlying_exchange})`}
          />
          <RiskRow label="类型" value={strategy.strategy_type} />
          {strategy.strategy_type === 'intraday' && (
            <>
              <RiskRow label="入场时间" value={strategy.entry_time ?? '—'} />
              <RiskRow label="退出时间" value={strategy.exit_time ?? '—'} />
            </>
          )}
          <RiskRow label="产品类型" value={strategy.product} />
          <RiskRow label="价格类型" value={strategy.pricetype} />
          <RiskRow
            label="每日亏损上限"
            value={
              strategy.daily_loss_limit_inr != null
                ? `₹${strategy.daily_loss_limit_inr.toFixed(2)}`
                : 'off'
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>策略腿</CardTitle>
          <CardDescription>
            {strategy.legs.length} leg{strategy.legs.length === 1 ? '' : 's'} configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {isSignal ? (
              // A signal leg names its own instrument and quantity, so it gets
              // its own columns rather than blanks under the batch ones.
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">交易品种</th>
                    <th className="px-2 py-1 text-left">交易所</th>
                    <th className="px-2 py-1 text-left">市场分段</th>
                    <th className="px-2 py-1 text-left">方向</th>
                    <th className="px-2 py-1 text-right">数量</th>
                    <th className="px-2 py-1 text-left">到期日</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.legs.map((leg) => (
                    <tr key={leg.id} className="border-t">
                      <td className="px-2 py-1.5 font-mono">{leg.id}</td>
                      <td className="px-2 py-1.5 font-mono">{leg.symbol ?? '—'}</td>
                      <td className="px-2 py-1.5 font-mono">{leg.exchange ?? '—'}</td>
                      <td className="px-2 py-1.5">{leg.segment}</td>
                      <td className="px-2 py-1.5">
                        <Badge variant="outline" className="text-xs">
                          {leg.side ?? 'both'}
                        </Badge>
                      </td>
                      {/* A bare 5 reads as five shares. It is five lots on a
                          derivative, so the unit travels with the number. */}
                      <td className="px-2 py-1.5 text-right font-mono">
                        {leg.qty ?? '—'}
                        {leg.qty != null && (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {qtyModeFor(leg) === 'lots'
                              ? leg.qty === 1
                                ? 'lot'
                                : 'lots'
                              : leg.segment === 'cash'
                                ? 'shares'
                                : 'units'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {leg.segment === 'futures' ? (leg.expiry ?? '—') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">市场分段</th>
                    <th className="px-2 py-1 text-left">交易品种</th>
                    <th className="px-2 py-1 text-left">持仓</th>
                    <th className="px-2 py-1 text-right">数量</th>
                    <th className="px-2 py-1 text-left">到期日</th>
                    <th className="px-2 py-1 text-left">类型</th>
                    <th className="px-2 py-1 text-left">行权价</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.legs.map((leg) => {
                    const strikeText =
                      leg.segment !== 'options'
                        ? '—'
                        : leg.strike_mode === 'strike'
                          ? leg.strike != null
                            ? `${leg.strike}`
                            : '—'
                          : `ATM (${leg.atm_offset ?? 'ATM'})`
                    return (
                      <tr key={leg.id} className="border-t">
                        <td className="px-2 py-1.5 font-mono">{leg.id}</td>
                        <td className="px-2 py-1.5">{leg.segment}</td>
                        <td className="px-2 py-1.5 font-mono text-xs">
                          {/* A batch leg has no instrument of its own: it
                              resolves against the strategy's underlying, and a
                              cash leg trades that underlying directly. Naming
                              it here is what tells an operator which stock a
                              cash leg will actually buy. */}
                          {leg.segment === 'cash'
                            ? `${strategy.underlying} · ${strategy.underlying_exchange}`
                            : strategy.underlying}
                        </td>
                        <td className="px-2 py-1.5">
                          <Badge variant="outline" className="text-xs">
                            {leg.position ?? '—'}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          {leg.lots ?? '—'}
                          {leg.lots != null && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              {leg.segment === 'cash' ? 'shares' : 'lots'}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">{leg.expiry ?? '—'}</td>
                        <td className="px-2 py-1.5">{leg.option_type ?? '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{strikeText}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>定时任务</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scheduler?.enabled ? (
            <>
              <RiskRow label="已启用" value="yes" />
              <RiskRow label="交易日" value={scheduler.days.join(', ')} />
              <RiskRow label="开始时间（印度时间）" value={scheduler.start_time ?? '—'} />
              <RiskRow label="自动停止时间（印度时间）" value={scheduler.auto_stop_time ?? '—'} />
              <RiskRow label="默认模式" value={scheduler.default_mode} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              定时任务已关闭，仍可手动或通过 Webhook 启动策略。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Positions tab
// ---------------------------------------------------------------------------

function brokerBookRunId(
  strategy: Strategy,
  live: StrategyLiveState,
  latestFinalizedRunId: number | null = null
): number | null {
  // A newly started run can be present in the strategy row before the first
  // socket/checkpoint frame replaces the prior run. While running, the store's
  // current owner wins so an old frame can never label the new broker book.
  if (strategy.status === 'running' && strategy.current_run_id !== null) {
    return strategy.current_run_id
  }
  // A stopped strategy has no current_run_id. Its newest durable run row is
  // authoritative over a socket/checkpoint value retained from before stop.
  if (strategy.status === 'stopped' && latestFinalizedRunId !== null) {
    return latestFinalizedRunId
  }
  return live.runId ?? strategy.current_run_id
}

export function PositionsTab({
  strategy,
  orders,
  live,
  runs,
  loading,
  active,
}: {
  strategy: Strategy
  orders: Order[]
  live: StrategyLiveState
  runs: Run[]
  loading: boolean
  active: boolean
}) {
  const stoppedRun = strategy.status === 'stopped' ? (runs[0] ?? null) : null
  // Once stopped, the finalized run row outranks a checkpoint/frame that may
  // still name the just-finished run (or an even older one during refetch).
  const runId = brokerBookRunId(strategy, live, stoppedRun?.id ?? null)
  // Orders stay lifetime-scoped on purpose: they retain a residual position
  // stranded by an earlier run and the realized-lifetime column. Runtime legs
  // are different—they are a mark frame owned by one exact run, so a stale
  // frame must never value the authoritative run's local fallback.
  const derived = useMemo(
    () => derivePositions(orders, strategy.product, live.runId === runId ? live.legs : []),
    [orders, strategy.product, live.runId, live.legs, runId]
  )
  const broker = useBrokerBook(
    strategy.id,
    runId,
    'positions',
    fetchStrategyPositions,
    strategy.status === 'running',
    active
  )

  // The broker's own position book when it answered, the derived view when it
  // did not. The order rows record what the engine asked for; the broker knows
  // what happened to it, and a fill or cancellation whose update never arrived
  // leaves the local rows wrong. Realized-lifetime stays derived either way: a
  // broker position row carries no history, and that column is strategy
  // attribution rather than broker truth.
  const positions = useMemo<
    (Omit<DerivedPosition, 'net_qty' | 'side'> & {
      net_qty: number | null
      side: DerivedPosition['side'] | null
      source: 'broker' | 'broker/shared' | 'local/unreconciled'
      position_ref?: string | null
    })[]
  >(() => {
    if (!broker.rows) {
      return derived.map((row) => ({ ...row, source: 'local/unreconciled' as const }))
    }
    const realizedFor = new Map(
      derived.map((row) => [
        `${row.symbol}-${row.exchange}-${row.product}`,
        row.realized_pnl_lifetime,
      ])
    )
    const brokerPositions = broker.rows.map((row) => {
      const quantity = row.quantity
      const key = `${row.symbol}-${row.exchange}-${row.product}`
      const side: DerivedPosition['side'] | null =
        quantity === null ? null : quantity > 0 ? 'long' : quantity < 0 ? 'short' : 'flat'
      return {
        symbol: row.symbol,
        exchange: row.exchange,
        product: row.product,
        side,
        net_qty: quantity,
        avg_entry_price: row.average_price,
        ltp: row.ltp,
        unrealized_pnl: row.pnl,
        realized_pnl_lifetime: realizedFor.get(key) ?? null,
        source: row.source ?? ('broker' as const),
        position_ref: row.position_ref,
      }
    })
    const coveredContracts = new Set(
      broker.rows.map((row) => `${row.symbol}-${row.exchange}-${row.product}`)
    )
    const omittedResiduals = derived
      .filter(
        (row) =>
          row.net_qty !== 0 && !coveredContracts.has(`${row.symbol}-${row.exchange}-${row.product}`)
      )
      .map((row) => ({ ...row, source: 'local/unreconciled' as const }))
    return [...brokerPositions, ...omittedResiduals]
  }, [broker.rows, derived])

  const checkpoint = strategy.status === 'running' && live.runId === runId ? live.checkpoint : null
  // Lifetime realized is the sum of every finalised run. The current run's
  // in-flight realized comes from the checkpoint, because its run row is not
  // written until the run ends.
  const historicalRealized = runs
    .filter((run) => run.id !== runId)
    .reduce((sum, run) => sum + run.pnl_realized, 0)
  const runRealized = stoppedRun?.pnl_realized ?? checkpoint?.pnl_realized ?? null
  const runUnrealized = stoppedRun ? 0 : (checkpoint?.pnl_unrealized ?? null)
  const runTotal = stoppedRun?.pnl_realized ?? checkpoint?.pnl_total ?? null
  // Historical runs are known, but the lifetime total is not: an active run
  // with no checkpoint may already have realized P&L. Never add an invented
  // zero contribution just to keep the tile numeric.
  const cumulativeRealized = runRealized === null ? null : historicalRealized + runRealized
  const formatCurrentPnl = stoppedRun ? formatPnl : formatLivePnl

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>策略持仓</CardTitle>
          <CardDescription>
            {broker.rows
              ? 'Broker quantities are overlaid on every attributable unresolved owner across all runs. Rows marked local/unreconciled were omitted by the broker book or cannot be divided safely; broker/shared is the undivided contract aggregate.'
              : broker.unavailable
                ? "The broker did not answer, so these are net positions derived from this strategy's filled orders."
                : "Net positions derived from this strategy's filled orders."}
            {runId !== null && (
              <>
                {' '}
                Run <span className="font-mono">#{runId}</span>.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase text-muted-foreground">已实现盈亏（本次运行）</div>
              <div className={cn('font-mono text-xl', pnlToneClass(runRealized))}>
                {formatCurrentPnl(runRealized)}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase text-muted-foreground">未实现盈亏</div>
              <div className={cn('font-mono text-xl', pnlToneClass(runUnrealized))}>
                {formatCurrentPnl(runUnrealized)}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs uppercase text-muted-foreground">本次总盈亏</div>
              <div className={cn('font-mono text-xl', pnlToneClass(runTotal))}>
                {formatCurrentPnl(runTotal)}
              </div>
            </div>
            <div className="rounded-md border-2 p-3">
              <div className="text-xs uppercase text-muted-foreground">累计已实现盈亏</div>
              <div className={cn('font-mono text-xl font-bold', pnlToneClass(cumulativeRealized))}>
                {formatLivePnl(cumulativeRealized)}
              </div>
              <div className="text-[10px] text-muted-foreground">所有运行的累计结果</div>
            </div>
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">加载中…</p>
          ) : positions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              当前运行没有持仓。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>交易品种</TableHead>
                    <TableHead>交易所</TableHead>
                    <TableHead>交易产品</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>方向</TableHead>
                    <TableHead className="text-right">净持仓量</TableHead>
                    <TableHead className="text-right">平均入场价</TableHead>
                    <TableHead className="text-right">最新成交价</TableHead>
                    <TableHead className="text-right">未实现盈亏</TableHead>
                    <TableHead className="text-right">已实现盈亏（累计）</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position, index) => (
                    <TableRow
                      key={`${position.symbol}-${position.exchange}-${position.product}-${position.source}-${position.position_ref ?? index}`}
                    >
                      <TableCell className="font-mono font-medium">{position.symbol}</TableCell>
                      <TableCell className="font-mono text-xs">{position.exchange}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {position.product}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {position.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            position.side === 'long'
                              ? 'default'
                              : position.side === 'short'
                                ? 'destructive'
                                : position.side === 'flat'
                                  ? 'secondary'
                                  : 'outline'
                          }
                          className="text-xs"
                        >
                          {position.side ?? 'Unavailable'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {brokerNumber(position.net_qty, 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {brokerNumber(position.avg_entry_price)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {brokerNumber(position.ltp)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-mono',
                          pnlToneClass(position.unrealized_pnl)
                        )}
                      >
                        {position.unrealized_pnl === null
                          ? 'Unavailable'
                          : formatPnl(position.unrealized_pnl)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-mono',
                          pnlToneClass(position.realized_pnl_lifetime)
                        )}
                        title="此合约在所有运行中的累计已实现盈亏"
                      >
                        {position.realized_pnl_lifetime === null
                          ? 'Unavailable'
                          : formatPnl(position.realized_pnl_lifetime)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Orders tab
// ---------------------------------------------------------------------------

function LocalOrderAudit({ orders }: { orders: Order[] }) {
  if (orders.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>策略审计记录</CardTitle>
        <CardDescription>
          由策略引擎记录。这些是本地审计记录，不代表交易商确认。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>下单时间</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>策略腿</TableHead>
                <TableHead>交易品种</TableHead>
                <TableHead>买卖</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>券商订单号</TableHead>
                <TableHead>拒单原因</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatIst(order.placed_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {order.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{order.leg_id}</TableCell>
                  <TableCell className="font-mono">{order.symbol}</TableCell>
                  <TableCell>{order.action}</TableCell>
                  <TableCell className="text-right font-mono">{order.qty}</TableCell>
                  <TableCell>
                    <Badge variant={orderStatusVariant(order.status)}>{order.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {order.broker_order_id ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs text-destructive">
                    {order.reject_reason ?? ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Trades tab
// ---------------------------------------------------------------------------

function LocalTradeAudit({ orders, loading }: { orders: Order[]; loading: boolean }) {
  const trades = useMemo(() => deriveTrades(orders), [orders])
  if (orders.length === 0 && !loading) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>策略审计记录</CardTitle>
        <CardDescription>
          策略引擎记录的成交行。这些是本地审计记录，不代表交易商确认。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">加载中…</p>
        ) : trades.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">暂无成交。</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>成交时间</TableHead>
                  <TableHead>运行</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>交易品种</TableHead>
                  <TableHead>交易所</TableHead>
                  <TableHead>买卖</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">成交价</TableHead>
                  <TableHead className="text-right">成交金额</TableHead>
                  <TableHead>订单号</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow key={trade.order_id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatIst(trade.filled_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">#{trade.run_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {trade.kind}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{trade.symbol}</TableCell>
                    <TableCell className="font-mono text-xs">{trade.exchange}</TableCell>
                    <TableCell>
                      <Badge
                        variant={trade.action === 'BUY' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {trade.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{trade.filled_qty}</TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatPrice(trade.avg_fill_price)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatPrice(trade.trade_value)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {trade.broker_order_id ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function reconciliationText(row: ReconciledBrokerOrder | ReconciledBrokerTrade): string {
  if (row.reconciliation === 'disagrees') return `Disagrees: ${row.disagreements.join(', ')}`
  if (row.reconciliation === 'ambiguous') return 'Ambiguous local identifier'
  if (row.reconciliation === 'unmatched') return 'Unmatched broker row'
  return 'Matched'
}

export function OrdersTab({
  strategy,
  orders,
  live,
  lastRunId = null,
  loading,
  active,
}: {
  strategy: Strategy
  orders: Order[]
  live: StrategyLiveState
  lastRunId?: number | null
  loading: boolean
  active: boolean
}) {
  const runId = brokerBookRunId(strategy, live, lastRunId)
  const broker = useBrokerBook(
    strategy.id,
    runId,
    'orderbook',
    fetchStrategyOrderbook,
    strategy.status === 'running',
    active
  )
  const currentOrders = useMemo(
    () => orders.filter((order) => order.run_id === runId),
    [orders, runId]
  )
  const historicalOrders = useMemo(
    () => orders.filter((order) => order.run_id !== runId),
    [orders, runId]
  )
  const reconciled = useMemo(
    () =>
      broker.rows
        ? reconcileBrokerOrders(broker.rows.orders, currentOrders)
        : { confirmed: [], localOnly: currentOrders },
    [broker.rows, currentOrders]
  )
  const auditRows =
    !broker.active || broker.unavailable ? orders : [...reconciled.localOnly, ...historicalOrders]

  return (
    <div className="space-y-4">
      {runId === null ? (
        <output className="block rounded-md border border-amber-500/50 p-3 text-sm">
          当前没有可用的策略运行记录，因此未查询交易商委托簿。此处显示策略审计记录，不代表交易商确认。
        </output>
      ) : broker.isLoading || loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p aria-live="polite" className="text-sm text-muted-foreground">
              正在加载交易商委托簿...
            </p>
          </CardContent>
        </Card>
      ) : broker.unavailable ? (
        <output className="block rounded-md border border-amber-500/50 p-3 text-sm">
          Broker unavailable — showing recorded strategy audit, which may lag.
        </output>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>券商确认的订单</CardTitle>
            <CardDescription>
              Broker status, quantity and prices are primary. Strategy context is attached only by
              an exact, unique broker order id. Run {runId ? `#${runId}` : 'not available'}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reconciled.confirmed.length === 0 ? (
              <p aria-live="polite" className="py-6 text-center text-sm text-muted-foreground">
                Broker reports no orders for run #{runId}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>券商时间</TableHead>
                      <TableHead>券商订单号</TableHead>
                      <TableHead>运行</TableHead>
                      <TableHead>策略腿</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>交易品种</TableHead>
                      <TableHead>交易所</TableHead>
                      <TableHead>买卖</TableHead>
                      <TableHead>交易产品</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">价格</TableHead>
                      <TableHead className="text-right">触发价</TableHead>
                      <TableHead>券商状态</TableHead>
                      <TableHead>本地状态／引用</TableHead>
                      <TableHead>本地拒绝原因</TableHead>
                      <TableHead>对账状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciled.confirmed.map((row, index) => (
                      <TableRow key={`${row.orderid}-${index}`}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {row.timestamp ?? 'Unavailable'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.orderid}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.run_id === null ? 'Unavailable' : `#${row.run_id}`}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.leg_id === null ? 'Unavailable' : row.leg_id}
                        </TableCell>
                        <TableCell>
                          {row.kind ? (
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {row.kind}
                            </Badge>
                          ) : (
                            'Unavailable'
                          )}
                        </TableCell>
                        <TableCell className="font-mono">{row.symbol}</TableCell>
                        <TableCell className="font-mono text-xs">{row.exchange}</TableCell>
                        <TableCell>{row.action}</TableCell>
                        <TableCell>{row.product}</TableCell>
                        <TableCell className="text-right font-mono">
                          {brokerNumber(row.quantity, 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {brokerNumber(row.price)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {brokerNumber(row.trigger_price)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={orderStatusVariant(row.order_status)}>
                            {row.order_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.local_status ?? 'Unavailable'} / {row.position_ref ?? 'Unavailable'}
                        </TableCell>
                        <TableCell className="text-xs text-destructive">
                          {row.reject_reason ?? ''}
                        </TableCell>
                        <TableCell className="text-xs">{reconciliationText(row)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {!broker.isLoading && !loading && <LocalOrderAudit orders={auditRows} />}
    </div>
  )
}

export function TradesTab({
  strategy,
  orders,
  live,
  lastRunId = null,
  loading,
  active,
}: {
  strategy: Strategy
  orders: Order[]
  live: StrategyLiveState
  lastRunId?: number | null
  loading: boolean
  active: boolean
}) {
  const runId = brokerBookRunId(strategy, live, lastRunId)
  const broker = useBrokerBook(
    strategy.id,
    runId,
    'tradebook',
    fetchStrategyTradebook,
    strategy.status === 'running',
    active
  )
  const currentTrades = useMemo(
    () => orders.filter((order) => order.run_id === runId && deriveTrades([order]).length > 0),
    [orders, runId]
  )
  const historicalTrades = useMemo(
    () => orders.filter((order) => order.run_id !== runId && deriveTrades([order]).length > 0),
    [orders, runId]
  )
  const reconciled = useMemo(
    () =>
      broker.rows
        ? reconcileBrokerTrades(broker.rows, currentTrades)
        : { confirmed: [], localOnly: currentTrades },
    [broker.rows, currentTrades]
  )
  const auditRows =
    !broker.active || broker.unavailable
      ? [...currentTrades, ...historicalTrades]
      : [...reconciled.localOnly, ...historicalTrades]

  return (
    <div className="space-y-4">
      {runId === null ? (
        <output className="block rounded-md border border-amber-500/50 p-3 text-sm">
          当前没有可用的策略运行记录，因此未查询交易商成交簿。此处显示策略审计记录，不代表交易商确认。
        </output>
      ) : broker.isLoading || loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p aria-live="polite" className="text-sm text-muted-foreground">
              正在加载交易商成交簿...
            </p>
          </CardContent>
        </Card>
      ) : broker.unavailable ? (
        <output className="block rounded-md border border-amber-500/50 p-3 text-sm">
          Broker unavailable — showing recorded strategy audit, which may lag.
        </output>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>券商确认的成交</CardTitle>
            <CardDescription>
              Broker fill quantity, average price and trade value are primary. Run{' '}
              {runId ? `#${runId}` : 'not available'}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reconciled.confirmed.length === 0 ? (
              <p aria-live="polite" className="py-6 text-center text-sm text-muted-foreground">
                Broker reports no trades for run #{runId}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>券商时间</TableHead>
                      <TableHead>券商订单号</TableHead>
                      <TableHead>运行</TableHead>
                      <TableHead>策略腿</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>交易品种</TableHead>
                      <TableHead>交易所</TableHead>
                      <TableHead>买卖</TableHead>
                      <TableHead>交易产品</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">成交均价</TableHead>
                      <TableHead className="text-right">成交金额</TableHead>
                      <TableHead>本地状态／引用</TableHead>
                      <TableHead>本地拒绝原因</TableHead>
                      <TableHead>对账状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciled.confirmed.map((row, index) => (
                      <TableRow key={`${row.orderid}-${row.timestamp ?? ''}-${index}`}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {row.timestamp ?? 'Unavailable'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.orderid}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.run_id === null ? 'Unavailable' : `#${row.run_id}`}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.leg_id === null ? 'Unavailable' : `Leg ${row.leg_id}`}
                        </TableCell>
                        <TableCell>
                          {row.kind ? (
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {row.kind}
                            </Badge>
                          ) : (
                            'Unavailable'
                          )}
                        </TableCell>
                        <TableCell className="font-mono">{row.symbol}</TableCell>
                        <TableCell className="font-mono text-xs">{row.exchange}</TableCell>
                        <TableCell>{row.action}</TableCell>
                        <TableCell>{row.product}</TableCell>
                        <TableCell className="text-right font-mono">
                          {brokerNumber(row.quantity, 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {brokerNumber(row.average_price)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {brokerNumber(row.trade_value)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.local_status ?? 'Unavailable'} / {row.position_ref ?? 'Unavailable'}
                        </TableCell>
                        <TableCell className="text-xs text-destructive">
                          {row.reject_reason ?? ''}
                        </TableCell>
                        <TableCell className="text-xs">{reconciliationText(row)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {!broker.isLoading && !loading && <LocalTradeAudit orders={auditRows} loading={false} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Events tab
// ---------------------------------------------------------------------------

function EventsTab({ events }: { events: StrategyEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            暂无事件。每次状态变化都会写入一条记录。
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>审计记录</CardTitle>
        <CardDescription>
          策略模块发布的事件均显示在这里，最新事件在前。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {events.map((event) => (
            <div
              key={event.id}
              className="grid grid-cols-[170px_140px_60px_1fr] items-start gap-2 border-b border-border/40 py-1.5 text-sm last:border-0"
            >
              <span className="font-mono text-xs text-muted-foreground">{formatIst(event.ts)}</span>
              <Badge variant="outline" className="w-fit font-mono text-[10px]">
                {event.kind}
              </Badge>
              <span className={cn('font-mono text-[10px]', severityClass(event.severity))}>
                {event.severity}
              </span>
              <span className="whitespace-pre-wrap">{event.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Risk tab
// ---------------------------------------------------------------------------

/**
 * One configured risk number with its unit attached.
 *
 * The unit is never left implicit here: "2" beside a stop loss means something
 * very different at 2 points and at 2 percent of a 2500 entry, and the Risk tab
 * is where an operator goes to confirm which one they chose.
 */
function formatRiskValue(value: number | null | undefined, unit: RiskUnit | null | undefined) {
  if (value === null || value === undefined) return '—'
  return unit === 'percent' ? `${value}%` : `${value} pts`
}

function RiskTab({ strategy }: { strategy: Strategy }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>策略整体风险</CardTitle>
          <CardDescription>
            Overall SL and Overall Target trigger exits from LTP-based MTM. MARKET orders fill at
            the available bid/ask, so final realized P&amp;L can differ from the trigger value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <RiskRow
            label="整体止损"
            value={
              strategy.overall_sl_mtm != null ? `₹${strategy.overall_sl_mtm.toFixed(2)} MTM` : 'off'
            }
          />
          <RiskRow
            label="整体止盈目标"
            value={
              strategy.overall_target_mtm != null
                ? `₹${strategy.overall_target_mtm.toFixed(2)} MTM`
                : 'off'
            }
          />
          <RiskRow
            label="移动止损至入场价"
            value={strategy.trail_sl_to_entry ? 'enabled' : 'off'}
          />
          {strategy.lock_profit ? (
            <>
              <Separator />
              <RiskRow
                label="锁盈模式"
                value={
                  strategy.lock_profit.mode === 'lock'
                    ? 'Lock (static floor)'
                    : 'Lock + Trail (rising floor)'
                }
              />
              <RiskRow
                label="当盈利达到"
                value={`₹${strategy.lock_profit.if_profit_reaches.toFixed(2)}`}
              />
              <RiskRow
                label="锁盈下限"
                value={`₹${strategy.lock_profit.lock_profit.toFixed(2)}`}
              />
              {strategy.lock_profit.mode === 'lock_and_trail' &&
                strategy.lock_profit.trail_step != null && (
                  <RiskRow
                    label="移动步长"
                    value={`₹${strategy.lock_profit.trail_step.toFixed(2)}`}
                  />
                )}
            </>
          ) : (
            <RiskRow label="锁盈" value="off" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>各腿风险</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left">#</th>
                  <th className="px-2 py-1 text-left">类型</th>
                  <th className="px-2 py-1 text-left">计量方式</th>
                  <th className="px-2 py-1 text-right">止损</th>
                  <th className="px-2 py-1 text-right">止盈目标</th>
                  <th className="px-2 py-1 text-right">移动止损 X / Y</th>
                </tr>
              </thead>
              <tbody>
                {strategy.legs.map((leg) => (
                  <tr key={leg.id} className="border-t">
                    <td className="px-2 py-1.5">{leg.id}</td>
                    <td className="px-2 py-1.5">
                      <Badge variant="outline" className="text-xs">
                        {leg.position ?? leg.side ?? '—'} · {leg.segment}
                        {leg.option_type ? ` · ${leg.option_type}` : ''}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5">
                      <Badge
                        variant={leg.risk_unit === 'percent' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {leg.risk_unit === 'percent' ? '% of entry' : 'points'}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {formatRiskValue(leg.sl_pts, leg.risk_unit)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {formatRiskValue(leg.target_pts, leg.risk_unit)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {leg.trail
                        ? `${formatRiskValue(leg.trail.x, leg.risk_unit)} / ${formatRiskValue(
                            leg.trail.y,
                            leg.risk_unit
                          )}`
                        : '— / —'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Webhook tab
// ---------------------------------------------------------------------------

function WebhookTab({
  strategy,
  onRotate,
  rotating,
}: {
  strategy: Strategy
  onRotate: () => void
  rotating: boolean
}) {
  const isSignal = strategy.strategy_kind === 'signal'
  const sampleLegId = strategy.legs[0]?.id ?? 1

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>TradingView Webhook</CardTitle>
          <CardDescription>
            此地址包含策略专用的秘密令牌。令牌只在创建或轮换时显示一次，系统仅保存其哈希值。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Webhook 地址（令牌已隐藏）</Label>
            <Input
              readOnly
              value={`${window.location.origin}/strategy/webhook/••••••••••••`}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Lost the token? Rotate it below; the previous one stops working immediately.
            </p>
          </div>

          {isSignal ? (
            <>
              <div className="space-y-1.5">
                <Label>TradingView 提醒消息（每个信号动作一条）</Label>
                <p className="text-xs text-muted-foreground">
                  Each TradingView alert sends one of the four payloads below. Mismatched signals (a{' '}
                  <span className="font-mono">long_exit</span> on a flat leg) are no-ops, so a
                  repeated alert is safe.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-green-700 dark:text-green-400">
                    多头开仓
                  </Label>
                  <pre className="rounded-md bg-muted p-3 text-xs">
                    {`{"action":"long_entry","leg_id":${sampleLegId}}`}
                  </pre>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-amber-700 dark:text-amber-400">
                    多头平仓
                  </Label>
                  <pre className="rounded-md bg-muted p-3 text-xs">
                    {`{"action":"long_exit","leg_id":${sampleLegId}}`}
                  </pre>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-red-700 dark:text-red-400">
                    空头开仓
                  </Label>
                  <pre className="rounded-md bg-muted p-3 text-xs">
                    {`{"action":"short_entry","leg_id":${sampleLegId}}`}
                  </pre>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-amber-700 dark:text-amber-400">
                    空头平仓
                  </Label>
                  <pre className="rounded-md bg-muted p-3 text-xs">
                    {`{"action":"short_exit","leg_id":${sampleLegId}}`}
                  </pre>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>TradingView 提醒消息内容</Label>
              <pre className="rounded-md bg-muted p-3 text-xs">
                {'{"action":"start","mode":"sandbox"}'}
              </pre>
              <p className="text-xs text-muted-foreground">
                发送 <span className="font-mono">{'{"action":"stop"}'}</span> 可平仓并结束本次运行。
              </p>
            </div>
          )}

          {strategy.webhook_locked && (
            <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">Webhook 已锁定。在页面顶部解锁前，所有传入信号都会被拒绝并记录审计日志。</p>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={onRotate} disabled={rotating}>
              {rotating ? '正在更新…' : '重新生成令牌'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// History tab
// ---------------------------------------------------------------------------

type ModeFilter = 'all' | 'live' | 'sandbox'

interface RunTrade {
  run_id: number
  mode: string
  entry_time: string
  exit_time: string
  num_legs: number
  pnl: number
  exit_kinds: string[]
}

function HistoryTab({ runs, orders }: { runs: Run[]; orders: Order[] }) {
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')

  const allTrips = useMemo(() => buildRoundTrips(orders), [orders])

  const runModeById = useMemo(() => {
    const map = new Map<number, string>()
    for (const run of runs) map.set(run.id, run.mode)
    return map
  }, [runs])

  const tripsByMode = useMemo(() => {
    const live: RoundTrip[] = []
    const sandbox: RoundTrip[] = []
    for (const trip of allTrips) {
      if (runModeById.get(trip.run_id) === 'live') live.push(trip)
      else sandbox.push(trip)
    }
    return { live, sandbox }
  }, [allTrips, runModeById])

  const trips = useMemo(() => {
    if (modeFilter === 'all') return allTrips
    return allTrips.filter((trip) => runModeById.get(trip.run_id) === modeFilter)
  }, [allTrips, modeFilter, runModeById])

  // A multi-leg basket closes as ONE trade attempt: its win or loss is the sum
  // across its legs. Counting each leg separately would score a strangle that
  // exits at +400 / -300 as one win and one loss instead of one winning trade.
  const runTrades = useMemo<RunTrade[]>(() => {
    const byRun = new Map<number, RunTrade>()
    for (const trip of trips) {
      const existing = byRun.get(trip.run_id)
      if (existing) {
        existing.pnl += trip.pnl
        existing.num_legs += 1
        if (trip.entry_time < existing.entry_time) existing.entry_time = trip.entry_time
        if (trip.exit_time > existing.exit_time) existing.exit_time = trip.exit_time
        if (!existing.exit_kinds.includes(trip.exit_kind)) existing.exit_kinds.push(trip.exit_kind)
      } else {
        byRun.set(trip.run_id, {
          run_id: trip.run_id,
          mode: runModeById.get(trip.run_id) ?? 'sandbox',
          entry_time: trip.entry_time,
          exit_time: trip.exit_time,
          num_legs: 1,
          pnl: trip.pnl,
          exit_kinds: [trip.exit_kind],
        })
      }
    }
    return Array.from(byRun.values()).sort((a, b) => b.exit_time.localeCompare(a.exit_time))
  }, [trips, runModeById])

  const stats = useMemo(() => {
    const total = runTrades.length
    const winners = runTrades.filter((trade) => trade.pnl > 0)
    const losers = runTrades.filter((trade) => trade.pnl < 0)
    const wins = winners.length
    const losses = losers.length
    const scratches = total - wins - losses
    const winRate = total > 0 ? (wins / total) * 100 : 0
    const totalPnl = runTrades.reduce((sum, trade) => sum + trade.pnl, 0)
    const avgPnl = total > 0 ? totalPnl / total : 0
    const grossWin = winners.reduce((sum, trade) => sum + trade.pnl, 0)
    const grossLoss = losers.reduce((sum, trade) => sum + trade.pnl, 0)
    const avgWin = wins > 0 ? grossWin / wins : 0
    const avgLoss = losses > 0 ? grossLoss / losses : 0
    const rrRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? Infinity : 0
    const profitFactor =
      grossLoss !== 0 ? Math.abs(grossWin / grossLoss) : grossWin > 0 ? Infinity : 0
    const bestTrade = total > 0 ? Math.max(...runTrades.map((t) => t.pnl)) : 0
    const worstTrade = total > 0 ? Math.min(...runTrades.map((t) => t.pnl)) : 0

    const chronological = [...runTrades].sort((a, b) => a.exit_time.localeCompare(b.exit_time))
    let maxDrawdown = 0
    let peak = 0
    let cumulative = 0
    for (const trade of chronological) {
      cumulative += trade.pnl
      if (cumulative > peak) peak = cumulative
      const drawdown = cumulative - peak
      if (drawdown < maxDrawdown) maxDrawdown = drawdown
    }

    let maxLoseStreak = 0
    let currentLose = 0
    let maxWinStreak = 0
    let currentWin = 0
    for (const trade of chronological) {
      if (trade.pnl < 0) {
        currentLose += 1
        currentWin = 0
        if (currentLose > maxLoseStreak) maxLoseStreak = currentLose
      } else if (trade.pnl > 0) {
        currentWin += 1
        currentLose = 0
        if (currentWin > maxWinStreak) maxWinStreak = currentWin
      } else {
        currentWin = 0
        currentLose = 0
      }
    }

    let totalDurationMs = 0
    let counted = 0
    for (const trade of runTrades) {
      const start = new Date(trade.entry_time).getTime()
      const end = new Date(trade.exit_time).getTime()
      if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
        totalDurationMs += end - start
        counted += 1
      }
    }
    const avgDurationMinutes = counted > 0 ? totalDurationMs / counted / 60000 : 0

    // Exit kinds stay leg-level: a basket can go out through several rules at
    // once, and which rule closed which leg is what tuning needs to see.
    const exitKindCounts: Record<string, number> = {}
    const exitKindPnl: Record<string, number> = {}
    for (const trip of trips) {
      exitKindCounts[trip.exit_kind] = (exitKindCounts[trip.exit_kind] || 0) + 1
      exitKindPnl[trip.exit_kind] = (exitKindPnl[trip.exit_kind] || 0) + trip.pnl
    }

    return {
      total,
      wins,
      losses,
      scratches,
      winRate,
      totalPnl,
      avgPnl,
      grossWin,
      grossLoss,
      avgWin,
      avgLoss,
      rrRatio,
      profitFactor,
      bestTrade,
      worstTrade,
      maxDrawdown,
      maxLoseStreak,
      maxWinStreak,
      avgDurationMinutes,
      exitKindCounts,
      exitKindPnl,
    }
  }, [runTrades, trips])

  const totalTrades = stats.total

  if (runs.length === 0 && totalTrades === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No history yet. Each completed entry+exit will appear here as one trade row.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>策略表现</CardTitle>
            <CardDescription>
              {modeFilter === 'all'
                ? 'Aggregated across every closed trade — all runs, all days, both modes.'
                : modeFilter === 'live'
                  ? 'Live trades only — real money, real broker.'
                  : 'Sandbox trades only — paper P&L, no real money.'}
            </CardDescription>
          </div>
          <div className="flex h-9 overflow-hidden rounded-md border border-input">
            {(
              [
                { value: 'all', label: 'All', count: allTrips.length },
                { value: 'live', label: 'Live', count: tripsByMode.live.length },
                { value: 'sandbox', label: 'Sandbox', count: tripsByMode.sandbox.length },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setModeFilter(option.value)}
                className={cn(
                  'px-3 text-xs font-medium transition-colors',
                  modeFilter === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                )}
              >
                {option.label}
                <span className="ml-1 text-[10px] opacity-70">({option.count})</span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {totalTrades === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No {modeFilter === 'all' ? '' : `${modeFilter} `}trades yet.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                <Stat label="交易笔数" value={String(totalTrades)} />
                <Stat
                  label="Win rate（胜率）"
                  value={`${stats.winRate.toFixed(1)}%`}
                  tone={stats.winRate >= 50 ? 'good' : stats.winRate > 0 ? 'warn' : 'bad'}
                />
                <Stat
                  label="盈利／亏损次数"
                  value={`${stats.wins} / ${stats.losses}${
                    stats.scratches ? ` (+${stats.scratches})` : ''
                  }`}
                />
                <Stat
                  label="P&L（总盈亏）"
                  value={formatPnl(stats.totalPnl)}
                  tone={stats.totalPnl > 0 ? 'good' : stats.totalPnl < 0 ? 'bad' : 'neutral'}
                  bold
                />
                <Stat
                  label="P&L（每次运行平均盈亏）"
                  value={formatPnl(stats.avgPnl)}
                  tone={stats.avgPnl > 0 ? 'good' : stats.avgPnl < 0 ? 'bad' : 'neutral'}
                />
              </div>

              <p className="mt-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                盈利 / 亏损分布
              </p>
              <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                <Stat
                  label="平均盈利"
                  value={stats.avgWin === 0 ? '—' : formatPnl(stats.avgWin)}
                  tone="good"
                />
                <Stat
                  label="平均亏损"
                  value={stats.avgLoss === 0 ? '—' : formatPnl(stats.avgLoss)}
                  tone="bad"
                />
                <Stat
                  label="Reward / Risk（盈亏比）"
                  value={
                    stats.rrRatio === Infinity
                      ? '∞'
                      : stats.rrRatio === 0
                        ? '—'
                        : stats.rrRatio.toFixed(2)
                  }
                  tone={stats.rrRatio >= 2 ? 'good' : stats.rrRatio > 1 ? 'warn' : 'bad'}
                />
                <Stat
                  label="Profit factor（盈利因子）"
                  value={
                    stats.profitFactor === Infinity
                      ? '∞'
                      : stats.profitFactor === 0
                        ? '—'
                        : stats.profitFactor.toFixed(2)
                  }
                  tone={
                    stats.profitFactor >= 1.5 ? 'good' : stats.profitFactor > 1 ? 'warn' : 'bad'
                  }
                />
                <Stat
                  label="最佳／最差"
                  value={`${formatPnl(stats.bestTrade)} / ${formatPnl(stats.worstTrade)}`}
                />
              </div>

              <p className="mt-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Risk &amp; behaviour
              </p>
              <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                <Stat
                  label="Max drawdown（最大回撤）"
                  value={stats.maxDrawdown === 0 ? '—' : formatPnl(stats.maxDrawdown)}
                  tone="bad"
                />
                <Stat
                  label="最长连亏"
                  value={`${stats.maxLoseStreak} ${stats.maxLoseStreak === 1 ? 'loss' : 'losses'}`}
                  tone={stats.maxLoseStreak >= 5 ? 'bad' : undefined}
                />
                <Stat
                  label="最长连赢"
                  value={`${stats.maxWinStreak} ${stats.maxWinStreak === 1 ? 'win' : 'wins'}`}
                  tone={stats.maxWinStreak >= 3 ? 'good' : undefined}
                />
                <Stat label="平均交易时长" value={formatDuration(stats.avgDurationMinutes)} />
                <Stat
                  label="总盈利／总亏损"
                  value={`${formatPnl(stats.grossWin)} / ${formatPnl(stats.grossLoss)}`}
                />
              </div>

              {Object.keys(stats.exitKindCounts).length > 0 && (
                <>
                  <p className="mt-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    退出原因
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {Object.entries(stats.exitKindCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([kind, count]) => {
                        const pct = (count / totalTrades) * 100
                        const pnl = stats.exitKindPnl[kind] ?? 0
                        return (
                          <div key={kind} className="rounded-md border bg-muted/30 px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {kind}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {count} ({pct.toFixed(0)}%)
                              </span>
                              <span className={cn('font-mono text-xs', pnlToneClass(pnl))}>
                                {formatPnl(pnl)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {(tripsByMode.live.length > 0 || tripsByMode.sandbox.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>按模式</CardTitle>
            <CardDescription>
              Sandbox trades are paper; live trades touched real money. Win rate counts a multi-leg
              basket as one trade attempt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['live', 'sandbox'] as const).map((mode) => {
                const list = tripsByMode[mode]
                const byRun = new Map<number, number>()
                for (const trip of list) {
                  byRun.set(trip.run_id, (byRun.get(trip.run_id) ?? 0) + trip.pnl)
                }
                const runPnls = Array.from(byRun.values())
                const total = runPnls.length
                const wins = runPnls.filter((pnl) => pnl > 0).length
                const winRate = total > 0 ? (wins / total) * 100 : 0
                const pnl = runPnls.reduce((sum, value) => sum + value, 0)
                return (
                  <div
                    key={mode}
                    className={cn(
                      'rounded-md border p-3',
                      mode === 'live'
                        ? 'border-red-500/40 bg-red-500/5'
                        : 'border-blue-500/40 bg-blue-500/5'
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant={mode === 'live' ? 'destructive' : 'secondary'}>
                        {mode.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {total} {total === 1 ? 'trade' : 'trades'} · {list.length}{' '}
                        {list.length === 1 ? 'leg' : 'legs'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Net P&amp;L</p>
                        <p className={cn('font-mono font-semibold', pnlToneClass(pnl))}>
                          {total === 0 ? '—' : formatPnl(pnl)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">胜率</p>
                        <p className="font-mono font-semibold">
                          {total === 0 ? '—' : `${winRate.toFixed(1)}%`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">盈利次数／总次数</p>
                        <p className="font-mono font-semibold">
                          {wins} / {total}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>成交汇总（按次运行）</CardTitle>
          <CardDescription>
            One row per run (= one trade attempt). Net P&amp;L is the sum of every leg's round-trip
            in that run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runTrades.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无已结束的运行。</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">运行</TableHead>
                    <TableHead className="text-xs">模式</TableHead>
                    <TableHead className="text-right text-xs">策略腿</TableHead>
                    <TableHead className="text-xs">入场（首腿）</TableHead>
                    <TableHead className="text-xs">出场（末腿）</TableHead>
                    <TableHead className="text-xs">持仓时长</TableHead>
                    <TableHead className="text-xs">出场类型</TableHead>
                    <TableHead className="text-right text-xs">Net P&amp;L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runTrades.map((trade) => {
                    const minutes =
                      (new Date(trade.exit_time).getTime() - new Date(trade.entry_time).getTime()) /
                      60000
                    return (
                      <TableRow key={trade.run_id}>
                        <TableCell className="font-mono text-xs">#{trade.run_id}</TableCell>
                        <TableCell>
                          <Badge
                            variant={trade.mode === 'live' ? 'destructive' : 'secondary'}
                            className="text-[10px]"
                          >
                            {trade.mode}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {trade.num_legs}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatIst(trade.entry_time)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatIst(trade.exit_time)}
                        </TableCell>
                        <TableCell className="text-xs">{formatDuration(minutes)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {trade.exit_kinds.map((kind) => (
                              <Badge key={kind} variant="outline" className="font-mono text-[10px]">
                                {kind}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono text-xs font-semibold',
                            pnlToneClass(trade.pnl)
                          )}
                        >
                          {formatPnl(trade.pnl)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>策略腿明细</CardTitle>
          <CardDescription>
            One row per leg round-trip, FIFO-matched within each leg. Useful for diagnosing which
            leg of a basket carried the run's P&amp;L.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trips.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No closed trades yet — open positions will appear here once they exit.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">运行</TableHead>
                    <TableHead className="text-xs">模式</TableHead>
                    <TableHead className="text-xs">交易品种</TableHead>
                    <TableHead className="text-xs">方向</TableHead>
                    <TableHead className="text-right text-xs">数量</TableHead>
                    <TableHead className="text-xs">入场时间</TableHead>
                    <TableHead className="text-right text-xs">入场价</TableHead>
                    <TableHead className="text-xs">出场时间</TableHead>
                    <TableHead className="text-right text-xs">出场价</TableHead>
                    <TableHead className="text-xs">出场类型</TableHead>
                    <TableHead className="text-right text-xs">P&amp;L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trips.map((trip, index) => {
                    const mode = runModeById.get(trip.run_id)
                    return (
                      <TableRow key={`${trip.run_id}-${trip.leg_id}-${index}`}>
                        <TableCell className="font-mono text-xs">#{trip.run_id}</TableCell>
                        <TableCell>
                          <Badge
                            variant={mode === 'live' ? 'destructive' : 'secondary'}
                            className="text-[10px]"
                          >
                            {mode ?? '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {trip.symbol}
                          <span className="ml-1 text-muted-foreground">{trip.exchange}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={trip.side === 'long' ? 'default' : 'destructive'}
                            className="text-[10px]"
                          >
                            {trip.side}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{trip.qty}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatIst(trip.entry_time)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {trip.entry_price.toFixed(2)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatIst(trip.exit_time)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {trip.exit_price.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {trip.exit_kind}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono text-xs font-semibold',
                            pnlToneClass(trip.pnl)
                          )}
                        >
                          {formatPnl(trip.pnl)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>运行历史</CardTitle>
            <CardDescription>
              Every Start spawns a run row; each row aggregates the leg trades above into a single
              finalised P&amp;L.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>运行编号</TableHead>
                    <TableHead>模式</TableHead>
                    <TableHead>启动时间</TableHead>
                    <TableHead>停止时间</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead>触发价</TableHead>
                    <TableHead className="text-right">P&amp;L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono">{run.id}</TableCell>
                      <TableCell>
                        <Badge variant={run.mode === 'live' ? 'destructive' : 'secondary'}>
                          {run.mode}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatIst(run.started_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatIst(run.stopped_at)}
                      </TableCell>
                      <TableCell>
                        {run.stop_reason ? (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {run.stop_reason}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{run.trigger_source}</TableCell>
                      <TableCell
                        className={cn('text-right font-mono', pnlToneClass(run.pnl_realized))}
                      >
                        {run.pnl_realized.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail page
// ---------------------------------------------------------------------------

export default function StrategyDetail() {
  // Named to match the route, which declares :strategyId. Destructuring
  // `id` from it yields undefined, so every visit to /strategy/<n> failed
  // its own validity check and rendered "Invalid strategy id".
  const { strategyId } = useParams<{ strategyId: string }>()
  const numId = Number(strategyId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const [confirmEnableLive, setConfirmEnableLive] = useState(false)
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const [startMode, setStartMode] = useState<RunMode>('sandbox')
  const [closingLegId, setClosingLegId] = useState<number | null>(null)
  const [rotatedToken, setRotatedToken] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('live')

  const validId = Number.isFinite(numId) && numId > 0

  const strategyQuery = useQuery({
    queryKey: strategyQueryKeys.strategy(numId),
    queryFn: () => getStrategy(numId),
    enabled: validId,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? SAFETY_POLL_MS : false),
  })

  const isRunning = strategyQuery.data?.status === 'running'
  const live = useStrategyLive(validId ? numId : null, Boolean(isRunning))

  const ordersQuery = useQuery({
    queryKey: strategyQueryKeys.orders(numId),
    queryFn: () => listOrders(numId),
    enabled: validId,
    refetchInterval: isRunning ? SAFETY_POLL_MS : false,
  })

  const runsQuery = useQuery({
    queryKey: strategyQueryKeys.runs(numId),
    queryFn: () => listRuns(numId),
    enabled: validId,
    refetchInterval: isRunning ? SAFETY_POLL_MS : false,
  })

  const eventsQuery = useQuery({
    queryKey: strategyQueryKeys.events(numId),
    queryFn: () => listEvents(numId),
    enabled: validId,
    refetchInterval: isRunning ? SAFETY_POLL_MS : false,
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: strategyQueryKeys.strategy(numId) })
    queryClient.invalidateQueries({ queryKey: strategyQueryKeys.strategies() })
  }

  const startMutation = useMutation({
    mutationFn: (mode: RunMode) => startRun(numId, mode),
    onSuccess: (result) => {
      const rejected = result.legs.filter((leg) => leg.ok === false || leg.status === 'rejected')
      if (result.acknowledged === false) {
        showToast.warning(
          'Run started, but broker acknowledgement is pending. Check Events and Orders before relying on RMS.'
        )
      } else if (rejected.length > 0) {
        showToast.warning(
          `Run started, but ${rejected.length} leg(s) were rejected. See the Orders tab.`
        )
      } else {
        showToast.success(`Run started — ${result.legs.length} legs placed`)
      }
      setStartDialogOpen(false)
      invalidateAll()
    },
    onError: (err: Error) => showToast.error(err.message || 'Start failed'),
  })

  const stopMutation = useMutation({
    mutationFn: () => stopRun(numId),
    onSuccess: (result) => {
      showToast.success(
        result.run_stopped === true || result.stop_pending === false
          ? 'Run stopped'
          : 'Stop requested — exit orders are pending'
      )
      setConfirmStop(false)
      invalidateAll()
    },
    onError: (err: Error) => showToast.error(err.message || 'Stop failed'),
  })

  const closeLegMutation = useMutation({
    mutationFn: (legId: number) => closeLeg(numId, legId),
    onSuccess: (result) => {
      showToast.success(
        result.run_stopped
          ? 'Leg closed — last open leg, run stopped'
          : 'Leg close requested — exit order is pending'
      )
      setClosingLegId(null)
      invalidateAll()
    },
    onError: (err: Error) => {
      setClosingLegId(null)
      showToast.error(err.message || 'Close-leg failed')
    },
  })

  const rotateMutation = useMutation({
    mutationFn: () => rotateWebhookToken(numId),
    onSuccess: (token) => {
      setRotatedToken(token)
      invalidateAll()
    },
    onError: (err: Error) => showToast.error(err.message || 'Failed to rotate token'),
  })

  const liveModeMutation = useMutation({
    mutationFn: (enabled: boolean) => setLiveEnabled(numId, enabled),
    onSuccess: (enabled) => {
      showToast.success(enabled ? 'Live mode enabled' : 'Live mode disabled')
      setConfirmEnableLive(false)
      invalidateAll()
    },
    onError: (err: Error) => showToast.error(err.message || 'Could not change the mode'),
  })

  const killSwitchMutation = useMutation({
    mutationFn: () => killSwitch(numId),
    onSuccess: (result) => {
      showToast.warning(
        result.message?.trim() ||
          (result.run_stopped
            ? 'Webhook locked and open legs closed'
            : result.stop_pending
              ? 'Webhook locked; exit fills pending'
              : 'Webhook locked; flattening was not confirmed')
      )
      setConfirmKill(false)
      invalidateAll()
    },
    onError: (err: Error) => showToast.error(err.message || '紧急停用失败'),
  })

  const unlockMutation = useMutation({
    mutationFn: () => unlockWebhook(numId),
    onSuccess: () => {
      showToast.success('Webhook unlocked - signals will be accepted again')
      invalidateAll()
    },
    onError: (err: Error) => showToast.error(err.message || 'Unlock failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteStrategy(numId),
    onSuccess: () => {
      showToast.success('Strategy deleted')
      queryClient.invalidateQueries({ queryKey: strategyQueryKeys.strategies() })
      navigate('/strategy')
    },
    onError: (err: Error) => showToast.error(err.message || '删除失败'),
  })

  if (!validId) {
    return <p className="text-sm text-destructive">无效的策略编号。</p>
  }
  if (strategyQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">加载中…</p>
  }
  if (strategyQuery.error || !strategyQuery.data) {
    return (
      <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        加载策略失败。
      </p>
    )
  }

  const strategy: Strategy = strategyQuery.data
  const orders = ordersQuery.data ?? []
  const runs = runsQuery.data ?? []
  const events = eventsQuery.data ?? []
  const running = strategy.status === 'running'
  const stopped = !running

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">
            {universeTabLabel(strategy.universe_tab)}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{strategy.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={statusBadgeVariant(strategy.status)}>{strategy.status}</Badge>
            <Badge variant={strategy.live_enabled ? 'destructive' : 'secondary'}>
              {strategy.live_enabled ? 'LIVE-enabled' : 'SANDBOX-only'}
            </Badge>
            {strategy.webhook_locked && (
              <Badge variant="destructive" className="font-semibold">
                WEBHOOK 已锁定
              </Badge>
            )}
            {strategy.strategy_kind === 'signal' && (
              <Badge variant="default" className="bg-blue-600 hover:bg-blue-600">
                信号模式
              </Badge>
            )}
            <Badge variant="outline">{strategy.strategy_type}</Badge>
            {strategy.strategy_kind === 'signal' ? (
              <Badge variant="outline">
                {strategy.direction === 'both'
                  ? 'Long+Short'
                  : strategy.direction === 'long_only'
                    ? 'Long only'
                    : 'Short only'}
              </Badge>
            ) : (
              <Badge variant="outline">
                {strategy.underlying} · {strategy.underlying_exchange}
              </Badge>
            )}
            <Badge variant="outline">{strategy.product}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Always available: the point of the kill switch is to lock the
              webhook even when nothing is running. */}
          <Button
            variant="destructive"
            className="font-bold"
            disabled={killSwitchMutation.isPending}
            onClick={() => setConfirmKill(true)}
            title="撤销待处理委托、平掉所有持仓并阻止全部 Webhook 信号"
          >
            {killSwitchMutation.isPending ? 'Killing…' : 'KILL SWITCH'}
          </Button>
          {strategy.webhook_locked && (
            <Button
              variant="outline"
              disabled={unlockMutation.isPending}
              onClick={() => unlockMutation.mutate()}
              title="恢复接收 Webhook 信号"
            >
              {unlockMutation.isPending ? 'Unlocking…' : 'Unlock webhook'}
            </Button>
          )}
          {/* Batch only. A signal strategy's run is opened by its first
              long_entry or short_entry after the session boundary, so there is
              nothing for a Start button to do: pressing it ran the batch
              lifecycle over legs that carry an accepted side rather than a
              position to enter at. */}
          {stopped && !strategy.webhook_locked && strategy.strategy_kind !== 'signal' && (
            <Button onClick={() => setStartDialogOpen(true)}>启动策略</Button>
          )}
          {stopped && !strategy.webhook_locked && strategy.strategy_kind === 'signal' && (
            <span
              className="text-xs text-muted-foreground"
              title="信号策略无需手动启动，请向 Webhook 发送 long_entry 或 short_entry。"
            >
              首次收到信号时启动
            </span>
          )}
          {running && (
            <Button
              variant="outline"
              disabled={stopMutation.isPending}
              onClick={() => setConfirmStop(true)}
              title="以市价平掉所有持仓策略腿并停止本次运行"
            >
              {stopMutation.isPending ? 'Stopping…' : 'Stop & Close Positions'}
            </Button>
          )}
          {stopped && !strategy.live_enabled && (
            <Button
              variant="destructive"
              onClick={() => setConfirmEnableLive(true)}
              title="启用实盘模式，将向交易商发送真实委托"
            >
              启用实盘
            </Button>
          )}
          {stopped && strategy.live_enabled && (
            <Button
              variant="outline"
              onClick={() => liveModeMutation.mutate(false)}
              disabled={liveModeMutation.isPending}
              title="关闭实盘模式，策略将仅使用模拟盘"
            >
              {liveModeMutation.isPending ? '正在关闭…' : '关闭实盘'}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={!stopped}
            title={!stopped ? `策略处于 ${strategy.status} 状态时无法编辑` : undefined}
            onClick={() => navigate(`/strategy/${strategy.id}/edit`)}
          >
            编辑
          </Button>
          <Button variant="outline" onClick={() => navigate('/strategy')}>
            返回
          </Button>
          <Button
            variant="destructive"
            disabled={!stopped}
            onClick={() => setConfirmDelete(true)}
            title={!stopped ? `策略处于 ${strategy.status} 状态时无法删除` : undefined}
          >
            删除
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        创建时间 {formatIst(strategy.created_at)} · 更新时间 {formatIst(strategy.updated_at)}
        {strategy.current_run_id ? (
          <span className="ml-3">
            · 当前运行： <span className="font-mono">#{strategy.current_run_id}</span>
          </span>
        ) : null}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 bg-transparent">
          <TabsTrigger value="live">实盘</TabsTrigger>
          <TabsTrigger value="setup">配置</TabsTrigger>
          <TabsTrigger value="positions">持仓</TabsTrigger>
          <TabsTrigger value="orders">订单</TabsTrigger>
          <TabsTrigger value="trades">成交</TabsTrigger>
          <TabsTrigger value="events">事件</TabsTrigger>
          <TabsTrigger value="risk">风险</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
          <TabsTrigger value="history">历史</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          <LiveTab
            strategy={strategy}
            orders={orders}
            live={live}
            lastRun={runs[0] ?? null}
            closingLegId={closingLegId}
            onCloseLeg={(legId) => {
              setClosingLegId(legId)
              closeLegMutation.mutate(legId)
            }}
          />
        </TabsContent>
        <TabsContent value="setup" className="mt-4">
          <SetupTab strategy={strategy} />
        </TabsContent>
        <TabsContent value="positions" className="mt-4">
          <PositionsTab
            strategy={strategy}
            orders={orders}
            live={live}
            runs={runs}
            loading={ordersQuery.isLoading}
            active={activeTab === 'positions'}
          />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <OrdersTab
            strategy={strategy}
            orders={orders}
            live={live}
            lastRunId={runs[0]?.id ?? null}
            loading={ordersQuery.isLoading}
            active={activeTab === 'orders'}
          />
        </TabsContent>
        <TabsContent value="trades" className="mt-4">
          <TradesTab
            strategy={strategy}
            orders={orders}
            live={live}
            lastRunId={runs[0]?.id ?? null}
            loading={ordersQuery.isLoading}
            active={activeTab === 'trades'}
          />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventsTab events={events} />
        </TabsContent>
        <TabsContent value="risk" className="mt-4">
          <RiskTab strategy={strategy} />
        </TabsContent>
        <TabsContent value="webhook" className="mt-4">
          <WebhookTab
            strategy={strategy}
            onRotate={() => rotateMutation.mutate()}
            rotating={rotateMutation.isPending}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab runs={runs} orders={orders} />
        </TabsContent>
      </Tabs>

      <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>启动策略：选择模式</DialogTitle>
            <DialogDescription>
              实盘模式会向交易商提交真实委托；模拟盘模式仅作模拟。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex h-10 overflow-hidden rounded-md border border-input">
              {(['sandbox', 'live'] as RunMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStartMode(mode)}
                  disabled={mode === 'live' && !strategy.live_enabled}
                  className={cn(
                    'flex-1 text-sm font-medium transition-colors disabled:opacity-40',
                    startMode === mode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted'
                  )}
                  title={
                    mode === 'live' && !strategy.live_enabled
                      ? 'Enable live mode on the strategy first'
                      : undefined
                  }
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
            {startMode === 'live' && !strategy.live_enabled && (
              <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                Strategy isn't live-enabled. Use "启用实盘" on the detail page to unlock live
                mode.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartDialogOpen(false)}>
              取消
            </Button>
            <Button
              disabled={startMutation.isPending || (startMode === 'live' && !strategy.live_enabled)}
              onClick={() => startMutation.mutate(startMode)}
            >
              {startMutation.isPending ? 'Starting…' : `Start ${startMode}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmEnableLive}
        onOpenChange={setConfirmEnableLive}
        title="启用实盘模式？"
        description="Live mode places real broker orders with real margin. Once enabled, any scheduled, webhook or manual start with mode=live will reach your broker. This is recorded in the audit trail."
        confirmLabel="启用实盘"
        destructive
        loading={liveModeMutation.isPending}
        onConfirm={() => liveModeMutation.mutate(true)}
      />

      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title="停止并平掉所有持仓？"
        description="Requests MARKET exits for every open leg. The run is finalised only after broker fills confirm the strategy is flat; until then the stop remains pending and retryable."
        confirmLabel="Stop & close positions"
        destructive
        loading={stopMutation.isPending}
        onConfirm={() => stopMutation.mutate()}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="删除此策略？"
        description="Permanently removes the strategy and its audit trail."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />

      <ConfirmDialog
        open={confirmKill}
        onOpenChange={setConfirmKill}
        title="启用紧急停止？"
        description="Immediately locks the webhook so external TradingView signals are refused, then requests MARKET exits for open positions. The run is finalised only after broker fills confirm the strategy is flat; pending or refused exits remain visible and retryable."
        confirmLabel="KILL"
        destructive
        loading={killSwitchMutation.isPending}
        onConfirm={() => killSwitchMutation.mutate()}
      />

      <Dialog
        open={rotatedToken !== null}
        onOpenChange={(open) => {
          if (!open) setRotatedToken(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>新的 Webhook 令牌，请立即复制</DialogTitle>
            <DialogDescription>
              旧令牌立即失效。新令牌只显示这一次。
            </DialogDescription>
          </DialogHeader>
          {rotatedToken && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>新的 Webhook 地址</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/strategy/webhook/${rotatedToken}`}
                    className="font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/strategy/webhook/${rotatedToken}`
                      )
                      showToast.success('地址已复制')
                    }}
                  >复制</Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setRotatedToken(null)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
