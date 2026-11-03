/**
 * The position book as a dock table. One row per (symbol, exchange, product),
 * so an MIS and an NRML position in the same contract are two rows, and the
 * zero-quantity rows the broker still reports stay visible with their
 * realised figure and no Close.
 *
 * Close is per row, through the web route that squares off one position.
 * The endpoint that squares off everything is behind the header's Close all
 * and nowhere near a row button.
 */

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { SearchRow } from '@/lib/trading/terminal'
import { cn } from '@/lib/utils'
import { type DockPosition, positionKey } from './blotter'
import {
  EmptyRows,
  isActiveRow,
  isRowClick,
  ROW,
  ROW_ACTIVE,
  SymbolCell,
  TD,
  TD_NUM,
  TH,
  TH_NUM,
  toneClass,
} from './cells'
import { fmt2, signed, signedQty } from './format'

interface Props {
  positions: DockPosition[]
  activeSymbol?: string | null
  onPick(row: SearchRow): void
  /** Confirmed by the user; the caller places the square-off. */
  onClose(position: DockPosition): void
  isLoading?: boolean
}

export function PositionsTable({ positions, activeSymbol, onPick, onClose, isLoading }: Props) {
  const [pending, setPending] = useState<DockPosition | null>(null)

  return (
    <>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className={TH}>
              交易品种
            </th>
            <th scope="col" className={TH}>
              交易所
            </th>
            <th scope="col" className={TH}>
              产品类型
            </th>
            <th scope="col" className={TH_NUM}>
              净持仓数量
            </th>
            <th scope="col" className={TH_NUM}>
              持仓均价
            </th>
            <th scope="col" className={TH_NUM}>
              最新价
            </th>
            <th scope="col" className={TH_NUM}>
              盈亏
            </th>
            <th scope="col" className={cn(TH, 'text-right')}>
              <span className="sr-only">操作</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.length === 0 && (
            <EmptyRows colSpan={8}>{isLoading ? '正在加载持仓' : '暂无持仓。'}</EmptyRows>
          )}
          {positions.map((p) => {
            const active = isActiveRow(activeSymbol, p)
            const open = p.quantity !== 0
            return (
              <tr
                key={positionKey(p)}
                className={cn(ROW, active && ROW_ACTIVE, !open && 'text-muted-foreground')}
                onClick={(e) => {
                  if (isRowClick(e)) onPick({ symbol: p.symbol, exchange: p.exchange })
                }}
              >
                <SymbolCell
                  symbol={p.symbol}
                  exchange={p.exchange}
                  active={active}
                  onPick={onPick}
                />
                <td className={cn(TD, 'text-muted-foreground')}>{p.exchange}</td>
                <td className={cn(TD, 'text-muted-foreground')}>{p.product}</td>
                <td className={cn(TD_NUM, 'font-medium', open && toneClass(p.quantity))}>
                  {signedQty(p.quantity)}
                </td>
                <td className={TD_NUM}>{fmt2(p.average_price)}</td>
                <td className={TD_NUM}>{p.ltp ? fmt2(p.ltp) : '-'}</td>
                <td className={cn(TD_NUM, 'font-medium', toneClass(p.pnl))}>{signed(p.pnl)}</td>
                <td className={cn(TD, 'text-right')}>
                  {open && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-rose-600 hover:text-rose-600 dark:text-rose-400"
                      onClick={() => setPending(p)}
                      aria-label={`平掉 ${p.symbol} 的 ${p.product} 持仓`}
                    >
                      平仓
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认平掉 {pending?.symbol} 的持仓？</AlertDialogTitle>
            <AlertDialogDescription>
              将以市价提交反向委托，平掉 {pending?.exchange} 的 {pending?.product} 净持仓{' '}
              {pending ? signedQty(pending.quantity) : ''}。仅平掉这笔持仓。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>保留持仓</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) onClose(pending)
                setPending(null)
              }}
            >
              确认平仓
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
