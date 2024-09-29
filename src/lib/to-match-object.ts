// import * as chai from 'chai'
// import {
//   JestAsymmetricMatchers,
//   JestChaiExpect,
//   JestExtend,
// } from '@vitest/expect'
import { getKeysPath, isRegExp, toRegExp } from '@isdk/ai-tool'
import { cloneDeep, get as getByPath } from 'lodash-es'
import 'colors'
import { diffChars } from 'diff'

// // allows using expect.extend instead of chai.use to extend plugins
// chai.use(JestExtend)
// // adds all jest matchers to expect
// chai.use(JestChaiExpect)
// // adds asymmetric matchers like stringContaining, objectContaining
// chai.use(JestAsymmetricMatchers)

// const expect = chai.expect as any

export function toMatchObject(actual: any, expected: any, failedKeys: string[] = []) {
  expected = cloneDeep(expected)
  const keys = getKeysPath(expected)
  for (const k of keys) {
    const v = getByPath(expected, k)
    const actualValue = getByPath(actual, k)
    if (isRegExp(v)) {
      const regEx = toRegExp(v)
      if (!regEx.test(actualValue)) {failedKeys.push(k + ': /' + regEx.source + '/' + regEx.flags + `.test(${JSON.stringify(actualValue)}) failed`)}
    } else if (typeof v === 'string') {
      if (typeof actualValue !== 'string' || !actualValue.includes(v.trim())) {
        const diff = diffChars(actualValue, v)
        // const diffStr = diff.map(d => d.added ? `+${d.value}` : d.removed ? `-${d.value}` : d.value).join('')
        const diffStr = diff.map(d =>
          d.added ? d.value.bgGreen :
          d.removed ? d.value.bgRed : d.value).join('')
        failedKeys.push(k+ ':' + diffStr)
      }
    } else {
      if (actualValue !== v) {failedKeys.push(k + ': ' + JSON.stringify(actualValue) + ' != ' + JSON.stringify(v))}
    }
  }
  // if (failedKeys.length) {
  //   throw new Error(`MisMatch: ${failedKeys.join(',')}`)
  // }

  return failedKeys.length ? failedKeys : undefined
}
