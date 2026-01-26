import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../src/constant/conflictConstant.js'
import type { MergeContext } from '../../../../src/merger/MergeContext.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import { NoneStrategy } from '../../../../src/merger/strategies/NoneStrategy.js'
import type { MergeConfig } from '../../../../src/types/conflictTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

const createContext = (
  overrides: Partial<MergeContext> = {}
): MergeContext => ({
  config: defaultConfig,
  ancestor: {},
  local: {},
  other: {},
  attribute: undefined,
  nodeFactory: defaultNodeFactory,
  rootKey: undefined,
  ...overrides,
})

describe('NoneStrategy', () => {
  const strategy = new NoneStrategy()

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

  it('should ignore attribute', () => {
    // Arrange
    const context = createContext({ attribute: 'testAttr' })

    // Act
    const result = strategy.execute(context)

    // Assert
    expect(result.output).toEqual([])
    expect(result.hasConflict).toBe(false)
  })
})
