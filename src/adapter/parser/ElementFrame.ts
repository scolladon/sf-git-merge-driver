import { ATTR_PREFIX, TEXT_TAG } from '../../constant/parserConstant.js'
import type { JsonObject, JsonValue } from '../../types/jsonTypes.js'

type ElementAttrs = Readonly<Record<string, string | null>>

// `hasAttrs` travels with the bag so the frame never recounts keys.
export interface AttrSet {
  readonly attrs: ElementAttrs
  readonly hasAttrs: boolean
}

// Stryker disable next-line ObjectLiteral: an empty bag reads as no attributes: for-in over undefined is a no-op
export const NO_ATTRS: AttrSet = Object.freeze({
  attrs: Object.freeze(Object.create(null)),
  hasAttrs: false,
})

// Per-open-element accumulator the scanner pushes on `<name` and pops
// on the matching close. `body` stays undefined until the first
// element, comment or CDATA child arrives, so a leaf — the dominant
// node shape in Salesforce metadata — never allocates an object.
export class ElementFrame {
  readonly name: string
  private readonly attrs: ElementAttrs
  private readonly hasAttrs: boolean
  private textBuf = ''
  private body: JsonObject | undefined

  constructor(name: string, { attrs, hasAttrs }: AttrSet) {
    this.name = name
    this.attrs = attrs
    this.hasAttrs = hasAttrs
  }

  addText(text: string): void {
    this.textBuf += text
  }

  addChild(key: string, value: JsonValue): void {
    const body = this.body ?? this.openBody()
    const held = body[key]
    if (held === undefined) {
      body[key] = value
    } else if (Array.isArray(held)) {
      held.push(value)
    } else {
      body[key] = [held, value]
    }
  }

  toCompact(): JsonValue {
    const body = this.body
    if (body === undefined) {
      return this.hasAttrs ? this.attrsAndText() : this.textBuf
    }
    if (this.textBuf !== '') body[TEXT_TAG] = this.textBuf
    return body
  }

  // An element with attributes but no children still carries `#text: ''`.
  private attrsAndText(): JsonObject {
    const body = this.openBody()
    body[TEXT_TAG] = this.textBuf
    return body
  }

  // Attributes first, so the children's keys follow them in first-seen order
  private openBody(): JsonObject {
    const body: JsonObject = Object.create(null)
    for (const k in this.attrs) body[`${ATTR_PREFIX}${k}`] = this.attrs[k]
    this.body = body
    return body
  }
}
