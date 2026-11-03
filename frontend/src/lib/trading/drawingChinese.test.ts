import { describe, expect, it } from 'vitest'
import { drawingGroupName, drawingToolName } from './drawingChinese'
import { DRAW_GROUPS } from './drawTools'

describe('drawing tool translations', () => {
  it('covers every current group, section, and drawing tool', () => {
    for (const group of DRAW_GROUPS) {
      expect(drawingGroupName(group.label)).not.toBe(group.label)
      for (const section of group.sections) {
        if (section.head) expect(drawingGroupName(section.head)).not.toBe(section.head)
        for (const tool of section.tools) {
          expect(drawingToolName(tool.id, tool.label)).not.toBe(tool.label)
        }
      }
    }
  })

  it('preserves an unknown name', () => {
    expect(drawingToolName('future-tool', 'Future tool')).toBe('Future tool')
  })
})
