import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

/** Every day of the week, which is what a 24/7 crypto strategy runs on. */
export const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** The start time a 24/7 strategy is saved with; it has no stop time. */
export const ALL_DAY_START = '00:00'

/**
 * The choice to run a crypto strategy around the clock.
 *
 * On, the strategy is saved with no stop time and every day of the week, so
 * the schedule never stops it. Off, it gets a start and stop time like any
 * other exchange.
 */
export function RunAllDaySwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange(checked: boolean): void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="space-y-1">
        <Label htmlFor="run_24x7">全天候运行（24/7）</Label>
        <p className="text-xs text-muted-foreground">
          {checked
            ? '定时设置不会停止此策略；策略将持续运行，直到手动停止。如果脚本自行退出，将在印度标准时间 00:00 再次启动。'
            : '策略仅在所选日期和下方设置的开始、停止时间之间运行。'}
        </p>
      </div>
      <Switch id="run_24x7" checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
