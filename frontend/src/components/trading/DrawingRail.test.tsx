/**
 * The drawing rail. Everything new lives in slots the rail already had: the
 * eraser in the cursor's flyout, the magnet modes in the magnet's, and the
 * actions on the selection in the trash button's. These pin both what each
 * does and that the column did not grow.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrawStats } from '@/lib/trading/terminal'
import { cleanup, fireEvent, render, screen, userEvent, within } from '@/test/test-utils'
import { DrawingRail, RAIL_LAST_KEY } from './DrawingRail'

const STATS: DrawStats = {
  count: 3,
  canUndo: true,
  canRedo: false,
  hasSelection: false,
  magnet: false,
  magnetMode: 'off',
  removable: 3,
  selectable: 2,
  stay: false,
  tool: null,
  shortcuts: { 'trend-line': 'Alt+T' },
}

function rail(
  stats: Partial<DrawStats> = {},
  extra: { latched?: boolean; folded?: boolean; onFold?(): void } = {}
) {
  const handlers = {
    onPick: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onDeleteSelected: vi.fn(),
    onRemoveAll: vi.fn(),
    onSelectAll: vi.fn(),
    onHideSelected: vi.fn(),
    onLockSelected: vi.fn(),
    onMagnet: vi.fn(),
    onStay: vi.fn(),
    onShortcut: vi.fn(() => true),
  }
  const view = render(<DrawingRail stats={{ ...STATS, ...stats }} {...extra} {...handlers} />)
  return { ...handlers, view }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('the rail keeps its size', () => {
  it('has the same seventeen buttons it had, with no new column', () => {
    rail()
    // Cursor, eleven groups, magnet, keep selected, undo, redo, trash.
    const main = screen
      .getAllByRole('button')
      .filter((b) => !/(menu|菜单)$/.test(b.getAttribute('aria-label') ?? ''))
    expect(main).toHaveLength(17)
  })
})

describe('eraser', () => {
  it('is picked from the cursor flyout and shown on the cursor button', async () => {
    const { onPick, view } = rail()
    await userEvent.click(screen.getByRole('button', { name: '光标菜单' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /橡皮擦/ }))
    expect(onPick).toHaveBeenCalledWith('eraser')

    view.rerender(
      <DrawingRail
        stats={{ ...STATS, tool: 'eraser' }}
        onPick={onPick}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onDeleteSelected={vi.fn()}
        onRemoveAll={vi.fn()}
        onSelectAll={vi.fn()}
        onHideSelected={vi.fn()}
        onLockSelected={vi.fn()}
        onMagnet={vi.fn()}
        onStay={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: '橡皮擦' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('ends on Escape', () => {
    const { onPick } = rail({ tool: 'eraser' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onPick).toHaveBeenCalledWith(null)
  })
})

describe('magnet', () => {
  it('turns on to the last mode used and off again', () => {
    const { onMagnet, view } = rail({ magnetMode: 'weak', magnet: true })
    expect(screen.getByRole('button', { name: '磁吸' })).toHaveAttribute('aria-pressed', 'true')
    // The corner dot: a ring for weak, solid for strong.
    expect(screen.getByRole('button', { name: '磁吸' })).toHaveAttribute('data-mode', 'weak')
    fireEvent.click(screen.getByRole('button', { name: '磁吸' }))
    expect(onMagnet).toHaveBeenLastCalledWith('off')

    view.unmount()
    const off = rail({ magnetMode: 'off' })
    fireEvent.click(screen.getByRole('button', { name: '磁吸' }))
    expect(off.onMagnet).toHaveBeenLastCalledWith('strong')
  })

  it('offers the three modes and says how to snap with it off', async () => {
    const { onMagnet } = rail()
    await userEvent.click(screen.getByRole('button', { name: '磁吸菜单' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByText(/按住 Ctrl 临时吸附/)).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole('menuitem', { name: /弱磁吸/ }))
    expect(onMagnet).toHaveBeenCalledWith('weak')
  })
})

describe('trash', () => {
  it('deletes the selection on a click', () => {
    const { onDeleteSelected } = rail({ hasSelection: true })
    fireEvent.click(screen.getByRole('button', { name: '删除选中画线' }))
    expect(onDeleteSelected).toHaveBeenCalled()
  })

  it('opens its menu with nothing selected, and never removes on that click', async () => {
    const { onRemoveAll, onDeleteSelected } = rail()
    fireEvent.click(screen.getByRole('button', { name: '画线操作' }))
    const menu = screen.getByRole('menu')
    expect(onRemoveAll).not.toHaveBeenCalled()
    expect(onDeleteSelected).not.toHaveBeenCalled()
    expect(
      within(menu).getByRole('menuitem', { name: /全选画线（2）/ })
    ).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole('menuitem', { name: /移除所有画线（3）/ }))
    // The pane asks before anything goes; the rail only asks the pane.
    expect(onRemoveAll).toHaveBeenCalledTimes(1)
  })

  it('offers hide, lock and delete for a selection from its right-click', async () => {
    const { onHideSelected, onLockSelected } = rail({ hasSelection: true })
    fireEvent.contextMenu(screen.getByRole('button', { name: '删除选中画线' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /隐藏选中项/ }))
    expect(onHideSelected).toHaveBeenCalled()
    fireEvent.contextMenu(screen.getByRole('button', { name: '删除选中画线' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /锁定选中项/ }))
    expect(onLockSelected).toHaveBeenCalled()
  })
})

describe('tool groups', () => {
  it('selects the original tool from its translated menu name', async () => {
    const { onPick } = rail()
    await userEvent.click(screen.getByRole('button', { name: '线条菜单' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /趋势线/ }))
    expect(onPick).toHaveBeenCalledWith('trend-line')
  })

  it('shows the last tool used and re-arms it; a double-click holds it', async () => {
    localStorage.setItem(RAIL_LAST_KEY, JSON.stringify({ lines: 'ray' }))
    const { onPick } = rail()
    const lines = screen.getByRole('button', { name: '线条' })
    fireEvent.pointerEnter(lines.parentElement as Element)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('射线')

    fireEvent.click(lines)
    expect(onPick).toHaveBeenLastCalledWith('ray')
    fireEvent.doubleClick(lines)
    expect(onPick).toHaveBeenLastCalledWith('ray', true)
  })

  it('remembers a tool armed from anywhere as its group’s last', () => {
    rail({ tool: 'horizontal-line' })
    expect(JSON.parse(localStorage.getItem(RAIL_LAST_KEY) ?? '{}')).toEqual({
      lines: 'horizontal-line',
    })
  })

  it('ignores a remembered tool that no longer belongs to the group', async () => {
    localStorage.setItem(RAIL_LAST_KEY, JSON.stringify({ lines: 'gartley' }))
    rail()
    fireEvent.pointerEnter(screen.getByRole('button', { name: '线条' }).parentElement as Element)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('从列表选择工具')
  })

  it('marks a held tool and says Escape releases it, with its shortcut', async () => {
    rail({ tool: 'trend-line' }, { latched: true })
    fireEvent.pointerEnter(screen.getByRole('button', { name: '线条' }).parentElement as Element)
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('趋势线')
    expect(tip).toHaveTextContent('Alt + T')
    expect(tip).toHaveTextContent('持续使用，直到按 Esc')
  })

  it('labels a disabled button too, and hides the label on a press', async () => {
    rail({ canRedo: false })
    const redo = screen.getByRole('button', { name: '重做图表修改' })
    fireEvent.pointerEnter(redo.parentElement as Element)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('重做图表修改')
    fireEvent.pointerDown(redo.parentElement as Element)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

describe('keys', () => {
  it('passes a key to the chart, but never one typed into a field or a dialog', () => {
    const { onShortcut } = rail()
    fireEvent.keyDown(document.body, { key: 'c', ctrlKey: true })
    expect(onShortcut).toHaveBeenCalledTimes(1)

    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: 'v', ctrlKey: true })
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.appendChild(document.createElement('button'))
    document.body.appendChild(dialog)
    fireEvent.keyDown(dialog.firstElementChild as Element, { key: 'c', ctrlKey: true })
    expect(onShortcut).toHaveBeenCalledTimes(1)
  })
})

describe('fold', () => {
  it('is the last control when the page offers it, and folds on a click', () => {
    const onFold = vi.fn()
    rail({}, { onFold })
    const buttons = screen.getAllByRole('button')
    const fold = screen.getByRole('button', { name: '隐藏画线工具' })
    expect(buttons.at(-1)).toBe(fold)
    fireEvent.click(fold)
    expect(onFold).toHaveBeenCalledTimes(1)
  })

  it('is absent without a handler, so the rail never shows a control with nothing behind it', () => {
    rail()
    expect(screen.queryByRole('button', { name: '隐藏画线工具' })).toBeNull()
  })

  it('hides the rail when folded but keeps passing keys to the chart', () => {
    const { onShortcut, view } = rail({}, { folded: true, onFold: vi.fn() })
    expect(view.container.querySelector('[data-drawing-rail]')).toHaveClass('hidden')
    fireEvent.keyDown(document.body, { key: 't', altKey: true })
    expect(onShortcut).toHaveBeenCalledTimes(1)
  })
})
