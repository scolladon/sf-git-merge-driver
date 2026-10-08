# 58-attribute-element-divergent-edits

Both sides fill in the `Amount__c` help text that was
`<help xsi:nil="true"/>`, with different values.

Before the fix the conflict was raised per character key inside `<help>`
(`<0>E</0>` vs `<0>A</0>`), so neither side's text survived intact and
the base side lost its attribute.

The element is now merged as one value, so the conflict holds each
side's whole `<help>` element, with the base rendered as
`<help xsi:nil="true"/>`.

Pins:
- `TextMergeStrategy` building the conflict from whole attribute-bearing
  elements.
