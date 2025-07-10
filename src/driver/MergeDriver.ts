import { readFile, writeFile } from 'node:fs/promises'
import { XmlMerger } from '../merger/XmlMerger.js'

export class MergeDriver {
  async mergeFiles(
    ancestorFile: string,
    ourFile: string,
    theirFile: string
  ): Promise<boolean> {
    // Read all three versions
    const [ancestorContent, ourContent, theirContent] = await Promise.all([
      readFile(ancestorFile, 'utf8'),
      readFile(ourFile, 'utf8'),
      readFile(theirFile, 'utf8'),
    ])

    const xmlMerger = new XmlMerger()

    const mergedContent = xmlMerger.mergeThreeWay(
      ancestorContent,
      ourContent,
      theirContent
    )
    console.log('investigation: ', mergedContent)

    console.log('investigation: ', ancestorFile)
    console.log('investigation: ', ourFile)
    console.log('investigation: ', theirFile)

    // Write the merged content to the output file
    await writeFile(ourFile, mergedContent.output)
    return mergedContent.hasConflict
  }
}
