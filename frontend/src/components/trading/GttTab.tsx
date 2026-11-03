import { Download, Loader2, Pencil, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { tradingApi } from '@/api/trading'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn, makeFormatCurrency, sanitizeCSV } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { onModeChange } from '@/stores/themeStore'
import type { GttOrder } from '@/types/trading'
import { showToast } from '@/utils/toast'

interface ModifyForm {
  trigger_type: 'SINGLE' | 'OCO'
  action: string
  product: string
  pricetype: string
  quantity: number
  // SINGLE: entry/limit price; for OCO this is unused (each leg has its own limit).
  price: number
  // Stoploss leg trigger + limit (OCO uses both; SINGLE may use triggerprice_sl alone).
  triggerprice_sl: number
  stoploss: number
  // Target leg trigger + limit (OCO uses both; SINGLE may use triggerprice_tg alone).
  triggerprice_tg: number
  target: number
}

const gttStatusColor: Record<string, string> = {
  active: 'bg-blue-500',
  triggered: 'bg-green-500',
  cancelled: 'bg-gray-500',
  expired: 'bg-gray-500',
  rejected: 'bg-red-500',
  disabled: 'bg-amber-500',
  deleted: 'bg-gray-500',
}

function formatPrices(prices: number[], formatCurrency: (n: number) => string): string {
  if (!prices || prices.length === 0) return '-'
  return prices.map((p) => formatCurrency(p)).join(' / ')
}

function formatDateTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface GttTabProps {
  /**
   * Asked before a cancel or a modify leaves for the broker; true refuses
   * and the host has already said why. The trading dock supplies one so a
   * GTT cannot be changed under a replaying chart, where no other order route
   * on the page will act. The order book page passes nothing.
   */
  refuse?: () => boolean
}

