import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { sep } from 'node:path'
import type { XmlParser } from '../../src/adapter/XmlParser.js'
import {
  type FixtureSize,
  generateProfileFixtures,
} from '../perf/fixtures/generateFixtures.js'

export type ParityParser = Pick<XmlParser, 'parseString'>

export const parseOutcome = (parser: ParityParser, xml: string): string => {
  try {
    return `ok:${JSON.stringify(parser.parseString(xml))}`
  } catch (error) {
    return `throw:${error instanceof Error ? error.message : String(error)}`
  }
}

const PARSER_EDGE_CASES: Readonly<Record<string, string>> = {
  'trim per segment': '<a><b>  x  y  </b></a>',
  'mixed segments': '<a> t1 <b>x</b> t2 </a>',
  'whitespace leaf': '<a><b>  </b></a>',
  'attrs ws body': '<a><b x="1">  </b></a>',
  'cdata trimmed': '<a><![CDATA[  x  ]]></a>',
  'cdata ws': '<a><![CDATA[   ]]></a>',
  'cdata split in root': '<a><![CDATA[x]]]]><![CDATA[>y]]></a>',
  'comment verbatim': '<a><!--  c  --><!----></a>',
  'short comment text': '<a><!-->t--></a>',
  'no root empty': '',
  'no root text': 'hello',
  'no root decl': '<?xml version="1.0"?>',
  'two top-level': '<a>1</a><b>2</b>',
  'mismatched close': '<a><bb>x</b></a>',
  'lax close': '<a><b>x</bb></a>',
  'bare lt': '<a><b>1 < 2</b></a>',
  'valueless attr': '<a><b x>t</b></a>',
  'unquoted attr': '<a><b x=1>t</b></a>',
  'duplicate attr': '<a><b x="1" x="2">t</b></a>',
  'attr letter start proto': '<a><b __proto__="1">t</b></a>',
  'attr letter start digit': '<a><b 1x="1">t</b></a>',
  entities: '<a>&amp;&lt;&#x41;</a>',
  bom: '﻿<a>x</a>',
  'bal unterminated tag': '<a><b',
  'bal unterminated tag quote': '<a><b x="1',
  'bal unterminated comment': '<a><!-- x',
  'bal unterminated pi': '<a><?x',
  'bal unterminated doctype': '<!DOCTYPE a',
  'bal depth 1': '<a><b>x</a>',
  'bal depth -1': '</a>',
  'doctype before leaf root': '<!DOCTYPE a><a>x</a>',
  'doctype subset': '<!DOCTYPE a [ <!ENTITY e "v"> ]><a>x</a>',
  'short comment 6': '<a><!---> x --></a>',
  'short comment unterminated': '<a><!---></a>',
  'comment text': '<a>t<!--c-->u</a>',
  'comments grouped': '<a><!--c--><b>1</b><!--d--></a>',
  'comment attrs': '<a><b x="1"><!--c--></b></a>',
  'void self': '<a><link/></a>',
  'void upper': '<a><LINK>x</LINK></a>',
  'script self': '<a><script/></a>',
  'style upper': '<a><STYLE> x </STYLE></a>',
  'script repeated': '<a><script>1</script><script>2</script></a>',
  'script comment': '<a><script><!--c--></script></a>',
  'cdata text': '<a>t<![CDATA[ c ]]>u</a>',
  'cdata sibling': '<a><![CDATA[c]]><b>1</b></a>',
  'cdata attrs': '<a x="1"><![CDATA[c]]></a>',
  'cdata attrs ws': '<a x="1"><![CDATA[  ]]></a>',
  'cdata comment content': '<a><![CDATA[<!--x-->]]></a>',
  'close space': '<a><b>x</b ></a>',
  'error lf': '<a>\n<bb>\r\nx</b></a>',
  'error crlf': '<a>\r\n<bb>x</b></a>',
  'qmark open': '<a><b?></b></a>',
  'qmark self': '<a><b?/></a>',
  'empty name': '<a><>x</></a>',
  'unquoted self': '<a><b x=1/></a>',
  'slash space': '<a><b / ></b></a>',
  'ws around eq': '<a><b x = "1" >t</b></a>',
  tab: '<a><b\tx="1">t</b></a>',
  'close quoted gt': '<a><b>x</b x=">"></a>',
  'proto names': '<a><__proto__>1</__proto__><constructor>2</constructor></a>',
  'xmlns split': '<a xmlns="u" xmlns:p="v" x="1"><b>t</b></a>',
  'xmlns only': '<a xmlns="u"/>',
  grouping: '<a><b>1</b>t<c>2</c><b>3</b></a>',
  'gt in root text': '<a>1 > 0</a>',
  'top text': 't<a>x</a>',
  'stray quote name': '<a><b x"y="1">t</b></a>',
  'stray quote unquoted': '<a><b x=a"b>t</b></a>',
  'stray quote depth': '<a><b x=a"b>t</b>"</a>',
  'quoted close': "<a><b>x</b '></a>",
  'qmark self attr': '<a><b x="1"?>t</a>',
  'qmark root': '<a?>',
  'short comment': '<a><!--></a>',
  'single dash quote': "<a><!-x '--></a>",
  'bang quote': "<a><!x '></a>",
  'lower cdata quote': "<a><![cdata[ ' ]]></a>",
  'pi bare gt': '<a><?pi a></a>',
  'void br': '<a><br></a>',
  'void hr': '<a><hr></a>',
  'void br top': '<br><a/>',
  'script open inside': '<a><script><b></script></a>',
  'style close inside': '<a><style></b></style></a>',
  'script lt': '<a><script>1 < 2</script></a>',
  'top close': '<a/></><b/>',
  eof: '<a><b>x',
  'top close first': '</x><a>',
  'top close after root': '<a/></x><b>',
  'trailing error': '<a/><b></c>',
  'trailing error 2': '<a>1</a><b><c></b></c>',
  'attr gt dq': '<a x="1>2"><b>t</b></a>',
  'attr gt sq': "<a x='1>2'><b>t</b></a>",
  'sq in dq': `<a x="it's"><b>t</b></a>`,
  'dq in sq': `<a x='say "hi"'><b/></a>`,
  'quote text': '<a><b>he said "hi" and \'bye\'</b><c>x</c></a>',
  'self attrs': '<a><b x="1"/><c/></a>',
  'self quoted slash': '<a><b x="/"/></a>',
  'empty tag body': '<a><></a>',
  'root only': '<a/>',
  'root text': '<a>x</a>',
  'ws text': '<a>   </a>',
  'ws child': '<a><b>  </b></a>',
  mixed: '<a>t1<b>x</b>t2</a>',
  'comment only': '<a><!--c--></a>',
  'empty comment': '<a><!----></a>',
  'comment siblings': '<a><b>1</b><!--c--><b>2</b></a>',
  'lt entity': '<a><b>&lt;not a comment</b></a>',
  cdata: '<a><b><![CDATA[<&>]]></b></a>',
  'cdata split in nested element':
    '<a><b><![CDATA[x]]]]><![CDATA[>y]]></b></a>',
  'doctype before nested root': '<!DOCTYPE a><a><b>x</b></a>',
  'doctype quoted gt': '<!DOCTYPE a "x>y"><a><b>x</b></a>',
  'xml decl':
    '<?xml version="1.0" encoding="UTF-8"?>\n<a xmlns="urn:x"><b>x</b></a>',
  'attrs text': '<a><b x="1">t</b></a>',
  'attrs no body': '<a><b x="1"></b></a>',
  repeated: '<a><b>1</b><b>2</b><b>3</b></a>',
  nested: '<a><b><c><d>x</d></c></b></a>',
  'unbalanced open': '<a><b>x</a>',
  'unbalanced close': '<a><b>x</b></b></a>',
  'unterminated tag': '<a><b',
  'unterminated tag quote': '<a><b x="1',
  'unterminated comment': '<a><!-- x',
  'unterminated pi': '<a><?x',
  'unterminated doctype': '<!DOCTYPE a',
  'empty doc': '',
  'text doc': 'hello',
  'gt in nested text': '<a><b>1 > 0</b></a>',
  'lt attr': '<a x="<"><b>t</b></a>',
  'proto key': '<a><__proto__>x</__proto__><b>y</b></a>',
  'constructor key': '<a><constructor>x</constructor></a>',
  crlf: '<a>\r\n  <b>x</b>\r\n</a>\r\n',
  'trailing garbage': '<a><b>x</b></a>trailing',
  'attr only root': '<a x="1"/>',
  'cdata consecutive': '<a><![CDATA[x]]><![CDATA[y]]></a>',
  'cdata multiline': '<a><v><![CDATA[l1\n  l2 & <p>]]></v></a>',
  'cdata amp-lt literal': '<a><![CDATA[&lt;&amp;lt;]]></a>',
  'cdata unterminated eof': '<a><![CDATA[x',
  'cdata then bad close next line': '<a><![CDATA[1]]>\n<bb></b></a>',
  'cdata error same line after': '<a><bb></b><![CDATA[x]]></a>',
  'decl then comment then root':
    '<?xml version="1.0" encoding="UTF-8"?>\n<!-- c -->\n<a><b>x</b></a>',
  'close no gt': '<a><b>x</b',
  'attr sq': "<a><b x='1'>t</b></a>",
}

