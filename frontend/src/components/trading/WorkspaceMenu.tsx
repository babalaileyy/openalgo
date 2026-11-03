import { parseWorkspaceDocument, type WorkspaceDocument } from 'openalgo-charts/workspace'
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
import { TickBox } from './TickBox'
import { Tip } from './Tip'
import { TB_BTN, TB_LABEL_WIDE } from './toolbarStyles'

interface Props extends ChartWorkspaceCatalogState {
  activeId: string | null
  transitionPending?: boolean
  cancelOpening?(): void
  status?: string
  save(): Promise<void>
  saveAs(name: string): Promise<WorkspaceDocument>
  create(name: string): Promise<WorkspaceDocument>
  openWorkspace(document: WorkspaceDocument): Promise<unknown>
  importWorkspace(document: WorkspaceDocument): Promise<WorkspaceDocument>
  onRemoved(id: string): void
}
interface Result {
  message: string
  select?: string
  clearName?: boolean
}

export function WorkspaceMenu({
  catalog,
  loading,
  pending,
  error,
  run,
  reload,
  activeId,
  transitionPending = false,
  cancelOpening,
  status,
  save,
  saveAs,
  create,
  openWorkspace,
  importWorkspace,
  onRemoved,
}: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [savedName, setSavedName] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  /** Deleting waits for a second, explicit press: a saved workspace is not in any undo history. */
  const [confirmDelete, setConfirmDelete] = useState(false)
  const action = useRef(0)
  const inFlight = useRef(false)
  const selected = catalog?.workspaces.find((item) => item.id === selectedId)
  const active = catalog?.workspaces.find((item) => item.id === activeId)
  const disabled = loading || pending || busy || transitionPending
  useEffect(
    () => () => {
      action.current++
    },
    []
  )
  useEffect(() => {
    setSavedName(selected?.name ?? '')
  }, [selected?.name])
  // biome-ignore lint/correctness/useExhaustiveDependencies: the question belongs to the workspace it was asked about
  useEffect(() => {
    setConfirmDelete(false)
  }, [selected?.id])

  async function perform(operation: () => Promise<Result>) {
    if (disabled || inFlight.current) return
    const token = ++action.current
    inFlight.current = true
    setBusy(true)
    setFailure(null)
    setMessage('')
    try {
      const result = await operation()
      if (token !== action.current) return
      setMessage(result.message)
      if (result.select !== undefined) setSelectedId(result.select)
      if (result.clearName) setName('')
    } catch (cause) {
      if (token === action.current)
        setFailure(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (token === action.current) {
        inFlight.current = false
        setBusy(false)
      }
    }
  }
  const openSaved = (document: WorkspaceDocument) =>
    perform(async () => {
      await openWorkspace(document)
      return { message: '工作区已打开', select: document.id }
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tip
        tip={{
          title: active ? `工作区：${active.name}` : '工作区',
          sub: '保存或打开完整的图表布局',
        }}
      >
        <DialogTrigger asChild>
          <button type="button" data-workspace-control className={TB_BTN} aria-label="Workspaces">
            <ChromeIcon id="folder" />
            <span className={TB_LABEL_WIDE}>工作区</span>
          </button>
        </DialogTrigger>
      </Tip>
      <DialogContent
        data-workspace-control
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        style={{ maxWidth: 'min(36rem, calc(100vw - 2rem))' }}
      >
        <DialogHeader>
          <DialogTitle>图表工作区</DialogTitle>
          <DialogDescription>在此浏览器的当前账户下保存完整的图表布局。可导出工作区以分享图表配置。</DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {active ? `当前：${active.name}` : '当前：未命名工作区'}
          {status ? ` (${status})` : ''}
        </p>
        {(failure || error) && (
          <p role="alert" className="text-sm text-destructive">
            {failure || error}
          </p>
        )}
        {message && <output className="text-sm text-muted-foreground">{message}</output>}
        {loading && <p className="text-sm">正在加载工作区...</p>}
        {transitionPending && cancelOpening && (
          <Button variant="outline" onClick={cancelOpening}>取消加载工作区</Button>
        )}
        <label className="flex items-center gap-2 text-sm">
          <TickBox
            label="自动保存图表更改"
            checked={catalog?.autosave === true}
            disabled={disabled}
            onChange={(enabled) =>
              void perform(async () => {
                await run((repository) => repository.setAutosave(enabled))
                return { message: enabled ? '已启用自动保存' : '已关闭自动保存' }
              })
            }
          />自动保存图表更改</label>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={disabled || !active}
            onClick={() =>
              void perform(async () => {
                await save()
                return { message: '工作区已保存' }
              })
            }
          >保存</Button>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() =>
              void perform(async () => {
                await reload()
                return { message: '工作区列表已刷新' }
              })
            }
          >刷新</Button>
        </div>
        <div className="grid gap-2 border-t pt-3">
          <label htmlFor={`${id}-name`} className="text-sm font-medium">工作区名称</label>
          <Input
            id={`${id}-name`}
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={disabled || !name.trim()}
              onClick={() =>
                void perform(async () => {
                  const saved = await saveAs(name.trim())
                  return { message: '工作区已保存', select: saved.id, clearName: true }
                })
              }
            >另存为</Button>
            <Button
              variant="outline"
              disabled={disabled || !name.trim()}
              onClick={() =>
                void perform(async () => {
                  const saved = await create(name.trim())
                  return { message: '已打开新工作区', select: saved.id, clearName: true }
                })
              }
            >新建工作区</Button>
          </div>
        </div>
        <div className="grid gap-2 border-t pt-3">
          <label htmlFor={`${id}-saved`} className="text-sm font-medium">已保存的工作区</label>
          <select
            id={`${id}-saved`}
            value={selected?.id ?? ''}
            disabled={disabled}
            onChange={(event) => setSelectedId(event.target.value)}
            className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">选择工作区</option>
            {catalog?.workspaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {catalog?.workspaces.length === 0 && (
            <p className="text-sm text-muted-foreground">没有已保存的工作区</p>
          )}
          {selected && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button disabled={disabled} onClick={() => void openSaved(selected)}>打开</Button>
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    void perform(async () => {
                      const copy = await run((repository) =>
                        repository.duplicate('workspace', selected.id, `${selected.name} copy`)
                      )
                      return { message: '工作区已复制', select: copy.id }
                    })
                  }
                >复制</Button>
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    void perform(async () => {
                      const text = await run((repository) =>
                        repository.exportDocument('workspace', selected.id)
                      )
                      const url = URL.createObjectURL(
                        new Blob([text], { type: 'application/json' })
                      )
                      try {
                        const anchor = document.createElement('a')
                        anchor.href = url
                        anchor.download = 'chart-workspace.json'
                        anchor.click()
                      } finally {
                        URL.revokeObjectURL(url)
                      }
                      return { message: '工作区已导出' }
                    })
                  }
                >导出 JSON</Button>
                <Button
                  variant="outline"
                  disabled={disabled || confirmDelete}
                  onClick={() => setConfirmDelete(true)}
                >
                  删除
                </Button>
              </div>
              {confirmDelete && (
                <div
                  role="alertdialog"
                  aria-label="删除工作区"
                  className="grid gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3"
                >
                  <p className="text-sm">
                    确定删除已保存的工作区 {selected.name} 吗？
                    {selected.id === activeId
                      ? '该工作区当前已打开：屏幕上的图表会保留为未命名工作区。'
                      : ''}{' '}
                    此操作无法撤销。
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                      保留工作区
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={disabled}
                      onClick={() =>
                        void perform(async () => {
                          await run((repository) => repository.remove('workspace', selected.id))
                          onRemoved(selected.id)
                          setConfirmDelete(false)
                          return {
                            message:
                              '已删除保存的工作区；当前显示的图表仍然保留',
                            select: '',
                          }
                        })
                      }
                    >
                      删除工作区
                    </Button>
                  </div>
                </div>
              )}
              <label htmlFor={`${id}-rename`} className="text-sm font-medium">
                已保存工作区的名称
              </label>
              <div className="flex gap-2">
                <Input
                  id={`${id}-rename`}
                  maxLength={120}
                  value={savedName}
                  onChange={(event) => setSavedName(event.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={disabled || !savedName.trim()}
                  onClick={() =>
                    void perform(async () => {
                      await run((repository) =>
                        repository.rename('workspace', selected.id, savedName.trim())
                      )
                      return { message: '工作区已重命名' }
                    })
                  }
                >
                  重命名
                </Button>
              </div>
            </>
          )}
        </div>
        {!!catalog?.recentWorkspaceIds.length && (
          <div className="grid gap-1 border-t pt-3">
            <p className="text-sm font-medium">最近的工作区</p>
            {catalog.recentWorkspaceIds.map((key) => {
              const document = catalog.workspaces.find((item) => item.id === key)
              return document ? (
                <Button
                  key={key}
                  variant="ghost"
                  className="justify-start"
                  disabled={disabled}
                  onClick={() => void openSaved(document)}
                >
                  {document.name}
                </Button>
              ) : null
            })}
          </div>
        )}
        <label htmlFor={`${id}-import`} className="text-sm font-medium">
          导入工作区 JSON
        </label>
        <Input
          id={`${id}-import`}
          type="file"
          accept=".json,application/json"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void perform(async () => {
              if (file.size > 5 * 1024 * 1024)
                throw new Error('工作区文件大小不能超过 5 MB')
              const document = parseWorkspaceDocument(await file.text())
              const saved = await importWorkspace(document)
              return { message: '工作区已导入并打开', select: saved.id }
            })
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
