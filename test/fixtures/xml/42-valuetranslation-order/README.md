# 42-valuetranslation-order

Residual #2: GlobalValueSetTranslation `<valueTranslation>` entries are
keyed by `masterLabel` and merge via the unordered keyed-array strategy,
which emits entries **deterministically sorted by key** — the same
alphabetical order `sf project retrieve` writes, so a merge never
diverges from Salesforce.

To make this discriminating (not tautological), the inputs are in
**non-alphabetical** source order (Cherry, Apple, Banana); the expected
output is alphabetical (Apple, Banana, Cherry). A regression that dropped
the deterministic sort would preserve the source order and fail this
fixture. ours edits one translation to confirm the non-conflicting value
still merges.
