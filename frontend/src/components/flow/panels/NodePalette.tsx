// components/flow/panels/NodePalette.tsx
// Left sidebar with draggable node items organized by category

import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Calculator,
  Calendar,
  CalendarClock,
  CalendarRange,
  CalendarX,
  ClipboardList,
  Clock,
  FileSearch,
  FileText,
  Globe,
  Grid3X3,
  Group,
  History,
  Hourglass,
  Layers,
  Layers3,
  MessageCircle,
  Package,
  PackageCheck,
  Pencil,
  Radio,
  RadioTower,
  Receipt,
  Send,
  Shield,
  ShoppingCart,
  Sigma,
  SlidersHorizontal,
  Split,
  Square,
  Tag,
  Target,
  Timer,
  TrendingUp,
  Variable,
  Wallet,
  Webhook,
  WifiOff,
  XCircle,
  Zap,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface NodeItemProps {
  type: string
  label: string
  description: string
  icon: React.ReactNode
  color: string
  onDragStart: (event: React.DragEvent, nodeType: string) => void
  onAdd: (nodeType: string) => void
}

function NodeItem({ type, label, description, icon, color, onDragStart, onAdd }: NodeItemProps) {
  // Dragging was the only way to place a node: this was a plain div with no
  // role, no tab stop and no activation handler of any kind - not even a click.
  // A keyboard user could not add the first node to a graph at all, because the
  // one alternative (the + button on an edge) only inserts between two nodes
  // that are already connected.
  return (
    <button
      type="button"
      draggable
      aria-label={`添加${label}节点`}
      onDragStart={(e) => onDragStart(e, type)}
      onClick={() => onAdd(type)}
      className={cn(
        'group w-full cursor-grab rounded-lg border border-border bg-card p-2.5 text-left',
        'transition-all duration-200 hover:border-primary/50 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'active:cursor-grabbing'
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', color)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{label}</div>
          <div className="truncate text-[10px] text-muted-foreground">{description}</div>
        </div>
      </div>
    </button>
  )
}

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string) => void
  onAdd: (nodeType: string) => void
}

