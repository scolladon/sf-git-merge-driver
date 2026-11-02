# 61-keyed-duplicate-key-kept

A `Profile` carries two `fieldPermissions` sharing
`<field>Account.X__c</field>`, the first with `editable` false and the
second with `editable` true. Ours sets `<custom>` to false; theirs changes
nothing.

Before this change the driver collapsed the repeated key to its last copy and
dropped the first one.

Every copy of a repeated key is now kept: the merge outputs both
`fieldPermissions`, in written order, and ours' `<custom>` edit, with a clean
exit code.

Pins:
- The unordered keyed strategy keeping every copy of a repeated key.
- The keyless fail-safe not firing on entries that do carry a real key.
