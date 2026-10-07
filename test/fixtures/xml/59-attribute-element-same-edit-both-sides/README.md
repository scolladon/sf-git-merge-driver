# 59-attribute-element-same-edit-both-sides

Both sides clear the `Amount__c` help text to `<help xsi:nil="true"/>`;
theirs also edits the other entry.

Each side parses `<help xsi:nil="true"/>` into its own object, so an
identity check would see two different values and raise a conflict for
an identical edit. `TextMergeStrategy` compares attribute-bearing
elements structurally, so the agreed edit merges cleanly.

Pins:
- `TextMergeStrategy` treating structurally equal attribute-bearing
  elements on both sides as the same edit.
