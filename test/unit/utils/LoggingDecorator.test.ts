'use strict'

const mockedTrace = jest.fn()
jest.mock('../../../src/utils/LoggingService', () => ({
  ...jest.requireActual('../../../src/utils/LoggingService'),
  Logger: {
    trace: mockedTrace,
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}))

import { log } from '../../../src/utils/LoggingDecorator.js'

describe('LoggingDecorator', () => {
  describe('log', () => {
    describe('given a sync method', () => {
      it('when called, then traces entry and exit', () => {
        // Arrange
        class TestClass {
          @log
          syncMethod() {
            return 'result'
          }
        }
        const sut = new TestClass()

        // Act
        const result = sut.syncMethod()

        // Assert
        expect(result).toBe('result')
        expect(mockedTrace).toHaveBeenCalledTimes(2)
        const entryMsg = (mockedTrace.mock.calls[0][0] as () => string)()
        const exitMsg = (mockedTrace.mock.calls[1][0] as () => string)()
        expect(entryMsg).toContain('syncMethod: entry')
        expect(exitMsg).toContain('syncMethod: exit')
      })

      it('when called with arguments, then passes arguments through', () => {
        // Arrange
        class TestClass {
          @log
          syncMethod(a: string, b: number) {
            return `${a}-${b}`
          }
        }
        const sut = new TestClass()

        // Act
        const result = sut.syncMethod('hello', 42)

        // Assert
        expect(result).toBe('hello-42')
      })
    })

    describe('given an async method', () => {
      it('when called, then traces entry and exit', async () => {
        // Arrange
        class TestClass {
          @log
          async asyncMethod() {
            return 'async-result'
          }
        }
        const sut = new TestClass()

        // Act
        const result = await sut.asyncMethod()

        // Assert
        expect(result).toBe('async-result')
        expect(mockedTrace).toHaveBeenCalledTimes(2)
        const entryMsg = (mockedTrace.mock.calls[0][0] as () => string)()
        const exitMsg = (mockedTrace.mock.calls[1][0] as () => string)()
        expect(entryMsg).toContain('asyncMethod: entry')
        expect(exitMsg).toContain('asyncMethod: exit')
      })

      it('when called with arguments, then passes arguments through', async () => {
        // Arrange
        class TestClass {
          @log
          async asyncMethod(a: string, b: number) {
            return `${a}-${b}`
          }
        }
        const sut = new TestClass()

        // Act
        const result = await sut.asyncMethod('hello', 42)

        // Assert
        expect(result).toBe('hello-42')
      })
    })

    afterEach(() => {
      jest.clearAllMocks()
    })
  })
})
