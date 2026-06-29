# 40-empty-self-closing-root

Residual #3: an identity three-way merge of an empty self-closing root
(`<SharingRules xmlns="..."/>`) must preserve the root, not blank the
file. The compact body of an empty root is `''` and the JSON merge
collapses it to no output; XmlMerger reconstructs the root so the writer
emits the canonical empty element `<SharingRules .../>` (self-closing,
matching `sf project retrieve`) with the trailing newline — byte-identical
to the self-closing input.
