import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../src/constant/conflictConstant.js'
import { ConflictMarkerFormatter } from '../../../src/merger/ConflictMarkerFormatter.js'
import type { MergeConfig } from '../../../src/types/conflictTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

describe('ConflictMarkerFormatter', () => {
  describe('with default config (size 7)', () => {
    const formatter = new ConflictMarkerFormatter(defaultConfig)

    describe('correctConflictIndent', () => {
      it('should remove indentation before local conflict marker', () => {
        const input = '    <<<<<<<'
        const result = formatter.correctConflictIndent(input)
        expect(result).toBe('<<<<<<<')
      })

      it('should remove indentation before ancestor conflict marker', () => {
        const input = '    |||||||'
        const result = formatter.correctConflictIndent(input)
        expect(result).toBe('|||||||')
      })

      it('should remove indentation before separator', () => {
        const input = '    ======='
        const result = formatter.correctConflictIndent(input)
        expect(result).toBe('=======')
      })

      it('should remove indentation before other conflict marker', () => {
        const input = '    >>>>>>>'
        const result = formatter.correctConflictIndent(input)
        expect(result).toBe('>>>>>>>')
      })

      it('should remove empty lines', () => {
        const input = '    \n\nsome content'
        const result = formatter.correctConflictIndent(input)
        expect(result).toBe('some content')
      })

      it('should handle tabs as indentation', () => {
        const input = '\t\t<<<<<<<'
        const result = formatter.correctConflictIndent(input)
        expect(result).toBe('<<<<<<<')
      })

      it('should not modify content without conflict markers', () => {
        const input = '    <someTag>value</someTag>'
        const result = formatter.correctConflictIndent(input)
        expect(result).toBe('    <someTag>value</someTag>')
      })
    })

    describe('handleSpecialEntities', () => {
      it('should convert escaped local markers back to actual markers', () => {
        const input = '&lt;&lt;&lt;&lt;&lt;&lt;&lt;'
        const result = formatter.handleSpecialEntities(input)
        expect(result).toBe('<<<<<<<')
      })

      it('should convert escaped other markers back to actual markers', () => {
        const input = '&gt;&gt;&gt;&gt;&gt;&gt;&gt;'
        const result = formatter.handleSpecialEntities(input)
        expect(result).toBe('>>>>>>>')
      })

      it('should convert double-escaped nbsp entity', () => {
        const input = '&amp;#160;'
        const result = formatter.handleSpecialEntities(input)
        expect(result).toBe('&#160;')
      })

      it('should handle multiple replacements in same string', () => {
        const input =
          '&lt;&lt;&lt;&lt;&lt;&lt;&lt; LOCAL\ncontent\n&gt;&gt;&gt;&gt;&gt;&gt;&gt; REMOTE'
        const result = formatter.handleSpecialEntities(input)
        expect(result).toBe('<<<<<<< LOCAL\ncontent\n>>>>>>> REMOTE')
      })

      it('should not modify content without special entities', () => {
        const input = '<someTag>value</someTag>'
        const result = formatter.handleSpecialEntities(input)
        expect(result).toBe('<someTag>value</someTag>')
      })
    })
  })

  describe('with custom config (size 3)', () => {
    const customConfig: MergeConfig = {
      conflictMarkerSize: 3,
      ancestorConflictTag: 'BASE',
      localConflictTag: 'OURS',
      otherConflictTag: 'THEIRS',
    }
    const formatter = new ConflictMarkerFormatter(customConfig)

    describe('correctConflictIndent', () => {
      it('should remove indentation before 3-char local marker', () => {
        const input = '    <<<'
        const result = formatter.correctConflictIndent(input)
        expect(result).toBe('<<<')
      })

      it('should remove indentation before 3-char ancestor marker', () => {
        const input = '    |||'
        const result = formatter.correctConflictIndent(input)
        expect(result).toBe('|||')
      })

      it('should remove indentation before 3-char separator', () => {
        const input = '    ==='
        const result = formatter.correctConflictIndent(input)
        expect(result).toBe('===')
      })

      it('should remove indentation before 3-char other marker', () => {
        const input = '    >>>'
        const result = formatter.correctConflictIndent(input)
        expect(result).toBe('>>>')
      })

      it('should match 3-char prefix within 7-char markers', () => {
        const input = '    <<<<<<<'
        const result = formatter.correctConflictIndent(input)
        // Regex matches <<< at start, removing indent before it
        expect(result).toBe('<<<<<<<')
      })
    })

    describe('handleSpecialEntities', () => {
      it('should convert 3-char escaped local markers', () => {
        const input = '&lt;&lt;&lt;'
        const result = formatter.handleSpecialEntities(input)
        expect(result).toBe('<<<')
      })

      it('should convert 3-char escaped other markers', () => {
        const input = '&gt;&gt;&gt;'
        const result = formatter.handleSpecialEntities(input)
        expect(result).toBe('>>>')
      })

      it('should convert multiple 3-char patterns in 7-char input', () => {
        const input = '&lt;&lt;&lt;&lt;&lt;&lt;&lt;'
        const result = formatter.handleSpecialEntities(input)
        // 7 &lt; → replaces two groups of 3, leaving 1: <<<<<<&lt;
        expect(result).toBe('<<<<<<&lt;')
      })
    })
  })

  describe('with large config (size 10)', () => {
    const largeConfig: MergeConfig = {
      conflictMarkerSize: 10,
      ancestorConflictTag: 'ANCESTOR',
      localConflictTag: 'LOCAL',
      otherConflictTag: 'REMOTE',
    }
    const formatter = new ConflictMarkerFormatter(largeConfig)

    describe('correctConflictIndent', () => {
      it('should handle 10-char markers', () => {
        const input = '    <<<<<<<<<<'
        const result = formatter.correctConflictIndent(input)
        expect(result).toBe('<<<<<<<<<<')
      })
    })

    describe('handleSpecialEntities', () => {
      it('should convert 10-char escaped markers', () => {
        const input = '&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;'
        const result = formatter.handleSpecialEntities(input)
        expect(result).toBe('<<<<<<<<<<')
      })
    })
  })
})
