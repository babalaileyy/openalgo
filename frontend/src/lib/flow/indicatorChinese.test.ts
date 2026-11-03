import { describe, expect, it } from 'vitest'
import { INDICATOR_CATALOG } from './constants'
import { flowIndicatorName } from './indicatorChinese'

describe('workflow indicator names', () => {
  it('retains every original name and adds its Chinese translation', () => {
    for (const indicator of INDICATOR_CATALOG) {
      expect(flowIndicatorName(indicator.value)).toMatch(
        new RegExp(`^${indicator.label}（[^（）]+）$`)
      )
    }
  })

  it('leaves an unknown indicator unchanged', () => {
    expect(flowIndicatorName('custom_indicator')).toBe('custom_indicator')
  })
})
