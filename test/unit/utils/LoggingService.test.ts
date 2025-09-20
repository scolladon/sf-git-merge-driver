'use strict'

// Mock modules before importing the actual module
jest.mock('@salesforce/core', () => {
  const mockCoreLogger = {
    setLevel: jest.fn(),
    shouldLog: jest.fn().mockReturnValue(true),
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    trace: jest.fn(),
    warn: jest.fn(),
  }

  return {
    Logger: {
      childFromRoot: jest.fn().mockReturnValue(mockCoreLogger),
    },
    LoggerLevel: {
      TRACE: 'trace',
      DEBUG: 'debug',
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
    },
  }
})

jest.mock('../../../src/constant/pluginConstant', () => ({
  PLUGIN_NAME: 'mock-plugin-name',
}))

// Import after mocking
import { Logger, lazy } from '../../../src/utils/LoggingService'

// Get the mock CoreLogger instance
const mockCoreLogger = jest
  .requireMock('@salesforce/core')
  .Logger.childFromRoot()
const mockDebug = mockCoreLogger.debug
const mockError = mockCoreLogger.error
const mockInfo = mockCoreLogger.info
const mockTrace = mockCoreLogger.trace
const mockWarn = mockCoreLogger.warn
const mockShouldLog = mockCoreLogger.shouldLog

