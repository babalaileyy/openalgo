import { intervalParts } from 'openalgo-charts'
import {
  customTimeframeCode,
  type TimeframePreferences,
  type TimeframeUnit,
} from 'openalgo-charts/widget'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ensureCalendarIntervals } from '@/lib/chart/intervalRegistry'
import { ChromeIcon } from '@/lib/trading/glyphs'
import type { IntervalGroup } from '@/lib/trading/intervals'
import { cn } from '@/lib/utils'

const PRESETS = [
  '1s',
  '5s',
  '10s',
  '15s',
  '30s',
  '45s',
  '1m',
  '2m',
  '3m',
  '5m',
  '10m',
  '15m',
  '30m',
  '45m',
  '1h',
  '2h',
  '3h',
  '4h',
  'D',
  'W',
  'M',
  'Q',
  'Y',
]
const UNITS: TimeframeUnit[] = [
  'seconds',
  'minutes',
  'hours',
  'days',
  'weeks',
  'months',
  'quarters',
  'years',
]
const NAMES = {
  s: '秒',
  m: '分钟',
  h: '小时',
  D: '天',
  W: '周',
  M: '月',
  tick: '笔',
  other: '周期',
}
const GROUPS = ['s', 'm', 'h', 'D', 'W', 'M', 'tick', 'other'] as const
const GROUP_NAMES = ['秒', '分钟', '小时', '天', '周', '月', '逐笔', '其他']
function identity(code: string): string {
  const part = intervalParts(code)
  return part ? `${part.unit}:${part.multiplier}` : code
}
function label(code: string): string {
  const part = intervalParts(code)
  return part ? `${part.multiplier} ${NAMES[part.unit]}` : code
}
function unique(codes: readonly string[]): string[] {
  const seen = new Set<string>()
  return codes.filter((code) => {
    const key = identity(code)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

interface Props {
  current: string
  groups: readonly IntervalGroup[]
  preferences: TimeframePreferences
  canSelectInterval(code: string): boolean
  onSelect(code: string): void
  container?: HTMLElement | null
}

/** Stable action columns and a shared store; the active selection remains pane-owned. */
export function TimeframeMenu({
  current,
  groups,
  preferences,
  canSelectInterval,
  onSelect,
  container,
}: Props) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [folded, setFolded] = useState<Set<string>>(() => new Set())
  const [, refresh] = useState(0)
  useEffect(() => preferences.subscribe(() => refresh((value) => value + 1)), [preferences])
  ensureCalendarIntervals()
  const favorites = preferences.favorites(),
    custom = preferences.custom()
  const favoriteKeys = new Set(favorites.map(identity)),
    customKeys = new Set(custom.map(identity))
  const codes = unique([
    current,
    ...custom,
    ...favorites,
    ...groups.flatMap((group) => group.items),
    ...PRESETS.filter(canSelectInterval),
  ])
  const choose = (code: string) => {
    if (canSelectInterval(code)) {
      setOpen(false)
      onSelect(code)
    }
  }
  return (
    <div className="flex shrink-0 items-center gap-1" data-timeframe-controls>
      <div
        className="hidden max-w-56 items-center gap-0.5 overflow-x-auto sm:flex"
        role="toolbar"
        aria-label="收藏的周期"
      >
        {favorites.map((code) => (
          <button
            key={code}
            type="button"
            aria-label={`收藏的周期 ${code}`}
            aria-pressed={identity(current) === identity(code)}
            disabled={!canSelectInterval(code)}
            onClick={() => choose(code)}
            className={cn(
              'h-8 shrink-0 rounded px-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-40',
              identity(current) === identity(code) && 'bg-primary/10 text-primary'
            )}
          >
            {code}
          </button>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded px-2 text-sm font-semibold hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`周期 ${current}`}
          >
            {current || '-'}
            <ChromeIcon id="chevron-down" size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          container={container}
          align="start"
          className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-72 max-w-[calc(100vw-1rem)] flex-col gap-0 p-1.5"
          aria-label="图表周期"
        >
          <button
            type="button"
            className="flex h-10 shrink-0 items-center gap-2 rounded px-2 text-sm hover:bg-accent"
            onClick={() => {
              setOpen(false)
              setAdding(true)
            }}
          >
            <ChromeIcon id="plus" size={18} />
            添加自定义周期
          </button>
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {GROUPS.map((group, index) => {
              const rows = codes
                .filter((code) => (intervalParts(code)?.unit ?? 'other') === group)
                .sort(
                  (a, b) =>
                    (intervalParts(a)?.multiplier ?? 0) - (intervalParts(b)?.multiplier ?? 0)
                )
              if (!rows.length) return null
              return (
                <section key={group} className="border-t py-1">
                  <button
                    type="button"
                    className="flex h-9 w-full items-center justify-between px-2 text-xs uppercase tracking-wide text-muted-foreground"
                    aria-expanded={!folded.has(group)}
                    onClick={() =>
                      setFolded((before) => {
                        const next = new Set(before)
                        if (next.has(group)) next.delete(group)
                        else next.add(group)
                        return next
                      })
                    }
                  >
                    {GROUP_NAMES[index]}
                    <ChromeIcon id={folded.has(group) ? 'chevron-down' : 'chevron-up'} size={14} />
                  </button>
                  {!folded.has(group) &&
                    rows.map((code) => {
                      const key = identity(code),
                        text = label(code),
                        selected = key === identity(current),
                        enabled = canSelectInterval(code)
                      return (
                        <div
                          key={key}
                          className={cn(
                            'grid grid-cols-[minmax(0,1fr)_2rem_2rem] items-center rounded hover:bg-accent',
                            selected && 'bg-primary/10 text-primary'
                          )}
                        >
                          <button
                            type="button"
                            className="min-h-10 truncate rounded px-2 text-left text-sm disabled:opacity-40"
                            aria-pressed={selected}
                            disabled={!enabled}
                            title={
                              enabled
                                ? undefined
                                : '当前数据源无法生成此周期'
                            }
                            onClick={() => choose(code)}
                          >
                            {text}
                          </button>
                          {customKeys.has(key) ? (
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10"
                              aria-label={`移除 ${text}`}
                              onClick={() => preferences.removeCustom(code)}
                            >
                              <ChromeIcon id="trash" size={16} />
                            </button>
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded hover:bg-foreground/10',
                              favoriteKeys.has(key) ? 'text-primary' : 'text-muted-foreground'
                            )}
                            aria-label={`${favoriteKeys.has(key) ? '取消收藏' : '收藏'} ${text}`}
                            aria-pressed={favoriteKeys.has(key)}
                            onClick={() => preferences.toggle(code)}
                          >
                            <ChromeIcon
                              id={favoriteKeys.has(key) ? 'star-filled' : 'star'}
                              size={16}
                            />
                          </button>
                        </div>
                      )
                    })}
                </section>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
      {adding && (
        <CustomIntervalDialog
          container={container}
          canSelect={canSelectInterval}
          onClose={() => setAdding(false)}
          onAdd={(code) => {
            preferences.addCustom(code)
            setAdding(false)
            choose(code)
          }}
        />
      )}
    </div>
  )
}

function CustomIntervalDialog({
  container,
  canSelect,
  onClose,
  onAdd,
}: {
  container?: HTMLElement | null
  canSelect(code: string): boolean
  onClose(): void
  onAdd(code: string): void
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null)
  const [unit, setUnit] = useState<TimeframeUnit>('minutes'),
    [count, setCount] = useState(''),
    [failure, setFailure] = useState('')
  let code = '',
    reason = ''
  try {
    code = customTimeframeCode(Number(count), unit)
    if (!canSelect(code)) {
      code = ''
      reason = '当前数据源无法生成此周期。'
    }
  } catch {
    reason = count ? '请输入 1 至 100000 之间的整数。' : ''
  }
  const submit = () => {
    if (code) {
      try {
        onAdd(code)
      } catch (error) {
        setFailure((error as Error).message)
      }
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <DialogContent
        container={container}
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          input.current?.focus()
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <DialogTitle>添加自定义周期</DialogTitle>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-accent"
          >
            <ChromeIcon id="close" size={18} />
          </button>
        </div>
        <DialogDescription className="sr-only">
          选择周期类型并输入正整数。
        </DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          className="grid gap-5 pt-2"
        >
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3">
            <label htmlFor={`${id}-type`}>类型</label>
            <select
              id={`${id}-type`}
              value={unit}
              onChange={(event) => setUnit(event.target.value as TimeframeUnit)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-ring"
            >
              {UNITS.map((value) => (
                <option key={value} value={value}>
                  {({ seconds: '秒', minutes: '分钟', hours: '小时', days: '天', weeks: '周', months: '月', quarters: '季度', years: '年' } as Record<TimeframeUnit, string>)[value]}
                </option>
              ))}
            </select>
            <label htmlFor={`${id}-count`}>周期</label>
            <input
              ref={input}
              id={`${id}-count`}
              type="number"
              inputMode="numeric"
              min="1"
              max="100000"
              step="1"
              value={count}
              onChange={(event) => {
                setCount(event.target.value)
                setFailure('')
              }}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <output className="min-h-5 text-sm text-muted-foreground">{reason || failure}</output>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={!code}>
              添加
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
