import * as chai from 'chai'
import {
  JestAsymmetricMatchers,
  JestChaiExpect,
  JestExtend,
} from '@vitest/expect'
import { getKeysPath, isRegExp, toRegExp } from '@isdk/ai-tool'
import { cloneDeep, get as getByPath, set as setByPath } from 'lodash-es'

// allows using expect.extend instead of chai.use to extend plugins
chai.use(JestExtend)
// adds all jest matchers to expect
chai.use(JestChaiExpect)
// adds asymmetric matchers like stringContaining, objectContaining
chai.use(JestAsymmetricMatchers)

const expect = chai.expect as any

export function toMatchObject(actual: any, expected: any) {
  expected = cloneDeep(expected)
  const keys = getKeysPath(expected)
  for (const k of keys) {
    const v = getByPath(expected, k)
    if (isRegExp(v)) {
      setByPath(expected, k, expect.stringMatching(toRegExp(v)))
      // must visit it to active the proxy object, or toMatchObject can not work
      getByPath(expected, k)
    } else if (typeof v === 'string') {
      setByPath(expected, k, expect.stringContaining(v.trim()))
      getByPath(expected, k)
    }
  }
  const result = expect(actual).toMatchObject(expected)
  return result as Chai.ExpectStatic
}
