// import * as chai from 'chai'
// import {
//   JestAsymmetricMatchers,
//   JestChaiExpect,
//   JestExtend,
// } from '@vitest/expect'
import { getKeysPath, isRegExp, PromptTemplate, PromptTemplateOptions, stripConsoleColor, toRegExp } from '@isdk/ai-tool'
import { get as getByPath, omit, set as setByPath } from 'lodash-es'
import colors from 'ansicolor'
import { Change, diffChars } from 'diff'

import { YamlTypeJsonSchema } from './yaml-types/index.js'

interface DiffChange extends Change {
  verified?: boolean
}

// // allows using expect.extend instead of chai.use to extend plugins
// chai.use(JestExtend)
// // adds all jest matchers to expect
// chai.use(JestChaiExpect)
// // adds asymmetric matchers like stringContaining, objectContaining
// chai.use(JestAsymmetricMatchers)

// const expect = chai.expect as any

export async function formatTemplate(value: any, options: PromptTemplateOptions) {
  if (options.data) {
    let vRegEx: RegExp|undefined
    if (value instanceof RegExp) {
      vRegEx =value
      value = value.source
    }
    if (typeof value === 'string') {
      const data = {...options.input, ...options.data}
      options = omit(options, ['data', 'input'])
      const content = await PromptTemplate.formatIf({template: value, ...options, data})
      if (typeof content === 'string') {value = content}
    }
    if (vRegEx) {
      if (vRegEx.source !== value) {
        value = new RegExp(value, vRegEx.flags)
      } else {
        value = vRegEx
      }
    }
  }
  return value
}

export async function formatObject(input: any, options: PromptTemplateOptions) {
  if (input && options.data) {
    const vType = typeof input
    if (Array.isArray(input)) {
      for (let i = 0; i < input.length; i++) {
        const vItem = input[i]
        const actualItem = await formatObject(vItem, options)
        if (actualItem !== vItem) {
          input[i] = actualItem
        }
      }
    } else if (vType === 'string' || input instanceof RegExp) {
      input = await formatTemplate(input, options)
    } else if (vType === 'function') {
      input = ((r)  => () => r)(input)
    } else if (vType === 'object') {
      const keys = getKeysPath(input)
      for (const k of keys) {
        const v = getByPath(input, k)
        const actualValue = await formatObject(v, options)
        if (actualValue !== v) {
          setByPath(input, k, actualValue)
        }
      }
    }
  }
  return input
}

export interface MatchValueOptions {
  failedKeys?: string[]
  key?: string
  data?: Record<string, any>
  input?: any
}

/**
 * Compares the actual value with the expected value and records any mismatches.
 *
 * @param actual - The actual value to be compared.
 * @param expected - The expected value to compare against.
 * @param options - Additional options for the comparison.
 * @param options.failedKeys - An array to collect failed keys or mismatch information.
 * @param options.key - A string representing the current key being compared.
 * @param options.data - Data used for formatting templates.
 *
 * @returns An array of failed keys if there are mismatches, otherwise `undefined`.
 *
 * @example
 * // Example usage:
 * const actual = {
 *   name: "Alice",
 *   age: 30,
 *   hobbies: ["reading", "coding"],
 *   address: {
 *     street: "123 Main St",
 *     city: "New York"
 *   }
 * };
 *
 * const expected = {
 *   name: "Alice",
 *   age: 30,
 *   hobbies: ["reading", "coding"],
 *   address: {
 *     street: "{{ street }}",
 *     city: "New York"
 *   }
 * };
 *
 * const data = {
 *   street: "123 Main St",
 * };
 *
 * const result = matchValue(actual, expected, { data });
 * console.log(result); // Output: []
 */
