import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  PlayCircle,
  RefreshCw,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { webClient } from '@/api/client'
import { useSocketContext } from '@/components/socket/SocketProvider'
import { useKeepReconnecting } from '@/components/socket/useKeepReconnecting'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAlertStore } from '@/stores/alertStore'
import { showToast } from '@/utils/toast'

interface PendingOrder {
  id: number
  strategy: string
  api_type: string
  symbol: string
  exchange: string
  action: 'BUY' | 'SELL' | 'MULTI'
  quantity: number | string
  price: number | string
  price_type: string
  product_type: string
  status: 'pending' | 'approved' | 'rejected'
  created_at_ist: string
  raw_order_data: Record<string, unknown>
  /** What the broker said once the order was sent, e.g. open, complete, rejected. */
  broker_status?: string | null
  broker_order_id?: string | null
  /**
   * Seconds since the order was approved, measured by the server when this
   * list was read. Null while it is pending. Approval age alone cannot tell
   * whether a long split or basket send is still running.
   */
  approved_age_seconds?: number | null
}

/**
 * The broker_status of an approved order OpenAlgo has started sending and has
 * no broker answer recorded for (SUBMITTING in database/action_center_db.py).
 *
 * It is written just before the order goes to the broker and replaced by the
 * broker's answer as soon as there is one. A long-running split or basket send
 * can remain in this state for minutes; a crash can leave it there indefinitely.
 * Elapsed time cannot distinguish those cases, so the page never treats age as
 * proof that sending stopped.
 */
const SENDING_NOT_CONFIRMED = 'submitting'

/**
 * When to show a longer-wait notice. This is a prompt to investigate an order
 * without a broker answer, not a deadline after which sending must have stopped.
 */
export const SEND_SETTLE_MS = 120_000

/** When this order's send began, on this page's clock, or null if unknown. */
function sendStartedAt(order: PendingOrder, readAt: number): number | null {
  const age = order.approved_age_seconds
  if (typeof age !== 'number' || !Number.isFinite(age)) return null
  return readAt - age * 1000
}

function isClaimed(order: PendingOrder): boolean {
  return order.status === 'approved' && order.broker_status === SENDING_NOT_CONFIRMED
}

/** An approved order in the initial sending window. */
function isSending(order: PendingOrder, readAt: number, now: number): boolean {
  const started = sendStartedAt(order, readAt)
  return isClaimed(order) && started !== null && now - started < SEND_SETTLE_MS
}

/** An approved order still lacking an answer after the initial window. */
function isSendNotConfirmed(order: PendingOrder, readAt: number, now: number): boolean {
  return isClaimed(order) && !isSending(order, readAt, now)
}

interface OrderStats {
  total_pending: number
  total_approved: number
  total_rejected: number
  total_buy_orders: number
  total_sell_orders: number
}

interface ActionCenterResponse {
  status: string
  data: {
    orders: PendingOrder[]
    statistics: OrderStats
  }
}

