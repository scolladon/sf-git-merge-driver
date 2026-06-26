# 27-trailing-eol

§8 row 27: pins the trailing-newline convention. The writer emits a
single trailing newline so the file ends with `</Root>\n`, converging
with the byte shape `sf project retrieve` writes (Salesforce metadata
XML files end in a newline). This fixture guards against a future
change that strips it — or emits a second one — silently.

History: the 1.9.0 pipeline emitted **no** trailing newline; that was
corrected as part of the canonical-XML residual fixes so the merge
driver no longer diverges from Salesforce's retrieved byte output.
