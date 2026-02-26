import type { JsonValue } from '../types/jsonTypes.js'

export class MetadataService {
  public static getKeyFieldExtractor(
    metadataType: string
  ): ((el: JsonValue) => string) | undefined {
    return metadataType in METADATA_KEY_EXTRACTORS
      ? METADATA_KEY_EXTRACTORS[
          metadataType as keyof typeof METADATA_KEY_EXTRACTORS
        ]
      : undefined
  }

  public static isOrderedAttribute(attribute: string): boolean {
    return ORDERED_ATTRIBUTES.has(attribute)
  }
}

const ORDERED_ATTRIBUTES = new Set([
  'customValue', // GlobalValueSet, Picklist CustomField
  'standardValue', // StandardValueSet
  'value', // Picklist CustomField
  'values', // RecordType
  'filterItems', // CustomField
  'summaryFilterItems', // CustomField
])

const getPropertyValue = (el: JsonValue, property: string) =>
  String((el as Record<string, unknown>)[property])

const getFilterItemKey = (el: JsonValue) => {
  const field = getPropertyValue(el, 'field')
  const operation = getPropertyValue(el, 'operation')
  const value = getPropertyValue(el, 'value')
  const valueField = getPropertyValue(el, 'valueField')
  return [field, operation, value, valueField]
    .filter(x => x !== String(undefined))
    .join('.')
}

