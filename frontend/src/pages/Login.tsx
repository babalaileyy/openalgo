import {
  ArrowLeft,
  Eye,
  EyeOff,
  Github,
  Info,
  Loader2,
  LogIn,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/authStore'
import { showToast } from '@/utils/toast'

export default function Login() {
  const navigate = useNavigate()
  const { login: setLogin } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [step, setStep] = useState<'password' | 'totp'>('password')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSetup, setIsCheckingSetup] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if setup is required or already logged in on page load
  useEffect(() => {
    const checkSetup = async () => {
      try {
        // First check if setup is needed
        const setupResponse = await fetch('/auth/check-setup', {
          credentials: 'include',
        })
        const setupData = await setupResponse.json()
        if (setupData.needs_setup) {
          navigate('/setup', { replace: true })
          return
        }

        // Check if already logged in
        const sessionResponse = await fetch('/auth/session-status', {
          credentials: 'include',
        })

        // Only process if response is successful (not 401 etc.)
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json()

          if (sessionData.status === 'success' && sessionData.logged_in && sessionData.broker) {
            // Already fully logged in with broker, go to dashboard
            navigate('/dashboard', { replace: true })
            return
          } else if (
            sessionData.status === 'success' &&
            sessionData.authenticated &&
            !sessionData.logged_in
          ) {
            // Logged in but no broker, go to broker selection
            navigate('/broker', { replace: true })
            return
          }
        }
        // If session check fails (401, etc.), just stay on login page
      } catch (_err) {
      } finally {
        setIsCheckingSetup(false)
      }
    }
    checkSetup()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // First, fetch CSRF token
      const csrfResponse = await fetch('/auth/csrf-token', {
        credentials: 'include',
      })

      if (!csrfResponse.ok) {
        setError('登录初始化失败，请刷新页面。')
        setIsLoading(false)
        return
      }

      const csrfData = await csrfResponse.json()

      // Create form data with CSRF token (matches original Flask template approach)
      const formData = new FormData()
      formData.append('username', username)
      formData.append('password', password)
      formData.append('csrf_token', csrfData.csrf_token)

      // Use native fetch like the original template
      const response = await fetch('/auth/login', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      // Check content type before parsing
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        // If redirected to setup page, inform user
        if (response.url.includes('/setup')) {
          setError('请先完成初始设置。')
          navigate('/setup')
        } else {
          setError('登录失败，请重试。')
        }
        setIsLoading(false)
        return
      }

      const data = await response.json()

      if (!response.ok || data.status === 'error') {
        setError(data.message || '登录失败，请重试。')
        if (data.redirect) {
          navigate(data.redirect)
        }
      } else if (data.status === 'totp_required') {
        // Server has accepted the password but won't issue a session
        // until TOTP verifies. Switch to the second-factor step.
        setStep('totp')
        setError(null)
      } else {
        // Set login state (broker from response if session was resumed, empty otherwise)
        setLogin(username, data.broker || '')
        showToast.success('登录成功', 'system')
        // Use redirect from response if provided, otherwise go to broker
        navigate(data.redirect || '/broker')
      }
    } catch (_err) {
      setError('登录失败，请重试。')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const csrfResponse = await fetch('/auth/csrf-token', { credentials: 'include' })
      if (!csrfResponse.ok) {
        setError('无法验证动态验证码，请刷新页面。')
        setIsLoading(false)
        return
      }
      const { csrf_token } = await csrfResponse.json()

      const response = await fetch('/auth/login/totp', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf_token,
        },
        body: JSON.stringify({ totp_code: totpCode }),
      })

      const data = await response.json()

      if (response.status === 401 && data.message?.toLowerCase().includes('expired')) {
        // Pending login window timed out — bounce back to password step.
        setError(data.message)
        setStep('password')
        setTotpCode('')
        return
      }

      if (!response.ok || data.status === 'error') {
        setError(data.message || '动态验证码无效。')
        setTotpCode('')
        return
      }

      setLogin(username, data.broker || '')
      showToast.success('登录成功', 'system')
      navigate(data.redirect || '/broker')
    } catch (_err) {
      setError('动态验证码验证失败，请重试。')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToPassword = () => {
    setStep('password')
    setTotpCode('')
    setError(null)
  }

  // Show loading while checking setup
  if (isCheckingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4">
      <div className="container max-w-6xl">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-16">
          {/* Login Form - First on mobile */}
          <Card className="w-full max-w-md order-1 lg:order-2 shadow-xl">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <img src="/logo.png" alt="OpenAlgo" className="h-20 w-20" />
              </div>
              <CardTitle className="text-2xl">欢迎回来</CardTitle>
              <CardDescription>登录 OpenAlgo 账户</CardDescription>
            </CardHeader>
            <CardContent>
              {step === 'password' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">用户名</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="请输入用户名"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="username"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">密码</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请输入密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        autoComplete="current-password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <div className="text-right">
                      <Link
                        to="/reset-password"
                        className="text-sm text-muted-foreground hover:text-primary"
                      >
                        忘记密码？
                      </Link>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        正在登录…
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        登录
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleTotpSubmit} className="space-y-4">
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>双重身份验证</AlertTitle>
                    <AlertDescription>
                      请输入身份验证器应用中的 6 位验证码以完成登录。
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="totp_code">验证码</Label>
                    <Input
                      id="totp_code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="123456"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      disabled={isLoading}
                      autoFocus
                      required
                      className="font-mono text-center text-lg tracking-widest"
                    />
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBackToPassword}
                      disabled={isLoading}
                    >
                      <ArrowLeft className="mr-1 h-4 w-4" />
                      返回
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={isLoading || totpCode.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          正在验证…
                        </>
                      ) : (
                        '验证'
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Welcome Content - Second on mobile */}
          <div className="flex-1 max-w-xl text-center lg:text-left order-2 lg:order-1">
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              欢迎使用 <span className="text-primary">OpenAlgo</span>
            </h1>
            <p className="text-lg lg:text-xl mb-8 text-muted-foreground">
              登录后可查看交易仪表盘并管理量化交易策略。
            </p>

            <Alert className="mb-6">
              <Info className="h-4 w-4" />
              <AlertTitle>首次使用？</AlertTitle>
              <AlertDescription>
                请联系管理员设置账户。
              </AlertDescription>
            </Alert>

            <div className="flex justify-center lg:justify-start gap-4">
              <Button variant="outline" asChild>
                <a
                  href="https://github.com/marketcalls/openalgo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Github className="h-5 w-5" />
                  GitHub
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="https://openalgo.in/discord"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="h-5 w-5" />
                  Discord
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