describe('LoggingService', () => {
  let sut: typeof Logger

  beforeEach(() => {
    // Arrange
    sut = Logger
    jest.clearAllMocks()
    mockShouldLog.mockReturnValue(true)
  })

  describe('lazy template strings', () => {
    it('given dynamic value when evaluating lazy template then returns updated value', () => {
      // Arrange
      let value = 'dynamic'
      const lazyMessage = lazy`dynamic ${() => value} mic`

      // Act
      value = 'changed'
      const result = lazyMessage()

      // Assert
      expect(result).toBe('dynamic changed mic')
    })

    it('given static value when evaluating lazy template then returns static value', () => {
      // Arrange
      const value = 'value'
      const staticMessage = lazy`static ${value} mic`

      // Act
      const result = staticMessage()

      // Assert
      expect(result).toBe('static value mic')
    })

    it('given empty template when evaluating lazy template then returns empty string', () => {
      // Arrange
      const emptyMessage = lazy``

      // Act
      const result = emptyMessage()

      // Assert
      expect(result).toBe('')
    })

    it('given multiple expressions when evaluating lazy template then returns combined result', () => {
      // Arrange
      const first = 'first'
      const second = () => 'second'
      const third = 'third'
      const message = lazy`${first}-${second}-${third}`

      // Act
      const result = message()

      // Assert
      expect(result).toBe('first-second-third')
    })
  })

  describe('function parameter evaluation', () => {
    it('given log level enabled when logging with function parameter then evaluates function', () => {
      // Arrange
      let called = false
      const messageFn = () => {
        called = true
        return 'evaluated'
      }

      // Act
      sut.debug(messageFn)

      // Assert
      expect(called).toBe(true)
      expect(mockDebug).toHaveBeenCalledWith('evaluated', undefined)
    })

    it('given log level disabled when logging with function parameter then does not evaluate function', () => {
      // Arrange
      mockShouldLog.mockReturnValueOnce(false)
      let called = false
      const messageFn = () => {
        called = true
        return 'evaluated'
      }

      // Act
      sut.debug(messageFn)

      // Assert
      expect(called).toBe(false)
      expect(mockDebug).not.toHaveBeenCalled()
    })
  })

  describe('meta parameters', () => {
    it('given meta data when logging then passes meta to logger', () => {
      // Arrange
      const meta = { key: 'value' }

      // Act
      sut.debug('message', meta)

      // Assert
      expect(mockDebug).toHaveBeenCalledWith('message', meta)
    })

    it('given no meta data when logging then passes undefined meta', () => {
      // Arrange & Act
      sut.debug('message')

      // Assert
      expect(mockDebug).toHaveBeenCalledWith('message', undefined)
    })
  })

  describe('log level conditional execution', () => {
    describe('debug method', () => {
      it('given log level disabled when logging then does not call logger', () => {
        // Arrange
        mockShouldLog.mockReturnValueOnce(false)

        // Act
        sut.debug('message')

        // Assert
        expect(mockDebug).not.toHaveBeenCalled()
      })

      it('given log level enabled when logging then calls logger', () => {
        // Arrange
        mockShouldLog.mockReturnValueOnce(true)

        // Act
        sut.debug('message')

        // Assert
        expect(mockDebug).toHaveBeenCalled()
      })
    })

    describe('error method', () => {
      it('given log level disabled when logging then does not call logger', () => {
        // Arrange
        mockShouldLog.mockReturnValueOnce(false)

        // Act
        sut.error('message')

        // Assert
        expect(mockError).not.toHaveBeenCalled()
      })

      it('given log level enabled when logging then calls logger', () => {
        // Arrange
        mockShouldLog.mockReturnValueOnce(true)

        // Act
        sut.error('message')

        // Assert
        expect(mockError).toHaveBeenCalled()
      })
    })

    describe('info method', () => {
      it('given log level disabled when logging then does not call logger', () => {
        // Arrange
        mockShouldLog.mockReturnValueOnce(false)

        // Act
        sut.info('message')

        // Assert
        expect(mockInfo).not.toHaveBeenCalled()
      })

      it('given log level enabled when logging then calls logger', () => {
        // Arrange
        mockShouldLog.mockReturnValueOnce(true)

        // Act
        sut.info('message')

        // Assert
        expect(mockInfo).toHaveBeenCalled()
      })
    })

    describe('trace method', () => {
      it('given log level disabled when logging then does not call logger', () => {
        // Arrange
        mockShouldLog.mockReturnValueOnce(false)

        // Act
        sut.trace('message')

        // Assert
        expect(mockTrace).not.toHaveBeenCalled()
      })

      it('given log level enabled when logging then calls logger', () => {
        // Arrange
        mockShouldLog.mockReturnValueOnce(true)

        // Act
        sut.trace('message')

        // Assert
        expect(mockTrace).toHaveBeenCalled()
      })
    })

    describe('warn method', () => {
      it('given log level disabled when logging then does not call logger', () => {
        // Arrange
        mockShouldLog.mockReturnValueOnce(false)

        // Act
        sut.warn('message')

        // Assert
        expect(mockWarn).not.toHaveBeenCalled()
      })

      it('given log level enabled when logging then calls logger', () => {
        // Arrange
        mockShouldLog.mockReturnValueOnce(true)

        // Act
        sut.warn('message')

        // Assert
        expect(mockWarn).toHaveBeenCalled()
      })
    })
  })

  describe('logger methods', () => {
    describe('debug method', () => {
      it('given message and meta when calling debug then calls debug with correct parameters', () => {
        // Arrange
        const message = 'test debug message'
        const meta = { key: 'value' }

        // Act
        sut.debug(message, meta)

        // Assert
        expect(mockShouldLog).toHaveBeenCalledWith('debug')
        expect(mockDebug).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('info method', () => {
      it('given message and meta when calling info then calls info with correct parameters', () => {
        // Arrange
        const message = 'test info message'
        const meta = { key: 'value' }

        // Act
        sut.info(message, meta)

        // Assert
        expect(mockShouldLog).toHaveBeenCalledWith('info')
        expect(mockInfo).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('error method', () => {
      it('given message and meta when calling error then calls error with correct parameters', () => {
        // Arrange
        const message = 'test error message'
        const meta = { key: 'value' }

        // Act
        sut.error(message, meta)

        // Assert
        expect(mockShouldLog).toHaveBeenCalledWith('error')
        expect(mockError).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('warn method', () => {
      it('given message and meta when calling warn then calls warn with correct parameters', () => {
        // Arrange
        const message = 'test warn message'
        const meta = { key: 'value' }

        // Act
        sut.warn(message, meta)

        // Assert
        expect(mockShouldLog).toHaveBeenCalledWith('warn')
        expect(mockWarn).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('trace method', () => {
      it('given message and meta when calling trace then calls trace with correct parameters', () => {
        // Arrange
        const message = 'test trace message'
        const meta = { key: 'value' }

        // Act
        sut.trace(message, meta)

        // Assert
        expect(mockShouldLog).toHaveBeenCalledWith('trace')
        expect(mockTrace).toHaveBeenCalledWith(message, meta)
      })
    })
  })
})
