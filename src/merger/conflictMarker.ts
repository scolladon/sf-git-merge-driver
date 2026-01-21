import { isEmpty } from 'lodash-es'
import {
  ANCESTOR_CONFLICT_MARKER,
  LOCAL_CONFLICT_MARKER,
  OTHER_CONFLICT_MARKER,
  SEPARATOR,
} from '../constant/conflictConstant.js'
import { SALESFORCE_EOL } from '../constant/metadataConstant.js'
import { TEXT_TAG } from '../constant/parserConstant.js'
import { conflicConfig } from '../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'

const buildMarker = (marker: string, size: number, tag: string): string => {
  return `${marker.repeat(size)} ${tag}`
}

const buildSeparator = (size: number): string => {
  return `${SEPARATOR.repeat(size)}`
}

const getEmptyValue = (): JsonArray => {
  return [{ [TEXT_TAG]: SALESFORCE_EOL }]
}

const getMarkerValue = (
  marker: string,
  withEol: boolean = false
): JsonObject => {
  return { [TEXT_TAG]: `${withEol ? SALESFORCE_EOL : ''}${marker}` }
}

export class ConflictMarker {
  private static hasConflict = false
  private static baseMarker: string
  private static localMarker: string
  private static otherMarker: string
  private static separatorMarker: string

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
    const [localValue, ancestorValue, otherValue] = [
      local,
      ancestor,
      other,
    ].map(value => (isEmpty(value) ? getEmptyValue() : [value].flat()))

    acc.push(getMarkerValue(ConflictMarker.localMarker, true))
    acc.push(...localValue)
    acc.push(getMarkerValue(ConflictMarker.baseMarker))
    acc.push(...ancestorValue)
    acc.push(getMarkerValue(ConflictMarker.separatorMarker))
    acc.push(...otherValue)
    acc.push(getMarkerValue(ConflictMarker.otherMarker))
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
