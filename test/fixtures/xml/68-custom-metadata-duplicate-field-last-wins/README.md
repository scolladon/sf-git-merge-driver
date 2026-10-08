# 68-custom-metadata-duplicate-field-last-wins

The ancestor and both sides carry the same `field` (A) twice, with different
values. Ours edits `<label>`.

Before the fix every entry but C was lost and C was written four times.

A duplicate `field` now resolves to its last entry, which is what a deploy to
an org keeps. A is written once with the last value, B and C are intact.

Pins:
- Last-wins on a duplicate `field`.
