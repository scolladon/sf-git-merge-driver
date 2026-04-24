# 15-cdata-closing

CDATA block containing `]]>`. Audit result: current fxb emits
`<![CDATA[a ]]]]><![CDATA[> b]]>`. Pins the escape pattern
`]]]]><![CDATA[>` used by the new emitter.
