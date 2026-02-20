import {
  DEFAULT_ANCESTOR_CONFLICT_TAG,
  DEFAULT_CONFLICT_MARKER_SIZE,
  DEFAULT_LOCAL_CONFLICT_TAG,
  DEFAULT_OTHER_CONFLICT_TAG,
} from '../../../src/constant/conflictConstant.js'
import { XmlMerger } from '../../../src/merger/XmlMerger.js'
import type { MergeConfig } from '../../../src/types/conflictTypes.js'

const defaultConfig: MergeConfig = {
  conflictMarkerSize: DEFAULT_CONFLICT_MARKER_SIZE,
  ancestorConflictTag: DEFAULT_ANCESTOR_CONFLICT_TAG,
  localConflictTag: DEFAULT_LOCAL_CONFLICT_TAG,
  otherConflictTag: DEFAULT_OTHER_CONFLICT_TAG,
}

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

      it('should merge without conflict', () => {
        // Arrange
        const merger = new XmlMerger(defaultConfig)

        // Act
        const result = merger.mergeThreeWay(ancestor, local, other)

        // Assert
        expect(result.hasConflict).toBe(false)
      })

      it('should preserve the valueSet container', () => {
        // Arrange
        const merger = new XmlMerger(defaultConfig)

        // Act
        const result = merger.mergeThreeWay(ancestor, local, other)

        // Assert
        expect(result.output).toContain('<valueSet>')
        expect(result.output).toContain('</valueSet>')
      })

      it('should take other restricted value (true)', () => {
        // Arrange
        const merger = new XmlMerger(defaultConfig)

        // Act
        const result = merger.mergeThreeWay(ancestor, local, other)

        // Assert
        expect(result.output).toContain('<restricted>true</restricted>')
      })

      it('should contain only the 5 values from other', () => {
        // Arrange
        const merger = new XmlMerger(defaultConfig)

        // Act
        const result = merger.mergeThreeWay(ancestor, local, other)

        // Assert
        const valueMatches = result.output.match(/<fullName>/g)
        // 1 field fullName + 5 value fullNames = 6
        expect(valueMatches?.length).toBe(6)
      })

      it('should produce well-formed XML with correct structure', () => {
        // Arrange
        const merger = new XmlMerger(defaultConfig)

        // Act
        const result = merger.mergeThreeWay(ancestor, local, other)

        // Assert
        expect(result.output).toContain('<valueSetDefinition>')
        expect(result.output).toContain('</valueSetDefinition>')
        // restricted must be inside valueSet, not a direct child of CustomField
        const betweenFieldAndValueSet = result.output.match(
          /<CustomField[^>]*>([\s\S]*?)<valueSet>/
        )?.[1]
        expect(betweenFieldAndValueSet).not.toContain('<restricted>')
      })
    })
  })
})
