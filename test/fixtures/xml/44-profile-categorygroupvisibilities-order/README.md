# 44-profile-categorygroupvisibilities-order

Residual #2: Profile `<categoryGroupVisibilities>` entries are keyed by
`dataCategoryGroup` and SF emits them alphabetically, so first-seen
order == alphabetical and a non-conflicting merge must not reorder them.
ours edits one entry's visibility; all three stay in source order.