const FIXTURES_ROOT = 'test/fixtures'
const FIXTURE_EXTENSION = '.xml'
const PARITY_TIERS: ReadonlyArray<FixtureSize> = ['medium', 'large', 'xl']

type ParityRow = readonly [string, string]

const toRepoRelativePath = (entry: string): string =>
  `${FIXTURES_ROOT}/${entry.split(sep).join('/')}`

const listFixtureFiles = (): ReadonlyArray<ParityRow> =>
  readdirSync(FIXTURES_ROOT, { recursive: true, encoding: 'utf8' })
    .filter(entry => entry.endsWith(FIXTURE_EXTENSION))
    .map(toRepoRelativePath)
    .sort()
    .map(path => [path, readFileSync(path, 'utf8')] as const)

const listTierDocuments = (size: FixtureSize): ReadonlyArray<string> => {
  const fixtures = generateProfileFixtures(size)
  return [
    fixtures.ancestor,
    fixtures.local,
    fixtures.other,
    fixtures.conflictLocal,
    fixtures.conflictOther,
  ]
}

export interface ParityInputs {
  readonly files: ReadonlyArray<ParityRow>
  readonly edges: ReadonlyArray<ParityRow>
  readonly tiers: ReadonlyArray<readonly [FixtureSize, ReadonlyArray<string>]>
}

export const listParityInputs = (): ParityInputs => ({
  files: listFixtureFiles(),
  edges: Object.entries(PARSER_EDGE_CASES),
  tiers: PARITY_TIERS.map(tier => [tier, listTierDocuments(tier)] as const),
})

export interface ParitySnapshot {
  readonly files: Record<string, string>
  readonly edges: Record<string, string>
  readonly tiers: Record<string, string>
}

const hashTierOutcomes = (outcomes: readonly string[]): string =>
  createHash('sha256').update(outcomes.join('\n')).digest('hex')

export const buildParitySnapshot = (parser: ParityParser): ParitySnapshot => {
  const { files, edges, tiers } = listParityInputs()

  return {
    files: Object.fromEntries(
      files.map(([path, xml]) => [path, parseOutcome(parser, xml)])
    ),
    edges: Object.fromEntries(
      edges.map(([label, xml]) => [label, parseOutcome(parser, xml)])
    ),
    tiers: Object.fromEntries(
      tiers.map(([tier, documents]) => [
        tier,
        hashTierOutcomes(documents.map(xml => parseOutcome(parser, xml))),
      ])
    ),
  }
}
