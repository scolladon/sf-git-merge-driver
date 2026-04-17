export const DEFAULT_CONFLICT_MARKER_SIZE = 7
// Cap prevents pathological -L values (e.g. 2^31-1) from triggering RangeError
// via String.repeat() and from blowing up generated regex/output size.
export const MAX_CONFLICT_MARKER_SIZE = 100
export const ANCESTOR_CONFLICT_MARKER = '|'
export const LOCAL_CONFLICT_MARKER = '<'
export const OTHER_CONFLICT_MARKER = '>'
export const DEFAULT_ANCESTOR_CONFLICT_TAG = 'base'
export const DEFAULT_LOCAL_CONFLICT_TAG = 'ours'
export const DEFAULT_OTHER_CONFLICT_TAG = 'theirs'
export const SEPARATOR = '='
