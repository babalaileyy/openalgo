/**
 * The order book as a dock table: every order today, across every symbol,
 * with Cancel and Modify on the ones still working.
 */

import { Button } from '@/components/ui/button'
import type { SearchRow } from '@/lib/trading/terminal'
import { cn } from '@/lib/utils'
import { type DockOrder, isWorking } from './blotter'
import {
  EmptyRows,
  isActiveRow,
  isRowClick,
  ROW,
  ROW_ACTIVE,
  StatusBadge,
  SymbolCell,
  sideClass,
  sideLabel,
  priceTypeLabel,
  TD,
  TD_NUM,
  TH,
  TH_NUM,
} from './cells'
import { fmt2, formatTime } from './format'

interface Props {
  orders: DockOrder[]
  activeSymbol?: string | null
  onPick(row: SearchRow): void
  onCancel(order: DockOrder): void
  onModify(order: DockOrder): void
  isLoading?: boolean
}

function qtyText(order: DockOrder): string {
  if (order.filled_quantity === undefined) return String(order.quantity)
  return `${order.filled_quantity}/${order.quantity}`
}

function priceText(order: DockOrder): string {
  if (order.pricetype === 'MARKET' || order.pricetype === 'SL-M') {
    return order.average_price ? fmt2(order.average_price) : '市价'
  }
  return order.price ? fmt2(order.price) : '-'
}

export function OrdersTable({
  orders,
  activeSymbol,
  onPick,
  onCancel,
  onModify,
  isLoading,
}: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th scope="col" className={TH}>
            时间
          </th>
          <th scope="col" className={TH}>
            交易品种
          </th>
          <th scope="col" className={TH}>
            交易所
          </th>
          <th scope="col" className={TH}>
            方向
          </th>
          <th scope="col" className={TH}>
            委托类型
          </th>
          <th scope="col" className={TH}>
            产品类型
          </th>
          <th scope="col" className={TH_NUM}>
            数量
          </th>
          <th scope="col" className={TH_NUM}>
            价格
          </th>
          <th scope="col" className={TH_NUM}>
            触发价
          </th>
          <th scope="col" className={TH}>
            状态
          </th>
          <th scope="col" className={cn(TH, 'text-right')}>
            <span className="sr-only">操作</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {orders.length === 0 && (
          <EmptyRows colSpan={11}>{isLoading ? '正在加载委托' : '今日暂无委托。'}</EmptyRows>
        )}
        {orders.map((order) => {
          const working = isWorking(order.order_status)
          const active = isActiveRow(activeSymbol, order)
          return (
            <tr
              key={order.orderid}
              className={cn(ROW, active && ROW_ACTIVE)}
              onClick={(e) => {
                if (isRowClick(e)) onPick({ symbol: order.symbol, exchange: order.exchange })
              }}
            >
              <td className={cn(TD, 'tabular-nums text-muted-foreground')}>
                {formatTime(order.timestamp)}
              </td>
              <SymbolCell
                symbol={order.symbol}
                exchange={order.exchange}
                active={active}
                onPick={onPick}
              />
              <td className={cn(TD, 'text-muted-foreground')}>{order.exchange}</td>
              <td className={cn(TD, 'font-medium', sideClass(order.action))}>{sideLabel(order.action)}</td>
              <td className={TD}>{priceTypeLabel(order.pricetype)}</td>
              <td className={cn(TD, 'text-muted-foreground')}>{order.product}</td>
              <td className={TD_NUM}>{qtyText(order)}</td>
              <td className={TD_NUM}>{priceText(order)}</td>
              <td className={cn(TD_NUM, !order.trigger_price && 'text-muted-foreground')}>
                {order.trigger_price ? fmt2(order.trigger_price) : '-'}
              </td>
              <td className={TD}>
                <StatusBadge status={order.order_status} />
                {order.rejection_reason && (
                  <span
                    className="ml-1.5 max-w-[220px] truncate align-middle text-[11px] text-muted-foreground"
                    title={order.rejection_reason}
                  >
                    {order.rejection_reason}
                  </span>
                )}
              </td>
              <td className={cn(TD, 'text-right')}>
                {working && (
                  <span className="inline-flex gap-1">
                    {order.pricetype !== 'MARKET' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => onModify(order)}
                        aria-label={`修改 ${order.symbol} 的委托 ${order.orderid}`}
                      >
                        修改
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-rose-600 hover:text-rose-600 dark:text-rose-400"
                      onClick={() => onCancel(order)}
                      aria-label={`撤销 ${order.symbol} 的委托 ${order.orderid}`}
                    >
                      撤单
                    </Button>
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
