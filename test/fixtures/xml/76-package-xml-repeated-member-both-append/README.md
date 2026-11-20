# 76-package-xml-repeated-member-both-append

A `types` block for ApexClass lists the members `a`, `a`, `b`. Ours appends
`c`, theirs appends `d`.

Both edits reach the text-array merge, which counts each value instead of
collapsing it to a set: the merge is clean and keeps both copies of `a`,
then `b`, `c`, `d`.

Before this change the text array was treated as a set, so the second `a`
was dropped from the merged `types` block.

Pins:
- A value present twice in the ancestor keeps both copies when the two sides
  only append other values.
- Two sides that each add a different member merge cleanly.
