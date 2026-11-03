import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent, within } from '@/test/test-utils'
import { type CatalogEntry, IndicatorPickerDialog } from './IndicatorPickerDialog'

/** Shaped like `indicatorCatalog()`: the engine's four real categories. */
const CATALOG: CatalogEntry[] = [
  { id: 'sma', name: 'Simple Moving Average', category: 'Trend' },
  { id: 'ema', name: 'Exponential Moving Average', category: 'Trend' },
  { id: 'adx', name: 'Average Directional Index', category: 'Trend' },
  { id: 'rsi', name: 'Relative Strength Index', category: 'Momentum' },
  { id: 'macd', name: 'MACD', category: 'Momentum' },
  { id: 'atr', name: 'Average True Range', category: 'Volatility' },
  { id: 'obv', name: 'On Balance Volume', category: 'Volume' },
]

const ACTIVE = [
  { id: 'inst-1', name: 'RSI 14' },
  { id: 'inst-2', name: 'SMA 20' },
]

function renderPicker(over: Partial<Parameters<typeof IndicatorPickerDialog>[0]> = {}) {
  const props = {
    open: true,
    catalog: CATALOG,
    active: ACTIVE,
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onSettings: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
  render(<IndicatorPickerDialog {...props} />)
  return props
}

/** The scrollable list, so a rail button named 'Trend' is not mistaken for a row. */
const list = () =>
  screen
    .getByLabelText('搜索指标')
    .closest('div')
    ?.parentElement?.parentElement?.querySelector('.min-w-0') as HTMLElement

beforeEach(() => localStorage.clear())

describe('IndicatorPickerDialog', () => {
  it('builds the rail from the categories the registry actually uses', () => {
    renderPicker()
    // Counted, not guessed: three Trend, two Momentum, one each of the others.
    expect(screen.getByRole('button', { name: '趋势，3 个指标' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '动量，2 个指标' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '波动率，1 个指标' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '成交量，1 个指标' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '全部，7 个指标' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '已添加，2 个指标' })).toBeInTheDocument()
  })

  it('invents no section the data cannot fill', () => {
    renderPicker()
    // No author, no popularity, no community: this is a local registry.
    for (const absent of ['Editors', 'Trending', 'Store', 'Purchased', 'Author', 'Boosts']) {
      expect(screen.queryByText(new RegExp(absent, 'i'))).not.toBeInTheDocument()
    }
  })

  it('filters to one category and sorts it alphabetically', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByRole('button', { name: '趋势，3 个指标' }))
    const names = within(list())
      .getAllByTitle(/^添加 /)
      .map((b) => b.textContent)
    expect(names).toEqual([
      'Average Directional Index',
      'Exponential Moving Average',
      'Simple Moving Average',
    ])
    expect(within(list()).queryByTitle('添加 MACD（指数平滑异同移动平均线）')).not.toBeInTheDocument()
  })

  it('searches by name and by registry id', async () => {
    const user = userEvent.setup()
    renderPicker()
    const box = screen.getByLabelText('搜索指标')
    await user.type(box, 'obv') // the id, not the name
    expect(within(list()).getByTitle('添加 On Balance Volume')).toBeInTheDocument()
    expect(within(list()).queryByTitle('添加 MACD（指数平滑异同移动平均线）')).not.toBeInTheDocument()
  })

  it('finds a built-in by its Chinese name and adds its original id', async () => {
    const user = userEvent.setup()
    const props = renderPicker({ catalog: [{ id: 'rsi', name: 'RSI', category: 'Momentum' }] })
    await user.type(screen.getByLabelText('搜索指标'), '相对强弱')
    await user.click(within(list()).getByTitle('添加 RSI（相对强弱指数）'))
    expect(props.onAdd).toHaveBeenCalledWith('rsi')
  })

  it('adds on click and remembers it as recent', async () => {
    const user = userEvent.setup()
    const props = renderPicker()
    await user.click(within(list()).getByTitle('添加 MACD（指数平滑异同移动平均线）'))
    expect(props.onAdd).toHaveBeenCalledWith('macd')
    expect(JSON.parse(localStorage.getItem('oa-trading-recent-indicators') ?? '[]')).toEqual([
      'macd',
    ])
    await user.click(screen.getByRole('button', { name: '最近使用，1 个指标' }))
    expect(within(list()).getByTitle('添加 MACD（指数平滑异同移动平均线）')).toBeInTheDocument()
  })

  it('keeps favourites across a close and reopen', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <IndicatorPickerDialog
        open
        catalog={CATALOG}
        active={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onSettings={vi.fn()}
        onClose={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: '收藏 MACD（指数平滑异同移动平均线）' }))
    expect(JSON.parse(localStorage.getItem('oa-trading-fav-indicators') ?? '[]')).toEqual(['macd'])
    unmount()

    renderPicker()
    await user.click(screen.getByRole('button', { name: '收藏，1 个指标' }))
    expect(within(list()).getByTitle('添加 MACD（指数平滑异同移动平均线）')).toBeInTheDocument()
  })

  it('offers settings and remove on active instances, never add', async () => {
    const user = userEvent.setup()
    const props = renderPicker()
    await user.click(screen.getByRole('button', { name: '已添加，2 个指标' }))
    // Instances, not descriptors: two SMAs would differ only by instance id.
    await user.click(within(list()).getAllByRole('button', { name: '设置' })[0])
    expect(props.onSettings).toHaveBeenCalledWith('inst-1')
    await user.click(within(list()).getAllByRole('button', { name: '移除' })[1])
    expect(props.onRemove).toHaveBeenCalledWith('inst-2')
    expect(within(list()).queryByTitle(/^添加 /)).not.toBeInTheDocument()
  })

  it('says the library is loading rather than showing an empty shelf', () => {
    renderPicker({ catalog: [] })
    expect(screen.getByText('正在加载指标库…')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    renderPicker({ open: false })
    expect(screen.queryByText('指标')).not.toBeInTheDocument()
  })
})

