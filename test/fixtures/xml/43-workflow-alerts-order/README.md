# 43-workflow-alerts-order

Residual #2: Workflow `<alerts>` entries are keyed by `fullName` and SF
emits them alphabetically, so first-seen order == alphabetical and a
non-conflicting merge must not reorder them. ours edits one alert's
description; both alerts stay in source order.
