import {
  ArrowRight,
  Blocks,
  BookOpen,
  Bot,
  CandlestickChart,
  ClipboardList,
  Download,
  GraduationCap,
  HelpCircle,
  LogIn,
  Menu,
  MessageCircle,
  Moon,
  Server,
  ShieldCheck,
  Sigma,
  Sparkles,
  Sun,
  Wand2,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Footer } from '@/components/layout/Footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { tools } from '@/lib/tools'
import { useThemeStore } from '@/stores/themeStore'

const integrations = [
  'Amibroker',
  'TradingView',
  'GoCharting',
  'Python',
  'MetaTrader',
  'N8N',
  'Java',
  'Go',
  '.NET',
  'Node.js',
  'Rust',
  'ChartInk',
  'Excel',
  'Google Sheets',
  'OpenClaw',
  'Telegram',
]

// Open Varsity (openalgo.in/learn) course count, shown in the hero pill.
const VARSITY_COURSES = 13

// The surfaces that share one broker session and feed inside a single
// self-hosted instance. Counts come from the code: tools.length is the /tools
// registry, nodeTypes in components/flow/nodes is the Flow palette, and the
// indicator count is what openalgo-charts ships.
const platformDesks = [
  {
    icon: Server,
    title: '自托管算法交易',
    desc: '在自己的服务器上运行统一交易商 API 和执行引擎，支持 TradingView、Amibroker、ChartInk、Excel、Python 和 MCP。',
  },
  {
    icon: CandlestickChart,
    title: '图表交易平台',
    desc: '在内置终端的图表上提交和管理委托，并使用 102 个指标分析真实行情。',
  },
  {
    icon: Blocks,
    title: '无代码策略构建',
    desc: 'Flow 提供拖放画布，可连接 61 种触发器、指标、条件和委托节点，启用后自动运行。',
  },
  {
    icon: Sigma,
    title: '期权交易平台',
    desc: `内置 ${tools.length} 个工具，涵盖期权链、希腊值、持仓量追踪、最大痛点、波动率曲面、GEX、IV 微笑、跨式组合和套利，以及投资组合与定投回测。`,
  },
  {
    icon: Zap,
    title: '短线交易平台',
    desc: '键盘驱动的短线交易终端：方向键提交看涨或看跌委托，F6 平仓，F7 撤销未成交委托。',
  },
  {
    icon: ShieldCheck,
    title: '模拟盘测试',
    desc: '分析模式使用真实行情和 1 千万模拟资金运行策略，并按交易所时间自动平仓。',
  },
]

