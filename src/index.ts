#!/usr/bin/env -S NODE_OPTIONS="--no-warnings=ExperimentalWarning" npx ts-node --project tsconfig.json --esm
import { MergeDriver } from './driver/MergeDriver.js'

if (process.argv.length >= 6) {
  const [, , ancestorFile, ourFile, theirFile, outputFile] = process.argv
  const mergeDriver = new MergeDriver()
  mergeDriver
    .mergeFiles(ancestorFile, ourFile, theirFile, outputFile)
    .then(() => process.exit(0))
} else {
  console.error('Usage: sf-git-merge-driver %O %A %B %P')
  console.error('  %O: ancestor file')
  console.error('  %A: our file')
  console.error('  %B: their file')
  console.error('  %P: output file path')
  process.exit(1)
}
