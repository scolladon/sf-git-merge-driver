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

export const PARSER_EDGE_CASES: Readonly<Record<string, string>> = {
  'P2 trim per segment': '<a><b>  x  y  </b></a>',
  'P2 mixed segments': '<a> t1 <b>x</b> t2 </a>',
  'P2 whitespace leaf': '<a><b>  </b></a>',
  'P2 attrs ws body': '<a><b x="1">  </b></a>',
  'P2 cdata trimmed': '<a><![CDATA[  x  ]]></a>',
  'P2 cdata ws': '<a><![CDATA[   ]]></a>',
  'P2 cdata split': '<a><![CDATA[x]]]]><![CDATA[>y]]></a>',
  'P2 comment verbatim': '<a><!--  c  --><!----></a>',
  'P2 short comment text': '<a><!-->t--></a>',
  'P2 no root empty': '',
  'P2 no root text': 'hello',
  'P2 no root decl': '<?xml version="1.0"?>',
  'P2 two top-level': '<a>1</a><b>2</b>',
  'P2 mismatched close': '<a><bb>x</b></a>',
  'P2 lax close': '<a><b>x</bb></a>',
  'P2 bare lt': '<a><b>1 < 2</b></a>',
  'P2 valueless attr': '<a><b x>t</b></a>',
  'P2 unquoted attr': '<a><b x=1>t</b></a>',
  'P2 duplicate attr': '<a><b x="1" x="2">t</b></a>',
  'P2 attr letter start proto': '<a><b __proto__="1">t</b></a>',
  'P2 attr letter start digit': '<a><b 1x="1">t</b></a>',
  'P2 entities': '<a>&amp;&lt;&#x41;</a>',
  'P2 bom': '﻿<a>x</a>',
  'P2 bal unterminated tag': '<a><b',
  'P2 bal unterminated tag quote': '<a><b x="1',
  'P2 bal unterminated comment': '<a><!-- x',
  'P2 bal unterminated pi': '<a><?x',
  'P2 bal unterminated doctype': '<!DOCTYPE a',
  'P2 bal depth 1': '<a><b>x</a>',
  'P2 bal depth -1': '</a>',
  'B doctype': '<!DOCTYPE a><a>x</a>',
  'B doctype subset': '<!DOCTYPE a [ <!ENTITY e "v"> ]><a>x</a>',
  'B short comment 6': '<a><!---> x --></a>',
  'B short comment unterminated': '<a><!---></a>',
  'B comment text': '<a>t<!--c-->u</a>',
  'B comments grouped': '<a><!--c--><b>1</b><!--d--></a>',
  'B comment only': '<a><!--c--></a>',
  'B comment attrs': '<a><b x="1"><!--c--></b></a>',
  'C void self': '<a><link/></a>',
  'C void upper': '<a><LINK>x</LINK></a>',
  'C script self': '<a><script/></a>',
  'C style upper': '<a><STYLE> x </STYLE></a>',
  'C script repeated': '<a><script>1</script><script>2</script></a>',
  'C script comment': '<a><script><!--c--></script></a>',
  'D cdata text': '<a>t<![CDATA[ c ]]>u</a>',
  'D cdata sibling': '<a><![CDATA[c]]><b>1</b></a>',
  'D cdata attrs': '<a x="1"><![CDATA[c]]></a>',
  'D cdata attrs ws': '<a x="1"><![CDATA[  ]]></a>',
  'D cdata comment content': '<a><![CDATA[<!--x-->]]></a>',
  'E close space': '<a><b>x</b ></a>',
  'E error lf': '<a>\n<bb>\r\nx</b></a>',
  'E error crlf': '<a>\r\n<bb>x</b></a>',
  'E qmark open': '<a><b?></b></a>',
  'E qmark self': '<a><b?/></a>',
  'E empty name': '<a><>x</></a>',
  'E unquoted self': '<a><b x=1/></a>',
  'E slash space': '<a><b / ></b></a>',
  'E ws around eq': '<a><b x = "1" >t</b></a>',
  'E tab': '<a><b\tx="1">t</b></a>',
  'E close quoted gt': '<a><b>x</b x=">"></a>',
  'E proto names':
    '<a><__proto__>1</__proto__><constructor>2</constructor></a>',
  'E xmlns split': '<a xmlns="u" xmlns:p="v" x="1"><b>t</b></a>',
  'E xmlns only': '<a xmlns="u"/>',
  'E grouping': '<a><b>1</b>t<c>2</c><b>3</b></a>',
  'E gt text': '<a>1 > 0</a>',
  'E top text': 't<a>x</a>',
  'F stray quote name': '<a><b x"y="1">t</b></a>',
  'F stray quote unquoted': '<a><b x=a"b>t</b></a>',
  'F stray quote depth': '<a><b x=a"b>t</b>"</a>',
  'F quoted close': "<a><b>x</b '></a>",
  'F qmark self attr': '<a><b x="1"?>t</a>',
  'F qmark root': '<a?>',
  'F short comment': '<a><!--></a>',
  'F single dash quote': "<a><!-x '--></a>",
  'F bang quote': "<a><!x '></a>",
  'F lower cdata quote': "<a><![cdata[ ' ]]></a>",
  'F pi bare gt': '<a><?pi a></a>',
  'F void br': '<a><br></a>',
  'F void hr': '<a><hr></a>',
  'F void br top': '<br><a/>',
  'F script open inside': '<a><script><b></script></a>',
  'F style close inside': '<a><style></b></style></a>',
  'F script lt': '<a><script>1 < 2</script></a>',
  'F top close': '<a/></><b/>',
  'F eof': '<a><b>x',
  'G top close first': '</x><a>',
  'G top close after root': '<a/></x><b>',
  'G trailing error': '<a/><b></c>',
  'G trailing error 2': '<a>1</a><b><c></b></c>',
  'R attr gt dq': '<a x="1>2"><b>t</b></a>',
  'R attr gt sq': "<a x='1>2'><b>t</b></a>",
  'R sq in dq': `<a x="it's"><b>t</b></a>`,
  'R dq in sq': `<a x='say "hi"'><b/></a>`,
  'R quote text': '<a><b>he said "hi" and \'bye\'</b><c>x</c></a>',
  'R self attrs': '<a><b x="1"/><c/></a>',
  'R self quoted slash': '<a><b x="/"/></a>',
  'R empty tag body': '<a><></a>',
  'R root only': '<a/>',
  'R root text': '<a>x</a>',
  'R ws text': '<a>   </a>',
  'R ws child': '<a><b>  </b></a>',
  'R mixed': '<a>t1<b>x</b>t2</a>',
  'R comment only': '<a><!--c--></a>',
  'R empty comment': '<a><!----></a>',
  'R comment siblings': '<a><b>1</b><!--c--><b>2</b></a>',
  'R lt entity': '<a><b>&lt;not a comment</b></a>',
  'R cdata': '<a><b><![CDATA[<&>]]></b></a>',
  'R cdata split': '<a><b><![CDATA[x]]]]><![CDATA[>y]]></b></a>',
  'R doctype': '<!DOCTYPE a><a><b>x</b></a>',
  'R doctype quoted gt': '<!DOCTYPE a "x>y"><a><b>x</b></a>',
  'R xml decl':
    '<?xml version="1.0" encoding="UTF-8"?>\n<a xmlns="urn:x"><b>x</b></a>',
  'R attrs text': '<a><b x="1">t</b></a>',
  'R attrs no body': '<a><b x="1"></b></a>',
  'R repeated': '<a><b>1</b><b>2</b><b>3</b></a>',
  'R nested': '<a><b><c><d>x</d></c></b></a>',
  'R unbalanced open': '<a><b>x</a>',
  'R unbalanced close': '<a><b>x</b></b></a>',
  'R unterminated tag': '<a><b',
  'R unterminated tag quote': '<a><b x="1',
  'R unterminated comment': '<a><!-- x',
  'R unterminated pi': '<a><?x',
  'R unterminated doctype': '<!DOCTYPE a',
  'R empty doc': '',
  'R text doc': 'hello',
  'R gt text': '<a><b>1 > 0</b></a>',
  'R lt attr': '<a x="<"><b>t</b></a>',
  'R proto key': '<a><__proto__>x</__proto__><b>y</b></a>',
  'R constructor key': '<a><constructor>x</constructor></a>',
  'R crlf': '<a>\r\n  <b>x</b>\r\n</a>\r\n',
  'R trailing garbage': '<a><b>x</b></a>trailing',
  'R attr only root': '<a x="1"/>',
  'X cdata consecutive': '<a><![CDATA[x]]><![CDATA[y]]></a>',
  'X cdata multiline': '<a><v><![CDATA[l1\n  l2 & <p>]]></v></a>',
  'X cdata amp-lt literal': '<a><![CDATA[&lt;&amp;lt;]]></a>',
  'X cdata unterminated eof': '<a><![CDATA[x',
  'X cdata then bad close next line': '<a><![CDATA[1]]>\n<bb></b></a>',
  'X cdata error same line after': '<a><bb></b><![CDATA[x]]></a>',
  'X decl then comment then root':
    '<?xml version="1.0" encoding="UTF-8"?>\n<!-- c -->\n<a><b>x</b></a>',
  'X close no gt': '<a><b>x</b',
  'X attr sq': "<a><b x='1'>t</b></a>",
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
