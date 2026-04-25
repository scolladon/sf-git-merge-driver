import { describe, expect, it } from 'vitest'
import { TxmlXmlParser } from '../../src/adapter/TxmlXmlParser.js'
import { XmlMerger } from '../../src/merger/XmlMerger.js'
import { mergeXmlStrings } from '../utils/mergeXmlStrings.js'
import { defaultConfig } from '../utils/testConfig.js'

// Use the same parser the production pipeline uses for assertions
// over the merge output. The shape is compact JsonObject — repeated
// children collapse into arrays, attributes are `@_`-prefixed, and
// scalar values stay as strings (no number/boolean coercion).
const parser = new TxmlXmlParser()
const parseXml = (xml: string): Record<string, unknown> =>
  parser.parseString(xml).content as Record<string, unknown>

describe('CustomField picklist merge (issue #174)', () => {
  describe('given a CustomField with inline picklist valueSet', () => {
    const ancestor = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Conditions_de_Paiement__c</fullName>
    <description>Conditions de paiement</description>
    <label>Conditions de paiement</label>
    <required>false</required>
    <trackHistory>false</trackHistory>
    <type>Picklist</type>
    <valueSet>
        <restricted>false</restricted>
        <valueSetDefinition>
            <sorted>false</sorted>
            <value>
                <fullName>Date de facture</fullName>
                <default>false</default>
                <isActive>false</isActive>
                <label>Date de facture</label>
            </value>
            <value>
                <fullName>Fin de mois</fullName>
                <default>false</default>
                <isActive>false</isActive>
                <label>Fin de mois</label>
            </value>
            <value>
                <fullName>Fin de mois 45 jours</fullName>
                <default>false</default>
                <isActive>false</isActive>
                <label>Fin de mois 45 jours</label>
            </value>
            <value>
                <fullName>Fin de decade</fullName>
                <default>false</default>
                <isActive>false</isActive>
                <label>Fin de decade</label>
            </value>
            <value>
                <fullName>Paiement immediat</fullName>
                <default>false</default>
                <isActive>false</isActive>
                <label>Paiement immediat (virement)</label>
            </value>
            <value>
                <fullName>30 jours</fullName>
                <default>false</default>
                <label>30 jours</label>
            </value>
            <value>
                <fullName>45 jours</fullName>
                <default>false</default>
                <label>45 jours</label>
            </value>
            <value>
                <fullName>60 jours</fullName>
                <default>false</default>
                <label>60 jours</label>
            </value>
            <value>
                <fullName>90 jours</fullName>
                <default>false</default>
                <label>90 jours</label>
            </value>
            <value>
                <fullName>Aucun</fullName>
                <default>false</default>
                <label>Aucun</label>
            </value>
        </valueSetDefinition>
    </valueSet>
</CustomField>`

    describe('when other changes restricted and removes values while local is unchanged', () => {
      const local = ancestor

      const other = `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Conditions_de_Paiement__c</fullName>
    <description>Conditions de paiement</description>
    <label>Conditions de paiement</label>
    <required>false</required>
    <trackHistory>false</trackHistory>
    <type>Picklist</type>
    <valueSet>
        <restricted>true</restricted>
        <valueSetDefinition>
            <sorted>false</sorted>
            <value>
                <fullName>Date de facture</fullName>
                <default>false</default>
                <label>Date de facture</label>
            </value>
            <value>
                <fullName>Fin de mois</fullName>
                <default>false</default>
                <label>Fin de mois</label>
            </value>
            <value>
                <fullName>Fin de mois 45 jours</fullName>
                <default>false</default>
                <label>Fin de mois 45 jours</label>
            </value>
            <value>
                <fullName>Fin de decade</fullName>
                <default>false</default>
                <label>Fin de decade</label>
            </value>
            <value>
                <fullName>Paiement immediat</fullName>
                <default>false</default>
                <label>Paiement immediat (virement)</label>
            </value>
        </valueSetDefinition>
    </valueSet>
</CustomField>`

      it('should merge without conflict', async () => {
        // Arrange
        const merger = new XmlMerger(defaultConfig)

        // Act
        const result = await mergeXmlStrings(merger, ancestor, local, other)

        // Assert
        expect(result.hasConflict).toBe(false)
      })

      it('should produce well-formed XML matching other version structure', async () => {
        // Arrange
        const merger = new XmlMerger(defaultConfig)

        // Act
        const result = await mergeXmlStrings(merger, ancestor, local, other)
        const parsed = parseXml(result.output)
        // Shape under test: CustomField → valueSet → valueSetDefinition →
        // value[]. TxmlXmlParser returns the merged tree as JsonObject
        // (compact form); cast to navigate without spreading `as` casts
        // through every property access.
        type ValueSet = {
          restricted: string
          valueSetDefinition: {
            sorted: string
            value: { fullName: string }[]
          }
        }
        const field = parsed['CustomField'] as { valueSet: ValueSet }
        const valueSet = field.valueSet
        const definition = valueSet.valueSetDefinition
        const values = definition.value

        // Assert
        expect(valueSet).toBeDefined()
        // TxmlXmlParser keeps scalars as strings (no implicit
        // boolean/number coercion); the previous assertion against
        // `true`/`false` relied on fast-xml-parser's default coercion.
        expect(valueSet.restricted).toBe('true')
        expect(definition).toBeDefined()
        expect(definition.sorted).toBe('false')
        expect(values).toHaveLength(5)
        expect(values.map(v => v.fullName)).toEqual([
          'Date de facture',
          'Fin de mois',
          'Fin de mois 45 jours',
          'Fin de decade',
          'Paiement immediat',
        ])
      })

      it('should not leak valueSet children to CustomField level', async () => {
        // Arrange
        const merger = new XmlMerger(defaultConfig)

        // Act
        const result = await mergeXmlStrings(merger, ancestor, local, other)
        const field = parseXml(result.output)['CustomField'] as Record<
          string,
          unknown
        >

        // Assert
        expect(field).not.toHaveProperty('restricted')
        expect(field).not.toHaveProperty('valueSetDefinition')
        expect(field).not.toHaveProperty('sorted')
      })
    })
  })
})
