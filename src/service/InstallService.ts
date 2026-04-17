import { appendFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { simpleGit } from 'simple-git'
import { DRIVER_NAME } from '../constant/driverConstant.js'
import {
  MANIFEST_PATTERNS,
  METADATA_TYPES_PATTERNS,
} from '../constant/metadataConstant.js'
import { getGitAttributesPath } from '../utils/gitUtils.js'
import { log } from '../utils/LoggingDecorator.js'

// Resolved from this compiled module's location:
//   <plugin-root>/lib/service/InstallService.js → ../../bin/merge-driver.cjs
const BINARY_RELATIVE = ['..', '..', 'bin', 'merge-driver.cjs'] as const
const BINARY_PATH_RAW = join(
  dirname(fileURLToPath(import.meta.url)),
  ...BINARY_RELATIVE
)

// Ensure POSIX separators (Windows join() uses backslash) and escape single
// quotes so the path embeds safely inside the sh -c '...' wrapper.
const BINARY_PATH = BINARY_PATH_RAW.replace(/\\/g, '/').replace(/'/g, "'\\''")

// git's merge-driver placeholder convention: %O ancestor, %A local, %B other,
// %P output, %L conflict-marker-size, %S ancestor-label, %X local-label,
// %Y other-label. All 8 are passed — this wires %S (new) through to the
// binary's -S flag; previous install omitted %S, forcing the static default.
const DRIVER_COMMAND =
  `sh -c 'node "${BINARY_PATH}" -O "$1" -A "$2" -B "$3" -P "$4" -L "$5" -S "$6" -X "$7" -Y "$8"'` +
  ' -- %O %A %B %P %L %S %X %Y'

export class InstallService {
  @log('InstallService')
  public async installMergeDriver(): Promise<void> {
    const git = simpleGit({ unsafe: { allowUnsafeMergeDriver: true } })
    await git.addConfig(
      `merge.${DRIVER_NAME}.name`,
      'Salesforce source merge driver'
    )
    await git.addConfig(`merge.${DRIVER_NAME}.driver`, DRIVER_COMMAND)

    // Configure merge driver for each metadata type pattern
    const metadataPatterns = METADATA_TYPES_PATTERNS.map(
      pattern => `*.${pattern}-meta.xml merge=${DRIVER_NAME}`
    ).join('\n')

    // Configure merge driver for manifest files (package.xml, destructiveChanges.xml, etc.)
    const manifestPatterns = MANIFEST_PATTERNS.map(
      pattern => `${pattern} merge=${DRIVER_NAME}`
    ).join('\n')

    const content = `${metadataPatterns}\n${manifestPatterns}\n`

    const gitAttributesPath = await getGitAttributesPath()

    await appendFile(gitAttributesPath, content, { flag: 'a' })
  }
}
