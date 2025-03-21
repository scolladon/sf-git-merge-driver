import { MetadataService } from '../../../src/service/MetadataService.js'
import { JsonValue } from '../../../src/types/jsonTypes.js'

describe('MetadataService', () => {
  let metadataService: MetadataService

  beforeEach(() => {
    metadataService = new MetadataService()
  })

  describe('getKeyFieldExtractor', () => {
    describe('given a valid metadata type', () => {
      const testCases = [
        // fullName extractors
        {
          name: 'handles marketingAppExtActivities with fullName',
          metadataType: 'marketingAppExtActivities',
          testObject: { fullName: 'TestActivity' },
          expected: 'TestActivity',
        },
        {
          name: 'handles alerts with fullName',
          metadataType: 'alerts',
          testObject: { fullName: 'TestAlert' },
          expected: 'TestAlert',
        },
        {
          name: 'handles fieldUpdates with fullName',
          metadataType: 'fieldUpdates',
          testObject: { fullName: 'TestFieldUpdate' },
          expected: 'TestFieldUpdate',
        },
        {
          name: 'handles flowActions with fullName',
          metadataType: 'flowActions',
          testObject: { fullName: 'TestFlowAction' },
          expected: 'TestFlowAction',
        },
        {
          name: 'handles outboundMessages with fullName',
          metadataType: 'outboundMessages',
          testObject: { fullName: 'TestOutboundMessage' },
          expected: 'TestOutboundMessage',
        },
        {
          name: 'handles rules with fullName',
          metadataType: 'rules',
          testObject: { fullName: 'TestRule' },
          expected: 'TestRule',
        },
        {
          name: 'handles knowledgePublishes with fullName',
          metadataType: 'knowledgePublishes',
          testObject: { fullName: 'TestKnowledgePublish' },
          expected: 'TestKnowledgePublish',
        },
        {
          name: 'handles tasks with fullName',
          metadataType: 'tasks',
          testObject: { fullName: 'TestTask' },
          expected: 'TestTask',
        },
        {
          name: 'handles send with fullName',
          metadataType: 'send',
          testObject: { fullName: 'TestSend' },
          expected: 'TestSend',
        },
        {
          name: 'handles sharingCriteriaRules with fullName',
          metadataType: 'sharingCriteriaRules',
          testObject: { fullName: 'TestSharingCriteriaRule' },
          expected: 'TestSharingCriteriaRule',
        },
        {
          name: 'handles sharingGuestRules with fullName',
          metadataType: 'sharingGuestRules',
          testObject: { fullName: 'TestSharingGuestRule' },
          expected: 'TestSharingGuestRule',
        },
        {
          name: 'handles sharingOwnerRules with fullName',
          metadataType: 'sharingOwnerRules',
          testObject: { fullName: 'TestSharingOwnerRule' },
          expected: 'TestSharingOwnerRule',
        },
        {
          name: 'handles sharingTerritoryRules with fullName',
          metadataType: 'sharingTerritoryRules',
          testObject: { fullName: 'TestSharingTerritoryRule' },
          expected: 'TestSharingTerritoryRule',
        },
        {
          name: 'handles assignmentRule with fullName',
          metadataType: 'assignmentRule',
          testObject: { fullName: 'TestAssignmentRule' },
          expected: 'TestAssignmentRule',
        },
        {
          name: 'handles autoResponseRule with fullName',
          metadataType: 'autoResponseRule',
          testObject: { fullName: 'TestAutoResponseRule' },
          expected: 'TestAutoResponseRule',
        },
        {
          name: 'handles escalationRule with fullName',
          metadataType: 'escalationRule',
          testObject: { fullName: 'TestEscalationRule' },
          expected: 'TestEscalationRule',
        },
        {
          name: 'handles matchingRules with fullName',
          metadataType: 'matchingRules',
          testObject: { fullName: 'TestMatchingRule' },
          expected: 'TestMatchingRule',
        },
        {
          name: 'handles bots with fullName',
          metadataType: 'bots',
          testObject: { fullName: 'TestBot' },
          expected: 'TestBot',
        },
        {
          name: 'handles flowDefinitions with fullName',
          metadataType: 'flowDefinitions',
          testObject: { fullName: 'TestFlowDefinition' },
          expected: 'TestFlowDefinition',
        },
        {
          name: 'handles standardValue with fullName',
          metadataType: 'standardValue',
          testObject: { fullName: 'TestStandardValue' },
          expected: 'TestStandardValue',
        },
        {
          name: 'handles customValue with fullName',
          metadataType: 'customValue',
          testObject: { fullName: 'TestCustomValue' },
          expected: 'TestCustomValue',
        },
        {
          name: 'handles labels with fullName',
          metadataType: 'labels',
          testObject: { fullName: 'TestLabel' },
          expected: 'TestLabel',
        },

        // Other property extractors
        {
          name: 'handles valueTranslation with masterLabel',
          metadataType: 'valueTranslation',
          testObject: { masterLabel: 'TestMasterLabel' },
          expected: 'TestMasterLabel',
        },
        {
          name: 'handles categoryGroupVisibilities with dataCategoryGroup',
          metadataType: 'categoryGroupVisibilities',
          testObject: { dataCategoryGroup: 'TestCategoryGroup' },
          expected: 'TestCategoryGroup',
        },
        {
          name: 'handles applicationVisibilities with application',
          metadataType: 'applicationVisibilities',
          testObject: { application: 'TestApplication' },
          expected: 'TestApplication',
        },
        {
          name: 'handles classAccesses with apexClass',
          metadataType: 'classAccesses',
          testObject: { apexClass: 'TestApexClass' },
          expected: 'TestApexClass',
        },
        {
          name: 'handles customMetadataTypeAccesses with name',
          metadataType: 'customMetadataTypeAccesses',
          testObject: { name: 'TestCustomMetadataType' },
          expected: 'TestCustomMetadataType',
        },
        {
          name: 'handles customPermissions with name',
          metadataType: 'customPermissions',
          testObject: { name: 'TestCustomPermission' },
          expected: 'TestCustomPermission',
        },
        {
          name: 'handles customSettingAccesses with name',
          metadataType: 'customSettingAccesses',
          testObject: { name: 'TestCustomSetting' },
          expected: 'TestCustomSetting',
        },
        {
          name: 'handles externalDataSourceAccesses with externalDataSource',
          metadataType: 'externalDataSourceAccesses',
          testObject: { externalDataSource: 'TestExternalDataSource' },
          expected: 'TestExternalDataSource',
        },
        {
          name: 'handles fieldPermissions with field',
          metadataType: 'fieldPermissions',
          testObject: { field: 'Account.Name' },
          expected: 'Account.Name',
        },
        {
          name: 'handles flowAccesses with flow',
          metadataType: 'flowAccesses',
          testObject: { flow: 'TestFlow' },
          expected: 'TestFlow',
        },
        {
          name: 'handles loginFlows with friendlyname',
          metadataType: 'loginFlows',
          testObject: { friendlyname: 'TestLoginFlow' },
          expected: 'TestLoginFlow',
        },
        {
          name: 'handles objectPermissions with object',
          metadataType: 'objectPermissions',
          testObject: { object: 'TestObject' },
          expected: 'TestObject',
        },
        {
          name: 'handles pageAccesses with apexPage',
          metadataType: 'pageAccesses',
          testObject: { apexPage: 'TestApexPage' },
          expected: 'TestApexPage',
        },
        {
          name: 'handles profileActionOverrides with actionName',
          metadataType: 'profileActionOverrides',
          testObject: { actionName: 'TestActionName' },
          expected: 'TestActionName',
        },
        {
          name: 'handles recordTypeVisibilities with recordType',
          metadataType: 'recordTypeVisibilities',
          testObject: { recordType: 'TestRecordType' },
          expected: 'TestRecordType',
        },
        {
          name: 'handles tabVisibilities with tab',
          metadataType: 'tabVisibilities',
          testObject: { tab: 'TestTab' },
          expected: 'TestTab',
        },
        {
          name: 'handles userPermissions with name',
          metadataType: 'userPermissions',
          testObject: { name: 'TestUserPermission' },
          expected: 'TestUserPermission',
        },
        {
          name: 'handles customApplications with name',
          metadataType: 'customApplications',
          testObject: { name: 'TestCustomApplication' },
          expected: 'TestCustomApplication',
        },
        {
          name: 'handles customLabels with name',
          metadataType: 'customLabels',
          testObject: { name: 'TestCustomLabel' },
          expected: 'TestCustomLabel',
        },
        {
          name: 'handles customPageWebLinks with name',
          metadataType: 'customPageWebLinks',
          testObject: { name: 'TestCustomPageWebLink' },
          expected: 'TestCustomPageWebLink',
        },
        {
          name: 'handles customTabs with name',
          metadataType: 'customTabs',
          testObject: { name: 'TestCustomTab' },
          expected: 'TestCustomTab',
        },
        {
          name: 'handles pipelineInspMetricConfigs with name',
          metadataType: 'pipelineInspMetricConfigs',
          testObject: { name: 'TestPipelineInspMetricConfig' },
          expected: 'TestPipelineInspMetricConfig',
        },
        {
          name: 'handles prompts with name',
          metadataType: 'prompts',
          testObject: { name: 'TestPrompt' },
          expected: 'TestPrompt',
        },
        {
          name: 'handles quickActions with name',
          metadataType: 'quickActions',
          testObject: { name: 'TestQuickAction' },
          expected: 'TestQuickAction',
        },
        {
          name: 'handles reportTypes with name',
          metadataType: 'reportTypes',
          testObject: { name: 'TestReportType' },
          expected: 'TestReportType',
        },
        {
          name: 'handles scontrols with name',
          metadataType: 'scontrols',
          testObject: { name: 'TestScontrol' },
          expected: 'TestScontrol',
        },

        // Complex extractors
        {
          name: 'handles layoutAssignments with layout and recordType',
          metadataType: 'layoutAssignments',
          testObject: {
            layout: 'TestLayout',
            recordType: 'TestRecordType',
          },
          expected: 'TestLayout.TestRecordType',
        },
        {
          name: 'handles layoutAssignments with only layout',
          metadataType: 'layoutAssignments',
          testObject: {
            layout: 'TestLayout',
          },
          expected: 'TestLayout',
        },
        {
          name: 'handles loginHours correctly',
          metadataType: 'loginHours',
          testObject: { monday: true, wednesday: true },
          expected: 'monday,wednesday',
        },
        {
          name: 'handles loginIpRanges correctly',
          metadataType: 'loginIpRanges',
          testObject: {
            startAddress: '192.168.1.1',
            endAddress: '192.168.1.255',
          },
          expected: '192.168.1.1-192.168.1.255',
        },
      ]

      test.each(testCases)(
        '$name',
        ({ metadataType, testObject, expected }) => {
          // Act
          const extractor = metadataService.getKeyFieldExtractor(metadataType)

          // Assert
          expect(extractor).toBeDefined()
          expect(extractor!(testObject as unknown as JsonValue)).toBe(expected)
        }
      )
    })

    describe('given a metadata type not in the extractors', () => {
      it('should return undefined', () => {
        // Arrange
        const metadataType = 'nonExistentType'

        // Act
        const extractor = metadataService.getKeyFieldExtractor(metadataType)

        // Assert
        expect(extractor).toBeUndefined()
      })
    })
  })
})
