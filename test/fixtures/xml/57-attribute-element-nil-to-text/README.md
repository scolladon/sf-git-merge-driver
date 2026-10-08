# 57-attribute-element-nil-to-text

Ours fills in the `Amount__c` help text that was `<help xsi:nil="true"/>`;
theirs edits the other entry.

Before the fix `PropertyMergeNode` received ours' plain string and
indexed it character by character (`Object.keys('Enter…')` is `['0', …]`),
so the output was `<help><0>E</0>…</help>` and the attribute was dropped.

The element is now merged as one value: only ours changed it, so ours'
`<help>Enter the amount</help>` wins with no conflict.

Pins:
- `MergeNodeFactory.createNode` routing a trio that mixes text and an
  attribute-bearing element to `TextMergeNode`.
