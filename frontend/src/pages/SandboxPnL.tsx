import { Activity, Briefcase, Calendar, Download, Package, Settings } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, makeFormatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

interface DailyPnL {
  date: string
  realized_pnl: number
  positions_unrealized: number
  holdings_unrealized: number
  total_unrealized: number
  total_mtm: number
  portfolio_value: number
}

interface Position {
  symbol: string
  exchange: string
  product: string
  quantity: number
  average_price: number
  ltp: number
  today_realized_pnl: number
  all_time_realized_pnl: number
  status: string
  updated_at: string
}

interface Holding {
  symbol: string
  exchange: string
  quantity: number
  average_price: number
  ltp: number
  unrealized_pnl: number
  pnl_percent: number
  settlement_date: string
}

interface Trade {
  tradeid: string
  symbol: string
  exchange: string
  action: string
  quantity: number
  price: number
  product: string
  timestamp: string
}

interface Summary {
  today_realized_pnl: number
  positions_unrealized_pnl: number
  holdings_unrealized_pnl: number
  today_total_mtm: number
  all_time_realized_pnl: number
}

interface SandboxData {
  summary: Summary
  daily_pnl: DailyPnL[]
  positions: Position[]
  holdings: Holding[]
  trades: Trade[]
}

function getPnLColor(value: number): string {
  if (value > 0) return 'text-green-500'
  if (value < 0) return 'text-red-500'
  return ''
}

