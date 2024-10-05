// import * as chai from 'chai'
// import {
//   JestAsymmetricMatchers,
//   JestChaiExpect,
//   JestExtend,
// } from '@vitest/expect'
import { getKeysPath, isRegExp, toRegExp } from '@isdk/ai-tool'
import { get as getByPath } from 'lodash-es'
import colors from 'ansicolor'
import { diffChars } from 'diff'

// // allows using expect.extend instead of chai.use to extend plugins
// chai.use(JestExtend)
// // adds all jest matchers to expect
// chai.use(JestChaiExpect)
// // adds asymmetric matchers like stringContaining, objectContaining
// chai.use(JestAsymmetricMatchers)

// const expect = chai.expect as any

function matchValue(actual: any, expected: any, failedKeys: string[] = [], key: string = '') {
  const vType = typeof expected
  const kStr = key ? key + ': ' : ''
  if (typeof actual === 'string') {actual = actual.trim()}
  if (isRegExp(expected)) {
    const regEx = toRegExp(expected)
    console.log('🚀 ~ matchValue ~ regEx:', regEx, actual)
    if (!regEx.test(actual)) {
      failedKeys.push(kStr + '/' + regEx.source + '/' + regEx.flags + `.test(${JSON.stringify(actual)}) failed`)
    }
  } else if (vType === 'string') {
    if (typeof actual !== 'string' || !actual.includes(expected.trim())) {
      if (typeof actual === 'string') {
        const diff = diffChars(expected, actual)
        // const diffStr = diff.map(d => d.added ? `+${d.value}` : d.removed ? `-${d.value}` : d.value).join('')
        const diffStr = diff.map(d =>
          d.added ? colors.green('+'+d.value) :
          d.removed ? colors.red('-'+d.value) : colors.darkGray(d.value)).join('')
        failedKeys.push(kStr + diffStr)
      } else {
        failedKeys.push(kStr + JSON.stringify(actual) + ' != ' + JSON.stringify(expected))
      }
    }
  } else if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      failedKeys.push(kStr + 'the actual value is not an array: ' + JSON.stringify(actual))
    }
    for (let i = 0; i < expected.length; i++) {
      const vItem = expected[i]
      const actualItem = actual[i]
      matchValue(actualItem, vItem, failedKeys, key + '[' + i + ']')
    }
  } else if (vType === 'object') {
    const keys = getKeysPath(expected)
    for (const k of keys) {
      const v = getByPath(expected, k)
      const actualValue = getByPath(actual, k)
      matchValue(actualValue, v, failedKeys, k)
    }
  } else {
    if (actual !== expected) {
      failedKeys.push(key + ': ' + JSON.stringify(actual) + ' != ' + JSON.stringify(expected))
    }
  }
  return failedKeys.length ? failedKeys : undefined
}

export function toMatchObject(actual: any, expected: any, failedKeys: string[] = [], key: string = '') {
  return matchValue(actual, expected, failedKeys, key)
}
