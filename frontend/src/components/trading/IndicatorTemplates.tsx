import { parseIndicatorTemplate } from 'openalgo-charts/workspace'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { ChartWorkspaceCatalogState } from '@/hooks/useChartWorkspaceCatalog'
import { ChromeIcon } from '@/lib/trading/glyphs'
import type { TradingTerminal } from '@/lib/trading/terminal'
import { Tip } from './Tip'
import { TB_BTN, TB_LABEL_WIDE } from './toolbarStyles'

export type IndicatorTemplateTarget = Pick<
  TradingTerminal,
  'captureIndicatorTemplate' | 'applyIndicatorTemplate'
>
interface Props extends ChartWorkspaceCatalogState {
  target(): IndicatorTemplateTarget | null
}
interface ActionResult {
  message: string
  select?: string
  clearName?: boolean
}

/** One template picker for the workspace; resolve focus when the action begins. */
export function IndicatorTemplates({
  catalog,
  loading,
  pending,
  error,
  run,
  reload,
  target,
}: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [savedName, setSavedName] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  /** Deleting waits for a second, explicit press: a template is not in any undo history. */
  const [confirmDelete, setConfirmDelete] = useState(false)
  const alive = useRef(true)
  const inFlight = useRef(false)
  const selected = catalog?.templates.find((item) => item.id === selectedId)
  const disabled = loading || pending || busy

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    setSavedName(selected?.name ?? '')
  }, [selected?.name])
  // biome-ignore lint/correctness/useExhaustiveDependencies: the question belongs to the template it was asked about
  useEffect(() => {
    setConfirmDelete(false)
  }, [selected?.id])

  async function perform(action: () => Promise<ActionResult>) {
    if (inFlight.current || disabled) return
    inFlight.current = true
    setBusy(true)
    setFailure(null)
    setMessage('')
    try {
      const result = await action()
      if (!alive.current) return
      setMessage(result.message)
      if (result.select !== undefined) setSelectedId(result.select)
      if (result.clearName) setName('')
    } catch (cause) {
      if (alive.current) setFailure(cause instanceof Error ? cause.message : String(cause))
    } finally {
      inFlight.current = false
      if (alive.current) setBusy(false)
    }
  }

  function chart() {
    const current = target()
    if (!current) throw new Error('请先选择已加载的图表')
    return current
  }

  async function importFile(file: File) {
    if (file.size > 5 * 1024 * 1024) throw new Error('模板文件大小不能超过 5 MB')
    const document = parseIndicatorTemplate(await file.text())
    const saved = await run((repository) => repository.importDocument(document))
    return { message: '模板已导入', select: saved.id }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tip
        tip={{
          title: '指标模板',
          sub: '保存所选图表的指标，或应用已保存的指标组合',
        }}
      >
        <DialogTrigger asChild>
          <button type="button" data-workspace-control className={TB_BTN} aria-label="Templates">
            <ChromeIcon id="template" />
            <span className={TB_LABEL_WIDE}>模板</span>
          </button>
        </DialogTrigger>
      </Tip>
      <DialogContent
        data-workspace-control
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        style={{ maxWidth: 'min(36rem, calc(100vw - 2rem))' }}
      >
        <DialogHeader>
          <DialogTitle>指标模板</DialogTitle>
          <DialogDescription>保存指标及其样式，并将其应用到选中的图表。模板保存在此浏览器的当前账户下。</DialogDescription>
        </DialogHeader>
        {(failure || error) && (
          <p role="alert" className="text-sm text-destructive">
            {failure || error}
          </p>
        )}
        {message && <output className="text-sm text-muted-foreground">{message}</output>}
        {loading && <p className="text-sm">正在加载模板…</p>}
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void perform(async () => {
              const indicators = chart().captureIndicatorTemplate()
              const saved = await run((repository) =>
                repository.createTemplate(name.trim(), indicators)
              )
              return { message: '模板已保存', select: saved.id, clearName: true }
            })
          }}
        >
          <label htmlFor={`${id}-new`} className="text-sm font-medium">新模板名称</label>
          <Input
            id={`${id}-new`}
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" disabled={disabled || !name.trim()}>保存当前指标</Button>
        </form>
        <div className="grid gap-2 border-t pt-4">
          <label htmlFor={`${id}-saved`} className="text-sm font-medium">已保存的模板</label>
          <select
            id={`${id}-saved`}
            value={selected?.id ?? ''}
            disabled={disabled}
            className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm"
            onChange={(event) => setSelectedId(event.target.value)}
          >
            <option value="">选择模板</option>
            {catalog?.templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {catalog?.templates.length === 0 && (
            <p className="text-sm text-muted-foreground">没有已保存的模板</p>
          )}
          {selected && (
            <>
              <p className="text-sm text-muted-foreground">
                {selected.indicators.length
                  ? `${selected.indicators.length} 个指标`
                  : '没有指标'}
              </p>
              <div className="flex flex-wrap gap-2">
                {(['replace', 'append'] as const).map((mode) => (
                  <Button
                    key={mode}
                    disabled={disabled}
                    variant={mode === 'replace' ? 'default' : 'outline'}
                    onClick={() =>
                      void perform(async () => {
                        await chart().applyIndicatorTemplate(selected.indicators, mode)
                        return {
                          message:
                            mode === 'replace'
                              ? '已替换所选图表的指标'
                              : '已向所选图表添加指标',
                        }
                      })
                    }
                  >
                    {mode === 'replace' ? '替换指标' : '添加指标'}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    void perform(async () => {
                      const indicators = chart().captureIndicatorTemplate()
                      await run((repository) => repository.saveTemplate(selected.id, indicators))
                      return {
                        message: `${selected.name} 已更新为所选图表上的 ${indicators.length} 个指标`,
                      }
                    })
                  }
                >使用当前图表更新</Button>
              </div>
              <label htmlFor={`${id}-rename`} className="mt-2 text-sm font-medium">已保存模板的名称</label>
              <Input
                id={`${id}-rename`}
                maxLength={120}
                value={savedName}
                onChange={(event) => setSavedName(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={disabled || !savedName.trim()}
                  onClick={() =>
                    void perform(async () => {
                      await run((repository) =>
                        repository.rename('indicator-template', selected.id, savedName.trim())
                      )
                      return { message: '模板已重命名' }
                    })
                  }
                >重命名</Button>
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    void perform(async () => {
                      const saved = await run((repository) =>
                        repository.duplicate(
                          'indicator-template',
                          selected.id,
                          `${selected.name.slice(0, 115)} copy`
                        )
                      )
                      return { message: '模板已复制', select: saved.id }
                    })
                  }
                >
                  复制
                </Button>
                <Button
                  variant="outline"
                  disabled={disabled || confirmDelete}
                  onClick={() => setConfirmDelete(true)}
                >
                  删除
                </Button>
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    void perform(async () => {
                      const json = await run((repository) =>
                        repository.exportDocument('indicator-template', selected.id)
                      )
                      if (!alive.current) return { message: '' }
                      const url = URL.createObjectURL(
                        new Blob([json], { type: 'application/json' })
                      )
                      try {
                        const anchor = document.createElement('a')
                        anchor.href = url
                        anchor.download = `${selected.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80) || 'indicator-template'}.json`
                        anchor.click()
                      } finally {
                        setTimeout(() => URL.revokeObjectURL(url), 0)
                      }
                      return { message: '模板已导出' }
                    })
                  }
                >
                  导出 JSON
                </Button>
              </div>
              {confirmDelete && (
                <div
                  role="alertdialog"
                  aria-label="删除模板"
                  className="grid gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3"
                >
                  <p className="text-sm">
                    确定删除模板 {selected.name} 吗？已应用该模板指标的图表会保留这些指标。此操作无法撤销。
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                      保留模板
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={disabled}
                      onClick={() =>
                        void perform(async () => {
                          await run((repository) =>
                            repository.remove('indicator-template', selected.id)
                          )
                          setConfirmDelete(false)
                          return { message: '模板已删除', select: '' }
                        })
                      }
                    >
                      删除模板
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="grid gap-2 border-t pt-4">
          <label htmlFor={`${id}-import`} className="text-sm font-medium">
            导入模板 JSON
          </label>
          <Input
            id={`${id}-import`}
            type="file"
            accept="application/json,.json"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void perform(() => importFile(file))
            }}
          />
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={() =>
              void perform(async () => {
                await reload()
                return { message: '模板列表已刷新' }
              })
            }
          >
            刷新模板
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
