# 51-unkeyed-array-unchanged-sibling-change

`<bogusThing>` is a repeated element with no key extractor registered in
`MetadataService` — the driver falls back to whole-array conflict
behavior for it (documented in the README). This fixture pins that the
fallback only fires on an *actual* divergence: `<bogusThing>` is
byte-identical on all three sides here, while the unrelated `<label>`
sibling changes on ours only.

Before the fix, `UnkeyedConflictStrategy` returned a conflict
unconditionally whenever it was invoked at all — including when the
array itself never changed and was only visited because `<label>`
forced a walk through the parent's other children. This fixture
regresses that: expected output has `<label>` updated cleanly and
`<bogusThing>` passed through untouched, with no conflict markers.

Pins:
- Equality fast path in `UnkeyedConflictStrategy.merge()` (three-way
  compare before falling back to a whole-array conflict).
- No cross-contamination between an unrelated sibling change and an
  unkeyed array that never changed.
