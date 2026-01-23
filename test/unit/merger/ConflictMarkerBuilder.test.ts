import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../src/constant/conflictConstant.js'
import { SALESFORCE_EOL } from '../../../src/constant/metadataConstant.js'
import { TEXT_TAG } from '../../../src/constant/parserConstant.js'
import { buildConflictMarkers } from '../../../src/merger/ConflictMarkerBuilder.js'
import type { MergeConfig } from '../../../src/types/conflictTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

describe('ConflictMarkerBuilder', () => {
  describe('buildConflictMarkers', () => {
    it('should build conflict markers with all values present', () => {
      // Arrange
      const local = { field: [{ [TEXT_TAG]: 'localValue' }] }
      const ancestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const other = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = buildConflictMarkers(defaultConfig, local, ancestor, other)

      // Assert
      expect(result).toHaveLength(7)
      expect(result[0]).toEqual({
        [TEXT_TAG]: `${SALESFORCE_EOL}<<<<<<< LOCAL`,
      })
      expect(result[1]).toEqual(local)
      expect(result[2]).toEqual({ [TEXT_TAG]: '||||||| BASE' })
      expect(result[3]).toEqual(ancestor)
      expect(result[4]).toEqual({ [TEXT_TAG]: '=======' })
      expect(result[5]).toEqual(other)
      expect(result[6]).toEqual({ [TEXT_TAG]: '>>>>>>> REMOTE' })
    })

    it('should use empty value placeholder when local is empty', () => {
      // Arrange
      const local = {}
      const ancestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const other = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = buildConflictMarkers(defaultConfig, local, ancestor, other)

      // Assert
      expect(result[1]).toEqual({ [TEXT_TAG]: SALESFORCE_EOL })
    })

    it('should use empty value placeholder when ancestor is empty', () => {
      // Arrange
      const local = { field: [{ [TEXT_TAG]: 'localValue' }] }
      const ancestor = {}
      const other = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = buildConflictMarkers(defaultConfig, local, ancestor, other)

      // Assert
      expect(result[3]).toEqual({ [TEXT_TAG]: SALESFORCE_EOL })
    })

    it('should use empty value placeholder when other is empty', () => {
      // Arrange
      const local = { field: [{ [TEXT_TAG]: 'localValue' }] }
      const ancestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const other = {}

      // Act
      const result = buildConflictMarkers(defaultConfig, local, ancestor, other)

      // Assert
      expect(result[5]).toEqual({ [TEXT_TAG]: SALESFORCE_EOL })
    })

    it('should respect custom conflict marker size', () => {
      // Arrange
      const config: MergeConfig = {
        ...defaultConfig,
        conflictMarkerSize: 3,
      }
      const local = { field: [{ [TEXT_TAG]: 'localValue' }] }
      const ancestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const other = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = buildConflictMarkers(config, local, ancestor, other)

      // Assert
      expect(result[0]).toEqual({ [TEXT_TAG]: `${SALESFORCE_EOL}<<< LOCAL` })
      expect(result[2]).toEqual({ [TEXT_TAG]: '||| BASE' })
      expect(result[4]).toEqual({ [TEXT_TAG]: '===' })
      expect(result[6]).toEqual({ [TEXT_TAG]: '>>> REMOTE' })
    })

    it('should respect custom conflict tags', () => {
      // Arrange
      const config: MergeConfig = {
        ...defaultConfig,
        localConflictTag: 'OURS',
        ancestorConflictTag: 'ANCESTOR',
        otherConflictTag: 'THEIRS',
      }
      const local = { field: [{ [TEXT_TAG]: 'localValue' }] }
      const ancestor = { field: [{ [TEXT_TAG]: 'ancestorValue' }] }
      const other = { field: [{ [TEXT_TAG]: 'otherValue' }] }

      // Act
      const result = buildConflictMarkers(config, local, ancestor, other)

      // Assert
      expect(result[0]).toEqual({ [TEXT_TAG]: `${SALESFORCE_EOL}<<<<<<< OURS` })
      expect(result[2]).toEqual({ [TEXT_TAG]: '||||||| ANCESTOR' })
      expect(result[6]).toEqual({ [TEXT_TAG]: '>>>>>>> THEIRS' })
    })

    it('should handle arrays as values', () => {
      // Arrange
      const local = [{ field: [{ [TEXT_TAG]: 'localValue' }] }]
      const ancestor = [{ field: [{ [TEXT_TAG]: 'ancestorValue' }] }]
      const other = [{ field: [{ [TEXT_TAG]: 'otherValue' }] }]

      // Act
      const result = buildConflictMarkers(defaultConfig, local, ancestor, other)

      // Assert
      expect(result[1]).toEqual(local)
      expect(result[3]).toEqual(ancestor)
      expect(result[5]).toEqual(other)
    })
  })
})
