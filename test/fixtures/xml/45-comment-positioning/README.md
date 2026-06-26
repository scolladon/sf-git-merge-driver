# 45-comment-positioning

Pins the **known limitation** that a comment between two same-tag
siblings relocates after both of them through a merge: the input
`<a>1</a><!--mid--><a>2</a>` re-emits as
`<a>1</a><a>2</a><!--mid-->` because the compact tree groups
same-tag elements into one array and stores the comment under a
single key, losing its inter-sibling position.

This is cosmetic (SF strips comments on retrieve) and is documented in
DESIGN.md "Known Limitations". The fixture exists so a future
order-preserving rewrite (a deliberate version-bump change) flips this
expectation consciously rather than silently.
