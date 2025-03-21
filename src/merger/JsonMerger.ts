import { castArray, isEqual, isNil, keyBy, unionWith } from 'lodash-es' // , differenceWith
import { MetadataService } from '../service/MetadataService.js'
import { JsonArray, JsonObject, JsonValue } from '../types/jsonTypes.js'

export class JsonMerger {
  private metadataService: MetadataService
  constructor() {
    this.metadataService = new MetadataService()
  }

  /**
   * Main entry point for merging JSON values
   */
  mergeObjects(
    ancestor: JsonObject | JsonArray,
    ours: JsonObject | JsonArray,
    theirs: JsonObject | JsonArray,
    parent?: JsonObject | JsonArray //,
    // attrib?: string
  ): JsonArray {
    // Get all properties from three ways
    const arrProperties: string[] = []
    let caseCode: number = 0
    if (ancestor && !isEqual(ancestor, {})) {
      caseCode += 100
      arrProperties.push(...Object.keys(ancestor))
    } else {
      ancestor = {}
    }
    if (ours && !isEqual(ours, {})) {
      caseCode += 10
      arrProperties.push(...Object.keys(ours))
    } else {
      ours = {}
    }
    if (theirs && !isEqual(theirs, {})) {
      caseCode += 1
      arrProperties.push(...Object.keys(theirs))
    } else {
      theirs = {}
    }
    const allProperties = new Set(arrProperties.sort())

    // TODO filter the namespace here and reapply it in the end of the loop if necessary

    // Process each property
    const mergedContent = [] as JsonArray
    for (const property of allProperties) {
      // console.info('property: '+property+'\ntypeof: '+this.getAttributePrimarytype(
      //   ancestor[property],
      //   ours[property],
      //   theirs[property]
      // ))
      switch (
        this.getAttributePrimarytype(
          ancestor[property],
          ours[property],
          theirs[property]
        )
      ) {
        case 'object': {
          if (parent) {
            mergedContent.push(
              ...this.mergeArrays(
                this.ensureArray(ancestor[property]),
                this.ensureArray(ours[property]),
                this.ensureArray(theirs[property]),
                this.ensureArray(parent),
                property,
                this.getKeyField(property)
              )
            )
          } else {
            let propObject = {}
            switch (caseCode) {
              case 100:
                return []
              case 11:
                if (isEqual(ours, theirs)) {
                  propObject[property] = []
                  propObject[property].push(
                    ...this.mergeObjects({}, ours[property], {}, propObject)
                  )
                  mergedContent.push(propObject)
                } else {
                  mergedContent.push({ '#text': '\n<<<<<<< LOCAL' })
                  propObject[property] = []
                  propObject[property].push(
                    ...this.mergeObjects({}, ours[property], {}, propObject)
                  )
                  mergedContent.push(propObject)
                  mergedContent.push({ '#text': '||||||| BASE' })
                  mergedContent.push({ '#text': '\n' })
                  mergedContent.push({ '#text': '=======' })
                  propObject = {}
                  propObject[property] = []
                  propObject[property].push(
                    ...this.mergeObjects({}, {}, theirs[property], propObject)
                  )
                  mergedContent.push(propObject)
                  mergedContent.push({ '#text': '>>>>>>> REMOTE' })
                }
                break
              case 101:
                if (isEqual(ancestor, theirs)) {
                  return []
                } else {
                  mergedContent.push({ '#text': '\n<<<<<<< LOCAL' })
                  mergedContent.push({ '#text': '\n' })
                  mergedContent.push({ '#text': '||||||| BASE' })
                  propObject[property] = []
                  propObject[property].push(
                    ...this.mergeObjects({}, ancestor[property], {}, propObject)
                  )
                  mergedContent.push(propObject)
                  mergedContent.push({ '#text': '=======' })
                  propObject = {}
                  propObject[property] = []
                  propObject[property].push(
                    ...this.mergeObjects({}, {}, theirs[property], propObject)
                  )
                  mergedContent.push(propObject)
                  mergedContent.push({ '#text': '>>>>>>> REMOTE' })
                }
                break
              case 110:
                if (isEqual(ancestor, ours)) {
                  return []
                } else {
                  mergedContent.push({ '#text': '\n<<<<<<< LOCAL' })
                  propObject[property] = []
                  propObject[property].push(
                    ...this.mergeObjects({}, ours[property], {}, propObject)
                  )
                  mergedContent.push(propObject)
                  mergedContent.push({ '#text': '||||||| BASE' })
                  propObject = {}
                  propObject[property] = []
                  propObject[property].push(
                    ...this.mergeObjects({}, {}, ancestor[property], propObject)
                  )
                  mergedContent.push(propObject)
                  mergedContent.push({ '#text': '=======' })
                  mergedContent.push({ '#text': '\n' })
                  mergedContent.push({ '#text': '>>>>>>> REMOTE' })
                }
                break
              default:
                propObject[property] = []
                propObject[property].push(
                  ...this.mergeObjects(
                    ancestor[property],
                    ours[property],
                    theirs[property],
                    propObject
                  )
                )
                mergedContent.push(propObject)
                break
            }
          }
          break
        }
        default:
          if (property.startsWith('@_') && parent) {
            if (parent[':@']) {
              parent[':@'][property] = ancestor[property]
            } else {
              parent[':@'] = {}
              parent[':@'][property] = ancestor[property]
            }
          } else {
            mergedContent.push(
              ...this.mergeTextAttribute(
                property,
                ancestor[property],
                ours[property],
                theirs[property]
              )
            )
          }
          break
      }
    }

    return mergedContent
  }

