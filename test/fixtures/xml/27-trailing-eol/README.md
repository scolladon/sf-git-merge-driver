# 27-trailing-eol

§8 row 27: pins the trailing-newline convention. The current
pipeline emits no trailing newline — the file ends exactly at the
closing `>` of the root element. This fixture guards against a
future change that adds (or strips) one silently.

Rationale kept minimal: Salesforce metadata tooling renormalises
whitespace on commit regardless of what we emit here, so the
absolute choice doesn't matter much — what matters is that it
stays stable.
