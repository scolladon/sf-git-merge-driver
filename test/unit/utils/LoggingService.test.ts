'use strict'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCoreLogger = {
  setLevel: vi.fn(),
  shouldLog: vi.fn().mockReturnValue(true),
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  trace: vi.fn(),
  warn: vi.fn(),
}

vi.mock('@salesforce/core', () => ({
  Logger: {
    childFromRoot: vi.fn().mockReturnValue(mockCoreLogger),
  },
  LoggerLevel: {
    TRACE: 'trace',
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
  },
}))

vi.mock('../../../src/constant/pluginConstant', () => ({
  PLUGIN_NAME: 'mock-plugin-name',
}))

// Import after mocking
const { Logger, lazy } = await import('../../../src/utils/LoggingService')

const mockShouldLog = mockCoreLogger.shouldLog

const LOG_METHODS = [
  { level: 'debug', mock: mockCoreLogger.debug },
  { level: 'error', mock: mockCoreLogger.error },
  { level: 'info', mock: mockCoreLogger.info },
  { level: 'trace', mock: mockCoreLogger.trace },
  { level: 'warn', mock: mockCoreLogger.warn },
] as const

describe('LoggingService', () => {
  let sut: typeof Logger

  beforeEach(() => {
    sut = Logger
    vi.clearAllMocks()
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
      expect(mockCoreLogger.debug).toHaveBeenCalledWith('evaluated', undefined)
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
      expect(mockCoreLogger.debug).not.toHaveBeenCalled()
    })
  })

  describe('meta parameters', () => {
    it('given meta data when logging then passes meta to logger', () => {
      // Arrange
      const meta = { key: 'value' }

      // Act
      sut.debug('message', meta)

      // Assert
      expect(mockCoreLogger.debug).toHaveBeenCalledWith('message', meta)
    })

    it('given no meta data when logging then passes undefined meta', () => {
      // Act
      sut.debug('message')

      // Assert
      expect(mockCoreLogger.debug).toHaveBeenCalledWith('message', undefined)
    })
  })

  describe('log level conditional execution', () => {
    it.each(
      LOG_METHODS
    )('given $level level disabled when logging then does not call logger', ({
      level,
      mock,
    }) => {
      // Arrange
      mockShouldLog.mockReturnValueOnce(false)

      // Act
      sut[level]('message')

      // Assert
      expect(mock).not.toHaveBeenCalled()
    })

    it.each(
      LOG_METHODS
    )('given $level level enabled when logging then calls logger', ({
      level,
      mock,
    }) => {
      // Arrange
      mockShouldLog.mockReturnValueOnce(true)

      // Act
      sut[level]('message')

      // Assert
      expect(mock).toHaveBeenCalled()
    })
  })

  describe('logger methods', () => {
    it.each(
      LOG_METHODS
    )('given message and meta when calling $level then calls logger with correct parameters', ({
      level,
      mock,
    }) => {
      // Arrange
      const message = `test ${level} message`
      const meta = { key: 'value' }

      // Act
      sut[level](message, meta)

      // Assert
      expect(mockShouldLog).toHaveBeenCalledWith(level)
      expect(mock).toHaveBeenCalledWith(message, meta)
    })
  })
})
