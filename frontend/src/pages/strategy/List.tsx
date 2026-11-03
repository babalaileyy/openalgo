// pages/strategy/List.tsx
// Saved strategies: status, mode and P&L at a glance.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  deleteStrategy,
  listStrategies,
  strategyQueryKeys,
  useStrategyListPnl,
} from '@/api/strategy_module'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  formatIst,
  formatListPnl,
  formatPnl,
  pnlToneClass,
  type StrategyStatus,
  universeTabLabel,
} from '@/types/strategy_module'
import { showToast } from '@/utils/toast'

function statusBadgeVariant(
  status: StrategyStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'running':
      return 'default'
    case 'paused':
      return 'secondary'
    case 'errored':
      return 'destructive'
    default:
      return 'outline'
  }
}

export default function StrategyList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: strategyQueryKeys.list({}),
    queryFn: () => listStrategies({}),
    refetchInterval: 30_000,
  })

  const rows = data ?? []
  const pnlById = useStrategyListPnl(rows)

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteStrategy(id),
    onSuccess: () => {
      showToast.success('策略已删除')
      queryClient.invalidateQueries({ queryKey: strategyQueryKeys.strategies() })
      setDeleteTargetId(null)
    },
    onError: (err: Error) => {
      showToast.error(err.message || '删除失败')
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">策略</h1>
          <p className="text-sm text-muted-foreground">
            支持全程风险管理的多腿期权策略。默认使用模拟盘；实盘模式需要为每个策略单独启用。
          </p>
        </div>
        <Button onClick={() => navigate('/strategy/new')}>+ 新建策略</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>已保存的策略</CardTitle>
          <CardDescription>
            运行中策略的盈亏实时更新；已停止策略显示上次运行的快照。状态表示当前是否正在运行。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              加载策略失败，请检查后端日志。
            </p>
          ) : isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
          ) : rows.length === 0 ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">暂无策略。</p>
              <Button variant="secondary" onClick={() => navigate('/strategy/new')}>
                创建第一个策略
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>模式</TableHead>
                    <TableHead>标的</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead className="text-right">已实现盈亏</TableHead>
                    <TableHead className="text-right">未实现盈亏</TableHead>
                    <TableHead className="text-right">总盈亏</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => {
                    const pnl = pnlById.get(row.id)
                    return (
                      <TableRow key={row.id} className={index % 2 === 0 ? 'bg-muted/30' : ''}>
                        <TableCell>
                          <Link to={`/strategy/${row.id}`} className="font-medium hover:underline">
                            {row.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(row.status)}>{({ running: '运行中', paused: '已暂停', errored: '出错', stopped: '已停止', draft: '草稿' } as Record<string, string>)[row.status] ?? row.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.live_enabled ? 'destructive' : 'secondary'}>
                            {row.live_enabled ? '已启用实盘' : '仅模拟盘'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{row.underlying}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {universeTabLabel(row.universe_tab)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{({ batch: '批量', signal: '信号' } as Record<string, string>)[row.strategy_type] ?? row.strategy_type}</Badge>
                        </TableCell>
                        <TableCell
                          className={cn('text-right font-mono', pnlToneClass(pnl?.realized))}
                        >
                          {pnl?.finalized ? formatPnl(pnl.realized) : formatListPnl(pnl?.realized)}
                        </TableCell>
                        <TableCell
                          className={cn('text-right font-mono', pnlToneClass(pnl?.unrealized))}
                        >
                          {pnl?.finalized
                            ? formatPnl(pnl.unrealized)
                            : formatListPnl(pnl?.unrealized)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono font-medium',
                            pnlToneClass(pnl?.total)
                          )}
                        >
                          {pnl?.finalized ? formatPnl(pnl.total) : formatListPnl(pnl?.total)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatIst(row.updated_at, false)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/strategy/${row.id}`)}
                            >
                              打开
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={row.status === 'running'}
                              title={
                                row.status === 'running'
                                  ? '运行中无法删除'
                                  : undefined
                              }
                              onClick={() => setDeleteTargetId(row.id)}
                            >
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">删除此策略？</DialogTitle>
            <DialogDescription>
              此操作将永久删除策略及其审计记录，无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTargetId(null)}
              disabled={deleteMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              className="min-w-[120px]"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTargetId !== null) deleteMutation.mutate(deleteTargetId)
              }}
            >
              {deleteMutation.isPending ? '处理中…' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
