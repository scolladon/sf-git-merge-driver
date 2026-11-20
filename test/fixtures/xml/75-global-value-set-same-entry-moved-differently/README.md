# 75-global-value-set-same-entry-moved-differently

Ours moves Banking after Dairy; theirs moves it after Chemicals.

Before the fix the whole list was reported as one conflict.

Pins:
- Only the span where the two moves overlap conflicts, Chemicals leading and
  Energy trailing stay outside it:
  `Chemicals, <Dairy, Banking | Banking, Dairy | Banking, Dairy>, Energy`.
