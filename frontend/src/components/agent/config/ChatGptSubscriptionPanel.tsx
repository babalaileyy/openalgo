/**
 * Connect a ChatGPT Plus or Pro plan, so the agent can run on it.
 *
 * LiteLLM exposes the subscription as its own provider, `chatgpt`, separate
 * from `openai`. The same ten models, a different bill:
 *
 * ```
 * openai/gpt-5.4     an API key you paste  -> OpenAI API credits
 * chatgpt/gpt-5.4    an OAuth sign-in      -> your Plus or Pro plan
 * ```
 *
 * So there is no key field on this panel, and there never can be: the
 * credential is a refresh token issued by a device-code sign-in. The operator
 * presses Connect, reads a short code, types it at OpenAI's own page, and this
 * panel notices when it is approved. What they see afterwards is what an API
 * key row shows them, a fingerprint. **A token is never rendered here**, not
 * masked and not partial, and no type in this file has a field for one.
 *
 * Four states, and each one has a different next action:
 *
 * | state | what the operator sees |
 * | --- | --- |
 * | disconnected | what a plan buys them, and one Connect |
 * | connecting | the code, the link, the deadline, and Cancel |
 * | connected | the fingerprint, the account, the expiry, and Disconnect |
 * | failed or expired | what went wrong, and one retry |
 *
 * Three things about it are not obvious:
 *
 * - **The deadline is shown because it is real.** A device code is accepted for
 *   about fifteen minutes and then stops working. A panel that showed the code
 *   without the clock would leave an operator retyping a dead code and
 *   concluding the feature is broken.
 * - **The poll runs only while a sign-in is pending.** `start_login` answers in
 *   milliseconds and the wait happens on a real OS thread server side, so this
 *   screen polls a cheap status route rather than holding a request open for a
 *   quarter of an hour. It stops the moment the state is anything but pending.
 * - **Disconnect leaves the registered models alone.** A `chatgpt/` row is
 *   operator intent; this call only revokes the credential behind it. Deleting
 *   the row on their behalf would throw away a configuration they may want back
 *   the moment they sign in again, so the confirmation says so instead.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  agentErrorMessage,
  agentQueryKeys,
  cancelChatGptLogin,
  type ChatGptLogin,
  type ChatGptStatus,
  getChatGptStatus,
  removeChatGptSession,
  startChatGptLogin,
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
import { Skeleton } from '@/components/ui/skeleton'

/** How often the status route is re-read while a sign-in is waiting. */
const POLL_MS = 2000

/** How often the deadline on screen is recomputed while one is showing. */
const TICK_MS = 1000

/** How long the copy control shows its confirmation, in milliseconds. */
const COPIED_MS = 1500

/**
 * Every state this panel can be in, and it is in exactly one of them.
 *
 * Derived rather than stored, so the screen cannot disagree with the server:
 * there is one source of truth, `GET /agent/api/chatgpt/status`, and this is a
 * pure reading of it. Exported because the state machine is the part worth
 * pinning in a test, separately from how any of it is drawn.
 */
export type ChatGptPanelState =
  | 'loading'
  | 'unavailable'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'expired'

export interface ChatGptPanelInput {
  status: ChatGptStatus | undefined
  isError: boolean
}

/**
 * Which state the panel is in.
 *
 * The order of the tests is the whole design:
 *
 * 1. **A pending sign-in wins over everything**, including an existing
 *    authorisation. An operator moving this instance to a different ChatGPT
 *    account is still connected to the old one while they do it, and the code
 *    on screen is the only thing they can act on.
 * 2. **Then authorisation**, because a plan that works is the answer to the
 *    question the panel exists to ask, whatever a previous sign-in ended as.
 * 3. **Then the terminal failure states**, which are the only remaining reason
 *    to say more than "not connected".
 *
 * @param input - The status query's data and whether it failed outright.
 * @returns The single state to render.
 */
