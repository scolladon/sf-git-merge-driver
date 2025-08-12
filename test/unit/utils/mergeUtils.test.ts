import { EOL } from 'os'
import {
  detectEol,
  ensureArray,
  getUniqueSortedProps,
  isObject,
  normalizeEol,
} from '../../../src/utils/mergeUtils.js'

describe('mergeUtils', () => {
  describe('isObject', () => {
    it('given one non-nil object when isObject then returns true', () => {
      // Arrange
      const ancestor = null
      const local = { a: 1 }
      const other = undefined

      // Act
      const result = isObject(ancestor, local, other)

      // Assert
      expect(result).toBe(true)
    })

    it('given only primitives and nil when isObject then returns false', () => {
      // Arrange
      const ancestor = 'x'
      const local = null
      const other = 1

      // Act
      const result = isObject(ancestor, local, other)

      // Assert
      expect(result).toBe(false)
    })

    it('given all nil when isObject then returns false', () => {
      // Arrange
      // Act
      const result = isObject(undefined, undefined, null)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('ensureArray', () => {
    it('given undefined when ensureArray then returns empty array', () => {
      // Arrange
      // Act
      const result = ensureArray(undefined as unknown as never)

      // Assert
      expect(result).toEqual([])
    })

    it('given primitive when ensureArray then wraps into array', () => {
      // Arrange
      // Act
      const result = ensureArray('x' as unknown as never)

      // Assert
      expect(result).toEqual(['x'])
    })

    it('given array when ensureArray then returns same values', () => {
      // Arrange
      const arr = [1, 2]

      // Act
      const result = ensureArray(arr as unknown as never)

      // Assert
      expect(result).toEqual([1, 2])
    })
  })

  describe('getUniqueSortedProps', () => {
    it('given multiple objects and arrays when getUniqueSortedProps then returns unique sorted keys', () => {
      // Arrange
      const a = { b: 1, a: 2 }
      const b = { c: 3, a: 4 }
      const c = ['x', 'y'] // keys: '0','1'
      const d = null
      const e = undefined

      // Act
      const result = getUniqueSortedProps(
        a as never,
        b as never,
        c as never,
        d as never,
        e as never
      )

      // Assert
      expect(result).toEqual(['0', '1', 'a', 'b', 'c'])
    })
  })

  describe('EOL helpers', () => {
    describe('detectEol', () => {
      type Case = { name: string; input: string | undefined; expected: string }

      const cases: Case[] = [
        {
          name: 'given CRLF-only content when detectEol then returns CRLF',
          input: 'a\r\nb\r\n',
          expected: '\r\n',
        },
        {
          name: 'given LF-only content when detectEol then returns LF',
          input: 'a\nb\n',
          expected: '\n',
        },
        {
          name: 'given mix EOL content when detectEol then returns os.EOL',
          input: 'a\r\nb\n',
          expected: EOL,
        },
        {
          name: 'given no EOL content when detectEol then returns os.EOL',
          input: 'abc',
          expected: EOL,
        },
        {
          name: 'given undefined content when detectEol then returns os.EOL',
          input: undefined as unknown as never,
          expected: EOL,
        },
      ]

      it.each(cases)('$name', ({ input, expected }) => {
        // Arrange
        // Act
        const eol = detectEol(input as never)
        // Assert
        expect(eol).toBe(expected)
      })
    })

    describe('normalizeEol', () => {
      type Case = {
        name: string
        input: string | undefined
        eol: string | undefined
        expected: string | undefined
      }
      const cases: Case[] = [
        {
          name: 'given eol undefined then returns platform EOL',
          input: 'a\r\nb\r\n',
          eol: undefined as unknown as never,
          expected: 'a\nb\n',
        },
        {
          name: 'given input undefined then returns undefined',
          input: undefined as unknown as never,
          eol: '\n',
          expected: undefined as unknown as never,
        },

        {
          name: 'given eol LF and text already LF then returns text unchanged',
          input: 'a\n b\n',
          eol: '\n',
          expected: 'a\n b\n',
        },
        {
          name: 'given eol CRLF and text already CRLF then returns text unchanged',
          input: 'a\r\n b\r\n',
          eol: '\r\n',
          expected: 'a\r\n b\r\n',
        },
        {
          name: 'given no line breaks with CRLF then returns text unchanged',
          input: 'abc',
          eol: '\r\n',
          expected: 'abc',
        },
        {
          name: 'given no line breaks with LF then returns text unchanged',
          input: 'abc',
          eol: '\n',
          expected: 'abc',
        },
        {
          name: 'given CRLF-only text with LF then converts to LF',
          input: '<a>\r\n 1\r\n</a>',
          eol: '\n',
          expected: '<a>\n 1\n</a>',
        },
        {
          name: 'given LF-only text with CRLF then converts to CRLF',
          input: '<a>\n 1\n</a>',
          eol: '\r\n',
          expected: '<a>\r\n 1\r\n</a>',
        },
        {
          name: 'given solitary CR only with LF then not stripped',
          input: 'a\rb\r',
          eol: '\n',
          expected: 'a\rb\r',
        },
        {
          name: 'given solitary CR only with CRLF then not stripped',
          input: 'a\rb\r',
          eol: '\r\n',
          expected: 'a\rb\r',
        },
        {
          name: 'given mixed CR, LF, CRLF then normalized to LF',
          input: 'a\rb\n\rc\r\nd',
          eol: '\n',
          expected: 'a\rb\n\rc\nd',
        },
        {
          name: 'given mixed CR, LF, CRLF then normalized to CRLF',
          input: 'a\rb\n\rc\r\nd',
          eol: '\r\n',
          expected: 'a\rb\r\n\rc\r\nd',
        },
      ]

      it.each(cases)('$name', ({ input, eol, expected }) => {
        // Arrange
        // Act
        const out = normalizeEol(input as never, eol as never)
        // Assert
        expect(out).toBe(expected)
      })
    })
  })
})
