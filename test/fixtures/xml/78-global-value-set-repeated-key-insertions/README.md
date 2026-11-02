# 78-global-value-set-repeated-key-insertions

Ours inserts a second value with the same `fullName` as A (labelled
`A edited`) right after A. Theirs appends X. The sides touch different
places and no reading of the insertions disagrees.

Both insertions are one-sided, so both are kept: `A, A edited, B, X`, clean.

Before this change the first A was lost and the merge conflicted on the
repeated key.

Pins:
- An entry added by one side is kept even when its key already exists in
  the list.
- A one-sided insertion and a one-sided append compose without conflict.
