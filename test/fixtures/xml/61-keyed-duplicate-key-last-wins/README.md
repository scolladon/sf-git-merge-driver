# 61-keyed-duplicate-key-last-wins

A `Profile` carries two `fieldPermissions` sharing
`<field>Account.X__c</field>`, the first with `editable` false and the
second with `editable` true. Ours sets `<custom>` to false; theirs changes
nothing.

Behaviour unchanged by design: a deploy keeps the last of two same-key
entries, and so does the driver. The merge outputs one `fieldPermissions`
(the last one) and ours' `<custom>` edit, with a clean exit code.

Pins:
- The unordered keyed strategy keeping the last entry of a repeated key,
  once.
- The keyless fail-safe not firing on entries that do carry a real key.
