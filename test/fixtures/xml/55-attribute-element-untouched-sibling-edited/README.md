# 55-attribute-element-untouched-sibling-edited

The `Amount__c` entry carries `<help xsi:nil="true"/>`, which the parser
reads as `{ '@_xsi:nil': 'true', '#text': '' }`. Nobody touches it: ours
edits the entry's `<label>`, theirs edits the other entry.

Before the fix, editing any sibling forced a property-by-property merge
of the entry, and `MergeNodeFactory` sent `<help>` to `PropertyMergeNode`
too. That merged `@_xsi:nil` and `#text` as though they were child
elements and handed them to the writer as single-key wrappers, which it
emitted as `<help><@_xsi:nil>true</@_xsi:nil></help>` — invalid XML,
written with a clean exit code.

An element carrying an attribute is now merged as one value, so the
untouched `<help>` is kept verbatim.

Pins:
- `MergeNodeFactory.createNode` routing an attribute-bearing trio to
  `TextMergeNode`.
- `TextMergeStrategy` comparing such elements structurally, so three
  identical sides read as unchanged rather than as a conflict.
