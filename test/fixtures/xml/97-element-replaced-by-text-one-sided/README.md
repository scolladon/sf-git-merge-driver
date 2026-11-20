# 97-element-replaced-by-text-one-sided

A `Profile` element `b` holds a child `toString`. Ours replaces the element by
the text `x`; theirs leaves it unchanged.

Text and an element at one tag are two kinds of value. The change is
one-sided, so ours' text is kept as written. The text is never merged child by
child: read as an object, its characters would be taken for tags and
`String.prototype.toString` for a child named `toString`.

Pins:
- A one-sided change from an element to text is kept verbatim.
- A text value is never read for properties.
