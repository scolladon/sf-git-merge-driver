import { readFile, writeFile } from 'node:fs/promises'
import { normalize } from 'node:path'
import { XmlMerger } from '../merger/XmlMerger.js'

export class MergeDriver {
  private static detectEol(text: string): string {
    if (text.includes('\r\n')) return '\r\n'
    return '\n'
  }

  private static applyEol(text: string, eol: string): string {
    // XML Merge Driver default to \n
    if (eol === '\r\n') return text.split(/\r\n|\n/).join(eol)
    return text
  }

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

    const xmlMerger = new XmlMerger()

    const mergedContent = xmlMerger.mergeThreeWay(
      ancestorContent,
      ourContent,
      theirContent
    )

    const targetEol = MergeDriver.detectEol(ourContent)
    const outputWithEol = MergeDriver.applyEol(mergedContent.output, targetEol)

    process.stderr.write(
      `[SF-MERGE-DEBUG] wrote to ourFile: ${normalize(ourFile)}\n`
    )
    process.stderr.write(`[SF-MERGE-DEBUG] content: ${outputWithEol}\n`)
    process.stderr.write(
      `[SF-MERGE-DEBUG] hasConflict: ${mergedContent.hasConflict}\n`
    )

    // Write the merged content to the our file
    await writeFile(normalize(ourFile), outputWithEol)
    return mergedContent.hasConflict
  }
}
