const PROFILE_HEADER =
  '<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="http://soap.sforce.com/2006/04/metadata">'
const PROFILE_FOOTER = '\n</Profile>'

const GLOBAL_VALUE_SET_HEADER =
  '<?xml version="1.0" encoding="UTF-8"?>\n<GlobalValueSet xmlns="http://soap.sforce.com/2006/04/metadata">'
const GLOBAL_VALUE_SET_FOOTER = '\n</GlobalValueSet>'

type FixtureSize = 'small' | 'medium' | 'large'

interface SizeConfig {
  readonly fieldPermissions: number
  readonly classAccesses: number
  readonly objectPermissions: number
}

const SIZE_CONFIGS: Record<FixtureSize, SizeConfig> = {
  small: { fieldPermissions: 50, classAccesses: 10, objectPermissions: 5 },
  medium: { fieldPermissions: 500, classAccesses: 50, objectPermissions: 20 },
  large: {
    fieldPermissions: 2000,
    classAccesses: 200,
    objectPermissions: 50,
  },
}

interface ProfileFixtures {
  readonly ancestor: string
  readonly local: string
  readonly other: string
  readonly conflictLocal: string
  readonly conflictOther: string
}

interface OrderedFixtures {
  readonly ancestor: string
  readonly local: string
  readonly other: string
}

const fieldPermission = (
  index: number,
  editable: boolean,
  readable: boolean
): string =>
  `
    <fieldPermissions>
        <editable>${editable}</editable>
        <field>Account.CustomField_${String(index).padStart(4, '0')}__c</field>
        <readable>${readable}</readable>
    </fieldPermissions>`

const classAccess = (index: number, enabled: boolean): string =>
  `
    <classAccesses>
        <apexClass>MyClass${String(index).padStart(4, '0')}</apexClass>
        <enabled>${enabled}</enabled>
    </classAccesses>`

const objectPermission = (
  index: number,
  allowRead: boolean,
  allowEdit: boolean
): string =>
  `
    <objectPermissions>
        <allowCreate>false</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>${allowEdit}</allowEdit>
        <allowRead>${allowRead}</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>CustomObject${String(index).padStart(4, '0')}__c</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>`

const buildProfile = (parts: readonly string[]): string =>
  PROFILE_HEADER + parts.join('') + PROFILE_FOOTER

const generateBaseElements = (
  config: SizeConfig
): {
  readonly fields: readonly string[]
  readonly classes: readonly string[]
  readonly objects: readonly string[]
} => ({
  fields: Array.from({ length: config.fieldPermissions }, (_, i) =>
    fieldPermission(i, true, true)
  ),
  classes: Array.from({ length: config.classAccesses }, (_, i) =>
    classAccess(i, true)
  ),
  objects: Array.from({ length: config.objectPermissions }, (_, i) =>
    objectPermission(i, true, false)
  ),
})

export const generateProfileFixtures = (size: FixtureSize): ProfileFixtures => {
  const config = SIZE_CONFIGS[size]
  const base = generateBaseElements(config)
  const quarter = Math.floor(config.fieldPermissions / 4)
  const eighth = Math.floor(config.fieldPermissions / 8)

  const ancestor = buildProfile([
    ...base.fields,
    ...base.classes,
    ...base.objects,
  ])

  const localFields = base.fields.map((field, i) =>
    i < quarter ? fieldPermission(i, false, true) : field
  )
  const localExtra = Array.from({ length: 5 }, (_, i) =>
    fieldPermission(config.fieldPermissions + i, true, true)
  )
  const local = buildProfile([
    ...localFields,
    ...localExtra,
    ...base.classes,
    ...base.objects,
  ])

  const otherFields = base.fields
    .map((field, i) =>
      i >= quarter && i < quarter * 2 ? fieldPermission(i, true, false) : field
    )
    .filter((_, i) => i < config.fieldPermissions - 3)
  const other = buildProfile([...otherFields, ...base.classes, ...base.objects])

  const conflictLocalFields = base.fields.map((field, i) =>
    i < quarter ? fieldPermission(i, true, true) : field
  )
  const conflictLocal = buildProfile([
    ...conflictLocalFields,
    ...localExtra,
    ...base.classes,
    ...base.objects,
  ])

  const conflictOtherFields = base.fields.map((field, i) => {
    if (i < eighth) {
      return fieldPermission(i, false, true)
    }
    if (i >= quarter && i < quarter * 2) {
      return fieldPermission(i, true, false)
    }
    return field
  })
  const conflictOther = buildProfile([
    ...conflictOtherFields,
    ...base.classes,
    ...base.objects,
  ])

  return { ancestor, local, other, conflictLocal, conflictOther }
}

