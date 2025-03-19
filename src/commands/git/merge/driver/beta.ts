import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'
import { MergeDriver } from '../../../../driver/MergeDriver.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const messages = Messages.loadMessages('sf-git-merge-driver', 'run')

export default class Beta extends SfCommand<void> {
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
    'output-file': Flags.string({
      char: 'p',
      summary: messages.getMessage('flags.output-file.summary'),
      required: true,
      exists: true,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Beta)
    const mergeDriver = new MergeDriver()
    await mergeDriver.copyFiles(flags['ancestor-file'], flags['output-file'])
  }
}
