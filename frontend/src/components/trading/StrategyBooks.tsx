/**
 * What one strategy has done: its orders, its fills, the contracts it holds.
 *
 * **The columns are chosen, not discovered.** A broker's book carries whatever
 * fields that broker puts on it, and rendering all of them in a 400px panel
 * gives a table nobody can read. So each book names the few a trader scans for,
 * and a row missing one shows a dash rather than being dropped: a row that is
 * there is a real order, and hiding it because a column is absent would be
 * answering "this strategy did nothing" on a strategy that traded.
 *
 * **A failing book says so in place.** The service refuses for reasons a trader
 * can act on, and each tab carries its own refusal rather than the panel
 * failing as a whole, because one unreadable book must not hide the two that
 * would have answered.
 *
 * **Positions carry their caveat on screen.** A position row is per contract
 * and holds no strategy, so it is narrowed to the contracts this strategy
 * traded and may include size somebody else opened. A trader reading a number
 * and acting on it has to be told that, not have it left in a docstring.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type StrategyBook,
  strategyOrderbook,
  strategyPositions,
  strategyTradebook,
} from '@/api/openscriptRunner'
import { useOrderEventRefresh } from '@/hooks/useOrderEventRefresh'
import { cn } from '@/lib/utils'

type Tab = 'orders' | 'trades' | 'positions'

interface Column {
  /** The keys to try, in order. Brokers spell the same fact differently. */
  keys: string[]
  label: string
  align?: 'right'
  /** Colour by sign, for a money column. */
  signed?: boolean
}

const COLUMNS: Record<Tab, Column[]> = {
  orders: [
    { keys: ['symbol', 'tradingsymbol'], label: '品种' },
    { keys: ['action', 'transaction_type', 'side'], label: '方向' },
    { keys: ['quantity', 'qty'], label: '数量', align: 'right' },
    { keys: ['price', 'average_price', 'avgprice'], label: '价格', align: 'right' },
    { keys: ['order_status', 'status'], label: '状态' },
  ],
  trades: [
    { keys: ['symbol', 'tradingsymbol'], label: '品种' },
    { keys: ['action', 'transaction_type', 'side'], label: '方向' },
    { keys: ['quantity', 'qty', 'fillsize'], label: '数量', align: 'right' },
    { keys: ['average_price', 'price', 'fillprice'], label: '价格', align: 'right' },
    { keys: ['timestamp', 'fill_timestamp', 'trade_time'], label: '时间' },
  ],
  positions: [
    { keys: ['symbol', 'tradingsymbol'], label: '品种' },
    { keys: ['quantity', 'netqty', 'net_quantity'], label: '净持仓', align: 'right', signed: true },
    { keys: ['average_price', 'avgprice', 'buy_price'], label: '均价', align: 'right' },
    { keys: ['pnl', 'unrealised', 'unrealized_pnl'], label: '盈亏', align: 'right', signed: true },
  ],
}

const LABEL: Record<Tab, string> = { orders: '委托', trades: '成交', positions: '持仓' }

const READ: Record<Tab, (deployment: string, signal?: AbortSignal) => Promise<StrategyBook>> = {
  orders: strategyOrderbook,
  trades: strategyTradebook,
  positions: strategyPositions,
}

/** The first key a row actually carries, or nothing. */
function cellOf(row: Record<string, unknown>, column: Column): unknown {
  for (const key of column.keys) {
    const held = row[key]
    if (held !== undefined && held !== null && held !== '') return held
  }
  return null
}

function shown(value: unknown): string {
  if (value === null) return '-'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  const text = String(value)
  // A timestamp is the longest thing a broker puts in a cell and the part that
  // matters in a panel this wide is the time, not the date.
  return text.length > 19 && text.includes(' ') ? text.split(' ').slice(-1)[0] : text
}

function sign(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.sign(n) : 0
}

interface Props {
  /**
   * The deployment whose book this is, not the script it runs.
   *
   * One script is deployed on several instruments at once and each order
   * carries the deployment's own id, which is the whole of the attribution. A
   * book asked for by file name showed a run on one instrument the orders a
   * second run of the same file had placed on another, and nothing on the
   * screen said which position the rows belonged to.
   */
  deployment: string
  /** Bumped by the panel when a run starts or stops, so the books refetch. */
  revision?: number
}

