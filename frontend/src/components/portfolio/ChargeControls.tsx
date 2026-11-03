/**
 * Every transaction charge as an editable control.
 *
 * Nothing here is hardcoded in the sense that matters: the defaults are the
 * current Indian delivery schedule, but each line is a field the user can
 * correct against their own contract note, and the backend applies whatever
 * they set. The same shape describes any market — a US SEC fee is sell-side
 * only, a UK stamp duty is buy-side with no consumption tax — so adding one is
 * a preset, not a code change.
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ChargeState } from '@/lib/portfolioRequest'
import { cn } from '@/lib/utils'

interface Props {
  value: ChargeState
  onChange(next: ChargeState): void
  exchange: 'NSE' | 'BSE'
  onExchange(v: 'NSE' | 'BSE'): void
}

export function ChargeControls({ value, onChange, exchange, onExchange }: Props) {
  const set = <K extends keyof ChargeState>(k: K, v: ChargeState[K]) =>
    onChange({ ...value, [k]: v })

  const row = 'grid grid-cols-[1fr_auto] items-center gap-2'
  const num =
    'h-7 w-20 px-2 text-right text-xs tabular-nums'

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <div className="text-sm font-semibold">交易成本</div>
        <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
          按每次再平衡的实际成交金额计费。可根据交易商的成交单修改各项费率。
        </p>
      </div>

      <div>
        <Label className="text-[11px]">交易所</Label>
        <div className="mt-1 flex gap-1">
          {(['NSE', 'BSE'] as const).map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                onExchange(ex)
                // The transaction fee differs by venue; move it with the choice
                // rather than leaving a stale NSE rate against BSE.
                set('exchangeTxn', ex === 'BSE' ? 0.00375 : 0.00307)
              }}
              className={cn(
                'flex-1 rounded border px-2 py-1 text-xs transition-colors',
                exchange === ex
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'hover:bg-accent'
              )}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t pt-2">
        <Label className="text-[11px]">佣金</Label>
        <div className="flex gap-1">
          {(['flat', 'percent'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set('brokerageMode', m)}
              className={cn(
                'flex-1 rounded border px-2 py-1 text-xs transition-colors',
                value.brokerageMode === m
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'hover:bg-accent'
              )}
            >
              {m === 'flat' ? '₹ / 每笔' : '委托金额的 %'}
            </button>
          ))}
        </div>
        {value.brokerageMode === 'flat' ? (
          <div className={row}>
            <span className="text-xs text-muted-foreground">每笔（₹）</span>
            <Input
              type="number"
              className={num}
              value={value.brokerageFlat}
              onChange={(e) => set('brokerageFlat', Number(e.target.value))}
            />
          </div>
        ) : (
          <>
            <div className={row}>
              <span className="text-xs text-muted-foreground">费率（%）</span>
              <Input
                type="number"
                step="0.001"
                className={num}
                value={value.brokeragePct}
                onChange={(e) => set('brokeragePct', Number(e.target.value))}
              />
            </div>
            <div className={row}>
              <span className="text-xs text-muted-foreground">每笔上限（₹）</span>
              <Input
                type="number"
                className={num}
                value={value.brokerageCap}
                onChange={(e) => set('brokerageCap', Number(e.target.value))}
              />
            </div>
          </>
        )}
        <p className="text-[11px] leading-tight text-muted-foreground">
          多数折扣交易商的股票交割免佣金；若组合仅包含交割交易，可设为 0。
        </p>
      </div>

      <div className="space-y-2 border-t pt-2">
        {[
          ['STT（证券交易税 %）', 'stt', '买卖双边', 0.001],
          ['交易所手续费（%）', 'exchangeTxn', '按成交额', 0.00001],
          ['印花税（%）', 'stampDuty', '仅买入', 0.001],
          ['GST（商品及服务税 %）', 'gst', '按费用计算，不含税', 0.1],
          ['SEBI 监管费（₹ / 千万）', 'sebiPerCrore', '按成交额', 1],
          ['滑点（%）', 'slippage', '按成交额', 0.01],
        ].map(([label, key, note, step]) => (
          <div key={key as string}>
            <div className={row}>
              <span className="text-xs">{label}</span>
              <Input
                type="number"
                step={step as number}
                className={num}
                value={value[key as keyof ChargeState] as number}
                onChange={(e) =>
                  set(key as keyof ChargeState, Number(e.target.value) as never)
                }
              />
            </div>
            <div className="text-[10px] text-muted-foreground">{note}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
