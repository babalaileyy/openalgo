import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Boxes,
  CandlestickChart,
  ClipboardList,
  Code2,
  Database,
  FileBarChart,
  FileStack,
  FileText,
  FlaskConical,
  Gauge,
  Key,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  MessageCircle,
  MessageSquare,
  Search,
  Settings,
  TrendingUp,
  User,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Served by Flask (not a React route): render as a full-page link. */
  external?: boolean
  /**
   * Desktop navbar only: below this Tailwind breakpoint the item leaves the
   * bar and is listed under More instead. Items without it always stay.
   */
  collapseBelow?: 'lg' | 'xl'
}

// Main navigation items shown in desktop navbar
export const navItems: NavItem[] = [
  { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { href: '/orderbook', label: '委托', icon: ClipboardList },
  { href: '/tradebook', label: '成交', icon: FileText, collapseBelow: 'lg' },
  { href: '/positions', label: '持仓', icon: TrendingUp },
  { href: '/trading', label: '图表交易', icon: CandlestickChart, collapseBelow: 'lg' },
  { href: '/platforms', label: '交易平台', icon: Layers, collapseBelow: 'xl' },
  { href: '/strategy', label: '策略', icon: Boxes, collapseBelow: 'xl' },
  { href: '/logs', label: '日志', icon: FileBarChart, collapseBelow: 'xl' },
  { href: '/tools', label: '工具', icon: Wrench, collapseBelow: 'xl' },
]

// Items shown in mobile bottom navigation
export const bottomNavItems: NavItem[] = [
  { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { href: '/orderbook', label: '委托', icon: ClipboardList },
  { href: '/tradebook', label: '成交', icon: FileText },
  { href: '/positions', label: '持仓', icon: TrendingUp },
]

// Paths in bottom nav (for filtering mobile sheet items)
const bottomNavPaths = bottomNavItems.map((item) => item.href)

// Secondary items for mobile sheet (items not in bottom nav)
export const mobileSheetItems = navItems.filter((item) => !bottomNavPaths.includes(item.href))

// Profile dropdown menu items
export const profileMenuItems: NavItem[] = [
  { href: '/profile', label: '个人资料', icon: User },
  { href: '/apikey', label: 'API 密钥', icon: Key },
  // Action Center stays immediately after API Key. It was moved here out of the
  // main navbar on that understanding and a test pins the adjacency, so a new
  // entry goes after it rather than between the two.
  { href: '/action-center', label: '操作中心', icon: Bell },
  // Agent Config is NOT here. It lives under /admin with the other
  // configuration surfaces. The chat header carries its own settings control,
  // so a configured /agent still has a route back to its settings without this
  // menu holding one.
  { href: '/agent', label: '智能助手', icon: Bot },
  { href: '/master-contract', label: '合约数据', icon: FileStack },
  { href: '/telegram', label: 'Telegram 机器人', icon: MessageSquare },
  { href: '/whatsapp', label: 'WhatsApp 机器人', icon: MessageCircle },
  { href: '/holdings', label: '资产', icon: ClipboardList },
  { href: '/flow', label: '流程编辑器', icon: Workflow },
  { href: '/scalping', label: '短线交易', icon: Zap },
  { href: '/python', label: 'Python 策略', icon: Code2 },
  { href: '/pnl-tracker', label: '盈亏追踪', icon: BarChart3 },
  { href: '/historify', label: '历史数据', icon: Database },
  { href: '/search/token', label: '搜索', icon: Search },
  { href: '/sandbox', label: '模拟交易', icon: FlaskConical },
  { href: '/leverage', label: '杠杆', icon: Gauge },
  { href: '/admin', label: '管理', icon: Settings },
]

// External links
export const externalLinks = {
  docs: { href: 'https://docs.openalgo.in', label: '文档', icon: BookOpen },
}

// Shared utility to check if a route is active.
// Every nav item is a leaf route, so an exact match is all that is needed.
export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href
}