export function chatGptPanelState({ status, isError }: ChatGptPanelInput): ChatGptPanelState {
  if (!status) return isError ? 'unavailable' : 'loading'
  if (status.login.state === 'pending') return 'connecting'
  if (status.authorised) return 'connected'
  if (status.login.state === 'failed') return 'failed'
  if (status.login.state === 'expired') return 'expired'
  return 'disconnected'
}

/**
 * How long a pending device code has left, in whole seconds.
 *
 * @param login - The login snapshot.
 * @param now - Milliseconds since the epoch, passed in so the caller owns the
 *   clock and a test does not have to fake a global one.
 * @returns Seconds remaining, floored at zero, or null when the snapshot names
 *   no deadline. Null renders as nothing rather than as "expires in 0:00",
 *   which would be a countdown to a moment nobody promised.
 */
export function secondsRemaining(login: ChatGptLogin, now: number): number | null {
  if (typeof login.expires_at !== 'number' || !Number.isFinite(login.expires_at)) return null
  return Math.max(0, Math.round((login.expires_at * 1000 - now) / 1000))
}

/**
 * A countdown as minutes and seconds.
 *
 * @param seconds - Whole seconds remaining.
 * @returns `m:ss`.
 */
function formatCountdown(seconds: number): string {
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * A unix timestamp as something an operator can read.
 *
 * @param unixSeconds - Seconds since the epoch, or null.
 * @returns A local date and time, or an empty string when there is none.
 */
function formatMoment(unixSeconds: number | null): string {
  if (typeof unixSeconds !== 'number' || !Number.isFinite(unixSeconds)) return ''
  const at = new Date(unixSeconds * 1000)
  return Number.isFinite(at.getTime()) ? at.toLocaleString() : ''
}

/**
 * Put text on the clipboard, with a fallback for an insecure origin.
 *
 * `navigator.clipboard` is undefined on plain http, which a self-hosted
 * OpenAlgo reached over a LAN address is, so the textarea path is not legacy
 * support: it is the path most installs actually take. The same helper the
 * message actions use, kept local because the eight characters it moves here
 * are a device code and nothing else in this file should reach a clipboard.
 *
 * @param text - What to copy.
 * @returns Whether it landed.
 */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through. A permissions policy can reject it even on https.
    }
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(area)
  }
}