export default function SandboxPnL() {
  const { user } = useAuthStore()
  const formatCurrency = useMemo(() => makeFormatCurrency(user?.broker), [user?.broker])
  const [data, setData] = useState<SandboxData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('daily')

  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time data load on mount; fetchData has no reactive inputs
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const response = await fetch('/sandbox/mypnl/api/data', {
        credentials: 'include',
      })
      if (response.ok) {
        const result = await response.json()
        if (result.status === 'success') {
          setData(result.data)
        }
      }
    } catch (_error) {
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = (type: 'daily' | 'positions' | 'holdings' | 'trades') => {
    // Trigger download by navigating to the export endpoint
    window.location.href = `/sandbox/mypnl/export/${type}`
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const summary = data?.summary || {
    today_realized_pnl: 0,
    positions_unrealized_pnl: 0,
    holdings_unrealized_pnl: 0,
    today_total_mtm: 0,
    all_time_realized_pnl: 0,
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">我的盈亏历史</h1>
          <p className="text-muted-foreground mt-1">
            查看每日及历史盈亏
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/sandbox">
            <Settings className="h-4 w-4 mr-2" />
            模拟盘设置
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Today's Realized P&L */}
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">已实现盈亏</div>
            <div className={cn('text-2xl font-bold', getPnLColor(summary.today_realized_pnl))}>
              {formatCurrency(summary.today_realized_pnl)}
            </div>
            <Badge
              variant={summary.today_realized_pnl >= 0 ? 'default' : 'destructive'}
              className="mt-1"
            >
              今日
            </Badge>
          </CardContent>
        </Card>

        {/* Positions Unrealized P&L */}
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">持仓盯市盈亏</div>
            <div
              className={cn('text-2xl font-bold', getPnLColor(summary.positions_unrealized_pnl))}
            >
              {formatCurrency(summary.positions_unrealized_pnl)}
            </div>
            <Badge variant="secondary" className="mt-1">
              未实现盈亏
            </Badge>
          </CardContent>
        </Card>

        {/* Holdings Unrealized P&L */}
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">持有资产盯市盈亏</div>
            <div className={cn('text-2xl font-bold', getPnLColor(summary.holdings_unrealized_pnl))}>
              {formatCurrency(summary.holdings_unrealized_pnl)}
            </div>
            <Badge variant="outline" className="mt-1">
              未实现盈亏
            </Badge>
          </CardContent>
        </Card>

        {/* Today's Total MTM */}
        <Card className="border-2 border-primary">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">总盯市盈亏</div>
            <div className={cn('text-2xl font-bold', getPnLColor(summary.today_total_mtm))}>
              {formatCurrency(summary.today_total_mtm)}
            </div>
            <Badge className="mt-1">今日</Badge>
          </CardContent>
        </Card>

        {/* All-Time Realized P&L */}
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">累计盈亏</div>
            <div className={cn('text-2xl font-bold', getPnLColor(summary.all_time_realized_pnl))}>
              {formatCurrency(summary.all_time_realized_pnl)}
            </div>
            <Badge
              variant={summary.all_time_realized_pnl >= 0 ? 'default' : 'destructive'}
              className="mt-1"
            >
              累计
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="daily" className="gap-2">
            <Calendar className="h-4 w-4" />
            按日期查看盈亏
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-2">
            <Briefcase className="h-4 w-4" />
            持仓
          </TabsTrigger>
          <TabsTrigger value="holdings" className="gap-2">
            <Package className="h-4 w-4" />
            持有资产
          </TabsTrigger>
          <TabsTrigger value="trades" className="gap-2">
            <Activity className="h-4 w-4" />
            最近成交
          </TabsTrigger>
        </TabsList>

        {/* Date-wise P&L Tab */}
        <TabsContent value="daily">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>按日期盈亏报表</CardTitle>
              {data?.daily_pnl && data.daily_pnl.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => handleExport('daily')}>
                  <Download className="h-4 w-4 mr-2" />
                  导出 CSV
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {data?.daily_pnl && data.daily_pnl.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead className="text-right">已实现盈亏</TableHead>
                        <TableHead className="text-right">持仓盯市盈亏</TableHead>
                        <TableHead className="text-right">持有资产盯市盈亏</TableHead>
                        <TableHead className="text-right">未实现盈亏合计</TableHead>
                        <TableHead className="text-right">总盯市盈亏</TableHead>
                        <TableHead className="text-right">组合价值</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.daily_pnl.map((day, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-semibold">{day.date}</TableCell>
                          <TableCell className={cn('text-right', getPnLColor(day.realized_pnl))}>
                            {formatCurrency(day.realized_pnl)}
                          </TableCell>
                          <TableCell
                            className={cn('text-right', getPnLColor(day.positions_unrealized))}
                          >
                            {formatCurrency(day.positions_unrealized)}
                          </TableCell>
                          <TableCell
                            className={cn('text-right', getPnLColor(day.holdings_unrealized))}
                          >
                            {formatCurrency(day.holdings_unrealized)}
                          </TableCell>
                          <TableCell
                            className={cn('text-right', getPnLColor(day.total_unrealized))}
                          >
                            {formatCurrency(day.total_unrealized)}
                          </TableCell>
                          <TableCell
                            className={cn('text-right font-bold', getPnLColor(day.total_mtm))}
                          >
                            {formatCurrency(day.total_mtm)}
                          </TableCell>
                          <TableCell className="text-right text-primary">
                            {formatCurrency(day.portfolio_value)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>暂无每日盈亏数据。每天印度标准时间 23:59 保存快照。</p>
                  <p className="text-sm mt-2">开始交易后可查看按日期统计的盈亏历史。</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Positions Tab */}
        <TabsContent value="positions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>按持仓盈亏</CardTitle>
              {data?.positions && data.positions.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => handleExport('positions')}>
                  <Download className="h-4 w-4 mr-2" />
                  导出 CSV
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {data?.positions && data.positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>交易品种</TableHead>
                        <TableHead>交易所</TableHead>
                        <TableHead>交易产品</TableHead>
                        <TableHead className="text-right">数量</TableHead>
                        <TableHead className="text-right">均价</TableHead>
                        <TableHead className="text-right">最新成交价</TableHead>
                        <TableHead className="text-right">今日盈亏</TableHead>
                        <TableHead className="text-right">累计盈亏</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>最后更新</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.positions.map((pos, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-semibold">{pos.symbol}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{pos.exchange}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                pos.product === 'MIS'
                                  ? 'secondary'
                                  : pos.product === 'CNC'
                                    ? 'default'
                                    : 'outline'
                              }
                            >
                              {pos.product}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{pos.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(pos.average_price)}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(pos.ltp)}</TableCell>
                          <TableCell
                            className={cn('text-right', getPnLColor(pos.today_realized_pnl))}
                          >
                            {formatCurrency(pos.today_realized_pnl)}
                          </TableCell>
                          <TableCell
                            className={cn('text-right', getPnLColor(pos.all_time_realized_pnl))}
                          >
                            {formatCurrency(pos.all_time_realized_pnl)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={pos.status === 'Open' ? 'default' : 'secondary'}>
                              {pos.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {pos.updated_at}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Briefcase className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>暂无持仓。开始交易后可查看盈亏历史。</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holdings Tab */}
        <TabsContent value="holdings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>持有资产盈亏（T+1 结算）</CardTitle>
              {data?.holdings && data.holdings.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => handleExport('holdings')}>
                  <Download className="h-4 w-4 mr-2" />
                  导出 CSV
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {data?.holdings && data.holdings.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>交易品种</TableHead>
                        <TableHead>交易所</TableHead>
                        <TableHead className="text-right">数量</TableHead>
                        <TableHead className="text-right">均价</TableHead>
                        <TableHead className="text-right">最新成交价</TableHead>
                        <TableHead className="text-right">未实现盈亏</TableHead>
                        <TableHead className="text-right">P&L %</TableHead>
                        <TableHead>结算日期</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.holdings.map((holding, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-semibold">{holding.symbol}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{holding.exchange}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{holding.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(holding.average_price)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(holding.ltp)}
                          </TableCell>
                          <TableCell
                            className={cn('text-right', getPnLColor(holding.unrealized_pnl))}
                          >
                            {formatCurrency(holding.unrealized_pnl)}
                          </TableCell>
                          <TableCell className={cn('text-right', getPnLColor(holding.pnl_percent))}>
                            {formatCurrency(holding.pnl_percent)}%
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {holding.settlement_date}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>暂无持有资产。CNC 持仓在 T+1 结算后转为持有资产。</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Trades Tab */}
        <TabsContent value="trades">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>最近成交（最新 50 条）</CardTitle>
              {data?.trades && data.trades.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => handleExport('trades')}>
                  <Download className="h-4 w-4 mr-2" />
                  导出全部 CSV
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {data?.trades && data.trades.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>成交编号</TableHead>
                        <TableHead>交易品种</TableHead>
                        <TableHead>交易所</TableHead>
                        <TableHead>买卖</TableHead>
                        <TableHead className="text-right">数量</TableHead>
                        <TableHead className="text-right">价格</TableHead>
                        <TableHead>交易产品</TableHead>
                        <TableHead>时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.trades.map((trade, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">
                            {trade.tradeid.slice(0, 12)}...
                          </TableCell>
                          <TableCell className="font-semibold">{trade.symbol}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{trade.exchange}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={trade.action === 'BUY' ? 'default' : 'destructive'}>
                              {trade.action === 'BUY' ? '买入' : trade.action === 'SELL' ? '卖出' : trade.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{trade.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(trade.price)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                trade.product === 'MIS'
                                  ? 'secondary'
                                  : trade.product === 'CNC'
                                    ? 'default'
                                    : 'outline'
                              }
                            >
                              {trade.product}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {trade.timestamp}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>暂无成交。开始交易后可查看成交历史。</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
