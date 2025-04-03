import { EOL } from 'node:os'
import { isEmpty } from 'lodash-es'
import {
  ANCESTOR_CONFLICT_MARKER,
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
  LOCAL_CONFLICT_MARKER,
  OTHER_CONFLICT_MARKER,
  SEPARATOR,
} from '../constant/conflictConstant.js'
import { TEXT_TAG } from '../constant/parserConstant.js'
import { conflicConfig } from '../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'

const buildMarker = (marker: string, size: number, tag: string): string => {
  return `${marker.repeat(size)} ${tag}`
}

const buildSeparator = (size: number): string => {
  return `${SEPARATOR.repeat(size)}`
}

export class ConflictMarker {
  private static hasConflict = false
  private static baseMarker: string = buildMarker(
    ANCESTOR_CONFLICT_MARKER,
    DEFAULT_CONFLICT_MARKER_SIZE,
    DEFAULT_ANCESTOR_CONFLICT_TAG
  )
  private static localMarker: string = buildMarker(
    LOCAL_CONFLICT_MARKER,
    DEFAULT_CONFLICT_MARKER_SIZE,
    DEFAULT_LOCAL_CONFLICT_TAG
  )
  private static otherMarker: string = buildMarker(
    OTHER_CONFLICT_MARKER,
    DEFAULT_CONFLICT_MARKER_SIZE,
    DEFAULT_OTHER_CONFLICT_TAG
  )
  private static separatorMarker: string = buildSeparator(
    DEFAULT_CONFLICT_MARKER_SIZE
  )

  public static hasConflictMarker(): boolean {
    return ConflictMarker.hasConflict
  }

  public static addConflictMarkers(
    acc: JsonArray,
    local: JsonObject | JsonArray,
    ancestor: JsonObject | JsonArray,
    other: JsonObject | JsonArray
  ): void {
    ConflictMarker.hasConflict = true
    acc.push({ [TEXT_TAG]: `${EOL}${ConflictMarker.localMarker}` })
    acc.push(isEmpty(local) ? { [TEXT_TAG]: EOL } : local)
    acc.push({ [TEXT_TAG]: ConflictMarker.baseMarker })
    acc.push(isEmpty(ancestor) ? { [TEXT_TAG]: EOL } : ancestor)
    acc.push({ [TEXT_TAG]: ConflictMarker.separatorMarker })
    acc.push(isEmpty(other) ? { [TEXT_TAG]: EOL } : other)
    acc.push({ [TEXT_TAG]: ConflictMarker.otherMarker })
  }

  public static setConflictConfig(conflictConfig: conflicConfig): void {
    ConflictMarker.baseMarker = buildMarker(
      ANCESTOR_CONFLICT_MARKER,
      conflictConfig.conflictMarkerSize,
      conflictConfig.ancestorConflictTag
    )
    ConflictMarker.localMarker = buildMarker(
      LOCAL_CONFLICT_MARKER,
      conflictConfig.conflictMarkerSize,
      conflictConfig.localConflictTag
    )
    ConflictMarker.otherMarker = buildMarker(
      OTHER_CONFLICT_MARKER,
      conflictConfig.conflictMarkerSize,
      conflictConfig.otherConflictTag
    )
    ConflictMarker.separatorMarker = buildSeparator(
      conflictConfig.conflictMarkerSize
    )
  }
}
