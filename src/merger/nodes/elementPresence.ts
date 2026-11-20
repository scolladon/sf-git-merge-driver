import type { JsonArray, JsonValue } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { noConflict, withConflict } from '../../types/mergeResult.js'
import { MergeScenario } from '../../types/mergeScenario.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import { getScenario } from '../MergeScenarioFactory.js'
import { sameContent } from '../sameContent.js'

export interface ElementSides {
  readonly ancestor: JsonValue | undefined
  readonly local: JsonValue | undefined
  readonly other: JsonValue | undefined
}

type Handler = (sides: ElementSides, attribute: string) => MergeResult | null

const nothing: Handler = () => noConflict([])
const contentDecides: Handler = () => null

const wrap = (element: JsonValue | undefined, attribute: string): JsonArray => [
  { [attribute]: element as JsonValue },
]

const takeLocal: Handler = ({ local }, attribute) =>
  noConflict(wrap(local, attribute))

const takeOther: Handler = ({ other }, attribute) =>
  noConflict(wrap(other, attribute))

// The side that kept the element wins only when it left it untouched;
// otherwise the deletion and the edit are one block for the whole element.
const deletedBy =
  (survivor: 'local' | 'other'): Handler =>
  (sides, attribute) => {
    const kept = sides[survivor]
    if (sameContent(sides.ancestor, kept)) return noConflict([])
    const keptSide = wrap(kept, attribute)
    const ancestorSide = wrap(sides.ancestor, attribute)
    const [local, other] =
      survivor === 'local' ? [keptSide, []] : [[], keptSide]
    return withConflict([buildConflictMarkers(local, ancestorSide, other)])
  }

const HANDLERS: Record<MergeScenario, Handler> = {
  [MergeScenario.NONE]: nothing,
  [MergeScenario.ANCESTOR_ONLY]: nothing,
  [MergeScenario.LOCAL_ONLY]: takeLocal,
  [MergeScenario.OTHER_ONLY]: takeOther,
  [MergeScenario.LOCAL_AND_OTHER]: contentDecides,
  [MergeScenario.ALL]: contentDecides,
  [MergeScenario.ANCESTOR_AND_LOCAL]: deletedBy('local'),
  [MergeScenario.ANCESTOR_AND_OTHER]: deletedBy('other'),
}

// Presence is an axis of the element, apart from its content: one-sided
// presence is verbatim, delete versus modify is one block for the element.
// null means both live sides carry it and the content decides.
export const mergeElementPresence = (
  sides: ElementSides,
  attribute: string
): MergeResult | null =>
  HANDLERS[getScenario(sides.ancestor, sides.local, sides.other)](
    sides,
    attribute
  )
