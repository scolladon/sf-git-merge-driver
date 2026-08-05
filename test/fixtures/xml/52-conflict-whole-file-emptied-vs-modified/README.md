# 52-conflict-whole-file-emptied-vs-modified

`ours` is a completely empty file (the whole document dropped) while
`theirs` edits `<label>`. The whole file becomes a single root-level
ConflictBlock: `local` has no content, `ancestor` and `other` each hold
a full `<PermissionSet>`.

Before the fix, this shape hit two compounding writer bugs at once:

1. `local`'s "no content" side is `[{}]` (a one-element array holding a
   bare empty object — see `buildConflictMarkers`'s `hasNoContent`), not
   `[]`. `writeConflictContent` only recognised `[]` as blank, so `[{}]`
   fell through to `writeChildren`, which produced zero bytes and glued
   `<<<<<<< ours` directly onto `||||||| base` on the same line.
2. Because the conflict block was the very first thing ever written
   (right after the XML declaration), `isFirstTopLevelAfterDecl` was
   still `true` when the ancestor side's `<PermissionSet>` was reached,
   suppressing its leading newline and gluing it onto the marker line:
   `||||||| base<PermissionSet>`.

Expected output has every marker on its own line and `<PermissionSet>`
starting a fresh line.

Pins:
- `isBlankConflictSide` treating `[{}]` the same as `[]` in
  `writeConflictContent`.
- `writeConflict` consuming `isFirstTopLevelAfterDecl` before writing
  any conflict-side content.
