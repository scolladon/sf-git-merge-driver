# Implementation plan — Streaming XML pipeline

> Status: **plan v4 (final — addressing review pass 3 polish findings)**.
> Branch: `refactor/custom-xml-writer`.
> Companion: `2026-04-23-streaming-xml-pipeline-design.md` (design v4).
>
> Scope: implement the streaming parse + serialize pipeline specified in
> the design. This plan sequences the work into phased, reversible
> steps, each independently testable and mergeable.
>
> **v1 → v2 structural changes (review pass 1):**
> - Removed the `useStreamingXml` flag (contradicted design §11). New
>   code lives alongside old at the **module boundary** not behind a
>   runtime config. Phased rollout is now by **delete-old-in-cutover-PR**,
>   not flag-flip.
> - Phase 0 now tags each fixture dir with a `parity.json` declaring
>   `parity` vs `divergence` mode; the self-parity test is replaced by a
>   curated-review gate (v1 self-parity was circular).
> - Phase 2 now follows phase 1 (not parallel) — round-trip gate in
>   phase 2 depends on the new parser from phase 1.
> - `XmlMerger` gets **two explicit named methods**: the existing
>   `mergeThreeWay` (strings, sync, unchanged through phase 5) stays,
>   and a new `mergeStreams` (Readable/Writable, async) is added. No
>   overload. Phase 6 deletes `mergeThreeWay` and renames
>   `mergeStreams` onto the canonical `mergeThreeWay` name.
> - Benchmark gates switched from RSS-sampled hard thresholds to
>   `heapUsed` + reviewer sign-off (RSS is noisy and non-monotonic).
> - Phase 6 gate made concrete: "14 days on main, clean daily NUT,
>   zero `streaming-xml` issues" — replaces unbounded "one release
>   cycle".
> - Added explicit enumeration of every §8 fixture ID, every indent-*
>   ID, every divergence ID, every error-path ID. Added upstream-
>   ordering test, CDATA-`]]>`-merge round-trip, POSIX-only fd-leak
>   caveat, NBSP fixture.
>
> **v2 → v3 fixes (review pass 2):**
> - §10 step 3 rewritten as atomic deletion of
>   `ConflictMarkerFormatter.ts` (no mid-sentence "wait —" reasoning).
> - `fdCounter` POSIX strategy corrected: `/dev/fd` primary
>   (Darwin + Linux), `/proc/self/fd` fallback, Windows skipped.
> - Observability line scoped to `v=__VERSION__` (already injected by
>   `tooling/build-bin.mjs`); commit-SHA injection dropped to avoid
>   phase-4 scope creep.
> - §11 row 19 label cleaned: "§2a evaluated, decision = parity" —
>   no ambiguous "divergence" word when mode is parity.
> - §10 steps 5 & 6 now explicitly decide class/file naming: keep
>   `StreamingXmlParser` and `XmlStreamWriter` names
>   (implementations of the canonical `XmlParser` / `XmlSerializer`
>   ports). No renames occur in phase 6.
> - v1→v2 change-log claim corrected: the two-method pair is
>   `mergeThreeWay` (existing) + `mergeStreams` (new), not
>   `mergeStrings`/`mergeStreams`.
>
> **v3 → v4 polish (review pass 3):**
> - `parity.json` validation pinned to a Zod schema in
>   `test/utils/goldenFile.ts` (§3.5).
> - `__VERSION__` log line pinned to the binary entry path with a
>   guard for unit-test context (§8).
> - `ParsedXml` → `NormalisedParseResult` type-rename sweep added
>   to §15 acceptance checklist.

---

## 1. Summary of the work

Six modules to add, three to modify, one dependency to remove. Phased
over six PR-sized steps so each step ships a green `main` and can be
rolled back independently.

| Phase | Deliverable | Mergeable independently? |
|---|---|---|
| 0 | Fixture harness; curated golden files with `parity`/`divergence` tagging | Yes (tests only) |
| 1 | `NormalisingOutputBuilder` + `StreamingXmlParser` — new code, no wiring into `MergeDriver` yet | Yes |
| 2 | Writer stack (`XmlEmitter` → `IndentationFormatter` → `ConflictIndentFormatter` → `EolTransform` → `XmlStreamWriter`) — new code, no wiring yet | Yes |
| 3 | `XmlMerger.mergeStreams` (new method) side-by-side with existing `mergeThreeWay`. Exercised only by dedicated tests. | Yes |
| 4 | `MergeDriver` cutover: single PR that flips production path to streams, rename-for-atomic, peek-EOL. Old `FlxXmlParser`/`FxpXmlSerializer` still on disk, unused. | Yes — this is the live-traffic cutover |
| 5 | Soak period: 14 days on main with clean daily NUT + zero tagged issues. No code changes. | — (observation phase) |
| 6 | Deletion: remove old parser, serializer, `fast-xml-builder`, `handleSpecialEntities`, the original `correctConflictIndent`, and rename the new classes onto the canonical names. | Yes — cleanup |

