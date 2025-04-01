import { isEmpty } from 'lodash-es'
import {
  BASE,
  LOCAL,
  NEWLINE,
  REMOTE,
  SEPARATOR,
  TEXT_TAG,
} from '../constant/conflicConstant.js'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'

export class ConflictMarker {
  private static hasConflict = false

  public static hasConflictMarker(): boolean {
    return ConflictMarker.hasConflict
  }

  public static addConflictMarkers(
    acc: JsonArray,
    ours: JsonObject | JsonArray,
    ancestor: JsonObject | JsonArray,
    theirs: JsonObject | JsonArray
  ): void {
    ConflictMarker.hasConflict = true
    acc.push({ [TEXT_TAG]: `${NEWLINE}${LOCAL}` })
    acc.push(isEmpty(ours) ? { [TEXT_TAG]: NEWLINE } : ours)
    acc.push({ [TEXT_TAG]: BASE })
    acc.push(isEmpty(ancestor) ? { [TEXT_TAG]: NEWLINE } : ancestor)
    acc.push({ [TEXT_TAG]: SEPARATOR })
    acc.push(isEmpty(theirs) ? { [TEXT_TAG]: NEWLINE } : theirs)
    acc.push({ [TEXT_TAG]: REMOTE })
  }
}
