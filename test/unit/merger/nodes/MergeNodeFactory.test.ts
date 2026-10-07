import { afterEach, describe, expect, it, vi } from 'vitest'
import { KeyedArrayMergeNode } from '../../../../src/merger/nodes/KeyedArrayMergeNode.js'
import { defaultNodeFactory } from '../../../../src/merger/nodes/MergeNodeFactory.js'
import { PropertyMergeNode } from '../../../../src/merger/nodes/PropertyMergeNode.js'
import { TextArrayMergeNode } from '../../../../src/merger/nodes/TextArrayMergeNode.js'
import { TextMergeNode } from '../../../../src/merger/nodes/TextMergeNode.js'
import { MetadataService } from '../../../../src/service/MetadataService.js'
import type { JsonObject, JsonValue } from '../../../../src/types/jsonTypes.js'
import { defaultConfig } from '../../../utils/testConfig.js'

describe('MergeNodeFactory', () => {
  describe('defaultNodeFactory', () => {
    const factory = defaultNodeFactory

    describe('createNode', () => {
      afterEach(() => {
        vi.restoreAllMocks()
      })

      it('given string arrays when createNode then returns TextArrayMergeNode', () => {
        // Arrange
        const ancestor = ['a', 'b']
        const local = ['c', 'd']
        const other = ['e', 'f']

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(TextArrayMergeNode)
      })

      it('given one string array when createNode then returns TextArrayMergeNode', () => {
        // Arrange
        const ancestor = null
        const local = ['a', 'b']
        const other = undefined as never

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(TextArrayMergeNode)
      })

      it('given attribute=members with scalar values on all three sides (cardinality 1) then returns TextArrayMergeNode', () => {
        // Arrange — a single occurrence on every side parses to a bare
        // scalar (isStringArray sees no array at all), but 'members' is a
        // known text-array attribute regardless of incidental cardinality.
        const ancestor = 'Obj1'
        const local = 'Obj1b'
        const other = 'Obj1'

        // Act
        const node = factory.createNode(ancestor, local, other, 'members')

        // Assert
        expect(node).toBeInstanceOf(TextArrayMergeNode)
      })

      it('given attribute=members with null on every side when createNode then returns TextArrayMergeNode', () => {
        // Arrange — regression guard: none of the three sides is a known
        // object, so isKnownObject must stay false and route to the
        // text-array branch rather than falling through to PropertyMergeNode.
        const ancestor = null
        const local = null
        const other = null

        // Act
        const node = factory.createNode(ancestor, local, other, 'members')

        // Assert
        expect(node).toBeInstanceOf(TextArrayMergeNode)
      })

      it('given attribute=members with exactly one object side when createNode then returns PropertyMergeNode', () => {
        // Arrange — regression guard: isKnownObject must fire on *any*
        // object side, not only when every side is one.
        const ancestor = { sub: 'a' }
        const local = 'b'
        const other = 'c'

        // Act
        const node = factory.createNode(ancestor, local, other, 'members')

        // Assert
        expect(node).toBeInstanceOf(PropertyMergeNode)
      })

      it('given an unrelated attribute with scalar values on all three sides then still returns TextMergeNode', () => {
        // Arrange — regression guard: the forced routing must not leak to
        // every scalar attribute, only the ones MetadataService lists.
        const ancestor = 'Obj1'
        const local = 'Obj1b'
        const other = 'Obj1'

        // Act
        const node = factory.createNode(ancestor, local, other, 'name')

        // Assert
        expect(node).toBeInstanceOf(TextMergeNode)
      })

      it('given a scalar trio on an ordinary attribute when createNode then returns TextMergeNode without consulting the key extractor', () => {
        // Arrange
        const getKeyFieldExtractor = vi.spyOn(
          MetadataService,
          'getKeyFieldExtractor'
        )
        const ancestor = 'a'
        const local = 'b'
        const other = 'c'

        // Act
        const node = factory.createNode(ancestor, local, other, 'name')

        // Assert
        expect(node).toBeInstanceOf(TextMergeNode)
        expect(getKeyFieldExtractor).not.toHaveBeenCalled()
      })

      it('given a scalar trio on a text-array attribute when createNode then returns TextArrayMergeNode without consulting the key extractor', () => {
        // Arrange
        const getKeyFieldExtractor = vi.spyOn(
          MetadataService,
          'getKeyFieldExtractor'
        )
        const ancestor = 'Obj1'
        const local = 'Obj1b'
        const other = 'Obj1'

        // Act
        const node = factory.createNode(ancestor, local, other, 'members')

        // Assert
        expect(node).toBeInstanceOf(TextArrayMergeNode)
        expect(getKeyFieldExtractor).not.toHaveBeenCalled()
      })

      it('given mixed null, number and boolean sides when createNode then returns TextMergeNode', () => {
        // Arrange
        const ancestor = null
        const local = 42
        const other = false

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(TextMergeNode)
      })

      it('given one object side when createNode then it takes the object route, not the scalar exit', () => {
        // Arrange
        const ancestor = { a: 1 }
        const local = 'b'
        const other = 'c'

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(PropertyMergeNode)
      })

      it('given attribute=members with object-shaped values then returns PropertyMergeNode, not TextArrayMergeNode', () => {
        // Arrange — the schema override exists to defeat an *incidental*
        // cardinality check, not the shape checks below it. TextArrayMergeNode
        // dedups with `new Set(items)` (reference identity — never matches
        // across two parsed sides) and sorts via JSON.stringify, so routing
        // object-shaped values there unions every side instead of merging
        // them property by property.
        const ancestor = { sub: 'a' }
        const local = { sub: 'b' }
        const other = { sub: 'a' }

        // Act
        const node = factory.createNode(ancestor, local, other, 'members')

        // Assert
        expect(node).toBeInstanceOf(PropertyMergeNode)
      })

      it('given objects when createNode then returns PropertyMergeNode', () => {
        // Arrange
        const ancestor = { a: 1 }
        const local = { b: 2 }
        const other = { c: 3 }

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(PropertyMergeNode)
      })

      it('given one object when createNode then returns PropertyMergeNode', () => {
        // Arrange
        const ancestor = null
        const local = { a: 1 }
        const other = undefined as never

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(PropertyMergeNode)
      })

      it('given primitives when createNode then returns TextMergeNode', () => {
        // Arrange
        const ancestor = 'x'
        const local = 'y'
        const other = 'z'

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(TextMergeNode)
      })

      it('given all nil when createNode then returns TextMergeNode', () => {
        // Arrange
        // Act
        const node = factory.createNode(
          undefined as never,
          undefined as never,
          null,
          'attr'
        )

        // Assert
        expect(node).toBeInstanceOf(TextMergeNode)
      })

      it('given empty array when createNode then returns TextArrayMergeNode', () => {
        // Arrange
        const ancestor = null
        const local: string[] = []
        const other = undefined as never

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(TextArrayMergeNode)
      })

      it('given array with mixed types when createNode then returns KeyedArrayMergeNode', () => {
        // Arrange
        const ancestor = null
        const local = ['a', 1]
        const other = undefined as never

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(KeyedArrayMergeNode)
      })

      it('given array with objects when createNode then returns KeyedArrayMergeNode', () => {
        // Arrange
        const ancestor = undefined as never
        const local = ['a', { b: 1 }]
        const other = null

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(KeyedArrayMergeNode)
      })

      it('given object and array values when createNode then returns KeyedArrayMergeNode not PropertyMergeNode', () => {
        // Arrange - one value is an array, which prevents isPureUnknown from returning true
        const ancestor = { a: 1 }
        const local = [{ b: 2 }]
        const other = { c: 3 }

        // Act
        const node = factory.createNode(ancestor, local, other, 'attr')

        // Assert
        expect(node).toBeInstanceOf(KeyedArrayMergeNode)
        expect(node).not.toBeInstanceOf(PropertyMergeNode)
      })

      it('given objects with known key extractor when createNode then returns KeyedArrayMergeNode', () => {
        // Arrange - 'customValue' has a key extractor in MetadataService
        const ancestor = { fullName: 'A' }
        const local = { fullName: 'B' }
        const other = { fullName: 'C' }

        // Act
        const node = factory.createNode(ancestor, local, other, 'customValue')

        // Assert
        expect(node).toBeInstanceOf(KeyedArrayMergeNode)
      })

      describe('given an element carrying attributes', () => {
        const sut = defaultNodeFactory
        // Parser shape of `<help xsi:nil="true"/>`: prototype-free, with the
        // attribute under its `@_` key and an empty `#text`.
        const nil = (): JsonObject =>
          Object.assign(Object.create(null), {
            '@_xsi:nil': 'true',
            '#text': '',
          })
        type Trio = [JsonValue, JsonValue, JsonValue]

        describe('when creating the node', () => {
          it('then every side carrying the attribute routes to TextMergeNode', () => {
            // Arrange
            const [ancestor, local, other] = [nil(), nil(), nil()]

            // Act
            const node = sut.createNode(ancestor, local, other, 'help')

            // Assert
            expect(node).toBeInstanceOf(TextMergeNode)
          })

          it.each<[string, Trio]>([
            ['ancestor', [nil(), 'text', 'text']],
            ['local', ['text', nil(), 'text']],
            ['other', ['text', 'text', nil()]],
          ])(
            'then only the %s side carrying it beside text still routes to TextMergeNode',
            (_side, [ancestor, local, other]) => {
              // Arrange — the trio comes from the table row

              // Act
              const node = sut.createNode(ancestor, local, other, 'help')

              // Assert
              expect(node).toBeInstanceOf(TextMergeNode)
            }
          )

          it('then a side carrying it with the other sides absent routes to TextMergeNode', () => {
            // Arrange
            const ancestor = null
            const local = nil()
            const other = undefined as never

            // Act
            const node = sut.createNode(ancestor, local, other, 'help')

            // Assert
            expect(node).toBeInstanceOf(TextMergeNode)
          })

          it('then an element that also has child elements routes to TextMergeNode', () => {
            // Arrange
            const withChild = { '@_xsi:type': 'T', label: 'a' }

            // Act
            const node = sut.createNode(withChild, withChild, {}, 'help')

            // Assert
            expect(node).toBeInstanceOf(TextMergeNode)
          })

          it('then it routes to TextMergeNode without consulting the key extractor', () => {
            // Arrange
            const spy = vi.spyOn(MetadataService, 'getKeyFieldExtractor')
            const [ancestor, local, other] = [nil(), nil(), nil()]

            // Act
            const node = sut.createNode(ancestor, local, other, 'value')

            // Assert
            expect(node).toBeInstanceOf(TextMergeNode)
            expect(spy).not.toHaveBeenCalled()
          })

          it('then a text-array attribute still routes to TextMergeNode', () => {
            // Arrange
            const [ancestor, local, other] = [nil(), nil(), 'Obj1']

            // Act
            const node = sut.createNode(ancestor, local, other, 'members')

            // Assert
            expect(node).toBeInstanceOf(TextMergeNode)
          })

          it.each<[string, Trio]>([
            ['ancestor', [[nil()], nil(), nil()]],
            ['local', [nil(), [nil()], nil()]],
            ['other', [nil(), nil(), [nil()]]],
          ])(
            'then an array on the %s side keeps the array route',
            (_side, [ancestor, local, other]) => {
              // Arrange — the trio comes from the table row

              // Act
              const node = sut.createNode(ancestor, local, other, 'help')

              // Assert
              expect(node).toBeInstanceOf(KeyedArrayMergeNode)
            }
          )
        })

        describe('when merging the created node', () => {
          it('then an untouched element is kept whole', () => {
            // Arrange
            const node = sut.createNode(nil(), nil(), nil(), 'help')

            // Act
            const result = node.merge(defaultConfig)

            // Assert — the writer reads `@_` keys off the element's own body
            expect(result).toEqual({
              output: [{ help: { '@_xsi:nil': 'true', '#text': '' } }],
              hasConflict: false,
            })
          })

          it('then an element that replaced text on one side is taken whole', () => {
            // Arrange
            const text = 'Enter the amount'
            const node = sut.createNode(text, nil(), text, 'help')

            // Act
            const result = node.merge(defaultConfig)

            // Assert
            expect(result).toEqual({
              output: [{ help: { '@_xsi:nil': 'true', '#text': '' } }],
              hasConflict: false,
            })
          })

          it('then text that replaced the element on one side is taken whole', () => {
            // Arrange
            const node = sut.createNode(
              nil(),
              'Enter the amount',
              nil(),
              'help'
            )

            // Act
            const result = node.merge(defaultConfig)

            // Assert
            expect(result).toEqual({
              output: [{ help: 'Enter the amount' }],
              hasConflict: false,
            })
          })
        })
      })

      describe('given a child key that only contains the attribute prefix', () => {
        const sut = defaultNodeFactory

        describe('when creating the node', () => {
          it('then it is not treated as an attribute and routes to PropertyMergeNode', () => {
            // Arrange
            const notAnAttribute = { 'a@_b': '1' }
            const changed = { 'a@_b': '2' }

            // Act
            const node = sut.createNode(
              notAnAttribute,
              notAnAttribute,
              changed,
              'help'
            )

            // Assert
            expect(node).toBeInstanceOf(PropertyMergeNode)
          })
        })
      })

      describe('given a side where the element is absent or not a pure object', () => {
        const sut = defaultNodeFactory

        describe('when merging the node the factory creates', () => {
          it('should treat a null ancestor and an undefined other as empty objects', () => {
            // Arrange
            const ancestor = null
            const local = { a: 1 }
            const other = undefined as never

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'attr')
              .merge(defaultConfig)

            // Assert
            expect(result).toEqual({
              output: [{ attr: [{ a: 1 }] }],
              hasConflict: false,
            })
          })

          it('should treat an undefined ancestor and an undefined local as empty objects', () => {
            // Arrange
            const ancestor = undefined as never
            const local = undefined as never
            const other = { a: 1 }

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'attr')
              .merge(defaultConfig)

            // Assert
            expect(result).toEqual({
              output: [{ attr: [{ a: 1 }] }],
              hasConflict: false,
            })
          })

          it('should propagate the deletion when both live sides dropped the element', () => {
            // Arrange
            const ancestor = { a: 1 }
            const local = undefined as never
            const other = undefined as never

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'attr')
              .merge(defaultConfig)

            // Assert
            expect(result).toEqual({ output: [], hasConflict: false })
          })

          it('should leave a scalar side to the character-indexed path it already took', () => {
            // Arrange — a text-bodied element against a child-bearing one is a
            // separate, pre-existing shape; normalising an absent side must not
            // quietly change how it merges.
            const ancestor = 'ab'
            const local = { a: 1 }
            const other = undefined as never

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'attr')
              .merge(defaultConfig)

            // Assert — the scalar's characters still take part as keys
            expect(result.hasConflict).toBe(false)
            expect(JSON.stringify(result.output)).toContain('"a"')
          })

          it('should not resurrect a deleted element through an inherited key name', () => {
            // Arrange — `constructor` is a legitimate XML tag name, and both
            // live sides dropped the element carrying it.
            const ancestor = { constructor: 'A' }
            const local = undefined as never
            const other = undefined as never

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'attr')
              .merge(defaultConfig)

            // Assert — the deletion propagates, no prototype member leaks in
            expect(result).toEqual({ output: [], hasConflict: false })
          })

          it('should not read an inherited key name off the side that dropped it', () => {
            // Arrange
            const ancestor = { toString: 'A' }
            const local = { toString: 'A' }
            const other = undefined as never

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'attr')
              .merge(defaultConfig)

            // Assert — other dropped it, so the deletion wins cleanly
            expect(result).toEqual({ output: [], hasConflict: false })
          })
        })

        describe('when the factory routes an absent side away from the property node', () => {
          it('should merge a keyed-array route without throwing', () => {
            // Arrange
            const ancestor = { fullName: 'A' }
            const local = undefined as never
            const other = { fullName: 'A' }

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'customValue')
              .merge(defaultConfig)

            // Assert
            expect(result).toEqual({ output: [], hasConflict: false })
          })

          it('should merge a text-array route without throwing', () => {
            // Arrange
            const ancestor = ['a', 'b']
            const local = undefined as never
            const other = ['a', 'b']

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'members')
              .merge(defaultConfig)

            // Assert
            expect(result).toEqual({ output: [], hasConflict: false })
          })

          it('should merge an all-absent text route without throwing', () => {
            // Arrange
            const ancestor = undefined as never
            const local = undefined as never
            const other = undefined as never

            // Act
            const result = sut
              .createNode(ancestor, local, other, 'label')
              .merge(defaultConfig)

            // Assert
            expect(result).toEqual({ output: [], hasConflict: false })
          })
        })
      })

      describe('given repeated values entries', () => {
        const entry = (field: string, value: string): JsonObject => ({
          field,
          value: { '@_xsi:type': 'xsd:string', '#text': value },
        })
        const a = entry('A__c', 'a')
        const b = entry('B__c', 'b')

        describe('when the entries are keyed by field', () => {
          it('then the ordered flag is decided from the three sides', () => {
            // Arrange
            const isOrderedAttribute = vi.spyOn(
              MetadataService,
              'isOrderedAttribute'
            )
            const ancestor = [a]
            const local = [a, b]
            const other = [a]

            // Act
            factory.createNode(ancestor, local, other, 'values')

            // Assert
            expect(isOrderedAttribute).toHaveBeenCalledWith('values', [
              ancestor,
              local,
              other,
            ])
          })

          it('then concurrent additions of different fields merge cleanly', () => {
            // Arrange
            const sut = factory.createNode(
              [a, b],
              [a, b, entry('D__c', 'd')],
              [a, b, entry('E__c', 'e')],
              'values'
            )

            // Act
            const result = sut.merge(defaultConfig)

            // Assert
            expect(result.hasConflict).toBe(false)
            const fields = result.output.map(
              item =>
                ([(item as JsonObject)['values']].flat()[0] as JsonObject)[
                  'field'
                ]
            )
            expect(fields).toEqual(['A__c', 'B__c', 'D__c', 'E__c'])
          })
        })
      })
    })
  })

  describe('defaultNodeFactory', () => {
    it('should be defined', () => {
      expect(defaultNodeFactory).toBeDefined()
      expect(defaultNodeFactory.createNode).toBeDefined()
    })
  })
})