**No runtime flag.** Design §11 OQ2 decided against one. The
phased-rollout property we still need (ability to test both paths in
parallel) is preserved by keeping the old classes compiled, callable,
and test-exercised until phase 6 — but they are not called from
production code after phase 4.

---

## 2. TDD methodology

Every phase follows **Red → Green → Refactor** on each unit:

1. Write the smallest failing test that pins the behaviour.
2. Implement the minimum code to pass the test.
3. Refactor for clarity, not scope.

**Test shapes used:**

- **Unit tests** (`test/unit/adapter/**/*.test.ts`): Given/When/Then
  titles, AAA body, `sut` variable. `vitest` runner.
- **Golden-file parity tests** (`test/unit/adapter/parity/**/*.test.ts`):
  run the new pipeline on a fixture, assert byte equality with the
  fixture's `expected.xml`. Each fixture dir carries a `parity.json`
  with `{ mode: "parity" }` or
  `{ mode: "divergence", against: "current-pipeline", adr: "..." }`.
  Parity-mode fixtures must match current pipeline bytes AND new
  pipeline bytes. Divergence-mode fixtures must match new pipeline
  bytes and differ from current pipeline bytes by the documented
  amount (the divergence test explicitly asserts the difference).
- **Integration tests** (`test/integration/*.test.ts`): real pipeline,
  no mocks.
- **NUT tests** (`test/integration/*.nut.ts`): CLI-level merges of
  actual Salesforce metadata, no mocks.
- **Mutation tests** (Stryker): per-module, incremental.

**Coverage discipline.** Project-level gate: 100 % branches / functions /
lines / statements (`vitest.config.ts` thresholds). **Per-PR gate
softened**: new code ≥ 95 % branch coverage; repo-level 100 % must be
restored by the phase-closing commit. This avoids the anti-pattern
where a phase-2 PR that adds production code but defers its caller
wiring until phase 3 blocks on coverage thresholds for error paths
that are not yet callable. **No `v8 ignore` pragmas** — per
CLAUDE.md memory rule.

### 2.1 Streaming testability budget

Half a day per phase is explicitly allocated to the test helpers
required for streaming coverage:

- `test/utils/throttledWritable.ts` — `Writable` that returns `false`
  from every `write()` until an explicit `drain()` call, for
  back-pressure branch coverage.
- `test/utils/faultyReadable.ts` — `Readable` that emits a configurable
  number of good chunks then errors, for mid-stream error branches.
- `test/utils/fdCounter.ts` — wraps `createReadStream` and tracks open
  FDs. **POSIX strategy:** primary `/dev/fd` (works on both macOS and
  Linux — the project is developed on Darwin per the env banner, and
  `/proc` does not exist there); fall back to `/proc/self/fd` only if
  `/dev/fd` is not readable. **Windows:** the test declares
  `test.skipIf(process.platform === 'win32')` — handle-count tooling
  on Windows requires out-of-tree binaries (`handle.exe`) we do not
  ship. Design §11.4 already marks this gate POSIX-only.
- `test/utils/chunkCarver.ts` — helper that feeds a deterministic
  chunk-boundary sequence into a `Transform`, for `EolTransform`'s
  `\r`+`\n`-across-chunks branch.

These helpers are written before the module tests that need them.

---

## 3. Phase 0 — Fixture harness (½ day)

**Goal:** capture current pipeline bytes for every §8 fixture, tag each
dir's mode, commit. The golden files become the contract the new
pipeline must satisfy (parity mode) or deliberately violate (divergence
mode, documented).

### 3.1 Fixture directories

Create `test/fixtures/xml/` with one subdirectory per inventory entry:

| Dir | §8 row | Design §2a? |
|---|---|---|
| `01-root-ns` | 1 | no |
| `02-no-ns` | 2 | no |
| `03-conflict` | 3 | no |
| `04-conflict-empty-local` | 4 | no |
| `05-conflict-empty-arrays` | 5 | no |
| `06-conflict-direct-prop` | 6 | no |
| `07-conflict-nested` | 7 | no |
| `08-nested-elements` | 8 | no |
| `09-null-text` | 9 | no |
| `10-scalar-array` | 10 | no |
| `11-comments` | 11 | no |
| `12-cdata` | 12 | no |
| `13-empty-output` | 13 | no |
| `14-empty-namespaces` | 14 | no |
| `15-cdata-closing` | 15 | no |
| `16-comment-double-dash` | 16 | no |
| `17-marker-size-variant` | 17 | no |
| `18-nbsp-entity` | 18+32 | no (F-ENT-1 removes dead code, output unchanged) |
| `19-btb-comments` | 19 | §2a evaluated, decision = parity (parity.json mode = parity) |
| `20-empty-element` | 20 | no |
| `21-crlf-input` | 21 | no |
| `22-mixed-content` | 22 | no |
| `23-attr-order` | 23 | no |
| `24-err-mid-parse` | 24 | no |
| `25-err-mid-write` | 25 | no |
| `26-bom` | 26 | no |
| `27-trailing-eol` | 27 | no |
| `28-large-text` | 28 | no |
| `29-nested-ns` | 29 | no |
| `30-crlf-markers` | 30 | no |
| `31-ns-order` | 31 | no |
| `32-nbsp-literal` | (folded into 18) | no |
| `33-literal-lt` | 33 | no |

