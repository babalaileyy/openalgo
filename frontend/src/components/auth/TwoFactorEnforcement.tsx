import { Loader2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { webClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { showToast } from '@/utils/toast'

interface TwoFactorStatus {
  totp_enabled: boolean
  totp_required_for_login: boolean
  totp_required_for_mcp: boolean
  totp_required_for_password_reset: boolean
  last_totp_verified_at: string | null
}

type PurposeKey =
  | 'totp_required_for_login'
  | 'totp_required_for_mcp'
  | 'totp_required_for_password_reset'

const PURPOSES: { key: PurposeKey; label: string; help: string }[] = [
  {
    key: 'totp_required_for_login',
    label: '仪表盘登录',
    help: '每次登录输入密码后都需要输入 6 位验证码。',
  },
  {
    key: 'totp_required_for_mcp',
    label: '远程 MCP 授权',
    help: 'MCP 客户端请求下单权限时，需要在 OAuth 授权页面输入当前验证码。',
  },
  {
    key: 'totp_required_for_password_reset',
    label: '密码重置',
    help: '禁用邮件重置方式，每次重置密码都必须使用身份验证器应用。',
  },
]

export default function TwoFactorEnforcement() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<TwoFactorStatus | null>(null)
  const [draft, setDraft] = useState<Omit<TwoFactorStatus, 'last_totp_verified_at'>>({
    totp_enabled: false,
    totp_required_for_login: false,
    totp_required_for_mcp: false,
    totp_required_for_password_reset: false,
  })
  const [totpCode, setTotpCode] = useState('')

  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time 2FA status load on mount; fetchStatus has no reactive inputs
  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const r = await webClient.get<TwoFactorStatus & { status?: string }>('/auth/2fa/status')
      setStatus(r.data)
      setDraft({
        totp_enabled: r.data.totp_enabled,
        totp_required_for_login: r.data.totp_required_for_login,
        totp_required_for_mcp: r.data.totp_required_for_mcp,
        totp_required_for_password_reset: r.data.totp_required_for_password_reset,
      })
    } catch {
      showToast.error('加载双重验证设置失败', 'system')
    } finally {
      setLoading(false)
    }
  }

  const isDirty =
    !!status &&
    (draft.totp_enabled !== status.totp_enabled ||
      draft.totp_required_for_login !== status.totp_required_for_login ||
      draft.totp_required_for_mcp !== status.totp_required_for_mcp ||
      draft.totp_required_for_password_reset !== status.totp_required_for_password_reset)

  const allOn =
    draft.totp_enabled &&
    draft.totp_required_for_login &&
    draft.totp_required_for_mcp &&
    draft.totp_required_for_password_reset

  const setMaster = (enabled: boolean) => {
    setDraft((prev) =>
      enabled
        ? { ...prev, totp_enabled: true }
        : {
            totp_enabled: false,
            totp_required_for_login: false,
            totp_required_for_mcp: false,
            totp_required_for_password_reset: false,
          }
    )
  }

  const setAll = (on: boolean) => {
    setDraft({
      totp_enabled: on,
      totp_required_for_login: on,
      totp_required_for_mcp: on,
      totp_required_for_password_reset: on,
    })
  }

  const setPurpose = (key: PurposeKey, value: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!totpCode || totpCode.length !== 6) {
      showToast.error('请输入身份验证器中的 6 位验证码以确认。', 'system')
      return
    }
    setSaving(true)
    try {
      const body = { ...draft, totp_code: totpCode }
      await webClient.post('/auth/2fa/configure', body)
      showToast.success('2FA settings updated.', 'system')
      setTotpCode('')
      await fetchStatus()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update 2FA settings.'
      showToast.error(message, 'system')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          双重验证设置
        </CardTitle>
        <CardDescription>
          选择需要双重验证的操作。默认关闭；开启后可选择适用范围。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Master switch */}
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="flex-1">
            <Label className="font-semibold">启用双重验证</Label>
            <p className="text-sm text-muted-foreground mt-1">
              双重验证总开关。关闭后，下方各项开关均不生效，系统按原有方式运行。
            </p>
          </div>
          <Switch checked={draft.totp_enabled} onCheckedChange={setMaster} />
        </div>

        {/* Per-purpose toggles */}
        {draft.totp_enabled ? (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">双重验证适用于：</span>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setAll(!allOn)}
              >
                {allOn ? '全部取消' : '全选'}
              </button>
            </div>
            {PURPOSES.map((p) => (
              <div key={p.key} className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Label className="font-medium">{p.label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.help}</p>
                </div>
                <Switch
                  checked={Boolean(draft[p.key])}
                  onCheckedChange={(v) => setPurpose(p.key, v)}
                />
              </div>
            ))}
          </div>
        ) : null}

        {/* TOTP confirmation */}
        {isDirty ? (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/30">
            <Label htmlFor="confirm-totp" className="text-sm font-semibold">
              使用 TOTP 验证码确认
            </Label>
            <p className="text-xs text-muted-foreground">
              输入身份验证器应用中的当前 6 位验证码以应用更改。开启或关闭双重验证均需要验证码。
            </p>
            <Input
              id="confirm-totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="123456"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="font-mono text-center tracking-widest max-w-xs"
            />
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving || totpCode.length !== 6}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                保存双重验证设置
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (status) {
                    setDraft({
                      totp_enabled: status.totp_enabled,
                      totp_required_for_login: status.totp_required_for_login,
                      totp_required_for_mcp: status.totp_required_for_mcp,
                      totp_required_for_password_reset: status.totp_required_for_password_reset,
                    })
                  }
                  setTotpCode('')
                }}
                disabled={saving}
              >
                取消
              </Button>
            </div>
          </div>
        ) : null}

        {status?.last_totp_verified_at ? (
          <p className="text-xs text-muted-foreground">
            Last TOTP verification: {new Date(status.last_totp_verified_at).toLocaleString()}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
