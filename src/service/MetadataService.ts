import type { JsonArray, JsonValue } from '../types/jsonTypes.js'

export class MetadataService {
  public static getKeyFieldExtractor(
    metadataType: string
  ): ((el: JsonValue) => string | undefined) | undefined {
    // `in` walks the prototype chain, so `'__proto__' in {}` is true —
    // metadataType is an untrusted XML tag name, and `__proto__` would
    // resolve to the inherited Object.prototype accessor instead of
    // undefined. Object.hasOwn checks own properties only.
    return Object.hasOwn(METADATA_KEY_EXTRACTORS, metadataType)
      ? METADATA_KEY_EXTRACTORS[
          metadataType as keyof typeof METADATA_KEY_EXTRACTORS
        ]
      : undefined
  }

  public static isOrderedAttribute(
    attribute: string,
    sides: readonly JsonArray[]
  ): boolean {
    if (!ORDERED_ATTRIBUTES.has(attribute)) return false
    const isUnorderedVariant = UNORDERED_VARIANTS.get(attribute)
    if (isUnorderedVariant === undefined) return true
    return !sides.some(side => side.some(isUnorderedVariant))
  }

  // MergeNodeFactory's own array-shape check (isStringArray) only sees an
  // attribute as a text array when the parser already produced 2+
  // occurrences on at least one side; an attribute with exactly one
  // occurrence on all three sides unboxes to a bare scalar and would
  // otherwise fall back to strict TextMergeNode comparison. Tags listed
  // here always get the set-union TextArrayMergeNode treatment regardless
  // of incidental cardinality, so the same edit produces the same outcome
  // whether the list currently has one entry or several.
  public static isTextArrayAttribute(attribute: string): boolean {
    return TEXT_ARRAY_ATTRIBUTES.has(attribute)
  }
}

const ORDERED_ATTRIBUTES = new Set([
  'customValue', // GlobalValueSet, Picklist CustomField
  'standardValue', // StandardValueSet
  'value', // Picklist CustomField
  'values', // RecordType
  'filterItems', // CustomField
  'summaryFilterItems', // CustomField
  'criteriaItems', // SharingRules, Workflow, AssignmentRules, AutoResponseRules, EscalationRules
  'prompts', // Translations
  'promptVersions', // Translations
])

const TEXT_ARRAY_ATTRIBUTES = new Set([
  'members', // Package, DestructiveChanges — manifest member list
])

const KEY_PART_SEPARATOR = '.'

// An object-shaped key field (element with attributes/children, built on
// Object.create(null) by the parser) has no inherited toString and would
// throw on String(). Report it as no key, like an absent one, so an
// unusable key field is skipped instead of crashing.
const getPropertyValue = (
  el: JsonValue,
  property: string
): string | undefined => {
  const value = (el as Record<string, unknown>)[property]
  if (value === undefined || (typeof value === 'object' && value !== null)) {
    return undefined
  }
  return String(value)
}

const isPresent = (part: string | undefined): part is string =>
  part !== undefined

const joinPresentParts = (
  parts: readonly (string | undefined)[]
): string | undefined => {
  const present = parts.filter(isPresent)
  return present.length === 0 ? undefined : present.join(KEY_PART_SEPARATOR)
}

// An absent half of a pair is still rendered as text so partial keys
// stay stable.
const joinPair = (
  first: string | undefined,
  second: string | undefined
): string | undefined =>
  first === undefined && second === undefined
    ? undefined
    : `${String(first)}-${String(second)}`

const getFilterItemKey = (el: JsonValue) => {
  const field = getPropertyValue(el, 'field')
  const operation = getPropertyValue(el, 'operation')
  const value = getPropertyValue(el, 'value')
  const valueField = getPropertyValue(el, 'valueField')
  return joinPresentParts([field, operation, value, valueField])
}

