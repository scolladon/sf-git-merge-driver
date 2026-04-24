# 11-comments

Non-conflicting three-way merge of a document that contains a top-level
XML comment. Ours bumps `<v>` from `base` to `ours`; theirs unchanged.
Pins comment emission under the streaming writer (inline, no leading
whitespace, regardless of what the source contained).
