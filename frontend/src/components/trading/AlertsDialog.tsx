/**
 * Creating and managing chart alerts, in the app's own controls.
 *
 * The engine ships an alert UI of its own, and this replaces it on this page
 * for the same reason the indicator settings dialog is ours: the engine is
 * canvas-only, its dialog is generated from a schema as a settings table, and
 * an alert is not a table of settings. It is a sentence. "RELIANCE, crossing,
 * 1243.40" reads as one when the three controls are stacked and full width, and
 * reads as a form when each is a row with a label on its left.
 *
 * So the shape here is sections rather than rows: what to watch, when to fire,
 * when to stop, and what to call it. The engine is still the one that decides
 * whether a condition has been met; everything below is how it is asked.
 *
 * **This is the editor and nothing else.** The list of alerts lives on the rail
 * in `AlertsPanel`, because a list is something you keep open beside the chart
 * rather than something that covers it. A modal is good at one job, which is
 * filling in a form, and this is that form however it was opened: from the
 * toolbar, from a right-click on the chart, or from a row in that list.
 */

import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type AlertDelivery, readySound } from '@/lib/trading/alertDelivery'
import { ALERT_PLACEHOLDERS } from '@/lib/trading/alertMessage'
import { askToNotify } from '@/lib/trading/alertNotify'
import {
  ALERT_CONDITIONS,
  ALERT_KINDS,
  type AlertConditionId,
  type AlertDraft,
  type AlertKind,
  defaultExpiry,
  draftFor,
  draftProblem,
  drawingChoices,
  isRangeCondition,
  lastClose,
  levelChoices,
  needsThreshold,
  plotChoices,
  plotValueAt,
  snapPrice,
  studyChoices,
  titleFor,
  toAlertInput,
} from '@/lib/trading/alertsModel'
import type { AlertsHandle } from '@/lib/trading/terminal'
import { cn } from '@/lib/utils'

/** A section heading. The four of them are what makes this read as a sentence. */
function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}

