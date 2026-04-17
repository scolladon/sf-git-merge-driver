/** biome-ignore-all lint/suspicious/noExplicitAny: it is dynamic by definition */
import { Logger, lazy } from './LoggingService.js'

export function log(className: string) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): void {
    const original = descriptor.value

    descriptor.value = function (...args: any[]) {
      const tag = lazy`${className}.${propertyKey}`
      Logger.trace(lazy`${className}.${propertyKey}: entry`)

      const call = () => original.call(this, ...args)

      if (original.constructor.name === 'AsyncFunction') {
        return call().then(
          (result: any) => {
            Logger.trace(lazy`${tag()}: exit`)
            return result
          },
          (err: unknown) => {
            Logger.trace(lazy`${tag()}: exit (error)`)
            throw err
          }
        )
      }

      const result = call()
      Logger.trace(lazy`${className}.${propertyKey}: exit`)
      return result
    }
  }
}