export default function Home() {
  const { mode, toggleMode } = useThemeStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { href: '/', label: '首页', internal: true },
    { href: '/faq', label: '常见问题', internal: true },
    { href: 'https://www.openalgo.in/learn', label: '学习中心', internal: false },
    { href: 'https://openalgo.in/discord', label: '社区', internal: false },
    { href: 'https://openalgo.in/roadmap', label: '路线图', internal: false },
    { href: 'https://docs.openalgo.in', label: '文档', internal: false },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-30 h-16 w-full border-b bg-background/90 backdrop-blur">
        <nav className="container mx-auto px-4 flex h-full items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            {/* Mobile menu button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" aria-label="打开菜单">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader className="sr-only">
                  <SheetTitle>导航菜单</SheetTitle>
                  <SheetDescription>主导航和快捷链接</SheetDescription>
                </SheetHeader>
                <div className="flex items-center gap-2 mb-8">
                  <img src="/logo.png" alt="OpenAlgo" className="h-8 w-8" />
                  <span className="text-xl font-semibold">OpenAlgo</span>
                </div>
                <div className="flex flex-col gap-2">
                  <Link
                    to="/"
                    className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-accent"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                    首页
                  </Link>
                  <Link
                    to="/faq"
                    className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-accent"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <HelpCircle className="h-5 w-5" />
                    常见问题
                  </Link>
                  <Link
                    to="/download"
                    className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Download className="h-5 w-5" />
                    下载
                  </Link>
                  <a
                    href="https://www.openalgo.in/learn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-accent"
                  >
                    <GraduationCap className="h-5 w-5" />
                    学习中心
                  </a>
                  <a
                    href="https://openalgo.in/discord"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-accent"
                  >
                    <MessageCircle className="h-5 w-5" />
                    社区
                  </a>
                  <a
                    href="https://openalgo.in/roadmap"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-accent"
                  >
                    <ClipboardList className="h-5 w-5" />
                    路线图
                  </a>
                  <a
                    href="https://docs.openalgo.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-accent"
                  >
                    <BookOpen className="h-5 w-5" />
                    文档
                  </a>
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="OpenAlgo" className="h-8 w-8" />
              <span className="text-xl font-bold hidden sm:inline">OpenAlgo</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) =>
              link.internal ? (
                <Link key={link.href} to={link.href}>
                  <Button variant="ghost" size="sm">
                    {link.label}
                  </Button>
                </Link>
              ) : (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm">
                    {link.label}
                  </Button>
                </a>
              )
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Link to="/download">
              <Button size="sm">下载</Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMode}
              aria-label={mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
            >
              {mode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-20 pb-16 sm:pt-28 sm:pb-20">
          <div className="text-center max-w-4xl mx-auto">
            <a
              href="https://www.openalgo.in/learn"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] mb-8 shadow-sm transition-colors hover:border-emerald-500/40 hover:bg-card"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" />
              <span className="text-amber-700 dark:text-amber-500">初次使用</span>
              <span className="text-muted-foreground">
                - 在 Open Varsity 免费学习，共 {VARSITY_COURSES} 门课程
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="block text-foreground">你的个人</span>
              <span className="block text-primary">交易平台</span>
            </h1>
            <p className="text-lg sm:text-xl font-semibold mb-6 text-primary">
              面向算法、期权和自主交易者。开源、社区驱动、自行部署。
            </p>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              连接 TradingView、Amibroker 或自己的 Python 代码，也可以无代码构建策略。从期权链到多腿执行均可使用内置风控；在统一实时行情下进行图表交易、短线交易和分析，并可先在模拟盘测试。支持在自己的服务器上连接 30 多家交易商。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/login">
                  <LogIn className="mr-2 h-5 w-5" />
                  登录
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/download">
                  <Download className="mr-2 h-5 w-5" />
                  下载
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Integrates With */}
        <section className="container mx-auto px-4 py-12 sm:py-16">
          <p className="text-center text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-500 mb-6">
            支持集成
          </p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-4xl mx-auto">
            {integrations.map((name) => (
              <span
                key={name}
                className="rounded-full border border-border bg-card/60 px-4 py-2 text-sm text-foreground/90 shadow-sm"
              >
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* One platform, many desks */}
        <section className="container mx-auto px-4 py-16 sm:py-20">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-500 mb-6">
              <Server className="h-3.5 w-3.5" />
              一个平台，多种交易工作台
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              不仅是算法交易平台。
              <span className="block text-muted-foreground">完整的交易工作台。</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              交易执行只是起点。图表、无代码策略构建、期权分析、短线交易和模拟盘测试都运行在同一个自托管平台中。
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {platformDesks.map((desk) => (
              <Card key={desk.title} className="h-full transition-colors hover:border-amber-400/40">
                <CardContent className="space-y-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-500">
                    <desk.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-base">{desk.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desk.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Trade & Research With Your AI */}
        <section className="container mx-auto px-4 py-16 sm:py-20">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              为 AI 而设计
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              使用 AI 进行交易与研究
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              通过对话查询交易账户，或为 AI 配备图表、筛选和回测工具，让 AI 协助交易与研究。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-6xl mx-auto">
            {/* OpenAlgo MCP card */}
            <Card className="group transition-colors hover:border-purple-400/40">
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      OpenAlgo MCP
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                    </h3>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                      通过对话交易
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  将 OpenAlgo 账户连接到 Claude、Cursor、Windsurf 或 ChatGPT，通过对话提交委托、查询持仓和获取实时价格。
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {[
                    '25 项以上内置操作',
                    'Claude / Cursor / Windsurf / ChatGPT',
                    '在你的电脑上运行',
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-muted px-2.5 py-1 text-xs text-neutral-600 dark:text-neutral-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* OpenAlgo Skills card */}
            <Card className="group transition-colors hover:border-emerald-400/40">
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Wand2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      OpenAlgo Skills
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                    </h3>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                      图表、筛选与回测
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  为 AI 助手提供现成交易能力，包括图表、扫描器、自定义指标以及计入实际交易成本的回测，支持 40 多款 AI 应用。
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {['100 多个指标', '12 个现成策略', '印度 / 美国 / 加密货币'].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-muted px-2.5 py-1 text-xs text-neutral-600 dark:text-neutral-400"
                      >
                        {tag}
                      </span>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