  private mergeTextAttribute(
    attrib: string,
    ancestor: JsonValue | null,
    ours: JsonValue | null,
    theirs: JsonValue | null
  ): JsonArray {
    const objAnc: JsonObject = {}
    const objOurs: JsonObject = {}
    const objTheirs: JsonObject = {}
    let caseCode: number = 0
    if (!isNil(ancestor)) {
      objAnc[attrib] = [{ '#text': ancestor }]
      caseCode += 100
    }
    if (!isNil(ours)) {
      objOurs[attrib] = [{ '#text': ours }]
      caseCode += 10
    }
    if (!isNil(theirs)) {
      objTheirs[attrib] = [{ '#text': theirs }]
      caseCode += 1
    }
    const finalArray: JsonArray = []
    switch (caseCode) {
      case 1:
        finalArray.push(objTheirs)
        break
      case 10:
        finalArray.push(objOurs)
        break
      case 11:
        if (ours === theirs) {
          finalArray.push(objOurs)
        } else {
          finalArray.push({ '#text': '\n<<<<<<< LOCAL' })
          finalArray.push(objOurs)
          finalArray.push({ '#text': '||||||| BASE' })
          finalArray.push({ '#text': '\n' })
          finalArray.push({ '#text': '=======' })
          finalArray.push(objTheirs)
          finalArray.push({ '#text': '>>>>>>> REMOTE' })
        }
        break
      case 101:
        if (ancestor !== theirs) {
          finalArray.push({ '#text': '\n<<<<<<< LOCAL' })
          finalArray.push({ '#text': '\n' })
          finalArray.push({ '#text': '||||||| BASE' })
          finalArray.push(objAnc)
          finalArray.push({ '#text': '=======' })
          finalArray.push(objTheirs)
          finalArray.push({ '#text': '>>>>>>> REMOTE' })
        }
        break
      case 110:
        if (ancestor !== ours) {
          finalArray.push({ '#text': '\n<<<<<<< LOCAL' })
          finalArray.push(objOurs)
          finalArray.push({ '#text': '||||||| BASE' })
          finalArray.push(objAnc)
          finalArray.push({ '#text': '=======' })
          finalArray.push({ '#text': '\n' })
          finalArray.push({ '#text': '>>>>>>> REMOTE' })
        }
        break
      case 111:
        if (ours === theirs) {
          finalArray.push(objOurs)
        } else if (ancestor === ours) {
          finalArray.push(objTheirs)
        } else if (ancestor === theirs) {
          finalArray.push(objOurs)
        } else {
          finalArray.push({ '#text': '\n<<<<<<< LOCAL' })
          finalArray.push(objOurs)
          finalArray.push({ '#text': '||||||| BASE' })
          finalArray.push(objAnc)
          finalArray.push({ '#text': '=======' })
          finalArray.push(objTheirs)
          finalArray.push({ '#text': '>>>>>>> REMOTE' })
        }
        break
      default:
    }
    return finalArray
  }