export function NodePalette({ onDragStart, onAdd }: NodePaletteProps) {
  const triggers = [
    {
      type: 'start',
      label: '定时触发',
      description: '按计划启动',
      icon: <Clock className="h-3.5 w-3.5 text-orange-500" />,
      color: 'bg-orange-500/10',
    },
    {
      type: 'priceAlert',
      label: '价格提醒',
      description: '达到价格时触发',
      icon: <Bell className="h-3.5 w-3.5 text-orange-500" />,
      color: 'bg-orange-500/10',
    },
    {
      type: 'webhookTrigger',
      label: 'Webhook',
      description: '外部触发',
      icon: <Webhook className="h-3.5 w-3.5 text-orange-500" />,
      color: 'bg-orange-500/10',
    },
    {
      type: 'orderUpdateTrigger',
      label: '订单更新',
      description: '成交或拒单时触发',
      icon: <PackageCheck className="h-3.5 w-3.5 text-orange-500" />,
      color: 'bg-orange-500/10',
    },
  ]

  const actions = [
    {
      type: 'placeOrder',
      label: '下单',
      description: '普通订单',
      icon: <ShoppingCart className="h-3.5 w-3.5 text-blue-500" />,
      color: 'bg-blue-500/10',
    },
    {
      type: 'smartOrder',
      label: '智能下单',
      description: '根据持仓调整',
      icon: <Zap className="h-3.5 w-3.5 text-blue-500" />,
      color: 'bg-blue-500/10',
    },
    {
      type: 'optionsOrder',
      label: '期权下单',
      description: 'ATM/ITM/OTM',
      icon: <TrendingUp className="h-3.5 w-3.5 text-blue-500" />,
      color: 'bg-blue-500/10',
    },
    {
      type: 'optionsMultiOrder',
      label: '多腿期权',
      description: '期权策略',
      icon: <Layers className="h-3.5 w-3.5 text-blue-500" />,
      color: 'bg-blue-500/10',
    },
    {
      type: 'basketOrder',
      label: '篮子订单',
      description: '多个订单',
      icon: <Package className="h-3.5 w-3.5 text-blue-500" />,
      color: 'bg-blue-500/10',
    },
    {
      type: 'splitOrder',
      label: '拆单',
      description: '大额订单拆分',
      icon: <Split className="h-3.5 w-3.5 text-blue-500" />,
      color: 'bg-blue-500/10',
    },
    {
      type: 'modifyOrder',
      label: '修改订单',
      description: '修改委托',
      icon: <Pencil className="h-3.5 w-3.5 text-blue-500" />,
      color: 'bg-blue-500/10',
    },
    {
      type: 'cancelOrder',
      label: '撤销订单',
      description: '按订单号撤销',
      icon: <XCircle className="h-3.5 w-3.5 text-red-500" />,
      color: 'bg-red-500/10',
    },
    {
      type: 'cancelAllOrders',
      label: '全部撤单',
      description: '撤销订单',
      icon: <XCircle className="h-3.5 w-3.5 text-red-500" />,
      color: 'bg-red-500/10',
    },
    {
      type: 'closePositions',
      label: '平仓',
      description: '平掉全部持仓',
      icon: <Square className="h-3.5 w-3.5 text-red-500" />,
      color: 'bg-red-500/10',
    },
  ]

  const conditions = [
    {
      type: 'timeCondition',
      label: '时间条件',
      description: '入场／出场时间',
      icon: <Clock className="h-3.5 w-3.5 text-purple-500" />,
      color: 'bg-purple-500/10',
    },
    {
      type: 'positionCheck',
      label: '持仓检查',
      description: '检查持仓',
      icon: <Briefcase className="h-3.5 w-3.5 text-purple-500" />,
      color: 'bg-purple-500/10',
    },
    {
      type: 'fundCheck',
      label: '资金检查',
      description: '检查资金',
      icon: <Wallet className="h-3.5 w-3.5 text-purple-500" />,
      color: 'bg-purple-500/10',
    },
    {
      type: 'priceCondition',
      label: '价格检查',
      description: '检查价格',
      icon: <TrendingUp className="h-3.5 w-3.5 text-purple-500" />,
      color: 'bg-purple-500/10',
    },
    {
      type: 'timeWindow',
      label: '时间区间',
      description: '交易时段',
      icon: <Clock className="h-3.5 w-3.5 text-purple-500" />,
      color: 'bg-purple-500/10',
    },
    {
      type: 'andGate',
      label: '与门',
      description: '所有条件均满足',
      icon: <span className="text-[9px] font-bold text-purple-500">AND</span>,
      color: 'bg-purple-500/10',
    },
    {
      type: 'orGate',
      label: '或门',
      description: '任一条件满足',
      icon: <span className="text-[9px] font-bold text-purple-500">OR</span>,
      color: 'bg-purple-500/10',
    },
    {
      type: 'notGate',
      label: '非门',
      description: '条件取反',
      icon: <span className="text-[9px] font-bold text-purple-500">NOT</span>,
      color: 'bg-purple-500/10',
    },
    {
      type: 'varCondition',
      label: '变量条件',
      description: '比较两个值',
      icon: <SlidersHorizontal className="h-3.5 w-3.5 text-purple-500" />,
      color: 'bg-purple-500/10',
    },
  ]

  const data = [
    {
      type: 'getQuote',
      label: '获取行情',
      description: '实时行情',
      icon: <BarChart3 className="h-3.5 w-3.5 text-cyan-500" />,
      color: 'bg-cyan-500/10',
    },
    {
      type: 'getDepth',
      label: '获取盘口',
      description: '买卖盘深度',
      icon: <Layers3 className="h-3.5 w-3.5 text-cyan-500" />,
      color: 'bg-cyan-500/10',
    },
    {
      type: 'getOrderStatus',
      label: '订单状态',
      description: '检查订单',
      icon: <FileSearch className="h-3.5 w-3.5 text-orange-500" />,
      color: 'bg-orange-500/10',
    },
    {
      type: 'history',
      label: '历史数据',
      description: '开高低收及成交量',
      icon: <TrendingUp className="h-3.5 w-3.5 text-cyan-500" />,
      color: 'bg-cyan-500/10',
    },
    {
      type: 'indicator',
      label: '技术指标',
      description: '计算技术指标',
      icon: <Activity className="h-3.5 w-3.5 text-cyan-500" />,
      color: 'bg-cyan-500/10',
    },
    {
      type: 'strategyPnl',
      label: '策略盈亏',
      description: '策略已实现／未实现盈亏',
      icon: <Wallet className="h-3.5 w-3.5 text-cyan-500" />,
      color: 'bg-cyan-500/10',
    },
    {
      type: 'priorPeriodOhlc',
      label: '上一周期 OHLC',
      description: '上一小时／日／周／月',
      icon: <CalendarClock className="h-3.5 w-3.5 text-cyan-500" />,
      color: 'bg-cyan-500/10',
    },
    {
      type: 'barOffset',
      label: 'K 线偏移',
      description: '前 N 根 K 线行情',
      icon: <History className="h-3.5 w-3.5 text-cyan-500" />,
      color: 'bg-cyan-500/10',
    },
    {
      type: 'openPosition',
      label: '查询持仓',
      description: '获取持仓',
      icon: <Briefcase className="h-3.5 w-3.5 text-violet-500" />,
      color: 'bg-violet-500/10',
    },
    {
      type: 'expiry',
      label: '到期日期',
      description: '期货和期权到期日',
      icon: <Calendar className="h-3.5 w-3.5 text-pink-500" />,
      color: 'bg-pink-500/10',
    },
    {
      type: 'intervals',
      label: '时间周期',
      description: '券商支持的周期',
      icon: <Clock className="h-3.5 w-3.5 text-pink-500" />,
      color: 'bg-pink-500/10',
    },
    {
      type: 'calendar',
      label: '交易日历',
      description: '新的一天／周／月',
      icon: <CalendarRange className="h-3.5 w-3.5 text-purple-400" />,
      color: 'bg-purple-400/10',
    },
    {
      type: 'multiQuotes',
      label: '批量行情',
      description: '多个交易品种',
      icon: <BarChart3 className="h-3.5 w-3.5 text-cyan-500" />,
      color: 'bg-cyan-500/10',
    },
    {
      type: 'symbol',
      label: '品种信息',
      description: '获取品种详情',
      icon: <Tag className="h-3.5 w-3.5 text-teal-500" />,
      color: 'bg-teal-500/10',
    },
    {
      type: 'optionSymbol',
      label: '期权合约',
      description: '解析期权合约',
      icon: <Target className="h-3.5 w-3.5 text-pink-500" />,
      color: 'bg-pink-500/10',
    },
    {
      type: 'orderBook',
      label: '委托列表',
      description: '所有订单',
      icon: <ClipboardList className="h-3.5 w-3.5 text-orange-500" />,
      color: 'bg-orange-500/10',
    },
    {
      type: 'tradeBook',
      label: '成交列表',
      description: '已成交记录',
      icon: <Receipt className="h-3.5 w-3.5 text-orange-500" />,
      color: 'bg-orange-500/10',
    },
    {
      type: 'positionBook',
      label: '持仓列表',
      description: '所有持仓',
      icon: <Briefcase className="h-3.5 w-3.5 text-violet-500" />,
      color: 'bg-violet-500/10',
    },
    {
      type: 'syntheticFuture',
      label: '合成期货',
      description: '计算期货价格',
      icon: <Calculator className="h-3.5 w-3.5 text-pink-500" />,
      color: 'bg-pink-500/10',
    },
    {
      type: 'optionChain',
      label: '期权链',
      description: '完整期权链数据',
      icon: <Grid3X3 className="h-3.5 w-3.5 text-pink-500" />,
      color: 'bg-pink-500/10',
    },
    {
      type: 'holdings',
      label: '持有资产',
      description: '投资组合资产',
      icon: <Briefcase className="h-3.5 w-3.5 text-amber-500" />,
      color: 'bg-amber-500/10',
    },
    {
      type: 'funds',
      label: '资金',
      description: '账户余额',
      icon: <Wallet className="h-3.5 w-3.5 text-amber-500" />,
      color: 'bg-amber-500/10',
    },
    {
      type: 'margin',
      label: '保证金计算',
      description: '所需保证金',
      icon: <Shield className="h-3.5 w-3.5 text-amber-500" />,
      color: 'bg-amber-500/10',
    },
  ]

  const streaming = [
    {
      type: 'subscribeLtp',
      label: '订阅最新价',
      description: '实时价格流',
      icon: <Radio className="h-3.5 w-3.5 text-green-500" />,
      color: 'bg-green-500/10',
    },
    {
      type: 'subscribeQuote',
      label: '订阅行情',
      description: '实时 OHLC 行情',
      icon: <RadioTower className="h-3.5 w-3.5 text-green-500" />,
      color: 'bg-green-500/10',
    },
    {
      type: 'subscribeDepth',
      label: '订阅盘口',
      description: '实时买卖盘口',
      icon: <Layers3 className="h-3.5 w-3.5 text-green-500" />,
      color: 'bg-green-500/10',
    },
    {
      type: 'unsubscribe',
      label: '取消订阅',
      description: '停止行情流',
      icon: <WifiOff className="h-3.5 w-3.5 text-red-500" />,
      color: 'bg-red-500/10',
    },
  ]

  const utilities = [
    {
      type: 'variable',
      label: '变量',
      description: '存储数值',
      icon: <Variable className="h-3.5 w-3.5 text-purple-400" />,
      color: 'bg-purple-400/10',
    },
    {
      type: 'mathExpression',
      label: '数学运算',
      description: '计算表达式',
      icon: <Sigma className="h-3.5 w-3.5 text-purple-500" />,
      color: 'bg-purple-500/10',
    },
    {
      type: 'log',
      label: '日志',
      description: '调试消息',
      icon: <FileText className="h-3.5 w-3.5 text-blue-400" />,
      color: 'bg-blue-400/10',
    },
    {
      type: 'telegramAlert',
      label: 'Telegram',
      description: '发送提醒',
      icon: <Send className="h-3.5 w-3.5 text-[#0088cc]" />,
      color: 'bg-[#0088cc]/10',
    },
    {
      type: 'whatsappAlert',
      label: 'WhatsApp',
      description: '发送提醒',
      icon: <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />,
      color: 'bg-[#25D366]/10',
    },
    {
      type: 'delay',
      label: '延时',
      description: '等待一段时间',
      icon: <Timer className="h-3.5 w-3.5 text-muted-foreground" />,
      color: 'bg-muted',
    },
    {
      type: 'waitUntil',
      label: '等待至指定时间',
      description: '等待至指定时间',
      icon: <Hourglass className="h-3.5 w-3.5 text-amber-500" />,
      color: 'bg-amber-500/10',
    },
    {
      type: 'group',
      label: '分组',
      description: '节点分组',
      icon: <Group className="h-3.5 w-3.5 text-muted-foreground" />,
      color: 'bg-muted',
    },
    {
      type: 'httpRequest',
      label: 'HTTP 请求',
      description: '调用 API',
      icon: <Globe className="h-3.5 w-3.5 text-primary" />,
      color: 'bg-primary/10',
    },
    {
      type: 'holidays',
      label: '节假日',
      description: '市场休市日',
      icon: <CalendarX className="h-3.5 w-3.5 text-purple-400" />,
      color: 'bg-purple-400/10',
    },
    {
      type: 'timings',
      label: '交易时间',
      description: '交易时段',
      icon: <Clock className="h-3.5 w-3.5 text-purple-400" />,
      color: 'bg-purple-400/10',
    },
  ]

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="shrink-0 border-b border-border p-3">
        <h2 className="text-sm font-semibold">节点</h2>
        <p className="text-[10px] text-muted-foreground">将节点拖到画布，或点击添加</p>
      </div>
      <Tabs defaultValue="triggers" className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 border-b border-border px-1 py-1.5">
          <TabsList className="h-7 w-full">
            <TabsTrigger value="triggers" className="flex-1 text-[8px] px-0.5">
              触发
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex-1 text-[8px] px-0.5">
              操作
            </TabsTrigger>
            <TabsTrigger value="data" className="flex-1 text-[8px] px-0.5">
              数据
            </TabsTrigger>
            <TabsTrigger value="stream" className="flex-1 text-[8px] px-0.5">
              实时
            </TabsTrigger>
            <TabsTrigger value="conditions" className="flex-1 text-[8px] px-0.5">
              逻辑
            </TabsTrigger>
            <TabsTrigger value="utilities" className="flex-1 text-[8px] px-0.5">
              工具
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 min-h-0 relative">
          <TabsContent value="triggers" className="m-0 absolute inset-0">
            <ScrollArea className="h-full">
              <div className="space-y-1.5 p-2">
                {triggers.map((node) => (
                  <NodeItem key={node.type} {...node} onDragStart={onDragStart} onAdd={onAdd} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="actions" className="m-0 absolute inset-0">
            <ScrollArea className="h-full">
              <div className="space-y-1.5 p-2">
                {actions.map((node) => (
                  <NodeItem key={node.type} {...node} onDragStart={onDragStart} onAdd={onAdd} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="data" className="m-0 absolute inset-0">
            <ScrollArea className="h-full">
              <div className="space-y-1.5 p-2">
                {data.map((node) => (
                  <NodeItem key={node.type} {...node} onDragStart={onDragStart} onAdd={onAdd} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="stream" className="m-0 absolute inset-0">
            <ScrollArea className="h-full">
              <div className="space-y-1.5 p-2">
                {streaming.map((node) => (
                  <NodeItem key={node.type} {...node} onDragStart={onDragStart} onAdd={onAdd} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="conditions" className="m-0 absolute inset-0">
            <ScrollArea className="h-full">
              <div className="space-y-1.5 p-2">
                {conditions.map((node) => (
                  <NodeItem key={node.type} {...node} onDragStart={onDragStart} onAdd={onAdd} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="utilities" className="m-0 absolute inset-0">
            <ScrollArea className="h-full">
              <div className="space-y-1.5 p-2">
                {utilities.map((node) => (
                  <NodeItem key={node.type} {...node} onDragStart={onDragStart} onAdd={onAdd} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
