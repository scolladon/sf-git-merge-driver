// The balance-family messages shared by the scanner and the oracle.
// Text is byte-identical to the previous parser's — MergeDriver turns
// any throw into a merge conflict, so callers never parse the string,
// but the functional parity suite pins it.
export const UNTERMINATED_COMMENT = 'XML parse error: unterminated comment'
export const UNTERMINATED_DECLARATION = 'XML parse error: unterminated <! ... >'
export const UNTERMINATED_PROCESSING_INSTRUCTION =
  'XML parse error: unterminated <? ?>'
export const UNTERMINATED_TAG = 'XML parse error: unterminated tag'

export const unbalancedTags = (finalDepth: number): string =>
  `XML parse error: tags unbalanced (final depth ${finalDepth})`

// Built only on the error path (a close tag that does not match its
// open frame). `gt` is the position of the close tag's own '>' — it is
// never -1 here, because a close tag with no '>' fails as
// UNTERMINATED_TAG before this is reached. Column and line count `xml`
// as written: a CDATA section on the error line moves neither, because
// there is no sentinel rewrite ahead of the scan.
export const unexpectedCloseTag = (xml: string, gt: number): string => {
  const linesBeforeGt = xml.substring(0, gt).split('\n')
  const lastLine = linesBeforeGt[linesBeforeGt.length - 1]
  const line = linesBeforeGt.length - 1
  const column = lastLine.length + 1
  return `Unexpected close tag\nLine: ${line}\nColumn: ${column}\nChar: ${xml[gt]}`
}
