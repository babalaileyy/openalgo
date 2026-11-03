/**
 * The side panel rail on the right edge of the charting terminal.
 *
 * Mirrors DrawingRail on the left, sharing its button metrics and hover label
 * through railStyles so the two edges of the workspace cannot drift apart. The
 * difference is what a click means: a drawing tool arms, a rail button here
 * opens or closes the panel beside it, and clicking the open panel's own button
 * closes it.
 */

import { Bot, FileCode2, FlaskConical, type LucideIcon, Shapes, Table2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { ChromeIcon, lineStroke24 } from '@/lib/trading/glyphs'
import { cn } from '@/lib/utils'
import { RAIL_BTN, RAIL_BTN_ON, RAIL_GLYPH_PX } from './railStyles'
import { Tip } from './Tip'

const PANELS = [
  // Nothing here is a metaphor: the watchlist is a list of instruments, the
  // option chain is a table of strikes, and the objects panel is the shapes
  // drawn on the chart. The assistant is the one thing on the rail that is
  // not a view of the market, so it is last rather than wedged between two
  // that are.
  //
  // Every panel carries a glyph. Objects spelled its label down the rail
  // instead, which made one button twice the height of the three beside it
  // and turned a row of icons into a row with a word in it.
  //
  // A string names the engine's chrome glyph, so the right rail is drawn from
  // the same set as the toolbar and the drawing rail. The four with no fitting
  // glyph there keep the app's icon, at the same line weight.
  {
    id: 'watchlist',
    label: '自选列表',
    icon: 'watchlist',
    hint: '查看自选品种的实时价格，点击可打开图表',
  },
  {
    id: 'options',
    label: '期权链',
    icon: Table2,
    hint: '查看当前标的的期权行权价，点击可打开图表',
  },
  {
    id: 'objects',
    label: '图表对象',
    icon: Shapes,
    hint: '查看当前图表上的画线、指标和线条',
  },
  // Beside the objects panel, because both answer "what is on this chart" and
  // an alert line is one of the things drawn on it.
  {
    id: 'alerts',
    label: '提醒',
    icon: 'bell',
    hint: '查看图表提醒及触发记录',
  },
  // The values under the crosshair: the bar and every study on it. With the
  // two above because it too reads the chart rather than the market.
  {
    id: 'data',
    label: '数据窗口',
    icon: 'crosshair',
    hint: '查看十字光标处的 K 线和指标数值',
  },
  {
    id: 'scripts',
    label: '脚本',
    icon: FileCode2,
    hint: '编写和编辑 OpenScript 指标与策略',
  },
  // Beside the editor, because writing a strategy and asking what it would
  // have done are one activity seen twice, and a trader moves between the two
  // constantly while a strategy is taking shape.
  {
    id: 'backtest',
    label: '回测',
    icon: FlaskConical,
    hint: '使用当前图表的历史数据回测策略',
  },
  // After the backtest, because that is the order the work happens in: a
  // strategy is written, tested over history, and only then run. This is the
  // one panel whose rows are processes on the server rather than things in
  // this tab, and they outlive it.
  {
    id: 'strategies',
    label: '策略',
    icon: 'trading',
    hint: '查看服务器上运行的实盘或模拟策略',
  },
  {
    id: 'agent',
    label: '助手',
    icon: Bot,
    hint: '询问图表内容或请求调整图表',
  },
] as const

/**
 * Which panel the rail is showing, or null when the workspace is all chart.
 *
 * Derived from the list rather than written beside it, so adding a panel is
 * one entry above and nothing else: the page that restores a remembered panel
 * and the page that renders one both narrow through this union.
 */
export type PanelId = (typeof PANELS)[number]['id']

/**
 * Whether a remembered value still names a panel.
 *
 * Storage outlives a release, so a panel that is renamed or removed leaves a
 * string behind that no longer resolves. Exported so the page reopening a
 * panel checks the same list the rail renders.
 */
export function isPanelId(value: string | null): value is PanelId {
  return PANELS.some((panel) => panel.id === value)
}

/** A panel's glyph: the engine's when it has one, the app's otherwise, at one weight. */
function RailGlyph({ icon }: { icon: string | LucideIcon }) {
  if (typeof icon === 'string') return <ChromeIcon id={icon} size={RAIL_GLYPH_PX} />
  const Icon = icon
  return (
    <Icon
      width={RAIL_GLYPH_PX}
      height={RAIL_GLYPH_PX}
      strokeWidth={lineStroke24(RAIL_GLYPH_PX)}
      aria-hidden="true"
    />
  )
}

interface Props {
  active: PanelId | null
  onSelect(panel: PanelId | null): void
}

export function RightRail({ active, onSelect }: Props) {
  /**
   * Where focus goes when a panel closes.
   *
   * The panel unmounts with focus inside it, so without this focus falls to
   * <body> and the next Tab restarts at the top of the document. Escape
   * closing a panel is the common case, and it happens with the keyboard.
   */
  const buttonsRef = useRef<Record<string, HTMLButtonElement | null>>({})
  const previous = useRef<PanelId | null>(active)

  useEffect(() => {
    const closed = previous.current
    previous.current = active
    if (active !== null || closed === null) return
    // Only reclaim focus if it was lost to the body with the panel.
    if (document.activeElement === document.body) buttonsRef.current[closed]?.focus()
  }, [active])

  return (
    <div className="oa-rail border-l pb-1.5">
      {PANELS.map(({ id, label, icon: Icon, hint }) => {
        const isOpen = active === id
        return (
          <Tip
            key={id}
            side="left"
            tip={{ title: label, chord: isOpen ? 'Esc' : undefined, sub: isOpen ? '关闭' : hint }}
          >
            <div className="group relative">
              <button
                type="button"
                ref={(node) => {
                  buttonsRef.current[id] = node
                }}
                // Clicking the open panel's own button closes it. The rail is the
                // only way back to a full-width chart, so the button that opened
                // a panel has to be the button that puts it away.
                onClick={() => onSelect(isOpen ? null : id)}
                className={cn(RAIL_BTN, isOpen && RAIL_BTN_ON)}
                aria-label={label}
                aria-expanded={isOpen}
                // Only while the panel exists. Pointing aria-controls at an id
                // that is not in the document is worse than omitting it.
                aria-controls={isOpen ? `oa-panel-${id}` : undefined}
              >
                <RailGlyph icon={Icon} />
              </button>
            </div>
          </Tip>
        )
      })}
    </div>
  )
}
