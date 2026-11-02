# 98-marker-like-text-line-in-conflict

A `Profile` description is `a`. Ours rewrites it to a text whose second line is
`=======` and third line is `>>>>>>> theirs`; theirs changes it to `c`.

The two changes conflict, and ours' side holds text lines that read as
conflict markers. Inside a conflict, the first character of such a line is
written as a numeric character reference (`&#61;======`, `&#62;>>>>>>`), which
XML reads as the same text, so the only marker lines left are the real ones.
Outside a conflict the same text is written untouched.

Pins:
- A text line inside a conflict side that starts with a marker sequence is escaped.
- The escape is a character reference of the first character only.
