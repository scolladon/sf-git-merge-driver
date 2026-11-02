# 95-nested-attribute-changed-differently

A `Profile` carries a `description` element with the attributes `a` and `b`.
Ours changes `a` to `1`, theirs changes it to `2`.

A nested element that carries attributes is merged as one value: its
attributes and its content are not split apart. Two different values of one
attribute therefore conflict as the whole element, each side as written, and
neither side is dropped. Rendering the start tag alone as the conflict, as the
root element does (fixture `94-root-attribute-changed-differently`), would
need the element's attributes and children merged apart; the whole-element
conflict is the safe form.

Pins:
- Different values of one attribute of a nested element conflict.
- The conflict holds the whole element on each side.
