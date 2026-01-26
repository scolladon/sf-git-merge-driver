import { readFile, writeFile } from 'node:fs/promises'
import { normalize } from 'node:path'
import { XmlMerger } from '../merger/XmlMerger.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger } from '../utils/LoggingService.js'
import { detectEol, normalizeEol } from '../utils/mergeUtils.js'

export class MergeDriver {
  constructor(private readonly config: MergeConfig) {}

  @log
  async mergeFiles(
    ancestorFile: string,
    ourFile: string,
    theirFile: string
  ): Promise<boolean> {
    // Read all three versions
    const [ancestorContent, ourContent, theirContent] = await Promise.all(
      [ancestorFile, ourFile, theirFile]
        .map(normalize)
        .map(path => readFile(path, 'utf8'))
    )

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
