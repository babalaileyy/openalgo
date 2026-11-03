/**
 * Plain-English guide to the backtest metrics, with the portfolio's own value
 * marked on each scale.
 *
 * A table of numbers tells a reader what the portfolio scored and nothing about
 * whether that is good. Every card here says what the metric means, what counts
 * as good, and puts a marker where this portfolio actually landed, so the
 * judgement is made for them rather than left as an exercise.
 *
 * The scales are judgement calls stated openly rather than hidden: a Sharpe of
 * 1.0 being "good" is a convention, not a law, and the labels say where the
 * boundaries were drawn so a reader can disagree with them.
 */
import { cn } from '@/lib/utils'

type Direction = 'higher' | 'lower' | 'centre'

interface Spec {
  key: string
  label: string
  badge: string
  badgeClass: string
  meaning: string
  /** Value at each end of the bar, and the label under each third. */
  from: number
  to: number
  stops: [string, string, string]
  direction: Direction
  format: (v: number) => string
  /**
   * The rating and the sentence for a given value. Written per metric rather
   * than derived from the bar position, because "beta 1.0" is neither good nor
   * bad and a generic scale would call it average.
   */
  verdict: (v: number) => { rating: string; tone: Tone; says: string }
}

type Tone = 'great' | 'good' | 'fair' | 'poor'

const TONE_CLASS: Record<Tone, string> = {
  great: 'bg-emerald-500/15 text-emerald-400',
  good: 'bg-teal-500/15 text-teal-400',
  fair: 'bg-amber-500/15 text-amber-400',
  poor: 'bg-rose-500/15 text-rose-400',
}

const pctOf = (dp = 1) => (v: number) => `${(v * 100).toFixed(dp)}%`
const plain = (dp = 2) => (v: number) => v.toFixed(dp)

