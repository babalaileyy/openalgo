import { describe, expect, it, vi } from 'vitest'
import { isBoxChartType } from '@/lib/trading/chartTypes'
import type { ChartSettingsRequest } from '@/lib/trading/terminal'
import { fireEvent, render, screen, userEvent } from '@/test/test-utils'
import { BoxChartSettingsDialog } from './BoxChartSettingsDialog'

/**
 * Shaped like what the terminal hands over for a transformed chart: the
 * Price tab's colour rows under the keys openalgo-charts 2.6.1 gives them, and
 * every option of the transform as a `transform.*` value. The box is the one
 * the terminal sized from the instrument's price.
 */
function request(type: 'renko' | 'point-figure'): ChartSettingsRequest {
  const body = {
    key: 'symbol.body',
    type: 'colorPair' as const,
    label: type === 'renko' ? 'Body' : 'Boxes',
    group: 'Candles',
    up: { key: 'symbol.upColor', label: type === 'renko' ? 'Up' : 'X', default: '#26a69a' },
    down: { key: 'symbol.downColor', label: type === 'renko' ? 'Down' : 'O', default: '#ef5350' },
  }
  const borders = {
    key: 'symbol.borders',
    type: 'colorPair' as const,
    label: 'Borders',
    group: 'Candles',
    enabled: { key: 'symbol.borderVisible', default: true },
    up: { key: 'symbol.borderUpColor', label: 'Up', default: '#26a69a' },
    down: { key: 'symbol.borderDownColor', label: 'Down', default: '#ef5350' },
  }
  const values: Record<string, string | number | boolean> = {
    'transform.mode': 'fixed',
    'transform.boxSize': 12.5,
    'transform.percent': 1,
    'transform.atrPeriod': 14,
    'transform.atrMultiplier': 1,
    'transform.method': type === 'renko' ? 'close' : 'hl',
    'symbol.upColor': '#26a69a',
    'symbol.downColor': '#ef5350',
    'symbol.borderVisible': true,
    'symbol.borderUpColor': '#26a69a',
    'symbol.borderDownColor': '#ef5350',
    ...(type === 'point-figure' ? { 'transform.reversal': 3 } : {}),
  }
  return {
    tabs: [{ id: 'price', label: 'Price', inputs: type === 'renko' ? [body, borders] : [body] }],
    values,
    defaults: { ...values },
  }
}

function open(type: 'renko' | 'point-figure', req = request(type)) {
  const onApply = vi.fn()
  const onClose = vi.fn()
  render(<BoxChartSettingsDialog type={type} req={req} onApply={onApply} onClose={onClose} />)
  return { onApply, onClose }
}

