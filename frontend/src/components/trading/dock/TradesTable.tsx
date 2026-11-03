/**
 * The trade book as a dock table: every fill today, across every symbol.
 * Read-only; a fill is a fact.
 */

import type { SearchRow } from '@/lib/trading/terminal'
import { cn } from '@/lib/utils'
import type { DockTrade } from './blotter'
import {
  EmptyRows,
  isActiveRow,
  isRowClick,
  ROW,
  ROW_ACTIVE,
  SymbolCell,
  sideClass,
  sideLabel,
  TD,
  TD_NUM,
  TH,
  TH_NUM,
} from './cells'
import { fmt2, formatTime } from './format'

interface Props {
  trades: DockTrade[]
  activeSymbol?: string | null
  onPick(row: SearchRow): void
  isLoading?: boolean
}

export function TradesTable({ trades, activeSymbol, onPick, isLoading }: Props) {
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
            产品类型
          </th>
          <th scope="col" className={TH_NUM}>
            数量
          </th>
          <th scope="col" className={TH_NUM}>
            成交均价
          </th>
          <th scope="col" className={TH_NUM}>
            成交金额
          </th>
        </tr>
      </thead>
      <tbody>
        {trades.length === 0 && (
          <EmptyRows colSpan={8}>{isLoading ? '正在加载成交记录' : '今日暂无成交。'}</EmptyRows>
        )}
        {trades.map((t, i) => {
          const active = isActiveRow(activeSymbol, t)
          return (
            <tr
              // A partial fill reports the same order id twice, so the key
              // needs the time and the position in the list as well.
              key={`${t.orderid}-${t.timestamp}-${i}`}
              className={cn(ROW, active && ROW_ACTIVE)}
              onClick={(e) => {
                if (isRowClick(e)) onPick({ symbol: t.symbol, exchange: t.exchange })
              }}
            >
              <td className={cn(TD, 'tabular-nums text-muted-foreground')}>
                {formatTime(t.timestamp)}
              </td>
              <SymbolCell symbol={t.symbol} exchange={t.exchange} active={active} onPick={onPick} />
              <td className={cn(TD, 'text-muted-foreground')}>{t.exchange}</td>
              <td className={cn(TD, 'font-medium', sideClass(t.action))}>{sideLabel(t.action)}</td>
              <td className={cn(TD, 'text-muted-foreground')}>{t.product}</td>
              <td className={TD_NUM}>{t.quantity}</td>
              <td className={TD_NUM}>{fmt2(t.average_price)}</td>
              <td className={TD_NUM}>{fmt2(t.trade_value)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
