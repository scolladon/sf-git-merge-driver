# 68-custom-metadata-duplicate-field-kept

The ancestor and both sides carry the same `field` (A) twice, with different
values. Ours edits `<label>`.

Before this change a duplicate `field` was collapsed to its last entry and
the first one was dropped.

Every copy of A is now kept, in written order with its own value, and B and C
are intact.

Pins:
- Every copy of a duplicate `field` is kept.
