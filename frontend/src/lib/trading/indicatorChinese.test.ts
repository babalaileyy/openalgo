import { describe, expect, it } from 'vitest'
import { indicatorInstanceName, indicatorName } from './indicatorChinese'

describe('indicator display names', () => {
  it('keeps the original name before its Chinese translation', () => {
    expect(indicatorName('RSI')).toBe('RSI（相对强弱指数）')
    expect(indicatorName('52 Week High/Low')).toBe('52 Week High/Low（52 周最高/最低价）')
    expect(indicatorName('My custom indicator')).toBe('My custom indicator')
  })

  it('keeps the parameters and matches the longest indicator name first', () => {
    expect(indicatorInstanceName('RSI 14')).toBe('RSI（相对强弱指数） 14')
    expect(indicatorInstanceName('Bollinger Bands %b 20')).toBe('Bollinger Bands %b（布林带百分比） 20')
    expect(indicatorInstanceName('My custom indicator 14')).toBe('My custom indicator 14')
  })
})
