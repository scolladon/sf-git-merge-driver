# 52-conflict-whole-file-emptied-vs-modified

`ours` is a completely empty file (the whole document dropped) while
`theirs` edits `<label>`. The whole file becomes a single root-level
ConflictBlock: `local` has no content, `ancestor` and `other` each hold
a full `<PermissionSet>`.

Before the fix, this shape hit three compounding bugs at once:

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
3. Both rendered sides lost the root `xmlns`, so resolving the conflict
   by keeping either side yielded a root that dropped an attribute the
   input carried. Two causes compounded, and fixing either alone left
   the bytes unchanged: `mergeNamespaces` read `ours`'s empty namespace
   bucket as "this side removed the xmlns" when it only means "this
   side has no root element to carry attributes on", emptying the
   merged map; and `writeRoot` attached namespaces only to the first
   top-level *element*, a slot the conflict block consumed first, so
   even a populated map was discarded.

Expected output has every marker on its own line, `<PermissionSet>`
starting a fresh line, and the root `xmlns` on every non-blank side.
That last part is an intentional wire-format change, not a fixture fix:
it moves the driver toward git's own text merge, which keeps the whole
root line — `xmlns` included — on both sides. The driver still
deliberately hoists one XML declaration above the markers instead of
repeating it per side.

Pins:
- `isBlankConflictSide` treating `[{}]` the same as `[]` in
  `writeConflictContent`.
- `writeConflict` consuming `isFirstTopLevelAfterDecl` before writing
  any conflict-side content.
- `namespacesOf` letting a side with no root element abstain from
  namespace resolution instead of voting to remove the declaration.
- `writeRoot` handing the root namespace attributes to a top-level
  `ConflictBlock`, so each non-blank side's root element carries them.
