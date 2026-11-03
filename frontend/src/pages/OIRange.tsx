import { Check, ChevronsUpDown, Minus, Plus, RotateCcw } from 'lucide-react'
import type * as PlotlyTypes from 'plotly.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type OIDataResponse, oiTrackerApi } from '@/api/oi-tracker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSupportedExchanges } from '@/hooks/useSupportedExchanges'
import Plot from '@/lib/Plot2D'
import { serverSentence } from '@/lib/serverSentence'
import { useThemeStore } from '@/stores/themeStore'
import { showToast } from '@/utils/toast'

// Default number of strikes shown above and below ATM when the page first loads
// or the range is reset. The OI endpoint fetches 23 strikes each side, so the
// quick selectors are capped at what is actually available.
const DEFAULT_AROUND = 10
const AROUND_OPTIONS = [5, 10, 15, 20] as const
const AUTO_REFRESH_MS = 60_000

function convertExpiryForAPI(expiry: string): string {
  if (!expiry) return ''
  const parts = expiry.split('-')
  if (parts.length === 3) {
    return `${parts[0]}${parts[1].toUpperCase()}${parts[2].slice(-2)}`
  }
  return expiry.replace(/-/g, '').toUpperCase()
}

function formatNumber(num: number): string {
  if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`
  if (num >= 100000) return `${(num / 100000).toFixed(1)}L`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

export default function OIRange() {
  const { mode, appMode } = useThemeStore()
  const {
    toolsFnoExchanges: fnoExchanges,
    defaultToolsFnoExchange: defaultFnoExchange,
    defaultUnderlyings,
  } = useSupportedExchanges()
  const isAnalyzer = appMode === 'analyzer'
  const isDark = mode === 'dark' || isAnalyzer

  const [selectedExchange, setSelectedExchange] = useState(defaultFnoExchange)
  const [underlyings, setUnderlyings] = useState<string[]>(
    defaultUnderlyings[defaultFnoExchange] || []
  )
  const [underlyingOpen, setUnderlyingOpen] = useState(false)
  const [selectedUnderlying, setSelectedUnderlying] = useState(
    defaultUnderlyings[defaultFnoExchange]?.[0] || ''
  )
  const [expiries, setExpiries] = useState<string[]>([])
  const [selectedExpiry, setSelectedExpiry] = useState('')
  const [oiData, setOiData] = useState<OIDataResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const requestIdRef = useRef(0)

  // Strike-range filter (client-side over the fetched chain)
  const [minStrike, setMinStrike] = useState<number | null>(null)
  const [maxStrike, setMaxStrike] = useState<number | null>(null)

  // Auto-refresh — OFF by default. When on, refetches every 1 minute.
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Re-sync exchange when broker capabilities load asynchronously
  useEffect(() => {
    setSelectedExchange((prev) =>
      prev && fnoExchanges.some((ex) => ex.value === prev) ? prev : defaultFnoExchange
    )
  }, [defaultFnoExchange, fnoExchanges])

  // Fetch underlyings when exchange changes
  useEffect(() => {
    const defaults = defaultUnderlyings[selectedExchange] || []
    setUnderlyings(defaults)
    setSelectedUnderlying(defaults[0] || '')
    setExpiries([])
    setSelectedExpiry('')
    setOiData(null)
    setMinStrike(null)
    setMaxStrike(null)

    let cancelled = false
    const fetchUnderlyings = async () => {
      try {
        const response = await oiTrackerApi.getUnderlyings(selectedExchange)
        if (cancelled) return
        if (response.status === 'success' && response.underlyings.length > 0) {
          setUnderlyings(response.underlyings)
          if (!response.underlyings.includes(defaults[0])) {
            setSelectedUnderlying(response.underlyings[0])
          }
        }
      } catch {
        // Keep defaults
      }
    }
    fetchUnderlyings()
    return () => {
      cancelled = true
    }
  }, [selectedExchange, defaultUnderlyings[selectedExchange]])

  // Fetch expiries when underlying changes
  useEffect(() => {
    if (!selectedUnderlying) return
    setExpiries([])
    setSelectedExpiry('')
    setOiData(null)
    setMinStrike(null)
    setMaxStrike(null)

    let cancelled = false
    const fetchExpiries = async () => {
      try {
        const response = await oiTrackerApi.getExpiries(selectedExchange, selectedUnderlying)
        if (cancelled) return
        if (response.status === 'success' && response.expiries.length > 0) {
          setExpiries(response.expiries)
          setSelectedExpiry(response.expiries[0])
        } else {
          setExpiries([])
          setSelectedExpiry('')
        }
      } catch {
        if (cancelled) return
        setExpiries([])
        setSelectedExpiry('')
      }
    }
    fetchExpiries()
    return () => {
      cancelled = true
    }
  }, [selectedUnderlying, selectedExchange])

  // Fetch OI data - uses requestIdRef to discard stale responses
  const fetchOIData = useCallback(async () => {
    if (!selectedExpiry) return
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    try {
      const expiryForAPI = convertExpiryForAPI(selectedExpiry)
      const response = await oiTrackerApi.getOIData({
        underlying: selectedUnderlying,
        exchange: selectedExchange,
        expiry_date: expiryForAPI,
      })
      if (requestIdRef.current !== requestId) return
      if (response.status === 'success') {
        setOiData(response)
        setLastUpdated(new Date())
      } else {
        showToast.error(response.message || '获取持仓量数据失败')
      }
    } catch (error) {
      if (requestIdRef.current !== requestId) return
      showToast.error(serverSentence(error, '获取持仓量数据失败'))
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false)
    }
  }, [selectedUnderlying, selectedExpiry, selectedExchange])

  // Only trigger on expiry change - not on fetchOIData identity change,
  // which would cause a stale request with mixed params during exchange switch.
  // biome-ignore lint/correctness/useExhaustiveDependencies: must fire only when selectedExpiry changes; adding fetchOIData would refire on underlying/exchange changes mid-switch and issue a stale request with mixed params
  useEffect(() => {
    if (selectedExpiry) {
      fetchOIData()
    }
  }, [selectedExpiry])

  // Auto-refresh every 1 minute while enabled. The interval is rebound whenever
  // fetchOIData changes (i.e. underlying/exchange/expiry), so it always fetches
  // the current selection, and is cleared on unmount / toggle-off.
  useEffect(() => {
    if (!autoRefresh || !selectedExpiry) return
    const id = window.setInterval(() => {
      fetchOIData()
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [autoRefresh, selectedExpiry, fetchOIData])

  // Sorted strikes + the most common strike interval, derived from the chain
  const sortedStrikes = useMemo(
    () => (oiData?.chain ?? []).map((c) => c.strike).sort((a, b) => a - b),
    [oiData]
  )

  const strikeStep = useMemo(() => {
    if (sortedStrikes.length < 2) return 0
    const counts = new Map<number, number>()
    for (let i = 1; i < sortedStrikes.length; i++) {
      const gap = Math.round((sortedStrikes[i] - sortedStrikes[i - 1]) * 100) / 100
      counts.set(gap, (counts.get(gap) ?? 0) + 1)
    }
    let best = 0
    let bestCount = -1
    for (const [gap, count] of counts) {
      if (count > bestCount) {
        bestCount = count
        best = gap
      }
    }
    return best
  }, [sortedStrikes])

  // Initialise the range to DEFAULT_AROUND strikes either side of ATM on first
  // load, and clamp the existing range to the available strikes on refresh.
  useEffect(() => {
    if (sortedStrikes.length === 0) return
    const lo = sortedStrikes[0]
    const hi = sortedStrikes[sortedStrikes.length - 1]
    const atm = oiData?.atm_strike
    let atmIdx = atm != null ? sortedStrikes.indexOf(atm) : -1
    if (atmIdx < 0) atmIdx = Math.floor(sortedStrikes.length / 2)

    setMinStrike((prev) =>
      prev == null
        ? sortedStrikes[Math.max(0, atmIdx - DEFAULT_AROUND)]
        : Math.min(Math.max(prev, lo), hi)
    )
    setMaxStrike((prev) =>
      prev == null
        ? sortedStrikes[Math.min(sortedStrikes.length - 1, atmIdx + DEFAULT_AROUND)]
        : Math.min(Math.max(prev, lo), hi)
    )
  }, [sortedStrikes, oiData?.atm_strike])

  // Quick selector: N strikes above and below ATM ('all' = full fetched chain)
  const applyAround = useCallback(
    (n: number | 'all') => {
      if (sortedStrikes.length === 0) return
      if (n === 'all') {
        setMinStrike(sortedStrikes[0])
        setMaxStrike(sortedStrikes[sortedStrikes.length - 1])
        return
      }
      const atm = oiData?.atm_strike
      let atmIdx = atm != null ? sortedStrikes.indexOf(atm) : -1
      if (atmIdx < 0) atmIdx = Math.floor(sortedStrikes.length / 2)
      setMinStrike(sortedStrikes[Math.max(0, atmIdx - n)])
      setMaxStrike(sortedStrikes[Math.min(sortedStrikes.length - 1, atmIdx + n)])
    },
    [sortedStrikes, oiData?.atm_strike]
  )

  const adjustMin = useCallback(
    (deltaSteps: number) => {
      if (!strikeStep || sortedStrikes.length === 0) return
      const lo = sortedStrikes[0]
      setMinStrike((prev) => {
        if (prev == null) return prev
        const cap = maxStrike ?? sortedStrikes[sortedStrikes.length - 1]
        return Math.min(Math.max(prev + deltaSteps * strikeStep, lo), cap)
      })
    },
    [strikeStep, sortedStrikes, maxStrike]
  )

  const adjustMax = useCallback(
    (deltaSteps: number) => {
      if (!strikeStep || sortedStrikes.length === 0) return
      const hi = sortedStrikes[sortedStrikes.length - 1]
      setMaxStrike((prev) => {
        if (prev == null) return prev
        const floor = minStrike ?? sortedStrikes[0]
        return Math.max(Math.min(prev + deltaSteps * strikeStep, hi), floor)
      })
    },
    [strikeStep, sortedStrikes, minStrike]
  )

  // Chain filtered to the selected strike range
  const visibleChain = useMemo(() => {
    const chain = oiData?.chain ?? []
    if (minStrike == null || maxStrike == null) return chain
    const lo = Math.min(minStrike, maxStrike)
    const hi = Math.max(minStrike, maxStrike)
    return chain.filter((c) => c.strike >= lo && c.strike <= hi)
  }, [oiData, minStrike, maxStrike])

  // Range-specific totals and PCR (recomputed over the visible strikes only)
  const rangeStats = useMemo(() => {
    let ce = 0
    let pe = 0
    for (const c of visibleChain) {
      ce += c.ce_oi || 0
      pe += c.pe_oi || 0
    }
    return { totalCe: ce, totalPe: pe, pcr: ce > 0 ? pe / ce : 0 }
  }, [visibleChain])

  // Theme colors for Plotly
  const themeColors = useMemo(
    () => ({
      bg: 'rgba(0,0,0,0)',
      paper: 'rgba(0,0,0,0)',
      text: isDark ? '#e0e0e0' : '#333333',
      grid: isDark
        ? isAnalyzer
          ? 'rgba(180,160,255,0.1)'
          : 'rgba(255,255,255,0.1)'
        : 'rgba(0,0,0,0.08)',
      ceBar: '#22c55e',
      peBar: '#ef4444',
      atmLine: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
      hoverBg: isDark ? (isAnalyzer ? '#2d2545' : '#1e293b') : '#ffffff',
      hoverFont: isDark ? '#e0e0e0' : '#333333',
      hoverBorder: isDark ? (isAnalyzer ? '#7c3aed' : '#475569') : '#e2e8f0',
    }),
    [isDark, isAnalyzer]
  )

  // Build Plotly data from the visible (range-filtered) chain
  const plotData = useMemo(() => {
    if (visibleChain.length === 0) return { data: [], layout: {} }

    const lotSize = oiData?.lot_size || 1
    const atmStrike = oiData?.atm_strike
    const chain = visibleChain

    const xIndices = chain.map((_, i) => i)
    const tickLabels = chain.map((item) => item.strike.toString())
    const ceOILots = chain.map((item) => Math.round(item.ce_oi / lotSize))
    const peOILots = chain.map((item) => Math.round(item.pe_oi / lotSize))

    const tickStep = Math.max(1, Math.floor(chain.length / 15))
    const tickVals = xIndices.filter((_, i) => i % tickStep === 0)
    const tickText = tickLabels.filter((_, i) => i % tickStep === 0)

    const data: PlotlyTypes.Data[] = [
      {
        x: xIndices,
        y: ceOILots,
        type: 'bar' as const,
        name: 'Call Options OI（看涨期权持仓量，手）',
        marker: { color: themeColors.ceBar },
        hovertemplate: '行权价 %{text}<br>CE OI（看涨持仓量）： %{y:,}<extra></extra>',
        text: tickLabels,
        textposition: 'none' as const,
      },
      {
        x: xIndices,
        y: peOILots,
        type: 'bar' as const,
        name: 'Put Options OI（看跌期权持仓量，手）',
        marker: { color: themeColors.peBar },
        hovertemplate: '行权价 %{text}<br>PE OI（看跌持仓量）： %{y:,}<extra></extra>',
        text: tickLabels,
        textposition: 'none' as const,
      },
    ]

    const expiryLabel = convertExpiryForAPI(selectedExpiry)

    // ATM marker only when the ATM strike is within the visible range
    const atmIndex = atmStrike != null ? chain.findIndex((item) => item.strike === atmStrike) : -1

    const annotations: Partial<PlotlyTypes.Annotations>[] =
      atmIndex >= 0
        ? [
            {
              x: atmIndex,
              y: 1,
              yref: 'paper' as const,
              text: `${selectedUnderlying} ATM Strike（平值行权价） ${atmStrike}`,
              showarrow: false,
              font: { color: themeColors.text, size: 12 },
              yanchor: 'bottom' as const,
            },
          ]
        : []

    const shapes: Partial<PlotlyTypes.Shape>[] =
      atmIndex >= 0
        ? [
            {
              type: 'line' as const,
              x0: atmIndex,
              x1: atmIndex,
              y0: 0,
              y1: 1,
              yref: 'paper' as const,
              line: { color: themeColors.atmLine, width: 1.5, dash: 'dash' as const },
            },
          ]
        : []

    const rangeLabel =
      minStrike != null && maxStrike != null ? ` (${minStrike} - ${maxStrike})` : ''

    const layout: Partial<PlotlyTypes.Layout> = {
      title: {
        text: `${selectedUnderlying} ${expiryLabel}${rangeLabel}`,
        font: { color: themeColors.text, size: 14 },
      },
      paper_bgcolor: themeColors.paper,
      plot_bgcolor: themeColors.bg,
      font: { color: themeColors.text, family: 'system-ui, sans-serif' },
      barmode: 'group' as const,
      bargap: 0.15,
      hovermode: 'x unified' as const,
      hoverlabel: {
        bgcolor: themeColors.hoverBg,
        font: { color: themeColors.hoverFont, size: 12 },
        bordercolor: themeColors.hoverBorder,
      },
      showlegend: true,
      legend: {
        orientation: 'h' as const,
        x: 0.5,
        xanchor: 'center' as const,
        y: -0.15,
        font: { color: themeColors.text, size: 11 },
      },
      margin: { l: 70, r: 30, t: 50, b: 80 },
      xaxis: {
        tickmode: 'array' as const,
        tickvals: tickVals,
        ticktext: tickText,
        title: { text: '行权价', font: { color: themeColors.text, size: 12 } },
        tickfont: { color: themeColors.text, size: 10 },
        gridcolor: themeColors.grid,
        tickangle: -45,
      },
      yaxis: {
        title: { text: 'Open Interest（持仓量）', font: { color: themeColors.text, size: 12 } },
        tickfont: { color: themeColors.text, size: 10 },
        gridcolor: themeColors.grid,
      },
      annotations,
      shapes,
    }

    return { data, layout }
  }, [visibleChain, oiData, themeColors, selectedExpiry, selectedUnderlying, minStrike, maxStrike])

  const plotConfig: Partial<PlotlyTypes.Config> = useMemo(
    () => ({
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: [
        'pan2d',
        'select2d',
        'lasso2d',
        'autoScale2d',
        'toggleSpikelines',
      ] as PlotlyTypes.ModeBarDefaultButtons[],
      responsive: true,
    }),
    []
  )

  const hasData = oiData?.status === 'success' && (oiData.chain?.length ?? 0) > 0

  return (
    <div className="py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">OI Range（持仓量区间）</h1>
        <div className="flex flex-wrap items-center gap-3">
          {/* Exchange selector */}
          <Select value={selectedExchange} onValueChange={setSelectedExchange}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="交易所" />
            </SelectTrigger>
            <SelectContent>
              {fnoExchanges.map((ex) => (
                <SelectItem key={ex.value} value={ex.value}>
                  {ex.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Underlying selector */}
          <Popover open={underlyingOpen} onOpenChange={setUnderlyingOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={underlyingOpen}
                className="w-[160px] justify-between"
              >
                {selectedUnderlying || '标的'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0" align="start">
              <Command>
                <CommandInput placeholder="搜索标的..." />
                <CommandList>
                  <CommandEmpty>未找到标的</CommandEmpty>
                  <CommandGroup>
                    {underlyings.map((u) => (
                      <CommandItem
                        key={u}
                        value={u}
                        onSelect={() => {
                          setSelectedUnderlying(u)
                          setUnderlyingOpen(false)
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${selectedUnderlying === u ? 'opacity-100' : 'opacity-0'}`}
                        />
                        {u}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Expiry selector */}
          <Select
            value={selectedExpiry}
            onValueChange={setSelectedExpiry}
            disabled={expiries.length === 0}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="到期日" />
            </SelectTrigger>
            <SelectContent>
              {expiries.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Refresh */}
          <Button variant="outline" size="sm" onClick={fetchOIData} disabled={isLoading}>
            {isLoading ? '加载中...' : '刷新'}
          </Button>

          {/* Auto-refresh toggle (off by default) */}
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              disabled={!selectedExpiry}
            />
            <label htmlFor="auto-refresh" className="text-sm whitespace-nowrap cursor-pointer">
              自动刷新（1 分钟）
            </label>
          </div>
        </div>
      </div>

      {/* Strike range controls */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Min strike */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">最低行权价</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => adjustMin(-1)}
                  disabled={!hasData}
                  aria-label="降低最低行权价"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  className="w-28 text-center"
                  value={minStrike ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value)
                    setMinStrike(v != null && Number.isFinite(v) ? v : null)
                  }}
                  disabled={!hasData}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => adjustMin(1)}
                  disabled={!hasData}
                  aria-label="提高最低行权价"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Max strike */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">最高行权价</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => adjustMax(-1)}
                  disabled={!hasData}
                  aria-label="降低最高行权价"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  className="w-28 text-center"
                  value={maxStrike ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value)
                    setMaxStrike(v != null && Number.isFinite(v) ? v : null)
                  }}
                  disabled={!hasData}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => adjustMax(1)}
                  disabled={!hasData}
                  aria-label="提高最高行权价"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Strikes above/below ATM quick selectors */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">平值上下行权价数量</span>
              <div className="flex flex-wrap items-center gap-1">
                {AROUND_OPTIONS.map((n) => (
                  <Button
                    key={n}
                    variant="outline"
                    size="sm"
                    onClick={() => applyAround(n)}
                    disabled={!hasData}
                  >
                    {n}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyAround('all')}
                  disabled={!hasData}
                >
                  显示全部
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => applyAround(DEFAULT_AROUND)}
                  disabled={!hasData}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  重置
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info badges (range-specific) */}
      {hasData && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            现货价：{oiData?.spot_price?.toFixed(1)}
          </Badge>
          {oiData?.futures_price && (
            <Badge variant="secondary" className="text-sm px-3 py-1">
              期货价：{oiData.futures_price.toFixed(1)}
            </Badge>
          )}
          <Badge variant="secondary" className="text-sm px-3 py-1">
            每手数量：{oiData?.lot_size}
          </Badge>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            ATM（平值行权价）：{oiData?.atm_strike}
          </Badge>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            区间内行权价数量：{visibleChain.length}
          </Badge>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            PCR (range)（区间看跌看涨持仓比）：{rangeStats.pcr.toFixed(2)}
          </Badge>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            Total CE OI（看涨总持仓量）：{formatNumber(rangeStats.totalCe)}
          </Badge>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            Total PE OI（看跌总持仓量）：{formatNumber(rangeStats.totalPe)}
          </Badge>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground ml-auto">
              上次更新：{lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          {isLoading && !oiData ? (
            <div className="flex items-center justify-center h-[500px] text-muted-foreground">
              正在加载持仓量数据...
            </div>
          ) : visibleChain.length > 0 ? (
            <Plot
              data={plotData.data}
              layout={plotData.layout}
              config={plotConfig}
              useResizeHandler
              style={{ width: '100%', height: '500px' }}
            />
          ) : (
            <div className="flex items-center justify-center h-[500px] text-muted-foreground">
              {selectedExpiry
                ? hasData
                  ? '所选区间内没有行权价'
                  : '暂无持仓量数据'
                : '请选择标的和到期日以查看持仓量数据'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
