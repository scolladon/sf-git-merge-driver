# 101-two-comments-in-one-element

A `Profile` description holds two comments, `one` and `two`. Ours edits an
unrelated field; theirs leaves the file as it is.

Two comments under one parent parse as a list of comments. Each is written as
a comment of its own, not joined into `<!--one,two-->`.

Pins:
- Every comment of an element is written on its own.
- A file with two comments in one element round-trips through a merge.
