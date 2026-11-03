/**
 * The data window: the bar's open, high, low, close and volume at the
 * crosshair, and every study's values on the same bar, for the focused pane.
 *
 * The readings are the library's (`mountDataWindow`). It follows the
 * crosshair by writing text into the rows it built, batched to one update per
 * microtask, so sweeping the crosshair costs no React render at all. React
 * only decides which chart the panel reads, and that changes when focus moves
 * or the pane builds a new chart, not when the pointer moves.
 *
 * A side panel, so it takes width only while it is open; closed, the plot is
 * as wide as it ever was.
 */
import type { Chart } from 'openalgo-charts'
import {
  applyTokens,
  type DataWindowHandle,
  injectWidgetStyles,
  mountDataWindow,
  WIDGET_COMPONENT_CSS,
  type WidgetContext,
  widgetTokens,
} from 'openalgo-charts/widget'
import { useEffect, useRef } from 'react'
import { buildChartTheme, isLightTheme } from '@/lib/trading/chartTheme'
import { useThemeStore } from '@/stores/themeStore'
import { PANEL_HEADER, PanelShell } from './panelShell'

interface Props {
  /** The focused pane's chart, or null while it has none. */
  chart: Chart | null
  paneLabel: string
}

/**
 * Mount the readings into `host` for `chart`. The data window reads the
 * chart, the document and the locale from its context and nothing else.
 */
export function mountChartDataWindow(chart: Chart, host: HTMLElement): DataWindowHandle {
  const doc = host.ownerDocument
  injectWidgetStyles(doc, WIDGET_COMPONENT_CSS)
  const labels: Record<string, string> = {
    'schema.ui.data.title': '数据窗口',
    'schema.ui.data.unavailable': '暂无数据',
    'schema.ui.data.price': '价格',
    'schema.ui.data.open': '开盘价',
    'schema.ui.data.high': '最高价',
    'schema.ui.data.low': '最低价',
    'schema.ui.data.close': '收盘价',
    'schema.ui.data.volume': '成交量',
    'schema.ui.data.oi': '持仓量',
  }
  const context = {
    chart,
    document: doc,
    locale: 'zh-CN',
    translate: (key: string) => labels[key],
  } as unknown as WidgetContext
  return mountDataWindow(context, host)
}

export function DataWindowPanel({ chart, paneLabel }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const { mode, appMode } = useThemeStore()

  useEffect(() => {
    const host = hostRef.current
    if (!chart || !host || chart.isDestroyed) return
    const handle = mountChartDataWindow(chart, host)
    return () => handle.destroy()
  }, [chart])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const light = isLightTheme(mode, appMode)
    root.dataset.theme = light ? 'light' : 'dark'
    applyTokens(root, widgetTokens(buildChartTheme(mode, appMode), light ? 'light' : 'dark'))
  }, [mode, appMode])

  return (
    <PanelShell
      id="oa-panel-data"
      label="数据窗口"
      storageKey="oa-trading-data-width"
      defaultWidth={280}
    >
      <div className={PANEL_HEADER}>
        <h2 className="text-sm font-medium">数据窗口</h2>
        <span className="min-w-0 truncate text-xs text-muted-foreground">{paneLabel}</span>
      </div>
      {chart ? null : (
        <p className="px-3 py-4 text-xs text-muted-foreground">
          请先在此窗格加载图表，再查看数值。
        </p>
      )}
      {/* The library's own root class carries its tokens and styles; the
          inline style undoes the full-widget grid it implies. */}
      <div
        ref={rootRef}
        className="oac-widget min-h-0 flex-1"
        style={{ display: 'block', height: 'auto', overflowY: 'auto', background: 'transparent' }}
      >
        <div ref={hostRef} data-data-window />
      </div>
    </PanelShell>
  )
}
