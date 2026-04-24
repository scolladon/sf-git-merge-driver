# 19-btb-comments

Back-to-back comments under a parent. Design §2a evaluated this as a
"current pipeline is demonstrably wrong" case (fxb+`correctComments`
regex concatenates them onto the same line as the parent's open tag),
and the decision for this release is **parity**: reproduce the
existing byte sequence so user repos don't churn on first merge.

A follow-up ADR corrects this semantically in a later release with
a deliberate version bump.
