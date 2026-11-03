// pages/flow/FlowIndex.tsx
// Flow workflow list page

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  MoreVertical,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Webhook,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  activateWorkflow,
  createWorkflow,
  deactivateWorkflow,
  deleteWorkflow,
  disableWebhook,
  enableWebhook,
  flowQueryKeys,
  getWebhookInfo,
  importWorkflow,
  listWorkflows,
  regenerateWebhook,
  updateWebhookAuthType,
  type WorkflowExportData,
  type WorkflowListItem,
} from '@/api/flow'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { showToast } from '@/utils/toast'

function StatusIcon({ status }: { status: string | null }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />
    case 'pending':
      return <Clock className="h-4 w-4 text-muted-foreground" />
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />
  }
}

function WorkflowCard({ workflow }: { workflow: WorkflowListItem }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isWebhookOpen, setIsWebhookOpen] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  const activateMutation = useMutation({
    mutationFn: () => activateWorkflow(workflow.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flowQueryKeys.workflows() })
      showToast.success('工作流已启用', 'flow')
    },
    onError: (error: Error) => {
      showToast.error(error.message, 'flow')
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateWorkflow(workflow.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flowQueryKeys.workflows() })
      showToast.success('工作流已停用', 'flow')
    },
    onError: (error: Error) => {
      showToast.error(error.message, 'flow')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkflow(workflow.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flowQueryKeys.workflows() })
      showToast.success('工作流已删除', 'flow')
    },
    onError: (error: Error) => {
      showToast.error(error.message, 'flow')
    },
  })

  // Webhook queries and mutations
  const webhookQuery = useQuery({
    queryKey: flowQueryKeys.webhook(workflow.id),
    queryFn: () => getWebhookInfo(workflow.id),
    enabled: isWebhookOpen,
  })

  const enableWebhookMutation = useMutation({
    mutationFn: () => enableWebhook(workflow.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flowQueryKeys.webhook(workflow.id) })
      showToast.success('Webhook 已启用', 'flow')
    },
    onError: (error: Error) => {
      showToast.error(error.message, 'flow')
    },
  })

  const disableWebhookMutation = useMutation({
    mutationFn: () => disableWebhook(workflow.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flowQueryKeys.webhook(workflow.id) })
      showToast.success('Webhook 已停用', 'flow')
    },
    onError: (error: Error) => {
      showToast.error(error.message, 'flow')
    },
  })

  const regenerateWebhookMutation = useMutation({
    mutationFn: () => regenerateWebhook(workflow.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flowQueryKeys.webhook(workflow.id) })
      showToast.success('Webhook 地址和密钥已重新生成', 'flow')
    },
    onError: (error: Error) => {
      showToast.error(error.message, 'flow')
    },
  })

  const updateAuthTypeMutation = useMutation({
    mutationFn: (authType: 'payload' | 'url') => updateWebhookAuthType(workflow.id, authType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flowQueryKeys.webhook(workflow.id) })
      showToast.success('认证方式已更新', 'flow')
    },
    onError: (error: Error) => {
      showToast.error(error.message, 'flow')
    },
  })

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    showToast.success(`已复制${label}到剪贴板`, 'clipboard')
  }

  return (
    <>
      {/* The click target was a bare div: no role, no tab stop, no key handler.
          The actions menu offered a keyboard route to the same page, so this was
          a redundant-affordance gap rather than a dead end - but the card is the
          primary affordance and should carry it. */}
      <Card
        role="link"
        tabIndex={0}
        aria-label={`打开工作流 ${workflow.name}`}
        className={cn(
          'group cursor-pointer transition-all duration-200 hover:border-primary/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          workflow.is_active && 'border-green-500/30'
        )}
        onClick={() => navigate(`/flow/editor/${workflow.id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigate(`/flow/editor/${workflow.id}`)
          }
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  workflow.is_active ? 'bg-green-500' : 'bg-muted-foreground'
                )}
              />
              <CardTitle className="text-base">{workflow.name}</CardTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="工作流操作"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/flow/editor/${workflow.id}`)
                  }}
                >
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsWebhookOpen(true)
                  }}
                >
                  <Webhook className="mr-2 h-4 w-4" />
                  Webhook
                </DropdownMenuItem>
                {workflow.is_active ? (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      deactivateMutation.mutate()
                    }}
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    停用
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      activateMutation.mutate()
                    }}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    启用
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteMutation.mutate()
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {workflow.description && (
            <CardDescription className="line-clamp-2">{workflow.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <StatusIcon status={workflow.last_execution_status} />
              <span>
                {workflow.last_execution_status
                  ? `上次执行：${workflow.last_execution_status}`
                  : '尚未执行'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(workflow.updated_at).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Webhook 设置 Dialog */}
      <Dialog open={isWebhookOpen} onOpenChange={setIsWebhookOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook 设置
            </DialogTitle>
            <DialogDescription>配置“{workflow.name}”的 Webhook</DialogDescription>
          </DialogHeader>

          {webhookQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : webhookQuery.data ? (
            <div className="space-y-6 py-4 overflow-y-auto flex-1">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-base">启用 Webhook</Label>
                  <p className="text-sm text-muted-foreground">
                    允许外部系统触发此工作流
                  </p>
                </div>
                <Switch
                  checked={webhookQuery.data.webhook_enabled}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      enableWebhookMutation.mutate()
                    } else {
                      disableWebhookMutation.mutate()
                    }
                  }}
                  disabled={enableWebhookMutation.isPending || disableWebhookMutation.isPending}
                />
              </div>

              {/* Authentication Type */}
              <div className="space-y-3">
                <Label>认证方式</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className={cn(
                      'rounded-lg border p-4 text-left transition-all',
                      webhookQuery.data.webhook_auth_type === 'payload'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => updateAuthTypeMutation.mutate('payload')}
                    disabled={updateAuthTypeMutation.isPending}
                  >
                    <div className="font-medium">在请求内容中提供密钥</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      适用于 TradingView 和自定义脚本
                    </p>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'rounded-lg border p-4 text-left transition-all',
                      webhookQuery.data.webhook_auth_type === 'url'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => updateAuthTypeMutation.mutate('url')}
                    disabled={updateAuthTypeMutation.isPending}
                  >
                    <div className="font-medium">在网址中提供密钥</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      适用于 Chartink 等固定格式服务
                    </p>
                  </button>
                </div>
              </div>

              {/* Webhook 地址 */}
              <div className="space-y-2">
                <Label>Webhook 地址</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhookQuery.data.webhook_url}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(webhookQuery.data.webhook_url, 'URL')}
                    aria-label="复制 Webhook 地址"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Webhook 地址 with Symbol */}
              <div className="space-y-2">
                <Label>Webhook 地址（含交易品种）</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhookQuery.data.webhook_url_with_symbol}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(webhookQuery.data.webhook_url_with_symbol, 'URL')
                    }
                    aria-label="复制含交易品种的 Webhook 地址"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  将 {'{symbol}'} 替换为实际交易品种代码，例如 RELIANCE 或 INFY。
                </p>
              </div>

              {/* Webhook 密钥 */}
              <div className="space-y-2">
                <Label>Webhook 密钥</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      readOnly
                      type={showSecret ? 'text' : 'password'}
                      value={webhookQuery.data.webhook_secret}
                      className="font-mono text-sm pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowSecret(!showSecret)}
                      aria-label={showSecret ? '隐藏 Webhook 密钥' : '显示 Webhook 密钥'}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(webhookQuery.data.webhook_secret, 'Secret')}
                    aria-label="复制 Webhook 密钥"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {webhookQuery.data.webhook_auth_type === 'url'
                    ? '将密钥以 ?secret=... 的形式追加到网址'
                    : '在 Webhook 请求内容的 secret 字段中提供密钥'}
                </p>
              </div>

              {/* URL with Secret (for URL auth type) */}
              {webhookQuery.data.webhook_auth_type === 'url' &&
                webhookQuery.data.webhook_url_with_secret && (
                  <div className="space-y-2">
                    <Label>Webhook 地址（含密钥）</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={
                          showSecret
                            ? webhookQuery.data.webhook_url_with_secret
                            : `${webhookQuery.data.webhook_url}?secret=........`
                        }
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(
                            webhookQuery.data.webhook_url_with_secret!,
                            'URL with secret'
                          )
                        }
                        aria-label="复制含密钥的 Webhook 地址"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      此地址适用于 Chartink 等请求内容格式固定的服务
                    </p>
                  </div>
                )}

              {/* 使用示例 */}
              <div className="space-y-2">
                <Label>使用示例</Label>
                <div className="rounded-lg bg-muted p-4">
                  {webhookQuery.data.webhook_auth_type === 'url' ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        For Chartink (secret in URL):
                      </p>
                      <pre className="text-xs font-mono overflow-x-auto">
                        {`POST ${webhookQuery.data.webhook_url}?secret=${showSecret ? webhookQuery.data.webhook_secret : '........'}

Chartink payload (sent as-is):
{
  "stocks": "RELIANCE,INFY,TCS",
  "trigger_prices": "2500.50,1800.25,3500.00",
  "triggered_at": "9:30 am",
  "scan_name": "My Scanner",
  "alert_name": "Buy Alert"
}`}
                      </pre>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        For TradingView (secret in payload):
                      </p>
                      <pre className="text-xs font-mono overflow-x-auto">
                        {`POST ${webhookQuery.data.webhook_url}

{
  "secret": "${showSecret ? webhookQuery.data.webhook_secret : '................'}",
  "symbol": "RELIANCE",
  "action": "BUY",
  "quantity": 10,
  "price": 2500.50
}`}
                      </pre>
                    </>
                  )}
                </div>
              </div>

              {/* Regenerate Button */}
              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => regenerateWebhookMutation.mutate()}
                  disabled={regenerateWebhookMutation.isPending}
                >
                  {regenerateWebhookMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  重新生成地址和密钥
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function FlowIndex() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [newWorkflowName, setNewWorkflowName] = useState('')
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  const {
    data: workflows,
    isLoading,
    isError,
    error: listError,
    refetch,
  } = useQuery({
    queryKey: flowQueryKeys.workflows(),
    queryFn: listWorkflows,
  })

  const createMutation = useMutation({
    mutationFn: createWorkflow,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: flowQueryKeys.workflows() })
      setIsCreateOpen(false)
      setNewWorkflowName('')
      navigate(`/flow/editor/${data.id}`)
    },
    onError: (error: Error) => {
      showToast.error(error.message, 'flow')
    },
  })

  const importMutation = useMutation({
    mutationFn: importWorkflow,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: flowQueryKeys.workflows() })
      setIsImportOpen(false)
      setImportJson('')
      setImportError(null)
      showToast.success(`工作流“${data.name}”已导入`, 'flow')
      navigate(`/flow/editor/${data.id}`)
    },
    onError: (error: Error) => {
      showToast.error(error.message, 'flow')
    },
  })

  const handleCreate = () => {
    if (!newWorkflowName.trim()) return
    createMutation.mutate({ name: newWorkflowName.trim() })
  }

  const handleImport = () => {
    setImportError(null)
    try {
      const parsed = JSON.parse(importJson) as WorkflowExportData
      // Validate basic structure
      if (!parsed.name || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        setImportError('工作流格式无效，必须包含 name、nodes 和 edges。')
        return
      }
      importMutation.mutate(parsed)
    } catch {
      setImportError('JSON 格式无效，请检查工作流数据。')
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setImportJson(content)
      setImportError(null)
    }
    reader.onerror = () => {
      setImportError('读取文件失败')
    }
    reader.readAsText(file)
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工作流</h1>
          <p className="text-muted-foreground">创建和管理自动交易工作流</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            导入
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建工作流
          </Button>
        </div>
      </div>

      {isError ? (
        // Without this branch a failed fetch left workflows undefined and
        // isLoading false, so an expired session or a 500 rendered the cheerful
        // "暂无工作流" empty state - telling the user their workflows were
        // gone. Retries are capped at 1, so this is two requests away.
        <Card className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="mb-2 text-lg font-medium">无法加载工作流</h3>
          <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
            {listError instanceof Error
              ? listError.message
              : '加载工作流时发生错误。'}
          </p>
          <Button onClick={() => refetch()}>重试</Button>
        </Card>
      ) : workflows && workflows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => (
            <WorkflowCard key={workflow.id} workflow={workflow} />
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 rounded-full bg-muted p-4">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-medium">暂无工作流</h3>
          <p className="mb-6 text-center text-sm text-muted-foreground">
            创建第一个工作流，实现自动交易
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            创建工作流
          </Button>
        </Card>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建工作流</DialogTitle>
            <DialogDescription>为工作流命名以开始</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">工作流名称</Label>
              <Input
                id="name"
                placeholder="例如：早盘自动下单"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newWorkflowName.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isImportOpen}
        onOpenChange={(open) => {
          setIsImportOpen(open)
          if (!open) {
            setImportJson('')
            setImportError(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>导入工作流</DialogTitle>
            <DialogDescription>
              从 JSON 文件导入工作流，或粘贴 JSON 数据
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">上传文件</Label>
              <Input
                id="file"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">或粘贴 JSON</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="json">工作流 JSON</Label>
              <Textarea
                id="json"
                placeholder='{"name": "My Workflow", "nodes": [...], "edges": [...]}'
                value={importJson}
                onChange={(e) => {
                  setImportJson(e.target.value)
                  setImportError(null)
                }}
                className="h-40 font-mono text-sm"
              />
              {importError && <p className="text-sm text-destructive">{importError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importJson.trim() || importMutation.isPending}
            >
              {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
