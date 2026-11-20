import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { MergeOrchestrator } from '../../../src/merger/MergeOrchestrator.js'
import { getScenario } from '../../../src/merger/MergeScenarioFactory.js'
import { defaultNodeFactory } from '../../../src/merger/nodes/MergeNodeFactory.js'
import { getScenarioStrategy } from '../../../src/merger/strategies/ScenarioStrategy.js'
import { ContestedTagOrder } from '../../../src/merger/tagOrder/contestedTagOrder.js'
import { TagOrderCache } from '../../../src/merger/tagOrder/tagOrderCache.js'
import type { MergeResult } from '../../../src/types/mergeResult.js'
import { MergeScenario } from '../../../src/types/mergeScenario.js'
import { defaultConfig } from '../../utils/testConfig.js'

vi.mock('../../../src/merger/MergeScenarioFactory.js')
vi.mock('../../../src/merger/strategies/ScenarioStrategy.js')

const mockedGetScenario = getScenario as Mock
const mockedGetScenarioStrategy = getScenarioStrategy as Mock

describe('MergeOrchestrator', () => {
  const mockStrategy = {
    execute: vi.fn(),
  }
  const mockResult: MergeResult = { hasConflict: false, output: [] }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetScenarioStrategy.mockReturnValue(mockStrategy)
    mockStrategy.execute.mockReturnValue(mockResult)
  })

  describe('merge', () => {
    it('should delegate to the correct strategy with proper context', () => {
      // Arrange
      const orchestrator = new MergeOrchestrator(defaultConfig)
      const ancestor = { key: 'ancestor' }
      const local = { key: 'local' }
      const other = { key: 'other' }
      const rootKey = {
        name: 'testKey',
        existsInLocal: true,
        existsInOther: true,
      }
      const scenario = MergeScenario.ALL

      mockedGetScenario.mockReturnValue(scenario)

      // Act
      const result = orchestrator.merge(ancestor, local, other, rootKey)

      // Assert
      expect(mockedGetScenario).toHaveBeenCalledWith(ancestor, local, other)
      expect(mockedGetScenarioStrategy).toHaveBeenCalledWith(scenario)
      expect(mockStrategy.execute).toHaveBeenCalledWith({
        config: defaultConfig,
        ancestor,
        local,
        other,
        nodeFactory: defaultNodeFactory,
        rootKey,
        contestedTagOrder: ContestedTagOrder.CONFLICT,
        tagOrders: expect.any(TagOrderCache),
      })
      expect(result).toBe(mockResult)
    })

    it('should hand the same order cache to every merge it runs', () => {
      // Arrange
      const sut = new MergeOrchestrator(defaultConfig)
      mockedGetScenario.mockReturnValue(MergeScenario.ALL)

      // Act
      sut.merge({}, {}, {})
      sut.merge({}, {}, {})

      // Assert
      const [first, second] = mockStrategy.execute.mock.calls.map(
        ([context]) => context.tagOrders
      )
      expect(first).toBe(second)
    })

    it('should not share its order cache with another orchestrator', () => {
      // Arrange
      mockedGetScenario.mockReturnValue(MergeScenario.ALL)

      // Act
      new MergeOrchestrator(defaultConfig).merge({}, {}, {})
      new MergeOrchestrator(defaultConfig).merge({}, {}, {})

      // Assert
      const [first, second] = mockStrategy.execute.mock.calls.map(
        ([context]) => context.tagOrders
      )
      expect(first).not.toBe(second)
    })

    it('should hand the order of contested tags it was given to the strategy', () => {
      // Arrange
      const sut = new MergeOrchestrator(
        defaultConfig,
        defaultNodeFactory,
        ContestedTagOrder.CANONICAL
      )
      mockedGetScenario.mockReturnValue(MergeScenario.ALL)

      // Act
      sut.merge({}, {}, {})

      // Assert
      expect(mockStrategy.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          contestedTagOrder: ContestedTagOrder.CANONICAL,
        })
      )
    })

    it('should use provided nodeFactory in context', () => {
      // Arrange
      const customNodeFactory = { createNode: vi.fn() }
      const orchestrator = new MergeOrchestrator(
        defaultConfig,
        customNodeFactory
      )
      const ancestor = {}
      const local = {}
      const other = {}

      mockedGetScenario.mockReturnValue(MergeScenario.NONE)

      // Act
      orchestrator.merge(ancestor, local, other)

      // Assert
      expect(mockStrategy.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeFactory: customNodeFactory,
        })
      )
    })
  })
})
