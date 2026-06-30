# 20-empty-element

Design §6.3.1 rule 2 + audit: empty elements self-close as `<tag/>`,
matching `sf project retrieve` (which never emits the expanded
`<tag></tag>` form). Pins the self-closing empty-element convention.
