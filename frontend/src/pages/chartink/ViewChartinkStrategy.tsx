import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Info,
  Power,
  Settings,
  Trash2,
  Webhook,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { chartinkApi } from '@/api/chartink'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ChartinkStrategy, ChartinkSymbolMapping } from '@/types/chartink'
import { showToast } from '@/utils/toast'

export default function ViewChartinkStrategy() {
  const { strategyId } = useParams<{ strategyId: string }>()
  const navigate = useNavigate()
  const [strategy, setStrategy] = useState<ChartinkStrategy | null>(null)
  const [mappings, setMappings] = useState<ChartinkSymbolMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [hostConfig, setHostConfig] = useState<{
    host_server: string
    is_localhost: boolean
  } | null>(null)

  const fetchStrategy = async () => {
    if (!strategyId) return
    try {
      setLoading(true)
      const data = await chartinkApi.getStrategy(Number(strategyId))
      setStrategy(data.strategy)
      setMappings(data.mappings || [])
    } catch (_error) {
      showToast.error('加载策略失败', 'chartink')
      navigate('/chartink')
    } finally {
      setLoading(false)
    }
  }

  // Fetch host configuration on mount
  useEffect(() => {
    const fetchHostConfig = async () => {
      try {
        const response = await fetch('/api/config/host', { credentials: 'include' })
        const data = await response.json()
        setHostConfig(data)
      } catch (_error) {
        // Fallback to window.location.origin if config fetch fails
        setHostConfig({
          host_server: window.location.origin,
          is_localhost:
            window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
        })
      }
    }
    fetchHostConfig()
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time fetch of the strategy on mount; fetchStrategy is recreated each render and adding it would re-run the fetch on every render
  useEffect(() => {
    fetchStrategy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      showToast.success('已复制到剪贴板', 'clipboard')
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      showToast.error('复制失败', 'clipboard')
    }
  }

  const handleToggle = async () => {
    if (!strategy) return
    try {
      setToggling(true)
      const response = await chartinkApi.toggleStrategy(strategy.id)
      if (response.status === 'success') {
        setStrategy({ ...strategy, is_active: response.data?.is_active ?? !strategy.is_active })
        showToast.success(
          response.data?.is_active ? 'Strategy activated' : 'Strategy deactivated',
          'chartink'
        )
      } else {
        showToast.error(response.message || '切换策略状态失败', 'chartink')
      }
    } catch (_error) {
      showToast.error('切换策略状态失败', 'chartink')
    } finally {
      setToggling(false)
    }
  }

  const handleDelete = async () => {
    if (!strategy) return
    try {
      setDeleting(true)
      const response = await chartinkApi.deleteStrategy(strategy.id)
      if (response.status === 'success') {
        showToast.success('Strategy deleted successfully', 'chartink')
        navigate('/chartink')
      } else {
        showToast.error(response.message || '删除策略失败', 'chartink')
      }
    } catch (_error) {
      showToast.error('删除策略失败', 'chartink')
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const handleDeleteMapping = async (mappingId: number) => {
    if (!strategy) return
    try {
      const response = await chartinkApi.deleteSymbolMapping(strategy.id, mappingId)
      if (response.status === 'success') {
        setMappings(mappings.filter((m) => m.id !== mappingId))
        showToast.success('Symbol mapping deleted', 'chartink')
      } else {
        showToast.error(response.message || '删除映射失败', 'chartink')
      }
    } catch (_error) {
      showToast.error('删除映射失败', 'chartink')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!strategy) {
    return null
  }

  // Get webhook URL using host config
  const baseUrl = hostConfig?.host_server || window.location.origin
  const webhookUrl = `${baseUrl}/chartink/webhook/${strategy.webhook_id}`

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link to="/chartink">
          <ArrowLeft className="h-4 w-4 mr-2" />返回 Chartink 策略</Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            {strategy.name}
            <Badge variant={strategy.is_active ? 'default' : 'secondary'}>
              {strategy.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </h1>
          <p className="text-muted-foreground">
            Chartink • Created {new Date(strategy.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={strategy.is_active ? 'outline' : 'default'}
            onClick={handleToggle}
            disabled={toggling}
          >
            <Power className="h-4 w-4 mr-2" />
            {toggling ? 'Updating...' : strategy.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            删除
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Strategy Details */}
        <Card>
          <CardHeader>
            <CardTitle>策略详情</CardTitle>
            <CardDescription>配置与设置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">状态</p>
                <Badge variant={strategy.is_active ? 'default' : 'secondary'} className="mt-1">
                  {strategy.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">类型</p>
                <Badge variant="outline" className="mt-1">
                  {strategy.is_intraday ? 'Intraday' : 'Positional'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">交易所</p>
                <p className="mt-1">仅限 NSE、BSE</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">产品类型</p>
                <p className="mt-1">仅限 MIS、CNC</p>
              </div>
            </div>

            {strategy.is_intraday && strategy.start_time && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4" />交易时段</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">开始</p>
                      <p className="font-mono">{strategy.start_time}</p>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">End</p>
                      <p className="font-mono">{strategy.end_time}</p>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <p className="text-xs text-muted-foreground">平仓</p>
                      <p className="font-mono">{strategy.squareoff_time}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Webhook Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />Webhook 配置</CardTitle>
            <CardDescription>在 Chartink 筛选器中使用此地址</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Webhook URL */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Webhook URL</p>
              <div className="flex gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                  {webhookUrl}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookUrl, 'url')}
                  aria-label={copiedField === 'url' ? 'Webhook URL copied' : 'Copy webhook URL'}
                >
                  {copiedField === 'url' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Setup Instructions */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Chartink 设置：</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>进入 Chartink 筛选器设置</li>
                  <li>添加此 Webhook 地址</li>
                  <li>提醒名称中须包含 BUY / SELL / SHORT / COVER</li>
                  <li>保存并启用提醒</li>
                </ol>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Important Notes */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>重要说明</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>
              仅当策略<strong>已启用</strong>时处理订单
            </li>
            {strategy.is_intraday && (
              <li>
                仅在交易时间内处理订单（{strategy.start_time} -{' '}
                {strategy.end_time}）
              </li>
            )}
            <li>必须在下方映射中配置 Chartink 品种代码</li>
            <li>仅支持 NSE 和 BSE 交易所</li>
            <li>仅支持 MIS 和 CNC 产品类型</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Symbol Mappings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>品种代码映射</CardTitle>
            <CardDescription>
              Chartink symbols configured for this strategy ({mappings.length} total)
            </CardDescription>
          </div>
          <Button asChild>
            <Link to={`/chartink/${strategy.id}/configure`}>
              <Settings className="h-4 w-4 mr-2" />配置交易品种</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>尚未配置交易品种。</p>
              <Button variant="link" asChild>
                <Link to={`/chartink/${strategy.id}/configure`}>添加第一个交易品种</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chartink 品种代码</TableHead>
                  <TableHead>交易所</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead>产品类型</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell className="font-medium">{mapping.chartink_symbol}</TableCell>
                    <TableCell>{mapping.exchange}</TableCell>
                    <TableCell className="text-right">{mapping.quantity}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{mapping.product_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteMapping(mapping.id)}
                        aria-label="删除品种映射"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除策略</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{strategy.name}"? This action cannot be undone. All
              symbol mappings will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Strategy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
