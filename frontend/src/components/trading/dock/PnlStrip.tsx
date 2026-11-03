/**
 * The dock header's figures and its two flatten buttons.
 *
 * Cancel all and Close all are risk-reducing, so they are not behind the
 * One-Click switch: disarming must never disable the way out. They are
 * behind a confirm instead, because each acts on everything at once.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toneClass } from './cells'
import { signed } from './format'

interface Props {
  openPnl: number
  openCount: number
  /** Null when the trade book has no round trip to price. */
  realised: number | null
  /** Whether the open figure is moving with the feed rather than the last fetch. */
  live: boolean
  workingOrders: number
  onCancelAll(): void
  onCloseAll(): void
  formatCurrency(value: number): string
}

function Figure({
  label,
  value,
  format,
}: {
  label: string
  value: number
  format(value: number): string
}) {
  const sign = signed(value).charAt(0)
  const shown = format(Math.abs(value))
  return (
    <span className="flex items-baseline gap-1 whitespace-nowrap text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium tabular-nums', toneClass(value))}>
        {value === 0 ? shown : `${sign}${shown}`}
      </span>
    </span>
  )
}

export function PnlStrip({
  openPnl,
  openCount,
  realised,
  live,
  workingOrders,
  onCancelAll,
  onCloseAll,
  formatCurrency,
}: Props) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Figure label={`持仓盈亏 (${openCount})`} value={openPnl} format={formatCurrency} />
      {realised !== null && <Figure label="已实现盈亏" value={realised} format={formatCurrency} />}
      {live && openCount > 0 && (
        <Badge variant="secondary" className="h-4 px-1.5 text-[9px] uppercase tracking-wide">
          实时
        </Badge>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px]"
            disabled={workingOrders === 0}
          >
            全部撤单
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认撤销所有未完成委托？</AlertDialogTitle>
            <AlertDialogDescription>
              将撤销所有品种的未完成委托，当前共 {workingOrders} 笔。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction onClick={onCancelAll}>确认全部撤单</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px] text-rose-600 hover:text-rose-600 dark:text-rose-400"
            disabled={openCount === 0}
          >
            全部平仓
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认平掉所有持仓？</AlertDialogTitle>
            <AlertDialogDescription>
              将以市价平掉所有品种及产品类型的持仓，当前共 {openCount} 笔持仓。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction onClick={onCloseAll}>确认全部平仓</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
