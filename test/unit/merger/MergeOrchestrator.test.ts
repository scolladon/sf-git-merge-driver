import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../src/constant/conflictConstant.js'
import { MergeOrchestrator } from '../../../src/merger/MergeOrchestrator.js'
import { getScenario } from '../../../src/merger/MergeScenarioFactory.js'
import { defaultNodeFactory } from '../../../src/merger/nodes/MergeNodeFactory.js'
import { getScenarioStrategy } from '../../../src/merger/strategies/ScenarioStrategyFactory.js'
import type { MergeConfig } from '../../../src/types/conflictTypes.js'
import type { MergeResult } from '../../../src/types/mergeResult.js'
import { MergeScenario } from '../../../src/types/mergeScenario.js'

jest.mock('../../../src/merger/MergeScenarioFactory.js')
jest.mock('../../../src/merger/strategies/ScenarioStrategyFactory.js')

const mockedGetScenario = getScenario as jest.Mock
const mockedGetScenarioStrategy = getScenarioStrategy as jest.Mock

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

describe('MergeOrchestrator', () => {
  const mockStrategy = {
    execute: jest.fn(),
  }
  const mockResult: MergeResult = { hasConflict: false, output: [] }

  beforeEach(() => {
    jest.clearAllMocks()
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
      const attribute = 'testAttr'
      const rootKey = {
        name: 'testKey',
        existsInLocal: true,
        existsInOther: true,
      }
      const scenario = MergeScenario.ALL

      mockedGetScenario.mockReturnValue(scenario)

      // Act
      const result = orchestrator.merge(
        ancestor,
        local,
        other,
        attribute,
        rootKey
      )

      // Assert
      expect(mockedGetScenario).toHaveBeenCalledWith(ancestor, local, other)
      expect(mockedGetScenarioStrategy).toHaveBeenCalledWith(scenario)
      expect(mockStrategy.execute).toHaveBeenCalledWith({
        config: defaultConfig,
        ancestor,
        local,
        other,
        attribute,
        nodeFactory: defaultNodeFactory,
        rootKey,
      })
      expect(result).toBe(mockResult)
    })

    it('should use provided nodeFactory in context', () => {
      // Arrange
      const customNodeFactory = { createNode: jest.fn() }
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
