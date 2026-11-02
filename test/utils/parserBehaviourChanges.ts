export interface BehaviourChangeCase {
  readonly xml: string
  readonly outcome: string
}

export const PARSER_BEHAVIOUR_CHANGES: Readonly<
  Record<string, BehaviourChangeCase>
> = {
  'pi in element': {
    xml: '<a><?pi x?><b>x</b></a>',
    outcome:
      'throw:XML parse error: processing instruction inside the root element',
  },
  'pi before root': {
    xml: '<?foo?><a>x</a>',
    outcome: 'throw:XML parse error: content outside the single root element',
  },
  'bang in element': {
    xml: '<a><!foo><b>t</b></a>',
    outcome: 'throw:XML parse error: <! declaration inside the root element',
  },
  'void name': {
    xml: '<a><link>x</link></a>',
    outcome: 'ok:{"content":{"a":{"link":"x"}},"rootAttributes":{}}',
  },
  'cdata in attr': {
    xml: '<a x="<![CDATA[y]]>">t</a>',
    outcome:
      'ok:{"content":{"a":"t"},"rootAttributes":{"@_x":"<![CDATA[y]]>"}}',
  },
  'style ws': {
    xml: '<a><style>  </style></a>',
    outcome: 'ok:{"content":{"a":{"style":""}},"rootAttributes":{}}',
  },
  'script empty': {
    xml: '<a><script></script></a>',
    outcome: 'ok:{"content":{"a":{"script":""}},"rootAttributes":{}}',
  },
  'style text': {
    xml: '<a><style> x </style></a>',
    outcome: 'ok:{"content":{"a":{"style":"x"}},"rootAttributes":{}}',
  },
  'pi content-only': {
    xml: '<a><?pi 1 2?></a>',
    outcome:
      'throw:XML parse error: processing instruction inside the root element',
  },
  'pi attr': {
    xml: '<a><?pi a="1"?></a>',
    outcome:
      'throw:XML parse error: processing instruction inside the root element',
  },
  'pi bare gt': {
    xml: '<a><?pi a>b?></a>',
    outcome:
      'throw:XML parse error: processing instruction inside the root element',
  },
  'pi quoted end': {
    xml: '<a><?pi a="?>"?></a>',
    outcome:
      'throw:XML parse error: processing instruction inside the root element',
  },
  'pi comment body': {
    xml: '<a><?pi <!--x-->?></a>',
    outcome:
      'throw:XML parse error: processing instruction inside the root element',
  },
  'decl no space': {
    xml: '<?xml?><a>x</a>',
    outcome: 'ok:{"content":{"a":"x"},"rootAttributes":{}}',
  },
  'decl upper': {
    xml: '<?XML version="1.0"?><a>x</a>',
    outcome: 'throw:XML parse error: content outside the single root element',
  },
  'pi root': {
    xml: '<?pi?><a/>',
    outcome: 'throw:XML parse error: content outside the single root element',
  },
  'pi unterminated quote top': {
    xml: '<?pi a="x?><a/>',
    outcome: 'throw:XML parse error: content outside the single root element',
  },
  'pi unterminated quote body': {
    xml: '<a><?x a="1?></a>',
    outcome:
      'throw:XML parse error: processing instruction inside the root element',
  },
  'bang brackets': {
    xml: '<a><!x [ > ] ><b>t</b></a>',
    outcome: 'throw:XML parse error: <! declaration inside the root element',
  },
  'bang no close bracket': {
    xml: '<a><!x [ ></a>',
    outcome: 'throw:XML parse error: <! declaration inside the root element',
  },
  'single dash': {
    xml: '<a><!-x--></a>',
    outcome: 'throw:XML parse error: <! declaration inside the root element',
  },
  'single dash text': {
    xml: '<a>t<!-x-->u</a>',
    outcome: 'throw:XML parse error: <! declaration inside the root element',
  },
  'single dash eof': {
    xml: '<a><!-x></a>',
    outcome: 'throw:XML parse error: <! declaration inside the root element',
  },
  'void lax': {
    xml: '<l><link>x</link></l>',
    outcome: 'ok:{"content":{"l":{"link":"x"}},"rootAttributes":{}}',
  },
  'void img close': {
    xml: '<a><img x="1">t</img></a>',
    outcome:
      'ok:{"content":{"a":{"img":{"@_x":"1","#text":"t"}}},"rootAttributes":{}}',
  },
  'script markup': {
    xml: '<a><script><b>1</b></script></a>',
    outcome: 'ok:{"content":{"a":{"script":{"b":"1"}}},"rootAttributes":{}}',
  },
  'script attr text': {
    xml: '<a><script x="1"> y </script></a>',
    outcome:
      'ok:{"content":{"a":{"script":{"@_x":"1","#text":"y"}}},"rootAttributes":{}}',
  },
  'script attr empty': {
    xml: '<a><script x="1"></script></a>',
    outcome:
      'ok:{"content":{"a":{"script":{"@_x":"1","#text":""}}},"rootAttributes":{}}',
  },
  'script root': {
    xml: '<script> x </script>',
    outcome: 'ok:{"content":{"script":"x"},"rootAttributes":{}}',
  },
  'script rewind root': {
    xml: '<script>x</script >',
    outcome: 'ok:{"content":{"script":"x"},"rootAttributes":{}}',
  },
  'style rewind root': {
    xml: '<style>x</style >',
    outcome: 'ok:{"content":{"style":"x"},"rootAttributes":{}}',
  },
  'script rewind 1': {
    xml: '<a><script>x</script ></a>',
    outcome: 'ok:{"content":{"a":{"script":"x"}},"rootAttributes":{}}',
  },
  'script rewind 2': {
    xml: '<a><b><script>x</script ></b></a>',
    outcome: 'ok:{"content":{"a":{"b":{"script":"x"}}},"rootAttributes":{}}',
  },
  'style rewind': {
    xml: '<a><b>1</b><style>x</style ></a>',
    outcome: 'ok:{"content":{"a":{"b":"1","style":"x"}},"rootAttributes":{}}',
  },
  'cdata attr escaped': {
    xml: '<a x="<![CDATA[a<b&c]]>">t</a>',
    outcome:
      'ok:{"content":{"a":"t"},"rootAttributes":{"@_x":"<![CDATA[a<b&c]]>"}}',
  },
  'cdata comment': {
    xml: '<a><!-- <![CDATA[y]]> --></a>',
    outcome:
      'ok:{"content":{"a":{"#xml__comment":" <![CDATA[y]]> "}},"rootAttributes":{}}',
  },
  'cdata overlap comment': {
    xml: '<a><!-- <![CDATA[ --> y ]]></a>',
    outcome:
      'ok:{"content":{"a":{"#xml__comment":" <![CDATA[ ","#text":"y ]]>"}},"rootAttributes":{}}',
  },
  'cdata overlap attr': {
    xml: '<a x="<![CDATA[">y]]></a>',
    outcome: 'ok:{"content":{"a":"y]]>"},"rootAttributes":{"@_x":"<![CDATA["}}',
  },
  'cdata root': {
    xml: '<![CDATA[x]]><a>y</a>',
    outcome: 'throw:XML parse error: content outside the single root element',
  },
  'cdata root ws': {
    xml: '<?xml version="1.0"?>\n<![CDATA[ ]]><a/>',
    outcome: 'throw:XML parse error: content outside the single root element',
  },
  'lower cdata': {
    xml: '<a><![cdata[ x ]]></a>',
    outcome: 'throw:XML parse error: <! declaration inside the root element',
  },
  'lower cdata comment': {
    xml: '<a><![cdata[<!--x-->]]></a>',
    outcome: 'throw:XML parse error: <! declaration inside the root element',
  },
  'cdata unterminated': {
    xml: '<a><![CDATA[x></a>',
    outcome: 'throw:XML parse error: unterminated <! ... >',
  },
  'cdata script': {
    xml: '<a><script><![CDATA[x]]></script></a>',
    outcome:
      'ok:{"content":{"a":{"script":{"__cdata":"x"}}},"rootAttributes":{}}',
  },
  'cdata pi': {
    xml: '<a><?pi <![CDATA[x]]>?></a>',
    outcome:
      'throw:XML parse error: processing instruction inside the root element',
  },
  'nul element': {
    xml: '<a><\u0000cdata\u0000>x</\u0000cdata\u0000></a>',
    outcome: 'throw:XML parse error: invalid element name',
  },
  'nul element mixed': {
    xml: '<a><\u0000cdata\u0000>x<!--c--><b>1</b></\u0000cdata\u0000></a>',
    outcome: 'throw:XML parse error: invalid element name',
  },
  'cdata error column': {
    xml: '<a><![CDATA[1\n2]]><bb></b></a>',
    outcome: 'throw:Unexpected close tag\nLine: 1\nColumn: 12\nChar: >',
  },
  'rewind growth style': {
    xml: '<rr>123<x><style>x</style ></x></rr>',
    outcome:
      'ok:{"content":{"rr":{"x":{"style":"x"},"#text":"123"}},"rootAttributes":{}}',
  },
  'rewind growth script': {
    xml: '<rrr>123<x><script>x</script ></x></rrr>',
    outcome:
      'ok:{"content":{"rrr":{"x":{"script":"x"},"#text":"123"}},"rootAttributes":{}}',
  },
  'fuzz stray-quote unwind': {
    xml: '<ab x"a>b"/>',
    outcome: 'throw:XML parse error: malformed attribute',
  },
  'fuzz missing attribute name unwind': {
    xml: '<fieldPermissions ="a>b"/>',
    outcome: 'throw:XML parse error: malformed attribute',
  },
  'fuzz malformed declaration': {
    xml: '<?xml version="1.0" encoding="UF-8?>\n<b></b>',
    outcome: 'ok:{"content":{"b":""},"rootAttributes":{}}',
  },
  'fuzz qmark self-close': {
    xml: '<xml version="1.0"?>\n<b></b></b>',
    outcome: 'throw:XML parse error: malformed attribute',
  },
  'fuzz CDATA inside a tag': {
    xml: '<a x="a>b"<![CDATA[!--x-->]]></a>',
    outcome: 'throw:XML parse error: malformed attribute',
  },
  'fuzz top-level CDATA no root': {
    xml: 'b><![CDATA[>]]>',
    outcome: 'throw:XML parse error: content outside the single root element',
  },
  'script rewind after sibling': {
    xml: '<a><b>1</b><script>x</script ></a>',
    outcome: 'ok:{"content":{"a":{"b":"1","script":"x"}},"rootAttributes":{}}',
  },
}
