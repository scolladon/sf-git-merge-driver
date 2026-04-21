/** biome-ignore-all lint/suspicious/noExplicitAny: it is dynamic by definition */
import { isLevelEnabled, LOG_LEVELS, Logger, lazy } from './LoggingService.js'

// Resolved at module init. When the trace threshold is above LEVELS.trace the
// decorator leaves methods untouched — avoiding closure + tagged-template
// allocations per call in the hot path of the merge pipeline.
const TRACE_ENABLED = isLevelEnabled(LOG_LEVELS.trace)

export function log(className: string) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): void {
    if (!TRACE_ENABLED) return

    const original = descriptor.value

    descriptor.value = function (...args: any[]) {
      Logger.trace(lazy`${className}.${propertyKey}: entry`)

      const call = () => original.call(this, ...args)

      if (original.constructor.name === 'AsyncFunction') {
        return call().then(
          (result: any) => {
            Logger.trace(lazy`${className}.${propertyKey}: exit`)
            return result
          },
          (err: unknown) => {
            Logger.trace(lazy`${className}.${propertyKey}: exit (error)`)
            throw err
          }
        )
      }

      try {
        const result = call()
        Logger.trace(lazy`${className}.${propertyKey}: exit`)
        return result
      } catch (err) {
        Logger.trace(lazy`${className}.${propertyKey}: exit (error)`)
        throw err
      }
    }
  }
}
