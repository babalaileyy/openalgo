import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@/test/test-utils'
import { ChartDataDialog } from './ChartDataDialog'

afterEach(cleanup)

const studies = [
  { id: 'ema', name: 'EMA 20' },
  { id: 'rsi', name: 'RSI 14' },
]

function open(onDownload = vi.fn(), onClose = vi.fn(), comparisons = 2) {
  render(
    <ChartDataDialog
      source="NSE:INFY, 5m"
      studies={studies}
      comparisons={comparisons}
      onDownload={onDownload}
      onClose={onClose}
    />
  )
  return { onDownload, onClose }
}

describe('the chart data download', () => {
  it('starts with everything, which is the file the menu always wrote', () => {
    const { onDownload, onClose } = open()
    expect(screen.getByRole('dialog', { name: '下载图表数据' })).toHaveTextContent(
      'NSE:INFY, 5m'
    )
    fireEvent.click(screen.getByRole('button', { name: '下载 CSV' }))
    expect(onDownload).toHaveBeenCalledExactlyOnceWith({
      range: 'all',
      studies: ['ema', 'rsi'],
      comparisons: true,
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('narrows to the bars on screen, the studies ticked and no comparison closes', () => {
    const { onDownload } = open()
    fireEvent.click(screen.getByLabelText('屏幕内的 K 线'))
    fireEvent.click(screen.getByText('EMA 20'))
    fireEvent.click(screen.getByText('对比品种收盘价（2）'))
    fireEvent.click(screen.getByRole('button', { name: '下载 CSV' }))
    expect(onDownload).toHaveBeenCalledExactlyOnceWith({
      range: 'visible',
      studies: ['rsi'],
      comparisons: false,
    })
  })

  it('keeps the dialog open with the reason when the file cannot be written', () => {
    const onDownload = vi.fn(() => {
      throw new Error('No bars are on screen to export')
    })
    const { onClose } = open(onDownload)
    fireEvent.click(screen.getByRole('button', { name: '下载 CSV' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No bars are on screen to export')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('leaves out the comparison choice when there is none, and closes on Escape', () => {
    const { onClose } = open(vi.fn(), vi.fn(), 0)
    expect(screen.queryByText(/对比品种收盘价/)).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
