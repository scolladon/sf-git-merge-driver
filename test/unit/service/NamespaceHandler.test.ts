import {
  NAMESPACE_PREFIX,
  NAMESPACE_ROOT,
} from '../../../src/constant/parserConstant.js'
import { NamespaceHandler } from '../../../src/service/NamespaceHandler.js'
import type { JsonArray, JsonObject } from '../../../src/types/jsonTypes.js'

describe('NamespaceHandler', () => {
  let handler: NamespaceHandler

  beforeEach(() => {
    handler = new NamespaceHandler()
  })

  describe('processNamespaces', () => {
    it('should extract namespace attributes from all three objects', () => {
      // Arrange
      const ancestor: JsonObject = {
        root: { [`${NAMESPACE_PREFIX}xmlns`]: 'http://ancestor.ns' },
      }
      const local: JsonObject = {
        root: { [`${NAMESPACE_PREFIX}xmlns:local`]: 'http://local.ns' },
      }
      const other: JsonObject = {
        root: { [`${NAMESPACE_PREFIX}xmlns:other`]: 'http://other.ns' },
      }

      // Act
      const result = handler.processNamespaces(ancestor, local, other)

      // Assert
      expect(result).toEqual({
        [`${NAMESPACE_PREFIX}xmlns`]: 'http://ancestor.ns',
        [`${NAMESPACE_PREFIX}xmlns:local`]: 'http://local.ns',
        [`${NAMESPACE_PREFIX}xmlns:other`]: 'http://other.ns',
      })
    })

    it('should remove namespace attributes from source objects', () => {
      // Arrange
      const ancestor: JsonObject = {
        root: {
          [`${NAMESPACE_PREFIX}xmlns`]: 'http://ns',
          data: 'value',
        },
      }
      const local: JsonObject = { root: {} }
      const other: JsonObject = { root: {} }

      // Act
      handler.processNamespaces(ancestor, local, other)

      // Assert
      expect(ancestor['root']).toEqual({ data: 'value' })
    })

    it('should return empty object when no namespaces exist', () => {
      // Arrange
      const ancestor: JsonObject = { root: { data: 'value' } }
      const local: JsonObject = { root: { other: 'data' } }
      const other: JsonObject = { root: {} }

      // Act
      const result = handler.processNamespaces(ancestor, local, other)

      // Assert
      expect(result).toEqual({})
    })

    it('should handle empty objects', () => {
      // Arrange
      const ancestor: JsonObject = {}
      const local: JsonObject = {}
      const other: JsonObject = {}

      // Act
      const result = handler.processNamespaces(ancestor, local, other)

      // Assert
      expect(result).toEqual({})
    })

    it('should merge duplicate namespace keys with last value winning', () => {
      // Arrange
      const ancestor: JsonObject = {
        root: { [`${NAMESPACE_PREFIX}xmlns`]: 'http://ancestor.ns' },
      }
      const local: JsonObject = {
        root: { [`${NAMESPACE_PREFIX}xmlns`]: 'http://local.ns' },
      }
      const other: JsonObject = {
        root: { [`${NAMESPACE_PREFIX}xmlns`]: 'http://other.ns' },
      }

      // Act
      const result = handler.processNamespaces(ancestor, local, other)

      // Assert
      expect(result[`${NAMESPACE_PREFIX}xmlns`]).toBe('http://other.ns')
    })
  })

  describe('addNamespacesToResult', () => {
    it('should add namespaces to result array', () => {
      // Arrange
      const acc: JsonArray = [{ root: { data: 'value' } }]
      const namespaces: JsonObject = {
        [`${NAMESPACE_PREFIX}xmlns`]: 'http://ns',
      }

      // Act
      handler.addNamespacesToResult(acc, namespaces)

      // Assert
      expect(acc[0]).toEqual({
        root: { data: 'value' },
        [NAMESPACE_ROOT]: {
          [`${NAMESPACE_PREFIX}xmlns`]: 'http://ns',
        },
      })
    })

    it('should not modify result when namespaces is empty', () => {
      // Arrange
      const acc: JsonArray = [{ root: { data: 'value' } }]
      const namespaces: JsonObject = {}

      // Act
      handler.addNamespacesToResult(acc, namespaces)

      // Assert
      expect(acc[0]).toEqual({ root: { data: 'value' } })
    })

    it('should not modify result when acc is empty', () => {
      // Arrange
      const acc: JsonArray = []
      const namespaces: JsonObject = {
        [`${NAMESPACE_PREFIX}xmlns`]: 'http://ns',
      }

      // Act
      handler.addNamespacesToResult(acc, namespaces)

      // Assert
      expect(acc).toEqual([])
    })

    it('should add multiple namespaces', () => {
      // Arrange
      const acc: JsonArray = [{ root: {} }]
      const namespaces: JsonObject = {
        [`${NAMESPACE_PREFIX}xmlns`]: 'http://ns1',
        [`${NAMESPACE_PREFIX}xmlns:custom`]: 'http://ns2',
      }

      // Act
      handler.addNamespacesToResult(acc, namespaces)

      // Assert
      expect((acc[0] as JsonObject)[NAMESPACE_ROOT]).toEqual({
        [`${NAMESPACE_PREFIX}xmlns`]: 'http://ns1',
        [`${NAMESPACE_PREFIX}xmlns:custom`]: 'http://ns2',
      })
    })
  })
})
