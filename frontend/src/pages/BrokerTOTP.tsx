import { AlertTriangle, ArrowLeft, ExternalLink, Loader2, Shield } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { fetchCSRFToken } from '@/api/client'
import { BrokerAuthSignOut } from '@/components/auth/BrokerAuthSignOut'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/authStore'
import { showToast } from '@/utils/toast'

// Field configuration type
interface FieldConfig {
  name: string
  label: string
  type: string
  placeholder: string
  pattern?: string
  maxLength?: number
  inputMode?: 'numeric' | 'text' | 'tel'
  prefix?: string
  hint?: string
  optional?: boolean
}

interface BrokerConfig {
  fields: FieldConfig[]
  callbackUrl?: string
  warning?: string
  hiddenFields?: Record<string, string>
}

// Broker-specific field configurations
const brokerFields: Record<string, BrokerConfig> = {
  fivepaisa: {
    fields: [
      {
        name: 'userid',
        label: '客户 ID / 手机号',
        type: 'text',
        placeholder: '输入客户 ID 或手机号',
      },
      { name: 'pin', label: 'PIN', type: 'password', placeholder: '输入 PIN' },
      {
        name: 'totp',
        label: 'TOTP',
        type: 'password',
        placeholder: '输入 6 位 TOTP 动态验证码',
        maxLength: 6,
        pattern: '[0-9]{6}',
        inputMode: 'numeric',
      },
    ],
    callbackUrl: '/fivepaisa/callback',
  },
  aliceblue: {
    fields: [
      {
        name: 'userid',
        label: '用户 ID',
        type: 'text',
        placeholder: '输入用户 ID（字母或数字）',
      },
    ],
    callbackUrl: '/aliceblue/callback',
  },
  angel: {
    fields: [
      { name: 'userid', label: '客户 ID', type: 'text', placeholder: '输入客户 ID' },
      { name: 'pin', label: 'PIN', type: 'password', placeholder: '输入 PIN（至少 4 位）' },
      {
        name: 'totp',
        label: 'TOTP',
        type: 'text',
        placeholder: '输入 6 位 TOTP 动态验证码',
        maxLength: 6,
        pattern: '[0-9]{6}',
        inputMode: 'numeric',
        hint: '从身份验证器应用获取 TOTP',
      },
    ],
    callbackUrl: '/angel/callback',
  },
  definedge: {
    fields: [
      {
        name: 'otp',
        label: 'OTP',
        type: 'password',
        placeholder: '输入发送至已登记手机或邮箱的一次性验证码',
        inputMode: 'numeric',
        hint: '一次性验证码已发送至登记手机或邮箱',
      },
    ],
    callbackUrl: '/definedge/callback',
  },
  firstock: {
    fields: [
      { name: 'userid', label: '用户 ID', type: 'text', placeholder: '输入用户 ID' },
      { name: 'password', label: '密码', type: 'password', placeholder: '输入密码' },
      {
        name: 'totp',
        label: 'TOTP',
        type: 'password',
        placeholder: '输入 6 位 TOTP 动态验证码',
        maxLength: 6,
        pattern: '[0-9]{6}',
        inputMode: 'numeric',
        hint: '从身份验证器应用获取 TOTP',
      },
    ],
    callbackUrl: '/firstock/callback',
  },
  indmoney: {
    fields: [
      {
        name: 'mpin',
        label: 'MPIN',
        type: 'password',
        placeholder: '输入账户 MPIN',
        inputMode: 'numeric',
        hint: '用于登录 INDstocks 的 MPIN',
      },
      {
        name: 'totp',
        label: 'TOTP 动态验证码',
        type: 'text',
        placeholder: '输入 6 位 TOTP 动态验证码',
        maxLength: 6,
        pattern: '[0-9]{6}',
        inputMode: 'numeric',
        hint: '从身份验证器应用获取新的 TOTP，已提交过的验证码会被拒绝。',
      },
    ],
    callbackUrl: '/indmoney/callback',
    warning:
      '请先在 indstocks.com > API Trading > Access Tokens 设置 TOTP，并将显示的客户 ID 填入 BROKER_API_KEY。令牌每 60 秒最多生成一次；15 分钟内输错 5 次会锁定 15 分钟。',
  },
  kotak: {
    fields: [
      {
        name: 'mobile',
        label: '手机号',
        type: 'tel',
        placeholder: '输入 10 位手机号',
        maxLength: 10,
        pattern: '[0-9]{10}',
        inputMode: 'numeric',
        prefix: '+91',
        hint: 'Kotak NEO 登记手机号',
      },
      {
        name: 'mpin',
        label: 'MPIN',
        type: 'password',
        placeholder: '输入 6 位 MPIN',
        maxLength: 6,
        pattern: '[0-9]{6}',
        inputMode: 'numeric',
      },
      {
        name: 'totp',
        label: 'TOTP 动态验证码',
        type: 'text',
        placeholder: '输入 6 位 TOTP 动态验证码',
        maxLength: 6,
        pattern: '[0-9]{6}',
        inputMode: 'numeric',
      },
    ],
    callbackUrl: '/kotak/callback',
    warning:
      '请确认已在 Kotak NEO 手机应用中注册 TOTP，可在 Settings > Security > Enable TOTP 中设置。',
  },
  motilal: {
    fields: [
      { name: 'userid', label: '用户 ID', type: 'text', placeholder: '输入用户 ID' },
      { name: 'password', label: '密码', type: 'password', placeholder: '输入密码' },
      {
        name: 'dob',
        label: '出生日期',
        type: 'text',
        placeholder: 'DD/MM/YYYY',
        hint: '格式：DD/MM/YYYY',
      },
      {
        name: 'totp',
        label: 'TOTP',
        type: 'password',
        placeholder: '输入 TOTP（可选）',
        maxLength: 6,
        optional: true,
        hint: '留空以通过短信或邮箱接收一次性验证码',
      },
    ],
    callbackUrl: '/motilal/callback',
  },
  mstock: {
    fields: [
      { name: 'password', label: '密码', type: 'password', placeholder: '输入密码' },
      {
        name: 'totp',
        label: 'TOTP',
        type: 'text',
        placeholder: '输入 6 位 TOTP 动态验证码',
        maxLength: 6,
        pattern: '[0-9]{6}',
        inputMode: 'numeric',
      },
    ],
    callbackUrl: '/mstock/callback',
  },
  nubra: {
    fields: [
      {
        name: 'otp',
        label: 'OTP',
        type: 'text',
        placeholder: '输入 6 位一次性验证码',
        maxLength: 6,
        pattern: '[0-9]{6}',
        inputMode: 'numeric',
        hint: '一次性验证码已发送至登记手机号。如需新验证码，请在交易商页面重新开始 Nubra 登录。',
      },
    ],
    callbackUrl: '/nubra/callback',
  },
  samco: {
    fields: [
      {
        name: 'yob',
        label: '出生年份',
        type: 'text',
        placeholder: 'YYYY',
        maxLength: 4,
        pattern: '[0-9]{4}',
        inputMode: 'numeric',
        hint: '客户 ID 和密码在环境配置中设置',
      },
    ],
    callbackUrl: '/samco/callback',
  },
  shoonya: {
    fields: [
      { name: 'userid', label: '用户 ID', type: 'text', placeholder: '输入用户 ID' },
      { name: 'password', label: '密码', type: 'password', placeholder: '输入密码' },
      {
        name: 'totp',
        label: 'TOTP',
        type: 'password',
        placeholder: '输入 6 位 TOTP 动态验证码',
        maxLength: 6,
        pattern: '[0-9]{6}',
        inputMode: 'numeric',
        hint: '从身份验证器应用获取 TOTP',
      },
    ],
    callbackUrl: '/shoonya/callback',
  },
  tradejini: {
    fields: [
      {
        name: 'password',
        label: 'PIN',
        type: 'password',
        placeholder: '输入登录 PIN',
        hint: '用于登录 CubePlus 的 PIN，并非账户密码',
      },
      {
        name: 'twofa',
        label: '双因素验证码 / TOTP',
        type: 'text',
        placeholder: '输入双因素验证码或 TOTP',
        hint: '在 Tradejini 网页应用的 Profile > Security 中获取 TOTP',
      },
    ],
    callbackUrl: '/tradejini/callback',
    hiddenFields: { twofatype: 'totp' },
  },
  zebu: {
    fields: [
      { name: 'userid', label: '用户 ID', type: 'text', placeholder: '输入用户 ID' },
      { name: 'password', label: '密码', type: 'password', placeholder: '输入密码' },
      {
        name: 'totp',
        label: 'TOTP / 出生日期 / PAN 税号',
        type: 'password',
        placeholder: '输入 6 位 TOTP、出生日期（DDMMYYYY）或 PAN 税号',
        hint: '输入 6 位 TOTP、出生日期（DDMMYYYY）或 PAN 税号',
      },
    ],
    callbackUrl: '/zebu/callback',
  },
  default: {
    fields: [
      { name: 'userid', label: '用户 ID', type: 'text', placeholder: '输入用户 ID' },
      { name: 'password', label: '密码', type: 'password', placeholder: '输入密码' },
      {
        name: 'totp',
        label: 'TOTP',
        type: 'text',
        placeholder: '输入 6 位 TOTP 动态验证码',
        maxLength: 6,
        pattern: '[0-9]{6}',
        inputMode: 'numeric',
      },
    ],
  },
}

