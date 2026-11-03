import { describe, expect, it } from 'vitest'
import {
  bottomNavItems,
  isActiveRoute,
  mobileSheetItems,
  navItems,
  profileMenuItems,
} from './navigation'

describe('Navigation Config', () => {
  describe('navItems', () => {
    it('contains the expected main navigation items', () => {
      expect(navItems).toHaveLength(9)

      const labels = navItems.map((item) => item.label)
      expect(labels).toContain('仪表盘')
      expect(labels).toContain('工具')
      expect(labels).toContain('委托')
      expect(labels).toContain('持仓')
      expect(labels).toContain('交易平台')
      expect(labels).toContain('图表交易')
      expect(labels).toContain('策略')

      // Strategies sits directly after Platforms. Asserting the position, not
      // just its presence, is the point: it is where the user expects to find
      // it, and a later insertion that pushed it elsewhere should fail here.
      expect(labels.indexOf('策略')).toBe(labels.indexOf('交易平台') + 1)
    })

    it('all items have required properties', () => {
      navItems.forEach((item) => {
        expect(item).toHaveProperty('href')
        expect(item).toHaveProperty('label')
        expect(item).toHaveProperty('icon')
        expect(item.href).toMatch(/^\//)
        expect(item.label.length).toBeGreaterThan(0)
      })
    })
  })

  describe('bottomNavItems', () => {
    it('contains exactly 4 items for mobile bottom nav', () => {
      expect(bottomNavItems).toHaveLength(4)
    })

    it('has the correct order: Dashboard, Orderbook, Tradebook, Positions', () => {
      const labels = bottomNavItems.map((item) => item.label)
      expect(labels).toEqual(['仪表盘', '委托', '成交', '持仓'])
    })
  })

  describe('mobileSheetItems', () => {
    it('excludes items already in bottomNavItems', () => {
      const bottomPaths = bottomNavItems.map((item) => item.href)
      const sheetPaths = mobileSheetItems.map((item) => item.href)

      sheetPaths.forEach((path) => {
        expect(bottomPaths).not.toContain(path)
      })
    })

    it('contains remaining nav items', () => {
      const sheetLabels = mobileSheetItems.map((item) => item.label)
      expect(sheetLabels).toContain('图表交易')
      expect(sheetLabels).toContain('交易平台')
      expect(sheetLabels).toContain('日志')
    })
  })

  describe('profileMenuItems', () => {
    it('contains profile-related menu items', () => {
      const labels = profileMenuItems.map((item) => item.label)
      expect(labels).toContain('个人资料')
      expect(labels).toContain('API 密钥')
      expect(labels).toContain('资产')
      // Action Center moved from the main navbar into the profile dropdown,
      // positioned right after API Key.
      expect(labels).toContain('操作中心')
      expect(labels.indexOf('操作中心')).toBe(labels.indexOf('API 密钥') + 1)
    })
  })

  describe('isActiveRoute', () => {
    it('returns true for exact matches', () => {
      expect(isActiveRoute('/dashboard', '/dashboard')).toBe(true)
      expect(isActiveRoute('/orderbook', '/orderbook')).toBe(true)
      expect(isActiveRoute('/positions', '/positions')).toBe(true)
    })

    it('returns false for non-matching routes', () => {
      expect(isActiveRoute('/dashboard', '/orderbook')).toBe(false)
      expect(isActiveRoute('/positions', '/holdings')).toBe(false)
    })

    it('does not prefix match', () => {
      // No nav item owns nested pages, so neither a child path nor a longer
      // name that merely starts with the href may light the tab up.
      expect(isActiveRoute('/dashboard/sub', '/dashboard')).toBe(false)
      expect(isActiveRoute('/orderbookextra', '/orderbook')).toBe(false)
    })
  })
})
