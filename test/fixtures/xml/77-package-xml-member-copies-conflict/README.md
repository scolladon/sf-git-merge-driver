# 77-package-xml-member-copies-conflict

A `types` block for ApexClass lists the member `a` three times. Ours keeps
one `a`, theirs keeps two.

The sides disagree on how many copies survive and no reading of the copies
settles it, so the members conflict: `<a | a,a,a | a,a>`, inside the `types`
entry.

Before this change the text array was treated as a set, so the merge was
clean and silently kept a single `a`.

Pins:
- Copies of one member are counted: two sides that keep different numbers of
  a repeated value conflict.
- The conflict stays inside the `types` entry; the rest of the Package is
  merged around it.
