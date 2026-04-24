# 22-mixed-content

Serializer-only fixture pinning attribute emission on an element that
also carries text content, alongside a namespaced sibling at root.
Guards against regressions in `<tag attr="a">body</tag>` shape and
verifies the namespace attribute lands on the first top-level
element only.
