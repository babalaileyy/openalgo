import {
  Activity,
  ArrowRight,
  ClipboardList,
  Clock,
  FileText,
  FlaskConical,
  HeartPulse,
  Shield,
} from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LogsIndex() {
  const logCards = [
    {
      title: '实时日志',
      description: '查看实时 API 委托日志、请求和响应数据',
      icon: ClipboardList,
      href: '/logs/live',
      color: 'bg-blue-500',
      countLabel: '委托',
    },
    {
      title: '模拟盘日志',
      description: '在实盘前追踪和测试交易策略',
      icon: FlaskConical,
      href: '/logs/sandbox',
      color: 'bg-purple-500',
      countLabel: '测试',
    },
    {
      title: '延迟监控',
      description: '追踪委托执行延迟及性能指标',
      icon: Clock,
      href: '/logs/latency',
      color: 'bg-orange-500',
      countLabel: '监控',
    },
    {
      title: '流量监控',
      description: '监控 HTTP 请求、接口及响应时间',
      icon: Activity,
      href: '/logs/traffic',
      color: 'bg-cyan-500',
      countLabel: '监控',
    },
    {
      title: '安全日志',
      description: '监控安全事件、封禁 IP 和威胁活动',
      icon: Shield,
      href: '/logs/security',
      color: 'bg-red-500',
      countLabel: '安全',
    },
    {
      title: '健康监控',
      description: '追踪系统健康状况、文件描述符、内存及连接',
      icon: HeartPulse,
      href: '/health',
      color: 'bg-green-500',
      countLabel: '健康',
    },
  ]

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          日志与监控
        </h1>
        <p className="text-muted-foreground mt-1">
          查看交易日志、监控系统性能并追踪安全事件
        </p>
      </div>

      {/* Log Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {logCards.map((card) => (
          <Link key={card.href} to={card.href}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div
                    className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center`}
                  >
                    <card.icon className="h-5 w-5 text-white" />
                  </div>
                  <Badge variant="secondary">{card.countLabel}</Badge>
                </div>
                <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
                  {card.title}
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  点击查看{card.title}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
