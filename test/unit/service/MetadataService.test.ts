import { MetadataService } from '../../../src/service/MetadataService.js'
import { JsonValue } from '../../../src/types/jsonTypes.js'

describe('MetadataService', () => {
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
        // Package.xml (manifest file) extractors
        {
          name: 'handles types with name (for package.xml)',
          metadataType: 'types',
          testObject: { name: 'ApexClass', members: ['MyClass'] },
          expected: 'ApexClass',
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
        {
          name: 'handles dataspaceScopes with dataspaceScope',
          metadataType: 'dataspaceScopes',
          testObject: { dataspaceScope: 'TestDataspaceScope' },
          expected: 'TestDataspaceScope',
        },
        {
          name: 'handles emailRoutingAddressAccesses with name',
          metadataType: 'emailRoutingAddressAccesses',
          testObject: { name: 'TestEmailRoutingAddress' },
          expected: 'TestEmailRoutingAddress',
        },
        {
          name: 'handles externalCredentialPrincipalAccesses with externalCredentialPrincipal',
          metadataType: 'externalCredentialPrincipalAccesses',
          testObject: { externalCredentialPrincipal: 'TestPrincipal' },
          expected: 'TestPrincipal',
        },
        {
          name: 'handles criteriaItems with field, operation, value, and valueField',
          metadataType: 'criteriaItems',
          testObject: {
            field: 'TestField',
            operation: 'TestOperation',
            value: 'TestValue',
            valueField: 'TestValueField',
          },
          expected: 'TestField.TestOperation.TestValue.TestValueField',
        },
        {
          name: 'handles recipients with type',
          metadataType: 'recipients',
          testObject: { type: 'TestRecipient' },
          expected: 'TestRecipient',
        },
        {
          name: 'handles flowInputs with name',
          metadataType: 'flowInputs',
          testObject: { name: 'TestFlowInput' },
          expected: 'TestFlowInput',
        },
        {
          name: 'handles flowAutomation with fullName',
          metadataType: 'flowAutomation',
          testObject: { fullName: 'TestFlowAutomation' },
          expected: 'TestFlowAutomation',
        },
        {
          name: 'handles actions with name',
          metadataType: 'actions',
          testObject: { name: 'TestAction' },
          expected: 'TestAction',
        },
        {
          name: 'handles marketingAppExtActions with apiName',
          metadataType: 'marketingAppExtActions',
          testObject: { apiName: 'TestMarketingAppExtAction' },
          expected: 'TestMarketingAppExtAction',
        },
        {
          name: 'handles matchingRuleItems with fieldName and matchingMethod',
          metadataType: 'matchingRuleItems',
          testObject: { fieldName: 'TestField', matchingMethod: 'TestMethod' },
          expected: 'TestField-TestMethod',
        },
        {
          name: 'handles botTemplates with fullName',
          metadataType: 'botTemplates',
          testObject: { fullName: 'TestBotTemplate' },
          expected: 'TestBotTemplate',
        },
        {
          name: 'handles botVersions with fullName',
          metadataType: 'botVersions',
          testObject: { fullName: 'TestBotVersion' },
          expected: 'TestBotVersion',
        },
        {
          name: 'handles conversationMessageDefinitions with name',
          metadataType: 'conversationMessageDefinitions',
          testObject: { name: 'TestConversationMessageDefinition' },
          expected: 'TestConversationMessageDefinition',
        },
        {
          name: 'handles constantValueTranslations with name',
          metadataType: 'constantValueTranslations',
          testObject: { name: 'TestConstantValue' },
          expected: 'TestConstantValue',
        },
        {
          name: 'handles desFieldTemplateMessages with name',
          metadataType: 'desFieldTemplateMessages',
          testObject: { name: 'TestDesFieldTemplateMessage' },
          expected: 'TestDesFieldTemplateMessage',
        },
        {
          name: 'handles flows with fullName',
          metadataType: 'flows',
          testObject: { fullName: 'TestFlow' },
          expected: 'TestFlow',
        },
        {
          name: 'handles identityVerificationCustomFieldLabels with name',
          metadataType: 'identityVerificationCustomFieldLabels',
          testObject: { name: 'TestIdentityVerificationCustomFieldLabel' },
          expected: 'TestIdentityVerificationCustomFieldLabel',
        },
        {
          name: 'handles promptVersions with name',
          metadataType: 'promptVersions',
          testObject: { name: 'TestPromptVersion' },
          expected: 'TestPromptVersion',
        },
        {
          name: 'handles botBlocks with fullName',
          metadataType: 'botBlocks',
          testObject: { fullName: 'TestBotBlock' },
          expected: 'TestBotBlock',
        },
        {
          name: 'handles botBlockVersions with fullName',
          metadataType: 'botBlockVersions',
          testObject: { fullName: 'TestBotBlockVersion' },
          expected: 'TestBotBlockVersion',
        },
        {
          name: 'handles botDialogs with developerName',
          metadataType: 'botDialogs',
          testObject: { developerName: 'TestBotDialog' },
          expected: 'TestBotDialog',
        },
        {
          name: 'handles botSteps with stepIdentifier',
          metadataType: 'botSteps',
          testObject: { stepIdentifier: 'TestStep' },
          expected: 'TestStep',
        },
        {
          name: 'handles botMessages with messageIdentifier',
          metadataType: 'botMessages',
          testObject: { messageIdentifier: 'TestMessage' },
          expected: 'TestMessage',
        },
        {
          name: 'handles botVariableOperation with variableOperationIdentifier',
          metadataType: 'botVariableOperation',
          testObject: { variableOperationIdentifier: 'TestOperation' },
          expected: 'TestOperation',
        },
        {
          name: 'handles sections with name or section',
          metadataType: 'sections',
          testObject: { name: 'TestSectionName', section: 'TestSection' },
          expected: 'TestSectionName',
        },
        {
          name: 'handles columns with name',
          metadataType: 'columns',
          testObject: { name: 'TestColumn' },
          expected: 'TestColumn',
        },
        {
          name: 'handles caseValues with article, caseType, plural, and possessive',
          metadataType: 'caseValues',
          testObject: {
            article: 'TestArticle',
            caseType: 'TestCaseType',
            plural: 'TestPlural',
            possessive: 'TestPossessive',
          },
          expected: 'TestArticle.TestCaseType.TestPlural.TestPossessive',
        },
        {
          name: 'handles fieldSets with name',
          metadataType: 'fieldSets',
          testObject: { name: 'TestFieldSet' },
          expected: 'TestFieldSet',
        },
        {
          name: 'handles fields with name',
          metadataType: 'fields',
          testObject: { name: 'TestField' },
          expected: 'TestField',
        },
        {
          name: 'handles picklistValues with masterLabel',
          metadataType: 'picklistValues',
          testObject: { masterLabel: 'TestPicklistValue' },
          expected: 'TestPicklistValue',
        },
        {
          name: 'handles layouts with layout',
          metadataType: 'layouts',
          testObject: { layout: 'TestLayout' },
          expected: 'TestLayout',
        },
        {
          name: 'handles quickActionParametersTranslation with name',
          metadataType: 'quickActionParametersTranslation',
          testObject: { name: 'TestQuickActionParam' },
          expected: 'TestQuickActionParam',
        },
        {
          name: 'handles recordTypes with name',
          metadataType: 'recordTypes',
          testObject: { name: 'TestRecordType' },
          expected: 'TestRecordType',
        },
        {
          name: 'handles sharingReasons with name',
          metadataType: 'sharingReasons',
          testObject: { name: 'TestSharingReason' },
          expected: 'TestSharingReason',
        },
        {
          name: 'handles standardFields with name',
          metadataType: 'standardFields',
          testObject: { name: 'TestStandardField' },
          expected: 'TestStandardField',
        },
        {
          name: 'handles validationRules with name',
          metadataType: 'validationRules',
          testObject: { name: 'TestValidationRule' },
          expected: 'TestValidationRule',
        },
        {
          name: 'handles webLinks with name',
          metadataType: 'webLinks',
          testObject: { name: 'TestWebLink' },
          expected: 'TestWebLink',
        },
        {
          name: 'handles workflowTasks with name',
          metadataType: 'workflowTasks',
          testObject: { name: 'TestWorkflowTask' },
          expected: 'TestWorkflowTask',
        },
        {
          name: 'handles values with fullName (RecordType)',
          metadataType: 'values',
          testObject: { fullName: 'TestRecordTypeValue' },
          expected: 'TestRecordTypeValue',
        },
        {
          name: 'handles value with fullName (CustomField)',
          metadataType: 'value',
          testObject: { fullName: 'TestCustomFieldValue' },
          expected: 'TestCustomFieldValue',
        },
        {
          name: 'handles valueSettings with valueName (CustomField)',
          metadataType: 'valueSettings',
          testObject: { valueName: 'TestValueSetting' },
          expected: 'TestValueSetting',
        },
      ]

      it.each(testCases)('$name', ({ metadataType, testObject, expected }) => {
        // Act
        const extractor = MetadataService.getKeyFieldExtractor(metadataType)

        // Assert
        expect(extractor).toBeDefined()
        expect(extractor!(testObject as unknown as JsonValue)).toBe(expected)
      })
    })

    describe('given a metadata type not in the extractors', () => {
      it('should return undefined', () => {
        // Arrange
        const metadataType = 'nonExistentType'

        // Act
        const extractor = MetadataService.getKeyFieldExtractor(metadataType)

        // Assert
        expect(extractor).toBeUndefined()
      })
    })
  })

  describe('isOrderedAttribute', () => {
    it.each([
      'customValue',
      'standardValue',
      'values',
      'value',
      'filterItems',
      'summaryFilterItems',
    ])('should return true for %s', attribute => {
      // Act
      const result = MetadataService.isOrderedAttribute(attribute)

      // Assert
      expect(result).toBe(true)
    })

    it.each([
      'fullName',
      'masterLabel',
      'dataCategoryGroup',
      'application',
      'profile',
      'field',
      'recordType',
      'sharingReason',
      'standardField',
      'validationRule',
      'webLink',
      'workflowTask',
    ])('should return false for %s', attribute => {
      // Act
      const result = MetadataService.isOrderedAttribute(attribute)

      // Assert
      expect(result).toBe(false)
    })
  })
})
