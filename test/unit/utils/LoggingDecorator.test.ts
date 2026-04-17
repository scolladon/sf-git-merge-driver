'use strict'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockedTrace = vi.fn()
vi.mock('../../../src/utils/LoggingService.js', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../../src/utils/LoggingService')>()
  return {
    ...actual,
    Logger: {
      trace: mockedTrace,
      debug: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    },
  }
})

const { log } = await import('../../../src/utils/LoggingDecorator.js')

describe('LoggingDecorator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('given a sync method', () => {
    it('When called, Then traces entry and exit with the passed class name', () => {
      // Arrange
      class SyncTestClass {
        @log('SyncTestClass')
        syncMethod() {
          return 'result'
        }
      }
      const sut = new SyncTestClass()

      // Act
      const result = sut.syncMethod()

      // Assert
      expect(result).toBe('result')
      expect(result).not.toBeInstanceOf(Promise)
      expect(mockedTrace).toHaveBeenCalledTimes(2)
      const entryMsg = (mockedTrace.mock.calls[0][0] as () => string)()
      const exitMsg = (mockedTrace.mock.calls[1][0] as () => string)()
      expect(entryMsg).toBe('SyncTestClass.syncMethod: entry')
      expect(exitMsg).toBe('SyncTestClass.syncMethod: exit')
    })

    it('When called with arguments, Then passes arguments through', () => {
      // Arrange
      class SyncArgsClass {
        @log('SyncArgsClass')
        syncMethod(a: string, b: number) {
          return `${a}-${b}`
        }
      }
      const sut = new SyncArgsClass()

      // Act
      const result = sut.syncMethod('hello', 42)

      // Assert
      expect(result).toBe('hello-42')
    })
  })

  describe('given an async method', () => {
    it('When called, Then traces entry and exit with the passed class name', async () => {
      // Arrange
      class AsyncTestClass {
        @log('AsyncTestClass')
        async asyncMethod() {
          return 'async-result'
        }
      }
      const sut = new AsyncTestClass()

      // Act
      const result = await sut.asyncMethod()

      // Assert
      expect(result).toBe('async-result')
      expect(mockedTrace).toHaveBeenCalledTimes(2)
      const entryMsg = (mockedTrace.mock.calls[0][0] as () => string)()
      const exitMsg = (mockedTrace.mock.calls[1][0] as () => string)()
      expect(entryMsg).toBe('AsyncTestClass.asyncMethod: entry')
      expect(exitMsg).toBe('AsyncTestClass.asyncMethod: exit')
    })

    it('When called with arguments, Then passes arguments through', async () => {
      // Arrange
      class AsyncArgsClass {
        @log('AsyncArgsClass')
        async asyncMethod(a: string, b: number) {
          return `${a}-${b}`
        }
      }
      const sut = new AsyncArgsClass()

      // Act
      const result = await sut.asyncMethod('hello', 42)

      // Assert
      expect(result).toBe('hello-42')
    })

    it('When method rejects, Then traces entry and exit with (error), and re-throws', async () => {
      // Arrange
      class AsyncErrorClass {
        @log('AsyncErrorClass')
        async failingMethod() {
          throw new Error('boom')
        }
      }
      const sut = new AsyncErrorClass()

      // Act & Assert
      await expect(sut.failingMethod()).rejects.toThrow('boom')
      expect(mockedTrace).toHaveBeenCalledTimes(2)
      const exitMsg = (mockedTrace.mock.calls[1][0] as () => string)()
      expect(exitMsg).toContain('exit (error)')
    })
  })

  describe('decorator class-name stability (guards against rename drift)', () => {
    it('Given an explicit class name, When minified or renamed, Then logs still use the passed string', () => {
      // Arrange: deliberately mismatch class name and decorator string to prove the decorator uses the argument
      class RenamedAfter {
        @log('OriginalName')
        method() {
          return 1
        }
      }
      const sut = new RenamedAfter()

      // Act
      sut.method()

      // Assert
      const entryMsg = (mockedTrace.mock.calls[0][0] as () => string)()
      expect(entryMsg).toBe('OriginalName.method: entry')
    })
  })
})
