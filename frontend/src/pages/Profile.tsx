import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Bug,
  Check,
  CheckCircle2,
  Copy,
  FileWarning,
  FolderCheck,
  Key,
  Lock,
  Mail,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  Sun,
  User,
  Volume2,
  VolumeX,
  Wrench,
  X,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { webClient } from '@/api/client'
import TwoFactorEnforcement from '@/components/auth/TwoFactorEnforcement'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type AlertCategories, type ToastPosition, useAlertStore } from '@/stores/alertStore'
import { useAuthStore } from '@/stores/authStore'
import { type ThemeColor, type ThemeMode, useThemeStore } from '@/stores/themeStore'
import { showToast, toast } from '@/utils/toast'

// Professional themes suitable for trading terminals
const THEME_MODES: { value: ThemeMode; label: string; icon: typeof Sun; description: string }[] = [
  {
    value: 'light',
    label: '浅色',
    icon: Sun,
    description: '明亮清晰的界面，适合白天交易',
  },
  {
    value: 'dark',
    label: '深色',
    icon: Moon,
    description: '适合长时间使用，减轻视觉疲劳',
  },
]

// Accent colors for customization
const ACCENT_COLORS: { value: ThemeColor; label: string; color: string }[] = [
  { value: 'zinc', label: '锌灰', color: 'bg-zinc-500' },
  { value: 'slate', label: '石板灰', color: 'bg-slate-500' },
  { value: 'gray', label: '灰色', color: 'bg-gray-500' },
  { value: 'neutral', label: '中性灰', color: 'bg-neutral-500' },
  { value: 'green', label: '绿色', color: 'bg-green-500' },
  { value: 'blue', label: '蓝色', color: 'bg-blue-500' },
  { value: 'violet', label: '紫色', color: 'bg-violet-500' },
  { value: 'orange', label: '橙色', color: 'bg-orange-500' },
]

interface ProfileData {
  username: string
  smtp_settings: {
    smtp_server: string
    smtp_port: number
    smtp_username: string
    smtp_password: boolean
    smtp_use_tls: boolean
    smtp_from_email: string
    smtp_helo_hostname: string
  } | null
  qr_code: string | null
  totp_secret: string | null
}

interface PasswordRequirements {
  length: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  special: boolean
}

interface BrokerCredentials {
  broker_api_key: string
  broker_api_key_raw_length: number
  broker_api_secret: string
  broker_api_secret_raw_length: number
  broker_api_key_market: string
  broker_api_key_market_raw_length: number
  broker_api_secret_market: string
  broker_api_secret_market_raw_length: number
  redirect_url: string
  current_broker: string
  valid_brokers: string[]
  ngrok_allow: boolean
  host_server: string
  websocket_url: string
  server_status?: {
    flask: { host: string; port: string }
    websocket: { host: string; port: string }
    zmq: { host: string; port: string }
  }
}

interface PermissionCheck {
  path: string
  full_path: string
  description: string
  exists: boolean
  expected_mode: string
  expected_rwx: string
  actual_mode: string | null
  actual_rwx: string | null
  is_correct: boolean
  is_sensitive: boolean
  is_directory?: boolean
  issue: string | null
  warning: string | null
}

interface PermissionsData {
  platform: string
  base_path: string
  is_windows: boolean
  all_correct: boolean
  checks: PermissionCheck[]
}

