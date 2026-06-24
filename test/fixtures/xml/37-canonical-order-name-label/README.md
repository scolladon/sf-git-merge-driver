# 37-canonical-order-name-label

Writer-only synthetic fixture pinning first-seen (canonical) XML tag order for a
non-alphabetical field sequence.

Source: issue #199 — `<name>` before `<label>` in a Translations `<labels>` block.
`"name" > "label"` lexically, so a reintroduced sort would wrongly emit `<label>`
first. This fixture fails byte-equality whenever the writer re-sorts child tags.

Pins:
- `XmlStreamWriter` emits child tags in first-seen insertion order (not alphabetical).
- `<name>` precedes `<label>` in the output, matching the `ordered-input.json` source order.
- Namespace emission (`xmlns`) on the root element.
