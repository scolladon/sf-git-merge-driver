# 80-keyed-delete-vs-modify

A Profile lists fields A and B. Ours deletes A, theirs sets `editable` of A
to true.

Deleting an entry the other side edited is a conflict. The block replaces
the entry at the array level: `<∅ | A:false | A:true>`, then B.

Before this change the block sat inside an outer `<fieldPermissions>`
wrapper: keeping theirs gave nested `<fieldPermissions>` elements and
keeping ours left an empty `<fieldPermissions></fieldPermissions>`.

Pins:
- The conflict markers are written directly under the Profile, with no
  wrapper element.
- Ours side is blank, so keeping ours leaves no A.
- B is untouched and stays after the block.
