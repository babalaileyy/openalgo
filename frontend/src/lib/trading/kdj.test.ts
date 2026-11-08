import { describe, expect, it } from 'vitest'
import { getIndicator, hasIndicator, indicatorDefaults } from 'openalgo-charts'
import { KDJ, registerKdj } from './kdj'

describe('KDJ', () => {
  it('registers in the chart catalogue', () => {
    registerKdj()
    expect(hasIndicator('kdj')).toBe(true)
    expect(getIndicator('kdj').name).toBe('KDJ')
  })

  it('uses a nine-bar RSV and recursively smooths K and D from 50', () => {
    const bars = Array.from({ length: 10 }, (_, i) => ({
      time: i + 1, open: 5, high: 10, low: 0, close: 10, volume: 1,
    }))
    const result = KDJ.calc(bars, indicatorDefaults(KDJ), {})
    expect(result.k[7]).toBeNull()
    expect(result.k[8]).toBeCloseTo(200 / 3)
    expect(result.d[8]).toBeCloseTo(500 / 9)
    expect(result.j[8]).toBeCloseTo(800 / 9)
    expect(result.k[9]).toBeCloseTo(700 / 9)
  })

  it('keeps a flat market finite and neutral', () => {
    const bars = Array.from({ length: 12 }, (_, i) => ({
      time: i + 1, open: 5, high: 5, low: 5, close: 5, volume: 1,
    }))
    const result = KDJ.calc(bars, indicatorDefaults(KDJ), {})
    expect(result.k[11]).toBe(50)
    expect(result.d[11]).toBe(50)
    expect(result.j[11]).toBe(50)
  })
})
