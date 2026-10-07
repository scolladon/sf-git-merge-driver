# 66-custom-metadata-untouched-values-sibling-edit

Ours edits only `<label>`; theirs leaves the record untouched. The `values`
entries (two `xsd:string`, one `xsi:nil`) are identical on all three sides.

Before the fix A and B were lost and C was written three times, although
nobody touched `values`.

The untouched entries now come out byte-identical to the ancestor and the
label edit applies.

Pins:
- Byte equality of untouched `xsi:*` entries through parser and writer.
