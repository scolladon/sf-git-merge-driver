import { readFile, writeFile } from 'node:fs/promises'
import { XmlMergeService } from './XmlMergeService.js'

export class MergeDriver {
  async mergeFiles(ancestorFile, ourFile, theirFile, outputFile) {
    // Read all three versions
    const [ancestorContent, ourContent, theirContent] = await Promise.all([
      readFile(ancestorFile, 'utf8'),
      readFile(ourFile, 'utf8'),
      readFile(theirFile, 'utf8'),
    ])

    const mergeService = new XmlMergeService()

    const mergedContent = await mergeService.tripartXmlMerge(
      ancestorContent,
      ourContent,
      theirContent
    )

    // Write the merged content to the output file
    await writeFile(outputFile, mergedContent)
  }
}
