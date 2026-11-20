# 100-single-line-marker-value-in-conflict

A `Profile` description is `a`. Ours rewrites it to `=======`; theirs changes
it to `c`.

The two changes conflict. Ours' value follows `<description>` on the same
line, so it never starts a line of its own and cannot read as a marker: it is
written as it is. Only a line that follows a line break in a value is escaped
(fixture `98-marker-like-text-line-in-conflict`).

Pins:
- The first line of a value is not escaped, because it never starts an output line.
