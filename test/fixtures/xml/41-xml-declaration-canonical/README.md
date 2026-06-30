# 41-xml-declaration-canonical

Residual #1: a non-standard XML declaration (single quotes, lowercase
`utf-8`) is canonicalised to the double-quote / uppercase `UTF-8` form
that `sf project retrieve` emits. This fixture pins that desirable
canonicalisation so it cannot regress silently.
