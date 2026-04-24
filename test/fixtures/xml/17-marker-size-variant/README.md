# 17-marker-size-variant

Conflict marker expansion at the default marker size (7). Guards
ConflictBlock-to-text expansion against regressions in the
`<<<<<<<` / `=======` / `>>>>>>>` marker bytes. A true size-variant
test would need a separate MergeConfig — that's a follow-up; this
fixture locks down the default-config expansion shape.