Plus the seven indent byte-examples from design §6.3.2:

| Dir | Case |
|---|---|
| `indent-01-leaf` | `<leaf>text</leaf>` |
| `indent-02-comment-only` | `<p><!--c--></p>` |
| `indent-03-btb-comments` | `<p><!--c1--><!--c2--></p>` |
| `indent-04-cdata-last` | `<p><![CDATA[x]]></p>` |
| `indent-05-elem-text` | `<p><b>x</b>bye</p>` |
| `indent-06-text-elem` | `<p>hi<b>x</b></p>` |
| `indent-07-elem-elem` | `<p><a/><b/></p>` |

### 3.2 Fixture layout

Each directory contains:

```
ancestor.xml        # three-way-merge inputs
ours.xml
theirs.xml
expected.xml        # golden output (hand-reviewed)
parity.json         # { "mode": "parity" } | { "mode": "divergence", "against": "...", "adr": "..." }
README.md           # one paragraph: what does this fixture pin?
```

For pure-serializer cases (no merge required, e.g. the `indent-*` set),
`ordered-input.json` replaces the three input xmls and `ours.xml` is
absent.

### 3.3 Generation + curation workflow

1. Write a one-off script `tooling/capture-fixtures.mjs` that runs the
   current pipeline on every fixture dir's inputs and writes
   `_captured.xml` (prefix `_` so it's never confused with the golden).
2. **Hand-review** each `_captured.xml` and either:
   - rename to `expected.xml` with `parity.json: {mode: "parity"}`, or
   - rename to `expected.xml` with `parity.json: {mode: "divergence", ...}`
     IF the captured bytes embody a known-wrong behaviour we have
     **decided** to preserve (per design §2a). In that case, also
     check in `expected-new.xml` with the corrected bytes, which the
     divergence test asserts the new pipeline produces.
3. Commit fixture dirs + harness in a single PR. This PR requires
   explicit reviewer sign-off per fixture; the review's purpose is
   to catch cases where a fixture captured a latent bug.
4. Delete `tooling/capture-fixtures.mjs` (one-off).

### 3.4 Harness

`test/utils/goldenFile.ts`:

```ts
export interface Fixture {
  dir: string
  parity: { mode: 'parity' } | { mode: 'divergence', against: string, adr: string }
  inputs: { ancestor?: string; ours?: string; theirs?: string; ordered?: JsonArray; namespaces?: JsonObject }
  expectedCurrent: string      // bytes the CURRENT pipeline produces
  expectedNew?: string         // (divergence-only) bytes the NEW pipeline produces
}
export function loadFixture(dir: string): Fixture
export function listFixtures(): Fixture[]
```

### 3.5 Phase 0 tests

- `test/unit/adapter/parity/harness.test.ts`: every fixture is
  loadable; every `parity.json` validates against a **Zod schema
  defined in `test/utils/goldenFile.ts`** — schema declares the
  exact discriminated union
  `z.discriminatedUnion('mode', [z.object({mode:z.literal('parity')}),
  z.object({mode:z.literal('divergence'), against:z.string(),
  adr:z.string()})])`.
  Divergence-mode fixtures must include `expected-new.xml`; every
  parity-mode fixture's `expected.xml` must be non-empty and start
  with a valid XML declaration.
- **No parity test yet** — the new pipeline doesn't exist. The parity
  assertions land with phases 1–4 as the new code arrives.

**Exit criteria:** fixtures committed and curated. Reviewer sign-off on
every `parity.json` decision.

**Commit:** `test(parity): fixture harness + curated golden files for design §8 + §6.3.2 cases`.

---

## 4. Phase 1 — Streaming parser (1.5 days)

**Goal:** new parser produces a tree `deepEqual` to the old parser's
output on every parity fixture, via `parseString` and `parseStream`.
Old `FlxXmlParser` untouched.

### 4.1 `NormalisingOutputBuilder` + Factory

- Red: unit test asserting `{ content, namespaces }` shape on fixture
  `01-root-ns`.
- Green: subclass `BaseOutputBuilder` per design §6.1. Override hooks
  `addAttribute` (filter rules 1–3), `addValue` (empty-text-next-to-CDATA),
  plus `build()` to return the `{ content, namespaces }` shape. Inherit
  `addComment`, `addLiteral`, `_addChild`, `addInstruction`, `onExit`.
- Refactor: attribute-filter rules extracted as a private pure function.
- Additional tests (one test per):
  - `version` / `encoding` dropped at root (pins upstream ordering).
  - `version` / `encoding` dropped at depth > 0 (any-depth rule).
  - `xmlns*` on root → `namespaces` bucket.
  - `xmlns*` on non-root → element attribute.
  - Empty `#text` next to CDATA dropped.
  - CDATA with `]]>` preserved as array of segments.
- Factory: `getInstance(parserOptions, matcher)` returns a builder;
  factory is stateless.

### 4.2 Upstream-ordering invariant test

Design §6.1 requires pinning the upstream contract. Write
`test/unit/adapter/upstreamOrdering.test.ts`:

```ts
it('fires addAttribute(version) while tagName === _rootName', () => {
  // Hand-instantiate NormalisingOutputBuilder; feed it a scripted
  // call sequence mimicking the parser on '<?xml version="1.0"?>';
  // assert the builder's internal tagName is the sentinel '^'
  // at the moment addAttribute fires.
})
```

If upstream `@nodable/flexible-xml-parser` ever reorders decl handling,
this test breaks loud instead of silently letting `version` leak onto
the first element.

### 4.3 `StreamingXmlParser`

- Red: `parseString(fixture)` deepEqual old parser on every parity fixture.
- Green: per design §6.2 (new `FlxParser` instance per call).
- Red: `parseStream(createReadStream(path))` deepEqual
  `parseString(readFileSync(path))` on every parity fixture.
- Green: add `parseStream`.
- Red: reentrancy test (design §6.2):
  - three concurrent `parseStream` calls on three different streams
    all resolve with correct trees;
  - a single FlxParser instance used for two concurrent parses raises
    `ALREADY_STREAMING`.

**Exit criteria:** both methods green on every parity fixture; repo
coverage back to 100 %; no change to `FlxXmlParser`, `XmlMerger`, or
`MergeDriver`.

**Commit:** `feat(parser): StreamingXmlParser + NormalisingOutputBuilder`.

---

## 5. Phase 2 — Writer stack (3 days)

**Goal:** new writer produces byte-equal output to the current pipeline
on every parity fixture (and the documented new bytes on every
divergence fixture). Old `FxpXmlSerializer` untouched.

Dependencies: **phase 1 must be merged** (round-trip tests in §5.7
need `StreamingXmlParser`).

Five units, bottom-up. Each gets its own file, its own tests, and is
independently mutation-tested before the next.

### 5.1 `XmlEmitter` (½ day)

Chunks per design §6.3.1. Tests exhaustive over chunk kinds:
- `decl` → `<?xml version="1.0" encoding="UTF-8"?>\n`
- `open` with no attrs / with attrs / with namespace bucket.
- `close`.
- `text` raw.
- `cdata` single-segment / multi-segment (join with `]]]]><![CDATA[>`).
- `comment` with `--`, trailing `-`, normal text.

Mutation pass: `stryker` on `XmlEmitter.ts` alone.

### 5.2 `IndentationFormatter` (½ day)

Every rule in design §6.3.2 gets its own test. The seven
indent-* fixtures from §6.3.2 each assert byte-exact output.

Mutation pass.

### 5.3 `ConflictIndentFormatter` (½ day)

Every state-machine branch in design §6.3.3 gets its own test:
- pass 1 (indent before marker stripped),
- pass 2 (blank line dropped),
- pass 1 then pass 2 composition,
- trailing unterminated line (flush),
- the worked example from §6.3.3 produces the documented output.

Mutation pass.

### 5.4 `EolTransform` (¼ day)

- LF passthrough.
- CRLF rewrite.
- `\r\n` in source is idempotent (not re-rewritten to `\r\r\n`).
- `\r` at end of chunk N, `\n` at start of chunk N+1 handled
  correctly (uses `chunkCarver` test helper from §2.1).

Mutation pass.

### 5.5 `XmlStreamWriter` (½ day)

- Red: `writeTo(sink, ordered, ns)` writes expected bytes for every
  parity fixture that is pre-reducible to ordered form
  (phase 2 gate — does NOT require the merger).
- Red: back-pressure — `throttledWritable` returning `false`; writer
  awaits drain.
- Red: sink `destroy(new Error)` mid-write — writer rejects.
- Green: per design §6.3.5 (single `writeTo` API).

### 5.6 `serializeToString` test helper (¼ day)

`test/utils/serializeToString.ts` wraps `writeTo(PassThrough)` and
concats chunks. Used by parity assertions.

### 5.7 Round-trip idempotence (½ day)

For every parity fixture:
`parseString(serializeToString(parseString(expected.xml))) deepEqual
parseString(expected.xml)`.

**Exit criteria:** every parity fixture pre-reducible to ordered form
produces byte-equal output. Every divergence fixture's new pipeline
output matches `expected-new.xml`. 100 % branch coverage on all five
new files. Stryker score ≥ baseline per file.

**Commit:** `feat(writer): XmlStreamWriter stack (emitter + formatters + EolTransform)`.

---

## 6. Phase 3 — `XmlMerger.mergeStreams` (1 day)

**Goal:** new method on `XmlMerger` exercises the full streaming
pipeline end-to-end on the merger side. Old `mergeThreeWay` unchanged.
Not yet called from `MergeDriver`.

### 6.1 Two explicit methods (addresses v1-F6 LSP)

```ts
export class XmlMerger {
  // Existing — unchanged through phase 5.
  mergeThreeWay(
    ancestorContent: string,
    ourContent: string,
    theirContent: string,
  ): { output: string; hasConflict: boolean }

  // New — streaming. Used by tests in phase 3, by MergeDriver in phase 4.
  async mergeStreams(
    ancestor: Readable,
    ours: Readable,
    theirs: Readable,
    out: Writable,
  ): Promise<{ hasConflict: boolean }>
}
```

Two methods, two signatures, no overload. This matches the `XmlParser`
two-method resolution (design §6.2 F-LSP).

### 6.2 Implementation

`mergeStreams` reuses the same `JsonMerger` (sync, CPU-bound — see
design §3 non-goal on CPU-merge parallelism). Flow:

1. `Promise.allSettled` over three `parser.parseStream` calls
   (new FlxParser per call).
2. `mergeNamespaces(anc.ns, local.ns, other.ns)` preserving declaration
   order — design §6.4 F-NS-ORDER.
3. `jsonMerger.mergeThreeWay(anc.content, local.content, other.content)`.
4. `writer.writeTo(out, merged.output, namespaces)`.

### 6.3 Tests

- `test/unit/merger/XmlMerger.mergeStreams.test.ts`:
  - each parity fixture that includes merge inputs (rows 1–33) →
    run merge → serialize to string via `serializeToString(PassThrough)`
    harness → byte-equal `expected.xml`.
  - divergence fixtures → byte-equal `expected-new.xml`.
  - `F-FIXTURE-NS-ORDER`: same-prefix-different-URI across sides;
    assert `local` wins, `other` overrides when `local` absent.
  - **`F-FIXTURE-CDATA-MERGE-ROUNDTRIP`** (addresses v1-F8 gap):
    merge two CDATA blocks where one contains `]]>`; assert merged
    output round-trips to the same tree.

### 6.4 No `MergeDriver` changes

Production path still calls the old `mergeThreeWay`. Any existing
`XmlMerger` test keeps using the old method and continues to pass.

**Exit criteria:** `mergeStreams` green on every parity + divergence
fixture. `mergeThreeWay` untouched, all its tests green. Repo
coverage 100 %.

**Commit:** `feat(merger): XmlMerger.mergeStreams end-to-end streaming method`.

---

## 7. Phase 4 — `MergeDriver` cutover (1.5 days)

**Goal:** production path switches from `mergeThreeWay` (strings) to
`mergeStreams` (streams). Old code compiles but is no longer called
from the driver. **This is the live-traffic cutover.**

### 7.1 `peekEol` utility

`src/utils/peekEol.ts` per design §6.4 contract.

Tests: LF, CRLF, mixed, no `\n` in 4 KB (default LF), BOM-prefixed
(ignored), `fsp.open` failure (propagates), partial-read
(< 4096 bytes), close-on-error.

### 7.2 `MergeDriver.mergeFiles` rewrite

Replace `readFile × 3 + writeFile` with the streaming flow from
design §6.4:

- `peekEol(oursPath)` to detect target EOL.
- `createReadStream × 3` with a no-op `'error'` listener on each
  (v3-F7).
- `Promise.allSettled([parser.parseStream × 3])` style — but this is
  now **encapsulated in `XmlMerger.mergeStreams`** (§6.2), so the
  driver just calls `merger.mergeStreams(ancRS, oursRS, theirsRS, writable)`.
- `createWriteStream(tmpPath)`; if CRLF, pipe through `EolTransform`.
- `rename(tmpPath, oursPath)` on success.
- `finally`: destroy readers, safeUnlink tmp.

### 7.3 Test rewrites

Existing `test/integration/MergeDriver.test.ts` + unit tests against
`MergeDriver` pass literal file paths through. They still work with
the new implementation — file I/O is behind `createReadStream` /
`createWriteStream`, unit tests just assert behaviour.

NUT tests (`test/integration/*.nut.ts`) run the binary against real
Salesforce metadata. No source changes needed; they exercise the new
path automatically.

### 7.4 Error-path tests

New in `test/integration/MergeDriver.stream.test.ts`:

- `F-FIXTURE-ERR-PARSE`: inject mid-stream error on `theirs`; assert
  `ours` file unchanged, `.tmp` unlinked.
- `F-FIXTURE-ERR-WRITE`: destroy output sink mid-write; same.
- **POSIX-only** `F-FIXTURE-FD-LEAK`: wrap `createReadStream` via
  `test/utils/fdCounter.ts`; after success and after error, assert
  the count of fds pointing at the three fixture paths is zero. Uses
  `/dev/fd` (Darwin + Linux) with `/proc/self/fd` fallback.
  `test.skipIf(process.platform === 'win32')` on Windows; the
  Windows-side check is limited to "no unhandled `'error'` event"
  which is asserted by vitest's default unhandled-rejection detector.

### 7.5 Atomic-rename test

- `F-FIXTURE-RENAME-EEXIST`: destination already exists (always the
  case — `ours` exists). `fs.rename` handles this; test just asserts
  the final file is the new bytes, not the old.
- Cross-platform note: Windows `MoveFileEx(MOVEFILE_REPLACE_EXISTING)`
  is atomic-enough; if a future Windows-only failure surfaces, revisit.

**Exit criteria:**
- `npm run test:nut` green (streaming path exercised).
- `npm run test:unit` green.
- `npm run test:integration` green.
- Benchmarks recorded per §9.
- Repo coverage 100 %.

**Commit:** `feat(driver): streaming MergeDriver (createReadStream + atomic rename)`.

**Release note:** cutover merges into `main` in a single PR. Tag a
release-candidate; phase 5 soak begins.

---

## 8. Phase 5 — Soak (14 calendar days, no code)

**Goal:** confirm the production path is stable before phase 6 deletes
the old code.

Concrete gates (all must hold at end of 14 days):

- Phase 4 commit on `main` for ≥ 14 calendar days.
- Daily CI run of `npm run test:nut` green every day.
- Zero issues opened tagged `streaming-xml` or containing the phrase
  "merge driver regression".
- No release reverts touching `MergeDriver` / `XmlMerger` / `src/adapter/*`.

**Observability.** The merge driver has no telemetry endpoint; users
run it locally. Support path relies on `~/.sf/sf-YYYY-MM-DD.log`. Add
a one-line `pipeline=streaming v=<version>` stamp to the driver's
start-of-merge log line so users sharing logs for support include the
pipeline version.

**Call-site pin:** log call lives at the top of `MergeDriver.mergeFiles`
(hit once per merge). The version source is:

```ts
// __VERSION__ is an esbuild `define` token injected by tooling/build-bin.mjs;
// undefined in ts-node / vitest contexts.
const PIPELINE_VERSION =
  typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev'
Logger.info(`pipeline=streaming v=${PIPELINE_VERSION}`)
```

The guard prevents `ReferenceError` in unit tests, which run via
`vitest` without the esbuild bundle. A `declare const __VERSION__:
string | undefined` entry in `src/types/globals.d.ts` keeps
TypeScript happy.

We deliberately do NOT inject commit-SHA (would require a
`tooling/build-bin.mjs` change + graceful `.git`-absent fallback for
tarball installs — out of scope for phase 4; revisit if soak reveals
version-level granularity is insufficient).

If any gate fails during soak: fix forward (small PRs), reset the
14-day clock. Do not move to phase 6 with unknown issues outstanding.

**No commit** — phase 5 is an observation period.

---

## 9. Benchmarks (run at end of phase 4, reviewer sign-off)

### 9.1 RAM

- Instrument `test/perf/instrumentation/PhaseTimer.ts` using
  `global.gc()` (enable with `node --expose-gc`) + `process.memoryUsage().heapUsed`
  at determined barriers (before parse / after parse / before serialize
  / after serialize). RSS is too noisy — v4 design §10.1's RSS approach
  will be revisited.
- Fixtures: 3 Profile tiers (1k / 10k / 50k) + PermissionSet +
  CustomObject + SharingRules.

**Gate:** **reviewer sign-off on documented reduction.** No hard
numeric threshold (v1 imposed -30 % / -50 % — those numbers were not
supportable given v4's read-side still buffers the full tree). Results
recorded in PR description and `docs/plans/2026-04-23-streaming-benchmarks.md`.
Expected direction: parse heapUsed drops (two tree-clone walks
eliminated); serialize heapUsed drops (4× full-string buffer
eliminated, replaced by chunk-sized transient strings).

### 9.2 Bundle

`npm run build:bin` before / after. **Gate:** no regression. A
reduction is expected; exact target deferred to measurement. Record
both numbers.

### 9.3 Speed

`test/perf/merge.bench.ts` p50/p95 on all tiers.

**Gate:** no regression > 5 % on any tier. Parse phase expected to
improve 15–25 % (eliminates two tree walks). Overall wall-clock flat
or faster.

If any gate's direction is wrong: investigate before merging
phase 4. Do not merge against the expectations.

---

## 10. Phase 6 — Cleanup (½ day)

**Goal:** delete dead code once phase 5 soak passes. No behaviour
change.

Steps:

1. Delete `src/adapter/FlxXmlParser.ts`.
2. Delete `src/adapter/FxpXmlSerializer.ts`.
3. Delete `src/merger/ConflictMarkerFormatter.ts` in its entirety. By
   phase 4 both its methods (`handleSpecialEntities`,
   `correctConflictIndent`) are unused — the former is dead code
   under current config (design §8 F-ENT-1), the latter is subsumed
   by the new standalone `src/adapter/writer/ConflictIndentFormatter.ts`.
   Remove the import from `FxpXmlSerializer.ts` (the latter is
   deleted in step 2 anyway). Grep `rg 'ConflictMarkerFormatter'` to
   confirm no remaining references.
4. Delete old `XmlMerger.mergeThreeWay`; rename `mergeStreams` →
   `mergeThreeWay` with the new signature. Update all call sites
   (driver + tests). Tests that used the legacy `mergeThreeWay`
   strings-API get rewritten to use streams via `Readable.from`.
5. Reclaim canonical names for the parser:
   - `src/adapter/XmlParser.ts` (the existing interface file) — its
     content was already reshaped during phase 1 from the old
     `parse(string) → ParsedXml` to the new
     `parseString` + `parseStream` methods per design §6.5.
     Verify no further edits needed here.
   - `src/adapter/StreamingXmlParser.ts` — rename file to
     `src/adapter/XmlParserImpl.ts` (or keep the original file name
     if a class named `StreamingXmlParser` inside a file named
     `StreamingXmlParser.ts` is acceptable to the team; convention
     in this repo is one-class-per-file with matching names —
     tradition suggests rename). The class itself keeps the name
     `StreamingXmlParser` — it is the concrete implementation of
     the `XmlParser` interface, and the implementation name is
     already accurate.
   - **Decision:** keep the class name `StreamingXmlParser` and the
     file name `StreamingXmlParser.ts`. The interface `XmlParser`
     is the canonical port; `StreamingXmlParser` is a perfectly good
     implementation name. Nothing to rename. This step reduces to
     "verify no renames needed" — cross off the checklist.
6. Apply the same decision to the serializer side:
   - `src/adapter/XmlSerializer.ts` — interface file, already
     reshaped during phase 2.
   - `src/adapter/writer/XmlStreamWriter.ts` — keep the class name
     `XmlStreamWriter`; it is the concrete implementation of
     `XmlSerializer`. No rename.
7. `npm uninstall fast-xml-builder`; transitive
   `path-expression-matcher` drops automatically.
8. `npm run dependencies:upgrade` per CLAUDE.local.md convention.
9. `rm -rf .wireit && npm test`.
10. Update `DESIGN.md` — new architecture (pre-push checklist item
    in CLAUDE.local.md).
11. Update `README.md` if it references `fast-xml-builder`.
12. `CHANGELOG.md` entry.

**Exit criteria:**
- `npm ls fast-xml-builder` empty.
- Bundle size shrunk (numbers recorded).
- Full test suite green.
- `DESIGN.md` pre-push check clean.

**Commit:** `refactor: remove legacy fast-xml-builder pipeline`.

---

## 11. Test enumeration (cross-phase)

Every design §8 row and every §6.3.2 byte-example must be covered.
This table ties each to a phase + fixture id + test file.

| Fixture | Phase | Test file | Mode |
|---|---|---|---|
| `01-root-ns` … `14-empty-namespaces` | 1 (parser), 2 (writer), 3 (merger) | parity tests in each phase | parity |
| `15-cdata-closing` | 1, 2, 3 | + merger round-trip | parity |
| `16-comment-double-dash` | 2 | emitter test | parity |
| `17-marker-size-variant` | 3 | mergeStreams test | parity |
| `18-nbsp-entity` | 1, 2 | parser + writer | parity (§8 F-ENT-1) |
| `19-btb-comments` | 2 | emitter + formatter | parity (§2a evaluated, decision = parity) |
| `20-empty-element` | 2 | emitter | parity |
| `21-crlf-input` | 4 | driver test | parity |
| `22-mixed-content` | 2 | indent formatter | parity |
| `23-attr-order` | 2 | emitter | parity |
| `24-err-mid-parse` | 4 | driver error test | parity (no output) |
| `25-err-mid-write` | 4 | driver error test | parity (no output) |
| `26-bom` | 4 | driver test | parity |
| `27-trailing-eol` | 4 | driver + EolTransform | parity |
| `28-large-text` | 2 | writer backpressure | parity |
| `29-nested-ns` | 1, 2 | parser + writer | parity |
| `30-crlf-markers` | 2, 4 | ConflictIndent + EolTransform | parity |
| `31-ns-order` | 3 | mergeStreams | parity |
| `32-nbsp-literal` | 1, 2 | folded into 18 | parity |
| `33-literal-lt` | 2 | emitter (processEntities off) | parity |
| `indent-01-leaf` … `indent-07-elem-elem` | 2 | IndentationFormatter | parity |
| Upstream-ordering invariant | 1 | `upstreamOrdering.test.ts` | — |
| `F-FIXTURE-CDATA-MERGE-ROUNDTRIP` | 3 | mergeStreams | parity |
| `F-FIXTURE-FD-LEAK` (POSIX) | 4 | driver test | — |
| `F-FIXTURE-RENAME-EEXIST` | 4 | driver test | — |

Each row is a checkbox in the phase-closing commit's PR description.

---

## 12. Risk register (implementation-specific)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Fixture captures a latent fxb bug and reviewer misses the `divergence` tag | low | medium | §3 step 2 requires hand-review; `parity.json` is a first-class artifact; CODEOWNERS / two-reviewer gate on `test/fixtures/xml/**`. |
| Stryker flags state-machine under-mutation | medium | low | Per-unit mutation run (§5.*); edge tests written during TDD. |
| UTF-8 BOM breaks `parseStream` | medium | medium | `26-bom` fixture in phase 4; if fails, add BOM-stripping `Transform`. |
| Backpressure deadlock in tests | low | high | Use `PassThrough` defaults; never set highWaterMark 0. |
| `parseStream` throws synchronously before returning a Promise | low | medium | Wrap `parser.parseStream` call in `await Promise.resolve().then(...)` — converts any sync throw into a Promise rejection. Add test. |
| Phase 4 regresses an obscure Profile shape not in fixtures | medium | high | NUT suite on `main` covers real metadata. Phase 5 soak catches field issues. |
| CDATA `]]>` array confuses JsonMerger | low | medium | `F-FIXTURE-CDATA-MERGE-ROUNDTRIP` (§6.3). |
| Coverage threshold blocks a phase-N PR because phase-N+1 caller isn't written yet | medium | low | §2 per-PR gate is 95 %; repo-level 100 % restored at phase-closing commit. |
| `fast-xml-builder` minor bump changes golden bytes mid-feature | low | low | Version-pin in phase-0 PR; lockfile immutable; merge `main` weekly. |
| `@nodable/*` minor bump reorders declaration handling | low | medium | Upstream-ordering test (§4.2) breaks loud. |

---

## 13. Sequencing notes

- **Phases must run in order.** Phase 2 depends on phase 1 (round-trip
  tests need the parser). Phase 3 depends on phase 2 (merger uses the
  writer). Phase 4 depends on phase 3 (driver uses the merger).
- Work in phase 0 (fixture curation) can overlap phase 1 — they share
  only the fixture directory.
- Each phase closes with a PR against `main`. `main` stays green
  continuously; no long-lived feature branch.

---

## 14. Rollback strategy

Each phase is independently revertable until phase 6 deletes the old
code:

- Phases 1, 2, 3: revert the phase commit → new code gone, old path
  unchanged (never called).
- Phase 4: revert → driver back to `readFile`/`writeFile` old path.
  This is the only revert that affects production behaviour.
- Phase 5: observation; no code to revert.
- Phase 6: deletion. Post-merge, revert reinstates the old code.
  Soak gate is the specific protection against needing this.

---

## 15. Acceptance checklist (end of phase 6)

- [ ] `fast-xml-builder` removed from `package.json` + lockfile.
- [ ] `path-expression-matcher` transitively removed.
- [ ] `FlxXmlParser`, `FxpXmlSerializer` deleted.
- [ ] `ConflictMarkerFormatter.handleSpecialEntities` and original
      `correctConflictIndent` deleted.
- [ ] Interfaces `XmlParser` / `XmlSerializer` (canonical ports) expose
      new streaming contract; implementations `StreamingXmlParser` /
      `XmlStreamWriter` keep their names (one-class-per-file
      convention preserved).
- [ ] `ParsedXml` type renamed to `NormalisedParseResult` throughout
      the repo; `rg 'ParsedXml'` returns zero hits. Call-sites
      (including test helpers) updated.
- [ ] 100 % branch coverage maintained across repo.
- [ ] Stryker score ≥ project baseline on all modified modules.
- [ ] Benchmarks: reviewer-signed-off reduction in parse + serialize
      heapUsed; speed parity or better; bundle size recorded.
- [ ] Observability: `pipeline=streaming v=<version>` log line present.
- [ ] `DESIGN.md` references up to date.
- [ ] `CHANGELOG.md` entry shipped.
- [ ] Phase 5 soak completed: 14 days, clean daily NUT, zero tagged
      issues, no release reverts.
