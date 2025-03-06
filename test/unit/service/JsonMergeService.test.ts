import { JsonMergeService } from '../../../src/service/JsonMergeService.js'

describe('JsonMergeService', () => {
  let sut: JsonMergeService

  beforeEach(() => {
    sut = new JsonMergeService()
  })

  it('should merge two JSON objects with no conflicts', async () => {
    const obj1 = { a: 1, b: 2 }
    const obj2 = { b: 3, c: 4 }
    const obj3 = { d: 2, e: 2 }

    const result = await sut.mergeObjects(obj1, obj2, obj3)

    expect(result).toEqual({ b: 3, c: 4, d: 2, e: 2 })
  })

  it('should merge two JSON objects with conflicts', async () => {
    const obj1 = { a: 1, b: 2 }
    const obj2 = { a: 3, b: 2 }
    const obj3 = { b: 2, c: 3 }

    const result = await sut.mergeObjects(obj1, obj2, obj3)

    expect(result).toEqual({ a: 3, b: 2, c: 3 })
  })
})
