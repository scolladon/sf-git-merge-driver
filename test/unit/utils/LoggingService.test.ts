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
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
    mockShouldLog.mockReturnValue(true)
  })

  describe('lazy template strings', () => {
    it('should evaluate dynamic template strings lazily', () => {
      let value = 'dynamic'
      const lazyMessage = lazy`dynamic ${() => value} mic`
      value = 'changed'
      expect(lazyMessage()).toBe('dynamic changed mic')
    })

    it('should evaluate static template strings lazily', () => {
      const value = 'value'
      const staticMessage = lazy`static ${value} mic`
      expect(staticMessage()).toBe('static value mic')
    })

    it('should handle empty template strings', () => {
      const emptyMessage = lazy``
      expect(emptyMessage()).toBe('')
    })

    it('should handle multiple expressions', () => {
      const first = 'first'
      const second = () => 'second'
      const third = 'third'
      const message = lazy`${first}-${second}-${third}`
      expect(message()).toBe('first-second-third')
    })
  })

  describe('function parameter evaluation', () => {
    it('should evaluate function parameters when log level is enabled', () => {
      let called = false
      const messageFn = () => {
        called = true
        return 'evaluated'
      }
      Logger.debug(messageFn)
      expect(called).toBe(true)
      expect(mockDebug).toHaveBeenCalledWith('evaluated', undefined)
    })

    it('should not evaluate function when log level is disabled', () => {
      mockShouldLog.mockReturnValueOnce(false)
      let called = false
      const messageFn = () => {
        called = true
        return 'evaluated'
      }
      Logger.debug(messageFn)
      expect(called).toBe(false)
      expect(mockDebug).not.toHaveBeenCalled()
    })
  })

  describe('meta parameters', () => {
    it('should pass meta data parameter to the logger', () => {
      const meta = { key: 'value' }
      Logger.debug('message', meta)
      expect(mockDebug).toHaveBeenCalledWith('message', meta)
    })

    it('should handle undefined meta parameter', () => {
      Logger.debug('message')
      expect(mockDebug).toHaveBeenCalledWith('message', undefined)
    })
  })

  describe('log level conditional execution', () => {
    it('should not log when log level is disabled', () => {
      mockShouldLog.mockReturnValueOnce(false)
      Logger.debug('message')
      expect(mockDebug).not.toHaveBeenCalled()
    })

    it('should log when log level is enabled', () => {
      mockShouldLog.mockReturnValueOnce(true)
      Logger.debug('message')
      expect(mockDebug).toHaveBeenCalled()
    })
  })

  describe('logger methods', () => {
    describe('debug method', () => {
      it('should call debug method with correct parameters', () => {
        const message = 'test debug message'
        const meta = { key: 'value' }
        Logger.debug(message, meta)
        expect(mockShouldLog).toHaveBeenCalledWith('debug')
        expect(mockDebug).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('info method', () => {
      it('should call info method with correct parameters', () => {
        const message = 'test info message'
        const meta = { key: 'value' }
        Logger.info(message, meta)
        expect(mockShouldLog).toHaveBeenCalledWith('info')
        expect(mockInfo).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('error method', () => {
      it('should call error method with correct parameters', () => {
        const message = 'test error message'
        const meta = { key: 'value' }
        Logger.error(message, meta)
        expect(mockShouldLog).toHaveBeenCalledWith('error')
        expect(mockError).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('warn method', () => {
      it('should call warn method with correct parameters', () => {
        const message = 'test warn message'
        const meta = { key: 'value' }
        Logger.warn(message, meta)
        expect(mockShouldLog).toHaveBeenCalledWith('warn')
        expect(mockWarn).toHaveBeenCalledWith(message, meta)
      })
    })

    describe('trace method', () => {
      it('should call trace method with correct parameters', () => {
        const message = 'test trace message'
        const meta = { key: 'value' }
        Logger.trace(message, meta)
        expect(mockShouldLog).toHaveBeenCalledWith('trace')
        expect(mockTrace).toHaveBeenCalledWith(message, meta)
      })
    })
  })
})
