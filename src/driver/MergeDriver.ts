import { readFile, writeFile } from 'node:fs/promises'
import { normalize } from 'node:path'
import { XmlMerger } from '../merger/XmlMerger.js'

export class MergeDriver {
  async mergeFiles(
    ancestorFile: string,
    ourFile: string,
    theirFile: string,
    outputFile: string
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

    process.stderr.write(
      `[SF-MERGE-DEBUG] wrote to ourFile: ${normalize(ourFile)}\n`
    )
    process.stderr.write(
      `[SF-MERGE-DEBUG] wrote to outputFile: ${normalize(outputFile)}\n`
    )
    process.stderr.write(`[SF-MERGE-DEBUG] content: ${mergedContent.output}\n`)
    process.stderr.write(
      `[SF-MERGE-DEBUG] hasConflict: ${mergedContent.hasConflict}\n`
    )

    // Write the merged content to the our file
    await Promise.all(
      [ourFile, outputFile]
        .map(normalize)
        .map(path => writeFile(path, mergedContent.output))
    )
    return mergedContent.hasConflict
  }
}
