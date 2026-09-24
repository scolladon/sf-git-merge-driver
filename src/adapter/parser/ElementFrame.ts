import type { JsonObject, JsonValue } from '../../types/jsonTypes.js'

const ATTR_PREFIX = '@_'
const TEXT_KEY = '#text'

export type ElementAttrs = Readonly<Record<string, string | null>>

// Per-open-element accumulator the scanner pushes on `<name` and pops
// on the matching close, replacing the previous parser's TNode DOM.
// `grouped` stays undefined until the first element, comment or CDATA
// child arrives — a leaf (the common case in Salesforce metadata) never
// allocates it (design rule 6, P6's eager-Map prototype missed the gate).
export class ElementFrame {
  readonly name: string
  private readonly attrs: ElementAttrs
  private readonly hasAttrs: boolean
  childCount = 0
  private textBuf = ''
  grouped: Map<string, JsonValue[]> | undefined

  constructor(name: string, attrs: ElementAttrs, hasAttrs: boolean) {
    this.name = name
    this.attrs = attrs
    this.hasAttrs = hasAttrs
  }

  addText(text: string): void {
    this.textBuf += text
  }

  addChild(key: string, value: JsonValue): void {
    this.childCount++
    if (this.grouped === undefined) this.grouped = new Map()
    const existing = this.grouped.get(key)
    if (existing === undefined) {
      this.grouped.set(key, [value])
    } else {
      existing.push(value)
    }
  }

  toCompact(): JsonValue {
    if (!this.hasAttrs && this.grouped === undefined) return this.textBuf
    const out: JsonObject = Object.create(null)
    for (const k in this.attrs) out[`${ATTR_PREFIX}${k}`] = this.attrs[k]
    this.writeGroupedInto(out)
    if (this.textBuf !== '') {
      out[TEXT_KEY] = this.textBuf
    } else if (this.childCount === 0) {
      out[TEXT_KEY] = ''
    }
    return out
  }

  private writeGroupedInto(out: JsonObject): void {
    if (this.grouped === undefined) return
    for (const [tag, values] of this.grouped) {
      out[tag] = values.length === 1 ? values[0]! : values
    }
  }
}