const brokerNames: Record<string, string> = {
  fivepaisa: '5Paisa',
  '5paisa': '5Paisa',
  aliceblue: 'AliceBlue',
  angel: 'Angel One',
  definedge: 'Definedge Securities',
  firstock: 'Firstock',
  indmoney: 'IndMoney (INDstocks)',
  kotak: 'Kotak NEO',
  motilal: 'Motilal Oswal',
  mstock: 'MStock',
  nubra: 'Nubra (Nuvama)',
  samco: 'Samco',
  shoonya: 'Shoonya',
  tradejini: 'Tradejini',
  zebu: 'Zebu',
}

export default function BrokerTOTP() {
  const { broker } = useParams<{ broker: string }>()
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})

  // Normalize broker name (handle 5paisa -> fivepaisa)
  const normalizedBroker = broker === '5paisa' ? 'fivepaisa' : broker
  const config =
    normalizedBroker && brokerFields[normalizedBroker]
      ? brokerFields[normalizedBroker]
      : brokerFields.default
  const brokerName = broker
    ? brokerNames[broker] || brokerNames[normalizedBroker || ''] || broker
    : 'Broker'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validate broker parameter
    if (!broker && !normalizedBroker) {
      setError('选择的交易商无效。')
      setIsLoading(false)
      return
    }

    // Validate required fields (skip optional fields)
    const requiredFields = config.fields.filter((f) => !f.optional).map((f) => f.name)
    const missingFields = requiredFields.filter((f) => !formData[f]?.trim())
    if (missingFields.length > 0) {
      setError('请填写所有必填项。')
      setIsLoading(false)
      return
    }

    try {
      const csrfToken = await fetchCSRFToken()

      const form = new FormData()

      // Add form fields
      Object.entries(formData).forEach(([key, value]) => {
        // Special handling for Kotak mobile - add +91 prefix
        if (normalizedBroker === 'kotak' && key === 'mobile') {
          form.append(key, `+91${value.trim()}`)
        } else {
          form.append(key, value.trim())
        }
      })

      // Add hidden fields if any
      if (config.hiddenFields) {
        Object.entries(config.hiddenFields).forEach(([key, value]) => {
          form.append(key, value)
        })
      }

      form.append('csrf_token', csrfToken)

      // Use custom callback URL or default pattern
      const callbackUrl = config.callbackUrl || `/${broker}/callback`

      const response = await fetch(callbackUrl, {
        method: 'POST',
        body: form,
        credentials: 'include',
      })

      const data = await response.json()

      if (data.status === 'success' || response.ok) {
        login(formData.userid || formData.mobile || '', broker || '')
        showToast.success('身份验证成功')
        navigate('/dashboard')
      } else {
        setError(data.message || '验证失败，请重试。')
      }
    } catch {
      setError('身份验证失败，请检查凭据后重试。')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (name: string, value: string, field: FieldConfig) => {
    // Apply input filtering based on field type
    let filteredValue = value

    if (field.inputMode === 'numeric') {
      filteredValue = value.replace(/\D/g, '')
    }

    if (field.maxLength) {
      filteredValue = filteredValue.slice(0, field.maxLength)
    }

    setFormData((prev) => ({ ...prev, [name]: filteredValue }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4">
      <div className="container max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-4"
              onClick={() => navigate('/broker')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex justify-center mb-4 pt-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">{brokerName} Login</CardTitle>
            <CardDescription>
              Enter your credentials to authenticate with {brokerName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Warning Alert if present */}
            {config.warning && (
              <Alert variant="warning" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{config.warning}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {config.fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.optional && (
                      <span className="text-muted-foreground ml-1">(optional)</span>
                    )}
                  </Label>
                  <div className="relative">
                    {field.prefix && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        {field.prefix}
                      </span>
                    )}
                    <Input
                      id={field.name}
                      type={field.type}
                      inputMode={field.inputMode}
                      placeholder={field.placeholder}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value, field)}
                      required={!field.optional}
                      disabled={isLoading}
                      maxLength={field.maxLength}
                      pattern={field.pattern}
                      autoComplete={
                        field.type === 'password'
                          ? 'current-password'
                          : field.inputMode === 'numeric'
                            ? 'one-time-code'
                            : 'off'
                      }
                      className={field.prefix ? 'pl-12' : ''}
                    />
                  </div>
                  {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                </div>
              ))}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />正在验证…</>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />验证</>
                )}
              </Button>
            </form>

            <div className="mt-6 space-y-3 text-center text-sm text-muted-foreground">
              <p>您的凭据会经过安全传输和加密处理。</p>
              <div className="flex items-center justify-center gap-4">
                <Link
                  to="/broker"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />返回选择交易商</Link>
                <a
                  href="https://docs.openalgo.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >文档<ExternalLink className="h-3 w-3" />
                </a>
                <BrokerAuthSignOut />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
