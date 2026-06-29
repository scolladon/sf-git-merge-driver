# 38-canonical-order-merge-name-label

Merge-trio fixture pinning first-seen (canonical) XML tag order through the full
parser → merger → writer pipeline.

Source: issue #199 — `<name>` before `<label>` in a Translations `<labels>` block.
`"name" > "label"` lexically, so a reintroduced sort would wrongly emit `<label>`
first. This fixture fails byte-equality whenever the pipeline re-sorts child tags.

Scenario: `ours` adds a new `<labels>` entry (`MyLabel`); `theirs` is unchanged from
`ancestor`. The merge is a clean no-conflict addition. `labels` are keyed by
`fullName` (MetadataService.ts), so both entries merge correctly.

Pins:
- Full pipeline (parse → merge → write) preserves first-seen child tag order.
- `<name>` precedes `<label>` in the merged output for both labels entries.
- No conflict markers — clean keyed-array addition.
