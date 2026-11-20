# 51-unkeyed-array-unchanged-sibling-change

`<bogusThing>` is a repeated element with no key extractor registered in
`MetadataService` — the driver falls back to whole-array conflict
behavior for it (documented in the README). This fixture pins that the
array only conflicts on an *actual* divergence: `<bogusThing>` is
byte-identical on all three sides here, while the unrelated `<label>`
sibling changes on ours only.

Before the fix, the unkeyed strategy returned a conflict
unconditionally whenever it was invoked at all — including when the
array itself never changed and was only visited because `<label>`
forced a walk through the parent's other children. This fixture
regresses that: expected output has `<label>` updated cleanly and
`<bogusThing>` passed through untouched, with no conflict markers.

Pins:
- An array identical on all three sides never conflicts, whatever its
  siblings do.
- No cross-contamination between an unrelated sibling change and an
  unkeyed array that never changed.
