import {
  Activity,
  ArrowRight,
  Bot,
  Calendar,
  Clock,
  Gauge,
  Globe,
  Settings,
  Shield,
  Snowflake,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { adminApi } from '@/api/admin'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminStats } from '@/types/admin'

export default function AdminIndex() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await adminApi.getStats()
        setStats(data)
      } catch (_error) {
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  const adminCards = [
    {
      title: '单笔数量限制',
      description: '管理期货及期权的单笔数量限制，用于拆分委托',
      icon: Snowflake,
      href: '/admin/freeze',
      count: stats?.freeze_count,
      countLabel: '条记录',
      color: 'bg-blue-500',
    },
    {
      title: '市场假日',
      description: '查看和管理所有交易所的市场假日',
      icon: Calendar,
      href: '/admin/holidays',
      count: stats?.holiday_count,
      countLabel: '个假日',
      color: 'bg-green-500',
    },
    {
      title: '市场交易时间',
      description: '配置各交易所的交易时段',
      icon: Clock,
      href: '/admin/timings',
      count: 7,
      countLabel: '个交易所',
      color: 'bg-purple-500',
    },
    {
      title: '安全看板',
      description: '监控 IP 封禁、API 滥用和安全威胁',
      icon: Shield,
      href: '/logs/security',
      countLabel: '监控',
      color: 'bg-red-500',
    },
    {
      title: '流量看板',
      description: '监控 HTTP 流量和 API 请求日志',
      icon: Activity,
      href: '/logs/traffic',
      countLabel: '监控',
      color: 'bg-cyan-500',
    },
    {
      title: '延迟看板',
      description: '监控委托执行及 API 延迟',
      icon: Zap,
      href: '/logs/latency',
      countLabel: '监控',
      color: 'bg-orange-500',
    },
    {
      title: '诊断',
      description: '查看系统信息、错误和延迟探测，并下载支持报告',
      icon: Gauge,
      href: '/admin/diagnostics',
      countLabel: '故障排查',
      color: 'bg-indigo-500',
    },
    {
      title: '助手配置',
      description: '配置模型服务商、API 密钥、交易开关和网页搜索',
      icon: Bot,
      href: '/agent/config',
      countLabel: '模型与密钥',
      color: 'bg-violet-500',
    },
    {
      title: '远程 MCP',
      description: '审批 OAuth 客户端、查看工具调用审计日志和紧急开关',
      icon: Globe,
      href: '/admin/remote-mcp',
      countLabel: 'AI 客户端',
      color: 'bg-teal-500',
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          管理控制台
        </h1>
        <p className="text-muted-foreground mt-1">
          管理系统设置、市场数据和配置
        </p>
      </div>

      {/* Admin Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminCards.map((card) => (
          <Link key={card.href} to={card.href}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div
                    className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center`}
                  >
                    <card.icon className="h-5 w-5 text-white" />
                  </div>
                  {card.count !== undefined && (
                    <Badge variant="secondary">
                      {card.count} {card.countLabel}
                    </Badge>
                  )}
                </div>
                <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
                  {card.title}
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  点击管理{card.title}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Info Section */}
      <Card>
        <CardHeader>
          <CardTitle>关于管理设置</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-muted-foreground">
            管理控制台提供以下重要系统配置工具：
          </p>
          <ul className="text-muted-foreground space-y-2 list-disc list-inside">
            <li>
              <strong>单笔数量限制：</strong> 设置期货及期权的单笔最大委托数量，超出限制的委托会自动拆分。
            </li>
            <li>
              <strong>市场假日：</strong> 维护所有支持交易所的假日日历（NSE、BSE、NFO、BFO、MCX、CDS、BCD）。
            </li>
            <li>
              <strong>市场交易时间：</strong> 配置各交易所的交易时段，包括 Muhurat 等特殊交易时段。
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
