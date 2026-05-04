# 34-package-xml-types-add

Regression test for issue #191. One branch adds a brand-new `<types>` block
that contains multiple `<members>` siblings. Before the fix, the merger
preserved the parser-shape `members: ["MyClass", "OtherClass"]` array
inside a single-element wrapper-array; the writer's multi-key wrapper
iteration then collapsed both members into one tag with concatenated
text (`<members>MyClassOtherClass</members>`).

Pins:
- Pass-through of an unmatched `KeyedArrayMergeNode` entry (no key match
  for `name=ApexClass` in ancestor/theirs) preserves the parser-shape
  multi-key object inside a wrapper-array.
- The writer unfolds the parser-shape `members: [...]` into one element
  per entry while still emitting a single `<types>` block.
