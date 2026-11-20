# 90-nested-child-tag-order-cycle

A `CustomObject` carries a `nameField` with the children `label`, `type` and
`displayFormat`. Ours moves `type` before `label`, theirs moves `displayFormat`
before `type`.

Over the three tags both sides moved, the pairwise orders form a cycle: ours
puts `type` before `label`, theirs puts `displayFormat` before `type`, and both
keep `label` before `displayFormat`. No order holds both reorders.

Only the direct children of the metadata root element have a canonical order.
Below it no rule holds: the schema order of a nested element is its own
(`name`, `label`, `locationX` in a Flow), so nothing may settle the cycle and
the element conflicts as one smallest block, each side as written. Resolving to
ours or to theirs gives that side's element exactly. The same cycle among the
children of the root element merges clean: see fixture
`88-profile-child-tag-order-cycle`.

`nameField` is an object without a key, merged property by property, so its
children go through the child-tag order merge; the conflict block comes from
that merge and from no value difference (all three sides carry the same values).

Pins:
- A cycle among the pairwise orders of a nested element's children is a
  conflict, never a canonical order and never a fallback to the ancestor order.
- The block holds the three tags of the cycle; the untouched `label` of the
  `CustomObject` stays outside.
