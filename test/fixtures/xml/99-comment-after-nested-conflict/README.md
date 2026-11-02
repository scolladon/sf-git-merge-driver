# 99-comment-after-nested-conflict

A `userPermissions` entry holds `name`, `enabled` and, on both sides, a
trailing comment. Ours sets `enabled` to `true`; theirs sets it to `maybe`.

The two changes conflict, and the comment is written after the conflict block.
It starts on a fresh indented line, never on the `>>>>>>> theirs` marker line:
a comment glued to the marker would lose its `<!--` opener when the conflict
is resolved, and its text would silently turn into element content.

Pins:
- A comment that follows a conflict block starts on its own line.
- The closing marker stays alone on its line.
