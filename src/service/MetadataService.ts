import { JsonValue } from '../types/jsonTypes.js'

export class MetadataService {
  public getKeyFieldExtractor(
    metadataType: string
  ): ((el: JsonValue) => string) | undefined {
    return metadataType in METADATA_KEY_EXTRACTORS
      ? METADATA_KEY_EXTRACTORS[
          metadataType as keyof typeof METADATA_KEY_EXTRACTORS
        ]
      : undefined
  }
}

const getPropertyValue = (el: JsonValue, property: string) =>
  String((el as Record<string, unknown>)[property])
const METADATA_KEY_EXTRACTORS = {
  marketingAppExtActivities: (el: JsonValue) =>
    getPropertyValue(el, 'fullName'),
  alerts: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  fieldUpdates: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  flowActions: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  outboundMessages: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  rules: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  knowledgePublishes: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  tasks: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  send: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  sharingCriteriaRules: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  sharingGuestRules: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  sharingOwnerRules: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  sharingTerritoryRules: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  assignmentRule: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  autoResponseRule: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  escalationRule: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  matchingRules: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  valueTranslation: (el: JsonValue) => getPropertyValue(el, 'masterLabel'),
  categoryGroupVisibilities: (el: JsonValue) =>
    getPropertyValue(el, 'dataCategoryGroup'),
  applicationVisibilities: (el: JsonValue) =>
    getPropertyValue(el, 'application'),
  classAccesses: (el: JsonValue) => getPropertyValue(el, 'apexClass'),
  customMetadataTypeAccesses: (el: JsonValue) => getPropertyValue(el, 'name'),
  customPermissions: (el: JsonValue) => getPropertyValue(el, 'name'),
  customSettingAccesses: (el: JsonValue) => getPropertyValue(el, 'name'),
  externalDataSourceAccesses: (el: JsonValue) =>
    getPropertyValue(el, 'externalDataSource'),
  fieldPermissions: (el: JsonValue) => getPropertyValue(el, 'field'),
  flowAccesses: (el: JsonValue) => getPropertyValue(el, 'flow'),
  loginFlows: (el: JsonValue) => getPropertyValue(el, 'friendlyname'),
  layoutAssignments: (el: JsonValue) => {
    const layout = getPropertyValue(el, 'layout')
    const recordType = getPropertyValue(el, 'recordType')
    return [layout, recordType].filter(x => x !== String(undefined)).join('.')
  },
  loginHours: (el: JsonValue) => Object.keys(el!).join(','),
  loginIpRanges: (el: JsonValue) => {
    const startAddress = getPropertyValue(el, 'startAddress')
    const endAddress = getPropertyValue(el, 'endAddress')
    return `${startAddress}-${endAddress}`
  },
  objectPermissions: (el: JsonValue) => getPropertyValue(el, 'object'),
  pageAccesses: (el: JsonValue) => getPropertyValue(el, 'apexPage'),
  profileActionOverrides: (el: JsonValue) => getPropertyValue(el, 'actionName'),
  recordTypeVisibilities: (el: JsonValue) => getPropertyValue(el, 'recordType'),
  tabVisibilities: (el: JsonValue) => getPropertyValue(el, 'tab'),
  userPermissions: (el: JsonValue) => getPropertyValue(el, 'name'),
  bots: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  customApplications: (el: JsonValue) => getPropertyValue(el, 'name'),
  customLabels: (el: JsonValue) => getPropertyValue(el, 'name'),
  customPageWebLinks: (el: JsonValue) => getPropertyValue(el, 'name'),
  customTabs: (el: JsonValue) => getPropertyValue(el, 'name'),
  flowDefinitions: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  pipelineInspMetricConfigs: (el: JsonValue) => getPropertyValue(el, 'name'),
  prompts: (el: JsonValue) => getPropertyValue(el, 'name'),
  quickActions: (el: JsonValue) => getPropertyValue(el, 'name'),
  reportTypes: (el: JsonValue) => getPropertyValue(el, 'name'),
  scontrols: (el: JsonValue) => getPropertyValue(el, 'name'),
  standardValue: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  customValue: (el: JsonValue) => getPropertyValue(el, 'fullName'),
  labels: (el: JsonValue) => getPropertyValue(el, 'fullName'),
}
