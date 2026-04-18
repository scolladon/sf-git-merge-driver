import { DRIVER_NAME } from '../constant/driverConstant.js'
import { getMerge, type ParsedFile } from '../utils/gitAttributesFile.js'

/**
 * An action in an uninstall plan — what to do with a single line of
 * `.git/info/attributes`. Plans are applied by `UninstallService`, and
 * the shape is also what `--dry-run` renders to the user.
 *
 * `drop-line` is safe (line is pure `<pattern> merge=salesforce-source`
 * or equivalent); `remove-merge-attr` is the A8 fix — keep the user's
 * other attributes on the line and only strip our `merge=` token.
 */
export type UninstallAction =
  | { readonly kind: 'drop-line'; readonly lineIndex: number }
  | { readonly kind: 'remove-merge-attr'; readonly lineIndex: number }

export type UninstallPlan = {
  readonly actions: readonly UninstallAction[]
}

/**
 * Walk every rule in the parsed file; for rules whose `merge=` attribute
 * matches our driver, emit the appropriate action. Comments, blanks, and
 * rules for other merge drivers are ignored (no action).
 */
export const planUninstall = (file: ParsedFile): UninstallPlan => {
  const actions: UninstallAction[] = []
  for (let i = 0; i < file.lines.length; i++) {
    const line = file.lines[i]
    if (line.kind !== 'rule') continue
    if (getMerge(line) !== DRIVER_NAME) continue
    // Rule mentions our driver. If the only attribute is our merge, the
    // whole line can be dropped safely; otherwise the user has other
    // attributes on the same line and we must preserve them by keeping
    // the line and removing only the merge token.
    if (line.attrs.size === 1) {
      actions.push({ kind: 'drop-line', lineIndex: i })
    } else {
      actions.push({ kind: 'remove-merge-attr', lineIndex: i })
    }
  }
  return { actions }
}
