import {
  ANCESTOR_CONFLICT_MARKER,
  LOCAL_CONFLICT_MARKER,
  OTHER_CONFLICT_MARKER,
  SEPARATOR,
} from '../constant/conflictConstant.js'
import type { MergeConfig } from '../types/conflictTypes.js'

export class ConflictMarkerFormatter {
  private readonly localMarker: string
  private readonly ancestorMarker: string
  private readonly separator: string
  private readonly otherMarker: string
  private readonly localEntity: string
  private readonly otherEntity: string
  private readonly indentRegex: RegExp

  constructor(config: MergeConfig) {
    const size = config.conflictMarkerSize

    this.localMarker = LOCAL_CONFLICT_MARKER.repeat(size)
    this.ancestorMarker = ANCESTOR_CONFLICT_MARKER.repeat(size)
    this.separator = SEPARATOR.repeat(size)
    this.otherMarker = OTHER_CONFLICT_MARKER.repeat(size)

    this.localEntity = '&lt;'.repeat(size)
    this.otherEntity = '&gt;'.repeat(size)

    const escapedMarkers = [
      this.escapeRegex(this.localMarker),
      this.escapeRegex(this.ancestorMarker),
      this.escapeRegex(this.separator),
      this.escapeRegex(this.otherMarker),
    ].join('|')
    this.indentRegex = new RegExp(`[ \\t]+(${escapedMarkers})`, 'g')
  }

  correctConflictIndent(xml: string): string {
    return xml.replace(this.indentRegex, '$1').replace(/^[ \t]*[\n\r]+/gm, '')
  }

  handleSpecialEntities(xml: string): string {
    return xml
      .replaceAll('&amp;#160;', '&#160;')
      .replaceAll(this.localEntity, this.localMarker)
      .replaceAll(this.otherEntity, this.otherMarker)
  }

  private escapeRegex(str: string): string {
    return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
  }
}
