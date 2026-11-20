import { describe, expect, it } from 'vitest'
import { sameContent } from '../../../src/merger/sameContent.js'

const label = (fullName: string, value = 'v') => ({ fullName, value })

describe('sameContent', () => {
  describe('given an element whose attributes are reordered', () => {
    it.each([
      [
        'at the top',
        { '@_a': '1', '@_b': '2', x: '1' },
        { '@_b': '2', '@_a': '1', x: '1' },
        true,
      ],
      [
        'in an entry of an unordered keyed array',
        { labels: [{ '@_a': '1', '@_b': '2', fullName: 'A' }] },
        { labels: [{ '@_b': '2', '@_a': '1', fullName: 'A' }] },
        true,
      ],
      [
        'with an attribute value that differs',
        { '@_a': '1', '@_b': '2', x: '1' },
        { '@_b': '3', '@_a': '1', x: '1' },
        false,
      ],
      [
        'with the child tags reordered too',
        { '@_a': '1', '@_b': '2', x: '1', y: '2' },
        { '@_b': '2', '@_a': '1', y: '2', x: '1' },
        false,
      ],
      [
        'with an attribute swapped for another',
        { '@_a': '1', x: '1' },
        { '@_b': '1', x: '1' },
        false,
      ],
    ])(
      'when the attributes stand in another order %s then it matches the expectation',
      (_, ancestor, local, expected) => {
        // Act
        const sut = sameContent(ancestor, local)

        // Assert
        expect(sut).toBe(expected)
      }
    )
  })

  describe('given an element whose child tags are reordered', () => {
    it('when the tags stand in another order then it is not the same content', () => {
      // Arrange
      const ancestor = { label: 'x', type: 'Text' }
      const local = { type: 'Text', label: 'x' }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })

    it('when the tags of an entry of an unordered keyed array are reordered then it is not the same content', () => {
      // Arrange
      const ancestor = { labels: [{ fullName: 'A', value: 'v' }] }
      const local = { labels: [{ value: 'v', fullName: 'A' }] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })

    it('when the tags of one of several entries are reordered then it is not the same content', () => {
      // Arrange
      const ancestor = { labels: [label('A'), label('B'), label('B')] }
      const local = {
        labels: [label('A'), label('B'), { value: 'v', fullName: 'B' }],
      }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })
  })

  describe('given an unordered keyed array', () => {
    it('when the entries are reordered then it is the same content', () => {
      // Arrange
      const ancestor = { labels: [label('A'), label('B')] }
      const local = { labels: [label('B'), label('A')] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(true)
    })

    it('when an entry is edited then it is not the same content', () => {
      // Arrange
      const ancestor = { labels: [label('A'), label('B')] }
      const local = { labels: [label('B', 'edited'), label('A')] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })

    it('when a key is replaced by another then it is not the same content', () => {
      // Arrange
      const ancestor = { labels: [label('A'), label('B')] }
      const local = { labels: [label('A'), label('C')] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })

    it('when the lengths differ then it is not the same content', () => {
      // Arrange
      const ancestor = { labels: [label('A'), label('B')] }
      const local = { labels: [label('A')] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })

    it('when a key repeats a different number of times then it is not the same content', () => {
      // Arrange
      const ancestor = { labels: [label('A'), label('A'), label('B')] }
      const local = { labels: [label('A'), label('B'), label('B')] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })

    it('when repeated copies of a key are reordered then it is the same content', () => {
      // Arrange
      const ancestor = { labels: [label('A', 'x'), label('A', 'y')] }
      const local = { labels: [label('A', 'y'), label('A', 'x')] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(true)
    })
  })

  describe('given an ordered array', () => {
    it('when the entries are reordered then it is not the same content', () => {
      // Arrange
      const values = [{ fullName: 'a' }, { fullName: 'b' }]
      const ancestor = { customValue: values }
      const local = { customValue: [...values].reverse() }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })

    it('when the entries are equal in place then it is the same content', () => {
      // Arrange
      const ancestor = { customValue: [{ fullName: 'a' }, { fullName: 'b' }] }
      const local = { customValue: [{ fullName: 'a' }, { fullName: 'b' }] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(true)
    })
  })

  describe('given a keyless array', () => {
    it('when the entries are reordered then it is not the same content', () => {
      // Arrange
      const ancestor = { labels: [{ value: 'a' }, { value: 'b' }] }
      const local = { labels: [{ value: 'b' }, { value: 'a' }] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })
  })

  describe('given a text array', () => {
    it('when the items are reordered then it is the same content', () => {
      // Arrange
      const ancestor = { members: ['a', 'b'] }
      const local = { members: ['b', 'a'] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(true)
    })

    it('when the items of a member list are not all strings then reordering is still the same content', () => {
      // Arrange
      const ancestor = { members: [1, 'b'] }
      const local = { members: ['b', 1] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(true)
    })

    it('when an item is replaced then it is not the same content', () => {
      // Arrange
      const ancestor = { members: ['a', 'b'] }
      const local = { members: ['b', 'c'] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })
  })

  describe('given nested content', () => {
    it('when an unordered array nested in an entry is reordered then it is the same content', () => {
      // Arrange
      const ancestor = { Profile: { fieldPermissions: [{ field: 'F' }] } }
      const local = { Profile: { fieldPermissions: [{ field: 'F' }] } }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(true)
    })

    it('when the shapes differ then it is not the same content', () => {
      // Arrange
      const ancestor = { labels: [label('A')] }

      // Act
      const sut = [
        sameContent(ancestor, { labels: label('A') }),
        sameContent(ancestor, {}),
        sameContent(ancestor, { other: [label('A')] }),
        sameContent(ancestor, undefined),
      ]

      // Assert
      expect(sut).toEqual([false, false, false, false])
    })
  })

  describe('given several copies of one key', () => {
    const copy = (editable: string, nested: string[] = []) => ({
      field: 'Same',
      editable,
      fieldPermissions: nested.map(field => ({ field })),
    })

    it('when the copies come back reordered then it is the same content', () => {
      // Arrange
      const ancestor = { fieldPermissions: [copy('1'), copy('2'), copy('3')] }
      const local = { fieldPermissions: [copy('3'), copy('1'), copy('2')] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(true)
    })

    it('when the copies hold the same unordered arrays in another order then it is the same content', () => {
      // Arrange
      const ancestor = {
        fieldPermissions: [copy('1', ['A', 'B']), copy('2', ['C'])],
      }
      const local = {
        fieldPermissions: [copy('2', ['C']), copy('1', ['B', 'A'])],
      }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(true)
    })

    it('when one copy is edited then it is not the same content', () => {
      // Arrange
      const ancestor = { fieldPermissions: [copy('1'), copy('2'), copy('3')] }
      const local = { fieldPermissions: [copy('3'), copy('9'), copy('1')] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })

    it('when a copy has no counterpart among differently built ones then it is not the same content', () => {
      // Arrange
      const ancestor = { fieldPermissions: [copy('1'), copy('2')] }
      const local = { fieldPermissions: [copy('1'), copy('1')] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })

    it('when the copies differ in an ordered array nested in them then the order counts', () => {
      // Arrange
      const nested = (order: string[]) => ({
        field: 'Same',
        customValue: order.map(fullName => ({ fullName })),
      })
      const ancestor = {
        fieldPermissions: [nested(['A', 'B']), nested(['C'])],
      }
      const local = {
        fieldPermissions: [nested(['C']), nested(['B', 'A'])],
      }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })
  })

  describe('given a null beside an empty element', () => {
    it('when comparing them then it is not the same content', () => {
      // Arrange
      const ancestor = { value: null }
      const local = { value: {} }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })
  })

  describe('given an array of a tag with no known type', () => {
    it.each([
      ['strings come back reordered', ['a', 'b'], ['b', 'a'], true],
      ['numbers come back reordered', [1, 2], [2, 1], false],
      [
        'a string and an element with reordered attributes',
        ['x', { '@_a': '1', '@_b': '2' }],
        ['x', { '@_b': '2', '@_a': '1' }],
        true,
      ],
      [
        'elements with reordered attributes',
        [{ '@_a': '1', '@_b': '2' }],
        [{ '@_b': '2', '@_a': '1' }],
        true,
      ],
    ])(
      'when %s then it matches the expectation',
      (_, left, right, expected) => {
        // Arrange
        const [ancestor, local] = [{ tag: left }, { tag: right }]

        // Act
        const sut = sameContent(ancestor, local)

        // Assert
        expect(sut).toBe(expected)
      }
    )
  })

  describe('given an array of a text tag holding elements', () => {
    it.each([
      ['elements', [{ a: '1' }, { b: '2' }], [{ b: '2' }, { a: '1' }]],
      ['an element and a string', [{ a: '1' }, 'x'], ['x', { a: '1' }]],
    ])(
      'when %s come back reordered then it is not the same content',
      (_, left, right) => {
        // Arrange
        const [ancestor, local] = [{ members: left }, { members: right }]

        // Act
        const sut = sameContent(ancestor, local)

        // Assert
        expect(sut).toBe(false)
      }
    )
  })

  describe('given entries of an unordered keyed array', () => {
    it('when the attributes of one of several entries are reordered then it is the same content', () => {
      // Arrange
      const ancestor = {
        labels: [{ '@_a': '1', '@_b': '2', fullName: 'A' }, label('B')],
      }
      const local = {
        labels: [label('B'), { '@_b': '2', '@_a': '1', fullName: 'A' }],
      }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(true)
    })

    it('when one entry has no key then reordering the entries is not the same content', () => {
      // Arrange
      const ancestor = { labels: [label('A'), { value: 'w' }] }
      const local = { labels: [{ value: 'w' }, label('A')] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })
  })

  describe('given a tag with no key holding elements with reordered attributes', () => {
    it('when comparing them then it is the same content', () => {
      // Arrange
      const ancestor = { unknown: [{ '@_a': '1', '@_b': '2' }] }
      const local = { unknown: [{ '@_b': '2', '@_a': '1' }] }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(true)
    })
  })

  describe('given several copies of one key holding arrays that read alike once joined', () => {
    const copyWith = (extra: object) => ({ field: 'Same', ...extra })

    it.each([
      ['an array of numbers', 'tag', [1, 2], [12]],
      ['an unordered array of numbers', 'members', [1, 2], [12]],
      [
        'an unordered array of entries',
        'fieldPermissions',
        [{ field: 'A' }],
        [{ field: 'B' }],
      ],
    ])(
      'when the copies differ in %s then it is not the same content',
      (_, name, left, right) => {
        // Arrange
        const other = copyWith({ [name]: [3] })
        const ancestor = {
          fieldPermissions: [copyWith({ [name]: left }), other],
        }
        const local = { fieldPermissions: [copyWith({ [name]: right }), other] }

        // Act
        const sut = sameContent(ancestor, local)

        // Assert
        expect(sut).toBe(false)
      }
    )

    it('when the copies hold an array of a tag with no known type in another order then it is the same content', () => {
      // Arrange
      const ancestor = {
        fieldPermissions: [
          copyWith({ tag: ['a', 'b'] }),
          copyWith({ tag: ['c'] }),
        ],
      }
      const local = {
        fieldPermissions: [
          copyWith({ tag: ['c'] }),
          copyWith({ tag: ['b', 'a'] }),
        ],
      }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(true)
    })
  })

  describe('given arrays kept in place', () => {
    it.each([
      [
        'one is a prefix of the other',
        { labels: [{ value: 'a' }] },
        { labels: [{ value: 'a' }, { value: 'b' }] },
        false,
      ],
      [
        'one entry differs',
        { customValue: [{ fullName: 'a' }, { fullName: 'b' }] },
        { customValue: [{ fullName: 'a' }, { fullName: 'c' }] },
        false,
      ],
      [
        'an entry has its attributes reordered beside reordered entries',
        {
          labels: [label('A'), label('B')],
          customValue: [{ '@_a': '1', '@_b': '2', fullName: 'a' }],
        },
        {
          labels: [label('B'), label('A')],
          customValue: [{ '@_b': '2', '@_a': '1', fullName: 'a' }],
        },
        true,
      ],
    ])(
      'when %s then it matches the expectation',
      (_, ancestor, local, expected) => {
        // Act
        const sut = sameContent(ancestor, local)

        // Assert
        expect(sut).toBe(expected)
      }
    )
  })

  describe('given an array beside a string as long as the array', () => {
    it('when comparing them then it is not the same content', () => {
      // Arrange
      const ancestor = { tag: ['a', 'b', 'c'] }
      const local = { tag: 'abc' }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(false)
    })
  })

  describe('given attributes and unordered arrays that both change', () => {
    it.each([
      [
        'the attributes are reordered',
        { '@_a': '1', '@_b': '2', labels: [label('A'), label('B')] },
        { '@_b': '2', '@_a': '1', labels: [label('B'), label('A')] },
        true,
      ],
      [
        'the other side holds one more attribute',
        { '@_a': '1', labels: [label('A'), label('B')] },
        { '@_a': '1', '@_b': '2', labels: [label('B'), label('A')] },
        false,
      ],
    ])(
      'when %s then it matches the expectation',
      (_, ancestor, local, expected) => {
        // Act
        const sut = sameContent(ancestor, local)

        // Assert
        expect(sut).toBe(expected)
      }
    )
  })

  describe('given thousands of entries in one bucket', () => {
    const THOUSANDS = 20_000
    const BUDGET_MS = 2000

    it('when the same text value repeats then it compares in linear time', {
      timeout: BUDGET_MS,
    }, () => {
      // Arrange
      const ancestor = { members: Array(THOUSANDS).fill('X') }
      const local = { members: Array(THOUSANDS).fill('X') }
      local.members[0] = 'Y'

      // Act
      const sut = [
        sameContent(ancestor, { members: Array(THOUSANDS).fill('X') }),
        sameContent(ancestor, local),
      ]

      // Assert
      expect(sut).toEqual([true, false])
    })

    it('when the copies of a key come back reversed then they compare in linear time', {
      timeout: BUDGET_MS,
    }, () => {
      // Arrange
      const copies = Array.from({ length: THOUSANDS }, (_, index) => ({
        field: 'Same',
        editable: String(index),
      }))
      const ancestor = { fieldPermissions: copies }
      const local = { fieldPermissions: [...copies].reverse() }

      // Act
      const sut = sameContent(ancestor, local)

      // Assert
      expect(sut).toBe(true)
    })
  })
})