export default function GttTab({ refuse }: GttTabProps = {}) {
  const { apiKey, user } = useAuthStore()
  const formatCurrency = useMemo(() => makeFormatCurrency(user?.broker), [user?.broker])

  const [gtts, setGtts] = useState<GttOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // Modify dialog state
  const [modifyOpen, setModifyOpen] = useState(false)
  const [modifyingGtt, setModifyingGtt] = useState<GttOrder | null>(null)
  const [modifyForm, setModifyForm] = useState<ModifyForm | null>(null)
  const [isSavingModify, setIsSavingModify] = useState(false)

  const fetchGtts = useCallback(
    async (showRefresh = false) => {
      if (!apiKey) {
        setIsLoading(false)
        return
      }
      if (showRefresh) setIsRefreshing(true)
      try {
        // History included: a fired or cancelled trigger stays visible with
        // its status badge instead of vanishing from the tab.
        const response = await tradingApi.getGttOrderbook(apiKey, 'all')
        if (response.status === 'success') {
          setGtts((response.data as GttOrder[]) ?? [])
          setError(null)
        } else {
          // 501 (broker lacks native GTT, or analyze mode) — treat as empty, show hint
          setGtts([])
          setError(response.message || '条件单不可用')
        }
      } catch (e) {
        const axiosError = e as { response?: { data?: { message?: string }; status?: number } }
        const status = axiosError.response?.status
        const msg =
          axiosError.response?.data?.message ||
          (status === 501
            ? '当前券商暂不支持条件单'
            : '获取条件单失败')
        setGtts([])
        setError(msg)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [apiKey]
  )

  useEffect(() => {
    fetchGtts()
  }, [fetchGtts])

  useEffect(() => {
    const unsubscribe = onModeChange(() => fetchGtts())
    return () => unsubscribe()
  }, [fetchGtts])

  const handleCancel = async (triggerId: string) => {
    if (refuse?.()) return
    setCancellingId(triggerId)
    try {
      const response = await tradingApi.cancelGttOrder(triggerId)
      if (response.status === 'success') {
        showToast.success(`条件单已撤销：${triggerId}`, 'orders')
        // Give the broker a moment to reflect the change.
        setTimeout(() => fetchGtts(true), 800)
      } else {
        showToast.error(response.message || '撤销条件单失败', 'orders')
      }
    } catch (e) {
      const axiosError = e as { response?: { data?: { message?: string } } }
      showToast.error(axiosError.response?.data?.message || '撤销条件单失败', 'orders')
    } finally {
      setCancellingId(null)
    }
  }

  const openModify = (gtt: GttOrder) => {
    if (refuse?.()) return
    setModifyingGtt(gtt)

    const isOco = gtt.trigger_type === 'two-leg'
    const firstLeg = gtt.legs[0] ?? {
      action: 'BUY',
      quantity: 0,
      price: 0,
      pricetype: 'LIMIT',
      product: 'CNC',
    }
    // OCO leg ordering matches Kite's ascending trigger_values: [stoploss_leg, target_leg].
    const targetLeg = gtt.legs[1] ?? firstLeg

    setModifyForm({
      trigger_type: isOco ? 'OCO' : 'SINGLE',
      action: String(firstLeg.action || '').toUpperCase(),
      product: String(firstLeg.product || 'CNC'),
      pricetype: String(firstLeg.pricetype || 'LIMIT'),
      quantity: Number(firstLeg.quantity) || 0,
      price: Number(firstLeg.price) || 0,
      // OCO leg ordering matches Kite's ascending trigger_values: [stoploss_leg, target_leg].
      // SINGLE: only one of triggerprice_sl/triggerprice_tg is used (heuristic: index 0).
      triggerprice_sl: isOco
        ? Number(gtt.trigger_prices[0] ?? 0)
        : Number(gtt.trigger_prices[0] ?? 0),
      stoploss: isOco ? Number(firstLeg.price) || 0 : 0,
      triggerprice_tg: isOco ? Number(gtt.trigger_prices[1] ?? 0) : 0,
      target: isOco ? Number(targetLeg.price) || 0 : 0,
    })
    setModifyOpen(true)
  }

  const saveModify = async () => {
    if (!modifyingGtt || !modifyForm) return
    // Asked again here: a replay can start while the dialog stands open.
    if (refuse?.()) return
    if (modifyForm.quantity <= 0 || modifyForm.price < 0) {
      showToast.error('数量必须大于零，限价不能为负数', 'orders')
      return
    }
    if (modifyForm.trigger_type === 'SINGLE') {
      if (modifyForm.triggerprice_sl <= 0 && modifyForm.triggerprice_tg <= 0) {
        showToast.error('单条件单需要填写触发价格', 'orders')
        return
      }
    } else {
      if (
        modifyForm.triggerprice_sl <= 0 ||
        modifyForm.triggerprice_tg <= 0 ||
        modifyForm.stoploss <= 0 ||
        modifyForm.target <= 0
      ) {
        showToast.error(
          'OCO 条件单需要填写止损触发价、止损限价、止盈触发价和止盈限价',
          'orders'
        )
        return
      }
      if (modifyForm.triggerprice_sl >= modifyForm.triggerprice_tg) {
        showToast.error('止损触发价必须小于止盈触发价', 'orders')
        return
      }
    }

    setIsSavingModify(true)
    try {
      const response = await tradingApi.modifyGttOrder(modifyingGtt.trigger_id, {
        symbol: modifyingGtt.symbol,
        exchange: modifyingGtt.exchange,
        trigger_type: modifyForm.trigger_type,
        action: modifyForm.action,
        product: modifyForm.product,
        pricetype: modifyForm.pricetype,
        quantity: modifyForm.quantity,
        price: modifyForm.price,
        triggerprice_sl: modifyForm.triggerprice_sl,
        triggerprice_tg: modifyForm.triggerprice_tg,
        stoploss: modifyForm.trigger_type === 'OCO' ? modifyForm.stoploss : null,
        target: modifyForm.trigger_type === 'OCO' ? modifyForm.target : null,
        strategy: 'GTT Modify',
      })

      if (response.status === 'success') {
        showToast.success(`条件单已修改：${modifyingGtt.trigger_id}`, 'orders')
        setModifyOpen(false)
        setTimeout(() => fetchGtts(true), 800)
      } else {
        showToast.error(response.message || '修改条件单失败', 'orders')
      }
    } catch (e) {
      const axiosError = e as { response?: { data?: { message?: string } } }
      showToast.error(axiosError.response?.data?.message || '修改条件单失败', 'orders')
    } finally {
      setIsSavingModify(false)
    }
  }

  const exportToCSV = () => {
    if (gtts.length === 0) {
      showToast.error('没有可导出的数据', 'system')
      return
    }
    try {
      const headers = [
        'Trigger ID',
        'Type',
        'Symbol',
        'Exchange',
        'Trigger Prices',
        'Last Price',
        'Legs',
        'Status',
        'Created',
        'Expires',
      ]
      const rows = gtts.map((g) => [
        sanitizeCSV(g.trigger_id),
        sanitizeCSV(g.trigger_type),
        sanitizeCSV(g.symbol),
        sanitizeCSV(g.exchange),
        sanitizeCSV(g.trigger_prices.join(' / ')),
        sanitizeCSV(g.last_price),
        sanitizeCSV(
          g.legs
            .map((l) => `${l.action} ${l.quantity} @ ${l.price} ${l.pricetype}/${l.product}`)
            .join(' | ')
        ),
        sanitizeCSV(g.status),
        sanitizeCSV(g.created_at ?? ''),
        sanitizeCSV(g.expires_at ?? ''),
      ])
      const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = `gtt_orderbook_${new Date().toISOString().split('T')[0]}.csv`
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      showToast.success(`已下载 ${filename}`, 'clipboard')
    } catch {
      showToast.error('导出 CSV 失败', 'system')
    }
  }

  const isCancellable = (status: string) => {
    const s = (status || '').toLowerCase()
    return s === 'active' || s === 'disabled'
  }

  return (
    <div className="space-y-4">
      {/* Action row */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => fetchGtts(true)} disabled={isRefreshing}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
          刷新
        </Button>
        <Button variant="outline" size="sm" onClick={exportToCSV} disabled={gtts.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          导出
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error && gtts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{error}</div>
          ) : gtts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">暂无条件单</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">触发单号</TableHead>
                    <TableHead className="w-[80px]">类型</TableHead>
                    <TableHead className="w-[130px]">交易品种</TableHead>
                    <TableHead className="w-[80px]">交易所</TableHead>
                    <TableHead className="w-[140px] text-right">触发价格</TableHead>
                    <TableHead className="w-[100px] text-right">最新价</TableHead>
                    <TableHead>委托腿</TableHead>
                    <TableHead className="w-[100px]">状态</TableHead>
                    <TableHead className="w-[120px]">创建时间</TableHead>
                    <TableHead className="w-[120px]">到期时间</TableHead>
                    <TableHead className="w-[70px]">修改</TableHead>
                    <TableHead className="w-[70px]">撤单</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gtts.map((g) => {
                    const statusClass =
                      gttStatusColor[(g.status || '').toLowerCase()] || 'bg-slate-500'
                    return (
                      <TableRow key={g.trigger_id}>
                        <TableCell className="font-mono text-xs">{g.trigger_id}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {g.trigger_type === 'two-leg' ? 'OCO' : '单条件'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{g.symbol}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{g.exchange}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatPrices(g.trigger_prices, formatCurrency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(g.last_price)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-1">
                            {g.legs.map((leg, i) => (
                              <div
                                key={`${g.trigger_id}-leg-${i}`}
                                className="flex items-center gap-2"
                              >
                                <Badge
                                  variant={
                                    leg.action.toUpperCase() === 'BUY' ? 'default' : 'destructive'
                                  }
                                  className={cn(
                                    'h-5 px-1.5 text-[10px]',
                                    leg.action.toUpperCase() === 'BUY' && 'bg-green-500'
                                  )}
                                >
                                  {leg.action.toUpperCase() === 'BUY' ? '买入' : leg.action.toUpperCase() === 'SELL' ? '卖出' : leg.action}
                                </Badge>
                                <span className="font-mono">
                                  {leg.quantity} @ {formatCurrency(leg.price)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {leg.pricetype} · {leg.product}
                                </span>
                                {leg.triggered_order_id && (
                                  <span className="font-mono text-xs text-muted-foreground">
                                    委托 {leg.triggered_order_id}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('capitalize text-white', statusClass)}>
                            {({ active: '有效', disabled: '已停用', triggered: '已触发', cancelled: '已撤销', canceled: '已撤销', expired: '已到期', rejected: '已拒绝' } as Record<string, string>)[(g.status || '').toLowerCase()] ?? g.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(g.created_at)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(g.expires_at)}
                        </TableCell>
                        <TableCell>
                          {isCancellable(g.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-500 hover:text-blue-600"
                              onClick={() => openModify(g)}
                              aria-label={`修改条件单 ${g.trigger_id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {isCancellable(g.status) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={cancellingId === g.trigger_id}
                                  aria-label={`撤销条件单 ${g.trigger_id}`}
                                >
                                  {cancellingId === g.trigger_id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <X className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>确认撤销条件单？</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    将撤销 <span className="font-medium">{g.symbol}</span> 的条件单{' '}
                                    <span className="font-mono">{g.trigger_id}</span>，此操作无法撤销。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>保留条件单</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleCancel(g.trigger_id)}>
                                    确认撤单
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
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

      {/* Modify GTT Dialog */}
      <Dialog open={modifyOpen} onOpenChange={setModifyOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>修改条件单</span>
              {modifyingGtt && (
                <Badge variant="secondary">
                  {modifyingGtt.trigger_type === 'two-leg' ? 'OCO' : '单条件'}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">修改条件单触发信息</DialogDescription>
          </DialogHeader>

          {modifyingGtt && (
            <>
              {/* Symbol + trigger ID */}
              <div className="rounded-lg border p-4 flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{modifyingGtt.symbol}</div>
                  <div className="text-sm text-muted-foreground">{modifyingGtt.exchange}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">触发单号</div>
                  <div className="font-mono text-sm">{modifyingGtt.trigger_id}</div>
                </div>
              </div>

              {/* Flat order params */}
              {modifyForm && (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={modifyForm.action === 'BUY' ? 'default' : 'destructive'}
                      className={modifyForm.action === 'BUY' ? 'bg-green-500' : ''}
                    >
                      {modifyForm.action === 'BUY' ? '买入' : modifyForm.action === 'SELL' ? '卖出' : modifyForm.action}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {modifyForm.pricetype} · {modifyForm.product}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">数量</Label>
                      <Input
                        type="number"
                        step="1"
                        value={modifyForm.quantity}
                        onChange={(e) =>
                          setModifyForm({
                            ...modifyForm,
                            quantity: parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </div>
                  </div>

                  {modifyForm.trigger_type === 'SINGLE' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">触发价格</Label>
                        <Input
                          type="number"
                          step="0.05"
                          value={modifyForm.triggerprice_sl}
                          onChange={(e) =>
                            setModifyForm({
                              ...modifyForm,
                              triggerprice_sl: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">限价</Label>
                        <Input
                          type="number"
                          step="0.05"
                          value={modifyForm.price}
                          onChange={(e) =>
                            setModifyForm({
                              ...modifyForm,
                              price: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">止损触发价</Label>
                        <Input
                          type="number"
                          step="0.05"
                          value={modifyForm.triggerprice_sl}
                          onChange={(e) =>
                            setModifyForm({
                              ...modifyForm,
                              triggerprice_sl: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">止损限价</Label>
                        <Input
                          type="number"
                          step="0.05"
                          value={modifyForm.stoploss}
                          onChange={(e) =>
                            setModifyForm({
                              ...modifyForm,
                              stoploss: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">止盈触发价</Label>
                        <Input
                          type="number"
                          step="0.05"
                          value={modifyForm.triggerprice_tg}
                          onChange={(e) =>
                            setModifyForm({
                              ...modifyForm,
                              triggerprice_tg: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">止盈限价</Label>
                        <Input
                          type="number"
                          step="0.05"
                          value={modifyForm.target}
                          onChange={(e) =>
                            setModifyForm({
                              ...modifyForm,
                              target: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModifyOpen(false)}
              disabled={isSavingModify}
            >
              取消
            </Button>
            <Button onClick={saveModify} disabled={isSavingModify}>
              {isSavingModify && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