  /**
   * Gets the typeof of the attribute
   */
  private getAttributePrimarytype(
    ancestor: JsonValue | undefined | null,
    ours: JsonValue | undefined | null,
    theirs: JsonValue | undefined | null
  ): string {
    return typeof [ancestor, theirs, ours].find(ele => !isNil(ele))
  }

  /**
   * Ensures a value is an array
   */
  private ensureArray(value: JsonValue): JsonArray {
    return isNil(value) ? [] : (castArray(value) as JsonArray)
  }

  /**
   * Gets the key field for a property from KEY_FIELD_METADATA
   */
  private getKeyField(
    property: string
  ): ((el: JsonValue) => string) | undefined {
    return this.metadataService.getKeyFieldExtractor(property)
  }

  /**
   * Merges arrays using the specified key field if available
   */
  private mergeArrays(
    ancestor: JsonArray,
    ours: JsonArray,
    theirs: JsonArray,
    parent: JsonArray,
    attribute: string,
    keyField?: (el: JsonValue) => string
  ): JsonArray {
    const propObject = {}
    // If no key field, use unionWith to merge arrays without duplicates
    if (!keyField) {
      propObject[attribute] = unionWith([...ours], theirs, isEqual)
      return [propObject]
    }

    // Merge using key field
    return this.mergeByKeyField(
      ancestor,
      ours,
      theirs,
      keyField,
      attribute,
      parent
    )
  }

