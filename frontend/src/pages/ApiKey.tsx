import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Info,
  Key,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/authStore'
import { showToast } from '@/utils/toast'

async function fetchCSRFToken(): Promise<string> {
  const response = await fetch('/auth/csrf-token', {
    credentials: 'include',
  })
  const data = await response.json()
  return data.csrf_token
}

export default function ApiKey() {
  const { user } = useAuthStore()
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)

  // Order mode state
  const [orderMode, setOrderMode] = useState<'auto' | 'semi_auto'>('auto')
  const [isTogglingMode, setIsTogglingMode] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time API key load on mount; fetchApiKeyData has no reactive inputs
  useEffect(() => {
    fetchApiKeyData()
  }, [])

  const fetchApiKeyData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/apikey', {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })

      if (response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const data = await response.json()
          setApiKey(data.api_key || null)
          setHasApiKey(!!data.api_key)
          setOrderMode(data.order_mode || 'auto')
        } else {
          // Backend returned HTML - this shouldn't happen now
          showToast.error('无法加载 API 密钥，请刷新页面', 'system')
        }
      }
    } catch (_error) {
      showToast.error('无法加载 API 密钥', 'system')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyApiKey = async () => {
    if (apiKey) {
      try {
        await navigator.clipboard.writeText(apiKey)
        showToast.success('API 密钥已复制到剪贴板', 'clipboard')
      } catch {
        showToast.error('复制 API 密钥失败', 'clipboard')
      }
    }
  }

  const handleRegenerateApiKey = async () => {
    setIsRegenerating(true)
    setShowRegenerateDialog(false)

    try {
      const csrfToken = await fetchCSRFToken()

      const response = await fetch('/apikey', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
          user_id: user?.username,
        }),
      })

      const data = await response.json()

      if (data.api_key) {
        setApiKey(data.api_key)
        setHasApiKey(true)
        setShowApiKey(true)
        showToast.success('API 密钥生成成功', 'system')
      } else {
        showToast.error(data.error || '生成 API 密钥失败', 'system')
      }
    } catch (_error) {
      showToast.error('生成 API 密钥失败', 'system')
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleToggleOrderMode = async () => {
    const newMode = orderMode === 'auto' ? 'semi_auto' : 'auto'
    setIsTogglingMode(true)

    try {
      const csrfToken = await fetchCSRFToken()

      const response = await fetch('/apikey/mode', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
          user_id: user?.username,
          mode: newMode,
        }),
      })

      const data = await response.json()

      if (data.mode) {
        setOrderMode(data.mode)
        showToast.success(
          `订单执行模式已切换为${data.mode === 'semi_auto' ? '半自动' : '自动'}`,
          'system'
        )
      } else {
        showToast.error(data.error || '更新订单执行模式失败', 'system')
      }
    } catch (_error) {
      showToast.error('更新订单执行模式失败', 'system')
    } finally {
      setIsTogglingMode(false)
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
    <div className="py-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Key Management Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API 密钥管理
            </CardTitle>
            <CardDescription>
              {hasApiKey
                ? 'API 密钥在创建账户时自动生成。您可以在下方查看，或根据需要重新生成。'
                : '未找到 API 密钥，请生成新密钥。'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API Key Display */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
              <code className="flex-1 font-mono text-sm truncate">
                {hasApiKey
                  ? showApiKey
                    ? apiKey
                    : `${apiKey?.slice(0, 8)}${'•'.repeat(32)}${apiKey?.slice(-8)}`
                  : '尚未生成 API 密钥'}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setShowApiKey(!showApiKey)}
                disabled={!hasApiKey}
                title={showApiKey ? '隐藏 API 密钥' : '显示 API 密钥'}
                aria-label={showApiKey ? '隐藏 API 密钥' : '显示 API 密钥'}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCopyApiKey} disabled={!hasApiKey} size="sm">
                <Copy className="h-4 w-4 mr-2" />
                复制
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRegenerateDialog(true)}
                disabled={isRegenerating}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                {hasApiKey ? '重新生成' : '生成'}
              </Button>
            </div>

            {/* Divider */}
            <div className="border-t pt-6">
              {/* Order Mode Toggle */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">订单执行模式</h3>
                  <p className="text-sm text-muted-foreground">
                    选择自动执行或手动审批。
                  </p>
                </div>

                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <Button
                    variant={orderMode === 'auto' ? 'default' : 'outline'}
                    className={`flex-1 ${orderMode === 'auto' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    onClick={() => orderMode !== 'auto' && handleToggleOrderMode()}
                    disabled={isTogglingMode}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    自动模式
                  </Button>

                  <Button
                    variant={orderMode === 'semi_auto' ? 'default' : 'outline'}
                    className={`flex-1 ${orderMode === 'semi_auto' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`}
                    onClick={() => orderMode !== 'semi_auto' && handleToggleOrderMode()}
                    disabled={isTogglingMode}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    半自动模式
                  </Button>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground px-4">
                  <span>立即执行</span>
                  <span>进入队列等待审批</span>
                </div>

                {/* Current Mode Status */}
                <Alert
                  variant={orderMode === 'semi_auto' ? 'default' : 'default'}
                  className={
                    orderMode === 'semi_auto'
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-green-500 bg-green-500/10'
                  }
                >
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    当前模式：{' '}
                    <strong>{orderMode === 'semi_auto' ? '半自动' : '自动'}</strong>
                    {orderMode === 'semi_auto' ? (
                      <span>
                        {' '}
                        所有订单将进入
                        <Link
                          to="/action-center"
                          className="font-bold underline hover:text-primary"
                        >
                          操作中心
                        </Link>{' '}
                        等待审批
                      </span>
                    ) : (
                      <span>所有订单将立即执行</span>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Playground Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
              </div>
              API 测试工具
            </CardTitle>
            <CardDescription>
              直接在浏览器中测试 OpenAlgo REST API，无需编写代码即可发送请求、查看响应并测试接口。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-3">功能</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  向接口发送 GET/POST 请求
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  显示带语法高亮的 JSON 响应
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  复制响应或 cURL 命令
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-3">使用方法</h3>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>从侧栏选择接口</li>
                <li>按需修改请求内容</li>
                <li>点击发送以执行请求</li>
                <li>查看 JSON 响应</li>
              </ol>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>提示：</strong>使用测试工具时，API 密钥会自动加入请求，无需手动复制。
              </p>
            </div>

            <Button asChild className="w-full sm:w-auto">
              <Link to="/playground">
                <ArrowRight className="h-4 w-4 mr-2" />
                打开测试工具
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hasApiKey ? '重新生成 API 密钥？' : '生成 API 密钥？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hasApiKey
                ? '确定重新生成 API 密钥吗？当前密钥将失效，使用该密钥的应用都需要更新。'
                : '生成新 API 密钥用于验证 API 请求吗？'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateApiKey}>
              {hasApiKey ? '重新生成' : '生成'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
