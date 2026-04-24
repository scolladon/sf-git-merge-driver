import { createReadStream, createWriteStream } from 'node:fs'
import { rename, unlink } from 'node:fs/promises'
import { normalize } from 'node:path'
import type { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'
import { XmlMerger } from '../merger/XmlMerger.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger } from '../utils/LoggingService.js'
import { peekEol } from '../utils/peekEol.js'

const TMP_SUFFIX = '.sf-merge-tmp'

const noop = (): void => {
  /* intentional no-op stream error swallower */
}

// Best-effort tmp cleanup; failures here are not interesting because
// the file may never have been opened or may already be gone.
const safeUnlink = async (path: string): Promise<void> => {
  try {
    await unlink(path)
  } catch {
    /* noop */
  }
}

export class MergeDriver {
  constructor(private readonly config: MergeConfig) {}

  @log('MergeDriver')
  async mergeFiles(
    ancestorFile: string,
    ourFile: string,
    theirFile: string
  ): Promise<boolean> {
    const oursPath = normalize(ourFile)
    const tmpPath = oursPath + TMP_SUFFIX
    const readers: Readable[] = []

    try {
      const eol = await peekEol(oursPath)

      const [ancRS, oursRS, theirsRS] = [ancestorFile, ourFile, theirFile]
        .map(normalize)
        .map(p => {
          const rs = createReadStream(p)
          // Swallow 'error' events so `destroy()` in the finally block
          // never escalates to an unhandled event. Real errors are
          // surfaced via the awaited mergeStreams promise instead.
          rs.on('error', noop)
          return rs
        })
      readers.push(ancRS, oursRS, theirsRS)

      const tmpWS = createWriteStream(tmpPath)
      tmpWS.on('error', noop)

      const merger = new XmlMerger(this.config)
      const { hasConflict } = await merger.mergeStreams(
        ancRS,
        oursRS,
        theirsRS,
        tmpWS,
        eol
      )
      tmpWS.end()
      await finished(tmpWS)
      await rename(tmpPath, oursPath)
      return hasConflict
    } catch (error) {
      // ENOENT on any input file is a caller contract violation (git
      // passed us a bad path); the bin classifies it as a usage error
      // and exits 2. All other failures are treated as "merge failed,
      // leave ours alone" → return true so git keeps the file in place.
      if (
        error !== null &&
        typeof error === 'object' &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        throw error
      }
      Logger.error('Merge failed; leaving ours unchanged', error)
      return true
    } finally {
      for (const r of readers) r.destroy()
      await safeUnlink(tmpPath)
    }
  }
}
