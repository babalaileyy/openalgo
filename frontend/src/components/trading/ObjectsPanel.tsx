import type { ChartObjectSnapshot, ChartObjects } from 'openalgo-charts'
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import { indicatorInstanceName } from '@/lib/trading/indicatorChinese'
import { PANEL_HEADER, PanelShell } from './panelShell'

interface Props {
  model: ChartObjects | null
  paneLabel: string
}

const KIND_LABEL: Record<ChartObjectSnapshot['kind'], string> = {
  source: '数据源',
  indicator: '指标',
  drawing: '画线',
  profile: '分布图',
  group: '分组',
}
const NO_OBJECTS: readonly ChartObjectSnapshot[] = Object.freeze([])

function statusLabel(object: ChartObjectSnapshot): string | null {
  const state = object.dataStatus?.state
  if (!state) return null
  return ({ loading: '加载中', ready: '就绪', error: '错误', unavailable: '不可用' } as Record<string, string>)[state] ?? state
}

function Action({
  label,
  name,
  ariaLabel,
  onClick,
  danger = false,
}: {
  label: string
  name: string
  ariaLabel?: string
  onClick(): void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        'rounded border border-border px-1.5 py-1 text-[11px] leading-none text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        danger && 'hover:border-destructive/50 hover:text-destructive'
      )}
      aria-label={ariaLabel ?? `${label} ${name}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export function ObjectsPanel({ model, paneLabel }: Props) {
  const [query, setQuery] = useState('')
  const [actionError, setActionError] = useState<{ model: ChartObjects; message: string } | null>(
    null
  )
  const subscribe = useCallback(
    (notify: () => void) => model?.subscribe(() => notify()) ?? (() => {}),
    [model]
  )
  const getSnapshot = useCallback(() => model?.list() ?? NO_OBJECTS, [model])
  const objects = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return objects
    return objects.filter((object) =>
      `${object.name} ${object.kind === 'indicator' ? indicatorInstanceName(object.name) : ''} ${KIND_LABEL[object.kind]} ${object.sourceId} pane ${object.paneIndex + 1} 窗格 ${object.paneIndex + 1}`
        .toLocaleLowerCase()
        .includes(needle)
    )
  }, [objects, query])

  const act = (verb: string, name: string, action: () => boolean) => {
    let accepted = false
    try {
      accepted = action()
    } catch {
      // Optional providers are host code. Keep their failure inside this panel.
    }
    setActionError(
      accepted || !model ? null : { model, message: `无法${({ select: '选择', hide: '隐藏', show: '显示', lock: '锁定', unlock: '解锁', 'open settings for': '打开设置：', focus: '定位', remove: '移除' } as Record<string, string>)[verb] ?? verb} ${name}` }
    )
  }

  return (
    <PanelShell
      id="oa-panel-objects"
      label="图表对象"
      storageKey="oa-trading-objects-width"
      defaultWidth={360}
    >
      <div className={PANEL_HEADER}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">图表对象</div>
          <div className="truncate text-[10px] text-muted-foreground">{paneLabel}</div>
        </div>
      </div>

      <div className="border-b px-2 py-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索图表对象"
          aria-label="搜索图表对象"
          className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
        {actionError?.model === model && (
          <p role="alert" className="mt-2 text-[11px] text-destructive">
            {actionError.message}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {!model ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            暂无图表对象
          </p>
        ) : shown.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">没有匹配的图表对象</p>
        ) : (
          <div className="space-y-1.5">
            {shown.map((object) => {
              const status = statusLabel(object)
              const detailId = `oa-object-details-${encodeURIComponent(object.id)}`
              const details = [
                KIND_LABEL[object.kind],
                `图表窗格 ${object.paneIndex + 1}`,
                status,
                object.visible ? '可见' : '已隐藏',
                object.capabilities.lock ? (object.locked ? '已锁定' : '未锁定') : null,
              ].filter(Boolean)
              const content = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{object.kind === 'indicator' ? indicatorInstanceName(object.name) : object.name}</span>
                    <span
                      id={detailId}
                      className="block truncate text-[10px] text-muted-foreground"
                    >
                      {details.join(' · ')}
                    </span>
                  </span>
                  {!object.visible && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">已隐藏</span>
                  )}
                  {object.locked && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">已锁定</span>
                  )}
                </>
              )
              return (
                <div
                  key={object.id}
                  className={cn(
                    'rounded-md border border-border bg-card px-2 py-2',
                    object.selected && 'border-primary/60 bg-primary/5'
                  )}
                >
                  {object.capabilities.select ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label={`选择 ${object.name}`}
                      aria-describedby={detailId}
                      aria-pressed={object.selected}
                      onClick={(event) =>
                        act('select', object.name, () =>
                          model.select(object.id, event.shiftKey || event.ctrlKey || event.metaKey)
                        )
                      }
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">{content}</div>
                  )}

                  {Object.values(object.capabilities).some(Boolean) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {object.capabilities.visibility && (
                        <Action
                          label={object.visible ? '隐藏' : '显示'}
                          name={object.name}
                          onClick={() =>
                            act(object.visible ? 'hide' : 'show', object.name, () =>
                              model.setVisible(object.id, !object.visible)
                            )
                          }
                        />
                      )}
                      {object.capabilities.lock && (
                        <Action
                          label={object.locked ? '解锁' : '锁定'}
                          name={object.name}
                          onClick={() =>
                            act(object.locked ? 'unlock' : 'lock', object.name, () =>
                              model.setLocked(object.id, !object.locked)
                            )
                          }
                        />
                      )}
                      {object.capabilities.settings && (
                        <Action
                          label="设置"
                          name={object.name}
                          ariaLabel={`设置 ${object.name}`}
                          onClick={() =>
                            act('open settings for', object.name, () =>
                              model.openSettings(object.id)
                            )
                          }
                        />
                      )}
                      {object.capabilities.focus && (
                        <Action
                          label="定位"
                          name={object.name}
                          onClick={() =>
                            act('focus', object.name, () => model.focus(object.id))
                          }
                        />
                      )}
                      {object.capabilities.remove && (
                        <Action
                          label="移除"
                          name={object.name}
                          onClick={() =>
                            act('remove', object.name, () => model.remove(object.id))
                          }
                          danger
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PanelShell>
  )
}
