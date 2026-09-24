export interface BehaviourChangeCase {
  readonly xml: string
  readonly outcome: string
}

export const PARSER_BEHAVIOUR_CHANGES: Readonly<
  Record<string, BehaviourChangeCase>
> = {
  'P2 pi in element': {
    xml: '<a><?pi x?><b>x</b></a>',
    outcome:
      'ok:{"content":{"a":{"?pi":{"@_x?":null,"#text":""},"b":"x"}},"namespaces":{}}',
  },
  'P2 pi before root': {
    xml: '<?foo?><a>x</a>',
    outcome: 'ok:{"content":{"?foo?":""},"namespaces":{}}',
  },
  'P2 bang in element': {
    xml: '<a><!foo><b>t</b></a>',
    outcome: 'ok:{"content":{"a":{"b":"t","#text":"!foo"}},"namespaces":{}}',
  },
  'P2 void name': {
    xml: '<a><link>x</link></a>',
    outcome: 'throw:Unexpected close tag\nLine: 0\nColumn: 17\nChar: >',
  },
  'P2 cdata in attr': {
    xml: '<a x="<![CDATA[y]]>">t</a>',
    outcome:
      'ok:{"content":{"a":{"@_x":"<\\u0000cdata\\u0000>y</\\u0000cdata\\u0000>","#text":"t"}},"namespaces":{}}',
  },
  'P2 style ws': {
    xml: '<a><style>  </style></a>',
    outcome: 'ok:{"content":{"a":{"style":{}}},"namespaces":{}}',
  },
  'P2 script empty': {
    xml: '<a><script></script></a>',
    outcome: 'ok:{"content":{"a":{"script":{}}},"namespaces":{}}',
  },
  'P2 style text': {
    xml: '<a><style> x </style></a>',
    outcome: 'ok:{"content":{"a":{"style":" x "}},"namespaces":{}}',
  },
  'A pi content-only': {
    xml: '<a><?pi 1 2?></a>',
    outcome: 'ok:{"content":{"a":{"?pi":"1 2"}},"namespaces":{}}',
  },
  'A pi attr': {
    xml: '<a><?pi a="1"?></a>',
    outcome:
      'ok:{"content":{"a":{"?pi":{"@_a":"1","#text":""}}},"namespaces":{}}',
  },
  'A pi bare gt': {
    xml: '<a><?pi a>b?></a>',
    outcome:
      'ok:{"content":{"a":{"?pi":{"@_a":null,"#text":""},"#text":"b?>"}},"namespaces":{}}',
  },
  'A pi quoted end': {
    xml: '<a><?pi a="?>"?></a>',
    outcome:
      'ok:{"content":{"a":{"?pi":{"@_a":"?>","#text":""}}},"namespaces":{}}',
  },
  'A pi comment body': {
    xml: '<a><?pi <!--x-->?></a>',
    outcome:
      'ok:{"content":{"a":{"?pi":{"@_x--":null,"#text":""},"#text":"?>"}},"namespaces":{}}',
  },
  'A decl no space': {
    xml: '<?xml?><a>x</a>',
    outcome: 'ok:{"content":{"?xml?":""},"namespaces":{}}',
  },
  'A decl upper': {
    xml: '<?XML version="1.0"?><a>x</a>',
    outcome:
      'ok:{"content":{"?XML":{"@_version":"1.0","#text":""}},"namespaces":{}}',
  },
  'A pi root': {
    xml: '<?pi?><a/>',
    outcome: 'ok:{"content":{"?pi?":""},"namespaces":{}}',
  },
  'A pi unterminated quote top': {
    xml: '<?pi a="x?><a/>',
    outcome: 'ok:{"content":{"?pi":""},"namespaces":{}}',
  },
  'A pi unterminated quote body': {
    xml: '<a><?x a="1?></a>',
    outcome: 'ok:{"content":{"a":{"?x":""}},"namespaces":{}}',
  },
  'B bang brackets': {
    xml: '<a><!x [ > ] ><b>t</b></a>',
    outcome:
      'ok:{"content":{"a":{"b":"t","#text":"!x [ > ] "}},"namespaces":{}}',
  },
  'B bang no close bracket': {
    xml: '<a><!x [ ></a>',
    outcome: 'ok:{"content":{"a":"!x [ ></a>"},"namespaces":{}}',
  },
  'B single dash': {
    xml: '<a><!-x--></a>',
    outcome: 'ok:{"content":{"a":"<!-x-->"},"namespaces":{}}',
  },
  'B single dash text': {
    xml: '<a>t<!-x-->u</a>',
    outcome: 'ok:{"content":{"a":"t<!-x-->u"},"namespaces":{}}',
  },
  'B single dash eof': {
    xml: '<a><!-x></a>',
    outcome: 'ok:{"content":{"a":"<!-x></a>"},"namespaces":{}}',
  },
  'C void lax': {
    xml: '<l><link>x</link></l>',
    outcome: 'ok:{"content":{"l":{"link":"","#text":"x"}},"namespaces":{}}',
  },
  'C void img close': {
    xml: '<a><img x="1">t</img></a>',
    outcome: 'throw:Unexpected close tag\nLine: 0\nColumn: 21\nChar: >',
  },
  'C script markup': {
    xml: '<a><script><b>1</b></script></a>',
    outcome: 'ok:{"content":{"a":{"script":"<b>1</b>"}},"namespaces":{}}',
  },
  'C script attr text': {
    xml: '<a><script x="1"> y </script></a>',
    outcome:
      'ok:{"content":{"a":{"script":{"@_x":"1","#text":" y "}}},"namespaces":{}}',
  },
  'C script attr empty': {
    xml: '<a><script x="1"></script></a>',
    outcome: 'ok:{"content":{"a":{"script":{"@_x":"1"}}},"namespaces":{}}',
  },
  'C script root': {
    xml: '<script> x </script>',
    outcome: 'ok:{"content":{"script":" x "},"namespaces":{}}',
  },
  'C script rewind root': {
    xml: '<script>x</script >',
    outcome: 'ok:{"content":{"script":"x</script "},"namespaces":{}}',
  },
  'C style rewind root': {
    xml: '<style>x</style >',
    outcome: 'ok:{"content":{"style":"x</style "},"namespaces":{}}',
  },
  'C script rewind 1': {
    xml: '<a><script>x</script ></a>',
    outcome: 'throw:Unexpected close tag\nLine: 0\nColumn: 22\nChar: >',
  },
  'C script rewind 2': {
    xml: '<a><b><script>x</script ></b></a>',
    outcome: 'throw:Unexpected close tag\nLine: 0\nColumn: 25\nChar: >',
  },
  'C style rewind': {
    xml: '<a><b>1</b><style>x</style ></a>',
    outcome: 'throw:Unexpected close tag\nLine: 0\nColumn: 11\nChar: >',
  },
  'D cdata attr escaped': {
    xml: '<a x="<![CDATA[a<b&c]]>">t</a>',
    outcome:
      'ok:{"content":{"a":{"@_x":"<\\u0000cdata\\u0000>a&lt;b&amp;c</\\u0000cdata\\u0000>","#text":"t"}},"namespaces":{}}',
  },
  'D cdata comment': {
    xml: '<a><!-- <![CDATA[y]]> --></a>',
    outcome:
      'ok:{"content":{"a":{"#xml__comment":" <\\u0000cdata\\u0000>y</\\u0000cdata\\u0000> "}},"namespaces":{}}',
  },
  'D cdata overlap comment': {
    xml: '<a><!-- <![CDATA[ --> y ]]></a>',
    outcome: 'throw:XML parse error: tags unbalanced (final depth -1)',
  },
  'D cdata overlap attr': {
    xml: '<a x="<![CDATA[">y]]></a>',
    outcome: 'throw:XML parse error: tags unbalanced (final depth -1)',
  },
  'D cdata root': {
    xml: '<![CDATA[x]]><a>y</a>',
    outcome: 'ok:{"content":{"\\u0000cdata\\u0000":"x"},"namespaces":{}}',
  },
  'D cdata root ws': {
    xml: '<?xml version="1.0"?>\n<![CDATA[ ]]><a/>',
    outcome: 'ok:{"content":{"\\u0000cdata\\u0000":""},"namespaces":{}}',
  },
  'D lower cdata': {
    xml: '<a><![cdata[ x ]]></a>',
    outcome: 'ok:{"content":{"a":" x "},"namespaces":{}}',
  },
  'D lower cdata comment': {
    xml: '<a><![cdata[<!--x-->]]></a>',
    outcome: 'ok:{"content":{"a":{"#xml__comment":"x"}},"namespaces":{}}',
  },
  'D cdata unterminated': {
    xml: '<a><![CDATA[x></a>',
    outcome: 'ok:{"content":{"a":"x></a>"},"namespaces":{}}',
  },
  'D cdata script': {
    xml: '<a><script><![CDATA[x]]></script></a>',
    outcome:
      'ok:{"content":{"a":{"script":"<\\u0000cdata\\u0000>x</\\u0000cdata\\u0000>"}},"namespaces":{}}',
  },
  'D cdata pi': {
    xml: '<a><?pi <![CDATA[x]]>?></a>',
    outcome:
      'ok:{"content":{"a":{"?pi":{"@_cdata\\u0000":null,"#text":""},"#text":"x"}},"namespaces":{}}',
  },
  'D nul element': {
    xml: '<a><\u0000cdata\u0000>x</\u0000cdata\u0000></a>',
    outcome: 'ok:{"content":{"a":{"__cdata":"x"}},"namespaces":{}}',
  },
  'D nul element mixed': {
    xml: '<a><\u0000cdata\u0000>x<!--c--><b>1</b></\u0000cdata\u0000></a>',
    outcome: 'ok:{"content":{"a":{"__cdata":"x<!--c-->"}},"namespaces":{}}',
  },
  'D cdata error column': {
    xml: '<a><![CDATA[1\n2]]><bb></b></a>',
    outcome: 'throw:Unexpected close tag\nLine: 1\nColumn: 19\nChar: >',
  },
  'rewind growth style': {
    xml: '<rr>123<x><style>x</style ></x></rr>',
    outcome: 'throw:Maximum call stack size exceeded',
  },
  'rewind growth script': {
    xml: '<rrr>123<x><script>x</script ></x></rrr>',
    outcome: 'throw:Maximum call stack size exceeded',
  },
  'review pi in body': {
    xml: '<a><?pi x?><b>x</b></a>',
    outcome:
      'ok:{"content":{"a":{"?pi":{"@_x?":null,"#text":""},"b":"x"}},"namespaces":{}}',
  },
  'fuzz stray-quote unwind': {
    xml: '<ab x"a>b"/>',
    outcome:
      'ok:{"content":{"ab":{"@_x\\"a":null,"#text":"b\\"/>"}},"namespaces":{}}',
  },
  'fuzz missing attribute name unwind': {
    xml: '<fieldPermissions ="a>b"/>',
    outcome:
      'ok:{"content":{"fieldPermissions":{"@_a":null,"#text":"b\\"/>"}},"namespaces":{}}',
  },
  'fuzz malformed declaration': {
    xml: '<?xml version="1.0" encoding="UF-8?>\n<b></b>',
    outcome: 'ok:{"content":{},"namespaces":{}}',
  },
  'fuzz qmark self-close': {
    xml: '<xml version="1.0"?>\n<b></b></b>',
    outcome:
      'ok:{"content":{"xml":{"@_version":"1.0","#text":""}},"namespaces":{}}',
  },
  'fuzz CDATA inside a tag': {
    xml: '<a x="a>b"<![CDATA[!--x-->]]></a>',
    outcome: 'throw:XML parse error: tags unbalanced (final depth -1)',
  },
  'fuzz top-level CDATA no root': {
    xml: 'b><![CDATA[>]]>',
    outcome: 'ok:{"content":{"\\u0000cdata\\u0000":">"},"namespaces":{}}',
  },
}
