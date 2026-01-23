import { isEmpty } from 'lodash-es'
import {
  ANCESTOR_CONFLICT_MARKER,
  LOCAL_CONFLICT_MARKER,
  OTHER_CONFLICT_MARKER,
  SEPARATOR,
} from '../constant/conflictConstant.js'
import { SALESFORCE_EOL } from '../constant/metadataConstant.js'
import { TEXT_TAG } from '../constant/parserConstant.js'
import type { MergeConfig } from '../types/conflictTypes.js'
import type { JsonArray, JsonObject } from '../types/jsonTypes.js'

const buildMarker = (marker: string, size: number, tag: string): string => {
  return `${marker.repeat(size)} ${tag}`
}

const buildSeparator = (size: number): string => {
  return `${SEPARATOR.repeat(size)}`
}

const getEmptyValue = (): JsonObject => {
  return { [TEXT_TAG]: SALESFORCE_EOL }
}

const getMarkerValue = (
  marker: string,
  withEol: boolean = false
): JsonObject => {
  return { [TEXT_TAG]: `${withEol ? SALESFORCE_EOL : ''}${marker}` }
}

export class ConflictMarker {
  private hasConflict = false
  private readonly baseMarker: string
  private readonly localMarker: string
  private readonly otherMarker: string
  private readonly separatorMarker: string

  constructor(config: MergeConfig) {
    this.localMarker = buildMarker(
      LOCAL_CONFLICT_MARKER,
      config.conflictMarkerSize,
      config.localConflictTag
    )
    this.baseMarker = buildMarker(
      ANCESTOR_CONFLICT_MARKER,
      config.conflictMarkerSize,
      config.ancestorConflictTag
    )
    this.otherMarker = buildMarker(
      OTHER_CONFLICT_MARKER,
      config.conflictMarkerSize,
      config.otherConflictTag
    )
    this.separatorMarker = buildSeparator(config.conflictMarkerSize)
  }

  public hasConflictMarker(): boolean {
    return this.hasConflict
  }

  public addConflictMarkers(
    acc: JsonArray,
    local: JsonObject | JsonArray,
    ancestor: JsonObject | JsonArray,
    other: JsonObject | JsonArray
  ): void {
    this.hasConflict = true
    const [localValue, ancestorValue, otherValue] = [
      local,
      ancestor,
      other,
    ].map(value => (isEmpty(value) ? getEmptyValue() : value))

    acc.push(getMarkerValue(this.localMarker, true))
    acc.push(localValue)
    acc.push(getMarkerValue(this.baseMarker))
    acc.push(ancestorValue)
    acc.push(getMarkerValue(this.separatorMarker))
    acc.push(otherValue)
    acc.push(getMarkerValue(this.otherMarker))
  }
}
