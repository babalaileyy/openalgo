import { fireEvent, render, screen, within } from '@testing-library/react'
import { createTimeframePreferences } from 'openalgo-charts/widget'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TimeframeMenu } from './TimeframeMenu'

beforeEach(() => localStorage.clear())
const groups = [
  { label: 'minutes', items: ['1m', '5m'] },
  { label: 'days', items: ['D'] },
]
const store = () =>
  createTimeframePreferences({ storage: localStorage, key: 'test-intervals', defaults: ['5m'] })
const supports = (code: string) => !code.endsWith('s')

describe('custom interval controls', () => {
  it('adds seven minutes, favorites it, restores it and removes it without changing the chart', () => {
    const preferences = store(),
      select = vi.fn()
    const view = render(
      <TimeframeMenu
        current="5m"
        groups={groups}
        preferences={preferences}
        canSelectInterval={supports}
        onSelect={select}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '周期 5m' }))
    fireEvent.click(screen.getByRole('button', { name: '添加自定义周期' }))
    fireEvent.change(screen.getByLabelText('周期'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: '添加', exact: true }))
    expect(select).toHaveBeenLastCalledWith('7m')
    fireEvent.click(screen.getByRole('button', { name: '周期 5m' }))
    fireEvent.click(screen.getByRole('button', { name: '收藏 7 分钟' }))
    expect(preferences.favorites()).toContain('7m')
    expect(store().custom()).toContain('7m')
    select.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '移除 7 分钟' }))
    expect(preferences.custom()).not.toContain('7m')
    expect(preferences.favorites()).not.toContain('7m')
    expect(select).not.toHaveBeenCalled()
    view.unmount()
    preferences.destroy()
  })

  it('shares favorites across panes while selection belongs to the clicked pane', () => {
    const preferences = store(),
      a = vi.fn(),
      b = vi.fn()
    preferences.addCustom('7m')
    preferences.toggle('7m')
    render(
      <>
        <div data-testid="a">
          <TimeframeMenu
            current="5m"
            groups={groups}
            preferences={preferences}
            canSelectInterval={supports}
            onSelect={a}
          />
        </div>
        <div data-testid="b">
          <TimeframeMenu
            current="D"
            groups={groups}
            preferences={preferences}
            canSelectInterval={supports}
            onSelect={b}
          />
        </div>
      </>
    )
    fireEvent.click(
      within(screen.getByTestId('b')).getByRole('button', { name: '收藏的周期 7m' })
    )
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledWith('7m')
    preferences.destroy()
  })

  it('keeps saved empty favorites and disables choices after a broker capability change', () => {
    const preferences = store(),
      select = vi.fn()
    preferences.toggle('5m')
    const view = render(
      <TimeframeMenu
        current="5m"
        groups={groups}
        preferences={preferences}
        canSelectInterval={supports}
        onSelect={select}
      />
    )
    expect(screen.queryByRole('button', { name: /收藏的周期/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '周期 5m' }))
    fireEvent.click(screen.getByRole('button', { name: '收藏 5 分钟' }))
    view.rerender(
      <TimeframeMenu
        current="5m"
        groups={groups}
        preferences={preferences}
        canSelectInterval={() => false}
        onSelect={select}
      />
    )
    expect(screen.getByRole('button', { name: '收藏的周期 5m' })).toBeDisabled()
    expect(store().favorites()).toEqual(['5m'])
    preferences.destroy()
  })

  it('validates whole numbers and refuses unavailable seconds without saving them', () => {
    const preferences = store()
    render(
      <TimeframeMenu
        current="5m"
        groups={groups}
        preferences={preferences}
        canSelectInterval={supports}
        onSelect={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '周期 5m' }))
    fireEvent.click(screen.getByRole('button', { name: '添加自定义周期' }))
    fireEvent.change(screen.getByLabelText('周期'), { target: { value: '1.5' } })
    expect(screen.getByRole('button', { name: '添加', exact: true })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('类型'), { target: { value: 'seconds' } })
    fireEvent.change(screen.getByLabelText('周期'), { target: { value: '5' } })
    expect(screen.getByRole('button', { name: '添加', exact: true })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('数据源')
    expect(preferences.custom()).toEqual([])
    preferences.destroy()
  })
})