  /**
   * Merges arrays using a key field
   */
  private mergeByKeyField(
    ancestor: JsonArray,
    ours: JsonArray,
    theirs: JsonArray,
    keyField: (el: JsonValue) => string,
    attribute: string,
    parent: JsonArray
  ): JsonArray {
    const finalArray: JsonArray = []
    let caseCode: number = 0
    if (ancestor.length !== 0) {
      caseCode += 100
    }
    if (ours.length !== 0) {
      caseCode += 10
    }
    if (theirs.length !== 0) {
      caseCode += 1
    }
    // console.info(
    //   'attribute: ' +
    //     attribute +
    //     '\nkeyField: ' +
    //     keyField +
    //     '\ncaseCode: ' +
    //     caseCode
    // )
    // console.dir(ours, {depth: null})
    const keyedAnc = keyBy(ancestor, keyField)
    const keyedOurs = keyBy(ours, keyField)
    const keyedTheirs = keyBy(theirs, keyField)
    const allKeys = new Set(
      [
        ...Object.keys(keyedAnc),
        ...Object.keys(keyedOurs),
        ...Object.keys(keyedTheirs),
      ].sort()
    )
    for (const key of allKeys) {
      caseCode = 0
      if (keyedAnc[key]) {
        caseCode += 100
      }
      if (keyedOurs[key]) {
        caseCode += 10
      }
      if (keyedTheirs[key]) {
        caseCode += 1
      }
      // console.log('caseCode: ' + caseCode);
      let propObject = {}
      switch (caseCode) {
        case 1:
          propObject[attribute] = [
            ...this.mergeObjects({}, {}, keyedTheirs[key], parent),
          ]
          finalArray.push(propObject)
          break
        case 10:
          propObject[attribute] = [
            ...this.mergeObjects({}, {}, keyedOurs[key], parent),
          ]
          finalArray.push(propObject)
          break
        case 100:
          break
        case 11:
          if (isEqual(ours, theirs)) {
            propObject[attribute] = [
              ...this.mergeObjects({}, {}, keyedOurs[key], parent),
            ]
            finalArray.push(propObject)
          } else {
            // finalArray.push({ '#text': '<<<<<<< LOCAL' })
            // propObject[attribute] = [
            //   ...this.mergeObjects({}, {}, keyedOurs[key], parent),
            // ]
            // finalArray.push(propObject)
            // finalArray.push({ '#text': '||||||| BASE' })
            // finalArray.push({ '#text': '\n' })
            // finalArray.push({ '#text': '=======' })
            // propObject[attribute] = [
            //   ...this.mergeObjects({}, {}, keyedTheirs[key], parent),
            // ]
            // finalArray.push(propObject)
            // finalArray.push({ '#text': '>>>>>>> REMOTE' })
            propObject[attribute] = [
              ...this.mergeObjects(
                {},
                keyedOurs[key],
                keyedTheirs[key],
                parent
              ),
            ]
            finalArray.push(propObject)
          }
          break
        case 101:
          if (!isEqual(ancestor, theirs)) {
            finalArray.push({ '#text': '\n<<<<<<< LOCAL' })
            finalArray.push({ '#text': '\n' })
            finalArray.push({ '#text': '||||||| BASE' })
            propObject = {}
            propObject[attribute] = [
              ...this.mergeObjects({}, {}, keyedAnc[key], parent),
            ]
            finalArray.push(propObject)
            finalArray.push({ '#text': '=======' })
            propObject = {}
            propObject[attribute] = [
              ...this.mergeObjects({}, {}, keyedTheirs[key], parent),
            ]
            finalArray.push(propObject)
            finalArray.push({ '#text': '>>>>>>> REMOTE' })
            // propObject[attribute] = [
            //   ...this.mergeObjects(keyedAnc[key], {}, keyedTheirs[key], parent),
            // ]
            // finalArray.push(propObject)
          }
          break
        case 110:
          if (!isEqual(ancestor, ours)) {
            finalArray.push({ '#text': '\n<<<<<<< LOCAL' })
            propObject = {}
            propObject[attribute] = [
              ...this.mergeObjects({}, {}, keyedOurs[key], parent),
            ]
            finalArray.push(propObject)
            finalArray.push({ '#text': '||||||| BASE' })
            propObject = {}
            propObject[attribute] = [
              ...this.mergeObjects({}, {}, keyedAnc[key], parent),
            ]
            finalArray.push(propObject)
            finalArray.push({ '#text': '=======' })
            finalArray.push({ '#text': '\n' })
            finalArray.push({ '#text': '>>>>>>> REMOTE' })
            // propObject[attribute] = [
            //   ...this.mergeObjects(keyedAnc[key], keyedOurs[key], {}, parent),
            // ]
            // finalArray.push(propObject)
          }
          break
        case 111:
          if (isEqual(ours, theirs)) {
            propObject[attribute] = [
              ...this.mergeObjects({}, {}, keyedOurs[key], parent),
            ]
          } else if (isEqual(ancestor, ours)) {
            propObject[attribute] = [
              ...this.mergeObjects({}, {}, keyedTheirs[key], parent),
            ]
          } else if (isEqual(ancestor, theirs)) {
            propObject[attribute] = [
              ...this.mergeObjects({}, {}, keyedOurs[key], parent),
            ]
          } else {
            // finalArray.push({ '#text': '<<<<<<< LOCAL' })
            // finalArray.push(...this.mergeObjects({}, {}, keyedOurs[key], parent))
            // finalArray.push({ '#text': '||||||| BASE' })
            // finalArray.push(...this.mergeObjects({}, {}, keyedAnc[key], parent))
            // finalArray.push({ '#text': '=======' })
            // finalArray.push(...this.mergeObjects({}, {}, keyedTheirs[key], parent))
            // finalArray.push({ '#text': '>>>>>>> REMOTE' })
            propObject[attribute] = [
              ...this.mergeObjects(
                keyedAnc[key],
                keyedOurs[key],
                keyedTheirs[key],
                parent
              ),
            ]
          }
          finalArray.push(propObject)
          break
        default:
      }
    }

    return finalArray
  }
}
