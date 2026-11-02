# 79-keyed-repeated-key-ambiguous-edits

A Profile lists the same field twice, `editable` false on both entries.
Ours flips the first to true, theirs flips the second to true.

Which copy each side edited cannot be told, and the two readings give
different results, so the entries of that field conflict as one block:
`<true,false | false,false | false,true>`.

Before this change the merge was clean and silently kept a single entry.

Pins:
- A key repeated in the ancestor with edits on different copies conflicts.
- The block holds all entries of the key, in order, on each side.