const SPECS: Spec[] = [
  {
    key: 'cagr',
    label: 'CAGR（年化复合增长率）',
    badge: '收益',
    badgeClass: 'bg-emerald-500/15 text-emerald-400',
    meaning:
      '年化复合增长率表示计入复利后的组合年收益，可与基准的 CAGR 直接比较。每年高出 2 个百分点代表明显优势。',
    from: 0,
    to: 0.18,
    stops: ['0%', '8%', '18%+'],
    direction: 'higher',
    format: pctOf(),
    verdict: (v) =>
      v >= 0.18
        ? { rating: '优秀', tone: 'great', says: '复合增长率高，较少组合能持续达到。' }
        : v >= 0.12
          ? { rating: '较强', tone: 'good', says: '收益明显高于定期存款及多数指数基金。' }
          : v >= 0.06
            ? { rating: '一般', tone: 'fair', says: '资产有所增长，但超出通胀的幅度不大。' }
            : { rating: '较弱', tone: 'poor', says: '资产增长很少，或实际购买力下降。' },
  },
  {
    key: 'sharpe',
    label: 'Sharpe Ratio（夏普比率）',
    badge: '风险调整后收益',
    badgeClass: 'bg-indigo-500/15 text-indigo-400',
    meaning:
      '每单位风险对应的收益。通常高于 1.0 为良好，高于 1.5 为优秀；低于 0.5 表示承担的风险相对收益较高。',
    from: 0,
    to: 2,
    stops: ['低于 0.5：较弱', '1.0：良好', '1.5 以上：优秀'],
    direction: 'higher',
    format: plain(),
    verdict: (v) =>
      v >= 1.5
        ? { rating: '优秀', tone: 'great', says: '相对于承担的风险，收益较高。' }
        : v >= 1.0
          ? { rating: '良好', tone: 'good', says: '高于通常视为良好的 1.0 水平。' }
          : v >= 0.5
            ? { rating: '一般', tone: 'fair', says: '承担波动获得了一定收益，但幅度不高。' }
            : { rating: '较弱', tone: 'poor', says: '承担了风险，但获得的收益很少。' },
  },
  {
    key: 'max_drawdown',
    label: 'Max Drawdown（最大回撤）',
    badge: '风险',
    badgeClass: 'bg-rose-500/15 text-rose-400',
    meaning:
      '从峰值到低点的最大跌幅。例如 35% 表示组合曾较高点下跌 35%。',
    from: -0.4,
    to: -0.05,
    stops: ['40% 以上：严重', '25%', '10%：较小'],
    direction: 'higher',
    format: pctOf(),
    verdict: (v) =>
      v >= -0.15
        ? { rating: '较小', tone: 'great', says: '历史最大跌幅相对较小。' }
        : v >= -0.25
          ? { rating: '正常', tone: 'good', says: '跌幅处于股票投资中较常见的范围。' }
          : v >= -0.4
            ? { rating: '较大', tone: 'fair', says: '跌幅较深，持有体验可能较困难。' }
            : { rating: '严重', tone: 'poor', says: '跌幅很深，恢复可能需要较长时间。' },
  },
  {
    key: 'volatility',
    label: 'Volatility（波动率）',
    badge: '风险',
    badgeClass: 'bg-rose-500/15 text-rose-400',
    meaning:
      '衡量资产价值的年度波动程度，越低通常越平稳。印度股票指数波动率通常接近 15%，可作为参考。',
    from: 0.3,
    to: 0.05,
    stops: ['30%：剧烈', '15%：常见', '5%：平稳'],
    direction: 'higher',
    format: pctOf(),
    verdict: (v) =>
      v <= 0.1
        ? { rating: '平稳', tone: 'great', says: '波动较小，持有过程相对平稳。' }
        : v <= 0.18
          ? { rating: '常见', tone: 'good', says: '波动程度与指数大致相当。' }
          : v <= 0.25
            ? { rating: '波动较大', tone: 'fair', says: '波动较大，持有体验可能不稳定。' }
            : { rating: '剧烈', tone: 'poor', says: '波动剧烈，需要承受较大的价格变化。' },
  },
  {
    key: 'sortino',
    label: 'Sortino Ratio（索提诺比率）',
    badge: '下行风险',
    badgeClass: 'bg-purple-500/15 text-purple-400',
    meaning:
      '类似夏普比率，但只计入下行波动。若索提诺比率较高而夏普比率一般，波动可能主要来自上涨。',
    from: 0,
    to: 2.5,
    stops: ['低于 1.0：较弱', '1.5：良好', '2.0 以上：优秀'],
    direction: 'higher',
    format: plain(),
    verdict: (v) =>
      v >= 2
        ? { rating: '优秀', tone: 'great', says: '较大的价格变动主要向上。' }
        : v >= 1.5
          ? { rating: '良好', tone: 'good', says: '下行波动得到较好控制。' }
          : v >= 1
            ? { rating: '一般', tone: 'fair', says: '下行波动明显，但程度相对适中。' }
            : { rating: '较弱', tone: 'poor', says: '下跌对波动的贡献较大。' },
  },
  {
    key: 'alpha',
    label: 'Alpha（阿尔法）',
    badge: '超额收益',
    badgeClass: 'bg-emerald-500/15 text-emerald-400',
    meaning:
      '扣除基准风险影响后的超额收益。正值表示投资选择带来正向贡献，负值表示风险调整后的表现落后。',
    from: -0.1,
    to: 0.1,
    stops: ['负值', '0', '正值'],
    direction: 'centre',
    format: (v) => v.toFixed(3),
    verdict: (v) =>
      v >= 0.05
        ? { rating: '明显超额', tone: 'great', says: '投资选择相对指数带来了明显贡献。' }
        : v > 0.005
          ? { rating: '略有超额', tone: 'good', says: '表现略好于单纯持有指数。' }
          : v > -0.005
            ? { rating: '中性', tone: 'fair', says: '考虑风险后，表现与指数大致相当。' }
            : { rating: '负值', tone: 'poor', says: '风险调整后的表现落后于指数基金。' },
  },
  {
    key: 'beta',
    label: 'Beta（贝塔）',
    badge: '敏感度',
    badgeClass: 'bg-amber-500/15 text-amber-400',
    meaning:
      '衡量组合对市场变动的敏感度。Beta 为 1.2 表示组合对指数变动的敏感度约高 20%；低于 0.8 通常偏防御。',
    from: 0,
    to: 1.6,
    stops: ['低于 0.8：防御', '1.0：市场', '高于 1.2：进取'],
    direction: 'centre',
    format: plain(),
    verdict: (v) =>
      v <= 0.8
        ? { rating: '防御型', tone: 'good', says: '上涨和下跌时的波动均小于市场。' }
        : v <= 1.2
          ? { rating: '接近市场', tone: 'good', says: '涨跌幅度与指数大致一致。' }
          : v <= 1.5
            ? { rating: '进取型', tone: 'fair', says: '放大市场波动，涨跌均如此。' }
            : { rating: '高度进取', tone: 'poor', says: '波动显著大于指数。' },
  },
  {
    key: 'calmar',
    label: 'Calmar Ratio（卡玛比率）',
    badge: '回撤恢复',
    badgeClass: 'bg-sky-500/15 text-sky-400',
    meaning:
      '年化收益除以最大回撤的绝对值，用于衡量收益相对最大回撤的水平。',
    from: 0,
    to: 2,
    stops: ['低于 0.5：较弱', '1.0：良好', '2.0 以上：优秀'],
    direction: 'higher',
    format: plain(),
    verdict: (v) =>
      v >= 2
        ? { rating: '优秀', tone: 'great', says: '收益相对最大回撤较高。' }
        : v >= 1
          ? { rating: '良好', tone: 'good', says: '收益相对回撤处于较高水平。' }
          : v >= 0.5
            ? { rating: '一般', tone: 'fair', says: '相对于收益，回撤较深。' }
            : { rating: '较弱', tone: 'poor', says: '相对于回撤，收益较低。' },
  },
  {
    key: 'win_rate',
    label: 'Win Rate（胜率）',
    badge: '稳定性',
    badgeClass: 'bg-teal-500/15 text-teal-400',
    meaning:
      '收盘上涨的交易日占比。股票约 50% 较常见；盈利日与亏损日的幅度也很重要，不能仅凭此指标判断表现。',
    from: 0.4,
    to: 0.6,
    stops: ['40%', '50%：常见', '60%'],
    direction: 'higher',
    format: pctOf(0),
    verdict: (v) =>
      v >= 0.55
        ? { rating: '上涨日较多', tone: 'good', says: '上涨日较多，但单日涨跌幅也很重要。' }
        : v >= 0.48
          ? { rating: '常见', tone: 'good', says: '约一半交易日上涨。' }
          : { rating: '上涨日较少', tone: 'fair', says: '上涨日较少，整体收益更依赖上涨日的涨幅。' },
  },
  {
    key: 'cvar',
    label: 'Conditional VaR（条件风险价值）',
    badge: '尾部风险',
    badgeClass: 'bg-rose-500/15 text-rose-400',
    meaning:
      '最差 5% 交易日的平均亏损，用于衡量极端下跌发生后的损失程度。',
    from: -0.05,
    to: -0.005,
    stops: ['5% 以上：较重', '2%', '低于 1%：较轻'],
    direction: 'higher',
    format: pctOf(2),
    verdict: (v) =>
      v >= -0.015
        ? { rating: '尾部风险较低', tone: 'great', says: '最差交易日的平均跌幅较小。' }
        : v >= -0.03
          ? { rating: '尾部风险正常', tone: 'good', says: '最差交易日的跌幅接近股票市场常见水平。' }
          : { rating: '尾部风险较高', tone: 'poor', says: '极端下跌日的损失较大。' },
  },
]