describe("the trader's own studies", () => {
  /** The shipped library, plus two studies written in the scripts panel. */
  const WITH_MINE: CatalogEntry[] = [
    ...CATALOG,
    { id: 'openscript:supertrend', name: 'Supertrend', category: 'OpenScript' },
    { id: 'openscript:indicator-table', name: 'Indicator table', category: 'OpenScript' },
  ]

  it('gives them a section of their own, above the library', async () => {
    renderPicker({ catalog: WITH_MINE })
    const mine = screen.getByRole('button', { name: /我的脚本，2 个指标/ })
    expect(mine).toBeInTheDocument()
    await userEvent.click(mine)
    expect(within(list()).getByText('Supertrend')).toBeInTheDocument()
    expect(within(list()).getByText('Indicator table')).toBeInTheDocument()
    // The shipped library is not in this section.
    expect(within(list()).queryByText('Relative Strength Index')).toBeNull()
  })

  it('does not also list them as a library category', () => {
    // Listed in both places, a reader has to check twice to know they have
    // seen everything once, and the library's counts stop describing what
    // shipped.
    renderPicker({ catalog: WITH_MINE })
    expect(screen.queryByRole('button', { name: /^OpenScript， / })).toBeNull()
  })

  it('keeps them out of the library categories they happen to name', async () => {
    // A study is free to call itself Trend. It still belongs to the trader,
    // and the Trend row still counts three because that is what shipped.
    const labelled: CatalogEntry[] = [
      ...CATALOG,
      { id: 'openscript:mine', name: 'My trend study', category: 'Trend' },
    ]
    renderPicker({ catalog: labelled })
    expect(screen.getByRole('button', { name: /趋势，3 个指标/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /趋势，3 个指标/ }))
    expect(within(list()).queryByText('My trend study')).toBeNull()
  })

  it('says where to write one when there are none', async () => {
    // The section exists before anything is in it, so it has to explain
    // itself rather than read as a feature that is broken.
    renderPicker()
    await userEvent.click(screen.getByRole('button', { name: /我的脚本，0 个指标/ }))
    expect(within(list()).getByText(/尚无脚本/)).toBeInTheDocument()
  })

  it('still finds one by search from All', async () => {
    // Search runs over the chosen section, and All is still everything.
    renderPicker({ catalog: WITH_MINE })
    await userEvent.click(screen.getByRole('button', { name: /全部，9 个指标/ }))
    await userEvent.type(screen.getByLabelText('搜索指标'), 'supertrend')
    expect(within(list()).getByText('Supertrend')).toBeInTheDocument()
  })
})
