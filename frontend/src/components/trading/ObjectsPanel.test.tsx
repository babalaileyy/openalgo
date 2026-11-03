import type { ChartObjectSnapshot, ChartObjects } from 'openalgo-charts'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, userEvent } from '@/test/test-utils'
import { ObjectsPanel } from './ObjectsPanel'

const capabilities = (
  patch: Partial<ChartObjectSnapshot['capabilities']> = {}
): ChartObjectSnapshot['capabilities'] => ({
  select: false,
  visibility: false,
  lock: false,
  remove: false,
  settings: false,
  focus: false,
  ...patch,
})

const primary: ChartObjectSnapshot = {
  id: 'source:primary',
  sourceId: 'primary',
  kind: 'source',
  name: 'NSE:BHEL',
  paneIndex: 0,
  visible: true,
  selected: false,
  capabilities: capabilities({ settings: true }),
}

const drawing: ChartObjectSnapshot = {
  id: 'drawing:trend-1',
  sourceId: 'trend-1',
  kind: 'drawing',
  name: 'Trend line',
  paneIndex: 0,
  visible: true,
  locked: false,
  selected: true,
  capabilities: capabilities({
    select: true,
    visibility: true,
    lock: true,
    remove: true,
    focus: true,
  }),
}

function model(initial: readonly ChartObjectSnapshot[]) {
  let objects = initial
  const listeners = new Set<(next: readonly ChartObjectSnapshot[]) => void>()
  const off = vi.fn()
  return {
    value: {
      list: () => objects,
      subscribe: (listener: (next: readonly ChartObjectSnapshot[]) => void) => {
        listeners.add(listener)
        listener(objects)
        return () => {
          listeners.delete(listener)
          off()
        }
      },
      select: vi.fn(() => true),
      setVisible: vi.fn(() => true),
      setLocked: vi.fn(() => true),
      remove: vi.fn(() => true),
      openSettings: vi.fn(() => true),
      focus: vi.fn(() => true),
    } as unknown as ChartObjects,
    publish(next: readonly ChartObjectSnapshot[]) {
      objects = next
      for (const listener of listeners) listener(objects)
    },
    off,
  }
}

describe('ObjectsPanel', () => {
  it('shows an indicator in English and Chinese and searches its Chinese name', async () => {
    const indicator: ChartObjectSnapshot = {
      ...drawing,
      id: 'indicator:rsi',
      kind: 'indicator',
      name: 'RSI 14',
    }
    const objects = model([indicator])
    render(<ObjectsPanel model={objects.value} paneLabel="窗格 1" />)
    expect(screen.getByText('RSI（相对强弱指数） 14')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox', { name: '搜索图表对象' }), '相对强弱')
    expect(screen.getByText('RSI（相对强弱指数） 14')).toBeInTheDocument()
  })

  it('searches the active pane inventory and reports external data state', async () => {
    const external: ChartObjectSnapshot = {
      id: 'indicator:oi-1',
      sourceId: 'oi',
      kind: 'indicator',
      name: 'Open interest',
      paneIndex: 1,
      visible: true,
      selected: false,
      dataStatus: { state: 'loading' },
      capabilities: capabilities({ select: true, visibility: true, remove: true }),
    }
    const objects = model([primary, drawing, external])
    render(<ObjectsPanel model={objects.value} paneLabel="Pane 2" />)

    expect(screen.getByRole('complementary', { name: '图表对象' })).toBeInTheDocument()
    expect(screen.getByText('Pane 2')).toBeInTheDocument()
    expect(screen.getByText(/加载中/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择 Open interest' })).toHaveAccessibleDescription(
      '指标 · 图表窗格 2 · 加载中 · 可见'
    )

    await userEvent.type(screen.getByRole('searchbox', { name: '搜索图表对象' }), 'interest')
    expect(screen.getByText('Open interest')).toBeInTheDocument()
    expect(screen.queryByText('Trend line')).not.toBeInTheDocument()
    expect(screen.queryByText('NSE:BHEL')).not.toBeInTheDocument()

    await userEvent.clear(screen.getByRole('searchbox', { name: '搜索图表对象' }))
    await userEvent.type(screen.getByRole('searchbox', { name: '搜索图表对象' }), 'pane 2')
    expect(screen.getByText('Open interest')).toBeInTheDocument()
    expect(screen.queryByText('Trend line')).not.toBeInTheDocument()
  })

  it('offers only supported actions and sends them to the shared model', async () => {
    const objects = model([primary, drawing])
    render(<ObjectsPanel model={objects.value} paneLabel="Pane 1" />)

    expect(screen.queryByRole('button', { name: '移除 NSE:BHEL' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '隐藏 NSE:BHEL' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '设置 NSE:BHEL' }))
    expect(objects.value.openSettings).toHaveBeenCalledWith('source:primary')

    await userEvent.click(screen.getByRole('button', { name: '选择 Trend line' }))
    expect(screen.getByRole('button', { name: '选择 Trend line' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: '选择 Trend line' })).toHaveAccessibleDescription(
      '画线 · 图表窗格 1 · 可见 · 未锁定'
    )
    await userEvent.click(screen.getByRole('button', { name: '隐藏 Trend line' }))
    await userEvent.click(screen.getByRole('button', { name: '锁定 Trend line' }))
    await userEvent.click(screen.getByRole('button', { name: '定位 Trend line' }))
    await userEvent.click(screen.getByRole('button', { name: '移除 Trend line' }))

    expect(objects.value.select).toHaveBeenCalledWith('drawing:trend-1', false)
    expect(objects.value.setVisible).toHaveBeenCalledWith('drawing:trend-1', false)
    expect(objects.value.setLocked).toHaveBeenCalledWith('drawing:trend-1', true)
    expect(objects.value.focus).toHaveBeenCalledWith('drawing:trend-1')
    expect(objects.value.remove).toHaveBeenCalledWith('drawing:trend-1')
  })

  it('reports an action rejected by the current model', async () => {
    const objects = model([drawing])
    objects.value.setVisible = vi.fn(() => false)
    render(<ObjectsPanel model={objects.value} paneLabel="Pane 1" />)

    await userEvent.click(screen.getByRole('button', { name: '隐藏 Trend line' }))

    expect(screen.getByRole('alert')).toHaveTextContent('无法隐藏 Trend line')
  })

  it('follows model publications and releases the old subscription', async () => {
    const first = model([primary])
    const second = model([drawing])
    const view = render(<ObjectsPanel model={first.value} paneLabel="Pane 1" />)

    await act(async () => {
      first.publish([primary, drawing])
    })
    expect(screen.getByText('Trend line')).toBeInTheDocument()

    view.rerender(<ObjectsPanel model={second.value} paneLabel="Pane 2" />)
    expect(first.off).toHaveBeenCalledOnce()
    expect(screen.queryByText('NSE:BHEL')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '隐藏 Trend line' }))
    expect(first.value.setVisible).not.toHaveBeenCalled()
    expect(second.value.setVisible).toHaveBeenCalledWith('drawing:trend-1', false)

    view.unmount()
    expect(second.off).toHaveBeenCalledOnce()
  })

  it('shows an empty state while the active pane has no model', () => {
    render(<ObjectsPanel model={null} paneLabel="Pane 1" />)
    expect(screen.getByText('暂无图表对象')).toBeInTheDocument()
  })
})