const customValue = (index: number, isActive: boolean): string =>
  `
    <customValue>
        <fullName>Value_${String(index).padStart(3, '0')}</fullName>
        <default>false</default>
        <isActive>${isActive}</isActive>
        <label>Value ${index}</label>
    </customValue>`

const picklistValue = (index: number, isActive: boolean): string =>
  `
            <value>
                <fullName>PickValue_${String(index).padStart(3, '0')}</fullName>
                <default>false</default>
                <isActive>${isActive}</isActive>
                <label>Pick Value ${index}</label>
            </value>`

const buildPicklistField = (values: readonly string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Status__c</fullName>
    <description>Status picklist</description>
    <label>Status</label>
    <required>false</required>
    <trackHistory>false</trackHistory>
    <type>Picklist</type>
    <valueSet>
        <restricted>false</restricted>
        <valueSetDefinition>
            <sorted>false</sorted>${values.join('')}
        </valueSetDefinition>
    </valueSet>
</CustomField>`

export const generatePicklistFixtures = (): OrderedFixtures => {
  const valueCount = 30

  const ancestorValues = Array.from({ length: valueCount }, (_, i) =>
    picklistValue(i, true)
  )
  const ancestor = buildPicklistField(ancestorValues)

  const localValues = [
    ...ancestorValues.slice(0, 8),
    ...ancestorValues.slice(15, 22),
    ...ancestorValues.slice(8, 15),
    ...ancestorValues.slice(22),
    picklistValue(valueCount, true),
    picklistValue(valueCount + 1, true),
  ]
  const local = buildPicklistField(localValues)

  const otherValues = ancestorValues
    .filter((_, i) => i !== 5 && i !== 20)
    .map((v, i) => (i < 3 ? picklistValue(i, false) : v))
  const other = buildPicklistField(otherValues)

  return { ancestor, local, other }
}

export const generateOrderedFixtures = (): OrderedFixtures => {
  const valueCount = 40

  const ancestorValues = Array.from({ length: valueCount }, (_, i) =>
    customValue(i, true)
  )
  const ancestor =
    GLOBAL_VALUE_SET_HEADER + ancestorValues.join('') + GLOBAL_VALUE_SET_FOOTER

  const localValues = [
    ...ancestorValues.slice(0, 10),
    ...ancestorValues.slice(20, 30),
    ...ancestorValues.slice(10, 20),
    ...ancestorValues.slice(30),
    customValue(valueCount, true),
    customValue(valueCount + 1, true),
  ]
  const local =
    GLOBAL_VALUE_SET_HEADER + localValues.join('') + GLOBAL_VALUE_SET_FOOTER

  const otherValues = [
    ...ancestorValues.slice(0, 5),
    ...ancestorValues.slice(15, 25),
    ...ancestorValues.slice(5, 15),
    ...ancestorValues.slice(25),
    customValue(valueCount + 2, true),
    customValue(valueCount + 3, true),
  ]
  const other =
    GLOBAL_VALUE_SET_HEADER + otherValues.join('') + GLOBAL_VALUE_SET_FOOTER

  return { ancestor, local, other }
}
