/**
 * Voice configuration.
 *
 * The spoken surface is a third surface on the existing agent, so almost
 * nothing here is about intelligence: the speech model hears and speaks, and
 * every answer it reads out was produced by the same agent, the same toolkits
 * and the same risk guard a typed turn goes through. What this screen sets is
 * the credential, the delivery, and the two questions that have consequences.
 *
 * Three things this panel has to make obvious, because none is guessable and
 * each one is a way an operator ends up surprised:
 *
 * - **The name carries no authority.** The
 *   name is what a trader says all day and carries no authority. The approval
 *   word does one thing, and the server refuses a word that also appears in the
 *   name so the two cannot be collapsed back into one by configuration. That
 *   rule is stated next to the fields and checked here as the operator types,
 *   because meeting it for the first time as a 400 teaches nothing.
 * - **Voice trading is subordinate, not parallel.** `voice_trading_enabled` is
 *   an `and`, never an `or`: with the agent's own trading switch off, turning
 *   this on changes nothing at all. The panel renders it as a nested control
 *   and says so when the master is off, rather than showing a switch that
 *   appears to work and does not.
 * - **What spoken approval actually means.** Anyone within earshot who says the
 *   word while a window is open places the staged order. That is written in
 *   plain words rather than softened, and without an alarming icon, because the
 *   operator is the one who decides whether their room is a room where that is
 *   acceptable.
 *
 * Two rules from the module contract are enforced here rather than assumed, the
 * same way WebSearchPanel enforces them: **a key value is never rendered**, not
 * masked and not partial, so the field starts empty even when a key is stored;
 * and **the server owns validation**, so an unusable name, word or window is
 * refused with the server's own message rather than corrected locally.
 *
 * The two switches apply on toggle and the typed fields wait for Save. That
 * split is deliberate: a switch has no intermediate state worth staging, and
 * the trading switch in particular is the one control an operator may want to
 * flip in a hurry, while a half-typed name saved on every keystroke would be a
 * different name on every keystroke.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useId, useState } from 'react'
import {
  agentErrorMessage,
  agentQueryKeys,
  clearVoiceKey,
  getVoiceConfig,
  setVoiceKey,
  testVoice,
  updateVoiceConfig,
  type VoiceConfig,
  type VoiceConfigResponse,
  type VoiceConfigUpdate,
  type VoiceTestResult,
} from '@/api/agent'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { showToast } from '@/utils/toast'

/** The bounds `voice_confirm_window_seconds` is stored under, as input hints. */
const MIN_IDLE_TIMEOUT = 30
const MAX_IDLE_TIMEOUT = 3600
const MIN_CONFIRM_WINDOW = 5
const MAX_CONFIRM_WINDOW = 300

/** What the name is allowed to be, as an input hint. */
const MAX_NAME_CHARS = 40

/** The typed half of the configuration, held as text while it is edited. */
interface Draft {
  model: string
  speaker: string
  agentName: string
  confirmWindow: string
  idleTimeout: string
}

function toDraft(config: VoiceConfig): Draft {
  return {
    model: config.voice_model,
    speaker: config.voice_speaker,
    agentName: config.voice_agent_name,
    confirmWindow: String(config.voice_confirm_window_seconds),
    idleTimeout: String(config.voice_idle_timeout_seconds),
  }
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.model === b.model &&
    a.speaker === b.speaker &&
    a.agentName === b.agentName &&
    a.confirmWindow === b.confirmWindow &&
    a.idleTimeout === b.idleTimeout
  )
}

/**
 * A whole number, or null when the text is not one.
 *
 * The only local validation on the window, and for the same reason WebSearch
 * has it: the payload is typed as a number, so a value that is not one cannot
 * travel to the server to collect the server's own message. The range itself is
 * the server's to refuse.
 */
function parseWhole(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return Number.isSafeInteger(value) ? value : null
}