export function ChatGptSubscriptionPanel() {
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const query = useQuery({
    queryKey: agentQueryKeys.chatgpt(),
    queryFn: getChatGptStatus,
    // A 404 while the route is still being written is a permanent answer, not a
    // flaky one, so retrying it four times only delays the message.
    retry: false,
    staleTime: 15_000,
    // Only while a code is outstanding. Everything else here changes because
    // the operator pressed something, which refreshes the cache itself.
    refetchInterval: (entry) => (entry.state.data?.login.state === 'pending' ? POLL_MS : false),
    // **In the background too, and that is the whole point.** The panel tells
    // the operator to open OpenAI's page in another tab, so this one is hidden
    // for the entire wait, and a poll that pauses on a hidden tab is a poll
    // that never runs during the only period it is needed. Found in a browser:
    // with this left at its default the code sat there approved and the panel
    // went on counting down until the tab was focused again.
    refetchIntervalInBackground: true,
  })

  const status = query.data
  const state = chatGptPanelState({ status, isError: query.isError })
  const connecting = state === 'connecting'
  // Stable across renders, unlike the query object it came off, so the callback
  // below is not rebuilt on every tick of the countdown.
  const { refetch } = query

  // The clock ticks only while there is a deadline on screen. An interval that
  // ran on a connected panel would re-render it once a second forever for
  // nothing.
  useEffect(() => {
    if (!connecting) return
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(timer)
  }, [connecting])

  // The confirmation is a moment, not a state. Left latched the button reads
  // "Copied" for the rest of the sign-in, so a second copy after a failed paste
  // gives no feedback at all.
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  /** Write a fresh login snapshot into the cached status, keeping the rest. */
  const applyLogin = useCallback(
    (login: ChatGptLogin): void => {
      queryClient.setQueryData<ChatGptStatus>(agentQueryKeys.chatgpt(), (previous) =>
        previous ? { ...previous, login } : previous
      )
      // The snapshot says what the sign-in is doing; only the status route says
      // whether the plan is authorised, so a terminal state is confirmed rather
      // than assumed.
      if (login.state !== 'pending') void refetch()
    },
    [queryClient, refetch]
  )

  const connect = useMutation({
    mutationFn: (force: boolean) => startChatGptLogin(force),
    onMutate: () => {
      setActionError(null)
      setCopied(false)
      setNow(Date.now())
    },
    onSuccess: applyLogin,
    onError: (error) => {
      setActionError(agentErrorMessage(error, 'The sign-in could not be started.'))
    },
  })

  const cancel = useMutation({
    mutationFn: () => cancelChatGptLogin(),
    onSuccess: (result) => {
      setActionError(null)
      applyLogin(result.data)
    },
    onError: (error) => {
      setActionError(agentErrorMessage(error, 'The sign-in could not be cancelled.'))
    },
  })

  const disconnect = useMutation({
    mutationFn: () => removeChatGptSession(),
    onSuccess: () => {
      setActionError(null)
      void queryClient.invalidateQueries({ queryKey: agentQueryKeys.chatgpt() })
      // A plan model that can no longer run changes what the picker should say
      // about the rows that depend on it.
      void queryClient.invalidateQueries({ queryKey: agentQueryKeys.models() })
      void queryClient.invalidateQueries({ queryKey: agentQueryKeys.status() })
    },
    onError: (error) => {
      setActionError(agentErrorMessage(error, 'The plan could not be disconnected.'))
    },
  })

  const login = status?.login
  const remaining = login ? secondsRemaining(login, now) : null
  const busy = connect.isPending || cancel.isPending || disconnect.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          ChatGPT 订阅
          {state === 'connected' ? <Badge variant="secondary">已连接</Badge> : null}
        </CardTitle>
        <CardDescription>
          ChatGPT Plus 或 Pro 套餐提供另一种计费方式。注册在 <span className="font-mono">chatgpt/</span> 下的模型使用您的套餐；<span className="font-mono">openai/</span> 下的同一模型消耗 API 额度。在此登录后，下方目录即可使用 <span className="font-mono">chatgpt/</span> 模型。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {state === 'loading' ? (
          <div className="space-y-2" aria-busy="true">
            <span className="sr-only">正在检查是否已连接 ChatGPT 订阅</span>
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-9 w-40" />
          </div>
        ) : null}

        {state === 'unavailable' ? (
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription className="space-y-2">
              <p>
                服务器暂时无法查询 ChatGPT 套餐。{' '}
                {agentErrorMessage(query.error, '状态请求失败。')}
              </p>
              <p>
                此订阅需要支持 ChatGPT 服务商的较新版本 LiteLLM。页面其他功能及使用 API 密钥的模型不受影响。
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void refetch()
                }}
              >
                重试
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {state === 'disconnected' ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              尚未连接套餐，因此 <span className="font-mono">chatgpt/</span> 模型无法运行。连接时会打开 OpenAI 登录页面，仅将返回的凭据加密保存在此实例的数据库中。
            </p>
            <Button type="button" disabled={busy} onClick={() => connect.mutate(false)}>
              {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              连接 ChatGPT 套餐
            </Button>
          </div>
        ) : null}

        {state === 'failed' || state === 'expired' ? (
          <div className="space-y-3">
            <Alert variant={state === 'expired' ? 'warning' : 'destructive'}>
              <AlertCircle className="h-4 w-4" aria-hidden />
              <AlertDescription>
                {state === 'expired'
                  ? '未及时输入代码，代码已失效。请重新开始以获取新代码。'
                  : login?.message?.trim() || '登录未完成。'}
              </AlertDescription>
            </Alert>
            <Button type="button" disabled={busy} onClick={() => connect.mutate(false)}>
              {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              重新连接
            </Button>
          </div>
        ) : null}

        {connecting && login ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                您的代码
              </p>
              <p className="mt-2 font-mono text-3xl leading-tight font-semibold break-all select-all">
                {login.user_code || '等待中'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!login.user_code}
                  onClick={() => {
                    void copyText(login.user_code).then((ok) => setCopied(ok))
                  }}
                >
                  {copied ? '已复制' : '复制代码'}
                </Button>
                {login.verification_url ? (
                  <Button asChild size="sm">
                    <a href={login.verification_url} target="_blank" rel="noreferrer noopener">
                      打开登录页面
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </a>
                  </Button>
                ) : null}
                {remaining === null ? null : (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {remaining > 0
                      ? `剩余有效时间 ${formatCountdown(remaining)}`
                      : '代码已过期，请取消并重新开始。'}
                  </span>
                )}
              </div>
            </div>

            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>打开登录页面，将在新标签页进入 OpenAI 官方网站。</li>
              <li>请使用订阅 ChatGPT 的账户登录。</li>
              <li>出现提示时输入上方代码。</li>
              <li>返回此处，面板会在几秒内自动检测到。</li>
            </ol>

            <p className="text-xs text-muted-foreground">
              代码有效期约为 15 分钟。此代码仅供您本人使用；如果其他地方要求输入，请取消操作。
            </p>

            <Button type="button" variant="outline" disabled={busy} onClick={() => cancel.mutate()}>
              {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              取消登录
            </Button>
          </div>
        ) : null}

        {state === 'connected' && status ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">凭据</dt>
                <dd className="truncate font-mono text-xs" title={status.fingerprint}>
                  {status.fingerprint}
                </dd>
              </div>
              {status.account_id ? (
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">账户</dt>
                  <dd className="truncate font-mono text-xs" title={status.account_id}>
                    {status.account_id}
                  </dd>
                </div>
              ) : null}
              {status.expiry === null ? null : (
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">访问令牌到期时间</dt>
                  <dd className="text-xs">
                    {formatMoment(status.expiry)}。令牌会自动刷新。
                  </dd>
                </div>
              )}
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">已保存</dt>
                {/* The path is its own element with `break-all`, and that is not
                    cosmetic: a Windows path is one unbroken token, so left in
                    the sentence it sets the column's min-content width and the
                    whole grid overhangs the card on a narrow screen. Measured
                    at a 310px card: the row ran 59px past its own border. */}
                <dd className="text-xs">
                  {status.stored_in_database
                    ? '加密保存在此实例的数据库中，LiteLLM 缓存位置：'
                    : '仅保存在磁盘：'}
                  <span className="font-mono break-all">{status.token_dir}</span>
                </dd>
              </div>
            </dl>

            <p className="text-sm text-muted-foreground">
              使用 <span className="font-mono">chatgpt/</span> 模型的对话由此套餐覆盖，不按 token 单独计费；<span className="font-mono">openai/</span> 下的同一模型仍消耗 API 额度。
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => connect.mutate(true)}
              >
                {connect.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                重新登录
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmingDisconnect(true)}
              >
                断开连接
              </Button>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      <AlertDialog
        open={confirmingDisconnect}
        onOpenChange={(open) => !open && setConfirmingDisconnect(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>断开 ChatGPT 订阅</AlertDialogTitle>
            <AlertDialogDescription>
              已存凭据将被删除且无法找回，重新连接时需要再次登录。已注册的 chatgpt/ 模型会保留在列表中，但在重新连接前无法使用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>保持连接</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmingDisconnect(false)
                disconnect.mutate()
              }}
            >
              断开连接
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
