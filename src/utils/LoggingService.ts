import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { join } from 'node:path'
import { PLUGIN_NAME } from '../constant/pluginConstant.js'

export type LoggerMessage<T = string> = T | (() => T)

function resolveLoggerMessage<T>(message: LoggerMessage<T>): T {
  return typeof message === 'function' ? (message as () => T)() : message
}

export function lazy(
  strings: TemplateStringsArray,
  // biome-ignore lint/suspicious/noExplicitAny: tagged template exprs are inherently untyped
  ...exprs: any[]
): () => string {
  const getters = exprs.map(expr => {
    if (typeof expr === 'function') return expr
    return () => expr
  })

  return () =>
    strings.reduce(
      (acc, str, i) => acc + str + (i < getters.length ? getters[i]() : ''),
      ''
    )
}

// pino-compatible numeric levels
const LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const

const DEFAULT_LEVEL = LEVELS.warn

function parseLevel(raw: string | undefined): number {
  if (!raw) return DEFAULT_LEVEL
  const asNumber = Number(raw)
  if (Number.isInteger(asNumber) && asNumber > 0) return asNumber
  const key = raw.toLowerCase()
  if (key in LEVELS) return LEVELS[key as keyof typeof LEVELS]
  return DEFAULT_LEVEL
}

const LOG_LEVEL_THRESHOLD = parseLevel(
  process.env['SF_LOG_LEVEL'] ?? process.env['SFDX_LOG_LEVEL']
)
const MIRROR_TO_STDERR = process.env['SF_LOG_STDERR'] === 'true'

const LOG_DIR = join(homedir(), '.sf')
let dirEnsured = false
function ensureLogDir(): void {
  if (dirEnsured) return
  dirEnsured = true
  try {
    mkdirSync(LOG_DIR, { recursive: true })
  } catch {
    // best-effort; swallow (read-only $HOME, sandboxed containers, etc.)
  }
}

function currentLogFilePath(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return join(LOG_DIR, `sf-${yyyy}-${mm}-${dd}.log`)
}

function emit(level: number, message: string, meta: unknown): void {
  const entry: Record<string, unknown> = {
    level,
    time: Date.now(),
    pid: process.pid,
    hostname: hostname(),
    name: PLUGIN_NAME,
    msg: message,
  }
  if (meta !== undefined) entry['meta'] = meta
  const line = `${JSON.stringify(entry)}\n`
  ensureLogDir()
  try {
    appendFileSync(currentLogFilePath(), line)
  } catch {
    // best-effort; swallow
  }
  if (MIRROR_TO_STDERR) {
    process.stderr.write(line)
  }
}

function logAt(level: number, message: LoggerMessage, meta?: unknown): void {
  if (level < LOG_LEVEL_THRESHOLD) return
  emit(level, String(resolveLoggerMessage(message)), meta)
}

export const Logger = {
  trace<T = string>(message: LoggerMessage<T>, meta?: unknown): void {
    logAt(LEVELS.trace, message as LoggerMessage, meta)
  },
  debug<T = string>(message: LoggerMessage<T>, meta?: unknown): void {
    logAt(LEVELS.debug, message as LoggerMessage, meta)
  },
  info<T = string>(message: LoggerMessage<T>, meta?: unknown): void {
    logAt(LEVELS.info, message as LoggerMessage, meta)
  },
  warn<T = string>(message: LoggerMessage<T>, meta?: unknown): void {
    logAt(LEVELS.warn, message as LoggerMessage, meta)
  },
  error<T = string>(message: LoggerMessage<T>, meta?: unknown): void {
    logAt(LEVELS.error, message as LoggerMessage, meta)
  },
}
