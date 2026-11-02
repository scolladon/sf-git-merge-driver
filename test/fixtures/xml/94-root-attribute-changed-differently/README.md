# 94-root-attribute-changed-differently

A `Profile` root carries `xmlns` and `b`. Ours adds `a="1"`. Theirs adds
`a="2"` and changes `b` to `3`.

Attributes follow the doctrines of fields. Theirs' edit of `b` is one-sided and
is kept. Both sides added `a` with different values: no file says which is
right, so the merge conflicts.

Markers cannot go inside a start tag, so the conflict is the start tag line,
each side verbatim: ours with `a="1"`, theirs with `a="2"`, and both carry the
merged `b="3"`. Resolving to either side gives a well-formed file; the
children follow the closing marker.

Pins:
- Different values of one attribute conflict; neither side is dropped.
- An attribute only one side changed is kept on both sides of the conflict.
- The base is the ancestor's start tag.
