/**
 * Note: KEY_FIELD_METADATA has been moved to MetadataService
 * @see MetadataService for key field extraction logic
 */

export const METADATA_TYPES_PATTERNS = [
  'labels', // CustomLabels
  'label', // CustomLabels decomposed
  'profile', // Profile
  'permissionset', // PermissionSet
  'applicationVisibility', // PermissionSet decomposed
  'classAccess',
  'customMetadataTypeAccess',
  'customPermission',
  'customSettingAccess',
  'externalCredentialPrincipalAccess',
  'externalDataSourceAccess',
  'fieldPermission',
  'flowAccess',
  'objectPermission',
  'pageAccess',
  'recordTypeVisibility',
  'tabSetting',
  'userPermission',
  'objectSettings',
  'permissionsetgroup', // PermissionSetGroup
  'permissionSetLicenseDefinition', // PermissionSetLicenseDefinition
  'mutingpermissionset', // MutingPermissionSet
  'sharingRules', // SharingRules
  'sharingCriteriaRule', // SharingRules decomposed
  'sharingGuestRule',
  'sharingOwnerRule',
  'sharingTerritoryRule',
  'workflow', // Workflow
  'workflowAlert', // Workflow decomposed
  'workflowFieldUpdate',
  'workflowFlowAction',
  'workflowKnowledgePublish',
  'workflowOutboundMessage',
  'workflowRule',
  'workflowSend',
  'workflowTask',
  'assignmentRules', // AssignmentRules
  'autoResponseRules', // AutoResponseRules
  'escalationRules', // EscalationRules
  'marketingappextension', // MarketingAppExtension
  'matchingRule', // MatchingRules
  'globalValueSet', // ValueSets
  'standardValueSet',
  'globalValueSetTranslation', // ValueSets translation
  'standardValueSetTranslation',
  'translation', // Translations
  'objectTranslation', // CustomObjectTranslation
]
