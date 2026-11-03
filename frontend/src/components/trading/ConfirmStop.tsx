/**
 * The question asked before a strategy's position is closed.
 *
 * **Stop spends money and cannot be taken back.** It sends a market order for
 * everything the strategy is holding, at whatever the market is at that moment,
 * and there is no undo: the spread is paid and the position is gone. Pause costs
 * nothing. So Stop is never one press, and Pause is.
 *
 * **It names what will be closed.** A dialog that asks "are you sure?" is a
 * dialog people learn to click through. This one says the strategy, the
 * instrument, and the size and profit of the position it is about to give up,
 * because those are the four things that would change somebody's mind, and a
 * trader with two deployments of one strategy needs to see which of them they
 * are about to act on.
 *
 * **Pause is offered here too**, because this is the moment a trader realises
 * which of the two they actually wanted, and making them close the dialog and
 * find the other button is how the wrong one gets pressed.
 */

import { AlertTriangle } from 'lucide-react'
import type { PositionSummary } from '@/lib/trading/strategyPosition'

interface Props {
  /** The strategy, which is the name a trader reads. */
  file: string
  /** The instrument and bar this deployment runs on, already written out. */
  where: string
  /** What it is holding, or nothing when that could not be read. */
  holding: PositionSummary | null | undefined
  busy: boolean
  onCancel(): void
  onPause(): void
  onStop(): void
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

export function ConfirmStop({ file, where, holding, busy, onCancel, onPause, onStop }: Props) {
  const open = holding?.positions ?? []
  // Unknown and flat are not the same answer and are not shown as one. A
  // position this could not read is one a trader should look at before closing
  // it, and saying "nothing open" about it would be the wrong half to guess.
  const unknown = holding === null || holding === undefined

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={`停止 ${file}`}
      className="flex flex-col gap-2 rounded border border-destructive/50 bg-destructive/5 p-2"
    >
      <div className="flex items-start gap-1.5">
        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
        <div className="text-[11px] leading-relaxed">
          <span className="font-medium">停止将平掉此策略的持仓。</span>{' '}
          <span className="text-muted-foreground">
            将按当时的市场价格，以市价单平掉 {file} 在 {where} 的全部持仓。此操作无法撤销。
          </span>
        </div>
      </div>

      {unknown ? (
        <p className="text-[11px] text-muted-foreground">
          暂时无法读取此策略的持仓，请在平仓前核实。
        </p>
      ) : open.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          当前没有持仓，无需平仓，策略将直接停止。
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {open.map((one) => (
            <li
              key={`${one.symbol}-${one.exchange}-${one.side}`}
              className="flex items-baseline gap-2 font-mono text-[10px]"
            >
              <span className="font-medium">{one.symbol}</span>
              <span className="text-muted-foreground">{one.exchange}</span>
              <span className={one.side === 'short' ? 'text-destructive' : 'text-emerald-500'}>
                {one.side === 'short' ? '-' : '+'}
                {one.quantity}
              </span>
              <span className="ml-auto text-muted-foreground">{money(one.profit)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <button
          type="button"
          className="h-7 flex-1 rounded border border-destructive/60 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
          disabled={busy}
          onClick={onStop}
        >
          {busy ? '平仓中' : '平仓并停止'}
        </button>
        <button
          type="button"
          className="h-7 flex-1 rounded border border-border text-[11px] hover:bg-accent disabled:opacity-50"
          disabled={busy}
          title="结束策略并保留持仓，由您自行管理"
          onClick={onPause}
        >
          改为暂停
        </button>
        <button
          type="button"
          className="h-7 rounded border border-border px-2 text-[11px] hover:bg-accent"
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </div>
  )
}
