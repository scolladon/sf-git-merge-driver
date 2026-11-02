import type { NormalisedParseResult } from '../adapter/XmlParser.js'
import { type MergeResult, withConflict } from '../types/mergeResult.js'
import {
  jsonEqual,
  jsonIdenticalUpToAttributeOrder,
} from '../utils/jsonEqual.js'
import { buildConflictMarkers } from './ConflictMarkerBuilder.js'

// A side holds a document when it has a root element: a side without one
// dropped the file.
const holdsDocument = (side: NormalisedParseResult): boolean =>
  Object.keys(side.content).length > 0

// The order of attributes is no change, as in any other merge; the order of
// child tags is, since the writer follows it.
const isSameDocument = (
  left: NormalisedParseResult,
  right: NormalisedParseResult
): boolean =>
  jsonIdenticalUpToAttributeOrder(left.content, right.content) &&
  jsonEqual(left.rootAttributes, right.rootAttributes)

const editsDocument = (
  ancestor: NormalisedParseResult,
  side: NormalisedParseResult
): boolean => holdsDocument(side) && !isSameDocument(ancestor, side)

// A deletion against any change of the document, its body or its root
// attributes, is not a change the other side can absorb: the sides cannot
// both stand. A deletion against an unchanged file, or against another
// deletion, stays a deletion, and a file no ancestor held is only added.
export const isDeleteVersusEdit = (
  ancestor: NormalisedParseResult,
  local: NormalisedParseResult,
  other: NormalisedParseResult
): boolean =>
  holdsDocument(ancestor) &&
  ((!holdsDocument(local) && editsDocument(ancestor, other)) ||
    (!holdsDocument(other) && editsDocument(ancestor, local)))

export const wholeFileConflict = (
  ancestor: NormalisedParseResult,
  local: NormalisedParseResult,
  other: NormalisedParseResult
): MergeResult =>
  withConflict([
    buildConflictMarkers(local.content, ancestor.content, other.content),
  ])