describe('BoxChartSettingsDialog', () => {
  it('appears only for the two box chart types', () => {
    expect(['renko', 'point-figure'].every(isBoxChartType)).toBe(true)
    expect(['candlestick', 'kagi', 'range', 'line-break', 'heikin-ashi'].some(isBoxChartType)).toBe(
      false
    )
  })

  it('offers Renko its body and border colours, and no reversal', () => {
    open('renko')
    expect(screen.getByRole('heading', { name: 'Renko（砖形图）设置' })).toBeInTheDocument()
    expect(screen.getByLabelText('实体 上涨')).toBeInTheDocument()
    expect(screen.getByLabelText('边框 下跌')).toBeInTheDocument()
    expect(screen.queryByLabelText('反转格数')).not.toBeInTheDocument()
    expect(screen.getByLabelText('大小')).toHaveValue('12.5')
  })

  it('applies a percent preset as the method and the percent, and nothing else', async () => {
    const user = userEvent.setup()
    const { onApply, onClose } = open('renko')
    await user.click(screen.getByRole('button', { name: '0.50%' }))
    expect(screen.getByRole('button', { name: '0.50%' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('大小')).toHaveValue('0.5')
    await user.click(screen.getByRole('button', { name: '确定' }))
    expect(onApply).toHaveBeenCalledWith({ 'transform.mode': 'percent', 'transform.percent': 0.5 })
    expect(onClose).toHaveBeenCalled()
  })

  it('sizes from the ATR with its length, and builds from the high and low', async () => {
    const user = userEvent.setup()
    const { onApply } = open('renko')
    expect(screen.queryByLabelText('ATR（平均真实波幅）周期')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('计算方式'), 'atr')
    expect(screen.getByText('x ATR')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('大小'), { target: { value: '1.5' } })
    fireEvent.change(screen.getByLabelText('ATR（平均真实波幅）周期'), { target: { value: '20' } })
    await user.click(screen.getByLabelText('最高价和最低价'))
    await user.click(screen.getByRole('button', { name: '确定' }))
    expect(onApply).toHaveBeenCalledWith({
      'transform.mode': 'atr',
      'transform.atrMultiplier': 1.5,
      'transform.atrPeriod': 20,
      'transform.method': 'hl',
    })
  })

  it('keeps a size it cannot use on screen and refuses to apply it', async () => {
    const user = userEvent.setup()
    const { onApply, onClose } = open('renko')
    await user.selectOptions(screen.getByLabelText('计算方式'), 'percent')
    fireEvent.change(screen.getByLabelText('大小'), { target: { value: '-2' } })
    expect(screen.getByLabelText('大小')).toHaveValue('-2')
    expect(screen.getByText('请输入大于 0 的数值')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确定' }))
    expect(onApply).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('大小'), {
      target: { value: '2' },
    })
    await user.click(screen.getByRole('button', { name: '确定' }))
    expect(onApply).toHaveBeenCalledWith({ 'transform.mode': 'percent', 'transform.percent': 2 })
  })

  it('treats a blank absolute size as sized from history', async () => {
    const user = userEvent.setup()
    const { onApply } = open('renko')
    fireEvent.change(screen.getByLabelText('大小'), { target: { value: '' } })
    expect(screen.getByLabelText('大小')).toHaveAttribute('placeholder', '自动')
    await user.click(screen.getByRole('button', { name: '确定' }))
    expect(onApply).toHaveBeenCalledWith({ 'transform.boxSize': 0 })
  })

  it('gives point and figure its X and O colours, a reversal and close-only prices', async () => {
    const user = userEvent.setup()
    const { onApply } = open('point-figure')
    expect(screen.getByRole('heading', { name: 'Point & Figure（点数图）设置' })).toBeInTheDocument()
    expect(screen.getByLabelText('Boxes X')).toBeInTheDocument()
    expect(screen.queryByLabelText('Borders Up')).not.toBeInTheDocument()
    expect(screen.getByLabelText('最高价和最低价')).toBeChecked()
    await user.selectOptions(screen.getByLabelText('反转格数'), '2')
    await user.click(screen.getByLabelText('仅收盘价'))
    await user.click(screen.getByRole('button', { name: '确定' }))
    expect(onApply).toHaveBeenCalledWith({ 'transform.reversal': 2, 'transform.method': 'close' })
  })

  it('applies a reset to the terminal baseline on Ok', async () => {
    const user = userEvent.setup()
    const req = request('renko')
    req.values = { ...req.values, 'transform.mode': 'percent', 'transform.percent': 2 }
    const { onApply } = open('renko', req)
    const reset = screen.getByRole('button', { name: '恢复默认值' })
    expect(reset).toBeEnabled()
    await user.click(reset)
    expect(screen.getByLabelText('计算方式')).toHaveValue('fixed')
    expect(screen.getByLabelText('大小')).toHaveValue('12.5')
    await user.click(screen.getByRole('button', { name: '确定' }))
    expect(onApply).toHaveBeenCalledWith({ 'transform.mode': 'fixed', 'transform.percent': 1 })
  })

  it('writes nothing on Cancel', async () => {
    const user = userEvent.setup()
    const { onApply, onClose } = open('renko')
    await user.click(screen.getByRole('button', { name: '1%' }))
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(onApply).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('takes focus when it opens, keeps Tab inside, and hands focus back when it closes', async () => {
    const user = userEvent.setup()
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = render(
      <BoxChartSettingsDialog
        type="renko"
        req={request('renko')}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByRole('dialog', { name: 'Renko（砖形图）设置' })).toContainElement(
      document.activeElement as HTMLElement
    )
    expect(screen.getByLabelText('大小')).toHaveFocus()
    screen.getByRole('button', { name: '确定' }).focus()
    await user.tab()
    expect(screen.getByRole('button', { name: '关闭' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: '确定' })).toHaveFocus()
    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
