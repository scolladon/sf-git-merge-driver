# 39-canonical-order-merge-criteria-items

Merge-trio fixture pinning that `criteriaItems` entries keep their source (canonical)
order through a three-way merge, instead of being alphabetised by key.

`criteriaItems` shares the `getFilterItemKey` extractor with `filterItems` /
`summaryFilterItems` but was missing from `ORDERED_ATTRIBUTES`, so it routed through the
unordered (sorted-by-key) strategy. Salesforce emits `criteriaItems` in source order, so
the alphabetical sort diverged and flipped back on the next `sf project retrieve`.

Source order here is `Case.Origin` before `Case.Description` (`"Origin" > "Description"`
lexically, so a re-sort would wrongly emit `Description` first). `ours` flips `active`,
`theirs` changes `triggerType` — non-overlapping, clean no-conflict merge — which forces a
descent that re-emits the `criteriaItems` array. Surfaced during issue #199 QA over
real retrieved Workflow/SharingRules metadata.
