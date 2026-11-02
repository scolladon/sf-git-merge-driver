# 86-whole-root-conflict-keeps-entries

`CustomLabels` has `labels` as its only child. Ours edits the second label,
theirs deletes every label.

The type decides how entries merge, not the presence of a sibling: the emptied
root is merged entry by entry, as it would be next to a sibling. Label `A` is
untouched by ours, so theirs' deletion settles it outside the markers; only
label `B`, edited by ours and deleted by theirs, is in the block.

Each side of the block is written verbatim, one `<labels>` element per entry.

Pins:
- Only the entries the sides contest are in the block when one side empties the
  root (ADR 053 smallest block, ADR 059 settled entries outside the markers).
- The block does not depend on whether the root has a sibling (ADR 072).
