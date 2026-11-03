import {
  AlertTriangle,
  Calendar,
  Clock,
  Download,
  FileCode,
  FileText,
  HelpCircle,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { pythonStrategyApi } from '@/api/python-strategy'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { MasterContractStatus, PythonStrategy } from '@/types/python-strategy'
import {
  CRYPTO_EXCHANGE_VALUE,
  STATUS_COLORS,
} from '@/types/python-strategy'
import { showToast } from '@/utils/toast'

/**
 * The schedule as a trader reads it. A strategy saved with no stop time is a
 * crypto strategy running around the clock; filling in a stop time it does
 * not have would say it stops when it never does.
 */
function scheduleWindow(strategy: PythonStrategy): string {
  const start = strategy.schedule_start_time || '09:00'
  if (strategy.schedule_stop_time) return `${start} - ${strategy.schedule_stop_time}`
  const everyDay = new Set(strategy.schedule_days ?? []).size === 7
  if (strategy.exchange === CRYPTO_EXCHANGE_VALUE && everyDay && start === '00:00') return '24/7'
  return `从 ${start} 开始，无停止时间`
}

export default function PythonStrategyIndex() {
  const navigate = useNavigate()
  const [strategies, setStrategies] = useState<PythonStrategy[]>([])
  const [masterStatus, setMasterStatus] = useState<MasterContractStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [strategyToDelete, setStrategyToDelete] = useState<PythonStrategy | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const [strategiesData, statusData] = await Promise.all([
        pythonStrategyApi.getStrategies(),
        pythonStrategyApi.getMasterContractStatus(),
      ])
      setStrategies(strategiesData)
      setMasterStatus(statusData)
    } catch (_error) {
      if (!silent) showToast.error('加载策略失败', 'pythonStrategy')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only init of the 1s timer and SSE subscription; adding fetchData would tear down and recreate the EventSource on every render
  useEffect(() => {
    fetchData()
    // Update current time every second
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)

    // Subscribe to SSE for real-time status updates
    const eventSource = new EventSource('/python/api/events')

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'connected') {
          return
        }

        // Refresh data silently when we receive a status update
        if (data.strategy_id && data.status) {
          fetchData(true) // Silent refresh
        }
      } catch (_e) {
        // Ignore parse errors (heartbeat messages)
      }
    }

    eventSource.onerror = () => {}

    return () => {
      clearInterval(timer)
      eventSource.close()
    }
  }, [])

  const handleStart = async (strategy: PythonStrategy) => {
    try {
      setActionLoading(strategy.id)
      const response = await pythonStrategyApi.startStrategy(strategy.id)
      if (response.status === 'success') {
        // Use response message which differs for immediate start vs armed for schedule
        showToast.success(response.message || `策略 ${strategy.name} 已启动`, 'pythonStrategy')
        fetchData()
      } else {
        showToast.error(response.message || '启动策略失败', 'pythonStrategy')
      }
    } catch (error: unknown) {
      // Extract error message from Axios response
      const axiosError = error as { response?: { data?: { message?: string } } }
      const errorMessage = axiosError.response?.data?.message || '启动策略失败'
      showToast.error(errorMessage, 'pythonStrategy')
    } finally {
      setActionLoading(null)
    }
  }

  const handleStop = async (strategy: PythonStrategy) => {
    try {
      setActionLoading(strategy.id)
      const response = await pythonStrategyApi.stopStrategy(strategy.id)
      if (response.status === 'success') {
        // Use response message which differs for running vs scheduled strategies
        showToast.success(response.message || `策略 ${strategy.name} 已停止`, 'pythonStrategy')
        fetchData()
      } else {
        showToast.error(response.message || '停止策略失败', 'pythonStrategy')
      }
    } catch (_error) {
      showToast.error('停止策略失败', 'pythonStrategy')
    } finally {
      setActionLoading(null)
    }
  }

  const handleClearError = async (strategy: PythonStrategy) => {
    try {
      setActionLoading(strategy.id)
      const response = await pythonStrategyApi.clearError(strategy.id)
      if (response.status === 'success') {
        showToast.success('错误已清除', 'pythonStrategy')
        fetchData()
      } else {
        showToast.error(response.message || '清除错误失败', 'pythonStrategy')
      }
    } catch (_error) {
      showToast.error('清除错误失败', 'pythonStrategy')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!strategyToDelete) return
    try {
      setActionLoading(strategyToDelete.id)
      const response = await pythonStrategyApi.deleteStrategy(strategyToDelete.id)
      if (response.status === 'success') {
        showToast.success('策略已删除', 'pythonStrategy')
        setStrategies(strategies.filter((s) => s.id !== strategyToDelete.id))
      } else {
        showToast.error(response.message || '删除策略失败', 'pythonStrategy')
      }
    } catch (_error) {
      showToast.error('删除策略失败', 'pythonStrategy')
    } finally {
      setActionLoading(null)
      setDeleteDialogOpen(false)
      setStrategyToDelete(null)
    }
  }

  const handleExport = async (strategy: PythonStrategy) => {
    try {
      const blob = await pythonStrategyApi.exportStrategy(strategy.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = strategy.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast.success('策略已导出', 'pythonStrategy')
    } catch (_error) {
      showToast.error('导出策略失败', 'pythonStrategy')
    }
  }

  const handleCheckContracts = async () => {
    try {
      setActionLoading('master')
      const response = await pythonStrategyApi.checkAndStartPending()
      if (response.status === 'success') {
        const started = response.data?.started || 0
        showToast.success(`已启动 ${started} 个待运行策略`, 'pythonStrategy')
        fetchData()
      } else {
        showToast.error(response.message || '检查合约失败', 'pythonStrategy')
      }
    } catch (_error) {
      showToast.error('检查合约失败', 'pythonStrategy')
    } finally {
      setActionLoading(null)
    }
  }

  const formatScheduleDays = (days: string[]) => {
    if (!days || days.length === 0) return ''
    if (days.length === 7) return '每天'
    if (days.length === 5 && !days.includes('sat') && !days.includes('sun')) return '工作日'
    return days
      .map((d) => ({ mon: '周一', tue: '周二', wed: '周三', thu: '周四', fri: '周五', sat: '周六', sun: '周日' } as Record<string, string>)[d] || d)
      .join(', ')
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-'
    return new Date(timeStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Stats
  const stats = {
    total: strategies.length,
    running: strategies.filter((s) => s.status === 'running').length,
    scheduled: strategies.filter((s) => s.is_scheduled).length,
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Python 策略</h1>
          <p className="text-muted-foreground">管理和运行 Python 交易脚本</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/python/guide')}>
            <HelpCircle className="h-4 w-4 mr-2" />
            指南
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button onClick={() => navigate('/python/new')}>
            <Plus className="h-4 w-4 mr-2" />
            添加策略
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总数</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileCode className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">运行中</p>
                <p className="text-2xl font-bold text-green-500">{stats.running}</p>
              </div>
              <Play className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已定时</p>
                <p className="text-2xl font-bold text-blue-500">{stats.scheduled}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">主合约</p>
                <Badge variant={masterStatus?.ready ? 'default' : 'secondary'}>
                  {masterStatus?.ready ? '已就绪' : '未就绪'}
                </Badge>
              </div>
              {!masterStatus?.ready && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCheckContracts}
                  disabled={actionLoading === 'master'}
                >
                  检查
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Time */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        当前印度标准时间（IST）： {currentTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
      </div>

      {/* Strategies Grid */}
      {strategies.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <FileCode className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无 Python 策略</h3>
            <p className="text-muted-foreground mb-4">
              上传第一个 Python 交易脚本，即可开始使用。
            </p>
            <Button onClick={() => navigate('/python/new')}>
              <Plus className="h-4 w-4 mr-2" />
              添加策略
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
          {strategies.map((strategy) => (
            <Card key={strategy.id} className="relative overflow-hidden flex flex-col">
              {/* Status bar */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${STATUS_COLORS[strategy.status]}`}
              />

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2 overflow-hidden">
                  <div className="min-w-0 flex-1 space-y-1">
                    <CardTitle className="text-lg truncate">{strategy.name}</CardTitle>
                    <CardDescription className="font-mono text-xs truncate">
                      {strategy.file_name}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge
                          variant={strategy.status === 'running' ? 'default' : 'secondary'}
                          className={`${STATUS_COLORS[strategy.status] || ''} whitespace-nowrap`}
                        >
                          {({ running: '运行中', stopped: '已停止', error: '出错', scheduled: '已定时', paused: '已暂停', manually_stopped: '手动停止' } as Record<string, string>)[strategy.status] || strategy.status}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {strategy.status_message || ({ running: '运行中', stopped: '已停止', error: '出错', scheduled: '已定时', paused: '已暂停', manually_stopped: '手动停止' } as Record<string, string>)[strategy.status] || strategy.status}
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="策略操作菜单">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExport(strategy)}>
                          <Download className="h-4 w-4 mr-2" />
                          导出
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-500"
                          disabled={strategy.status === 'running'}
                          onClick={() => {
                            setStrategyToDelete(strategy)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1 flex flex-col">
                {/* Schedule Info - always show */}
                <div className="text-sm p-2 rounded min-h-[52px] bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <span>{scheduleWindow(strategy)}</span>
                    {strategy.exchange && (
                      <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-700 dark:text-blue-300">
                        {strategy.exchange}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatScheduleDays(
                      strategy.schedule_days?.length
                        ? strategy.schedule_days
                        : ['mon', 'tue', 'wed', 'thu', 'fri']
                    )}
                  </p>
                </div>

                {/* Error Message */}
                {strategy.status === 'error' && strategy.error_message && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {strategy.error_message}
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto ml-2"
                        onClick={() => handleClearError(strategy)}
                      >
                        清除
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-auto">
                  <div>
                    <span className="block">上次启动</span>
                    <span>{formatTime(strategy.last_started)}</span>
                  </div>
                  <div>
                    <span className="block">上次停止</span>
                    <span>{formatTime(strategy.last_stopped)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 mt-auto">
                  {strategy.status === 'running' || strategy.status === 'scheduled' ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={strategy.status === 'running' ? 'destructive' : 'outline'}
                          size="sm"
                          className={`flex-1 ${strategy.status === 'scheduled' ? 'border-orange-500 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950' : ''}`}
                          onClick={() => handleStop(strategy)}
                          disabled={actionLoading === strategy.id}
                        >
                          <Square className="h-4 w-4 mr-2" />
                          {strategy.status === 'running' ? '停止' : '取消'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {strategy.status === 'running'
                          ? '停止运行中的策略'
                          : '取消定时自动启动'}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleStart(strategy)}
                          disabled={actionLoading === strategy.id}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          启动
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>启动策略</TooltipContent>
                    </Tooltip>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                        asChild
                        disabled={strategy.status === 'running'}
                      >
                        <Link to={`/python/${strategy.id}/schedule`}>
                          <Pencil className="h-4 w-4 mr-1" />
                          <span className="text-xs">定时</span>
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {strategy.schedule_start_time ? scheduleWindow(strategy) : '编辑定时设置'}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/python/${strategy.id}/logs`}>
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>查看日志</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/python/${strategy.id}/edit`}>
                          <FileCode className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>编辑代码</TooltipContent>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除策略</DialogTitle>
            <DialogDescription>
              确定删除“{strategyToDelete?.name}”吗？这将删除策略文件及所有相关日志。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除策略
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
