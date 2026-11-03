/**
 * The tool registry, shared by the /tools page and the home page.
 *
 * Lives here rather than inside the page so the home page can state how many
 * tools exist without importing the page component -- and so the number is
 * derived rather than typed. A hardcoded count goes stale the moment a tool is
 * added, which is exactly how the previous "15+" survived three new tools.
 */
export interface Tool {
  title: string
  description: string
  href: string
  color: string
}

export const tools: Tool[] = [
  {
    title: '期权策略构建器',
    description:
      '构建多腿期权策略，查看实时希腊值、损益图及情景模拟',
    href: '/strategybuilder',
    color: 'bg-fuchsia-500',
  },
  {
    title: '策略组合',
    description: '查看交易和模拟自选列表中保存的策略',
    href: '/strategybuilder/portfolio',
    color: 'bg-violet-500',
  },
  {
    title: '投资组合回测',
    description:
      '对照指数回测加权投资组合，涵盖实际交割成本、再平衡规则、危机时段和完整分析报告',
    href: '/portfolio-backtester',
    color: 'bg-emerald-500',
  },
  {
    title: '定投回测',
    description:
      '回测每月、每周或每季度定投的收益，比较 XIRR、成本摊平、起投日期影响及一次性投入',
    href: '/sip-backtester',
    color: 'bg-emerald-500',
  },
  {
    title: '投资组合分析',
    description:
      '分析实际持仓的集中度、相关走势、抗回撤能力及历史危机表现',
    href: '/portfolio-analyzer',
    color: 'bg-sky-500',
  },
  {
    title: '板块轮动',
    description:
      '对照基准分析 NSE 板块、股票和指数的领先、转弱、落后与改善走势，支持日线或周线轨迹',
    href: '/sector-rotation',
    color: 'bg-cyan-500',
  },
  {
    title: '期权链',
    description: '实时期权链，提供希腊值、持仓量数据和快捷下单',
    href: '/optionchain',
    color: 'bg-emerald-500',
  },
  {
    title: '期权希腊值',
    description: '查看平值期权的历史隐含波动率及 Delta、Theta、Vega、Gamma 图表',
    href: '/ivchart',
    color: 'bg-violet-500',
  },
  {
    title: '持仓量追踪',
    description: '分析看涨／看跌期权持仓量，叠加看跌看涨比并标记平值行权价',
    href: '/oitracker',
    color: 'bg-blue-500',
  },
  {
    title: '持仓量区间',
    description:
      '按自定义行权价区间分析持仓量，支持按平值行权价快速选择及每分钟自动刷新',
    href: '/oirange',
    color: 'bg-sky-500',
  },
  {
    title: '最大痛点',
    description: '计算最大痛点行权价，并展示各行权价的损失分布',
    href: '/maxpain',
    color: 'bg-amber-500',
  },
  {
    title: '跨式策略图表',
    description:
      '动态平值跨式策略图表，支持滚动行权价及叠加现货和合成期货',
    href: '/straddle',
    color: 'bg-teal-500',
  },
  {
    title: '跨式策略盈亏',
    description:
      '模拟日内平值跨式策略盈亏，支持按设定点数自动调整并记录交易',
    href: '/straddlepnl',
    color: 'bg-orange-500',
  },
  {
    title: '波动率曲面',
    description:
      '根据实时期权链绘制不同行权价和到期日的三维隐含波动率曲面',
    href: '/volsurface',
    color: 'bg-rose-500',
  },
  {
    title: '伽马敞口分析',
    description: '分析伽马敞口，包括持仓量墙、各行权价净伽马敞口和主要伽马行权价',
    href: '/gex',
    color: 'bg-indigo-500',
  },
  {
    title: '行权价分布',
    description:
      '按行权价和到期日展示伽马与德尔塔敞口热力图、到期峰值、伽马翻转点及看涨／看跌持仓墙',
    href: '/strikeprofile',
    color: 'bg-blue-600',
  },
  {
    title: '伽马密度',
    description:
      '展示伽马乘持仓量密度和凸性区域，支持日内及到期视图、平值隐含波动率和预期波动区间',
    href: '/gammadensity',
    color: 'bg-lime-500',
  },
  {
    title: '隐含波动率微笑',
    description: '查看看涨／看跌期权隐含波动率曲线、平值波动率及偏斜分析',
    href: '/ivsmile',
    color: 'bg-cyan-500',
  },
  {
    title: '持仓量分布',
    description: '展示期货 K 线、持仓量蝶形图及各行权价每日持仓量变化',
    href: '/oiprofile',
    color: 'bg-orange-500',
  },
  {
    title: '套利扫描',
    description:
      '实时扫描 NFO 和 MCX 期货跨期价差，按可成交买卖价差百分比排序，支持一键双腿下单',
    href: '/arbitrage',
    color: 'bg-green-600',
  },
]
