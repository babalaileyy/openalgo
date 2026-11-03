/**
 * The equity, drawdown and trades tabs under a backtest's figures.
 *
 * The chart itself is a canvas library, so it is replaced by a probe that says
 * which curve it was asked for; `BacktestChart.test.ts` holds what it is fed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BacktestOutcome } from '@/lib/trading/backtestRun'
import { render, screen, userEvent } from '@/test/test-utils'

vi.mock('./BacktestChart', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./BacktestChart')>()),
  BacktestChart: ({ show }: { show: string }) => <div data-testid="curve">{show}</div>,
}))

const { BacktestResultTabs } = await import('./BacktestResultTabs')

const money = (value: unknown) => Number(value).toFixed(2)

function outcome(extra: Partial<BacktestOutcome> = {}): BacktestOutcome {
  const at = (minute: number) => Date.UTC(2026, 8, 15, 9, minute)
  return {
    ok: true,
    equity: [
      { time: at(0), equity: 100000, drawdown: 0 },
      { time: at(1), equity: 99500, drawdown: -500 },
      { time: at(2), equity: 100800, drawdown: 0 },
    ],
    trades: [
      { index: 0, side: 'long', entryPrice: 100, exitPrice: 105, netProfit: 5 },
      { index: 1, side: 'short', entryPrice: 105, isOpen: true, netProfit: -2 },
    ],
    ...extra,
  } as BacktestOutcome
}

beforeEach(() => localStorage.clear())

describe('BacktestResultTabs', () => {
  it('opens on the equity curve, with drawdown and trades one click away', async () => {
    render(<BacktestResultTabs outcome={outcome()} money={money} />)
    expect(screen.getByRole('tab', { name: '权益' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('curve')).toHaveTextContent('equity')

    await userEvent.click(screen.getByRole('tab', { name: '回撤' }))
    expect(screen.getByTestId('curve')).toHaveTextContent('drawdown')

    await userEvent.click(screen.getByRole('tab', { name: '交易 (2)' }))
    expect(screen.queryByTestId('curve')).toBeNull()
    expect(screen.getByText('未平仓')).toBeInTheDocument()
    expect(screen.getByText('5.00')).toBeInTheDocument()
  })

  it('remembers the tab last chosen for the next run', async () => {
    const first = render(<BacktestResultTabs outcome={outcome()} money={money} />)
    await userEvent.click(screen.getByRole('tab', { name: '回撤' }))
    first.unmount()

    render(<BacktestResultTabs outcome={outcome()} money={money} />)
    expect(screen.getByRole('tab', { name: '回撤' })).toHaveAttribute('aria-selected', 'true')
  })

  it('says so when there is nothing to draw or list', async () => {
    render(<BacktestResultTabs outcome={outcome({ equity: [], trades: [] })} money={money} />)
    expect(screen.getByText('本次回测的 K 线数量不足，无法绘制权益曲线。')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: '交易' }))
    expect(screen.getByText('本次回测没有交易。')).toBeInTheDocument()
  })
})

describe('the line over each curve', () => {
  it('says where equity ended and how far it moved, in rupees', () => {
    render(<BacktestResultTabs outcome={outcome()} money={money} />)
    const line = screen.getByText(/权益 ₹1,00,800/).closest('p')
    expect(line?.textContent).toContain('+₹800 (+0.80%)')
    expect(line?.textContent).toContain('初始权益 ₹1,00,000')
  })

  it('names the deepest drawdown, its share and when, in the run zone', async () => {
    const run = outcome({ instrument: { timezone: 'UTC' } } as Partial<BacktestOutcome>)
    render(<BacktestResultTabs outcome={run} money={money} />)
    await userEvent.click(screen.getByRole('tab', { name: '回撤' }))
    const line = screen.getByText(/最大回撤/).closest('p')
    expect(line?.textContent).toContain('-₹500 (-0.50%)')
    expect(line?.textContent).toMatch(/发生于 15 Sept? 2026, 09:01/)
  })
})
