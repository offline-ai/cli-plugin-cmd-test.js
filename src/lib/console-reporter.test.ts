import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsoleReporter } from './console-reporter.js'
import { EventEmitter } from 'events'
import color from 'ansicolor'

describe('ConsoleReporter', () => {
  let mockCmd: any
  let reporter: ConsoleReporter
  let runner: EventEmitter

  beforeEach(() => {
    mockCmd = {
      log: vi.fn()
    }
    reporter = new ConsoleReporter(mockCmd, 'notice')
    runner = new EventEmitter()
    reporter.observe(runner as any, 'test-script.js')
  })

  const stripColor = (str: string) => str.replace(/\x1B\[\d+m/g, '')

  it('should log pass event', () => {
    runner.emit('test:pass', {
      i: 0,
      duration: 100,
      passed: true
    })

    expect(mockCmd.log).toHaveBeenCalledWith('warn', expect.stringContaining('✔ PASSED'))
  })

  it('should log fail event with auto-generated diff for strings', () => {
    runner.emit('test:fail', {
      i: 1,
      duration: 150,
      passed: false,
      actual: 'Hello World',
      expected: 'Hello Gemini'
    })

    // Should contain Diff
    const calls = mockCmd.log.mock.calls
    const diffLog = calls.find((c: any) => stripColor(c[1]).includes('Diff:'))
    expect(diffLog).toBeDefined()
    const strippedDiff = stripColor(diffLog[1])
    expect(strippedDiff).toContain('Hello ')
    expect(strippedDiff).toContain('Gemini') // removed
    expect(strippedDiff).toContain('World')  // added
  })

  it('should log fail event with auto-generated diff for objects', () => {
    runner.emit('test:fail', {
      i: 2,
      duration: 200,
      passed: false,
      actual: { b: 2, a: 1 },
      expected: { a: 1, b: 3 }
    })

    const calls = mockCmd.log.mock.calls
    // Verify that it shows Diff and uses stable stringify (keys sorted)
    const diffLogs = calls.filter((c: any) => stripColor(c[1]).includes('Diff:'))
    expect(diffLogs.length).toBeGreaterThan(0)

    const allLogs = calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('"a": 1')
    expect(allLogs).toContain('-  "b": 3')
    expect(allLogs).toContain('+  "b": 2')
  })

  it('should handle multi-line diffs correctly', () => {
    runner.emit('test:fail', {
      i: 3,
      duration: 50,
      passed: false,
      actual: `line1
line2
line3-changed`,
      expected: `line1
line2
line3`
    })

    const calls = mockCmd.log.mock.calls
    const allLogs = calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('-line3')
    expect(allLogs).toContain('+line3-changed')
    expect(allLogs).toContain(' line1')
  })

  it('should log failures with pre-existing diff items', () => {
    runner.emit('test:fail', {
      i: 4,
      duration: 10,
      passed: false,
      failures: [
        {
          message: 'Custom error',
          diff: [
            { value: 'match', added: false, removed: false },
            { value: 'old', added: false, removed: true },
            { value: 'new', added: true, removed: false }
          ]
        }
      ]
    }, true)

    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('match')
    expect(allLogs).toContain('-old')
    expect(allLogs).toContain('+new')
  })

  it('should log error events', () => {
    runner.emit('test:error', {
      i: 5,
      duration: 0,
      error: new Error('System Crash')
    })

    expect(mockCmd.log).toHaveBeenCalledWith('warn', expect.stringContaining('✖ ERROR'))
    expect(mockCmd.log).toHaveBeenCalledWith('warn', expect.stringContaining('System Crash'))
  })

  it('should respect logLevel for pass events', () => {
    // Current level is 'notice', so it should show detail
    runner.emit('test:pass', { i: 6, duration: 10, passed: true, actual: 'detail' })
    let allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('Actual Output:')

    // Change level to 'warn', should hide detail
    mockCmd.log.mockClear()
    const runner2 = new EventEmitter()
    reporter = new ConsoleReporter(mockCmd, 'warn')
    reporter.observe(runner2 as any, 'test.js')
    runner2.emit('test:pass', { i: 7, duration: 10, passed: true, actual: 'detail' })
    allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).not.toContain('Actual Output:')
  })

  it('should render negated expectations (isNot)', () => {
    runner.emit('test:fail', {
      i: 8,
      duration: 10,
      passed: false,
      not: true,
      expected: 'forbidden'
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('NOT Expected Output:')
  })

  it('should render JSON Schema when provided', () => {
    runner.emit('test:pass', {
      i: 9,
      duration: 10,
      passed: true,
      expectedSchema: { type: 'object', properties: { name: { type: 'string' } } }
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('Expected JSON Schema:')
    expect(allLogs).toContain('"type": "object"')
  })

  it('should handle object as reason', () => {
    runner.emit('test:pass', {
      i: 10,
      duration: 10,
      passed: true,
      reason: { info: 'passed because of X' }
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('Reason:')
    expect(allLogs).toContain('"info": "passed because of X"')
  })

  it('should log skip events', () => {
    runner.emit('test:skip', { i: 11 })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('○ SKIPPED')
  })

  it('should stableStringify nested objects correctly', () => {
    // We test this indirectly through auto-diff of nested objects
    runner.emit('test:fail', {
      i: 12,
      duration: 10,
      passed: false,
      actual: { z: 1, a: { d: 4, c: 3 } },
      expected: { a: { c: 3, d: 4 }, z: 2 }
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    // Both 'a' and its inner object should be sorted
    // The diff should only be on 'z'
    expect(allLogs).toContain('"a": {')
    expect(allLogs).toContain('"c": 3')
    expect(allLogs).toContain('"d": 4')
    expect(allLogs).toContain('-  "z": 2')
    expect(allLogs).toContain('+  "z": 1')
  })

  it('should handle circular references gracefully', () => {
    const circular: any = { a: 1 }
    circular.self = circular

    runner.emit('test:fail', {
      i: 13,
      duration: 1,
      passed: false,
      actual: circular,
      expected: { a: 1 }
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('[Stringify Error:')
  })

  it('should handle special numeric values', () => {
    runner.emit('test:pass', {
      i: 14,
      duration: 1,
      passed: true,
      actual: { val: NaN, inf: Infinity }
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('"val": null') // JSON.stringify converts NaN/Infinity to null
  })

  it('should handle corrupted failure items', () => {
    runner.emit('test:fail', {
      i: 15,
      duration: 1,
      passed: false,
      failures: [null, { message: 'valid' }, undefined] as any
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('valid')
    // Should not crash because of null/undefined
  })

  it('should handle missing fields in log item', () => {
    runner.emit('test:pass', {} as any)
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('✔ PASSED')
    expect(allLogs).toContain('Fixture[undefined]')
  })

  it('should handle empty string mismatch with quotes and labels', () => {
    runner.emit('test:fail', {
      i: 16,
      duration: 1,
      passed: false,
      actual: '',
      expected: 'something'
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('Diff:')
    expect(allLogs).toContain('Actual Output:')
    expect(allLogs).toContain('""')
    expect(allLogs).toContain('Expected Output:')
    expect(allLogs).toContain('"something"')
  })

  it('should handle space strings with quotes', () => {
    runner.emit('test:fail', {
      i: 27,
      duration: 1,
      passed: false,
      actual: ' ',
      expected: '  '
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('" "')
    expect(allLogs).toContain('"  "')
  })

  it('should render special types (RegExp, Function, Date)', () => {
    runner.emit('test:pass', {
      i: 17,
      duration: 1,
      passed: true,
      actual: /test-regex/i,
      expected: function expectedFunc() {}
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('/test-regex/i')
    expect(allLogs).toContain('expectedFunc()')
  })

  it('should render multiple failures in order', () => {
    runner.emit('test:fail', {
      i: 18,
      duration: 1,
      passed: false,
      failures: [
        { message: 'First error', key: 'path.a' },
        { message: 'Second error', key: 'path.b' }
      ]
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('First error at path.a')
    expect(allLogs).toContain('Second error at path.b')
  })

  it('should render verified flag in multi-line diffs', () => {
    runner.emit('test:fail', {
      i: 19,
      duration: 1,
      passed: false,
      failures: [
        {
          diff: [
            { value: 'line1\n', added: false, removed: false, verified: true },
            { value: 'line2\n', added: true, removed: false }
          ]
        }
      ]
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('✓( line1)')
    expect(allLogs).toContain('+line2')
  })

  it('should render complex input on failure', () => {
    runner.emit('test:fail', {
      i: 20,
      duration: 1,
      passed: false,
      input: { query: 'test', options: { verbose: true } },
      actual: 'no',
      expected: 'yes'
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('Input:')
    expect(allLogs).toContain('"query": "test"')
  })

  it('should show Actual and Expected Output when failing with RegExp expectation', () => {
    runner.emit('test:fail', {
      i: 21,
      duration: 10,
      passed: false,
      actual: 'Actual text that does not match',
      expected: /ExpectedRegex/
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).not.toContain('Diff:')
    expect(allLogs).toContain('Actual Output:')
    expect(allLogs).toContain('"Actual text that does not match"')
    expect(allLogs).toContain('Expected Output:')
    expect(allLogs).toContain('/ExpectedRegex/')
  })

  it('should show Actual/Expected instead of diff when failures item has RegExp expected', () => {
    runner.emit('test:fail', {
      i: 22,
      duration: 10,
      passed: false,
      failures: [
        {
          message: 'RegExp mismatch',
          actual: 'some text',
          expected: /other/
        }
      ]
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).not.toContain('Diff:')
    expect(allLogs).toContain('Actual: "some text"')
    expect(allLogs).toContain('Expected: /other/')
  })

  it('should show Actual/Expected and Diff for short strings on failure', () => {
    runner.emit('test:fail', {
      i: 23,
      duration: 10,
      passed: false,
      actual: 'Okay, I apologize',
      expected: 'Something else'
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('Diff:')
    // It SHOULD contain Actual/Expected labels
    expect(allLogs).toContain('Actual Output:')
    expect(allLogs).toContain('"Okay, I apologize"')
    expect(allLogs).toContain('Expected Output:')
    expect(allLogs).toContain('"Something else"')
  })

  it('should handle String objects as short strings', () => {
    runner.emit('test:fail', {
      i: 24,
      duration: 10,
      passed: false,
      actual: new String('Wrapped String'),
      expected: 'Other'
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('Diff:')
    expect(allLogs).toContain('Actual Output:')
    expect(allLogs).toContain('"Wrapped String"')
  })

  it('should show Diff for long strings', () => {
    const longActual = 'A'.repeat(150)
    const longExpected = 'B'.repeat(150)
    runner.emit('test:fail', {
      i: 25,
      duration: 10,
      passed: false,
      actual: longActual,
      expected: longExpected
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('Diff:')
  })

  it('should truncate very long strings in middle', () => {
    const veryLongString = 'START' + 'X'.repeat(600) + 'END'
    runner.emit('test:pass', {
      i: 26,
      duration: 1,
      passed: true,
      actual: veryLongString
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('START')
    expect(allLogs).toContain('...')
    expect(allLogs).toContain('END')
    expect(allLogs.length).toBeLessThan(veryLongString.length)
  })

  it('should have correct indentation for diffs at different levels', () => {
    // 1. Top-level mismatch (should have 2 spaces before '✖ Diff:')
    runner.emit('test:fail', {
      i: 28,
      duration: 1,
      passed: false,
      actual: 'long actual string to trigger diff..........................................................................................',
      expected: 'long expected string to trigger diff.........................................................................................'
    })

    // 2. Failure item mismatch (should have 4 spaces before '✖ Diff:')
    runner.emit('test:fail', {
      i: 29,
      duration: 1,
      passed: false,
      failures: [
        {
          message: 'item error',
          actual: 'long actual string to trigger diff..........................................................................................',
          expected: 'long expected string to trigger diff.........................................................................................'
        }
      ]
    })

    const calls = mockCmd.log.mock.calls.map((c: any) => c[1]) // Keep original to check exact indentation
    const logs = calls.map(c => stripColor(c))

    const topLevelDiffLine = logs.find(l => l.includes('✖ Diff:') && l.startsWith('  ✖ Diff:'))
    expect(topLevelDiffLine).toBeDefined()

    const itemLevelDiffLine = logs.find(l => l.includes('✖ Diff:') && l.startsWith('    ✖ Diff:'))
    expect(itemLevelDiffLine).toBeDefined()
  })

  it('should handle RegExp vs Object comparison without diff', () => {
    runner.emit('test:fail', {
      i: 30,
      duration: 1,
      passed: false,
      actual: { data: 'test' },
      expected: /test/
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).not.toContain('Diff:')
    expect(allLogs).toContain('Actual Output:')
    expect(allLogs).toContain('"data": "test"')
    expect(allLogs).toContain('Expected Output:')
    expect(allLogs).toContain('/test/')
  })

  it('should stringify nested RegExps in objects for diff', () => {
    runner.emit('test:fail', {
      i: 31,
      duration: 1,
      passed: false,
      actual: { foo: 'bar' },
      expected: { foo: /bar/ }
    })
    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('Diff:')
    expect(allLogs).toContain('/bar/')
  })
})
