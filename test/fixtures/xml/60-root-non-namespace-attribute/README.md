# 60-root-non-namespace-attribute

The root `<Profile>` carries `xsi:schemaLocation` next to its `xmlns*`
declarations. Ours edits `<custom>`; theirs edits `<description>` and
points `xsi:schemaLocation` at a new schema.

Before the fix the parser bucketed only the `xmlns*` attributes and left
`xsi:schemaLocation` on the root element. Both sides edited the root's
children, so the root was merged property by property and the attribute
went through as if it were a child element: the output dropped it from
the root tag and wrote `<@_xsi:schemaLocation>…</@_xsi:schemaLocation>`
as the first child — invalid XML, written with a clean exit code.

Every root attribute now goes into the root-attribute bucket, which
`XmlMerger` resolves key by key and the writer renders on the root tag.
Theirs' new `xsi:schemaLocation` wins (only theirs changed it) and both
child edits merge.

Pins:
- `scanDocument` moving every root attribute, not just `xmlns*`, out of
  `content` into the `rootAttributes` bucket.
