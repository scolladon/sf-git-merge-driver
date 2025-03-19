import { readFile, writeFile } from 'node:fs/promises'
import { XmlMerger } from '../merger/XmlMerger.js'

export class MergeDriver {
  async mergeFiles(ancestorFile, ourFile, theirFile, outputFile) {
    // Read all three versions
    const [ancestorContent, ourContent, theirContent] = await Promise.all([
      readFile(ancestorFile, 'utf8'),
      readFile(ourFile, 'utf8'),
      readFile(theirFile, 'utf8'),
    ])

    const xmlMerger = new XmlMerger()

    const mergedContent = xmlMerger.tripartXmlMerge(
      ancestorContent,
      ourContent,
      theirContent
    )

    // Write the merged content to the output file
    await writeFile(outputFile, mergedContent)
  }

  async copyFiles(ancestorFile, outputFile) {
    const ancestorContent = await readFile(ancestorFile, 'utf8')
    console.dir(ancestorContent, { depth: null })

    const xmlMerger = new XmlMerger()
    const mergedContent = xmlMerger.parseThenBuild(ancestorContent)
    console.dir(mergedContent, { depth: null })
    await writeFile(outputFile, mergedContent)
  }
}
