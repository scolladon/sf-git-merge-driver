import { describe, expect, it } from 'vitest'
import { ConflictMarkerFormatter } from '../../../src/merger/ConflictMarkerFormatter.js'
import type { MergeConfig } from '../../../src/types/conflictTypes.js'
import { defaultConfig } from '../../utils/testConfig.js'

describe('ConflictMarkerFormatter', () => {
  describe('with default config (size 7)', () => {
    const formatter = new ConflictMarkerFormatter(defaultConfig)

    describe('correctConflictIndent', () => {
      it('should remove indentation before local conflict marker', () => {
        // Arrange
        const input = '    <<<<<<<'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('<<<<<<<')
      })

      it('should remove indentation before ancestor conflict marker', () => {
        // Arrange
        const input = '    |||||||'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('|||||||')
      })

      it('should remove indentation before separator', () => {
        // Arrange
        const input = '    ======='

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('=======')
      })

      it('should remove indentation before other conflict marker', () => {
        // Arrange
        const input = '    >>>>>>>'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('>>>>>>>')
      })

      it('should remove empty lines', () => {
        // Arrange
        const input = '    \n\nsome content'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('some content')
      })

      it('should handle tabs as indentation', () => {
        // Arrange
        const input = '\t\t<<<<<<<'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('<<<<<<<')
      })

      it('should remove indentation before multiple markers in one string', () => {
        // Arrange — tests the 'g' flag on indentRegex
        const input = '    <<<<<<< local\ncontent\n    ||||||| ancestor'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('<<<<<<< local\ncontent\n||||||| ancestor')
      })

      it('should remove lines with only whitespace and CR', () => {
        // Arrange — exercises the [\n\r] character class in blank line regex
        const input = '  \r\nsome content'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('some content')
      })

      it('should not modify content without conflict markers', () => {
        // Arrange
        const input = '    <someTag>value</someTag>'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('    <someTag>value</someTag>')
      })
    })

    describe('handleSpecialEntities', () => {
      it('should convert escaped local markers back to actual markers', () => {
        // Arrange
        const input = '&lt;&lt;&lt;&lt;&lt;&lt;&lt;'

        // Act
        const result = formatter.handleSpecialEntities(input)

        // Assert
        expect(result).toBe('<<<<<<<')
      })

      it('should convert escaped other markers back to actual markers', () => {
        // Arrange
        const input = '&gt;&gt;&gt;&gt;&gt;&gt;&gt;'

        // Act
        const result = formatter.handleSpecialEntities(input)

        // Assert
        expect(result).toBe('>>>>>>>')
      })

      it('should convert double-escaped nbsp entity', () => {
        // Arrange
        const input = '&amp;#160;'

        // Act
        const result = formatter.handleSpecialEntities(input)

        // Assert
        expect(result).toBe('&#160;')
      })

      it('should handle multiple replacements in same string', () => {
        // Arrange
        const input =
          '&lt;&lt;&lt;&lt;&lt;&lt;&lt; ours\ncontent\n&gt;&gt;&gt;&gt;&gt;&gt;&gt; theirs'

        // Act
        const result = formatter.handleSpecialEntities(input)

        // Assert
        expect(result).toBe('<<<<<<< ours\ncontent\n>>>>>>> theirs')
      })

      it('should not modify content without special entities', () => {
        // Arrange
        const input = '<someTag>value</someTag>'

        // Act
        const result = formatter.handleSpecialEntities(input)

        // Assert
        expect(result).toBe('<someTag>value</someTag>')
      })
    })
  })

  describe('with custom config (size 3)', () => {
    // Arrange
    const customConfig: MergeConfig = {
      conflictMarkerSize: 3,
      ancestorConflictTag: 'BASE',
      localConflictTag: 'OURS',
      otherConflictTag: 'THEIRS',
    }
    const formatter = new ConflictMarkerFormatter(customConfig)

    describe('correctConflictIndent', () => {
      it('should remove indentation before 3-char local marker', () => {
        // Arrange
        const input = '    <<<'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('<<<')
      })

      it('should remove indentation before 3-char ancestor marker', () => {
        // Arrange
        const input = '    |||'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('|||')
      })

      it('should remove indentation before 3-char separator', () => {
        // Arrange
        const input = '    ==='

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('===')
      })

      it('should remove indentation before 3-char other marker', () => {
        // Arrange
        const input = '    >>>'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('>>>')
      })

      it('should match 3-char prefix within 7-char markers', () => {
        // Arrange
        const input = '    <<<<<<<'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        // Regex matches <<< at start, removing indent before it
        expect(result).toBe('<<<<<<<')
      })
    })

    describe('handleSpecialEntities', () => {
      it('should convert 3-char escaped local markers', () => {
        // Arrange
        const input = '&lt;&lt;&lt;'

        // Act
        const result = formatter.handleSpecialEntities(input)

        // Assert
        expect(result).toBe('<<<')
      })

      it('should convert 3-char escaped other markers', () => {
        // Arrange
        const input = '&gt;&gt;&gt;'

        // Act
        const result = formatter.handleSpecialEntities(input)

        // Assert
        expect(result).toBe('>>>')
      })

      it('should convert multiple 3-char patterns in 7-char input', () => {
        // Arrange
        const input = '&lt;&lt;&lt;&lt;&lt;&lt;&lt;'

        // Act
        const result = formatter.handleSpecialEntities(input)

        // Assert
        // 7 &lt; → replaces two groups of 3, leaving 1: <<<<<<&lt;
        expect(result).toBe('<<<<<<&lt;')
      })
    })
  })

  describe('with large config (size 10)', () => {
    // Arrange
    const largeConfig: MergeConfig = {
      conflictMarkerSize: 10,
      ancestorConflictTag: 'ANCESTOR',
      localConflictTag: 'LOCAL',
      otherConflictTag: 'REMOTE',
    }
    const formatter = new ConflictMarkerFormatter(largeConfig)

    describe('correctConflictIndent', () => {
      it('should handle 10-char markers', () => {
        // Arrange
        const input = '    <<<<<<<<<<'

        // Act
        const result = formatter.correctConflictIndent(input)

        // Assert
        expect(result).toBe('<<<<<<<<<<')
      })
    })

    describe('handleSpecialEntities', () => {
      it('should convert 10-char escaped markers', () => {
        // Arrange
        const input = '&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;'

        // Act
        const result = formatter.handleSpecialEntities(input)

        // Assert
        expect(result).toBe('<<<<<<<<<<')
      })
    })
  })
})