function position(spec: Spec, value: number): number {
  const t = (value - spec.from) / (spec.to - spec.from)
  return Math.min(100, Math.max(0, t * 100))
}

export function MetricGuide({ metrics }: { metrics: Record<string, number | null | undefined> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {SPECS.map((spec) => {
        const value = metrics[spec.key]
        const known = value !== null && value !== undefined && Number.isFinite(value)
        const at = known ? position(spec, value as number) : null
        const verdict = known ? spec.verdict(value as number) : null

        return (
          <div key={spec.key} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold">{spec.label}</span>
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide',
                  spec.badgeClass
                )}
              >
                {spec.badge}
              </span>
            </div>

            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {spec.meaning}
            </p>

            <div className="relative mt-4 h-2 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500">
              {at !== null && (
                <span
                  className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-background"
                  style={{ left: `${at}%` }}
                  title={`This portfolio: ${spec.format(value as number)}`}
                />
              )}
            </div>

            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              {spec.stops.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            {known ? (
              <div className="mt-3 rounded-md bg-muted/40 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold tabular-nums">
                    {spec.format(value as number)}
                  </span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      TONE_CLASS[verdict!.tone]
                    )}
                  >
                    {verdict!.rating}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{verdict!.says}</p>
              </div>
            ) : (
              <div className="mt-3 text-xs text-muted-foreground">
                Not available. Alpha and beta need a benchmark.
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
