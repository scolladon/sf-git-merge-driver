# 72-global-value-set-replaced-middle-conflict

Ours and theirs both replace Chemicals and Dairy by Forestry, a middle
value and Transportation. The middle value is Insurance in ours and
Hospitality in theirs.

Before the fix the merge kept both middle values and reported no conflict:
`Banking, Forestry, Insurance, Transportation, Hospitality, Energy`.

Pins:
- The conflict covers the disputed middle only:
  `Banking, Forestry, <Insurance | Chemicals, Dairy | Hospitality>, Transportation, Energy`.
- The base side of the block holds the entries both sides removed.
