import { Check, Info, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { fetchCSRFToken } from '@/api/client'
import { cn } from '@/lib/utils'
import { showToast } from '@/utils/toast'

interface PasswordRequirements {
  length: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  special: boolean
}

function calculatePasswordStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score += 20
  if (password.length >= 12) score += 10
  if (password.length >= 16) score += 10
  if (/[A-Z]/.test(password)) score += 15
  if (/[a-z]/.test(password)) score += 15
  if (/[0-9]/.test(password)) score += 15
  if (/[!@#$%^&*]/.test(password)) score += 15
  return score
}

function checkPasswordRequirements(password: string): PasswordRequirements {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password),
  }
}

export default function Setup() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [requirements, setRequirements] = useState<PasswordRequirements>({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  })
  const [passwordStrength, setPasswordStrength] = useState(0)

  useEffect(() => {
    const reqs = checkPasswordRequirements(formData.password)
    setRequirements(reqs)
    setPasswordStrength(calculatePasswordStrength(formData.password))
  }, [formData.password])

  const allRequirementsMet = Object.values(requirements).every(Boolean)
  const passwordsMatch = formData.password === formData.confirmPassword
  const allFieldsFilled = Object.values(formData).every((v) => v.trim() !== '')
  const canSubmit = allRequirementsMet && passwordsMatch && allFieldsFilled

  const getStrengthLabel = () => {
    if (passwordStrength >= 80) return { label: 'Strong', color: 'text-green-500' }
    if (passwordStrength >= 50) return { label: 'Medium', color: 'text-yellow-500' }
    if (passwordStrength > 0) return { label: 'Weak', color: 'text-red-500' }
    return { label: '', color: '' }
  }

  const strengthInfo = getStrengthLabel()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setIsLoading(true)
    setError(null)

    try {
      // First, fetch CSRF token
      const csrfResponse = await fetch('/auth/csrf-token', {
        credentials: 'include',
      })
      const csrfData = await csrfResponse.json()

      const form = new FormData()
      form.append('username', formData.username)
      form.append('email', formData.email)
      form.append('password', formData.password)
      form.append('confirm_password', formData.confirmPassword)
      form.append('csrf_token', csrfData.csrf_token)

      const response = await fetch('/setup', {
        method: 'POST',
        body: form,
        credentials: 'include',
      })

      // Consume response body
      await response.text()

      // If setup was successful (response ok or redirected), go to login
      if (response.ok || response.redirected) {
        showToast.success('Account created successfully')
        // Clear any existing session by calling logout. /auth/logout is CSRF
        // protected, so the token has to be attached explicitly here - this is
        // a raw fetch, not the axios client that adds it via an interceptor.
        try {
          const csrfToken = await fetchCSRFToken()
          await fetch('/auth/logout', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            credentials: 'include',
          })
        } catch {
          // Ignore logout errors
        }
        navigate('/login')
      } else {
        setError('Setup failed. Please try again.')
      }
    } catch (_err) {
      setError('Setup failed. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const RequirementItem = ({ met, children }: { met: boolean; children: React.ReactNode }) => (
    <div
      className={cn(
        'flex items-center gap-2 text-sm py-1 transition-colors',
        met ? 'text-green-500' : 'text-muted-foreground'
      )}
    >
      <Check className={cn('h-4 w-4', met ? 'opacity-100' : 'opacity-0')} />
      <span>{children}</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
      <div className="container max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left side content */}
          <div className="space-y-6 lg:pr-8">
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
                首次<span className="text-primary">设置</span>
              </h1>
              <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed">
                欢迎使用 OpenAlgo！创建管理员账户以开始使用算法交易。该账户拥有平台管理权限。
              </p>
            </div>

            <Alert>
              <Info className="h-5 w-5" />
              <AlertDescription>
                <strong className="block mb-1">首次设置</strong>
                此表单将创建初始管理员账户。登录后，请在个人资料中扫描 TOTP 二维码，启用双因素验证及使用动态验证码重置密码。
              </AlertDescription>
            </Alert>
          </div>

          {/* Right side setup form */}
          <div className="w-full">
            <Card>
              <CardContent className="p-6 lg:p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Username */}
                  <div className="space-y-2">
                    <Label htmlFor="username">用户名</Label>
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      placeholder="设置用户名"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                      autoComplete="username"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="输入邮箱"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password">密码</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="设置密码"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    {/* Password Strength Meter */}
                    <Progress value={passwordStrength} className="h-2" />
                    {strengthInfo.label && (
                      <p className={cn('text-xs font-medium', strengthInfo.color)}>
                        {strengthInfo.label}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">确认密码</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="再次输入密码"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    {formData.confirmPassword && (
                      <p
                        className={cn(
                          'text-xs',
                          passwordsMatch ? 'text-green-500' : 'text-red-500'
                        )}
                      >
                        {passwordsMatch ? '两次密码一致' : '两次密码不一致'}
                      </p>
                    )}
                  </div>

                  {/* Password Requirements */}
                  <div className="bg-muted rounded-lg p-4 space-y-1">
                    <RequirementItem met={requirements.length}>
                      至少 8 个字符
                    </RequirementItem>
                    <RequirementItem met={requirements.uppercase}>
                      至少 1 个大写字母（A-Z）
                    </RequirementItem>
                    <RequirementItem met={requirements.lowercase}>
                      至少 1 个小写字母（a-z）
                    </RequirementItem>
                    <RequirementItem met={requirements.number}>
                      至少 1 个数字（0-9）
                    </RequirementItem>
                    <RequirementItem met={requirements.special}>
                      至少 1 个特殊字符（!@#$%^&*）
                    </RequirementItem>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Submit Button */}
                  <Button type="submit" className="w-full" disabled={!canSubmit || isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Create Account
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
