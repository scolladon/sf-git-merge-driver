# 74-global-value-set-same-insert-different-places

Ours and theirs both insert Forestry, ours after Banking and theirs after
Chemicals.

Before the fix the whole list was reported as one conflict.

Pins:
- The conflict covers the disputed placement only, Banking and Dairy stay
  outside it:
  `Banking, <Forestry, Chemicals | Chemicals | Chemicals, Forestry>, Dairy`.
