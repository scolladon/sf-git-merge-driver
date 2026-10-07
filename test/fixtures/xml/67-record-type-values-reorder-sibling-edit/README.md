# 67-record-type-values-reorder-sibling-edit

Ours swaps Agriculture and Banking inside a RecordType picklist `values`
list; theirs flips `<active>`.

Behaviour unchanged: RecordType `values` entries are keyed by `fullName` and
stay ordered, so ours' reorder is kept and theirs' `<active>` edit applies.

Pins:
- Ordered default for `values` entries keyed by `fullName`.
