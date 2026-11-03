/**
 * SetSLDialog — configure a leg's stop-loss and optional auto-trailing.
 * Configure a leg's stop-loss: initial stop-loss + trailing step + enable toggle + target.
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SLState } from '@/hooks/useTrailingSL'
import { priceDecimals } from '@/lib/scalpingPrice'
import type { ScalpingAction, ScalpingProduct, SelectedLeg } from '@/types/scalping'

interface SetSLDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leg: SelectedLeg | null
  product: ScalpingProduct
  side: ScalpingAction
  entryPrice: number
  quantity: number
  ltp?: number
  existing?: SLState
  onSave: (sl: SLState) => void
  onClear?: () => void
}

export function SetSLDialog({
  open,
  onOpenChange,
  leg,
  product,
  side,
  entryPrice,
  quantity,
  ltp,
  existing,
  onSave,
  onClear,
}: SetSLDialogProps) {
  const [stoploss, setStoploss] = useState('')
  const [trailingEnabled, setTrailingEnabled] = useState(false)
  const [trailingStep, setTrailingStep] = useState('')
  const [targetPrice, setTargetPrice] = useState('')

  // Seed fields when the dialog opens.
  useEffect(() => {
    if (!open) return
    if (existing) {
      setStoploss(String(existing.initialSl))
      setTrailingEnabled(existing.trailingEnabled)
      setTrailingStep(existing.trailingStep ? String(existing.trailingStep) : '')
      setTargetPrice(existing.target ? String(existing.target) : '')
    } else {
      setStoploss('')
      setTrailingEnabled(false)
      setTrailingStep('')
      setTargetPrice('')
    }
  }, [open, existing])

  // Currency derivatives (CDS/BCD) display to 4 decimals; everything else to 2.
  const decimals = priceDecimals(leg?.exchange)

  // Reference price for validating stop direction: prefer live LTP, else entry.
  const slNum = Number(stoploss)
  const refPrice = ltp != null && ltp > 0 ? ltp : entryPrice
  let directionError = ''
  if (Number.isFinite(slNum) && slNum > 0 && refPrice > 0) {
    if (side === 'BUY' && slNum >= refPrice) {
      directionError = `多头（买入）：止损价必须低于 ${refPrice.toFixed(decimals)}`
    } else if (side === 'SELL' && slNum <= refPrice) {
      directionError = `空头（卖出）：止损价必须高于 ${refPrice.toFixed(decimals)}`
    }
  }

  // Target must be on the PROFIT side, or it would trigger an immediate exit.
  const tgtNum = Number(targetPrice)
  let targetError = ''
  if (Number.isFinite(tgtNum) && tgtNum > 0 && refPrice > 0) {
    if (side === 'BUY' && tgtNum <= refPrice) {
      targetError = `多头（买入）：止盈价必须高于 ${refPrice.toFixed(decimals)}`
    } else if (side === 'SELL' && tgtNum >= refPrice) {
      targetError = `空头（卖出）：止盈价必须低于 ${refPrice.toFixed(decimals)}`
    }
  }

  // Trailing enabled with a non-positive step would appear active but never move.
  const stepNum = Number(trailingStep)
  const trailingError =
    trailingEnabled && !(Number.isFinite(stepNum) && stepNum > 0)
      ? '跟踪止损步长必须大于 0'
      : ''

  const handleSave = () => {
    if (!leg) return
    const sl = Number(stoploss)
    if (!Number.isFinite(sl) || sl <= 0) return
    if (quantity <= 0) return
    // Block wrong-side stop/target (immediate exit) and an inert trailing config.
    if (directionError || targetError || trailingError) return
    const step = Number(trailingStep)
    const tgt = Number(targetPrice)
    const entry = entryPrice > 0 ? entryPrice : (ltp ?? 0)
    onSave({
      symbol: leg.symbol,
      exchange: leg.exchange,
      product,
      side,
      entry,
      quantity,
      initialSl: sl,
      trailingEnabled,
      trailingStep: Number.isFinite(step) && step > 0 ? step : 0,
      highestPrice: entry,
      lowestPrice: entry,
      currentSl: sl,
      target: Number.isFinite(tgt) && tgt > 0 ? tgt : 0,
      active: true,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>止损 · 止盈 · 跟踪止损 — {leg?.symbol ?? ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">建仓价</span>
              <div className="font-mono">{entryPrice > 0 ? entryPrice.toFixed(decimals) : '—'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">最新价</span>
              <div className="font-mono">{ltp != null ? ltp.toFixed(decimals) : '—'}</div>
            </div>
            <div>
              <span className="text-muted-foreground">方向</span>
              <div className="font-mono">{side}</div>
            </div>
            <div>
              <span className="text-muted-foreground">数量</span>
              <div className="font-mono">{quantity}</div>
            </div>
          </div>

          {quantity <= 0 && (
            <p className="text-xs text-red-600">
              此交易腿暂无数量，请先建仓或等待期权链数据加载后再设置止损。
            </p>
          )}

          <div className="space-y-1">
            <Label htmlFor="sl-price">止损价</Label>
            <Input
              id="sl-price"
              type="number"
              inputMode="decimal"
              value={stoploss}
              onChange={(e) => setStoploss(e.target.value)}
              placeholder="例如 270"
            />
            {directionError && <p className="text-xs text-red-600">{directionError}</p>}
          </div>

          <label className="flex items-center gap-2">
            <Checkbox
              checked={trailingEnabled}
              onCheckedChange={(v) => setTrailingEnabled(v === true)}
            />
            <span className="text-sm">启用跟踪止损</span>
          </label>

          {trailingEnabled && (
            <div className="space-y-1">
              <Label htmlFor="sl-step">跟踪步长</Label>
              <Input
                id="sl-step"
                type="number"
                inputMode="decimal"
                value={trailingStep}
                onChange={(e) => setTrailingStep(e.target.value)}
                placeholder="例如 2"
              />
              <p className="text-xs text-muted-foreground">
                仅当价格盈利至少 1 个单位时开始跟踪；止损价只会向有利方向移动。
              </p>
              {trailingError && <p className="text-xs text-red-600">{trailingError}</p>}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="sl-target">止盈价（可选）</Label>
            <Input
              id="sl-target"
              type="number"
              inputMode="decimal"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder={side === 'BUY' ? '高于建仓价' : '低于建仓价'}
            />
            {targetError && <p className="text-xs text-red-600">{targetError}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {existing && onClear && (
            <Button
              variant="outline"
              onClick={() => {
                onClear()
                onOpenChange(false)
              }}
            >
              清除止损
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              quantity <= 0 || !stoploss || !!directionError || !!targetError || !!trailingError
            }
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
