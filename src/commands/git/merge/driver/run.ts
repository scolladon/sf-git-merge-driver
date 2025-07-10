import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../../constant/conflictConstant.js'
import { MergeDriver } from '../../../../driver/MergeDriver.js'
import { ConflictMarker } from '../../../../merger/conflictMarker.js'
import { conflicConfig } from '../../../../types/conflictTypes.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages('sf-git-merge-driver', 'run')

const ERROR_EXIT_CODE = 1
const SUCCESS_EXIT_CODE = 0

export default class Run extends SfCommand<void> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')

  public static override readonly flags = {
    'ancestor-file': Flags.string({
      char: 'O',
      summary: messages.getMessage('flags.ancestor-file.summary'),
      required: true,
      exists: true,
    }),
    'local-file': Flags.string({
      char: 'A',
      summary: messages.getMessage('flags.local-file.summary'),
      required: true,
      exists: true,
    }),
    'other-file': Flags.string({
      char: 'B',
      summary: messages.getMessage('flags.other-file.summary'),
      required: true,
      exists: true,
    }),
    'output-file': Flags.string({
      char: 'P',
      summary: messages.getMessage('flags.output-file.summary'),
      required: true,
      exists: true,
    }),
    'conflict-marker-size': Flags.integer({
      char: 'L',
      summary: messages.getMessage('flags.conflict-marker-size.summary'),
      min: 1,
      default: DEFAULT_CONFLICT_MARKER_SIZE,
    }),
    'ancestor-conflict-tag': Flags.string({
      char: 'S',
      summary: messages.getMessage('flags.ancestor-conflict-tag.summary'),
      default: DEFAULT_ANCESTOR_CONFLICT_TAG,
    }),
    'local-conflict-tag': Flags.string({
      char: 'X',
      summary: messages.getMessage('flags.local-conflict-tag.summary'),
      default: DEFAULT_LOCAL_CONFLICT_TAG,
    }),
    'other-conflict-tag': Flags.string({
      char: 'Y',
      summary: messages.getMessage('flags.other-conflict-tag.summary'),
      default: DEFAULT_OTHER_CONFLICT_TAG,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Run)

    process.stderr.write(
      `[SF-MERGE-DEBUG] %O(ancestor-file): ${flags['ancestor-file']}\n`
    )
    process.stderr.write(
      `[SF-MERGE-DEBUG] %A(local-file): ${flags['local-file']}\n`
    )
    process.stderr.write(
      `[SF-MERGE-DEBUG] %B(other-file): ${flags['other-file']}\n`
    )
    process.stderr.write(
      `[SF-MERGE-DEBUG] %P(output-file): ${flags['output-file']}\n`
    )
    process.stderr.write(
      `[SF-MERGE-DEBUG] %L(conflict-marker-size): ${flags['conflict-marker-size']}\n`
    )
    process.stderr.write(
      `[SF-MERGE-DEBUG] %S(ancestor-conflict-tag): ${flags['ancestor-conflict-tag']}\n`
    )
    process.stderr.write(
      `[SF-MERGE-DEBUG] %X(local-conflict-tag): ${flags['local-conflict-tag']}\n`
    )
    process.stderr.write(
      `[SF-MERGE-DEBUG] %Y(other-conflict-tag): ${flags['other-conflict-tag']}\n`
    )

    const conflicConfig: conflicConfig = {
      conflictMarkerSize: flags['conflict-marker-size'],
      ancestorConflictTag: flags['ancestor-conflict-tag'],
      localConflictTag: flags['local-conflict-tag'],
      otherConflictTag: flags['other-conflict-tag'],
    }
    ConflictMarker.setConflictConfig(conflicConfig)

    const mergeDriver = new MergeDriver()
    const hasConflict = await mergeDriver.mergeFiles(
      flags['ancestor-file'],
      flags['local-file'],
      flags['other-file']
    )
    process.exitCode = hasConflict ? ERROR_EXIT_CODE : SUCCESS_EXIT_CODE
  }
}