export default function ActionCenterPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [stats, setStats] = useState<OrderStats>({
    total_pending: 0,
    total_approved: 0,
    total_rejected: 0,
    total_buy_orders: 0,
    total_sell_orders: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>(
    'pending'
  )
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set())
  // When the list was read, and the clock the send states are judged by.
  const [readAt, setReadAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  // Confirmation dialogs
  const [orderToDelete, setOrderToDelete] = useState<PendingOrder | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isApproving, setIsApproving] = useState<number | null>(null)
  const [isRejecting, setIsRejecting] = useState<number | null>(null)
  const [isApprovingAll, setIsApprovingAll] = useState(false)

  // The app-wide Socket.IO connection, for realtime updates
  const { socket } = useSocketContext()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const fetchData = useCallback(async () => {
    try {
      // Always named, "all" included: the server reads a missing status as
      // pending, so All Orders used to list only the pending ones.
      const response = await webClient.get<ActionCenterResponse>(
        `/action-center/api/data?status=${activeFilter}`
      )

      if (response.data.status === 'success') {
        const read = Date.now()
        setReadAt(read)
        setNow(read)
        setOrders(Array.isArray(response.data.data.orders) ? response.data.data.orders : [])
        setStats(
          response.data.data.statistics || {
            total_pending: 0,
            total_approved: 0,
            total_rejected: 0,
            total_buy_orders: 0,
            total_sell_orders: 0,
          }
        )
      }
    } catch (_error) {
      showToast.error('无法加载操作中心数据', 'actionCenter')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [activeFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // A send may finish, which refreshes this page through pending_order_updated,
  // or outlive SEND_SETTLE_MS. Look again then and show the longer-wait notice
  // without assuming that the send stopped.
  useEffect(() => {
    let next: number | null = null
    for (const order of orders) {
      if (!isSending(order, readAt, now)) continue
      const started = sendStartedAt(order, readAt)
      if (started === null) continue
      const settles = started + SEND_SETTLE_MS
      if (next === null || settles < next) next = settles
    }
    if (next === null) return
    const timer = window.setTimeout(
      () => {
        setNow(Date.now())
        fetchData()
      },
      Math.max(0, next - Date.now()) + 50
    )
    return () => window.clearTimeout(timer)
  }, [orders, readAt, now, fetchData])

  // Alert sound for newly queued orders
  useEffect(() => {
    audioRef.current = new Audio('/sounds/alert.mp3')
    audioRef.current.preload = 'auto'
  }, [])

  // Realtime order updates, on the app-wide connection SocketProvider owns.
  // This page used to open a second connection of its own, which the server had
  // to keep waiting alongside the first for as long as the page was open.
  useEffect(() => {
    if (!socket) return

    // Listen for new pending orders (semi-auto mode)
    const onCreated = (data: { api_type: string; message: string }) => {
      const { shouldShowToast, shouldPlaySound } = useAlertStore.getState()

      // Play alert sound if enabled
      if (shouldPlaySound() && shouldShowToast('actionCenter') && audioRef.current) {
        audioRef.current.play().catch(() => {})
      }

      // Show toast notification (showToast handles category filtering)
      showToast.warning(`新订单已进入审批队列：${data.message}`, 'actionCenter', {
        duration: 5000,
      })

      // Refresh data to show new order (always do this regardless of toast settings)
      fetchData()
    }

    // Listen for order updates (approved, rejected, deleted)
    const onUpdated = () => {
      // Refresh data
      fetchData()
    }

    socket.on('pending_order_created', onCreated)
    socket.on('pending_order_updated', onUpdated)

    // Remove only this page's handlers: the connection is shared with the rest
    // of the app and stays open.
    return () => {
      socket.off('pending_order_created', onCreated)
      socket.off('pending_order_updated', onUpdated)
    }
  }, [socket, fetchData])

  // The connection this page used to own never stopped trying to reconnect, so
  // a trader waiting here for orders to approve got them again after a server
  // restart of any length. The shared connection gives up after five attempts;
  // keep it trying while this page is open.
  useKeepReconnecting(socket)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchData()
    showToast.success('数据已刷新', 'actionCenter')
  }

  const handleApprove = async (orderId: number) => {
    setIsApproving(orderId)
    try {
      const response = await webClient.post<{ status: string; message: string }>(
        `/action-center/approve/${orderId}`,
        {}
      )

      if (response.data.status === 'success') {
        showToast.success(response.data.message || '订单已批准并执行', 'actionCenter')
        fetchData()
      } else if (response.data.status === 'warning') {
        showToast.warning(response.data.message, 'actionCenter')
        fetchData()
      } else {
        showToast.error(response.data.message || '批准订单失败', 'actionCenter')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      showToast.error(err.response?.data?.message || '批准订单失败', 'actionCenter')
    } finally {
      setIsApproving(null)
    }
  }

  const handleReject = async (orderId: number) => {
    setIsRejecting(orderId)
    try {
      const response = await webClient.post<{ status: string; message: string }>(
        `/action-center/reject/${orderId}`,
        { reason: 'Rejected by user' }
      )

      if (response.data.status === 'success') {
        showToast.success('订单已拒绝', 'actionCenter')
        fetchData()
      } else {
        showToast.error(response.data.message || '拒绝订单失败', 'actionCenter')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      showToast.error(err.response?.data?.message || '拒绝订单失败', 'actionCenter')
    } finally {
      setIsRejecting(null)
    }
  }

  const handleDelete = async () => {
    if (!orderToDelete) return

    setIsDeleting(true)
    try {
      const response = await webClient.delete<{ status: string; message: string }>(
        `/action-center/delete/${orderToDelete.id}`
      )

      if (response.data.status === 'success') {
        showToast.success('订单已删除', 'actionCenter')
        setOrderToDelete(null)
        fetchData()
      } else {
        showToast.error(response.data.message || '删除订单失败', 'actionCenter')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      showToast.error(err.response?.data?.message || '删除订单失败', 'actionCenter')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleApproveAll = async () => {
    setIsApprovingAll(true)
    try {
      const response = await webClient.post<{ status: string; message: string }>(
        '/action-center/approve-all',
        {}
      )

      if (response.data.status === 'success') {
        showToast.success(response.data.message || '所有订单已批准', 'actionCenter')
        fetchData()
      } else if (response.data.status === 'warning') {
        showToast.warning(response.data.message, 'actionCenter')
        fetchData()
      } else {
        showToast.error(response.data.message || '批量批准订单失败', 'actionCenter')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      showToast.error(err.response?.data?.message || '批量批准订单失败', 'actionCenter')
    } finally {
      setIsApprovingAll(false)
    }
  }

  const toggleExpanded = (orderId: number) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const getExchangeBadgeVariant = (exchange: string): 'default' | 'secondary' | 'outline' => {
    switch (exchange) {
      case 'NSE':
        return 'default'
      case 'NFO':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getPriceTypeBadgeVariant = (
    priceType: string
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (priceType) {
      case 'MARKET':
        return 'default'
      case 'LIMIT':
        return 'secondary'
      case 'SL':
      case 'SL-M':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getRelativeTime = (istTimestamp: string): string => {
    if (!istTimestamp) return ''
    try {
      const orderTime = new Date(istTimestamp.replace(' IST', ''))
      const now = new Date()
      const diffMs = now.getTime() - orderTime.getTime()
      const diffMins = Math.floor(diffMs / 60000)

      if (diffMins < 1) return '刚刚'
      if (diffMins === 1) return '1 分钟前'
      if (diffMins < 60) return `${diffMins} 分钟前`

      const diffHours = Math.floor(diffMins / 60)
      if (diffHours === 1) return '1 小时前'
      if (diffHours < 24) return `${diffHours} 小时前`

      const diffDays = Math.floor(diffHours / 24)
      if (diffDays === 1) return '昨天'
      return `${diffDays} 天前`
    } catch {
      return ''
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="py-6 space-y-6">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>OpenAlgo 操作中心</AlertTitle>
        <AlertDescription>
          在此集中管理半自动交易订单。在 API 密钥设置中启用半自动模式后，收到的订单将在此排队，须经人工审批后才会发送给券商。
        </AlertDescription>
      </Alert>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PlayCircle className="h-6 w-6" />
              操作中心
            </h1>
          </div>
          <p className="text-muted-foreground">审核并管理待处理订单</p>
        </div>
        <div className="flex gap-2">
          {activeFilter === 'pending' && stats.total_pending > 0 && (
            <Button
              variant="default"
              className="bg-green-500 hover:bg-green-600"
              onClick={handleApproveAll}
              disabled={isApprovingAll}
            >
              {isApprovingAll ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              全部批准（{stats.total_pending}）
            </Button>
          )}
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Link to="/apikey">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              切换订单模式
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}>
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            待审批
            {stats.total_pending > 0 && (
              <Badge variant="destructive" className="ml-2 animate-pulse">
                {stats.total_pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            已批准
            {stats.total_approved > 0 && (
              <Badge variant="secondary" className="ml-2 bg-green-500">
                {stats.total_approved}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected">
            已拒绝
            {stats.total_rejected > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.total_rejected}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">全部订单</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{stats.total_pending}</p>
            <p className="text-sm text-muted-foreground">待审批</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.total_buy_orders}</p>
            <p className="text-sm text-muted-foreground">买入订单</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.total_sell_orders}</p>
            <p className="text-sm text-muted-foreground">卖出订单</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.total_approved}</p>
            <p className="text-sm text-muted-foreground">已批准</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.total_rejected}</p>
            <p className="text-sm text-muted-foreground">已拒绝</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>订单</CardTitle>
          <CardDescription>共 {orders.length} 笔订单</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>策略</TableHead>
                  <TableHead>品种</TableHead>
                  <TableHead>交易所</TableHead>
                  <TableHead>方向</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">价格</TableHead>
                  <TableHead>订单类型</TableHead>
                  <TableHead>交易产品</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      <div className="space-y-2">
                        <p>暂无订单</p>
                        <p className="text-sm">
                          在
                          <Link to="/apikey" className="text-primary hover:underline">
                            API 密钥设置
                          </Link>{' '}
                          中启用半自动模式后，订单将在此排队。
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <>
                      <TableRow key={order.id}>
                        <TableCell>
                          <Badge variant="outline">{order.strategy}</Badge>
                          <div className="text-xs text-muted-foreground mt-1">{order.api_type}</div>
                        </TableCell>
                        <TableCell className="font-medium">{order.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={getExchangeBadgeVariant(order.exchange)}>
                            {order.exchange}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`gap-1 ${
                              order.action === 'BUY'
                                ? 'bg-green-500 hover:bg-green-600'
                                : order.action === 'SELL'
                                  ? 'bg-red-500 hover:bg-red-600'
                                  : 'bg-muted text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {order.action === 'BUY' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : order.action === 'SELL' ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : null}
                            {order.action === 'BUY' ? '买入' : order.action === 'SELL' ? '卖出' : order.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{order.quantity}</TableCell>
                        <TableCell className="text-right font-mono">{order.price || 0}</TableCell>
                        <TableCell>
                          <Badge variant={getPriceTypeBadgeVariant(order.price_type)}>
                            {order.price_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{order.product_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-mono">{order.created_at_ist}</div>
                          <div className="text-xs text-muted-foreground">
                            {getRelativeTime(order.created_at_ist)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => toggleExpanded(order.id)}
                              aria-label={
                                expandedOrders.has(order.id)
                                  ? '收起订单详情'
                                  : '展开订单详情'
                              }
                            >
                              {expandedOrders.has(order.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>

                            {isSending(order, readAt, now) && (
                              <Badge variant="outline" className="h-8">
                                发送中
                              </Badge>
                            )}

                            {isSendNotConfirmed(order, readAt, now) && (
                              <Badge
                                variant="outline"
                                className="h-8 border-amber-500 text-amber-700 dark:text-amber-400"
                              >
                                状态未确认
                              </Badge>
                            )}

                            {order.status === 'pending' ? (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-green-500 hover:bg-green-600 h-8"
                                  onClick={() => handleApprove(order.id)}
                                  disabled={isApproving === order.id}
                                >
                                  {isApproving === order.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8"
                                  onClick={() => handleReject(order.id)}
                                  disabled={isRejecting === order.id}
                                >
                                  {isRejecting === order.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <X className="h-4 w-4" />
                                  )}
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-destructive hover:text-destructive"
                                onClick={() => setOrderToDelete(order)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* A long send may still be running or have been interrupted. */}
                      {isSendNotConfirmed(order, readAt, now) && (
                        <TableRow>
                          <TableCell colSpan={10} className="p-2">
                            <Alert variant="warning">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>此订单可能仍在发送</AlertTitle>
                              <AlertDescription>
                                系统尚未记录券商的响应。拆分订单或篮子订单可能需要超过两分钟；订单可能仍在发送，也可能因中断而结果未知。请检查券商订单簿并刷新此页面。在状态未确认前，请勿重复下单。
                              </AlertDescription>
                            </Alert>
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Expanded Details Row */}
                      {expandedOrders.has(order.id) && (
                        <TableRow>
                          <TableCell colSpan={10} className="bg-muted/50 p-4">
                            <Collapsible open={true}>
                              <CollapsibleContent>
                                <div className="space-y-4">
                                  <h4 className="font-semibold">订单详情</h4>

                                  {/* Order Type Specific Details */}
                                  {order.api_type === 'basketorder' &&
                                  order.raw_order_data.orders ? (
                                    <div className="space-y-3">
                                      <p className="text-sm text-muted-foreground">
                                        篮子订单，共 
                                        {Array.isArray(order.raw_order_data.orders)
                                          ? order.raw_order_data.orders.length
                                          : 0}{' '}
                                        笔
                                      </p>
                                      {Array.isArray(order.raw_order_data.orders) &&
                                        order.raw_order_data.orders.map(
                                          (basketOrder: Record<string, unknown>, idx: number) => (
                                            <Card key={idx}>
                                              <CardContent className="p-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <Badge variant="outline">订单 {idx + 1}</Badge>
                                                  <span className="font-medium">
                                                    {String(basketOrder.symbol || '')}
                                                  </span>
                                                  <Badge
                                                    className={
                                                      basketOrder.action === 'BUY'
                                                        ? 'bg-green-500'
                                                        : 'bg-red-500'
                                                    }
                                                  >
                                                    {String(basketOrder.action || '')}
                                                  </Badge>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2 text-sm">
                                                  {Object.entries(basketOrder).map(
                                                    ([key, value]) => (
                                                      <div key={key}>
                                                        <span className="text-muted-foreground">
                                                          {key}:
                                                        </span>{' '}
                                                        <span className="font-medium">
                                                          {String(value)}
                                                        </span>
                                                      </div>
                                                    )
                                                  )}
                                                </div>
                                              </CardContent>
                                            </Card>
                                          )
                                        )}
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                      {Object.entries(order.raw_order_data).map(([key, value]) => (
                                        <div key={key} className="bg-background rounded-lg p-3">
                                          <p className="text-xs text-muted-foreground uppercase">
                                            {key}
                                          </p>
                                          <p className="font-medium break-all">
                                            {typeof value === 'object'
                                              ? JSON.stringify(value, null, 2)
                                              : String(value)}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除订单？</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除此订单吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? '删除中…' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
