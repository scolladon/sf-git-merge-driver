# 56-attribute-element-text-to-nil

Ours clears the `Amount__c` help text to `<help xsi:nil="true"/>`; theirs
edits the other entry.

Before the fix the text-bodied ancestor and theirs sides were merged
property by property against ours' attribute object, and the output was
`<help><@_xsi:nil>true</@_xsi:nil></help>`.

The element is now merged as one value: only ours changed it, so ours'
`<help xsi:nil="true"/>` wins with no conflict.

Pins:
- `MergeNodeFactory.createNode` routing a trio that mixes text and an
  attribute-bearing element to `TextMergeNode`.
