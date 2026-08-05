# 54-unkeyed-object-deleted-one-side

`<valueSet>` is the canonical `PropertyMergeNode` element: it carries
children, has no key extractor, and occurs once, so the factory routes
it to a property-by-property merge. Ancestor and theirs are identical
and declare it; ours drops it and changes nothing else.

Before the fix, `MergeNodeFactory.createNode` cast every side to
`JsonObject` on the way into `PropertyMergeNode` even when a side had no
such element at all, so the per-key loop indexed `undefined` and the
driver crashed with `TypeError: Cannot read properties of undefined
(reading 'restricted')` instead of merging. Every presence combination
other than "present on all three sides" hit it — a one-sided deletion,
a one-sided addition, and an addition made by both sides alike.

The absent side is now normalised to the empty object before the node is
constructed, so it contributes no keys and the deletion propagates: the
surviving `<fullName>` stays, `<valueSet>` goes, and there is no
conflict.

Pins:
- `MergeNodeFactory.createNode` normalising a side where the element is
  absent (or is not a pure object) to the empty object before
  constructing `PropertyMergeNode`.
