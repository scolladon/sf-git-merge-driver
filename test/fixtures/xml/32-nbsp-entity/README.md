# 32-nbsp-entity

§8 row 32: `&#160;` (NBSP) as a literal text value. Under
`valueParsers: []` the parser keeps it as the 6-char string;
writer re-emits verbatim (no double-escape). Confirms
`handleSpecialEntities` was correctly identified as dead code.
