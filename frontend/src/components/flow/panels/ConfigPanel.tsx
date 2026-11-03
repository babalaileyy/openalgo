// components/flow/panels/ConfigPanel.tsx
// Right sidebar for configuring selected nodes - Full implementation

import { useQuery } from '@tanstack/react-query'
import { Copy, Eye, EyeOff, Info, Loader2, Settings2, Trash2, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useParams } from 'react-router'
import { flowQueryKeys, getIndexSymbolsLotSizes, getWebhookInfo } from '@/api/flow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { PriceType } from '@/lib/flow/constants'
import { flowIndicatorCategory, flowIndicatorName } from '@/lib/flow/indicatorChinese'
import {
  DAYS_OF_WEEK,
  defaultProductForExchange,
  EXCHANGES,
  EXPIRY_TYPES,
  INDEX_SYMBOLS,
  INDICATOR_CATALOG,
  INDICATOR_PARAMS,
  NODE_DEFINITIONS,
  OPTION_NODE_PRODUCT,
  OPTION_STRATEGIES,
  OPTION_TYPES,
  ORDER_ACTIONS,
  PRODUCT_TYPES,
  SCHEDULE_TYPES,
  strikeOffsetOptions,
} from '@/lib/flow/constants'
import { cn } from '@/lib/utils'
import { useFlowWorkflowStore } from '@/stores/flowWorkflowStore'
import type { BasketOrderItem } from '@/types/flow'
import { showToast } from '@/utils/toast'

/**
 * The Basket node's "no blanket product" choice. Radix needs a non-empty item
 * value, and the node stores the absence of a product rather than this string.
 */
const BASKET_PRODUCT_AUTO = 'AUTO'

import { CustomLegsFields } from './CustomLegsFields'
import { IndicatorParamsFields } from './IndicatorParamsFields'
import { MarginPositionsFields } from './MarginPositionsFields'
import {
  ActionField,
  ExchangeField,
  ExpiryField,
  PriceTypeField,
  ProductField,
  QuantityField,
} from './OrderFields'
import { getOptionsMultiStrategyUpdate, OrderPriceFields } from './OrderPriceFields'
import { TemplatableField } from './TemplatableField'

// ===== LOCAL CONSTANTS =====

const ALERT_CONDITIONS = [
  { value: 'above', label: '大于' },
  { value: 'below', label: '小于' },
  { value: 'crosses_above', label: '向上穿越' },
  { value: 'crosses_below', label: '向下穿越' },
]

const ALERT_TRIGGERS = [
  { value: 'once', label: '仅触发一次' },
  { value: 'every_time', label: '每次触发' },
]

const ALERT_EXPIRATION = [
  { value: 'none', label: '永不过期' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '1w', label: '1 Week' },
]

const VARIABLE_OPERATIONS = [
  { value: 'set', label: '设置值', description: '将变量设置为指定值' },
  { value: 'get', label: '获取值', description: '从另一个变量复制' },
  { value: 'add', label: '加', description: '给变量加上指定值' },
  { value: 'subtract', label: '减', description: '从变量减去指定值' },
  { value: 'multiply', label: '乘', description: '将变量乘以指定值' },
  { value: 'divide', label: '除', description: '将变量除以指定值' },
  { value: 'increment', label: '加一', description: '变量加 1' },
  { value: 'decrement', label: '减一', description: '变量减 1' },
  { value: 'parse_json', label: '解析 JSON', description: '将 JSON 字符串解析为对象' },
  { value: 'stringify', label: '转为 JSON 字符串', description: '转换为 JSON 字符串' },
  { value: 'append', label: '追加', description: '追加到字符串' },
]

const LOG_LEVELS = [
  { value: 'info', label: '信息', color: 'text-blue-400' },
  { value: 'warn', label: '警告', color: 'text-yellow-400' },
  { value: 'error', label: '错误', color: 'text-red-400' },
]

const TIME_OPERATORS = [
  { value: '==', label: '等于（=）', description: '恰好在此时间' },
  { value: '>=', label: '等于或晚于（>=）', description: '到达或超过此时间' },
  { value: '<=', label: '等于或早于（<=）', description: '在此时间或之前' },
  { value: '>', label: '晚于（>）', description: '严格晚于此时间' },
  { value: '<', label: '早于（<）', description: '严格早于此时间' },
]

const CONDITION_TYPES = [
  { value: 'entry', label: '开仓' },
  { value: 'exit', label: '平仓' },
  { value: 'custom', label: '自定义' },
]

const HTTP_METHODS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DEL' },
  { value: 'PATCH', label: 'PATCH' },
]

// Node type to display name
const NODE_TITLES: Record<string, string> = {
  start: '定时触发',
  priceAlert: '价格提醒',
  webhookTrigger: 'Webhook 触发',
  orderUpdateTrigger: '订单更新触发',
  placeOrder: '下单',
  smartOrder: '智能下单',
  optionsOrder: '期权下单',
  optionsMultiOrder: '多腿期权',
  basketOrder: '篮子订单',
  splitOrder: '拆单',
  cancelOrder: '撤单',
  cancelAllOrders: '全部撤单',
  closePositions: '平仓',
  modifyOrder: '修改订单',
  getQuote: '获取行情',
  getDepth: '获取盘口',
  getOrderStatus: '订单状态',
  openPosition: '查询持仓',
  history: '历史数据',
  indicator: '技术指标',
  priorPeriodOhlc: '上一周期 OHLC',
  strategyPnl: '策略盈亏',
  barOffset: 'K 线偏移',
  expiry: '获取到期日',
  calendar: '交易日历',
  intervals: '时间周期',
  multiQuotes: '批量行情',
  symbol: '品种信息',
  optionSymbol: '期权合约',
  orderBook: '委托列表',
  tradeBook: '成交列表',
  positionBook: '持仓列表',
  syntheticFuture: '合成期货',
  optionChain: '期权链',
  holidays: '节假日',
  timings: '交易时间',
  holdings: '持有资产',
  funds: '资金',
  margin: '保证金计算',
  delay: '延时',
  waitUntil: '等待至指定时间',
  log: '日志',
  telegramAlert: 'Telegram 提醒',
  whatsappAlert: 'WhatsApp 提醒',
  variable: '变量',
  mathExpression: '数学表达式',
  httpRequest: 'HTTP 请求',
  timeWindow: '时间区间',
  timeCondition: '时间条件',
  priceCondition: '价格条件',
  varCondition: '变量条件',
  positionCheck: '持仓检查',
  fundCheck: '资金检查',
  andGate: '与门',
  orGate: '或门',
  notGate: '非门',
  group: '分组',
  subscribeLtp: '订阅最新价',
  subscribeQuote: '订阅行情',
  subscribeDepth: '订阅盘口',
  unsubscribe: '取消订阅',
}

/** Drop `params` keys the newly selected indicator does not accept.
 *
 * Left alone when the JSON is malformed or holds a {{variable}} reference -
 * that text is the user's to fix, and rewriting it would discard it. */
function pruneIndicatorParams(indicatorName: string, raw: string): string {
  const text = raw.trim()
  if (!text) return ''
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return raw
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return raw
  const allowed = new Set((INDICATOR_PARAMS[indicatorName] ?? []).map((p) => p.name))
  const kept = Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).filter(([key]) => allowed.has(key))
  )
  return Object.keys(kept).length ? JSON.stringify(kept) : ''
}

function getNodeInfo(nodeType: string) {
  for (const category of Object.values(NODE_DEFINITIONS)) {
    const node = category.find((n) => n.type === nodeType)
    if (node) return node
  }
  return null
}

function basketOrdersText(orders: string | BasketOrderItem[] | undefined): string {
  if (Array.isArray(orders)) return JSON.stringify(orders, null, 2)
  return orders || ''
}

function basketOrdersToCsv(orders: BasketOrderItem[]): string {
  return orders
    .map((order) => [order.symbol, order.exchange, order.action, order.quantity].join(','))
    .join('\n')
}

