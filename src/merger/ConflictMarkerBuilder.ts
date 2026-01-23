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

export const buildConflictMarkers = (
  config: MergeConfig,
  local: JsonObject | JsonArray,
  ancestor: JsonObject | JsonArray,
  other: JsonObject | JsonArray
): JsonArray => {
  const localMarker = buildMarker(
    LOCAL_CONFLICT_MARKER,
    config.conflictMarkerSize,
    config.localConflictTag
  )
  const baseMarker = buildMarker(
    ANCESTOR_CONFLICT_MARKER,
    config.conflictMarkerSize,
    config.ancestorConflictTag
  )
  const otherMarker = buildMarker(
    OTHER_CONFLICT_MARKER,
    config.conflictMarkerSize,
    config.otherConflictTag
  )
  const separatorMarker = buildSeparator(config.conflictMarkerSize)

  const [localValue, ancestorValue, otherValue] = [local, ancestor, other].map(
    value => (isEmpty(value) ? getEmptyValue() : value)
  )

  return [
    getMarkerValue(localMarker, true),
    localValue,
    getMarkerValue(baseMarker),
    ancestorValue,
    getMarkerValue(separatorMarker),
    otherValue,
    getMarkerValue(otherMarker),
  ]
}
