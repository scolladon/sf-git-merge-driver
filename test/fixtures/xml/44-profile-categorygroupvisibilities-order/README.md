# 44-profile-categorygroupvisibilities-order

Residual #2: Profile `<categoryGroupVisibilities>` entries are keyed by
`dataCategoryGroup` and merge via the unordered keyed-array strategy,
which emits entries **deterministically sorted by key** — the
alphabetical order `sf project retrieve` writes, so a merge never
diverges from Salesforce.

The inputs are in **non-alphabetical** source order (Gamma, Alpha, Beta);
the expected output is alphabetical (Alpha, Beta, Gamma). A regression
that dropped the deterministic sort would preserve source order and fail
this fixture. ours edits one entry's visibility.
