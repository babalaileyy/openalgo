import { hasIndicator, registerIndicator, type IndicatorDescriptor } from 'openalgo-charts'
import { highest, lowest } from 'openalgo-charts/indicators'

export const KDJ: IndicatorDescriptor = {
  id: 'kdj',
  name: 'KDJ',
  category: 'Momentum',
  placement: 'pane',
  inputs: [
    { key: 'length', type: 'number', label: 'RSV 周期', default: 9, min: 1, max: 500, step: 1 },
    { key: 'kPeriod', type: 'number', label: 'K 平滑周期', default: 3, min: 1, max: 500, step: 1 },
    { key: 'dPeriod', type: 'number', label: 'D 平滑周期', default: 3, min: 1, max: 500, step: 1 },
  ],
  plots: [
    { key: 'k', type: 'line', title: 'K', style: { color: '#e7b34b', lineWidth: 2 } },
    { key: 'd', type: 'line', title: 'D', style: { color: '#4f8cff', lineWidth: 2 } },
    { key: 'j', type: 'line', title: 'J', style: { color: '#bd70d5', lineWidth: 2 } },
  ],
  levels: () => [
    { price: 80, title: '80', color: '#8892a6' },
    { price: 20, title: '20', color: '#8892a6' },
  ],
  calc(bars, settings) {
    const period = (value: unknown, fallback: number) =>
      Math.min(500, Math.max(1, Math.round(Number(value) || fallback)))
    const n = period(settings.length, 9)
    const kp = period(settings.kPeriod, 3)
    const dp = period(settings.dPeriod, 3)
    const hi = highest(bars.map((bar) => bar.high), n)
    const lo = lowest(bars.map((bar) => bar.low), n)
    const k: (number | null)[] = Array(bars.length).fill(null)
    const d: (number | null)[] = Array(bars.length).fill(null)
    const j: (number | null)[] = Array(bars.length).fill(null)
    let prevK = 50
    let prevD = 50
    let prevRsv = 50
    for (let i = 0; i < bars.length; i++) {
      if (!Number.isFinite(hi[i]) || !Number.isFinite(lo[i]) || !Number.isFinite(bars[i].close)) continue
      const rsv = hi[i] === lo[i] ? prevRsv : (100 * (bars[i].close - lo[i])) / (hi[i] - lo[i])
      prevRsv = rsv
      prevK = (rsv + (kp - 1) * prevK) / kp
      prevD = (prevK + (dp - 1) * prevD) / dp
      k[i] = prevK
      d[i] = prevD
      j[i] = 3 * prevK - 2 * prevD
    }
    return { k, d, j }
  },
}

export function registerKdj(): void {
  if (!hasIndicator(KDJ.id)) registerIndicator(KDJ)
}
