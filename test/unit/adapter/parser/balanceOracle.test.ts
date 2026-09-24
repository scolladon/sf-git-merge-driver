import { describe, expect, it } from 'vitest'
import { assertBalancedTags } from '../../../../src/adapter/parser/balanceOracle.js'
import {
  UNTERMINATED_COMMENT,
  UNTERMINATED_DECLARATION,
  UNTERMINATED_PROCESSING_INSTRUCTION,
  UNTERMINATED_TAG,
  unbalancedTags,
} from '../../../../src/adapter/parser/parseErrors.js'

describe('assertBalancedTags', () => {
  describe('given well-formed nested tags', () => {
    it('when called then it does not throw', () => {
      // Arrange
      const xml = '<a><b>x</b></a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a self-closing root element', () => {
    it('when called then depth stays balanced', () => {
      // Arrange
      const xml = '<a/>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given an unclosed element', () => {
    it('when called then it throws the unbalanced-depth message', () => {
      // Arrange
      const xml = '<?xml version="1.0"?><Profile><broken>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).toThrow(unbalancedTags(2))
    })
  })

  describe('given an extra closing tag', () => {
    it('when called then it throws with a negative final depth', () => {
      // Arrange
      const xml = '<a/></a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).toThrow(unbalancedTags(-1))
    })
  })

  describe('given an unterminated comment', () => {
    it('when called then it throws the comment-specific message', () => {
      // Arrange
      const xml = '<r><!-- never closes'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).toThrow(UNTERMINATED_COMMENT)
    })
  })

  describe('given an unterminated tag', () => {
    it('when called then it throws the tag-specific message', () => {
      // Arrange
      const xml = '<r><v'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).toThrow(UNTERMINATED_TAG)
    })
  })

  describe('given an unterminated processing instruction', () => {
    it('when called then it throws the PI-specific message', () => {
      // Arrange
      const xml = '<?xml version="1.0"'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).toThrow(UNTERMINATED_PROCESSING_INSTRUCTION)
    })
  })

  describe('given an unterminated non-comment declaration', () => {
    it('when called then it throws the declaration-specific message', () => {
      // Arrange
      const xml = '<!DOCTYPE r'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).toThrow(UNTERMINATED_DECLARATION)
    })
  })

  describe('given a well-formed DOCTYPE prologue', () => {
    it('when called then it does not throw', () => {
      // Arrange
      const xml = '<!DOCTYPE r SYSTEM "x.dtd"><r><v>1</v></r>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given trailing whitespace after the root element', () => {
    // Pins the `next < 0` break exit path: the scan loop finishes
    // iterating tags but the input still has unconsumed bytes.
    it('when called then the trailing whitespace is ignored', () => {
      // Arrange
      const xml = '<r><v>1</v></r>\n  \n'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a quote that appears only in text, never inside a tag', () => {
    it('when called then it is unaffected by the quote', () => {
      // Arrange
      const xml = `<a>it's "ok"</a>`

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a quoted attribute followed by a quote-free tag', () => {
    // A quote seen in an earlier tag must not unbalance a later,
    // quote-free one.
    it('when called then the trailing tag still balances', () => {
      // Arrange
      const xml = '<a><b x="1">t</b><c>u</c></a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a stray quote ahead of the real attribute quote in a tag', () => {
    it('when called then it throws the unterminated-tag message', () => {
      // Arrange
      const xml = '<a><b x"y="1">t</b></a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).toThrow(UNTERMINATED_TAG)
    })
  })

  describe('given a double quote character sitting exactly at the tag-scan cursor', () => {
    it('when called then the quote-aware scan still wins', () => {
      // Arrange
      const xml = `<"x>y"/>`

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a single quote character sitting exactly at the tag-scan cursor', () => {
    it('when called then the quote-aware scan still wins', () => {
      // Arrange
      const xml = `<'x>y'/>`

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given an attribute value containing > inside double quotes', () => {
    it('when called then the > is not mistaken for the tag terminator', () => {
      // Arrange
      const xml = '<r><v attr="a>b">x</v></r>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a self-closing tag whose double-quoted attribute contains >', () => {
    it('when called then depth tracking still ends at zero', () => {
      // Arrange
      const xml = '<r><v attr="a>b"/></r>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given an attribute value containing > inside single quotes', () => {
    it('when called then the > is not mistaken for the tag terminator', () => {
      // Arrange
      const xml = "<r><v attr='a>b'>x</v></r>"

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a self-closing tag whose single-quoted attribute contains >', () => {
    it('when called then depth tracking still ends at zero', () => {
      // Arrange
      const xml = "<r><v attr='a>b'/></r>"

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a comment body containing a stray < near its closing -->', () => {
    // Pins the `end + 3` resume offset: landing short would re-discover
    // the embedded '<' as a bogus open tag.
    it('when called then the comment resumes exactly after its own -->', () => {
      // Arrange
      const xml = '<a><!--<x-->y</a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a non-comment declaration containing an empty <> near its close', () => {
    // Pins the `end + 1` resume offset for the generic <! ... > branch.
    it('when called then the declaration resumes exactly after its own >', () => {
      // Arrange
      const xml = '<a><!x<>z</a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a processing instruction preceded by a stray literal ?>', () => {
    // Pins the `next + 2` search-from offset for the <? ?> branch.
    it('when called then the PI search does not latch onto the earlier ?>', () => {
      // Arrange
      const xml = '<a>?><?pi?>z</a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a processing instruction body containing a stray <', () => {
    // Pins the `end + 2` resume offset for the <? ?> branch.
    it('when called then the PI resumes exactly after its own ?>', () => {
      // Arrange
      const xml = '<a><?pi <x?>y</a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a CDATA section that closes properly', () => {
    it('when called then it does not throw', () => {
      // Arrange
      const xml = '<a><![CDATA[x]]></a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a CDATA section containing a < character', () => {
    // Pins that the new branch skips the whole section verbatim instead
    // of tripping over the embedded '<' as a bogus open tag.
    it('when called then the embedded < is not mistaken for a tag', () => {
      // Arrange
      const xml = '<a><![CDATA[<b>]]></a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a CDATA section whose content contains a > and a </close>-shaped run', () => {
    // If the CDATA branch ever failed to recognise or skip the section
    // (falling through to the generic <! ... > scan instead), the
    // generic scan's naive '>' search would stop at the '>' inside
    // "a>b" and then rediscover "</c>" as a real close tag — throwing
    // on a final depth of -1 instead of the correct, balanced 0.
    it('when called then the whole section is skipped and it does not throw', () => {
      // Arrange
      const xml = '<a><![CDATA[a>b</c>d]]></a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a ]]> sequence in plain text before an unrelated CDATA section', () => {
    // Pins the `next + CDATA_OPEN.length` search-from offset: searching
    // from before `next` instead would latch onto this earlier ']]>'
    // instead of the CDATA section's own closer.
    it('when called then the CDATA section still resolves against its own closer', () => {
      // Arrange
      const xml = '<a>]]><![CDATA[z]]></a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a CDATA section with no closing ]]>', () => {
    // Today's behaviour: the prepass never rewrote an unterminated
    // section, so this falls through to the generic <! ... > branch.
    it('when called then it falls through and throws the declaration message', () => {
      // Arrange
      const xml = '<a><![CDATA[x'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).toThrow(UNTERMINATED_DECLARATION)
    })
  })

  describe('given a lowercase cdata token, not matching CDATA_OPEN exactly', () => {
    // The third char is still `[`, so the cheap reject passes the CDATA
    // check through to its exact-string comparison, which then rejects
    // the case mismatch and falls through to the generic <! ... > skip.
    it('when called then it falls through and still balances', () => {
      // Arrange
      const xml = '<a><![cdata[x]]></a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })

  describe('given a comment token that closes before four characters', () => {
    it('when called then it rejects the comment as unterminated', () => {
      // Arrange
      const xml = '<a><!--></a>'

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).toThrow(UNTERMINATED_COMMENT)
    })
  })

  describe.each([
    ['<!-->', '<a><!-->t--></a>'],
    ['<!--->', '<a><!---> x --></a>'],
  ])('given the short comment opener %s with a later -->', (_, xml) => {
    it('when called then the comment runs to that --> and balances', () => {
      // Arrange — the input comes from the table above

      // Act
      const act = () => assertBalancedTags(xml)

      // Assert
      expect(act).not.toThrow()
    })
  })
})
