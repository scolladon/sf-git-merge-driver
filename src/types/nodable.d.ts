// Type shim: @nodable/compact-builder's bundled d.ts declares
// CompactBuilder as an interface, but the JS runtime exports it as a
// class. Augment the module so TypeScript lets us `extends` it.
declare module '@nodable/compact-builder' {
  export class CompactBuilder {
    constructor(
      parserOptions: unknown,
      builderOptions: unknown,
      valParsers: unknown,
      readonlyMatcher: unknown
    )
    readonly tagsStack: unknown[]
    readonly options: {
      readonly attributes: { readonly prefix: string; readonly suffix: string }
    }
    addElement(tag: { name: string }, matcher?: unknown): void
    closeElement(matcher?: unknown): void
    addValue(text: string, matcher?: unknown): void
    addAttribute(name: string, value: unknown, matcher?: unknown): void
    addComment(text: string): void
    addLiteral(text: string): void
    addDeclaration(): void
    addInstruction(name: string): void
    addInputEntities(entities: object): void
    getOutput(): unknown
    _addChild(key: string, val: unknown): void
    value: unknown
  }

  export class CompactBuilderFactory {
    constructor(options?: unknown)
    getInstance(
      parserOptions: unknown,
      readonlyMatcher: unknown
    ): CompactBuilder
    registerValueParser(name: string, parser: unknown): void
    resetValueParsers(): void
  }

  const _default: typeof CompactBuilderFactory
  export default _default
}
