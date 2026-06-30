# 43-workflow-alerts-order

Residual #2: Workflow `<alerts>` entries are keyed by `fullName` and
merge via the unordered keyed-array strategy, which emits entries
**deterministically sorted by key** — the alphabetical order
`sf project retrieve` writes, so a merge never diverges from Salesforce.

The inputs are in **non-alphabetical** source order (Alert_Beta then
Alert_Alpha); the expected output is alphabetical (Alpha then Beta). A
regression that dropped the deterministic sort would preserve source
order and fail this fixture. ours edits one alert's description.
