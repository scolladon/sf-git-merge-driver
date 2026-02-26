import { setsEqual, setsIntersect } from '../../../src/utils/setUtils.js'

describe('setUtils', () => {
  describe('setsEqual', () => {
    it('Given identical sets, When comparing, Then returns true', () => {
      expect(setsEqual(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(true)
    })

    it('Given different sizes, When comparing, Then returns false', () => {
      expect(setsEqual(new Set(['a']), new Set(['a', 'b']))).toBe(false)
    })

    it('Given same size but different elements, When comparing, Then returns false', () => {
      expect(setsEqual(new Set(['a', 'b']), new Set(['a', 'c']))).toBe(false)
    })

    it('Given empty sets, When comparing, Then returns true', () => {
      expect(setsEqual(new Set(), new Set())).toBe(true)
    })
  })

  describe('setsIntersect', () => {
    it('Given overlapping sets, When checking, Then returns true', () => {
      expect(setsIntersect(new Set(['a', 'b']), new Set(['b', 'c']))).toBe(true)
    })

    it('Given disjoint sets, When checking, Then returns false', () => {
      expect(setsIntersect(new Set(['a', 'b']), new Set(['c', 'd']))).toBe(
        false
      )
    })

    it('Given empty first set, When checking, Then returns false', () => {
      expect(setsIntersect(new Set(), new Set(['a']))).toBe(false)
    })

    it('Given empty second set, When checking, Then returns false', () => {
      expect(setsIntersect(new Set(['a']), new Set())).toBe(false)
    })
  })
})
