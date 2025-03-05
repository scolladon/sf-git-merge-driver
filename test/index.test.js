import fs from 'fs'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import path from 'path'
import { fileURLToPath } from 'url'
import { mergeFiles } from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Salesforce Metadata Merge Driver', () => {
  const testDir = path.join(__dirname, 'fixtures')

  // Create test directory if it doesn't exist
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }

  describe('XML Merging', () => {
    it('should correctly merge XML files with non-conflicting changes', async () => {
      // Create test files
      const ancestorContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Test Object</label>
    <pluralLabel>Test Objects</pluralLabel>
</CustomObject>`

      const ourContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Test Object</label>
    <pluralLabel>Test Objects</pluralLabel>
    <description>Our description</description>
</CustomObject>`

      const theirContent = `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Modified Test Object</label>
    <pluralLabel>Test Objects</pluralLabel>
</CustomObject>`

      const ancestorFile = path.join(testDir, 'ancestor.xml')
      const ourFile = path.join(testDir, 'ours.xml')
      const theirFile = path.join(testDir, 'theirs.xml')
      const outputFile = path.join(testDir, 'merged.xml')

      fs.writeFileSync(ancestorFile, ancestorContent)
      fs.writeFileSync(ourFile, ourContent)
      fs.writeFileSync(theirFile, theirContent)

      // Run the merge
      const success = await mergeFiles(
        ancestorFile,
        ourFile,
        theirFile,
        outputFile
      )

      // Verify the result
      assert.strictEqual(success, true)
      const mergedContent = fs.readFileSync(outputFile, 'utf8')

      // The merged content should contain both changes
      assert(mergedContent.includes('Modified Test Object'))
      assert(mergedContent.includes('Our description'))
    })
  })

  describe('JSON Merging', () => {
    it('should correctly merge JSON files with non-conflicting changes', async () => {
      // Create test files
      const ancestorContent = `{
    "fullName": "TestObject",
    "label": "Test Object",
    "pluralLabel": "Test Objects"
}`

      const ourContent = `{
    "fullName": "TestObject",
    "label": "Test Object",
    "pluralLabel": "Test Objects",
    "description": "Our description"
}`

      const theirContent = `{
    "fullName": "TestObject",
    "label": "Modified Test Object",
    "pluralLabel": "Test Objects"
}`

      const ancestorFile = path.join(testDir, 'ancestor.json')
      const ourFile = path.join(testDir, 'ours.json')
      const theirFile = path.join(testDir, 'theirs.json')
      const outputFile = path.join(testDir, 'merged.json')

      fs.writeFileSync(ancestorFile, ancestorContent)
      fs.writeFileSync(ourFile, ourContent)
      fs.writeFileSync(theirFile, theirContent)

      // Run the merge
      const success = await mergeFiles(
        ancestorFile,
        ourFile,
        theirFile,
        outputFile
      )

      // Verify the result
      assert.strictEqual(success, true)
      const mergedContent = fs.readFileSync(outputFile, 'utf8')
      const mergedObj = JSON.parse(mergedContent)

      // The merged content should contain both changes
      assert.strictEqual(mergedObj.label, 'Modified Test Object')
      assert.strictEqual(mergedObj.description, 'Our description')
    })
  })
})