// The `picklistValues` element name is reused across two metadata
// schemas with different key fields:
//   - CustomObjectTranslation.fields[].picklistValues → keyed by `masterLabel`
//   - RecordType.picklistValues                       → keyed by `picklist`
// Without the fallback, every RecordType `<picklistValues>` block
// would have no key.
const getPicklistValuesKey = (el: JsonValue) =>
  getPropertyValue(el, 'masterLabel') ?? getPropertyValue(el, 'picklist')

// RecordType keys its picklist values by fullName; CustomMetadata reuses
// the element name and keys by field.
// The org does not store CustomMetadata values order; retrieve sorts them
// by field.
const isCustomMetadataValue = (el: JsonValue): boolean =>
  getPropertyValue(el, 'fullName') === undefined &&
  getPropertyValue(el, 'field') !== undefined

// A Map, not an object literal: the attribute is an untrusted tag name.
const UNORDERED_VARIANTS: ReadonlyMap<string, (el: JsonValue) => boolean> =
  new Map([['values', isCustomMetadataValue]])

const getValuesKey = (el: JsonValue) =>
  getPropertyValue(el, 'fullName') ?? getPropertyValue(el, 'field')

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
    return joinPresentParts([layout, recordType])
  }, // Profile
  loginFlows: (el: JsonValue) => getPropertyValue(el, 'friendlyName'), // Profile
  loginHours: (el: JsonValue) =>
    typeof el === 'object' && el !== null ? Object.keys(el).join(',') : '', // Profile
  loginIpRanges: (el: JsonValue) => {
    const startAddress = getPropertyValue(el, 'startAddress')
    const endAddress = getPropertyValue(el, 'endAddress')
    return joinPair(startAddress, endAddress)
  }, // Profile
  objectPermissions: (el: JsonValue) => getPropertyValue(el, 'object'), // Profile // PermissionSet
  pageAccesses: (el: JsonValue) => getPropertyValue(el, 'apexPage'), // Profile // PermissionSet
  profileActionOverrides: (el: JsonValue) => getPropertyValue(el, 'actionName'), // Profile
  recordTypeVisibilities: (el: JsonValue) => getPropertyValue(el, 'recordType'), // Profile // PermissionSet
  servicePresenceStatusAccesses: (el: JsonValue) =>
    getPropertyValue(el, 'servicePresenceStatus'), // Profile // PermissionSet
  tabVisibilities: (el: JsonValue) => getPropertyValue(el, 'tab'), // Profile // PermissionSet
  userPermissions: (el: JsonValue) => getPropertyValue(el, 'name'), // Profile // PermissionSet
  dataspaceScopes: (el: JsonValue) => getPropertyValue(el, 'dataspaceScope'), // PermissionSet
  emailRoutingAddressAccesses: (el: JsonValue) => getPropertyValue(el, 'name'), // PermissionSet
  externalCredentialPrincipalAccesses: (el: JsonValue) =>
    getPropertyValue(el, 'externalCredentialPrincipal'), // PermissionSet
  tabSettings: (el: JsonValue) => getPropertyValue(el, 'tab'), // PermissionSet
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
    return joinPair(fieldName, matchingMethod)
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
    return [name, section].find(isPresent)
  }, // Special thing because of types different// Translations // CustomObjectTranslation
  columns: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations
  scontrols: (el: JsonValue) => getPropertyValue(el, 'name'), // Translations

  caseValues: (el: JsonValue) => {
    const article = getPropertyValue(el, 'article')
    const caseType = getPropertyValue(el, 'caseType')
    const plural = getPropertyValue(el, 'plural')
    const possessive = getPropertyValue(el, 'possessive')
    return joinPresentParts([article, caseType, plural, possessive])
  }, // CustomObjectTranslation
  fieldSets: (el: JsonValue) => getPropertyValue(el, 'name'), // CustomObjectTranslation
  fields: (el: JsonValue) => getPropertyValue(el, 'name'), // CustomObjectTranslation
  picklistValues: getPicklistValuesKey, // CustomObjectTranslation (masterLabel) | RecordType (picklist)
  values: getValuesKey, // RecordType (fullName) | CustomMetadata (field)
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
