import { readFile, writeFile } from 'node:fs/promises'
import { normalize } from 'node:path'
import { XmlMerger } from '../merger/XmlMerger.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger } from '../utils/LoggingService.js'
import { detectEol, normalizeEol } from '../utils/mergeUtils.js'

export class MergeDriver {
  constructor(private readonly config: MergeConfig) {}

  @log('MergeDriver')
  async mergeFiles(
    ancestorFile: string,
    ourFile: string,
    theirFile: string
  ): Promise<boolean> {
    // Read all three versions. `allSettled` (over `all`) guarantees every
    // readFile has released its file descriptor before we surface an error
    // — otherwise the losers would linger in the background holding fds,
    // which on Windows blocks temp-dir cleanup with ENOTEMPTY.
    const results = await Promise.allSettled(
      [ancestorFile, ourFile, theirFile]
        .map(normalize)
        .map(path => readFile(path, 'utf8'))
    )
    const rejected = results.find(r => r.status === 'rejected')
    if (rejected) {
      throw (rejected as PromiseRejectedResult).reason
    }
    const [ancestorContent, ourContent, theirContent] = (
      results as PromiseFulfilledResult<string>[]
    ).map(r => r.value)

    const xmlMerger = new XmlMerger(this.config)

    try {
      const mergedContent = xmlMerger.mergeThreeWay(
        ancestorContent,
        ourContent,
        theirContent
      )

      const targetEol = detectEol(ourContent)
      const resolvedContent = normalizeEol(mergedContent.output, targetEol)
      await writeFile(normalize(ourFile), resolvedContent)

      return mergedContent.hasConflict
    } catch (error) {
      Logger.error('Merge failed', error)
      Logger.info('Restore our file')
      await writeFile(normalize(ourFile), ourContent)
      return true
    }
  }
}