/**
 * A naive UTC timestamp rendered in the reader's own timezone.
 *
 * The server sends `2026-09-02T10:11:12` with no offset, which `Date` reads as
 * local time, so a key used an hour ago would otherwise be reported five and a
 * half hours in the future.
 */
function formatUtc(value: string | null): string {
  if (!value) return 'never'
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

/** A test outcome, whether the vendor answered it or the request itself failed. */
interface TestOutcome {
  ok: boolean
  message: string
  latencyMs: number
  model: string
}

export function VoicePanel() {
  const queryClient = useQueryClient()
  const fieldId = useId()

  const query = useQuery({
    queryKey: agentQueryKeys.voice(),
    queryFn: getVoiceConfig,
    staleTime: 30_000,
  })

  const config = query.data?.data ?? null
  const defaults = query.data?.defaults ?? null

  // Null means "whatever the server last said". Clearing it after a save is
  // what re-derives the form from the refreshed response, so no effect has to
  // watch the query and no stale draft can survive a successful write.
  const [draft, setDraft] = useState<Draft | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [test, setTest] = useState<TestOutcome | null>(null)
  const [clearingKey, setClearingKey] = useState(false)

  const form = draft ?? (config ? toDraft(config) : null)
  const dirty = form !== null && config !== null && !sameDraft(form, toDraft(config))

  /**
   * Every mutation answers with the whole refreshed configuration, so the cache
   * is written from the response rather than invalidated. One round trip, and
   * no window in which the screen shows the value that was just replaced.
   */
  const applyConfig = (next: VoiceConfig): void => {
    queryClient.setQueryData<VoiceConfigResponse>(agentQueryKeys.voice(), (prev) =>
      prev ? { ...prev, data: next } : prev
    )
  }

  // A switch, applied on toggle. Kept separate from the form save so a toggle
  // never discards what somebody is part way through typing.
  const saveSwitch = useMutation({
    mutationFn: (values: VoiceConfigUpdate) => updateVoiceConfig(values),
    onSuccess: (next) => {
      applyConfig(next)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(agentErrorMessage(error, 'Could not change the voice setting.'))
    },
  })

  const saveSettings = useMutation({
    mutationFn: (values: VoiceConfigUpdate) => updateVoiceConfig(values),
    onSuccess: (next) => {
      applyConfig(next)
      setDraft(null)
      setFormError(null)
      showToast.success('语音设置已保存')
    },
    onError: (error) => {
      setFormError(agentErrorMessage(error, 'Could not save the voice settings.'))
    },
  })

  const saveKey = useMutation({
    mutationFn: (apiKey: string) => setVoiceKey(apiKey),
    onSuccess: (next) => {
      applyConfig(next)
      // Cleared on the way out, not held for a retry: the field is write only
      // and a key sitting in component state is a key on the screen.
      setKeyDraft('')
      setTest(null)
      showToast.success('Key saved')
    },
    onError: (error) => {
      showToast.error(agentErrorMessage(error, '无法保存密钥。'))
    },
  })

  const removeKey = useMutation({
    mutationFn: () => clearVoiceKey(),
    onSuccess: (next) => {
      applyConfig(next)
      setTest(null)
      showToast.success('密钥已移除')
    },
    onError: (error) => {
      showToast.error(agentErrorMessage(error, '无法移除密钥。'))
    },
  })

  const runTest = useMutation({
    mutationFn: () => testVoice(),
    onSuccess: (result: VoiceTestResult) => {
      // A passing test updates the key's last use, so the refreshed config it
      // hands back is what the fingerprint line should be reading from.
      if (result.data) applyConfig(result.data)
      setTest({
        ok: result.ok,
        message: result.message,
        latencyMs: result.latency_ms,
        model: result.model,
      })
    },
    onError: (error) => {
      setTest({
        ok: false,
        message: agentErrorMessage(error, 'The test could not be run.'),
        latencyMs: 0,
        model: '',
      })
    },
  })

  const submit = (): void => {
    if (!form || !config) return
    setFormError(null)

    const window = parseWhole(form.confirmWindow)
    if (window === null) {
      setFormError('The approval window must be a whole number of seconds.')
      return
    }
    const idle = parseWhole(form.idleTimeout)
    if (idle === null) {
      setFormError('The quiet timeout must be a whole number of seconds.')
      return
    }

    // Only what moved, except for the two spoken values, which travel together
    // whenever either of them has: the server validates them as a pair and
    // re-writes the word when the name changes, so sending one alone would have
    // it validated against a value the operator is no longer looking at.
    const values: VoiceConfigUpdate = {}
    if (form.model.trim() !== config.voice_model) values.voice_model = form.model.trim()
    if (form.speaker !== config.voice_speaker) values.voice_speaker = form.speaker
    const nameMoved = form.agentName.trim() !== config.voice_agent_name
    if (nameMoved) {
      values.voice_agent_name = form.agentName.trim()
    }
    if (window !== config.voice_confirm_window_seconds) {
      values.voice_confirm_window_seconds = window
    }
    if (idle !== config.voice_idle_timeout_seconds) {
      values.voice_idle_timeout_seconds = idle
    }

    if (Object.keys(values).length === 0) {
      setDraft(null)
      return
    }
    saveSettings.mutate(values)
  }

  const switchesBusy = saveSwitch.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>语音</CardTitle>
        <CardDescription>
          A spoken surface on the same agent. The speech model hears and speaks and decides nothing:
          every answer it reads out is produced by the model you configured above, through the same
          tools and the same limits a typed question goes through, and the full answer lands on
          screen as an ordinary message. Audio goes from your browser straight to OpenAI; the only
          thing this server does is mint the session with the key below.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {query.isLoading ? <VoiceSkeleton /> : null}

        {query.isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>
                {agentErrorMessage(query.error, 'The voice configuration could not be loaded.')}
              </span>
              <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
                重试
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {config && form ? (
          <>
            <div className="rounded-lg border border-border">
              <div className="flex items-start gap-3 p-4">
                <Switch
                  id={`${fieldId}-enabled`}
                  checked={config.voice_enabled}
                  disabled={switchesBusy}
                  onCheckedChange={(next) => saveSwitch.mutate({ voice_enabled: next })}
                  aria-describedby={`${fieldId}-enabled-help`}
                />
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`${fieldId}-enabled`} className="text-sm font-medium">
                    允许智能体听取语音并回答
                  </Label>
                  <p id={`${fieldId}-enabled-help`} className="mt-1 text-sm text-muted-foreground">
                    {config.voice_enabled
                      ? '聊天输入框会显示麦克风按钮，只有按下后才会开始收音。'
                      : '麦克风按钮不会显示，无法启动语音功能。'}
                  </p>
                  {config.voice_enabled && !config.key.has_value ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      尚未保存 OpenAI 密钥，无法创建会话。请在下方添加。
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-model`}>语音模型</Label>
                <Input
                  id={`${fieldId}-model`}
                  value={form.model}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => setDraft({ ...form, model: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {defaults
                    ? `用于语音识别和回答的模型，默认值为 ${defaults.voice_model}。`
                    : '用于语音识别和回答的模型。'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-speaker`}>语音</Label>
                <Select
                  value={form.speaker}
                  onValueChange={(next) => setDraft({ ...form, speaker: next })}
                >
                  <SelectTrigger id={`${fieldId}-speaker`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.speakers.map((speaker) => (
                      <SelectItem key={speaker} value={speaker}>
                        {speaker}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  选择用于回答的 OpenAI 声音。列表仅供参考，实际可用声音取决于您的账户。
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">你为助手设置的称呼</h3>
                <p className="text-xs text-muted-foreground">
                  用于唤起智能体的称呼本身不代表授权。订单需在智能体复述后由您出声确认，或点击屏幕上的确认卡片批准。
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-name`}>名称</Label>
                  <Input
                    id={`${fieldId}-name`}
                    value={form.agentName}
                    maxLength={MAX_NAME_CHARS}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(event) => setDraft({ ...form, agentName: event.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {`可输入字母和空格，最多 ${MAX_NAME_CHARS} 个字符。`}
                    {defaults ? ` 留空可恢复为 ${defaults.voice_agent_name}。` : ''}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">语音下单</h3>
                <p className="text-xs text-muted-foreground">
                  此功能默认关闭。关闭时语音功能只能读取数据：智能体可以回答问题和绘制图表，但无法使用下单、修改或撤单工具，会拒绝交易请求，也不会发起审批。
                </p>
              </div>

              {/* Nested rather than beside the other controls, because this
                  setting is an `and` with the agent's trading switch and never
                  an `or`. Rendering it as a peer would show a switch that looks
                  like it decides something on an instance where it decides
                  nothing. */}
              <div className="rounded-lg border border-border border-l-4 border-l-muted-foreground/40">
                <div className="flex items-start gap-3 p-4">
                  <Switch
                    id={`${fieldId}-voice-trading`}
                    checked={config.voice_trading_enabled}
                    disabled={switchesBusy}
                    onCheckedChange={(next) => saveSwitch.mutate({ voice_trading_enabled: next })}
                    aria-describedby={`${fieldId}-voice-trading-help`}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={`${fieldId}-voice-trading`} className="text-sm font-medium">
                        允许语音请求使用订单工具
                      </Label>
                      <Badge variant={config.trading_effective ? 'secondary' : 'outline'}>
                        {config.trading_effective ? '可用' : '不可用'}
                      </Badge>
                    </div>
                    <p
                      id={`${fieldId}-voice-trading-help`}
                      className="text-sm text-muted-foreground"
                    >
                      此选项受上方交易总开关控制，只能限制语音功能的权限，不能单独赋予交易权限。
                    </p>

                    {config.trading_enabled_master ? null : (
                      <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        智能体的交易总开关当前已关闭，因此开启此选项不会生效。在打开总开关之前，无论语音还是文字均无法使用订单工具。
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-window`}>审批时间窗口（秒）</Label>
                  <Input
                    id={`${fieldId}-window`}
                    type="number"
                    min={MIN_CONFIRM_WINDOW}
                    max={MAX_CONFIRM_WINDOW}
                    step={1}
                    value={form.confirmWindow}
                    onChange={(event) => setDraft({ ...form, confirmWindow: event.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {`范围为 ${MIN_CONFIRM_WINDOW} 至 ${MAX_CONFIRM_WINDOW} 秒。`}
                    {defaults ? ` 默认 ${defaults.voice_confirm_window_seconds} 秒。` : ''}仅在订单准备完毕并复述后打开，只允许尝试一次，听到第一句话后无论内容如何都会关闭。
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${fieldId}-idle`}>静音多久后停止（秒）</Label>
                  <Input
                    id={`${fieldId}-idle`}
                    type="number"
                    min={MIN_IDLE_TIMEOUT}
                    max={MAX_IDLE_TIMEOUT}
                    step={10}
                    value={form.idleTimeout}
                    onChange={(event) => setDraft({ ...form, idleTimeout: event.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {`范围为 ${MIN_IDLE_TIMEOUT} 至 ${MAX_IDLE_TIMEOUT} 秒。`}
                    {defaults ? ` 默认 ${defaults.voice_idle_timeout_seconds} 秒。` : ''}麦克风开启期间会持续计费，因为静音时仍会发送音频。此设置用于结束无人使用的会话；对话和转录内容会保留，重新开始只需点击按钮。
                  </p>
                </div>
              </div>

              {/* Stated whether or not the switch is on. An operator deciding
                  whether to turn it on is exactly the reader this paragraph is
                  for, and they read it before the switch, not after. */}
              <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                <p className="text-xs text-muted-foreground">
                  出声确认意味着：在确认窗口打开期间，附近任何人说“是”都可能提交待确认订单，智能体无法区分说话者。提交前会完整复述订单，确认后仍受上述所有限制约束。
                </p>
                <p className="mt-2">
                  屏幕上的确认卡片始终保留，您仍可点击确认；窗口关闭后，点击是唯一的批准方式。如果所在环境不适合语音确认，请保持此功能关闭并使用点击确认。
                </p>
              </div>
            </div>

            {formError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={submit} disabled={!dirty || saveSettings.isPending}>
                {saveSettings.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                保存设置
              </Button>
              <Button
                variant="ghost"
                disabled={!dirty || saveSettings.isPending}
                onClick={() => {
                  setDraft(null)
                  setFormError(null)
                }}
              >
                放弃更改
              </Button>
              {dirty ? (
                <span className="text-xs text-muted-foreground">
                  更改尚未保存；上方文字仍描述当前生效的设置。
                </span>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">OpenAI 密钥</h3>
                <p className="text-xs text-muted-foreground">
                  Used only to mint the speech session, and stored encrypted in this instance's own
                  database rather than in a configuration file. It is separate from any OpenAI model
                  key above on purpose: the intelligence can run on Claude, or on a local model,
                  while OpenAI supplies the ears and the mouth. The key is write only. It is never
                  sent back to this screen, so the field starts empty even when one is stored.
                </p>
              </div>

              <div className="space-y-2 rounded-lg border p-4">
                <Label htmlFor={`${fieldId}-key`} className="text-xs">
                  API key
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id={`${fieldId}-key`}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    className="max-w-md flex-1"
                    placeholder={
                      config.key.has_value
                        ? 'Leave empty to keep the stored key'
                        : 'Paste the OpenAI key'
                    }
                    value={keyDraft}
                    onChange={(event) => setKeyDraft(event.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={keyDraft.trim() === '' || saveKey.isPending}
                    onClick={() => saveKey.mutate(keyDraft)}
                  >
                    {saveKey.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    Save key
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!config.key.has_value || runTest.isPending}
                    onClick={() => runTest.mutate()}
                  >
                    {runTest.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    Test
                  </Button>
                  {config.key.has_value ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={removeKey.isPending}
                      onClick={() => setClearingKey(true)}
                    >
                      移除密钥
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {config.key.has_value ? (
                    <>
                      Stored key <span className="font-mono">{config.key.fingerprint}</span>. Last
                      used {formatUtc(config.key.last_used_at)}. Test mints one session and throws
                      it away; no audio is involved.
                    </>
                  ) : (
                    <>尚未保存密钥。请粘贴并保存，然后进行测试。</>
                  )}
                </p>

                {test ? <TestResult test={test} /> : null}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>

      <AlertDialog open={clearingKey} onOpenChange={(open) => !open && setClearingKey(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除 OpenAI 语音密钥</AlertDialogTitle>
            <AlertDialogDescription>
              The stored key cannot be read back, so removing it means pasting it again from
              wherever you keep it. The voice surface stops working until a key is stored again; the
              settings themselves are left alone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                removeKey.mutate()
                setClearingKey(false)
              }}
            >
              移除密钥
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function TestResult({ test }: { test: TestOutcome }) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-xs',
        test.ok
          ? 'border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:border-emerald-600/60 dark:bg-emerald-950/40 dark:text-emerald-200'
          : 'border-destructive/50 bg-destructive/5 text-destructive'
      )}
    >
      <p>{test.message}</p>
      <p className="mt-1 tabular-nums opacity-80">
        {test.latencyMs} ms{test.model ? `, ${test.model}` : ''}
      </p>
    </div>
  )
}

function VoiceSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  )
}
