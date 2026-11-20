# 84-unordered-reorder-vs-delete-ours

`CustomLabels` is an unordered type. Ours only reorders its two `labels`,
theirs deletes every label.

Order carries no meaning for an unordered type, so ours changed nothing:
the deletion is taken without conflict.

Pins:
- A reorder of an unordered keyed array reads as no change when the other side
  deletes the whole content (ADR 072).
- `85-unordered-reorder-vs-delete-theirs` is the mirror.