export function StrategyBooks({ deployment, revision = 0 }: Props) {
  const [tab, setTab] = useState<Tab>('orders')
  const [book, setBook] = useState<StrategyBook | null>(null)
  const [loading, setLoading] = useState(false)
  const inflight = useRef<AbortController | null>(null)

  const load = useCallback(
    async (which: Tab) => {
      inflight.current?.abort()
      const controller = new AbortController()
      inflight.current = controller
      setLoading(true)
      const answered = await READ[which](deployment, controller.signal)
      if (!controller.signal.aborted) {
        setBook(answered)
        setLoading(false)
      }
    },
    [deployment]
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision is a refetch signal, not a value this reads
  useEffect(() => {
    void load(tab)
    return () => inflight.current?.abort()
  }, [load, tab, revision])

  // **Read again when an order happens, rather than on a timer.** These books
  // change for exactly one reason, an order moving, and the platform already
  // says so: every surface that places one broadcasts it. A poll asks a
  // question nobody has an answer to for minutes at a time and then misses the
  // moment by up to its own interval, which on a book a trader is watching is
  // the moment that mattered.
  //
  // The small delay is the hook's own and is the right shape: the event is sent
  // when an order is accepted, and the book that records it is written a beat
  // later, so reading on the instant of the event reads the book from before.
  const reload = useCallback(() => {
    void load(tab)
  }, [load, tab])

  useOrderEventRefresh(reload, {
    events: [
      'order_event',
      'close_position_event',
      'cancel_order_event',
      'modify_order_event',
      // Where orders go changes what book they are in, so the books are read
      // again rather than left showing the other destination's.
      'analyzer_update',
    ],
  })

  const columns = COLUMNS[tab]

  return (
    <div className="flex flex-col gap-1.5 rounded bg-muted/30 p-1.5">
      <div className="flex gap-1">
        {(['orders', 'trades', 'positions'] as const).map((one) => (
          <button
            key={one}
            type="button"
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
              tab === one
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setTab(one)}
          >
            {LABEL[one]}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={() => void load(tab)}
        >
          {loading ? '读取中' : '刷新'}
        </button>
      </div>

      {book?.problem && <p className="px-1 py-1 text-[10px] text-destructive">{book.problem}</p>}

      {!book?.problem && book && book.rows.length === 0 && (
        <p className="px-1 py-1 text-[10px] text-muted-foreground">
          {tab === 'positions'
            ? '此策略没有相关合约。'
            : `此策略暂无${LABEL[tab]}记录。`}
        </p>
      )}

      {!book?.problem && book && book.rows.length > 0 && (
        <div className="max-h-48 overflow-auto rounded border border-border">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.label}
                    className={cn(
                      'px-1.5 py-1 font-normal',
                      column.align === 'right' ? 'text-right' : 'text-left'
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {book.rows.map((row, at) => (
                <tr
                  // The broker's own reference where there is one. Falling back
                  // to the index keeps a book renderable from a source that
                  // numbers nothing, which is better than refusing to draw it.
                  key={String(row.orderid ?? row.tradeid ?? `${row.symbol}-${at}`)}
                  className="border-t border-border"
                >
                  {columns.map((column) => {
                    const value = cellOf(row, column)
                    const way = column.signed ? sign(value) : 0
                    return (
                      <td
                        key={column.label}
                        className={cn(
                          'px-1.5 py-1',
                          column.align === 'right' ? 'text-right' : 'text-left',
                          way > 0 && 'text-emerald-500',
                          way < 0 && 'text-destructive'
                        )}
                      >
                        {shown(value)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'positions' && book && book.rows.length > 0 && (
        <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
          持仓按合约汇总，不区分策略；这里的数量可能包含其他策略或手动订单建立的持仓。此处显示的是与该策略交易过的合约相关的持仓，并非策略本身的价值。
        </p>
      )}
    </div>
  )
}
