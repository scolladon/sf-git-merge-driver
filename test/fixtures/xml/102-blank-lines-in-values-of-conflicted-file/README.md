# 102-blank-lines-in-values-of-conflicted-file

A `Profile` holds a text, a CDATA section, a comment and an attribute value
that each span several lines, with empty and whitespace-only lines inside.
Ours and theirs change `d` apart, and ours writes a multi-line value with
blank lines in it.

The blank lines belong to the values: they are kept, outside the conflict and
inside its sides. Only the blank lines the writer itself leaves around the
markers are dropped.

Pins:
- A whitespace-only line inside a text, CDATA, comment or attribute value
  survives in a file holding a conflict.
- The same line survives inside a conflict side.
