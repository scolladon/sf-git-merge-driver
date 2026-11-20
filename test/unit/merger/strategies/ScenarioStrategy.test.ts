import { describe, expect, it, vi } from 'vitest'
import type { MergeContext } from '../../../../src/merger/MergeContext.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import { getScenarioStrategy } from '../../../../src/merger/strategies/ScenarioStrategy.js'
import { ContestedTagOrder } from '../../../../src/merger/tagOrder/contestedTagOrder.js'
import { TagOrderCache } from '../../../../src/merger/tagOrder/tagOrderCache.js'
import type { JsonValue } from '../../../../src/types/jsonTypes.js'
import { MergeScenario } from '../../../../src/types/mergeScenario.js'
import { defaultConfig } from '../../../utils/testConfig.js'

const createContext = (
  overrides: Partial<MergeContext> = {}
): MergeContext => ({
  config: defaultConfig,
  ancestor: {},
  local: {},
  other: {},
  nodeFactory: defaultNodeFactory,
  rootKey: undefined,
  contestedTagOrder: ContestedTagOrder.CONFLICT,
  tagOrders: new TagOrderCache(),
  ...overrides,
})

describe('ScenarioStrategy', () => {
  describe('getScenarioStrategy', () => {
    it.each([
      MergeScenario.NONE,
      MergeScenario.OTHER_ONLY,
      MergeScenario.LOCAL_ONLY,
      MergeScenario.LOCAL_AND_OTHER,
      MergeScenario.ANCESTOR_ONLY,
      MergeScenario.ANCESTOR_AND_OTHER,
      MergeScenario.ANCESTOR_AND_LOCAL,
      MergeScenario.ALL,
    ])('should return a strategy for %s', scenario => {
      // Act
      const strategy = getScenarioStrategy(scenario)

      // Assert
      expect(strategy).toBeDefined()
      expect(strategy.execute).toBeDefined()
    })
  })

  describe('NoneStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.NONE)

    it('should return empty result with no conflict', () => {
      // Arrange
      const context = createContext()

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('should ignore ancestor value', () => {
      // Arrange
      const context = createContext({ ancestor: { key: 'value' } })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })

    it('should ignore rootKey', () => {
      // Arrange
      const context = createContext({
        rootKey: {
          name: 'testKey',
          existsInLocal: true,
          existsInOther: true,
        },
      })

      // Act
      const result = strategy.execute(context)

      // Assert
      expect(result.output).toEqual([])
      expect(result.hasConflict).toBe(false)
    })
  })

  describe('OtherOnlyStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.OTHER_ONLY)

    describe('without rootKey', () => {
      it('should return transformed other content', () => {
        // Arrange
        const context = createContext({
          other: { key: 'otherValue' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toHaveLength(1)
        expect(result.hasConflict).toBe(false)
      })

      it('should transform nested objects', () => {
        // Arrange
        const context = createContext({
          other: { outer: { inner: 'value' } },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toHaveLength(1)
        expect(result.hasConflict).toBe(false)
      })

      it('should handle empty other object', () => {
        // Arrange
        const context = createContext({ other: {} })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{}])
        expect(result.hasConflict).toBe(false)
      })
    })

    describe('with rootKey', () => {
      it('should wrap with rootKey when rootKey is provided', () => {
        // Arrange
        const context = createContext({
          other: { key: 'otherValue' },
          rootKey: {
            name: 'testKey',
            existsInLocal: false,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: expect.any(Array) }])
        expect(result.hasConflict).toBe(false)
      })

      it('should wrap empty content with rootKey', () => {
        // Arrange
        const context = createContext({
          other: {},
          rootKey: {
            name: 'testKey',
            existsInLocal: false,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: [{}] }])
        expect(result.hasConflict).toBe(false)
      })
    })
  })

  describe('LocalOnlyStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.LOCAL_ONLY)

    describe('without rootKey', () => {
      it('should return transformed local content', () => {
        // Arrange
        const context = createContext({
          local: { key: 'localValue' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toHaveLength(1)
        expect(result.hasConflict).toBe(false)
      })

      it('should transform nested objects', () => {
        // Arrange
        const context = createContext({
          local: { outer: { inner: 'value' } },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toHaveLength(1)
        expect(result.hasConflict).toBe(false)
      })

      it('should handle empty local object', () => {
        // Arrange
        const context = createContext({ local: {} })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{}])
        expect(result.hasConflict).toBe(false)
      })
    })

    describe('with rootKey', () => {
      it('should wrap with rootKey when rootKey is provided', () => {
        // Arrange
        const context = createContext({
          local: { key: 'localValue' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: false,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: expect.any(Array) }])
        expect(result.hasConflict).toBe(false)
      })

      it('should wrap empty content with rootKey', () => {
        // Arrange
        const context = createContext({
          local: {},
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: false,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: [{}] }])
        expect(result.hasConflict).toBe(false)
      })
    })
  })

  describe('LocalAndOtherStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.LOCAL_AND_OTHER)

    describe('when local equals other', () => {
      it('should return other content without conflict', () => {
        // Arrange
        const context = createContext({
          local: { key: 'sameValue' },
          other: { key: 'sameValue' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(false)
      })

      it('should wrap with rootKey when equal and rootKey is provided', () => {
        // Arrange
        const context = createContext({
          local: { key: 'sameValue' },
          other: { key: 'sameValue' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: expect.any(Array) }])
        expect(result.hasConflict).toBe(false)
      })

      it('should return empty key when both are empty with rootKey', () => {
        // Arrange
        const context = createContext({
          local: {},
          other: {},
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: [{}] }])
        expect(result.hasConflict).toBe(false)
      })
    })

    describe('when local differs from other', () => {
      it('should merge children', () => {
        // Arrange
        const context = createContext({
          local: { a: 'localA', b: 'shared' },
          other: { a: 'otherA', b: 'shared' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output.length).toBeGreaterThan(0)
      })

      it('should wrap merged result with rootKey when rootKey is provided', () => {
        // Arrange
        const context = createContext({
          local: { a: 'localA' },
          other: { a: 'otherA' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: expect.any(Array) }])
      })

      it('should handle disjoint keys', () => {
        // Arrange
        const context = createContext({
          local: { a: 'localA' },
          other: { b: 'otherB' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output.length).toBeGreaterThan(0)
        expect(result.hasConflict).toBe(false)
      })

      it('should return empty key when mergeChildren returns empty with rootKey', () => {
        // Arrange
        const context = createContext({
          local: { a: null },
          other: { b: null },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: expect.any(Array) }])
      })
    })
  })

  describe('AncestorOnlyStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.ANCESTOR_ONLY)

    describe('without rootKey', () => {
      it('should return empty result with no conflict', () => {
        // Arrange
        const context = createContext({
          ancestor: { value: 'ancestor' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([])
        expect(result.hasConflict).toBe(false)
      })
    })

    describe('with rootKey', () => {
      it('should return empty key when rootKey exists in local', () => {
        // Arrange
        const context = createContext({
          ancestor: { value: 'ancestor' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: false,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: [] }])
        expect(result.hasConflict).toBe(false)
      })

      it('should return empty key when rootKey exists in other', () => {
        // Arrange
        const context = createContext({
          ancestor: { value: 'ancestor' },
          rootKey: {
            name: 'testKey',
            existsInLocal: false,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: [] }])
        expect(result.hasConflict).toBe(false)
      })

      it('should return empty key when rootKey exists in both', () => {
        // Arrange
        const context = createContext({
          ancestor: { value: 'ancestor' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: [] }])
        expect(result.hasConflict).toBe(false)
      })

      it('should return empty result when rootKey exists in neither', () => {
        // Arrange
        const context = createContext({
          ancestor: { value: 'ancestor' },
          rootKey: {
            name: 'testKey',
            existsInLocal: false,
            existsInOther: false,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([])
        expect(result.hasConflict).toBe(false)
      })
    })
  })

  describe('AncestorAndLocalStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.ANCESTOR_AND_LOCAL)

    describe('without rootKey', () => {
      it('should return empty when ancestor equals local', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'sameValue' },
          local: { key: 'sameValue' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([])
        expect(result.hasConflict).toBe(false)
      })

      it('should return conflict when ancestor and local differ', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'ancestorValue' },
          local: { key: 'localValue' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
      })

      it('should handle multi-element arrays in extractContent', () => {
        // Arrange
        const context = createContext({
          ancestor: { a: 'ancestorA', b: 'ancestorB' },
          local: { a: 'localA', b: 'localB' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
      })
    })

    describe('with rootKey', () => {
      it('should return empty key when other missing and local unchanged', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'value' },
          local: { key: 'value' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: false,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([])
        expect(result.hasConflict).toBe(false)
      })

      it('should return conflict when other missing and local changed', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'ancestorValue' },
          local: { key: 'localValue' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: false,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
      })

      it('should wrap result with rootKey when other exists', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'ancestorValue' },
          local: { key: 'localValue' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: expect.any(Array) }])
      })

      it.each(['constructor', 'toString', 'valueOf'])(
        'should delete the unchanged inherited-looking tag %s when other empties the root',
        tag => {
          // Arrange
          const context = createContext({
            ancestor: { [tag]: 'v', kept: 'v' },
            local: { [tag]: 'v', added: 'n' },
            other: undefined,
            rootKey: {
              name: 'testKey',
              existsInLocal: true,
              existsInOther: true,
            },
          })

          // Act
          const result = strategy.execute(context)

          // Assert
          expect(result.hasConflict).toBe(false)
          expect(result.output).toEqual([{ testKey: [{ added: 'n' }] }])
        }
      )

      it('should return empty key when other exists but nested result is empty', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'value' },
          local: { key: 'value' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: [] }])
        expect(result.hasConflict).toBe(false)
      })
    })
  })

  describe('AncestorAndOtherStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.ANCESTOR_AND_OTHER)

    describe('without rootKey', () => {
      it('should return empty when ancestor equals other', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'sameValue' },
          other: { key: 'sameValue' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([])
        expect(result.hasConflict).toBe(false)
      })

      it('should return conflict when ancestor and other differ', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'ancestorValue' },
          other: { key: 'otherValue' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
      })

      it('should handle multi-element arrays in extractContent', () => {
        // Arrange
        const context = createContext({
          ancestor: { a: 'ancestorA', b: 'ancestorB' },
          other: { a: 'otherA', b: 'otherB' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
      })
    })

    describe('with rootKey', () => {
      it('should return empty when local missing and other unchanged', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'value' },
          other: { key: 'value' },
          rootKey: {
            name: 'testKey',
            existsInLocal: false,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([])
        expect(result.hasConflict).toBe(false)
      })

      it('should return conflict when local missing and other changed', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'ancestorValue' },
          other: { key: 'otherValue' },
          rootKey: {
            name: 'testKey',
            existsInLocal: false,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
      })

      it('should wrap result with rootKey when local exists', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'ancestorValue' },
          other: { key: 'otherValue' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: expect.any(Array) }])
      })

      it('should return empty key when local exists but nested result is empty', () => {
        // Arrange
        const context = createContext({
          ancestor: { key: 'value' },
          other: { key: 'value' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: [] }])
        expect(result.hasConflict).toBe(false)
      })
    })
  })

  describe('AllPresentStrategy', () => {
    const strategy = getScenarioStrategy(MergeScenario.ALL)

    describe('given the sides reorder child tags into a cycle', () => {
      const element = (text: string) =>
        Object.fromEntries([...text].map(tag => [tag, tag]))
      const cycle = (contestedTagOrder: ContestedTagOrder) =>
        createContext({
          ancestor: element('abc'),
          local: element('bac'),
          other: element('acb'),
          contestedTagOrder,
        })

      it('when contested tags are to be written in canonical order then the tags merge without conflict in that order', () => {
        // Arrange
        const context = cycle(ContestedTagOrder.CANONICAL)

        // Act
        const sut = strategy.execute(context)

        // Assert
        expect(sut.hasConflict).toBe(false)
        expect(sut.output).toEqual([{ a: 'a' }, { b: 'b' }, { c: 'c' }])
      })

      it('when contested tags are to conflict then one block holds them, each side as written', () => {
        // Arrange
        const context = cycle(ContestedTagOrder.CONFLICT)

        // Act
        const sut = strategy.execute(context)

        // Assert
        expect(sut.hasConflict).toBe(true)
        expect(sut.output).toEqual([
          {
            __conflict: true,
            local: [element('bac')],
            ancestor: [element('abc')],
            other: [element('acb')],
          },
        ])
      })
    })

    describe('without rootKey', () => {
      it('should merge all children', () => {
        // Arrange
        const context = createContext({
          ancestor: { a: 'ancestorA', b: 'ancestorB' },
          local: { a: 'localA', b: 'localB' },
          other: { a: 'otherA', b: 'otherB' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output.length).toBeGreaterThan(0)
      })

      it('should handle three-way merge with no conflict', () => {
        // Arrange
        const context = createContext({
          ancestor: { a: 'original' },
          local: { a: 'localChange' },
          other: { a: 'original' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(false)
      })

      it('should return early when ancestor, local, and other are identical', () => {
        // Arrange
        const context = createContext({
          ancestor: { a: 'same' },
          local: { a: 'same' },
          other: { a: 'same' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(false)
        expect(result.output).toBeDefined()
      })

      it('should return that order early when both sides reorder the ancestor the same way', () => {
        // Arrange
        const context = createContext({
          ancestor: { a: '1', b: '2' },
          local: { b: '2', a: '1' },
          other: { b: '2', a: '1' },
        })
        const merged = vi.spyOn(defaultNodeFactory, 'createNode')

        // Act
        const sut = strategy.execute(context)

        // Assert
        expect(merged).not.toHaveBeenCalled()
        expect(sut.hasConflict).toBe(false)
        expect(Object.keys(sut.output[0] as object)).toEqual(['b', 'a'])
      })

      it('should keep the reorder one side made when the other side kept the ancestor order', () => {
        // Arrange
        const context = createContext({
          ancestor: { a: '1', b: '2', c: '3' },
          local: { b: '2', a: '1', c: '3' },
          other: { a: '1', b: '2', c: '3' },
        })

        // Act
        const sut = strategy.execute(context)

        // Assert
        expect(sut.output.flatMap(item => Object.keys(item as object))).toEqual(
          ['b', 'a', 'c']
        )
      })

      it('should detect conflict when both sides change differently', () => {
        // Arrange
        const context = createContext({
          ancestor: { a: 'original' },
          local: { a: 'localChange' },
          other: { a: 'otherChange' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
      })

      it('should handle disjoint changes without conflict', () => {
        // Arrange
        const context = createContext({
          ancestor: { a: 'ancestorA', b: 'ancestorB' },
          local: { a: 'localA', b: 'ancestorB' },
          other: { a: 'ancestorA', b: 'otherB' },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.hasConflict).toBe(false)
      })
    })

    describe('with rootKey', () => {
      it('should wrap result with rootKey when rootKey is provided', () => {
        // Arrange
        const context = createContext({
          ancestor: { a: 'ancestorA' },
          local: { a: 'localA' },
          other: { a: 'otherA' },
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: expect.any(Array) }])
      })

      it('should return empty key when result is empty with rootKey', () => {
        // Arrange
        const context = createContext({
          ancestor: {},
          local: {},
          other: {},
          rootKey: {
            name: 'testKey',
            existsInLocal: true,
            existsInOther: true,
          },
        })

        // Act
        const result = strategy.execute(context)

        // Assert
        expect(result.output).toEqual([{ testKey: [{}] }])
        expect(result.hasConflict).toBe(false)
      })
    })
  })
  describe('given a reorder of an unordered type against a deletion', () => {
    const entry = (fullName: string, value = 'v') => ({ fullName, value })
    const ancestor = { labels: [entry('A'), entry('B', 'w')] }
    const reordered = { labels: [entry('B', 'w'), entry('A')] }
    const present = {
      name: 'CustomLabels',
      existsInLocal: true,
      existsInOther: true,
    }

    describe('when local reorders and other deletes every entry', () => {
      it('should take the deletion without conflict', () => {
        // Arrange
        const sut = getScenarioStrategy(MergeScenario.ANCESTOR_AND_LOCAL)
        const context = createContext({
          ancestor,
          local: reordered,
          other: undefined,
          rootKey: { ...present, existsInOther: false },
        })

        // Act
        const result = sut.execute(context)

        // Assert
        expect(result).toEqual({ output: [], hasConflict: false })
      })
    })

    describe('when other reorders and local deletes every entry', () => {
      it('should take the deletion without conflict', () => {
        // Arrange
        const sut = getScenarioStrategy(MergeScenario.ANCESTOR_AND_OTHER)
        const context = createContext({
          ancestor,
          local: undefined,
          other: reordered,
          rootKey: { ...present, existsInLocal: false },
        })

        // Act
        const result = sut.execute(context)

        // Assert
        expect(result).toEqual({ output: [], hasConflict: false })
      })
    })

    describe('when the reordered type is ordered', () => {
      it('should still conflict with the deletion', () => {
        // Arrange
        const sut = getScenarioStrategy(MergeScenario.ANCESTOR_AND_LOCAL)
        const values = [{ fullName: 'a' }, { fullName: 'b' }]
        const context = createContext({
          ancestor: { customValue: values },
          local: { customValue: [...values].reverse() },
          other: undefined,
          rootKey: {
            name: 'GlobalValueSet',
            existsInLocal: true,
            existsInOther: false,
          },
        })

        // Act
        const result = sut.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
      })
    })

    describe('when an entry is edited besides the reorder', () => {
      it('should hold only the edited entry in the block', () => {
        // Arrange
        const sut = getScenarioStrategy(MergeScenario.ANCESTOR_AND_LOCAL)
        const local = { labels: [entry('A'), entry('B', 'edited')] }
        const context = createContext({
          ancestor,
          local,
          other: [],
          rootKey: present,
        })

        // Act
        const result = sut.execute(context)

        // Assert
        const [wrapper] = result.output as { CustomLabels: unknown[] }[]
        const [block] = wrapper.CustomLabels as {
          local: unknown[]
          ancestor: unknown[]
        }[]
        expect(block.local).toEqual([{ labels: local.labels[1] }])
        expect(block.ancestor).toEqual([{ labels: ancestor.labels[1] }])
      })
    })

    describe('when the root is missing on the other side and a local entry is edited', () => {
      it('should render every entry of each side as its own element', () => {
        // Arrange
        const sut = getScenarioStrategy(MergeScenario.ANCESTOR_AND_LOCAL)
        const local = { labels: [entry('A'), entry('B', 'edited')] }
        const context = createContext({
          ancestor,
          local,
          other: undefined,
          rootKey: { ...present, existsInOther: false },
        })

        // Act
        const result = sut.execute(context)

        // Assert
        const [block] = result.output as { local: unknown[] }[]
        expect(block.local).toEqual([
          { CustomLabels: local.labels.map(labels => ({ labels })) },
        ])
      })
    })
  })

  describe('given a target that does not exist', () => {
    describe('when ancestor and local are the only sides and no root key frames them', () => {
      it('should conflict with an empty local side', () => {
        // Arrange
        const sut = getScenarioStrategy(MergeScenario.ANCESTOR_AND_LOCAL)
        const context = createContext({
          ancestor: { a: '1' },
          local: undefined,
          other: undefined,
        })

        // Act
        const result = sut.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
        expect((result.output[0] as { local: unknown[] }).local).toEqual([])
      })
    })

    describe('when the root key frames a target that does not exist', () => {
      it('should conflict with an empty local side', () => {
        // Arrange
        const sut = getScenarioStrategy(MergeScenario.ANCESTOR_AND_LOCAL)
        const context = createContext({
          ancestor: { a: '1' },
          local: undefined,
          other: undefined,
          rootKey: { name: 'Root', existsInLocal: false, existsInOther: false },
        })

        // Act
        const result = sut.execute(context)

        // Assert
        expect(result.hasConflict).toBe(true)
      })
    })
  })

  describe('given a root key present on both sides that kept it', () => {
    const rootKey = { name: 'r', existsInLocal: true, existsInOther: true }

    it.each([
      [MergeScenario.ANCESTOR_AND_LOCAL, '', 'x', '', ['x']],
      [MergeScenario.ANCESTOR_AND_LOCAL, null, {}, 'x', ['x']],
      [MergeScenario.ANCESTOR_AND_LOCAL, {}, '', '', []],
      [MergeScenario.ANCESTOR_AND_LOCAL, {}, {}, {}, []],
      [MergeScenario.ANCESTOR_AND_LOCAL, '', {}, {}, []],
      [MergeScenario.ANCESTOR_AND_LOCAL, 'x', {}, {}, []],
      [MergeScenario.ANCESTOR_AND_OTHER, {}, '', {}, []],
      [MergeScenario.ANCESTOR_AND_OTHER, '', {}, {}, []],
    ])(
      'when the scenario is %s over ancestor %j, local %j and other %j then the root holds %j',
      (scenario, ancestor, local, other, held) => {
        // Arrange
        const sut = getScenarioStrategy(scenario)
        const context = createContext({
          ancestor: ancestor as JsonValue,
          local: local as JsonValue,
          other: other as JsonValue,
          rootKey,
        })

        // Act
        const result = sut.execute(context)

        // Assert
        expect(result).toEqual({ output: [{ r: held }], hasConflict: false })
      }
    )
  })

  describe('given local and other that wrote the same thing over a different ancestor', () => {
    it.each([
      ['an empty text', '', {}, {}],
      ['an empty element', {}, '', ''],
    ])(
      'when the ancestor is %s then the sides are merged child by child',
      (_, ancestor, local, other) => {
        // Arrange
        const sut = getScenarioStrategy(MergeScenario.ALL)
        const context = createContext({
          ancestor: ancestor as JsonValue,
          local: local as JsonValue,
          other: other as JsonValue,
        })

        // Act
        const result = sut.execute(context)

        // Assert
        expect(result).toEqual({ output: [], hasConflict: false })
      }
    )
  })
})