// Toast position options
const TOAST_POSITIONS: { value: ToastPosition; label: string }[] = [
  { value: 'top-left', label: '左上' },
  { value: 'top-center', label: '顶部居中' },
  { value: 'top-right', label: '右上' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-center', label: '底部居中' },
  { value: 'bottom-right', label: '右下' },
]

// Alert category descriptions - organized by groups
const ALERT_CATEGORIES_REALTIME: {
  key: keyof AlertCategories
  label: string
  description: string
}[] = [
  {
    key: 'orders',
    label: '订单通知',
    description: '实时买卖订单的下单、撤单和修改通知',
  },
  {
    key: 'analyzer',
    label: '模拟盘模式',
    description: '模拟盘模式操作的实时通知',
  },
  {
    key: 'system',
    label: '系统通知',
    description: '密码更改、合约数据下载和系统事件',
  },
  {
    key: 'actionCenter',
    label: '操作中心',
    description: '半自动模式下待审批订单的通知',
  },
]

const ALERT_CATEGORIES_TRADING: {
  key: keyof AlertCategories
  label: string
  description: string
}[] = [
  {
    key: 'positions',
    label: '持仓',
    description: '持仓平仓、更新及盈亏通知',
  },
  {
    key: 'chartink',
    label: 'Chartink',
    description: 'Chartink 策略操作和扫描器集成',
  },
]

const ALERT_CATEGORIES_DATA: {
  key: keyof AlertCategories
  label: string
  description: string
}[] = [
  {
    key: 'historify',
    label: 'Historify',
    description: '历史数据任务、文件上传下载和计划',
  },
  {
    key: 'pythonStrategy',
    label: 'Python 策略',
    description: 'Python 策略上传、执行、日志和计划',
  },
  {
    key: 'flow',
    label: '流程工作流',
    description: '可视化工作流的创建、执行和管理',
  },
]

const ALERT_CATEGORIES_ADMIN: {
  key: keyof AlertCategories
  label: string
  description: string
}[] = [
  {
    key: 'telegram',
    label: 'Telegram 机器人',
    description: 'Telegram 机器人操作、广播和用户管理',
  },
  {
    key: 'admin',
    label: '管理面板',
    description: '交易时间、节假日、冻结数量和管理设置',
  },
  {
    key: 'monitoring',
    label: '监控',
    description: '健康监控、延迟面板和安全通知',
  },
  {
    key: 'clipboard',
    label: '剪贴板',
    description: '复制到剪贴板的确认通知',
  },
]

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const { mode, color, appMode, setMode, setColor } = useThemeStore()
  const alertStore = useAlertStore()
  const [activeTab, setActiveTab] = useState('account')
  const [isLoading, setIsLoading] = useState(true)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)

  // Password form state
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirements>({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // SMTP form state
  const [smtpServer, setSmtpServer] = useState('smtp.gmail.com')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUsername, setSmtpUsername] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpFromEmail, setSmtpFromEmail] = useState('')
  const [smtpHeloHostname, setSmtpHeloHostname] = useState('smtp.gmail.com')
  const [smtpUseTls, setSmtpUseTls] = useState(true)
  const [isSavingSmtp, setIsSavingSmtp] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [isDebugging, setIsDebugging] = useState(false)
  const [debugResult, setDebugResult] = useState<{
    success: boolean
    message: string
    details?: string[]
  } | null>(null)

  // Broker credentials state
  const [brokerCredentials, setBrokerCredentials] = useState<BrokerCredentials | null>(null)
  const [brokerApiKey, setBrokerApiKey] = useState('')
  const [brokerApiSecret, setBrokerApiSecret] = useState('')
  const [brokerApiKeyMarket, setBrokerApiKeyMarket] = useState('')
  const [brokerApiSecretMarket, setBrokerApiSecretMarket] = useState('')
  const [selectedBroker, setSelectedBroker] = useState('')
  const [ngrokEnabled, setNgrokEnabled] = useState(false)
  const [hostServer, setHostServer] = useState('')
  const [websocketUrl, setWebsocketUrl] = useState('')
  const [isSavingBroker, setIsSavingBroker] = useState(false)
  const [isSavingNgrok, setIsSavingNgrok] = useState(false)
  const [showRestartDialog, setShowRestartDialog] = useState(false)

  // Permissions state
  const [permissionsData, setPermissionsData] = useState<PermissionsData | null>(null)
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false)
  const [isFixingPermissions, setIsFixingPermissions] = useState(false)

  // Check if in analyzer mode (theme changes blocked)
  const isAnalyzerMode = appMode === 'analyzer'

  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time data load on mount; fetchProfileData/fetchBrokerCredentials are stable per-render fetchers and must not refire when their closures are recreated.
  useEffect(() => {
    fetchProfileData()
    fetchBrokerCredentials()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchProfileData = async () => {
    try {
      const response = await webClient.get<{ status: string; data: ProfileData }>(
        '/auth/profile-data'
      )
      if (response.data.status === 'success') {
        setProfileData(response.data.data)

        // Populate SMTP form with existing settings
        const smtp = response.data.data.smtp_settings
        if (smtp) {
          setSmtpServer(smtp.smtp_server || 'smtp.gmail.com')
          setSmtpPort(String(smtp.smtp_port || 587))
          setSmtpUsername(smtp.smtp_username || '')
          setSmtpFromEmail(smtp.smtp_from_email || '')
          setSmtpHeloHostname(smtp.smtp_helo_hostname || 'smtp.gmail.com')
          setSmtpUseTls(smtp.smtp_use_tls !== false)
          setTestEmail(smtp.smtp_username || '')
        }
      }
    } catch (_error) {
      showToast.error('加载个人资料失败', 'admin')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchBrokerCredentials = async () => {
    try {
      const response = await webClient.get<{ status: string; data: BrokerCredentials }>(
        '/api/broker/credentials'
      )
      if (response.data.status === 'success') {
        setBrokerCredentials(response.data.data)
        setSelectedBroker(response.data.data.current_broker)
        setNgrokEnabled(response.data.data.ngrok_allow)
        setHostServer(response.data.data.host_server)
        setWebsocketUrl(response.data.data.websocket_url || '')
      }
    } catch (_error) {}
  }

  const fetchPermissions = async () => {
    setIsLoadingPermissions(true)
    try {
      const response = await webClient.get<{ status: string; data: PermissionsData }>(
        '/api/system/permissions'
      )
      if (response.data.status === 'success') {
        setPermissionsData(response.data.data)
      }
    } catch (_error) {
      showToast.error('加载权限状态失败', 'admin')
    } finally {
      setIsLoadingPermissions(false)
    }
  }

  const handleFixPermissions = async () => {
    setIsFixingPermissions(true)
    try {
      const response = await webClient.post<{
        status: string
        data: {
          fixed: Array<{ path: string; action: string }>
          failed: Array<{ path: string; error: string }>
          message: string
        }
      }>('/api/system/permissions/fix')

      if (response.data.status === 'success') {
        const { fixed, failed, message } = response.data.data
        if (fixed.length > 0) {
          showToast.success(`Fixed ${fixed.length} permission issues`, 'admin')
        }
        if (failed.length > 0) {
          showToast.warning(`${failed.length} issues could not be fixed automatically`, 'admin')
        }
        if (fixed.length === 0 && failed.length === 0) {
          showToast.info(message, 'admin')
        }
        // Refresh permissions after fix
        await fetchPermissions()
      } else {
        showToast.error('修复权限失败', 'admin')
      }
    } catch (_error) {
      showToast.error('修复权限失败', 'admin')
    } finally {
      setIsFixingPermissions(false)
    }
  }

  const getRedirectUrl = (broker: string): string => {
    // Extract host from current redirect URL or use default
    const currentUrl = brokerCredentials?.redirect_url || 'http://127.0.0.1:5000'
    const match = currentUrl.match(/^(https?:\/\/[^/]+)/)
    const host = match ? match[1] : 'http://127.0.0.1:5000'
    return `${host}/${broker}/callback`
  }

  const handleBrokerSave = async () => {
    setIsSavingBroker(true)
    try {
      const formData = new FormData()
      if (brokerApiKey) formData.append('broker_api_key', brokerApiKey)
      if (brokerApiSecret) formData.append('broker_api_secret', brokerApiSecret)
      if (brokerApiKeyMarket) formData.append('broker_api_key_market', brokerApiKeyMarket)
      if (brokerApiSecretMarket) formData.append('broker_api_secret_market', brokerApiSecretMarket)
      if (selectedBroker && selectedBroker !== brokerCredentials?.current_broker) {
        formData.append('redirect_url', getRedirectUrl(selectedBroker))
      }

      const response = await webClient.post<{
        status: string
        message: string
        restart_required?: boolean
      }>('/api/broker/credentials', formData)

      if (response.data.status === 'success') {
        showToast.success(response.data.message, 'admin')
        // Update local state to reflect saved values (don't re-fetch since env vars won't update until restart)
        if (brokerCredentials) {
          setBrokerCredentials({
            ...brokerCredentials,
            current_broker: selectedBroker || brokerCredentials.current_broker,
            redirect_url:
              selectedBroker !== brokerCredentials.current_broker
                ? getRedirectUrl(selectedBroker)
                : brokerCredentials.redirect_url,
            // Update masked values to show something was changed.
            // Use a FIXED-length mask (prefix + 8 asterisks) so the rendered
            // value cannot leak the secret's true length and cannot overflow
            // the column layout. Mirrors blueprints/broker_credentials.py:mask_secret.
            broker_api_key: brokerApiKey
              ? `${brokerApiKey.slice(0, 6)}${'*'.repeat(8)}`
              : brokerCredentials.broker_api_key,
            broker_api_key_raw_length: brokerApiKey
              ? brokerApiKey.length
              : brokerCredentials.broker_api_key_raw_length,
            broker_api_secret: brokerApiSecret
              ? `${brokerApiSecret.slice(0, 4)}${'*'.repeat(8)}`
              : brokerCredentials.broker_api_secret,
            broker_api_secret_raw_length: brokerApiSecret
              ? brokerApiSecret.length
              : brokerCredentials.broker_api_secret_raw_length,
          })
        }
        // Clear form fields
        setBrokerApiKey('')
        setBrokerApiSecret('')
        setBrokerApiKeyMarket('')
        setBrokerApiSecretMarket('')
        // Show restart dialog
        setShowRestartDialog(true)
      } else {
        showToast.error(response.data.message || '保存凭据失败', 'admin')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      showToast.error(err.response?.data?.message || '保存交易商凭据失败', 'admin')
    } finally {
      setIsSavingBroker(false)
    }
  }

  const hasCredentialChanges = Boolean(
    brokerApiKey ||
      brokerApiSecret ||
      brokerApiKeyMarket ||
      brokerApiSecretMarket ||
      (selectedBroker && selectedBroker !== brokerCredentials?.current_broker)
  )

  const hasNgrokChanges = Boolean(
    ngrokEnabled !== brokerCredentials?.ngrok_allow ||
      (hostServer && hostServer !== brokerCredentials?.host_server) ||
      (websocketUrl && websocketUrl !== brokerCredentials?.websocket_url)
  )

  const handleNgrokSave = async () => {
    setIsSavingNgrok(true)
    try {
      // Send as JSON for more reliable handling
      const payload: {
        ngrok_allow: string
        host_server?: string
        websocket_url?: string
      } = {
        ngrok_allow: ngrokEnabled ? 'TRUE' : 'FALSE',
      }
      if (hostServer) {
        payload.host_server = hostServer
      }
      if (websocketUrl) {
        payload.websocket_url = websocketUrl
      }

      const response = await webClient.post<{
        status: string
        message: string
        restart_required?: boolean
      }>('/api/broker/credentials', payload)

      if (response.data.status === 'success') {
        showToast.success(response.data.message, 'admin')
        // Update local brokerCredentials state to reflect saved values
        // Don't re-fetch from server since env vars won't update until restart
        if (brokerCredentials) {
          setBrokerCredentials({
            ...brokerCredentials,
            ngrok_allow: ngrokEnabled,
            host_server: hostServer || brokerCredentials.host_server,
            websocket_url: websocketUrl || brokerCredentials.websocket_url,
          })
        }
        // Show restart dialog
        setShowRestartDialog(true)
      } else {
        showToast.error(response.data.message || '保存设置失败', 'admin')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      showToast.error(err.response?.data?.message || '保存设置失败', 'admin')
    } finally {
      setIsSavingNgrok(false)
    }
  }

  // Password validation
  const checkPasswordRequirements = useCallback((password: string) => {
    const requirements: PasswordRequirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*]/.test(password),
    }
    setPasswordRequirements(requirements)
    return Object.values(requirements).every(Boolean)
  }, [])

  useEffect(() => {
    checkPasswordRequirements(newPassword)
  }, [newPassword, checkPasswordRequirements])

  const getPasswordStrength = () => {
    const metCount = Object.values(passwordRequirements).filter(Boolean).length
    if (metCount === 0) return { percentage: 0, label: '无', color: 'bg-gray-400' }
    if (metCount <= 2) return { percentage: 40, label: '弱', color: 'bg-red-500' }
    if (metCount <= 3) return { percentage: 60, label: '一般', color: 'bg-yellow-500' }
    if (metCount <= 4) return { percentage: 80, label: '良好', color: 'bg-blue-500' }
    return { percentage: 100, label: '强', color: 'bg-green-500' }
  }

  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== ''
  const meetsAllRequirements = Object.values(passwordRequirements).every(Boolean)
  const canSubmitPassword = passwordsMatch && meetsAllRequirements && oldPassword !== ''

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmitPassword) return

    setIsChangingPassword(true)
    try {
      const formData = new FormData()
      formData.append('old_password', oldPassword)
      formData.append('new_password', newPassword)
      formData.append('confirm_password', confirmPassword)

      const response = await webClient.post<{ status: string; message: string }>(
        '/auth/change-password',
        formData
      )

      if (response.data.status === 'success') {
        showToast.success(response.data.message || '密码修改成功', 'system')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        showToast.error(response.data.message || '修改密码失败', 'system')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      showToast.error(err.response?.data?.message || '修改密码失败', 'system')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingSmtp(true)
    try {
      const formData = new FormData()
      formData.append('smtp_server', smtpServer)
      formData.append('smtp_port', smtpPort)
      formData.append('smtp_username', smtpUsername)
      if (smtpPassword) {
        formData.append('smtp_password', smtpPassword)
      }
      formData.append('smtp_from_email', smtpFromEmail)
      formData.append('smtp_helo_hostname', smtpHeloHostname)
      if (smtpUseTls) {
        formData.append('smtp_use_tls', 'on')
      }

      const response = await webClient.post<{ status: string; message: string }>(
        '/auth/smtp-config',
        formData
      )

      if (response.data.status === 'success') {
        showToast.success(response.data.message || 'SMTP 设置已保存', 'admin')
        setSmtpPassword('') // Clear password field after save
      } else {
        showToast.error(response.data.message || '保存 SMTP 设置失败', 'admin')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      showToast.error(err.response?.data?.message || '保存 SMTP 设置失败', 'admin')
    } finally {
      setIsSavingSmtp(false)
    }
  }

  const handleTestEmail = async () => {
    if (!testEmail) {
      showToast.error('请输入用于测试的邮箱地址', 'admin')
      return
    }

    setIsSendingTest(true)
    setDebugResult(null)
    try {
      const formData = new FormData()
      formData.append('test_email', testEmail)

      const response = await webClient.post<{ success: boolean; message: string }>(
        '/auth/test-smtp',
        formData
      )

      if (response.data.success) {
        showToast.success(response.data.message || '测试邮件已发送', 'admin')
      } else {
        showToast.error(response.data.message || '发送测试邮件失败', 'admin')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      showToast.error(err.response?.data?.message || '发送测试邮件失败', 'admin')
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleDebugSmtp = async () => {
    setIsDebugging(true)
    setDebugResult(null)
    try {
      const response = await webClient.post<{
        success: boolean
        message: string
        details?: string[]
      }>('/auth/debug-smtp', {})
      setDebugResult(response.data)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      setDebugResult({
        success: false,
        message: err.response?.data?.message || 'Failed to debug SMTP',
        details: [],
      })
    } finally {
      setIsDebugging(false)
    }
  }

  const handleThemeModeChange = (newMode: ThemeMode) => {
    if (isAnalyzerMode) {
      showToast.error('分析模式下无法更改主题', 'system')
      return
    }
    setMode(newMode)
    showToast.success(`Theme changed to ${newMode}`, 'system')
  }

  const handleAccentColorChange = (newColor: ThemeColor) => {
    if (isAnalyzerMode) {
      showToast.error('分析模式下无法更改主题', 'system')
      return
    }
    setColor(newColor)
    showToast.success(`Accent color changed to ${newColor}`, 'system')
  }

  const handleResetTheme = () => {
    if (isAnalyzerMode) {
      showToast.error('分析模式下无法更改主题', 'system')
      return
    }
    setMode('light')
    setColor('zinc')
    showToast.success('主题已恢复默认', 'system')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast.success('已复制到剪贴板', 'clipboard')
      })
      .catch(() => {
        showToast.error('复制失败', 'clipboard')
      })
  }

  const strength = getPasswordStrength()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="py-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" />
            个人设置
          </h1>
        </div>
        <p className="text-muted-foreground">
          管理账户设置和安全选项
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value)
          // Fetch permissions when tab is selected
          if (value === 'permissions' && !permissionsData) {
            fetchPermissions()
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="account" className="gap-1">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">账户</span>
          </TabsTrigger>
          <TabsTrigger value="broker" className="gap-1">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">券商</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">通知</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1">
            <FolderCheck className="h-4 w-4" />
            <span className="hidden sm:inline">系统</span>
          </TabsTrigger>
          <TabsTrigger value="theme" className="gap-1">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">主题</span>
          </TabsTrigger>
          <TabsTrigger value="smtp" className="gap-1">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">SMTP</span>
          </TabsTrigger>
          <TabsTrigger value="totp" className="gap-1">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">TOTP</span>
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>账户信息</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>用户名</Label>
                <Input value={user?.username || profileData?.username || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>账户类型</Label>
                <div className="pt-2">
                  <Badge>管理员</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle>修改密码</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label>当前密码</Label>
                  <Input
                    type="password"
                    placeholder="请输入当前密码"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>新密码</Label>
                  <Input
                    type="password"
                    placeholder="请输入新密码"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>确认新密码</Label>
                  <Input
                    type="password"
                    placeholder="请再次输入新密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {confirmPassword && (
                    <p className={`text-sm ${passwordsMatch ? 'text-green-500' : 'text-red-500'}`}>
                      {passwordsMatch ? '两次密码一致' : '两次密码不一致'}
                    </p>
                  )}
                </div>

                {/* Password Strength */}
                <div className="bg-muted rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>密码强度</span>
                    <span className="font-medium">{strength.label}</span>
                  </div>
                  <Progress value={strength.percentage} className={strength.color} />

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(passwordRequirements).map(([key, met]) => (
                      <div
                        key={key}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full border ${
                          met
                            ? 'bg-green-500/10 border-green-500 text-green-600'
                            : 'bg-muted border-border text-muted-foreground'
                        }`}
                      >
                        {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>
                          {key === 'length' && '至少 8 个字符'}
                          {key === 'uppercase' && 'A-Z'}
                          {key === 'lowercase' && 'a-z'}
                          {key === 'number' && '0-9'}
                          {key === 'special' && '特殊字符（@#$%^&*）'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button type="submit" disabled={!canSubmitPassword || isChangingPassword}>
                  {isChangingPassword ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      修改中…
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      修改密码
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Broker Tab */}
        <TabsContent value="broker" className="space-y-6">
          <Alert>
            <Key className="h-4 w-4" />
            <AlertTitle>券商 API 凭据</AlertTitle>
            <AlertDescription>
              更新券商 API 凭据后，需重启应用才能生效。保存后您将退出登录。
            </AlertDescription>
          </Alert>

          {/* Current Broker */}
          <Card>
            <CardHeader>
              <CardTitle>当前配置</CardTitle>
              <CardDescription>当前配置的券商和凭据</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>当前券商</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-base">
                      {brokerCredentials?.current_broker?.toUpperCase() || '未配置'}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>重定向地址</Label>
                  <code className="text-xs text-muted-foreground break-all">
                    {brokerCredentials?.redirect_url || '未配置'}
                  </code>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2 min-w-0">
                  <Label>API 密钥</Label>
                  {/* block truncate clamps long masked values to their column;
                      backend mask is fixed-length but defence-in-depth in case
                      a future change emits a longer string. */}
                  <code className="block truncate text-xs text-muted-foreground">
                    {brokerCredentials?.broker_api_key || '（未设置）'}
                  </code>
                </div>
                <div className="space-y-2 min-w-0">
                  <Label>API 密钥（Secret）</Label>
                  <code className="block truncate text-xs text-muted-foreground">
                    {brokerCredentials?.broker_api_secret || '（未设置）'}
                  </code>
                </div>
              </div>
              {(brokerCredentials?.broker_api_key_market_raw_length ?? 0) > 0 && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2 min-w-0">
                    <Label>行情 API 密钥</Label>
                    <code className="block truncate text-xs text-muted-foreground">
                      {brokerCredentials?.broker_api_key_market || '（未设置）'}
                    </code>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label>行情 API 密钥（Secret）</Label>
                    <code className="block truncate text-xs text-muted-foreground">
                      {brokerCredentials?.broker_api_secret_market || '（未设置）'}
                    </code>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label>Ngrok 状态</Label>
                  <Badge variant={brokerCredentials?.ngrok_allow ? 'default' : 'secondary'}>
                    {brokerCredentials?.ngrok_allow ? '已启用' : '已禁用'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label>服务器地址</Label>
                  <code className="text-xs text-muted-foreground break-all">
                    {brokerCredentials?.host_server || '（未设置）'}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Update Credentials */}
          <Card>
            <CardHeader>
              <CardTitle>更新凭据</CardTitle>
              <CardDescription>
                填写新值以更新，留空则保留现有值。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Broker Selection */}
              <div className="space-y-2">
                <Label>选择券商</Label>
                <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择券商" />
                  </SelectTrigger>
                  <SelectContent>
                    {brokerCredentials?.valid_brokers.map((broker) => (
                      <SelectItem key={broker} value={broker}>
                        {broker.charAt(0).toUpperCase() + broker.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBroker && selectedBroker !== brokerCredentials?.current_broker && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    将券商更改为：{selectedBroker.toUpperCase()}
                  </p>
                )}
              </div>

              {/* API Credentials */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>券商 API 密钥</Label>
                  <Input
                    type="password"
                    value={brokerApiKey}
                    onChange={(e) => setBrokerApiKey(e.target.value)}
                    placeholder="输入新的 API 密钥"
                  />
                  <p className="text-xs text-muted-foreground">
                    {(brokerCredentials?.broker_api_key_raw_length ?? 0) > 0
                      ? `当前：${brokerCredentials?.broker_api_key_raw_length} 个字符`
                      : '当前未设置'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>券商 API 密钥（Secret）</Label>
                  <Input
                    type="password"
                    value={brokerApiSecret}
                    onChange={(e) => setBrokerApiSecret(e.target.value)}
                    placeholder="输入新的 API 密钥（Secret）"
                  />
                  <p className="text-xs text-muted-foreground">
                    {(brokerCredentials?.broker_api_secret_raw_length ?? 0) > 0
                      ? `当前：${brokerCredentials?.broker_api_secret_raw_length} 个字符`
                      : '当前未设置'}
                  </p>
                </div>
              </div>

              {/* Market API Credentials (optional) */}
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">行情 API（可选）</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  仅使用支持 XTS API 的券商时需要（如 5paisa XTS、Jainam XTS）。
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>行情 API 密钥</Label>
                    <Input
                      type="password"
                      value={brokerApiKeyMarket}
                      onChange={(e) => setBrokerApiKeyMarket(e.target.value)}
                      placeholder="输入行情 API 密钥"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>行情 API 密钥（Secret）</Label>
                    <Input
                      type="password"
                      value={brokerApiSecretMarket}
                      onChange={(e) => setBrokerApiSecretMarket(e.target.value)}
                      placeholder="输入行情 API 密钥（Secret）"
                    />
                  </div>
                </div>
              </div>

              {/* Broker-specific hints */}
              {selectedBroker === 'fivepaisa' && (
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>5paisa API 密钥格式</AlertTitle>
                  <AlertDescription>
                    格式：<code>User_Key:::User_ID:::client_id</code>
                  </AlertDescription>
                </Alert>
              )}
              {selectedBroker === 'flattrade' && (
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Flattrade API 密钥格式</AlertTitle>
                  <AlertDescription>
                    格式：<code>client_id:::api_key</code>
                  </AlertDescription>
                </Alert>
              )}
              {selectedBroker === 'dhan' && (
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Dhan API 密钥格式</AlertTitle>
                  <AlertDescription>
                    格式：<code>client_id:::api_key</code>
                  </AlertDescription>
                </Alert>
              )}
              {selectedBroker === 'indmoney' && (
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>IndMoney 凭据</AlertTitle>
                  <AlertDescription>
                    <p>
                      <strong>API 密钥</strong>: the <code>客户端 ID</code> shown at indstocks.com
                      &gt; API Trading &gt; Access Tokens after you set up TOTP.
                    </p>
                    <p className="mt-1">
                      <strong>API 密钥（Secret）</strong>: leave blank to log in with MPIN + TOTP
                      (recommended). If you paste an access token here instead, it is used as-is and
                      the TOTP flow is skipped - you must regenerate it every 24 hours.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Save Button */}
              <Button
                onClick={handleBrokerSave}
                disabled={!hasCredentialChanges || isSavingBroker}
                className="w-full"
              >
                {isSavingBroker ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    保存中…
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    保存券商凭据
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Server Status Card */}
          {brokerCredentials?.server_status && (
            <Card>
              <CardHeader>
                <CardTitle>服务器状态</CardTitle>
                <CardDescription>正在运行的服务及配置端口</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                    <Badge variant="default" className="mb-2 bg-green-600">
                      运行中
                    </Badge>
                    <span className="text-sm font-medium">Flask 应用</span>
                    <span className="text-xs text-muted-foreground">
                      {brokerCredentials.server_status.flask.host}:
                      {brokerCredentials.server_status.flask.port}
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                    <Badge variant="default" className="mb-2 bg-green-600">
                      运行中
                    </Badge>
                    <span className="text-sm font-medium">WebSocket</span>
                    <span className="text-xs text-muted-foreground">
                      {brokerCredentials.server_status.websocket.host}:
                      {brokerCredentials.server_status.websocket.port}
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                    <Badge variant="default" className="mb-2 bg-green-600">
                      运行中
                    </Badge>
                    <span className="text-sm font-medium">ZeroMQ</span>
                    <span className="text-xs text-muted-foreground">
                      {brokerCredentials.server_status.zmq.host}:
                      {brokerCredentials.server_status.zmq.port}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ngrok Configuration - Separate Card */}
          <Card>
            <CardHeader>
              <CardTitle>服务器配置</CardTitle>
              <CardDescription>
                配置 ngrok，以接收来自 TradingView、Chartink、GoCharting 等外部服务的 Webhook 警报。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ngrok_enabled"
                  checked={ngrokEnabled}
                  onCheckedChange={(checked) => setNgrokEnabled(checked === true)}
                />
                <Label htmlFor="ngrok_enabled">启用 Ngrok 隧道</Label>
                {ngrokEnabled !== brokerCredentials?.ngrok_allow && (
                  <Badge variant="outline" className="text-yellow-600">
                    已修改
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label>服务器地址</Label>
                <Input
                  value={hostServer}
                  onChange={(e) => setHostServer(e.target.value)}
                  placeholder="https://your-domain.ngrok-free.app"
                />
                <p className="text-xs text-muted-foreground">
                  用于接收 Webhook 的 ngrok 域名或自定义域名。
                </p>
                {hostServer !== brokerCredentials?.host_server && hostServer && (
                  <Badge variant="outline" className="text-yellow-600">
                    原地址：{brokerCredentials?.host_server}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label>WebSocket 地址</Label>
                <Input
                  value={websocketUrl}
                  onChange={(e) => setWebsocketUrl(e.target.value)}
                  placeholder="ws://127.0.0.1:8765"
                />
                <p className="text-xs text-muted-foreground">
                  用于实时行情推送的 WebSocket 服务器地址。
                </p>
                {websocketUrl !== brokerCredentials?.websocket_url && websocketUrl && (
                  <Badge variant="outline" className="text-yellow-600">
                    原地址：{brokerCredentials?.websocket_url}
                  </Badge>
                )}
              </div>

              <Button
                onClick={handleNgrokSave}
                disabled={!hasNgrokChanges || isSavingNgrok}
                className="w-full"
              >
                {isSavingNgrok ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    保存中…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    保存 Ngrok 设置
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertTitle>弹窗通知设置</AlertTitle>
            <AlertDescription>
              设置弹窗通知的显示方式，减少运行多个策略时的通知干扰。
            </AlertDescription>
          </Alert>

          {/* Master Controls */}
          <Card>
            <CardHeader>
              <CardTitle>总开关</CardTitle>
              <CardDescription>
                启用或关闭所有弹窗通知和提示音
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Toasts Enabled */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="toasts-enabled">弹窗通知</Label>
                  <p className="text-sm text-muted-foreground">
                    发生事件时显示弹窗通知
                  </p>
                </div>
                <Switch
                  id="toasts-enabled"
                  checked={alertStore.toastsEnabled}
                  onCheckedChange={alertStore.setToastsEnabled}
                />
              </div>

              {/* Sound Enabled */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sound-enabled" className="flex items-center gap-2">
                    {alertStore.soundEnabled ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )}
                    声音提醒
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    重要事件发生时播放提示音
                  </p>
                </div>
                <Switch
                  id="sound-enabled"
                  checked={alertStore.soundEnabled}
                  onCheckedChange={alertStore.setSoundEnabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* Display Settings */}
          <Card className={!alertStore.toastsEnabled ? 'opacity-60' : ''}>
            <CardHeader>
              <CardTitle>显示设置</CardTitle>
              <CardDescription>自定义通知外观和行为</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Position */}
              <div className="space-y-2">
                <Label>通知位置</Label>
                <Select
                  value={alertStore.position}
                  onValueChange={(value) => alertStore.setPosition(value as ToastPosition)}
                  disabled={!alertStore.toastsEnabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择位置" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOAST_POSITIONS.map((pos) => (
                      <SelectItem key={pos.value} value={pos.value}>
                        {pos.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Max Visible Toasts */}
              <div className="space-y-2">
                <Label>最多同时显示通知数</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={alertStore.maxVisibleToasts}
                    onChange={(e) => alertStore.setMaxVisibleToasts(Number(e.target.value))}
                    disabled={!alertStore.toastsEnabled}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    （1–10）超出的通知将排队显示
                  </span>
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label>自动关闭时间</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min={1}
                    max={15}
                    value={alertStore.duration / 1000}
                    onChange={(e) => alertStore.setDuration(Number(e.target.value) * 1000)}
                    disabled={!alertStore.toastsEnabled}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">秒（1–15）</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Controls - Real-time (Socket.IO) */}
          <Card className={!alertStore.toastsEnabled ? 'opacity-60' : ''}>
            <CardHeader>
              <CardTitle>实时通知</CardTitle>
              <CardDescription>
                来自 Socket.IO 事件的高频通知。交易频繁时可关闭，以减少通知干扰。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ALERT_CATEGORIES_REALTIME.map((category) => (
                <div
                  key={category.key}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="space-y-0.5">
                    <Label htmlFor={`category-${category.key}`}>{category.label}</Label>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                  <Switch
                    id={`category-${category.key}`}
                    checked={alertStore.categories[category.key]}
                    onCheckedChange={(checked) =>
                      alertStore.setCategoryEnabled(category.key, checked)
                    }
                    disabled={!alertStore.toastsEnabled}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Category Controls - Trading */}
          <Card className={!alertStore.toastsEnabled ? 'opacity-60' : ''}>
            <CardHeader>
              <CardTitle>交易操作</CardTitle>
              <CardDescription>
                来自持仓管理、策略和 Chartink 集成的通知
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ALERT_CATEGORIES_TRADING.map((category) => (
                <div
                  key={category.key}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="space-y-0.5">
                    <Label htmlFor={`category-${category.key}`}>{category.label}</Label>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                  <Switch
                    id={`category-${category.key}`}
                    checked={alertStore.categories[category.key]}
                    onCheckedChange={(checked) =>
                      alertStore.setCategoryEnabled(category.key, checked)
                    }
                    disabled={!alertStore.toastsEnabled}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Category Controls - Data & Automation */}
          <Card className={!alertStore.toastsEnabled ? 'opacity-60' : ''}>
            <CardHeader>
              <CardTitle>数据与自动化</CardTitle>
              <CardDescription>
                来自历史数据、Python 策略和自动化工作流的通知
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ALERT_CATEGORIES_DATA.map((category) => (
                <div
                  key={category.key}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="space-y-0.5">
                    <Label htmlFor={`category-${category.key}`}>{category.label}</Label>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                  <Switch
                    id={`category-${category.key}`}
                    checked={alertStore.categories[category.key]}
                    onCheckedChange={(checked) =>
                      alertStore.setCategoryEnabled(category.key, checked)
                    }
                    disabled={!alertStore.toastsEnabled}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Category Controls - Admin & System */}
          <Card className={!alertStore.toastsEnabled ? 'opacity-60' : ''}>
            <CardHeader>
              <CardTitle>管理与工具</CardTitle>
              <CardDescription>
                来自管理面板、Telegram 机器人、监控和剪贴板操作的通知
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ALERT_CATEGORIES_ADMIN.map((category) => (
                <div
                  key={category.key}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="space-y-0.5">
                    <Label htmlFor={`category-${category.key}`}>{category.label}</Label>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                  <Switch
                    id={`category-${category.key}`}
                    checked={alertStore.categories[category.key]}
                    onCheckedChange={(checked) =>
                      alertStore.setCategoryEnabled(category.key, checked)
                    }
                    disabled={!alertStore.toastsEnabled}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>操作</CardTitle>
              <CardDescription>测试和管理通知</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    toast.success('这是一条测试成功通知')
                  }}
                  disabled={!alertStore.toastsEnabled}
                >
                  测试通知
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    toast.dismiss()
                    toast.success('已清除所有通知')
                  }}
                >
                  清除所有通知
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    alertStore.resetToDefaults()
                    toast.success('设置已恢复默认值')
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  恢复默认设置
                </Button>
              </div>

              {/* Current Settings Summary */}
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">当前配置</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">通知：</span>
                  <span>{alertStore.toastsEnabled ? '已启用' : '已禁用'}</span>
                  <span className="text-muted-foreground">声音：</span>
                  <span>{alertStore.soundEnabled ? '已启用' : '已禁用'}</span>
                  <span className="text-muted-foreground">位置：</span>
                  <span className="capitalize">{TOAST_POSITIONS.find((pos) => pos.value === alertStore.position)?.label ?? alertStore.position}</span>
                  <span className="text-muted-foreground">最多显示：</span>
                  <span>{alertStore.maxVisibleToasts} 条</span>
                  <span className="text-muted-foreground">持续时间：</span>
                  <span>{alertStore.duration / 1000} seconds</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Help Card */}
          <Card>
            <CardHeader>
              <CardTitle>通知类别说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-4">
              <div>
                <p className="font-medium text-foreground mb-2">
                  实时通知（高优先级）
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <strong>订单：</strong>来自 Socket.IO 的买卖通知，交易期间频率较高。
                  </li>
                  <li>
                    <strong>模拟盘：</strong>模拟盘操作通知，模拟交易期间可能较频繁。
                  </li>
                  <li>
                    <strong>系统：</strong>密码更改、合约数据等重要通知，频率较低。
                  </li>
                  <li>
                    <strong>操作中心：</strong>半自动模式下待审批订单的通知。
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-2">交易操作</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <strong>持仓：</strong>平仓和持仓更新通知。
                  </li>
                  <li>
                    <strong>Chartink：</strong>扫描器和策略集成通知。
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-2">数据与自动化</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <strong>Historify：</strong>历史数据任务及文件上传、下载通知。
                  </li>
                  <li>
                    <strong>Python 策略：</strong>策略上传、执行日志和计划通知。
                  </li>
                  <li>
                    <strong>Flow：</strong>可视化工作流执行和管理通知。
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground mb-2">管理与工具</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <strong>Telegram：</strong>机器人操作、广播和用户管理通知。
                  </li>
                  <li>
                    <strong>管理：</strong>交易时间、节假日和冻结数量通知。
                  </li>
                  <li>
                    <strong>监控：</strong>健康、延迟和安全面板通知。
                  </li>
                  <li>
                    <strong>剪贴板：</strong>复制操作确认。
                  </li>
                </ul>
              </div>
              <div className="pt-3 border-t">
                <p className="font-medium text-foreground mb-2">使用提示</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    运行 5 个以上策略时，可将最多显示数设为 <strong>2–3</strong>，持续时间设为 <strong>2 秒</strong>。
                  </li>
                  <li>
                    不使用模拟盘时，可关闭<strong>模拟盘</strong>通知以减少干扰。
                  </li>
                  <li>
                    如果习惯手动查看订单簿，可关闭<strong>订单</strong>通知。
                  </li>
                  <li>
                    大批量导入数据时，可关闭 <strong>Historify</strong> 通知以避免通知过多。
                  </li>
                  <li>
                    建议保留<strong>系统</strong>通知，以接收重要安全提示。
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-6">
          <Alert>
            <FolderCheck className="h-4 w-4" />
            <AlertTitle>文件权限监控</AlertTitle>
            <AlertDescription>
              检查 OpenAlgo 组件的文件和目录权限。权限不正确可能导致应用无法正常运行。
            </AlertDescription>
          </Alert>

          {/* System Info */}
          {permissionsData && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      系统状态
                      {permissionsData.all_correct ? (
                        <Badge className="bg-green-500">全部正常</Badge>
                      ) : (
                        <Badge variant="destructive">发现问题</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      平台：{permissionsData.platform}
                      {permissionsData.is_windows && '（Windows 使用基于访问能力的检查）'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchPermissions}
                      disabled={isLoadingPermissions}
                    >
                      {isLoadingPermissions ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          刷新
                        </>
                      )}
                    </Button>
                    {!permissionsData.all_correct && !permissionsData.is_windows && (
                      <Button
                        size="sm"
                        onClick={handleFixPermissions}
                        disabled={isFixingPermissions}
                      >
                        {isFixingPermissions ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Wrench className="h-4 w-4 mr-2" />
                            修复问题
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Loading State */}
          {isLoadingPermissions && !permissionsData && (
            <Card>
              <CardContent className="py-12 flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>正在检查权限…</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Permissions List */}
          {permissionsData && (
            <Card>
              <CardHeader>
                <CardTitle>权限详情</CardTitle>
                <CardDescription>
                  查看有问题的项目以获取修复建议
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {permissionsData.checks.map((check) => (
                    <div
                      key={check.path}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        check.is_correct
                          ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                      }`}
                    >
                      {/* Status Icon */}
                      <div className="mt-0.5">
                        {check.is_correct ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : check.exists ? (
                          <FileWarning className="h-5 w-5 text-red-600 dark:text-red-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium font-mono text-sm">{check.path}</span>
                          {check.is_sensitive && (
                            <Badge variant="outline" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              敏感
                            </Badge>
                          )}
                          {check.is_directory && (
                            <Badge variant="outline" className="text-xs">
                              目录
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{check.description}</p>

                        {/* Permission Details */}
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-muted-foreground">
                            预期权限：{' '}
                            <code className="bg-muted px-1 rounded">{check.expected_mode}</code>
                            <span className="ml-1 text-muted-foreground/70">
                              ({check.expected_rwx})
                            </span>
                          </span>
                          {check.exists && check.actual_mode && (
                            <span
                              className={
                                check.is_correct
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }
                            >
                              实际权限：{' '}
                              <code
                                className={`px-1 rounded ${check.is_correct ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}
                              >
                                {check.actual_mode}
                              </code>
                              <span className="ml-1 opacity-70">({check.actual_rwx})</span>
                            </span>
                          )}
                        </div>

                        {/* Issue Message */}
                        {check.issue && (
                          <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-sm">
                            <p className="text-red-700 dark:text-red-300 font-medium">
                              {check.issue}
                            </p>
                            {!permissionsData.is_windows && !check.exists && (
                              <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                                修复：创建目录或文件
                              </p>
                            )}
                            {!permissionsData.is_windows &&
                              check.exists &&
                              check.actual_mode !== check.expected_mode && (
                                <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                                  修复：{' '}
                                  <code className="bg-red-200 dark:bg-red-800 px-1 rounded">
                                    chmod {check.expected_mode} {check.path}
                                  </code>
                                </p>
                              )}
                          </div>
                        )}

                        {/* Warning Message (doesn't affect is_correct status) */}
                        {check.warning && !check.issue && (
                          <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-sm">
                            <p className="text-yellow-700 dark:text-yellow-300 font-medium">
                              {check.warning}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Help Card */}
          <Card>
            <CardHeader>
              <CardTitle>权限说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <div>
                <p className="font-medium text-foreground">权限格式（Unix/Linux/macOS）</p>
                <p>权限以三位数字表示（例如 755）：</p>
                <ul className="list-disc list-inside mt-1 space-y-1 ml-2">
                  <li>
                    <code className="bg-muted px-1 rounded">7</code> = 读取 + 写入 + 执行（rwx）
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">5</code> = 读取 + 执行（r-x）
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">6</code> = 读取 + 写入（rw-）
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">4</code> = 仅读取（r--）
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">0</code> = 无权限（---）
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">敏感文件</p>
                <p>
                  标记为敏感的文件（例如 
                  <code className="bg-muted px-1 rounded">.env</code> 和 
                  <code className="bg-muted px-1 rounded">keys/</code>）应限制权限（600 或 700），以防止未经授权的访问。
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Windows</p>
                <p>
                  在 Windows 上，系统检查文件和目录是否可读写，而不是检查 Unix 格式的权限。
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Theme Tab */}
        <TabsContent value="theme" className="space-y-6">
          {/* Analyzer Mode Warning */}
          {isAnalyzerMode && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>主题更改已禁用</AlertTitle>
              <AlertDescription>
                模拟盘模式下无法自定义主题，系统会自动使用紫色主题以示区分。切换回实盘模式后可更改主题。
              </AlertDescription>
            </Alert>
          )}

          {/* Current Theme Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>当前主题</CardTitle>
                  <CardDescription>
                    {isAnalyzerMode
                      ? '模拟盘模式（紫色主题）'
                      : `${THEME_MODES.find((item) => item.value === mode)?.label ?? mode}模式，强调色：${ACCENT_COLORS.find((item) => item.value === color)?.label ?? color}`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded bg-primary" title="主色" />
                    <div className="w-6 h-6 rounded bg-secondary" title="次要颜色" />
                    <div className="w-6 h-6 rounded bg-accent" title="强调色" />
                    <div className="w-6 h-6 rounded bg-muted" title="柔和色" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetTheme}
                    disabled={isAnalyzerMode || (mode === 'light' && color === 'zinc')}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重置
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Theme Mode Selection */}
          <Card className={isAnalyzerMode ? 'opacity-60' : ''}>
            <CardHeader>
              <CardTitle>主题模式</CardTitle>
              <CardDescription>选择浅色或深色界面</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {THEME_MODES.map((themeOption) => {
                  const Icon = themeOption.icon
                  const isSelected = mode === themeOption.value && !isAnalyzerMode
                  return (
                    <button
                      type="button"
                      key={themeOption.value}
                      onClick={() => handleThemeModeChange(themeOption.value)}
                      disabled={isAnalyzerMode}
                      className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      } ${isAnalyzerMode ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div
                        className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{themeOption.label}</span>
                          {isSelected && <Check className="h-4 w-4 text-primary" />}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {themeOption.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Accent Color Selection */}
          <Card className={isAnalyzerMode ? 'opacity-60' : ''}>
            <CardHeader>
              <CardTitle>强调色</CardTitle>
              <CardDescription>自定义主要强调色</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                {ACCENT_COLORS.map((accentColor) => {
                  const isSelected = color === accentColor.value && !isAnalyzerMode
                  return (
                    <button
                      type="button"
                      key={accentColor.value}
                      onClick={() => handleAccentColorChange(accentColor.value)}
                      disabled={isAnalyzerMode}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      } ${isAnalyzerMode ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      title={accentColor.label}
                    >
                      <div
                        className={`w-8 h-8 rounded-full ${accentColor.color} ring-2 ring-offset-2 ring-offset-background ${isSelected ? 'ring-primary' : 'ring-transparent'}`}
                      />
                      <span className="text-xs font-medium">{accentColor.label}</span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Theme Info */}
          <Card>
            <CardHeader>
              <CardTitle>关于主题</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>浅色模式：</strong>对比清晰，适合白天使用。
              </p>
              <p>
                <strong>深色模式：</strong>适合长时间交易，尤其是在低光环境下。
              </p>
              <p>
                <strong>模拟盘模式：</strong>自动使用紫色主题，提示当前交易使用模拟资金。
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMTP Tab */}
        <TabsContent value="smtp" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SMTP 配置</CardTitle>
              <CardDescription>
                配置用于密码重置通知的邮箱设置
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6">
                <Mail className="h-4 w-4" />
                <AlertTitle>Gmail 配置提示</AlertTitle>
                <AlertDescription>
                  <ul className="text-sm list-disc list-inside mt-1 space-y-1">
                    <li>
                      <strong>个人 Gmail：</strong>服务器：smtp.gmail.com:587
                    </li>
                    <li>
                      <strong>密码：</strong>使用应用专用密码，不要使用账户登录密码
                    </li>
                    <li>
                      <strong>设置路径：</strong>Google 账户 → 安全 → 两步验证 → 应用专用密码
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>

              <form onSubmit={handleSaveSmtp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SMTP 服务器</Label>
                    <Input
                      value={smtpServer}
                      onChange={(e) => setSmtpServer(e.target.value)}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP 端口</Label>
                    <Input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="587"
                    />
                    <p className="text-xs text-muted-foreground">587（STARTTLS）或 465（SSL/TLS）</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>用户名／邮箱</Label>
                  <Input
                    type="email"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                    placeholder="your-email@gmail.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>密码／应用专用密码</Label>
                  <Input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder={
                      profileData?.smtp_settings?.smtp_password
                        ? '已设置密码（输入新密码可更改）'
                        : '请输入应用专用密码'
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>发件邮箱</Label>
                  <Input
                    type="email"
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    placeholder="your-email@gmail.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>HELO 主机名</Label>
                  <Input
                    value={smtpHeloHostname}
                    onChange={(e) => setSmtpHeloHostname(e.target.value)}
                    placeholder="smtp.gmail.com"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="smtp_tls"
                    checked={smtpUseTls}
                    onCheckedChange={(checked) => setSmtpUseTls(checked === true)}
                  />
                  <Label htmlFor="smtp_tls">使用 TLS/SSL</Label>
                </div>

                <Button type="submit" disabled={isSavingSmtp}>
                  {isSavingSmtp ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      保存中…
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      保存 SMTP 设置
                    </>
                  )}
                </Button>

                {/* Test Configuration */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-3">测试配置</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    发送测试邮件以验证 SMTP 设置。
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="输入用于测试的邮箱地址"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestEmail}
                      disabled={isSendingTest}
                    >
                      {isSendingTest ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-1" />
                          发送测试邮件
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleDebugSmtp}
                      disabled={isDebugging}
                    >
                      {isDebugging ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Bug className="h-4 w-4 mr-1" />
                          诊断
                        </>
                      )}
                    </Button>
                  </div>

                  {debugResult && (
                    <Alert
                      className={`mt-4 ${debugResult.success ? 'border-green-500' : 'border-yellow-500'}`}
                    >
                      <AlertTitle>
                        {debugResult.success ? 'SMTP 诊断完成' : 'SMTP 连接存在问题'}
                      </AlertTitle>
                      <AlertDescription>
                        <p>{debugResult.message}</p>
                        {debugResult.details && debugResult.details.length > 0 && (
                          <ul className="text-xs mt-2 list-disc list-inside">
                            {debugResult.details.map((detail, i) => (
                              <li key={i}>{detail}</li>
                            ))}
                          </ul>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TOTP Tab */}
        <TabsContent value="totp" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>TOTP 身份验证</CardTitle>
              <CardDescription>管理双重身份验证设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>关于 TOTP 身份验证</AlertTitle>
                <AlertDescription>
                  TOTP（基于时间的一次性密码）提供额外的安全保护。您需要使用 Google Authenticator 或 Authy 等身份验证器生成密码恢复所需的验证码。
                </AlertDescription>
              </Alert>

              <TwoFactorEnforcement />

              {profileData?.qr_code && profileData?.totp_secret ? (
                <div className="bg-muted rounded-lg p-6 space-y-6">
                  <h3 className="font-semibold text-center">您的 TOTP 二维码</h3>

                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-lg shadow">
                      <img
                        src={`data:image/png;base64,${profileData.qr_code}`}
                        alt="TOTP 二维码"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>

                  {/* Manual Entry */}
                  <div className="bg-background rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold">手动输入</h4>
                    <p className="text-sm text-muted-foreground">手动输入的密钥：</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted p-2 rounded text-sm break-all">
                        {profileData.totp_secret}
                      </code>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyToClipboard(profileData.totp_secret!)}
                        aria-label="复制 TOTP 密钥"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="space-y-2">
                    <p className="font-medium">设置步骤：</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>安装身份验证器应用（如 Google Authenticator、Authy）</li>
                      <li>扫描上方二维码或手动输入密钥</li>
                      <li>将备用恢复码保存在安全的地方</li>
                      <li>
                        忘记密码时，需要使用 TOTP 验证码重置密码
                      </li>
                    </ol>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTitle>TOTP 不可用</AlertTitle>
                  <AlertDescription>
                    无法加载 TOTP 设置，请联系管理员。
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Restart Required Dialog */}
      <AlertDialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              需要重启
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                配置已保存到 
                <code className="bg-muted px-1 rounded">.env</code> 文件。
              </p>
              <p>
                要使更改生效，请通过平时使用的方式（终端、服务管理器或容器管理工具）重启 OpenAlgo。
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowRestartDialog(false)}>
              知道了
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