export function ConfigPanel() {
  const { id: workflowId } = useParams<{ id: string }>()
  const { nodes, selectedNodeId, updateNodeData, deleteNode, selectNode } = useFlowWorkflowStore()
  const [showSecret, setShowSecret] = useState(false)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const isWebhookTrigger = selectedNode?.type === 'webhookTrigger'

  const webhookQuery = useQuery({
    queryKey: flowQueryKeys.webhook(Number(workflowId)),
    queryFn: () => getWebhookInfo(Number(workflowId)),
    enabled: isWebhookTrigger && !!workflowId,
  })

  // Fetch dynamic lot sizes for index symbols from master contract DB
  const indexSymbolsQuery = useQuery({
    queryKey: flowQueryKeys.indexSymbols(),
    queryFn: getIndexSymbolsLotSizes,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour (lot sizes don't change often)
  })

  // Helper to get lot size from DB for a given underlying
  const getLotSizeFromDb = (underlying: string): number | null => {
    const dbSymbol = indexSymbolsQuery.data?.find((s) => s.value === underlying)
    return dbSymbol?.lotSize || null
  }

  const isMcxUnderlying = (underlying: string): boolean =>
    INDEX_SYMBOLS.find((s) => s.value === underlying)?.exchange === 'MCX'

  // MCX contracts expire monthly, so the weekly choices have nothing to select
  // and would resolve to the nearest month anyway -- the label would be telling
  // the author something the run does not do.
  const expiryTypesFor = (underlying: string) =>
    isMcxUnderlying(underlying)
      ? EXPIRY_TYPES.filter((e) => e.value.endsWith('_month'))
      : EXPIRY_TYPES

  // Picking an MCX underlying while a weekly expiry is selected would leave the
  // Select rendering an empty trigger, so move it to the nearest equivalent.
  const applyUnderlying = (value: string) => {
    handleDataChange('underlying', value)
    const s = INDEX_SYMBOLS.find((x) => x.value === value)
    if (!s) return
    handleDataChange('exchange', s.exchange)
    if (s.exchange === 'MCX') {
      const expiryType = (nodeData.expiryType as string) || 'current_week'
      if (!expiryType.endsWith('_month')) handleDataChange('expiryType', 'current_month')
    }
  }

  const handleDataChange = useCallback(
    (key: string, value: unknown) => {
      if (selectedNodeId) updateNodeData(selectedNodeId, { [key]: value })
    },
    [selectedNodeId, updateNodeData]
  )

  const handleDelete = useCallback(() => {
    if (selectedNodeId) deleteNode(selectedNodeId)
  }, [selectedNodeId, deleteNode])
  const handleClose = useCallback(() => {
    selectNode(null)
  }, [selectNode])
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    showToast.success(`${label} copied`)
  }

  if (!selectedNode) {
    return (
      <div className="w-80 border-l border-border bg-card flex flex-col h-full">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">属性</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">选择要配置的节点</p>
          </div>
        </div>
      </div>
    )
  }

  const nodeInfo = getNodeInfo(selectedNode.type || '')
  const nodeData = selectedNode.data as Record<string, unknown>
  const nodeType = selectedNode.type || 'unknown'
  const orderPriceType = (nodeData.priceType as PriceType | undefined) || 'MARKET'
  // What the Product control shows. A product the author picked is stored on
  // the node and always wins; with none stored the node follows its exchange,
  // so a derivative segment reads NRML and cash reads MIS. Options nodes trade
  // a derivative whatever their underlying's exchange field happens to be.
  const nodeProduct =
    (nodeData.product as string) ||
    (nodeType === 'optionsOrder' || nodeType === 'optionsMultiOrder'
      ? OPTION_NODE_PRODUCT
      : defaultProductForExchange(nodeData.exchange as string | undefined))
  const basketOrders = nodeData.orders as string | BasketOrderItem[] | undefined
  const nodeTitle = NODE_TITLES[nodeType] || nodeInfo?.label || nodeType

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-semibold text-sm">{nodeTitle}</h2>
          <p className="text-xs text-muted-foreground">配置节点</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={handleDelete}
            aria-label="删除节点"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleClose}
            aria-label="关闭配置面板"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="space-y-4 p-4">
            {/* ===== SCHEDULE/START ===== */}
            {nodeType === 'start' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">定时类型</Label>
                  <Select
                    value={(nodeData.scheduleType as string) || 'daily'}
                    onValueChange={(v) => handleDataChange('scheduleType', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {nodeData.scheduleType !== 'interval' && (
                  <div className="space-y-2">
                    <Label className="text-xs">时间</Label>
                    <Input
                      type="time"
                      className="h-8"
                      value={(nodeData.time as string) || '09:15'}
                      onChange={(e) => handleDataChange('time', e.target.value)}
                    />
                  </div>
                )}
                {nodeData.scheduleType === 'interval' && (
                  <div className="space-y-2">
                    <Label className="text-xs">重复间隔</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        className="h-8 w-20"
                        value={(nodeData.intervalValue as number) || 1}
                        onChange={(e) =>
                          handleDataChange('intervalValue', parseInt(e.target.value, 10) || 1)
                        }
                      />
                      <Select
                        value={(nodeData.intervalUnit as string) || 'minutes'}
                        onValueChange={(v) => handleDataChange('intervalUnit', v)}
                      >
                        <SelectTrigger className="h-8 flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="seconds">秒</SelectItem>
                          <SelectItem value="minutes">分钟</SelectItem>
                          <SelectItem value="hours">小时</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {(nodeData.scheduleType === 'daily' || nodeData.scheduleType === 'weekly') && (
                  <div className="space-y-2">
                    <Label className="text-xs">运行日期</Label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <button
                        type="button"
                        onClick={() => handleDataChange('days', [0, 1, 2, 3, 4])}
                        className="rounded-md bg-muted px-2 py-1 text-[10px] hover:bg-accent"
                      >工作日</button>
                      <button
                        type="button"
                        onClick={() => handleDataChange('days', [5, 6])}
                        className="rounded-md bg-muted px-2 py-1 text-[10px] hover:bg-accent"
                      >周末</button>
                      <button
                        type="button"
                        onClick={() => handleDataChange('days', [0, 1, 2, 3, 4, 5, 6])}
                        className="rounded-md bg-muted px-2 py-1 text-[10px] hover:bg-accent"
                      >全部</button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {DAYS_OF_WEEK.map((day) => {
                        const days = (nodeData.days as number[]) || [0, 1, 2, 3, 4]
                        const sel = days.includes(day.value)
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() =>
                              handleDataChange(
                                'days',
                                sel
                                  ? days.filter((d) => d !== day.value)
                                  : [...days, day.value].sort()
                              )
                            }
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium',
                              sel
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-accent'
                            )}
                          >
                            {day.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {nodeData.scheduleType === 'once' && (
                  <div className="space-y-2">
                    <Label className="text-xs">日期</Label>
                    <Input
                      type="date"
                      className="h-8"
                      value={(nodeData.executeAt as string) || ''}
                      onChange={(e) => handleDataChange('executeAt', e.target.value)}
                    />
                  </div>
                )}

                <Separator />

                {/* The scheduler has read these three since market-hours
                    gating was added, but nothing rendered them, so the window
                    could only be set by hand-editing the workflow JSON. */}
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">仅在交易时段</Label>
                  <Switch
                    checked={nodeData.marketHoursOnly !== false}
                    onCheckedChange={(v) => handleDataChange('marketHoursOnly', v)}
                  />
                </div>

                {nodeData.marketHoursOnly !== false && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label className="text-xs">开始</Label>
                        <Input
                          type="time"
                          className="h-8"
                          value={(nodeData.marketHoursStart as string) || '09:15'}
                          onChange={(e) => handleDataChange('marketHoursStart', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">结束</Label>
                        <Input
                          type="time"
                          className="h-8"
                          value={(nodeData.marketHoursEnd as string) || '15:15'}
                          onChange={(e) => handleDataChange('marketHoursEnd', e.target.value)}
                        />
                      </div>
                    </div>
                    <ExchangeField
                      label="交易日历"
                      value={(nodeData.marketHoursExchange as string) || 'NSE'}
                      onChange={(v) => handleDataChange('marketHoursExchange', v)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      The window narrows the exchange's own session; it never reopens a holiday or a
                      weekend. Leave the calendar on the exchange you trade, so MCX and CRYPTO
                      inherit their real hours.
                    </p>
                  </>
                )}
              </>
            )}

            {/* ===== PRICE ALERT ===== */}
            {nodeType === 'priceAlert' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">条件</Label>
                  <Select
                    value={(nodeData.condition as string) || 'above'}
                    onValueChange={(v) => handleDataChange('condition', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALERT_CONDITIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">目标价格</Label>
                  <Input
                    type="number"
                    step="0.05"
                    className="h-8"
                    value={(nodeData.price as number) || ''}
                    onChange={(e) => handleDataChange('price', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">触发</Label>
                  <Select
                    value={(nodeData.trigger as string) || 'once'}
                    onValueChange={(v) => handleDataChange('trigger', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALERT_TRIGGERS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">有效期</Label>
                  <Select
                    value={(nodeData.expiration as string) || 'none'}
                    onValueChange={(v) => handleDataChange('expiration', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALERT_EXPIRATION.map((e) => (
                        <SelectItem key={e.value} value={e.value}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-xs">播放声音</Label>
                  </div>
                  <Switch
                    checked={(nodeData.playSound as boolean) ?? true}
                    onCheckedChange={(v) => handleDataChange('playSound', v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">提醒消息</Label>
                  <Input
                    className="h-8"
                    placeholder="Custom message"
                    value={(nodeData.message as string) || ''}
                    onChange={(e) => handleDataChange('message', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* ===== WEBHOOK TRIGGER ===== */}
            {nodeType === 'webhookTrigger' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">标签</Label>
                  <Input
                    className="h-8"
                    placeholder="TradingView Alert"
                    value={(nodeData.label as string) || ''}
                    onChange={(e) => handleDataChange('label', e.target.value)}
                  />
                </div>
                <Separator />
                {webhookQuery.isLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : webhookQuery.data ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs">Webhook 地址</Label>
                      <div className="flex gap-1">
                        <Input
                          readOnly
                          value={webhookQuery.data.webhook_url}
                          className="font-mono text-[10px] h-8"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            copyToClipboard(
                              nodeData.symbol
                                ? `${webhookQuery.data.webhook_url}/${nodeData.symbol}`
                                : webhookQuery.data.webhook_url,
                              'URL'
                            )
                          }
                          aria-label="复制 Webhook 地址"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Webhook 密钥</Label>
                      <div className="flex gap-1">
                        <div className="relative flex-1">
                          <Input
                            readOnly
                            type={showSecret ? 'text' : 'password'}
                            value={webhookQuery.data.webhook_secret}
                            className="font-mono text-[10px] h-8 pr-8"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-8 w-8"
                            onClick={() => setShowSecret(!showSecret)}
                            aria-label={showSecret ? 'Hide webhook secret' : 'Show webhook secret'}
                          >
                            {showSecret ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            copyToClipboard(webhookQuery.data.webhook_secret, 'Secret')
                          }
                          aria-label="复制 Webhook 密钥"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'rounded-lg border p-2 text-center text-xs',
                        webhookQuery.data.webhook_enabled
                          ? 'border-green-500/30 bg-green-500/10 text-green-600'
                          : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-600'
                      )}
                    >
                      {webhookQuery.data.webhook_enabled ? 'Webhook enabled' : 'Webhook disabled'}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border-yellow-500/30 bg-yellow-500/10 p-3 text-center text-xs text-yellow-600">请先保存工作流</div>
                )}
              </>
            )}

            {nodeType === 'orderUpdateTrigger' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">订单号（可选）</Label>
                  <Input
                    className="h-8"
                    placeholder="240221025997024"
                    value={(nodeData.orderId as string) || ''}
                    onChange={(e) => handleDataChange('orderId', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    A literal broker order id. {'{{variable}}'} references are not supported here -
                    a trigger has no upstream node to resolve them from. To react to an order this
                    workflow placed, filter by Symbol instead.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种（可选）</Label>
                  <Input
                    className="h-8"
                    placeholder="NIFTY28OCT2525950CE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">请至少设置订单编号或交易品种之一，否则监听会在账户中每笔订单发生时触发。</p>
                <div className="space-y-2">
                  <Label className="text-xs">交易所（可选）</Label>
                  <Select
                    value={(nodeData.exchange as string) || 'ANY'}
                    onValueChange={(v) => handleDataChange('exchange', v === 'ANY' ? '' : v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANY">任意交易所</SelectItem>
                      {EXCHANGES.map((e) => (
                        <SelectItem key={e.value} value={e.value}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">状态</Label>
                  <Select
                    value={(nodeData.status as string) || 'complete'}
                    onValueChange={(v) => handleDataChange('status', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">任何状态变化</SelectItem>
                      <SelectItem value="open">待成交</SelectItem>
                      <SelectItem value="trigger pending">等待触发</SelectItem>
                      <SelectItem value="complete">已全部成交</SelectItem>
                      <SelectItem value="rejected">已拒绝</SelectItem>
                      <SelectItem value="cancelled">已撤销</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">触发</Label>
                  <Select
                    value={(nodeData.trigger as string) || 'once'}
                    onValueChange={(v) => handleDataChange('trigger', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">仅触发一次，然后停止监控</SelectItem>
                      <SelectItem value="every_time">每次匹配的更新</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* ===== PLACE ORDER ===== */}
            {nodeType === 'placeOrder' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <ActionField
                  value={nodeData.action}
                  onChange={(v) => handleDataChange('action', v)}
                />
                <QuantityField
                  value={(nodeData.quantity as number) || 1}
                  onChange={(v) => handleDataChange('quantity', v)}
                />
                <ProductField
                  value={nodeProduct}
                  onChange={(v) => handleDataChange('product', v)}
                />
                <PriceTypeField
                  value={(nodeData.priceType as string) || 'MARKET'}
                  onChange={(v) => handleDataChange('priceType', v)}
                />
                <OrderPriceFields
                  priceType={orderPriceType}
                  price={nodeData.price ?? 0}
                  triggerPrice={nodeData.triggerPrice ?? 0}
                  onPriceChange={(value) => handleDataChange('price', value)}
                  onTriggerPriceChange={(value) => handleDataChange('triggerPrice', value)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="orderResult"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use {`{{orderResult.orderid}}`}
                  </p>
                </div>
              </>
            )}

            {/* ===== SMART ORDER ===== */}
            {nodeType === 'smartOrder' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <ActionField
                  value={nodeData.action}
                  onChange={(v) => handleDataChange('action', v)}
                />
                <QuantityField
                  value={(nodeData.quantity as number | undefined) ?? 1}
                  onChange={(v) => handleDataChange('quantity', v)}
                  min={0}
                />
                <div className="space-y-2">
                  <Label className="text-xs">持仓数量</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={(nodeData.positionSize as number) ?? 0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      handleDataChange('positionSize', Number.isNaN(val) ? 0 : val)
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Target position (positive=long, negative=short, 0=use quantity)
                  </p>
                </div>
                <ProductField
                  value={nodeProduct}
                  onChange={(v) => handleDataChange('product', v)}
                />
                <PriceTypeField
                  value={orderPriceType}
                  onChange={(v) => handleDataChange('priceType', v)}
                />
                <OrderPriceFields
                  priceType={orderPriceType}
                  price={nodeData.price ?? 0}
                  triggerPrice={nodeData.triggerPrice ?? 0}
                  onPriceChange={(value) => handleDataChange('price', value)}
                  onTriggerPriceChange={(value) => handleDataChange('triggerPrice', value)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="smartResult"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* ===== OPTIONS ORDER ===== */}
            {nodeType === 'optionsOrder' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">标的</Label>
                  <Select
                    value={(nodeData.underlying as string) || 'NIFTY'}
                    onValueChange={(v) => {
                      applyUnderlying(v)
                      // Deliberately does NOT write the lot size into quantity.
                      // This field is a lot COUNT and the executor multiplies it
                      // by the lot size, so storing the lot size here squared it
                      // (NIFTY: 65 lots x 65 = 4,225 units instead of 65).
                      // The lot count is the user's; only the resolved preview
                      // below reflects the instrument's lot size.
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INDEX_SYMBOLS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label} ({s.exchange})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ExpiryField
                  value={(nodeData.expiryType as string) || 'current_week'}
                  onChange={(v) => handleDataChange('expiryType', v)}
                  options={expiryTypesFor((nodeData.underlying as string) || 'NIFTY')}
                />
                <TemplatableField
                  label="行权价偏移"
                  value={(nodeData.offset as string) || 'ATM'}
                  onChange={(v) => handleDataChange('offset', v)}
                  fallback="ATM"
                  placeholder="{{webhook.offset}}"
                  hint="Must resolve to ATM, ITM1-ITM50 or OTM1-OTM50."
                >
                  <Select
                    value={(nodeData.offset as string) || 'ATM'}
                    onValueChange={(v) => handleDataChange('offset', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {strikeOffsetOptions(nodeData.offset).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TemplatableField>
                <TemplatableField
                  label="期权类型"
                  value={nodeData.optionType}
                  onChange={(v) => handleDataChange('optionType', v)}
                  fallback="CE"
                  placeholder="{{webhook.optionType}}"
                  hint="Must resolve to CE or PE."
                >
                  <div className="grid grid-cols-2 gap-2">
                    {OPTION_TYPES.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => handleDataChange('optionType', o.value)}
                        className={cn(
                          'rounded-lg border py-2 text-sm font-semibold',
                          nodeData.optionType === o.value
                            ? o.value === 'CE'
                              ? 'bg-green-500/20 border-green-500 text-green-600'
                              : 'bg-red-500/20 border-red-500 text-red-600'
                            : 'border-border bg-muted'
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </TemplatableField>
                <ActionField
                  value={nodeData.action}
                  onChange={(v) => handleDataChange('action', v)}
                />
                <QuantityField
                  label="数量（手）"
                  value={nodeData.quantity ?? 1}
                  onChange={(v) => handleDataChange('quantity', v)}
                />
                {(() => {
                  const lotSize = getLotSizeFromDb((nodeData.underlying as string) || 'NIFTY')
                  const lots = nodeData.quantity ?? 1
                  // A reference has no lot count to multiply out until it
                  // resolves at run time, so the arithmetic is withheld rather
                  // than printed against the token.
                  if (!lotSize || typeof lots !== 'number') return null
                  return (
                    <p className="-mt-1 text-[10px] text-muted-foreground">
                      {lots} lot{lots === 1 ? '' : 's'} x {lotSize} ={' '}
                      <span className="font-medium text-foreground">{lots * lotSize} units</span>
                    </p>
                  )
                })()}
                <ProductField
                  value={nodeProduct}
                  onChange={(v) => handleDataChange('product', v)}
                />
                <PriceTypeField
                  value={(nodeData.priceType as string) || 'MARKET'}
                  onChange={(v) => handleDataChange('priceType', v)}
                />
                <OrderPriceFields
                  priceType={orderPriceType}
                  price={nodeData.price ?? 0}
                  triggerPrice={nodeData.triggerPrice ?? 0}
                  onPriceChange={(value) => handleDataChange('price', value)}
                  onTriggerPriceChange={(value) => handleDataChange('triggerPrice', value)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="optionOrder"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* ===== OPTIONS MULTI ORDER ===== */}
            {nodeType === 'optionsMultiOrder' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">策略</Label>
                  <Select
                    value={(nodeData.strategy as string) || 'straddle'}
                    onValueChange={(strategy) => {
                      if (!selectedNodeId) return
                      updateNodeData(
                        selectedNodeId,
                        getOptionsMultiStrategyUpdate(
                          {
                            strategy: (nodeData.strategy as string) || 'straddle',
                            priceType: orderPriceType,
                          },
                          strategy
                        )
                      )
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPTION_STRATEGIES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">标的</Label>
                  <Select
                    value={(nodeData.underlying as string) || 'NIFTY'}
                    onValueChange={(v) => applyUnderlying(v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INDEX_SYMBOLS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label} ({s.exchange})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ExpiryField
                  value={(nodeData.expiryType as string) || 'current_week'}
                  onChange={(v) => handleDataChange('expiryType', v)}
                  options={expiryTypesFor((nodeData.underlying as string) || 'NIFTY')}
                />
                <div className="space-y-2">
                  <Label className="text-xs">买卖方向</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ORDER_ACTIONS.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => handleDataChange('action', a.value)}
                        className={cn(
                          'rounded-lg border py-2 text-sm font-semibold',
                          nodeData.action === a.value
                            ? a.value === 'BUY'
                              ? 'bg-green-500/20 border-green-500 text-green-600'
                              : 'bg-red-500/20 border-red-500 text-red-600'
                            : 'border-border bg-muted'
                        )}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {nodeData.action === 'BUY' ? 'Long strategy' : 'Short strategy'}
                  </p>
                </div>
                <QuantityField
                  label="数量（手）"
                  value={nodeData.quantity ?? 1}
                  onChange={(v) => handleDataChange('quantity', v)}
                />
                <ProductField
                  value={nodeProduct}
                  onChange={(v) => handleDataChange('product', v)}
                />
                <PriceTypeField
                  value={orderPriceType}
                  onChange={(v) => handleDataChange('priceType', v)}
                />
                <OrderPriceFields
                  priceType={orderPriceType}
                  price={nodeData.price ?? 0}
                  triggerPrice={nodeData.triggerPrice ?? 0}
                  onPriceChange={(value) => handleDataChange('price', value)}
                  onTriggerPriceChange={(value) => handleDataChange('triggerPrice', value)}
                />
                {nodeData.strategy === 'custom' && (
                  <p className="text-[10px] text-muted-foreground">
                    Custom legs inherit these common product and price fields when omitted. A
                    leg&apos;s explicit product, price type, price, or trigger price overrides the
                    common value.
                  </p>
                )}
                {orderPriceType === 'LIMIT' && nodeData.strategy !== 'custom' && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">应用于生成的每条策略腿。限价单未填写大于零的价格时会被拒绝，不会转为市价单。</p>
                  </div>
                )}
                {/* Strategy Legs Preview */}
                <div className="rounded-lg border bg-muted/30 p-2">
                  <p className="text-[10px] font-medium mb-1.5">策略腿：</p>
                  <div className="space-y-0.5 text-[10px] font-mono">
                    {nodeData.strategy === 'straddle' && (
                      <>
                        <div className="flex justify-between">
                          <span>ATM CE</span>
                          <span
                            className={
                              nodeData.action === 'BUY' ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            {(nodeData.action as string) || 'SELL'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>ATM PE</span>
                          <span
                            className={
                              nodeData.action === 'BUY' ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            {(nodeData.action as string) || 'SELL'}
                          </span>
                        </div>
                      </>
                    )}
                    {nodeData.strategy === 'strangle' && (
                      <>
                        <div className="flex justify-between">
                          <span>OTM2 CE</span>
                          <span
                            className={
                              nodeData.action === 'BUY' ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            {(nodeData.action as string) || 'SELL'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>OTM2 PE</span>
                          <span
                            className={
                              nodeData.action === 'BUY' ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            {(nodeData.action as string) || 'SELL'}
                          </span>
                        </div>
                      </>
                    )}
                    {nodeData.strategy === 'iron_condor' && (
                      <>
                        <div className="flex justify-between">
                          <span>OTM2 CE</span>
                          <span className="text-red-600">卖出</span>
                        </div>
                        <div className="flex justify-between">
                          <span>OTM4 CE</span>
                          <span className="text-green-600">买入</span>
                        </div>
                        <div className="flex justify-between">
                          <span>OTM2 PE</span>
                          <span className="text-red-600">卖出</span>
                        </div>
                        <div className="flex justify-between">
                          <span>OTM4 PE</span>
                          <span className="text-green-600">买入</span>
                        </div>
                      </>
                    )}
                    {nodeData.strategy === 'bull_call_spread' && (
                      <>
                        <div className="flex justify-between">
                          <span>ATM CE</span>
                          <span className="text-green-600">买入</span>
                        </div>
                        <div className="flex justify-between">
                          <span>OTM2 CE</span>
                          <span className="text-red-600">卖出</span>
                        </div>
                      </>
                    )}
                    {nodeData.strategy === 'bear_put_spread' && (
                      <>
                        <div className="flex justify-between">
                          <span>ATM PE</span>
                          <span className="text-green-600">买入</span>
                        </div>
                        <div className="flex justify-between">
                          <span>OTM2 PE</span>
                          <span className="text-red-600">卖出</span>
                        </div>
                      </>
                    )}
                    {nodeData.strategy === 'custom' && (
                      <p className="text-muted-foreground">在下方逐腿配置。</p>
                    )}
                  </div>
                </div>
                {nodeData.strategy === 'custom' && (
                  <CustomLegsFields
                    value={nodeData.legs}
                    onChange={(legs) => handleDataChange('legs', legs)}
                    commonPriceType={orderPriceType}
                    commonProduct={nodeProduct}
                    commonExpiryType={(nodeData.expiryType as string) || 'current_week'}
                    commonAction={(nodeData.action as string) || 'SELL'}
                    commonQuantity={(nodeData.quantity as number) || 1}
                    strangleWidth={(nodeData.strangleWidth as string) || 'OTM2'}
                    underlying={(nodeData.underlying as string) || 'NIFTY'}
                  />
                )}
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="multiLegOrder"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* ===== BASKET ORDER ===== */}
            {nodeType === 'basketOrder' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">篮子名称</Label>
                  <Input
                    className="h-8"
                    placeholder="Morning Portfolio"
                    value={(nodeData.basketName as string) || ''}
                    onChange={(e) => handleDataChange('basketName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">订单（品种代码、交易所、买卖方向、数量）</Label>
                  <Textarea
                    className="min-h-[100px] text-xs font-mono"
                    placeholder="RELIANCE,NSE,BUY,10&#10;INFY,NSE,BUY,5&#10;SBIN,NSE,SELL,20"
                    value={basketOrdersText(basketOrders)}
                    readOnly={Array.isArray(basketOrders)}
                    onChange={(e) => handleDataChange('orders', e.target.value)}
                  />
                  {Array.isArray(basketOrders) && (
                    <div className="space-y-2 rounded-md border p-2">
                      <p className="text-[10px] text-muted-foreground">导入的逐笔订单列表以只读方式保留，包括产品类型和价格覆盖值。转换为 CSV 后仅保留交易品种、交易所、买卖方向和数量，以便在此编辑。</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleDataChange('orders', basketOrdersToCsv(basketOrders))}
                      >将导入的订单转换为 CSV</Button>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">支持的交易所：NSE、BSE、NFO、BFO、CDS、BCD、MCX、NCO</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">交易产品</Label>
                  {/* One basket can mix segments, so the default is decided per
                      row rather than blanket: an NFO row goes NRML while an NSE
                      row goes MIS. Choosing a product here overrides all of
                      them. */}
                  <Select
                    value={(nodeData.product as string) || BASKET_PRODUCT_AUTO}
                    onValueChange={(v) =>
                      handleDataChange('product', v === BASKET_PRODUCT_AUTO ? undefined : v)
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={BASKET_PRODUCT_AUTO}>按各行交易所</SelectItem>
                      {PRODUCT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <PriceTypeField
                  value={(nodeData.priceType as string) || 'MARKET'}
                  onChange={(v) => handleDataChange('priceType', v)}
                />
                <OrderPriceFields
                  priceType={orderPriceType}
                  price={nodeData.price ?? 0}
                  triggerPrice={nodeData.triggerPrice ?? 0}
                  onPriceChange={(value) => handleDataChange('price', value)}
                  onTriggerPriceChange={(value) => handleDataChange('triggerPrice', value)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="basketResult"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use {`{{basketResult.results}}`} in other nodes
                  </p>
                </div>
              </>
            )}

            {/* ===== SPLIT ORDER ===== */}
            {nodeType === 'splitOrder' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <ActionField
                  value={nodeData.action}
                  onChange={(v) => handleDataChange('action', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">总数量</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-8"
                    value={(nodeData.quantity as number) || 100}
                    onChange={(e) =>
                      handleDataChange('quantity', parseInt(e.target.value, 10) || 100)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">每笔拆单数量</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-8"
                    value={(nodeData.splitSize as number) || 50}
                    onChange={(e) =>
                      handleDataChange('splitSize', parseInt(e.target.value, 10) || 50)
                    }
                  />
                </div>
                <ProductField
                  value={nodeProduct}
                  onChange={(v) => handleDataChange('product', v)}
                />
                <PriceTypeField
                  value={orderPriceType}
                  onChange={(v) => handleDataChange('priceType', v)}
                />
                <OrderPriceFields
                  priceType={orderPriceType}
                  price={nodeData.price ?? 0}
                  triggerPrice={nodeData.triggerPrice ?? 0}
                  onPriceChange={(value) => handleDataChange('price', value)}
                  onTriggerPriceChange={(value) => handleDataChange('triggerPrice', value)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="splitResult"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use {`{{splitResult.results}}`} in other nodes
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Splits into{' '}
                  {Math.ceil(
                    ((nodeData.quantity as number) || 100) / ((nodeData.splitSize as number) || 50)
                  )}{' '}
                  orders
                </p>
              </>
            )}

            {/* ===== CANCEL ORDER ===== */}
            {nodeType === 'cancelOrder' && (
              <div className="space-y-2">
                <Label className="text-xs">订单号</Label>
                <Input
                  className="h-8"
                  placeholder="{{orderResult.orderid}}"
                  value={(nodeData.orderId as string) || ''}
                  onChange={(e) => handleDataChange('orderId', e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">使用下单节点的变量</p>
              </div>
            )}

            {/* ===== CANCEL ALL / CLOSE POSITIONS ===== */}
            {nodeType === 'cancelAllOrders' && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">撤销所有未完成订单，无需配置。</p>
              </div>
            )}
            {nodeType === 'closePositions' && (
              <>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Leave Symbol blank to square off every open position. Set it to close only that
                    position; Exchange and Product narrow it further.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="留空表示平掉全部持仓"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                {Boolean(nodeData.symbol) && (
                  <>
                    <ExchangeField
                      value={(nodeData.exchange as string) || 'NSE'}
                      onChange={(v) => handleDataChange('exchange', v)}
                    />
                    <ProductField
                      value={nodeProduct}
                      onChange={(v) => handleDataChange('product', v)}
                    />
                  </>
                )}
              </>
            )}

            {/* ===== MODIFY ORDER ===== */}
            {nodeType === 'modifyOrder' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">订单号</Label>
                  <Input
                    className="h-8"
                    placeholder="{{orderResult.orderid}}"
                    value={(nodeData.orderId as string) || ''}
                    onChange={(e) => handleDataChange('orderId', e.target.value)}
                  />
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">交易品种、交易所、买卖方向和产品类型从实时订单中读取，此处留空的字段保持不变。</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">新价格</Label>
                  <Input
                    type="number"
                    step="0.05"
                    className="h-8"
                    placeholder="留空表示保持不变"
                    value={(nodeData.newPrice as number) ?? ''}
                    onChange={(e) => handleDataChange('newPrice', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">新数量</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-8"
                    placeholder="留空表示保持不变"
                    value={(nodeData.newQuantity as number) ?? ''}
                    onChange={(e) => handleDataChange('newQuantity', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* ===== DATA NODES ===== */}
            {nodeType === 'getQuote' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="quote"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Use {`{{quote.data.ltp}}`}</p>
                </div>
              </>
            )}

            {nodeType === 'getDepth' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="SBIN"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="depth"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use {`{{depth.data.bids[0].price}}`}
                  </p>
                </div>
              </>
            )}

            {/* ===== GET ORDER STATUS ===== */}
            {nodeType === 'getOrderStatus' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">订单号</Label>
                  <Input
                    className="h-8"
                    placeholder="{{orderResult.orderid}}"
                    value={(nodeData.orderId as string) || ''}
                    onChange={(e) => handleDataChange('orderId', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">使用下单节点的变量</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="orderStatus"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use {`{{orderStatus.data.order_status}}`}
                  </p>
                </div>
              </>
            )}

            {nodeType === 'openPosition' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <ProductField
                  value={nodeProduct}
                  onChange={(v) => handleDataChange('product', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="position"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Use {`{{position.quantity}}`}</p>
                </div>
              </>
            )}

            {nodeType === 'history' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="SBIN"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">时间周期</Label>
                  <Select
                    value={(nodeData.interval as string) || '1d'}
                    onValueChange={(v) => handleDataChange('interval', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1m">1 分钟</SelectItem>
                      <SelectItem value="5m">5 分钟</SelectItem>
                      <SelectItem value="15m">15 分钟</SelectItem>
                      <SelectItem value="1h">1 小时</SelectItem>
                      <SelectItem value="1d">每日</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">天</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    className="h-8"
                    value={(nodeData.days as number) || 30}
                    onChange={(e) => handleDataChange('days', parseInt(e.target.value, 10) || 30)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="ohlcv"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                </div>
              </>
            )}

            {nodeType === 'indicator' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">指标</Label>
                  <Select
                    value={(nodeData.indicatorName as string) || 'rsi'}
                    onValueChange={(v) => {
                      handleDataChange('indicatorName', v)
                      // Params are kwargs for the previously selected function.
                      // Carrying them over sends the new indicator a keyword it
                      // does not accept - ta.macd(period=14) is a TypeError -
                      // so keep only the names the new one actually takes.
                      handleDataChange(
                        'params',
                        pruneIndicatorParams(v, (nodeData.params as string) || '')
                      )
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {INDICATOR_CATALOG.map((ind) => (
                        <SelectItem key={ind.value} value={ind.value}>
                          {flowIndicatorName(ind.value)} · {flowIndicatorCategory(ind.category)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">基于另一指标计算（可选）</Label>
                  <Input
                    className="h-8"
                    placeholder="{{rsi1.series}}"
                    value={(nodeData.sourceSeries as string) || ''}
                    onChange={(e) => handleDataChange('sourceSeries', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Set to compute this indicator over another Indicator node's output (e.g. SMA of
                    RSI) instead of fetching fresh history. Accepts a raw History array too -{' '}
                    {'{{h.data}}'} uses each row's close. Only single-series indicators (SMA, EMA,
                    RSI, WMA, stdev, highest/lowest, ...) can be nested.
                  </p>
                </div>
                {nodeData.sourceSeries ? (
                  <div className="space-y-2">
                    <Label className="text-xs">来源字段（可选）</Label>
                    <Input
                      className="h-8"
                      placeholder="留空自动选择（value、out0、close）"
                      value={(nodeData.sourceField as string) || ''}
                      onChange={(e) => handleDataChange('sourceField', e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">从每行读取哪个字段，例如 high、low、out1。</p>
                  </div>
                ) : null}
                {!nodeData.sourceSeries && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs">交易品种</Label>
                      <Input
                        className="h-8"
                        placeholder="RELIANCE"
                        value={(nodeData.symbol as string) || ''}
                        onChange={(e) => handleDataChange('symbol', e.target.value)}
                      />
                    </div>
                    <ExchangeField
                      value={(nodeData.exchange as string) || 'NSE'}
                      onChange={(v) => handleDataChange('exchange', v)}
                    />
                    <div className="space-y-2">
                      <Label className="text-xs">时间周期</Label>
                      <Input
                        className="h-8"
                        placeholder="D、5m、1h 或自定义历史数据周期"
                        value={(nodeData.interval as string) || 'D'}
                        onChange={(e) => handleDataChange('interval', e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Any interval your connected broker supports (check the Intervals node) - not
                        a fixed list.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">数据来源</Label>
                      <Select
                        value={(nodeData.source as string) || 'api'}
                        onValueChange={(v) => handleDataChange('source', v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="api">券商 API</SelectItem>
                          <SelectItem value="db">
                            Historify DB (custom intervals: 2m, 4m, W, M, Q)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">回看 K 线数</Label>
                      <Input
                        type="number"
                        min={5}
                        className="h-8"
                        value={(nodeData.lookbackBars as number) || 100}
                        onChange={(e) =>
                          handleDataChange('lookbackBars', parseInt(e.target.value, 10) || 100)
                        }
                      />
                    </div>
                  </>
                )}
                <IndicatorParamsFields
                  // Remount on either change so the number fields' in-progress
                  // text does not leak across nodes or indicators.
                  key={`${selectedNode.id}-${(nodeData.indicatorName as string) || 'rsi'}`}
                  indicatorName={(nodeData.indicatorName as string) || 'rsi'}
                  value={(nodeData.params as string) || ''}
                  onChange={(raw) => handleDataChange('params', raw)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">前 N 根 K 线的值</Label>
                  <Input
                    type="number"
                    min={0}
                    max={200}
                    className="h-8"
                    value={(nodeData.offsetBars as number) ?? 0}
                    onChange={(e) =>
                      handleDataChange('offsetBars', parseInt(e.target.value, 10) || 0)
                    }
                  />
                  <p className="text-[10px] text-muted-foreground">
                    0 = latest closed bar. Read it via {'{{name.at_offset.value}}'} (or{' '}
                    {'{{name.at_offset.out0}}'} for multi-output indicators). Prefer this over
                    indexing {'{{name.series[N]}}'}, whose offsets shift with Tail Bars.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">末尾 K 线数量</Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    className="h-8"
                    value={(nodeData.tailBars as number) || 5}
                    onChange={(e) =>
                      handleDataChange('tailBars', parseInt(e.target.value, 10) || 5)
                    }
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Length of {'{{ind.series}}'} - a fixed-length recent-history array so{' '}
                    {'{{ind.series[N]}}'} can address a specific historical bar.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="rsi1"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Access with {'{{name.latest.value}}'}, {'{{name.previous.value}}'}, or{' '}
                    {'{{name.series[N]}}'}. Multi-output indicators (MACD, BBands, ADX, ...) expose
                    out0, out1, ...
                  </p>
                </div>
              </>
            )}

            {nodeType === 'strategyPnl' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">策略</Label>
                  <Input
                    className="h-8"
                    placeholder="留空使用当前工作流名称"
                    value={(nodeData.strategy as string) || ''}
                    onChange={(e) => handleDataChange('strategy', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Order nodes tag their orders with the workflow name, so leaving this blank
                    reports this workflow's own P&amp;L.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="spnl"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Exposes {'{{spnl.realized}}'}, {'{{spnl.unrealized}}'}, {'{{spnl.total}}'},{' '}
                    {'{{spnl.today_realized}}'}, {'{{spnl.open_quantity}}'}.
                  </p>
                </div>
              </>
            )}

            {nodeType === 'priorPeriodOhlc' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="NIFTY"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">周期</Label>
                  <Select
                    value={(nodeData.period as string) || 'previous_day'}
                    onValueChange={(v) => handleDataChange('period', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="previous_hour">前一小时</SelectItem>
                      <SelectItem value="previous_day">前一日</SelectItem>
                      <SelectItem value="previous_week">前一周</SelectItem>
                      <SelectItem value="previous_month">前一月</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">数据来源</Label>
                  <Select
                    value={(nodeData.source as string) || 'api'}
                    onValueChange={(v) => handleDataChange('source', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api">券商 API</SelectItem>
                      <SelectItem value="db">Historify 数据库</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="pdhpdl"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Exposes {'{{name.pdh}}'}, {'{{name.pdl}}'}, {'{{name.pdc}}'} (also
                    {' {{name.high}}'}/{'low'}/{'close'}/{'open'}).
                  </p>
                </div>
              </>
            )}

            {nodeType === 'barOffset' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">时间周期</Label>
                  <Input
                    className="h-8"
                    placeholder="D、5m、1h 或自定义历史数据周期"
                    value={(nodeData.interval as string) || 'D'}
                    onChange={(e) => handleDataChange('interval', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">数据来源</Label>
                  <Select
                    value={(nodeData.source as string) || 'api'}
                    onValueChange={(v) => handleDataChange('source', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api">券商 API</SelectItem>
                      <SelectItem value="db">Historify 数据库</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">向前 K 线数</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-8"
                    value={(nodeData.offsetBars as number) ?? 0}
                    onChange={(e) =>
                      handleDataChange('offsetBars', parseInt(e.target.value, 10) || 0)
                    }
                  />
                  <p className="text-[10px] text-muted-foreground">
                    0 = last CLOSED bar, 1 = one bar before that, ...
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="bar1"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                </div>
              </>
            )}

            {nodeType === 'expiry' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="NIFTY"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NFO'}
                  onChange={(v) => handleDataChange('exchange', v)}
                  fallback="NFO"
                />
                <div className="space-y-2">
                  <Label className="text-xs">交易品种类型</Label>
                  <Select
                    value={(nodeData.instrumenttype as string) || 'options'}
                    onValueChange={(v) => handleDataChange('instrumenttype', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="options">期权</SelectItem>
                      <SelectItem value="futures">期货</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">期货和期权的到期日历不同</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="expiries"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Use {`{{expiries.data[0]}}`}</p>
                </div>
              </>
            )}

            {nodeType === 'multiQuotes' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种（逗号分隔）</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE,INFY,TCS"
                    value={(nodeData.symbols as string) || ''}
                    onChange={(e) => handleDataChange('symbols', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="quotes"
                    value={(nodeData.outputVariable as string) || 'quotes'}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use {`{{quotes.results[0].data.ltp}}`}
                  </p>
                </div>
              </>
            )}

            {nodeType === 'symbol' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="NIFTY30DEC25FUT"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NFO'}
                  onChange={(v) => handleDataChange('exchange', v)}
                  fallback="NFO"
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="symbolInfo"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use {`{{symbolInfo.data.lotsize}}`}
                  </p>
                </div>
              </>
            )}

            {nodeType === 'optionSymbol' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">标的</Label>
                  <Input
                    className="h-8"
                    placeholder="NIFTY"
                    value={(nodeData.underlying as string) || ''}
                    onChange={(e) => handleDataChange('underlying', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE_INDEX'}
                  onChange={(v) => handleDataChange('exchange', v)}
                  fallback="NSE_INDEX"
                />
                <div className="space-y-2">
                  <Label className="text-xs">到期日</Label>
                  <Input
                    className="h-8"
                    placeholder="30DEC25"
                    value={(nodeData.expiryDate as string) || ''}
                    onChange={(e) => handleDataChange('expiryDate', e.target.value)}
                  />
                </div>
                <TemplatableField
                  label="行权价偏移"
                  value={(nodeData.offset as string) || 'ATM'}
                  onChange={(v) => handleDataChange('offset', v)}
                  fallback="ATM"
                  placeholder="{{webhook.offset}}"
                  hint="Must resolve to ATM, ITM1-ITM50 or OTM1-OTM50."
                >
                  <Select
                    value={(nodeData.offset as string) || 'ATM'}
                    onValueChange={(v) => handleDataChange('offset', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {strikeOffsetOptions(nodeData.offset).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TemplatableField>
                <div className="space-y-2">
                  <Label className="text-xs">期权类型</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['CE', 'PE'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleDataChange('optionType', t)}
                        className={cn(
                          'rounded-lg border py-2 text-sm font-semibold',
                          nodeData.optionType === t
                            ? t === 'CE'
                              ? 'bg-green-500/20 border-green-500 text-green-600'
                              : 'bg-red-500/20 border-red-500 text-red-600'
                            : 'border-border bg-muted'
                        )}
                      >
                        {t === 'CE' ? 'Call' : 'Put'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="optionSym"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                </div>
              </>
            )}

            {nodeType === 'calendar' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">日期</Label>
                  <Input
                    type="date"
                    className="h-8"
                    value={(nodeData.date as string) || ''}
                    onChange={(e) => handleDataChange('date', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">留空时使用当前交易日日期。</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="cal"
                    value={(nodeData.outputVariable as string) || 'cal'}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {`{{cal.is_new_week}}`}, {`{{cal.is_new_month}}`}, {`{{cal.is_new_quarter}}`},{' '}
                    {`{{cal.is_trading_day}}`}
                  </p>
                </div>
              </>
            )}
            {nodeType === 'intervals' && (
              <div className="space-y-2">
                <Label className="text-xs">输出变量</Label>
                <Input
                  className="h-8"
                  placeholder="intervals"
                  value={(nodeData.outputVariable as string) || 'intervals'}
                  onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Timeframes this broker supports. Use {`{{intervals.data.minutes}}`}
                </p>
              </div>
            )}
            {nodeType === 'orderBook' && (
              <div className="space-y-2">
                <Label className="text-xs">输出变量</Label>
                <Input
                  className="h-8"
                  placeholder="orders"
                  value={(nodeData.outputVariable as string) || 'orders'}
                  onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Use {`{{orders.data.orders}}`}</p>
              </div>
            )}
            {nodeType === 'tradeBook' && (
              <div className="space-y-2">
                <Label className="text-xs">输出变量</Label>
                <Input
                  className="h-8"
                  placeholder="trades"
                  value={(nodeData.outputVariable as string) || 'trades'}
                  onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Use {`{{trades.data}}`}</p>
              </div>
            )}
            {nodeType === 'positionBook' && (
              <div className="space-y-2">
                <Label className="text-xs">输出变量</Label>
                <Input
                  className="h-8"
                  placeholder="positions"
                  value={(nodeData.outputVariable as string) || 'positions'}
                  onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Use {`{{positions.data}}`}</p>
              </div>
            )}

            {nodeType === 'syntheticFuture' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">标的</Label>
                  <Input
                    className="h-8"
                    placeholder="NIFTY"
                    value={(nodeData.underlying as string) || ''}
                    onChange={(e) => handleDataChange('underlying', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE_INDEX'}
                  onChange={(v) => handleDataChange('exchange', v)}
                  fallback="NSE_INDEX"
                />
                <div className="space-y-2">
                  <Label className="text-xs">到期日</Label>
                  <Input
                    className="h-8"
                    placeholder="25NOV25"
                    value={(nodeData.expiryDate as string) || ''}
                    onChange={(e) => handleDataChange('expiryDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="synthFuture"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use {`{{synthFuture.synthetic_future_price}}`}
                  </p>
                </div>
              </>
            )}

            {nodeType === 'optionChain' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">标的</Label>
                  <Input
                    className="h-8"
                    placeholder="NIFTY"
                    value={(nodeData.underlying as string) || ''}
                    onChange={(e) => handleDataChange('underlying', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE_INDEX'}
                  onChange={(v) => handleDataChange('exchange', v)}
                  fallback="NSE_INDEX"
                />
                <div className="space-y-2">
                  <Label className="text-xs">到期日</Label>
                  <Input
                    className="h-8"
                    placeholder="30DEC25"
                    value={(nodeData.expiryDate as string) || ''}
                    onChange={(e) => handleDataChange('expiryDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">行权价数量</Label>
                  <Input
                    type="number"
                    className="h-8"
                    placeholder="10 (empty=full)"
                    value={(nodeData.strikeCount as number) || ''}
                    onChange={(e) =>
                      handleDataChange('strikeCount', parseInt(e.target.value, 10) || undefined)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="chain"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Use {`{{chain.atm_strike}}`}</p>
                </div>
              </>
            )}

            {nodeType === 'holidays' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">年份</Label>
                  <Input
                    type="number"
                    className="h-8"
                    placeholder={String(new Date().getFullYear())}
                    value={(nodeData.year as number) || ''}
                    onChange={(e) =>
                      handleDataChange('year', parseInt(e.target.value, 10) || undefined)
                    }
                  />
                  <p className="text-[10px] text-muted-foreground">Empty = current year</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="holidays"
                    value={(nodeData.outputVariable as string) || 'holidays'}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                </div>
              </>
            )}

            {nodeType === 'timings' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">日期</Label>
                  <Input
                    type="date"
                    className="h-8"
                    value={(nodeData.date as string) || ''}
                    onChange={(e) => handleDataChange('date', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Empty = today</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="timings"
                    value={(nodeData.outputVariable as string) || 'timings'}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                </div>
              </>
            )}

            {nodeType === 'holdings' && (
              <div className="space-y-2">
                <Label className="text-xs">输出变量</Label>
                <Input
                  className="h-8"
                  placeholder="holdings"
                  value={(nodeData.outputVariable as string) || 'holdings'}
                  onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Use {`{{holdings.data[0].symbol}}`}
                </p>
              </div>
            )}
            {nodeType === 'funds' && (
              <div className="space-y-2">
                <Label className="text-xs">输出变量</Label>
                <Input
                  className="h-8"
                  placeholder="funds"
                  value={(nodeData.outputVariable as string) || 'funds'}
                  onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Use {`{{funds.data.availablecash}}`}
                </p>
              </div>
            )}

            {nodeType === 'margin' && (
              <>
                <MarginPositionsFields
                  value={(nodeData.positionsJson as string) || ''}
                  onChange={(raw) => handleDataChange('positionsJson', raw)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="marginResult"
                    value={(nodeData.outputVariable as string) || 'marginResult'}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                </div>
              </>
            )}

            {/* ===== STREAMING NODES ===== */}
            {nodeType === 'subscribeLtp' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="ltp"
                    value={(nodeData.outputVariable as string) || 'ltp'}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Real-time: {`{{ltp}}`}</p>
                </div>
              </>
            )}

            {nodeType === 'subscribeQuote' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="quote"
                    value={(nodeData.outputVariable as string) || 'quote'}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use {`{{quote.ltp}}`}, {`{{quote.open}}`}
                  </p>
                </div>
              </>
            )}

            {nodeType === 'subscribeDepth' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="depth"
                    value={(nodeData.outputVariable as string) || 'depth'}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use {`{{depth.bids[0].price}}`}
                  </p>
                </div>
              </>
            )}

            {nodeType === 'unsubscribe' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">行情流类型</Label>
                  <Select
                    value={(nodeData.streamType as string) || 'all'}
                    onValueChange={(v) => handleDataChange('streamType', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ltp">仅最新价</SelectItem>
                      <SelectItem value="quote">仅行情</SelectItem>
                      <SelectItem value="depth">仅盘口</SelectItem>
                      <SelectItem value="all">全部行情流</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="留空表示所有交易品种"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
              </>
            )}

            {/* ===== UTILITY NODES ===== */}
            {nodeType === 'delay' && (
              <div className="space-y-2">
                <Label className="text-xs">等待时长</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    className="h-8 flex-1"
                    value={(nodeData.delayValue as number) || 1}
                    onChange={(e) =>
                      handleDataChange('delayValue', parseInt(e.target.value, 10) || 1)
                    }
                  />
                  <Select
                    value={(nodeData.delayUnit as string) || 'seconds'}
                    onValueChange={(v) => handleDataChange('delayUnit', v)}
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seconds">秒</SelectItem>
                      <SelectItem value="minutes">分钟</SelectItem>
                      <SelectItem value="hours">小时</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {nodeType === 'waitUntil' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">目标时间</Label>
                  <Input
                    type="time"
                    className="h-8"
                    value={(nodeData.targetTime as string) || '09:30'}
                    onChange={(e) => handleDataChange('targetTime', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">工作流暂停至此时间</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">标签</Label>
                  <Input
                    className="h-8"
                    placeholder="Wait for Entry"
                    value={(nodeData.label as string) || ''}
                    onChange={(e) => handleDataChange('label', e.target.value)}
                  />
                </div>
              </>
            )}

            {nodeType === 'log' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">日志级别</Label>
                  <Select
                    value={(nodeData.level as string) || 'info'}
                    onValueChange={(v) => handleDataChange('level', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOG_LEVELS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          <span className={l.color}>{l.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">消息</Label>
                  <Textarea
                    className="min-h-[80px]"
                    placeholder="Log message with {{variables}}"
                    value={(nodeData.message as string) || ''}
                    onChange={(e) => handleDataChange('message', e.target.value)}
                  />
                </div>
              </>
            )}

            {nodeType === 'telegramAlert' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">消息</Label>
                  <Textarea
                    className="min-h-[80px]"
                    placeholder="Order placed for {{orderResult.symbol}}"
                    value={(nodeData.message as string) || ''}
                    onChange={(e) => handleDataChange('message', e.target.value)}
                  />
                </div>
                <div className="rounded-lg border bg-muted/30 p-2">
                  <p className="text-[10px] text-muted-foreground">
                    Telegram delivery uses the account linked to the workflow owner's API key.
                  </p>
                </div>
              </>
            )}

            {nodeType === 'whatsappAlert' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">结束日期（可选）</Label>
                  <Input
                    className="h-8"
                    placeholder="919876543210 - blank sends to yourself"
                    value={(nodeData.to as string) || ''}
                    onChange={(e) => handleDataChange('to', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">消息</Label>
                  <Textarea
                    className="min-h-[80px]"
                    placeholder="Order placed for {{orderResult.symbol}}"
                    value={(nodeData.message as string) || ''}
                    onChange={(e) => handleDataChange('message', e.target.value)}
                  />
                </div>
                <div className="rounded-lg border bg-muted/30 p-2">
                  <p className="text-[10px] font-medium mb-1">变量：</p>
                  <p className="text-[9px] font-mono text-muted-foreground">
                    {`{{orderResult.orderid}}`}, {`{{quote.ltp}}`}, {`{{timestamp}}`}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground">需要先在 /whatsapp 页面配对 WhatsApp 机器人。</p>
              </>
            )}

            {nodeType === 'variable' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">变量名称</Label>
                  <Input
                    className="h-8"
                    placeholder="myLTP"
                    value={(nodeData.variableName as string) || ''}
                    onChange={(e) => handleDataChange('variableName', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use: {`{{${(nodeData.variableName as string) || 'varName'}}}`}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">操作</Label>
                  <Select
                    value={(nodeData.operation as string) || 'set'}
                    onValueChange={(v) => handleDataChange('operation', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VARIABLE_OPERATIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {['set', 'add', 'subtract', 'multiply', 'divide', 'append', 'parse_json'].includes(
                  nodeData.operation as string
                ) && (
                  <div className="space-y-2">
                    <Label className="text-xs">
                      {nodeData.operation === 'parse_json' ? 'JSON String' : 'Value'}
                    </Label>
                    {nodeData.operation === 'parse_json' ? (
                      <Textarea
                        className="min-h-[80px] font-mono"
                        placeholder='{"key": "value"}'
                        value={String(nodeData.value || '')}
                        onChange={(e) => handleDataChange('value', e.target.value)}
                      />
                    ) : (
                      <Input
                        className="h-8"
                        placeholder="Value or {{variable}}"
                        value={String(nodeData.value || '')}
                        onChange={(e) => handleDataChange('value', e.target.value)}
                      />
                    )}
                  </div>
                )}
                {['get', 'stringify'].includes(nodeData.operation as string) && (
                  <div className="space-y-2">
                    <Label className="text-xs">来源变量</Label>
                    <Input
                      className="h-8"
                      placeholder="quoteData"
                      value={(nodeData.sourceVariable as string) || ''}
                      onChange={(e) => handleDataChange('sourceVariable', e.target.value)}
                    />
                  </div>
                )}
                {nodeData.operation === 'get' && (
                  <div className="space-y-2">
                    <Label className="text-xs">JSON 路径</Label>
                    <Input
                      className="h-8"
                      placeholder="data.ltp"
                      value={(nodeData.jsonPath as string) || ''}
                      onChange={(e) => handleDataChange('jsonPath', e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            {nodeType === 'mathExpression' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">表达式</Label>
                  <Textarea
                    className="min-h-[80px] font-mono"
                    placeholder="({{ltp}} * {{lotSize}}) + {{brokerage}}"
                    value={(nodeData.expression as string) || ''}
                    onChange={(e) => handleDataChange('expression', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Supports: +, -, *, /, %, ** (power)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="result"
                    value={(nodeData.outputVariable as string) || 'result'}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                </div>
              </>
            )}

            {nodeType === 'httpRequest' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">方法</Label>
                  <div className="grid grid-cols-5 gap-1">
                    {HTTP_METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => handleDataChange('method', m.value)}
                        className={cn(
                          'rounded-md border py-1.5 text-[10px] font-bold',
                          nodeData.method === m.value
                            ? 'bg-primary text-primary-foreground'
                            : 'border-border bg-muted'
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">URL</Label>
                  <Input
                    className="h-8"
                    placeholder="https://api.example.com"
                    value={(nodeData.url as string) || ''}
                    onChange={(e) => handleDataChange('url', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">请求头（JSON）</Label>
                  <Textarea
                    className="min-h-[60px] font-mono text-xs"
                    placeholder='{"Authorization": "Bearer {{token}}"}'
                    value={(nodeData.headers as string) || ''}
                    onChange={(e) => handleDataChange('headers', e.target.value)}
                  />
                </div>
                {['POST', 'PUT', 'PATCH'].includes((nodeData.method as string) || 'GET') && (
                  <div className="space-y-2">
                    <Label className="text-xs">请求内容（JSON）</Label>
                    <Textarea
                      className="min-h-[80px] font-mono text-xs"
                      placeholder='{"symbol": "{{webhook.symbol}}"}'
                      value={(nodeData.body as string) || ''}
                      onChange={(e) => handleDataChange('body', e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs">超时（毫秒）</Label>
                  <Input
                    type="number"
                    min={1000}
                    max={60000}
                    className="h-8"
                    value={(nodeData.timeout as number) || 30000}
                    onChange={(e) =>
                      handleDataChange('timeout', parseInt(e.target.value, 10) || 30000)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">输出变量</Label>
                  <Input
                    className="h-8"
                    placeholder="apiResponse"
                    value={(nodeData.outputVariable as string) || ''}
                    onChange={(e) => handleDataChange('outputVariable', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Use {`{{apiResponse.data}}`}</p>
                </div>
              </>
            )}

            {/* ===== CONDITION NODES ===== */}
            {nodeType === 'timeWindow' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">开始时间</Label>
                  <Input
                    type="time"
                    className="h-8"
                    value={(nodeData.startTime as string) || '09:15'}
                    onChange={(e) => handleDataChange('startTime', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">结束时间</Label>
                  <Input
                    type="time"
                    className="h-8"
                    value={(nodeData.endTime as string) || '15:30'}
                    onChange={(e) => handleDataChange('endTime', e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-xs">条件取反</Label>
                    <p className="text-[10px] text-muted-foreground">在时间区间外触发</p>
                  </div>
                  <Switch
                    checked={(nodeData.invertCondition as boolean) || false}
                    onCheckedChange={(v) => handleDataChange('invertCondition', v)}
                  />
                </div>
              </>
            )}

            {nodeType === 'timeCondition' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">条件类型</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {CONDITION_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => handleDataChange('conditionType', t.value)}
                        className={cn(
                          'rounded-lg border py-2 text-sm font-semibold',
                          nodeData.conditionType === t.value
                            ? t.value === 'entry'
                              ? 'bg-green-500/20 border-green-500 text-green-600'
                              : t.value === 'exit'
                                ? 'bg-red-500/20 border-red-500 text-red-600'
                                : 'bg-primary text-primary-foreground'
                            : 'border-border bg-muted'
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">运算符</Label>
                  <Select
                    value={(nodeData.operator as string) || '>='}
                    onValueChange={(v) => handleDataChange('operator', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPERATORS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">目标时间</Label>
                  <Input
                    type="time"
                    className="h-8"
                    value={(nodeData.targetTime as string) || '09:30'}
                    onChange={(e) => handleDataChange('targetTime', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">标签</Label>
                  <Input
                    className="h-8"
                    placeholder="Market Open Entry"
                    value={(nodeData.label as string) || ''}
                    onChange={(e) => handleDataChange('label', e.target.value)}
                  />
                </div>
              </>
            )}

            {nodeType === 'priceCondition' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">字段</Label>
                  <Select
                    value={(nodeData.field as string) || 'ltp'}
                    onValueChange={(v) => handleDataChange('field', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ltp">最新成交价</SelectItem>
                      <SelectItem value="open">开盘价</SelectItem>
                      <SelectItem value="high">最高价</SelectItem>
                      <SelectItem value="low">最低价</SelectItem>
                      <SelectItem value="prev_close">昨收价</SelectItem>
                      <SelectItem value="change_percent">涨跌幅 %</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">运算符</Label>
                  <Select
                    value={(nodeData.operator as string) || '>'}
                    onValueChange={(v) => handleDataChange('operator', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=">">&gt;</SelectItem>
                      <SelectItem value="<">&lt;</SelectItem>
                      <SelectItem value="==">=</SelectItem>
                      <SelectItem value=">=">&gt;=</SelectItem>
                      <SelectItem value="<=">&lt;=</SelectItem>
                      <SelectItem value="!=">!=</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">值</Label>
                  <Input
                    type="number"
                    step="0.05"
                    className="h-8"
                    value={(nodeData.value as number) || ''}
                    onChange={(e) => handleDataChange('value', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </>
            )}

            {nodeType === 'varCondition' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">左值</Label>
                  <Input
                    className="h-8"
                    placeholder="{{rsi1.latest.value}}"
                    value={(nodeData.leftValue as string) || ''}
                    onChange={(e) => handleDataChange('leftValue', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">运算符</Label>
                  <Select
                    value={(nodeData.operator as string) || '>'}
                    onValueChange={(v) => handleDataChange('operator', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=">">&gt;</SelectItem>
                      <SelectItem value="<">&lt;</SelectItem>
                      <SelectItem value="==">=</SelectItem>
                      <SelectItem value=">=">&gt;=</SelectItem>
                      <SelectItem value="<=">&lt;=</SelectItem>
                      <SelectItem value="!=">!=</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">右值</Label>
                  <Input
                    className="h-8"
                    placeholder="30 or {{pdhpdl.pdh}}"
                    value={(nodeData.rightValue as string) || ''}
                    onChange={(e) => handleDataChange('rightValue', e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Compares any two values after {'{{...}}'} interpolation - an indicator output, a
                  prior-period level, a workflow variable, or a literal number.
                </p>
              </>
            )}

            {nodeType === 'positionCheck' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">交易品种</Label>
                  <Input
                    className="h-8"
                    placeholder="RELIANCE"
                    value={(nodeData.symbol as string) || ''}
                    onChange={(e) => handleDataChange('symbol', e.target.value)}
                  />
                </div>
                <ExchangeField
                  value={(nodeData.exchange as string) || 'NSE'}
                  onChange={(v) => handleDataChange('exchange', v)}
                />
                <ProductField
                  value={nodeProduct}
                  onChange={(v) => handleDataChange('product', v)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">条件</Label>
                  <Select
                    value={(nodeData.condition as string) || 'exists'}
                    onValueChange={(v) => handleDataChange('condition', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exists">有持仓</SelectItem>
                      <SelectItem value="not_exists">无持仓</SelectItem>
                      <SelectItem value="quantity_above">数量高于</SelectItem>
                      <SelectItem value="quantity_below">数量低于</SelectItem>
                      <SelectItem value="pnl_above">盈亏高于</SelectItem>
                      <SelectItem value="pnl_below">盈亏低于</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {['quantity_above', 'quantity_below', 'pnl_above', 'pnl_below'].includes(
                  nodeData.condition as string
                ) && (
                  <div className="space-y-2">
                    <Label className="text-xs">阈值</Label>
                    <Input
                      type="number"
                      className="h-8"
                      value={(nodeData.threshold as number) || ''}
                      onChange={(e) =>
                        handleDataChange('threshold', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                )}
              </>
            )}

            {nodeType === 'fundCheck' && (
              <div className="space-y-2">
                <Label className="text-xs">最低可用资金</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-8"
                  placeholder="10000"
                  value={(nodeData.minAvailable as number) || ''}
                  onChange={(e) =>
                    handleDataChange('minAvailable', parseFloat(e.target.value) || 0)
                  }
                />
                <p className="text-[10px] text-muted-foreground">检查可用保证金是否高于此值</p>
              </div>
            )}

            {nodeType === 'andGate' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">输入数量</Label>
                  <Select
                    value={String((nodeData.inputCount as number) || 2)}
                    onValueChange={(v) => handleDataChange('inputCount', parseInt(v, 10))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 个输入</SelectItem>
                      <SelectItem value="3">3 个输入</SelectItem>
                      <SelectItem value="4">4 个输入</SelectItem>
                      <SelectItem value="5">5 个输入</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-xs">
                  <p className="font-medium mb-1">与门</p>
                  <p className="text-muted-foreground">所有条件均满足时为真</p>
                </div>
              </>
            )}

            {nodeType === 'orGate' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">输入数量</Label>
                  <Select
                    value={String((nodeData.inputCount as number) || 2)}
                    onValueChange={(v) => handleDataChange('inputCount', parseInt(v, 10))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 个输入</SelectItem>
                      <SelectItem value="3">3 个输入</SelectItem>
                      <SelectItem value="4">4 个输入</SelectItem>
                      <SelectItem value="5">5 个输入</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-xs">
                  <p className="font-medium mb-1">或门</p>
                  <p className="text-muted-foreground">任一条件满足时为真</p>
                </div>
              </>
            )}

            {nodeType === 'notGate' && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs">
                <p className="font-medium mb-1">非门</p>
                <p className="text-muted-foreground">反转条件：真变为假，假变为真。</p>
              </div>
            )}

            {nodeType === 'group' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">组名称</Label>
                  <Input
                    className="h-8"
                    placeholder="Entry Logic"
                    value={(nodeData.label as string) || ''}
                    onChange={(e) => handleDataChange('label', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">颜色</Label>
                  <Select
                    value={(nodeData.color as string) || 'default'}
                    onValueChange={(v) => handleDataChange('color', v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">默认</SelectItem>
                      <SelectItem value="blue">蓝色</SelectItem>
                      <SelectItem value="green">绿色</SelectItem>
                      <SelectItem value="red">红色</SelectItem>
                      <SelectItem value="purple">紫色</SelectItem>
                      <SelectItem value="orange">橙色</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* ===== FALLBACK ===== */}
            {!NODE_TITLES[nodeType] && (
              <>
                {nodeInfo && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs font-medium">{nodeInfo.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {nodeInfo.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs">节点标签</Label>
                  <Input
                    className="h-8"
                    placeholder="输入标签…"
                    value={(nodeData.label as string) || ''}
                    onChange={(e) => handleDataChange('label', e.target.value)}
                  />
                </div>
              </>
            )}

            <Separator />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">节点编号</Label>
              <code className="block text-[10px] bg-muted px-2 py-1 rounded font-mono">
                {selectedNode.id}
              </code>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