export async function validateMatch(actual: any, expected: any, options: MatchValueOptions = {}) {
  const data = options.data
  const failedKeys = options.failedKeys || []
  const key = options.key || ''
  const input = options.input
  const vType = typeof expected
  const kStr = key ? key + ': ' : ''
  if (typeof actual === 'string') {actual = actual.trim()}
  if (vType === 'string') {
    expected = await formatTemplate(expected, {...options, templateFormat: data?.templateFormat})
  }
  if (isRegExp(expected)) {
    const regEx = await formatTemplate(toRegExp(expected), {...options, templateFormat: data?.templateFormat})
    if (!regEx.test(actual)) {
      failedKeys.push(kStr + '/' + regEx.source + '/' + regEx.flags + `.test(${JSON.stringify(actual)}) failed`)
    }
  } else if (vType === 'string') {
    if (typeof actual !== 'string' || !actual.includes(expected.trim())) {
      if (typeof actual === 'string') {
        let diff: DiffChange[]|undefined = diffChars(expected, actual)

        const expectedDiff = input?.diff
        if (Array.isArray(expectedDiff)) {
          await formatDiffList(expectedDiff, options)
          const successfulItems = diff.filter(d => findDiffItem(expectedDiff, d, options))
          if (successfulItems.length < diff.length) {
            successfulItems.forEach(d => {d.verified = true})
            const failedCount = diff.filter(d => !d.verified && (d.added || d.removed)).length
            if (failedCount === 0) {
              diff = undefined
            }
          } else {
            diff = undefined
          }
        } else if (typeof expectedDiff === 'function') {
          const successfulItems = await expectedDiff(actual, input, diff)
          if (successfulItems.length < diff.length) {
            successfulItems.forEach(d => {d.verified = true})
            const failedCount = diff.filter(d => !d.verified && (d.added || d.removed)).length
            if (failedCount === 0) {
              diff = undefined
            }
          } else {
            diff = undefined
          }
        }
        if (diff && diff.length) {
          // process.exit()
          // const diffStr = diff.map(d => d.added ? `+${d.value}` : d.removed ? `-${d.value}` : d.value).join('')
          const diffStr = diff.map(d => {
            const changed = d.added || d.removed || d.verified
            const value = changed ? JSON.stringify(d.value) : d.value
            let result = d.added ? colors.green('+'+value) :
              d.removed ? colors.red('-'+value) : colors.darkGray(value)

            if (d.verified) {
              result = colors.white('✓('+ stripConsoleColor(result) + ')')
            }
            return result
          }).join('')
          failedKeys.push(kStr + diffStr)
        }
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
      await validateMatch(actualItem, vItem, {failedKeys, key: key + '[' + i + ']', data})
    }
  } else if (vType === 'function') {
    const result = await expected(actual, input)
    if (result !== true) {
      failedKeys.push(kStr + `the ${expected.name || expected.toString()} custom function report error "${result}". The actual value: ${JSON.stringify(actual)}`)
    }
  } else if (expected instanceof YamlTypeJsonSchema) {
    const valid = YamlTypeJsonSchema.validate(expected, actual)
    if (!valid) {
      const errors = YamlTypeJsonSchema.getErrors(expected)!
      // failedKeys.push(kStr + 'json schema validation failed: ' + errors.map(e => e.message).join('\n'))
      failedKeys.push(kStr + 'json schema validation failed: ' + JSON.stringify(errors))
    }
  } else if (vType === 'object') {
    const keys = getKeysPath(expected)
    for (const k of keys) {
      const v = getByPath(expected, k)
      const actualValue = getByPath(actual, k)
      await validateMatch(actualValue, v, {failedKeys, key: k, data})
    }
  } else {
    if (actual !== expected) {
      failedKeys.push(key + ': ' + JSON.stringify(actual) + ' != ' + JSON.stringify(expected))
    }
  }
  return failedKeys.length ? failedKeys : false
}

async function formatDiffList(diff: DiffChange[], options: MatchValueOptions) {
  for (const d of diff) {
    const value = d.value
    if (isRegExp(value)) {
      d.value = await formatTemplate(toRegExp(value), {...options, templateFormat: options.data?.templateFormat})
    }
  }
  return diff
}

function findDiffItem(diff: DiffChange[], item: DiffChange, options: MatchValueOptions) {
  let result: Change|undefined
  for (const d of diff) {
    const unchanged = !(item.added || item.removed)
    if (unchanged && (d.added !== false && d.removed !== false)) {continue}
    if (d.added != null && d.added !== item.added) {continue}
    if (d.removed != null && d.removed !== item.removed) {continue}

    result = item

    const value = d.value
    if (value != null) {
      if (isRegExp(value)) {
        const regEx = toRegExp(value)
        if (!regEx.test(item.value)) { result = undefined }
      } else if (item.value !== value) {
        result = undefined
      }
    }

    if (result) {break}
  }
  return result
}
