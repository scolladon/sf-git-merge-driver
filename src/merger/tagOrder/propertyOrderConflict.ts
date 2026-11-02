import type { JsonObject } from '../../types/jsonTypes.js'
import type { MergeResult } from '../../types/mergeResult.js'
import { withConflict } from '../../types/mergeResult.js'
import { buildConflictMarkers } from '../ConflictMarkerBuilder.js'
import type { PropertyOrder } from './mergePropertyOrder.js'

const onlyTags = (side: JsonObject, tags: ReadonlySet<string>): JsonObject =>
  Object.fromEntries(Object.entries(side).filter(([tag]) => tags.has(tag)))

interface ChildSides {
  readonly ancestor: JsonObject | undefined
  readonly local: JsonObject
  readonly other: JsonObject
}

// The tags of a cycle among the sides' reorders, each side as written: no
// merged order can hold them, so they are the smallest block there is
// (ADR 073) and the siblings around them merge on their own.
export const propertyOrderConflict = (
  sides: ChildSides,
  tags: readonly string[]
): MergeResult => {
  const inBlock = new Set(tags)
  const shown = (side: JsonObject = {}): JsonObject => onlyTags(side, inBlock)
  return withConflict([
    buildConflictMarkers(
      shown(sides.local),
      shown(sides.ancestor),
      shown(sides.other)
    ),
  ])
}

// The block standing at a name of the merged order, if it stands for one;
// any other name is a tag that merges on its own.
export const blockAt = (
  merged: PropertyOrder,
  name: string,
  sides: ChildSides
): MergeResult | undefined => {
  const tags = merged.blocks.get(name)
  return tags ? propertyOrderConflict(sides, tags) : undefined
}

// The merge of every name of the merged order: a block conflicts as a whole,
// any other tag is merged by `mergeTag`.
export const mergeTagsInOrder = (
  merged: PropertyOrder,
  sides: ChildSides,
  mergeTag: (tag: string) => MergeResult
): MergeResult[] =>
  merged.order.map(name => blockAt(merged, name, sides) ?? mergeTag(name))
