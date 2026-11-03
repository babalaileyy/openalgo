import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@/test/test-utils'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import PortfolioBacktester from './PortfolioBacktester'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PortfolioBacktester />
    </QueryClientProvider>
  )
}

describe('PortfolioBacktester accessibility', () => {
  it('associates each static label with its control', () => {
    renderPage()

    expect(screen.getByLabelText('开始日期')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('结束日期')).toHaveAttribute('type', 'date')
    expect(screen.getByRole('combobox', { name: '数据来源' })).toBeInTheDocument()
    expect(screen.getByLabelText('无风险利率（%）')).toHaveAttribute('type', 'number')
  })

  it('assigns a unique id to each static control', () => {
    renderPage()

    const start = screen.getByLabelText('开始日期')
    const end = screen.getByLabelText('结束日期')
    const source = screen.getByLabelText('数据来源')
    const riskFree = screen.getByLabelText('无风险利率（%）')
    const ids = [start.id, end.id, source.id, riskFree.id]

    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(4)
  })

  it('preserves the static controls change behavior', async () => {
    renderPage()

    const start = screen.getByLabelText('开始日期')
    const end = screen.getByLabelText('结束日期')
    const source = screen.getByLabelText('数据来源')
    const riskFree = screen.getByLabelText('无风险利率（%）')

    fireEvent.change(start, { target: { value: '2024-01-02' } })
    fireEvent.change(end, { target: { value: '2025-01-02' } })
    fireEvent.change(riskFree, { target: { value: '6.5' } })
    fireEvent.keyDown(source, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: 'Historify（本地）' }))

    expect(start).toHaveValue('2024-01-02')
    expect(end).toHaveValue('2025-01-02')
    expect(riskFree).toHaveValue(6.5)
    expect(source).toHaveTextContent('Historify（本地）')
  })
})
