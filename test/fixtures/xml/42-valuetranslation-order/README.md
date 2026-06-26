# 42-valuetranslation-order

Residual #2: GlobalValueSetTranslation `<valueTranslation>` entries are
keyed by `masterLabel` and SF emits them alphabetically, so first-seen
order == alphabetical and a non-conflicting merge must not reorder them.
ours edits one translation; the three entries stay in source order.
