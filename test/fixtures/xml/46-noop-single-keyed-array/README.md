# 46-noop-single-keyed-array

Regression for the no-op (identical O/A/B) merge of an element whose **only**
child is a repeated keyed array — here `CustomLabels`, which contains nothing
but `<labels>` entries.

`AllPresentStrategy` short-circuits identical inputs through `buildEarlyResult`,
which returns the raw parser shape. The parser groups repeated siblings under
one key (`{labels: [entry1, entry2]}`); because that is a *single-key* wrapper
whose value is an array, the writer used to treat the array as one element's
body and collapse every `<labels>` into a single `<labels>` block with all the
fields concatenated — structurally invalid metadata that would not deploy.

`buildEarlyResult` now expands single-key grouped repeats into one wrapper per
entry, so each sibling survives. ancestor = ours = theirs are byte-identical and
already in canonical (sorted, declaration, trailing-newline) form, so the no-op
output must equal the input verbatim. A regression that re-collapses drops the
`</labels><labels>` boundary and fails this fixture.

Empirically confirmed against `CustomLabels` (1006 labels) and an `Account`
object retrieved from a real org: both round-trip byte-for-byte.