const METADATA_KEY_EXTRACTORS = {
  labels: (el: JsonValue) => getPropertyValue(el, 'fullName'), // CustomLabels
  applicationVisibilities: (el: JsonValue) =>
    getPropertyValue(el, 'application'), // Profile // PermissionSet
  categoryGroupVisibilities: (el: JsonValue) =>
    getPropertyValue(el, 'dataCategoryGroup'), // Profile
  classAccesses: (el: JsonValue) => getPropertyValue(el, 'apexClass'), // Profile // PermissionSet
  customMetadataTypeAccesses: (el: JsonValue) => getPropertyValue(el, 'name'), // Profile // PermissionSet
  customPermissions: (el: JsonValue) => getPropertyValue(el, 'name'), // Profile // PermissionSet // PermissionSetLicenseDefinition
  customSettingAccesses: (el: JsonValue) => getPropertyValue(el, 'name'), // Profile // PermissionSet
  externalDataSourceAccesses: (el: JsonValue) =>
    getPropertyValue(el, 'externalDataSource'), // Profile // PermissionSet
  fieldPermissions: (el: JsonValue) => getPropertyValue(el, 'field'), // Profile // PermissionSet
  flowAccesses: (el: JsonValue) => getPropertyValue(el, 'flow'), // Profile // PermissionSet
  layoutAssignments: (el: JsonValue) => {
    const layout = getPropertyValue(el, 'layout')
    const recordType = getPropertyValue(el, 'recordType')
    return [layout, recordType].filter(x => x !== String(undefined)).join('.')
  }, // Profile
  loginFlows: (el: JsonValue) => getPropertyValue(el, 'friendlyname'), // Profile
  loginHours: (el: JsonValue) => Object.keys(el!).join(','), // Profile
  loginIpRanges: (el: JsonValue) => {
    const startAddress = getPropertyValue(el, 'startAddress')
    const endAddress = getPropertyValue(el, 'endAddress')
    return `${startAddress}-${endAddress}`
  }, // Profile
  objectPermissions: (el: JsonValue) => getPropertyValue(el, 'object'), // Profile // PermissionSet
  pageAccesses: (el: JsonValue) => getPropertyValue(el, 'apexPage'), // Profile // PermissionSet
  profileActionOverrides: (el: JsonValue) => getPropertyValue(el, 'actionName'), // Profile
  recordTypeVisibilities: (el: JsonValue) => getPropertyValue(el, 'recordType'), // Profile // PermissionSet
  tabVisibilities: (el: JsonValue) => getPropertyValue(el, 'tab'), // Profile // PermissionSet
  userPermissions: (el: JsonValue) => getPropertyValue(el, 'name'), // Profile // PermissionSet
  dataspaceScopes: (el: JsonValue) => getPropertyValue(el, 'dataspaceScope'), // PermissionSet
  emailRoutingAddressAccesses: (el: JsonValue) => getPropertyValue(el, 'name'), // PermissionSet
  externalCredentialPrincipalAccesses: (el: JsonValue) =>
    getPropertyValue(el, 'externalCredentialPrincipal'), // PermissionSet
  sharingCriteriaRules: (el: JsonValue) => getPropertyValue(el, 'fullName'), // SharingRules
  sharingGuestRules: (el: JsonValue) => getPropertyValue(el, 'fullName'), // SharingRules
  sharingOwnerRules: (el: JsonValue) => getPropertyValue(el, 'fullName'), // SharingRules
  sharingTerritoryRules: (el: JsonValue) => getPropertyValue(el, 'fullName'), // SharingRules
  criteriaItems: getFilterItemKey, // SharingRules // AssignmentRules // AutoResponseRules // EscalationRules
  filterItems: getFilterItemKey, // CustomField
  summaryFilterItems: getFilterItemKey, // CustomField
  valueSettings: (el: JsonValue) => getPropertyValue(el, 'valueName'), // CustomField
  // sharedTo: it should be a complete pure object compare and not an array comparison // SharingRules
  // accountSettings: it should be a complete pure object compare and not an array comparison // SharingRules
  alerts: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Workflow
  recipients: (el: JsonValue) => getPropertyValue(el, 'type'), // Workflow
  fieldUpdates: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Workflow
  flowActions: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Workflow
  flowInputs: (el: JsonValue) => getPropertyValue(el, 'name'), // Workflow
  flowAutomation: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Workflow
  knowledgePublishes: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Workflow
  outboundMessages: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Workflow
  rules: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Workflow
  actions: (el: JsonValue) => getPropertyValue(el, 'name'), // Workflow
  //workflowTimeTriggers: it should be a complete pure object compare and not an array comparison // Workflow
  send: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Workflow
  tasks: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Workflow
  assignmentRule: (el: JsonValue) => getPropertyValue(el, 'fullName'), // AssignmentRules
  //ruleEntry: it should be a complete pure object compare and not an array comparison // AssignmentRules // AutoResponseRules // EscalationRules
  autoResponseRule: (el: JsonValue) => getPropertyValue(el, 'fullName'), // AutoResponseRules
  escalationRule: (el: JsonValue) => getPropertyValue(el, 'fullName'), // EscalationRules
  marketingAppExtActions: (el: JsonValue) => getPropertyValue(el, 'apiName'), // MarketingAppExtension
  marketingAppExtActivities: (el: JsonValue) =>
    getPropertyValue(el, 'fullName'), // MarketingAppExtension
  matchingRules: (el: JsonValue) => getPropertyValue(el, 'fullName'), // MatchingRules
  matchingRuleItems: (el: JsonValue) => {
    const fieldName = getPropertyValue(el, 'fieldName')
    const matchingMethod = getPropertyValue(el, 'matchingMethod')
    return `${fieldName}-${matchingMethod}`
  }, // MatchingRules
  customValue: (el: JsonValue) => getPropertyValue(el, 'fullName'), // GlobalValueSet
  standardValue: (el: JsonValue) => getPropertyValue(el, 'fullName'), // StandardValueSet
  valueTranslation: (el: JsonValue) => getPropertyValue(el, 'masterLabel'), // GlobalValueSetTranslation // StandardValueSetTranslation
  botBlocks: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Translations
  botBlockVersions: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Translations
  botDialogs: (el: JsonValue) => getPropertyValue(el, 'developerName'), // Translations
  botSteps: (el: JsonValue) => getPropertyValue(el, 'stepIdentifier'), // Translations
  botMessages: (el: JsonValue) => getPropertyValue(el, 'messageIdentifier'), // Translations
  botVariableOperation: (el: JsonValue) =>
    getPropertyValue(el, 'variableOperationIdentifier'), // Translations
  botTemplates: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Translations
  bots: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Translations
  botVersions: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Translations
  conversationMessageDefinitions: (el: JsonValue) =>
    getPropertyValue(el, 'name'), // Translations
  constantValueTranslations: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  customApplications: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  customLabels: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  customPageWebLinks: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  customTabs: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  desFieldTemplateMessages: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  flowDefinitions: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Translations
  flows: (el: JsonValue) => getPropertyValue(el, 'fullName'), // Translations
  identityVerificationCustomFieldLabels: (el: JsonValue) =>
    getPropertyValue(el, 'name'), // Translations
  pipelineInspMetricConfigs: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  prompts: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  promptVersions: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  quickActions: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  reportTypes: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  sections: (el: JsonValue) => {
    const name = getPropertyValue(el, 'name') // Translations
    const section = getPropertyValue(el, 'section') // CustomObjectTranslation
    return [name, section].filter(x => x !== String(undefined))[0]
  }, // Special thing because of types different// Translations // CustomObjectTranslation
  columns: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  scontrols: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations

  caseValues: (el: JsonValue) => {
    const article = getPropertyValue(el, 'article')
    const caseType = getPropertyValue(el, 'caseType')
    const plural = getPropertyValue(el, 'plural')
    const possessive = getPropertyValue(el, 'possessive')
    return [article, caseType, plural, possessive]
      .filter(x => x !== String(undefined))
      .join('.')
  }, // CustomObjectTranslation
  fieldSets: (el: JsonValue) => getPropertyValue(el, 'name'), // CustomObjectTranslation
  fields: (el: JsonValue) => getPropertyValue(el, 'name'), // CustomObjectTranslation
  picklistValues: (el: JsonValue) => getPropertyValue(el, 'masterLabel'), // CustomObjectTranslation
  values: (el: JsonValue) => getPropertyValue(el, 'fullName'), // RecordType
  value: (el: JsonValue) => getPropertyValue(el, 'fullName'), // CustomField
  layouts: (el: JsonValue) => getPropertyValue(el, 'layout'), // CustomObjectTranslation
  quickActionParametersTranslation: (el: JsonValue) =>
    getPropertyValue(el, 'name'), // CustomObjectTranslation
  recordTypes: (el: JsonValue) => getPropertyValue(el, 'name'), // CustomObjectTranslation
  sharingReasons: (el: JsonValue) => getPropertyValue(el, 'name'), // CustomObjectTranslation
  standardFields: (el: JsonValue) => getPropertyValue(el, 'name'), // CustomObjectTranslation
  validationRules: (el: JsonValue) => getPropertyValue(el, 'name'), // CustomObjectTranslation
  webLinks: (el: JsonValue) => getPropertyValue(el, 'name'), // CustomObjectTranslation
  workflowTasks: (el: JsonValue) => getPropertyValue(el, 'name'), // CustomObjectTranslation
  // Package.xml (manifest file)
  types: (el: JsonValue) => getPropertyValue(el, 'name'), // Package - types keyed by metadata type name
}