/** Every select in this dialog, so none of them can drift from the others. */
function Choice({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  value: string
  onChange: (next: string) => void
  options: readonly { value: string; label: string }[]
  label: string
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-9 w-full text-sm" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">暂无可选项。</div>
        )}
        {options.map((one) => (
          <SelectItem key={one.value} value={one.value} className="text-sm">
            {one.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** The four ways to be told, in the order the dialog draws them. */
const DELIVERY_CHOICES: readonly {
  readonly key: keyof AlertDelivery
  readonly label: string
  readonly means: string
}[] = [
  { key: 'sound', label: '声音', means: '在此标签页播放短提示音' },
  { key: 'notify', label: '桌面通知', means: '仅在此标签页隐藏时显示' },
  { key: 'telegram', label: 'Telegram', means: '需要运行机器人并关联账户' },
  { key: 'whatsapp', label: 'WhatsApp', means: '需要已配对的设备' },
]

interface Props {
  handle: AlertsHandle | null
  onClose: () => void
}

export function AlertsDialog({ handle, onClose }: Props) {
  const [draft, setDraft] = useState<AlertDraft | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const zone = handle?.chart.timezone() ?? 'UTC'
  /** The alert being edited, or undefined when this is a new one. */
  const editing = handle?.editAlertId

  /** A draft seeded from what the chart is showing, or from an existing alert. */
  /** The draft the form opens with, seeded exactly as a right-click seeds one. */
  const seed = useCallback(
    (alertId?: string): AlertDraft => {
      const existing = alertId ? handle?.alerts.list().find((one) => one.id === alertId) : undefined
      if (!handle) {
        // No chart yet. The effect below only runs with a handle, so this is
        // unreachable in practice and typed rather than asserted.
        return draftFor({
          chart: { indicators: () => [], primaryBars: () => [], timezone: () => zone },
          drawings: null,
          zone,
        })
      }
      return draftFor({
        chart: handle.chart,
        drawings: handle.drawings,
        zone,
        ...(handle.source ? { source: handle.source } : {}),
        ...(existing ? { existing } : {}),
        ...(handle.at ? { at: handle.at } : {}),
      })
    },
    [handle, zone]
  )

  /**
   * Seed the form each time the dialog is opened.
   *
   * A new handle is a new opening, whether it came from the toolbar, from a
   * right-click on a study's plot, or from a row in the rail's list. The three
   * differ only in what the draft starts as, which `seed` already knows.
   */
  useEffect(() => {
    if (!handle) return
    setDraft(seed(handle.editAlertId))
    setProblem(null)
  }, [handle, seed])

  const patch = (next: Partial<AlertDraft>) =>
    setDraft((previous) => (previous === null ? previous : { ...previous, ...next }))

  const save = () => {
    if (!handle || draft === null) return
    const fault = draftProblem(draft, handle.chart, handle.drawings)
    if (fault !== null) {
      const messages: Record<string, string> = {
        'Enter a price to watch.': '请输入要监测的价格。',
        'Enter a value to watch.': '请输入要监测的数值。',
        'A channel needs both of its bounds.': '请输入区间上下限。',
        'A channel needs two different bounds.': '区间上下限不能相同。',
        'Choose a study. This chart has none, or the one chosen has been removed.': '请选择技术指标。当前图表没有指标，或所选指标已移除。',
        'Choose a plot from that study.': '请选择指标线。',
        'Drawings are still loading. Try again in a moment.': '画线仍在加载，请稍后重试。',
        'Draw something on the chart first, then alert on its level.': '请先在图表上画线，再设置价位提醒。',
        'Choose which level of that drawing to watch.': '请选择要监测的画线价位。',
        'Choose a candle condition.': '请选择 K 线条件。',
        'A cooldown is a number of seconds, or nothing at all.': '冷却时间应为秒数，或留空。',
        'Enter an expiry date and time, or switch the expiry off.': '请输入到期日期和时间，或关闭到期设置。',
      }
      setProblem(messages[fault] ?? fault)
      return
    }
    const input = toAlertInput(draft, handle.chart, handle.drawings, handle.symbol, handle.at)
    if (input === null) return
    try {
      if (editing) handle.alerts.update(editing, input)
      else handle.alerts.add(input)
      // Asked here and nowhere else. This is a click the trader has just made
      // for the express purpose of being told about a price, which is the one
      // moment a request to notify them explains itself; on page load it is a
      // prompt people dismiss without reading, and a dismissed prompt is the
      // permanent answer. Nothing waits on it: a refusal costs the desktop
      // notification and the alert still fires and still toasts.
      // Asked from the click that armed it, which is the only gesture a
      // browser lets either of these start from.
      if (draft.enabled && draft.deliver.notify) void askToNotify()
      if (draft.enabled && draft.deliver.sound) readySound()
      setProblem(null)
      onClose()
    } catch (error) {
      // The engine refuses in its own terms. Shown as-is rather than swallowed:
      // a Save that does nothing and says nothing is the worse failure.
      setProblem(error instanceof Error ? error.message : String(error))
    }
  }

  const studies = handle ? studyChoices(handle.chart) : []
  const plots = handle && draft ? plotChoices(handle.chart, draft.instanceId) : []
  const drawings = drawingChoices(handle?.drawings ?? null)
  const levels = handle && draft ? levelChoices(handle.drawings, draft.drawingId) : []

  return (
    <Dialog open={handle !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{editing ? '编辑提醒' : '创建提醒'}</DialogTitle>
          <DialogDescription className="text-xs">
            {handle?.symbol ? `${handle.symbol} · 当前图表` : '当前图表'}
          </DialogDescription>
        </DialogHeader>

        {draft === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" strokeWidth={1.5} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* What to watch. Stacked and full width, so the three controls read
                as one sentence instead of as three settings. */}
            <div className="space-y-2">
              <Section>提醒条件</Section>
              <Choice
                label="监测对象"
                value={draft.kind}
                options={ALERT_KINDS.map((one) => ({ ...one, label: ({ price: '价格', indicator: '指标线', drawing: '画线价位', barCondition: 'K线条件' } as Record<string, string>)[one.value] ?? one.label }))}
                onChange={(next) => {
                  const kind = next as AlertKind
                  const seededValue =
                    kind === 'indicator' && handle
                      ? plotValueAt(handle.chart, draft.instanceId, draft.plotKey)
                      : kind === 'price' && handle
                        ? lastClose(handle.chart)
                        : null
                  patch({
                    kind,
                    value:
                      seededValue === null
                        ? draft.value
                        : String(
                            kind === 'price' ? snapPrice(seededValue, handle?.at) : seededValue
                          ),
                  })
                }}
              />
              {draft.kind === 'indicator' && (
                <>
                  <Choice
                    label="技术指标"
                    value={draft.instanceId}
                    options={studies}
                    onChange={(instanceId) => {
                      const next = handle ? plotChoices(handle.chart, instanceId) : []
                      const plotKey = next[0]?.value ?? ''
                      const seeded = handle ? plotValueAt(handle.chart, instanceId, plotKey) : null
                      patch({
                        instanceId,
                        plotKey,
                        value: seeded === null ? draft.value : String(seeded),
                      })
                    }}
                  />
                  <Choice
                    label="指标线"
                    value={draft.plotKey}
                    options={plots}
                    onChange={(plotKey) => {
                      const seeded = handle
                        ? plotValueAt(handle.chart, draft.instanceId, plotKey)
                        : null
                      patch({ plotKey, value: seeded === null ? draft.value : String(seeded) })
                    }}
                  />
                </>
              )}
              {draft.kind === 'drawing' && (
                <>
                  <Choice
                    label="画线"
                    value={draft.drawingId}
                    options={drawings}
                    onChange={(drawingId) => {
                      const next = levelChoices(handle?.drawings ?? null, drawingId)
                      patch({ drawingId, level: next[0]?.value ?? '' })
                    }}
                  />
                  <Choice
                    label="价位"
                    value={draft.level}
                    options={levels}
                    onChange={(level) => patch({ level })}
                  />
                </>
              )}
              <Choice
                label="触发条件"
                value={draft.condition}
                options={ALERT_CONDITIONS.map((one) => ({ ...one, label: ({ crossing: '穿越', crossingUp: '向上穿越', crossingDown: '向下穿越', greaterThan: '大于', lessThan: '小于', enteringRange: '进入区间', leavingRange: '离开区间' } as Record<string, string>)[one.value] ?? one.label }))}
                onChange={(condition) => patch({ condition: condition as AlertConditionId })}
              />
              {needsThreshold(draft.kind) && (
                <div
                  className={cn('grid gap-2', isRangeCondition(draft.condition) && 'grid-cols-2')}
                >
                  <Input
                    inputMode="decimal"
                    value={draft.value}
                    onChange={(event) => patch({ value: event.target.value })}
                    aria-label={isRangeCondition(draft.condition) ? '下限' : '数值'}
                    placeholder={isRangeCondition(draft.condition) ? '下限' : '数值'}
                    className="h-9 text-sm"
                  />
                  {isRangeCondition(draft.condition) && (
                    <Input
                      inputMode="decimal"
                      value={draft.upperValue}
                      onChange={(event) => patch({ upperValue: event.target.value })}
                      aria-label="上限"
                      placeholder="上限"
                      className="h-9 text-sm"
                    />
                  )}
                </div>
              )}
            </div>

            {/* When it fires. Two questions, both of which change what the alert
                does rather than how it looks, so they are not buried. */}
            <div className="space-y-2">
              <Section>触发方式</Section>
              <div className="grid grid-cols-2 gap-2">
                <Choice
                  label="触发频率"
                  value={draft.repeat}
                  options={[
                    { value: 'once', label: '仅一次' },
                    { value: 'everyTime', label: '每次满足条件' },
                  ]}
                  onChange={(repeat) => patch({ repeat: repeat as AlertDraft['repeat'] })}
                />
                <Choice
                  label="判断时机"
                  value={draft.policy}
                  options={[
                    { value: 'onBarClose', label: 'K线收盘时' },
                    { value: 'onTouch', label: 'K线内触及' },
                  ]}
                  onChange={(policy) => patch({ policy: policy as AlertDraft['policy'] })}
                />
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {draft.policy === 'onBarClose'
                  ? '在 K 线收盘确认后触发，之后被修正的影线不会触发提醒。'
                  : '价格触及时立即触发，包括最终历史数据可能不会保留的影线。'}
              </p>
            </div>

            {/* When it stops. The checkbox is the switch, so an open-ended alert
                is a deliberate choice rather than an empty field. */}
            <div className="space-y-2">
              <Section>到期设置</Section>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="alert-expires"
                  checked={draft.expiresAt !== ''}
                  onCheckedChange={(checked) =>
                    patch({ expiresAt: checked === true ? defaultExpiry(zone) : '' })
                  }
                />
                <Label htmlFor="alert-expires" className="text-xs font-normal">
                  设置到期时间
                </Label>
                <Input
                  type="datetime-local"
                  step={60}
                  value={draft.expiresAt}
                  disabled={draft.expiresAt === ''}
                  onChange={(event) => patch({ expiresAt: event.target.value })}
                  aria-label={`到期时间，${zone}`}
                  className="h-9 flex-1 text-sm"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {draft.expiresAt === ''
                  ? '无到期时间：提醒将持续监测，直到你移除它。'
                  : `时间采用 ${zone} 时区，与图表坐标轴一致。`}
              </p>
            </div>

            {/* What to call it, and what it says. Last, because both have a
                sensible answer already and neither stops anyone saving. */}
            <div className="space-y-2">
              <Section>提醒名称</Section>
              <Input
                value={draft.title}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder={handle ? titleFor(draft, handle.chart, handle.symbol, handle.at) : ''}
                aria-label="提醒名称"
                className="h-9 text-sm"
              />
              <Input
                value={draft.message}
                onChange={(event) => patch({ message: event.target.value })}
                placeholder="消息内容（可选）"
                aria-label="消息内容"
                className="h-9 text-sm"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                消息可包含触发时自动填入的变量：{' '}
                {ALERT_PLACEHOLDERS.slice(0, 5).map((one, index) => (
                  <span key={one.name}>
                    {index > 0 && ', '}
                    <button
                      type="button"
                      title={one.means}
                      onClick={() => patch({ message: `${draft.message}{{${one.name}}}` })}
                      className="rounded bg-muted px-1 font-mono text-[10px] hover:bg-accent hover:text-foreground"
                    >
                      {`{{${one.name}}}`}
                    </button>
                  </span>
                ))}
                {'，另有 '}
                {ALERT_PLACEHOLDERS.length - 5} 项。拼写错误的变量会保留原文。
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="alert-enabled"
                  checked={draft.enabled}
                  onCheckedChange={(checked) => patch({ enabled: checked === true })}
                />
                <Label htmlFor="alert-enabled" className="text-xs font-normal">
                  保存后立即启用
                </Label>
              </div>
            </div>

            {/* How to be told. Last, because every one of them has an answer
                already and none of them stops anyone saving. */}
            <div className="space-y-2">
              <Section>通知方式</Section>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {DELIVERY_CHOICES.map((choice) => (
                  <div key={choice.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`alert-deliver-${choice.key}`}
                      checked={draft.deliver[choice.key]}
                      onCheckedChange={(checked) =>
                        patch({ deliver: { ...draft.deliver, [choice.key]: checked === true } })
                      }
                    />
                    <Label
                      htmlFor={`alert-deliver-${choice.key}`}
                      className="text-xs font-normal"
                      title={choice.means}
                    >
                      {choice.label}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                声音和桌面通知在本机提示；Telegram 和 WhatsApp 会向外发送消息，需先在各自页面完成设置。
              </p>
            </div>

            {problem !== null && (
              <p role="alert" className="text-xs text-destructive">
                {problem}
              </p>
            )}

            <DialogFooter className="gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>
                取消
              </Button>
              <Button size="sm" onClick={save}>
                {editing ? '保存' : '创建'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
