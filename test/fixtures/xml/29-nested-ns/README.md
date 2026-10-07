# 29-nested-ns

§8 row 29: `xmlns` attribute on a non-root element survives
round-trip. Root gets the root-attribute-bucket declaration; nested
element keeps its own `@_xmlns`.
