import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { MergeDriver } from '../../../../driver/MergeDriver.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages('sf-git-merge-driver', 'run')

export default class Run extends SfCommand<void> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')

  public static override readonly flags = {
    'ancestor-file': Flags.string({
      char: 'a',
      summary: messages.getMessage('flags.ancestor-file.summary'),
      required: true,
      exists: true,
    }),
    'our-file': Flags.string({
      char: 'o',
      summary: messages.getMessage('flags.our-file.summary'),
      required: true,
      exists: true,
    }),
    'theirs-file': Flags.string({
      char: 't',
      summary: messages.getMessage('flags.theirs-file.summary'),
      required: true,
      exists: true,
    }),
    'output-file': Flags.string({
      char: 'p',
      summary: messages.getMessage('flags.output-file.summary'),
      required: true,
      exists: true,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Run)
    const mergeDriver = new MergeDriver()
    const hasConflict = await mergeDriver.mergeFiles(
      flags['ancestor-file'],
      flags['our-file'],
      flags['theirs-file'],
      flags['output-file']
    )
    if (hasConflict) {
      this.error(
        messages.getMessage('result.withconflict') + ' ' + flags['output-file'],
        { code: '1' }
      )
    } else {
      this.info(
        messages.getMessage('result.successful') + ' ' + flags['output-file']
      )
    }
  }
}
