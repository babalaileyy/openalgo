/**
 * The agent's external data switch, and a connection test for each server.
 *
 * The servers are read-only market data services reached over MCP. Their
 * titles and descriptions come from the registry through `/agent/api/mcp`, so
 * adding a server there needs no change here. The switch is on by default
 * because nothing they offer can touch the account; turning it off withholds
 * the tools from every surface on the next message, so the agent answers from
 * the broker alone.
 *
 * The test is a real call: it starts a fresh session with each server and
 * lists its tools. A public gateway can be slow or down for minutes at a
 * time, so a failure here names whose side the fault is on, which is the one
 * thing an operator needs to know before looking through their own settings.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import {
  agentErrorMessage,
  agentQueryKeys,
  getMcpServers,
  getSettings,
  type McpServerCheck,
  testMcpServers,
  updateSettings,
} from '@/api/agent'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export function McpPanel() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [checks, setChecks] = useState<Record<string, McpServerCheck>>({})

  const settings = useQuery({
    queryKey: agentQueryKeys.settings(),
    queryFn: getSettings,
  })

  const servers = useQuery({
    queryKey: agentQueryKeys.mcp(),
    queryFn: getMcpServers,
    staleTime: 5 * 60_000,
  })

  const save = useMutation({
    mutationFn: (enabled: boolean) => updateSettings({ mcp_enabled: enabled }),
    onSuccess: (data) => {
      setError(null)
      queryClient.setQueryData(agentQueryKeys.settings(), (previous: unknown) =>
        previous && typeof previous === 'object'
          ? { ...(previous as Record<string, unknown>), data }
          : previous
      )
      void queryClient.invalidateQueries({ queryKey: agentQueryKeys.settings() })
      void queryClient.invalidateQueries({ queryKey: agentQueryKeys.mcp() })
    },
    onError: (cause) =>
      setError(agentErrorMessage(cause, '无法更改外部数据设置')),
  })

  const test = useMutation({
    mutationFn: () => testMcpServers(),
    onSuccess: (results) => {
      setError(null)
      setChecks(Object.fromEntries(results.map((result) => [result.key, result])))
    },
    onError: (cause) => setError(agentErrorMessage(cause, '无法运行连接测试')),
  })

  const enabled = settings.data?.data.mcp_enabled ?? true
  const busy = settings.isLoading || save.isPending

  // With no server registered there is nothing to switch on or test, and a
  // switch with nothing behind it reads as a feature that is broken. The
  // section appears as soon as a server is added to the registry.
  if (servers.isSuccess && (servers.data?.servers ?? []).length === 0) return null

  return (
    <section aria-labelledby="agent-mcp-heading" className="space-y-4">
      <div>
        <h2 id="agent-mcp-heading" className="text-base font-semibold">
          External data (MCP)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">智能体除交易商外还可查询的只读行情服务。这里的服务不能下单或修改订单。</p>
      </div>

      <div className="rounded-lg border border-border">
        <div className="flex items-start gap-3 p-4">
          <Switch
            id="agent-mcp-enabled"
            checked={enabled}
            disabled={busy}
            onCheckedChange={(next) => save.mutate(next)}
            aria-describedby="agent-mcp-help"
          />
          <div className="min-w-0 flex-1">
            <Label htmlFor="agent-mcp-enabled" className="text-sm font-medium">允许智能体读取外部行情数据</Label>
            <p id="agent-mcp-help" className="mt-1 text-sm text-muted-foreground">
              {enabled
                ? 'The agent can look up data from the services listed below when a question needs it. Takes effect on the next message.'
                : 'External data is off, so the agent answers from your broker alone.'}
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border p-4">
          {(servers.data?.servers ?? []).map((server) => {
            const check = checks[server.key]
            return (
              <div key={server.key} className="space-y-2">
                <div>
                  <p className="text-sm font-medium">{server.title}</p>
                  <p className="text-sm text-muted-foreground">{server.description}</p>
                </div>
                {check ? <CheckResult check={check} /> : null}
              </div>
            )
          })}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={test.isPending}
              onClick={() => test.mutate()}
            >
              {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Test connection
            </Button>
            {test.isPending ? (
              <span className="text-xs text-muted-foreground">响应较慢的服务器最多可能需要半分钟。</span>
            ) : null}
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </section>
  )
}

function CheckResult({ check }: { check: McpServerCheck }) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-xs',
        check.ok
          ? 'border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:border-emerald-600/60 dark:bg-emerald-950/40 dark:text-emerald-200'
          : 'border-destructive/50 bg-destructive/5 text-destructive'
      )}
    >
      <p>{check.message}</p>
      <p className="mt-1 tabular-nums opacity-80">{check.latency_ms} ms</p>
    </div>
  )
}
