import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsoleReporter } from './console-reporter.js'
import { EventEmitter } from 'events'
import color from 'ansicolor'

describe('ConsoleReporter deferErrors', () => {
  let mockCmd: any
  let runner: EventEmitter

  beforeEach(() => {
    mockCmd = {
      log: vi.fn()
    }
    runner = new EventEmitter()
  })

  const stripColor = (str: string) => str.replace(/\x1B\[\d+m/g, '')

  it('should only log brief fail/error status during runner emission when deferErrors is true', () => {
    const reporter = new ConsoleReporter(mockCmd, 'notice', true)
    reporter.observe(runner as any, 'test-script.js')

    runner.emit('test:fail', {
      i: 0,
      duration: 100,
      passed: false,
      actual: 'bad output',
      expected: 'good output',
      reason: 'wrong content'
    })

    runner.emit('test:error', {
      i: 1,
      duration: 200,
      passed: false,
      error: new Error('Internal Failure')
    })

    const calls = mockCmd.log.mock.calls
    expect(calls.length).toBe(2)

    // Verify first call is just the status for FAIL
    expect(calls[0][0]).toBe('warn')
    expect(stripColor(calls[0][1])).toContain('✖ FAILED test-script.js Fixture[0] (100ms)')
    expect(stripColor(calls[0][1])).not.toContain('Reason')
    expect(stripColor(calls[0][1])).not.toContain('Actual Output')

    // Verify second call is just the status for ERROR
    expect(calls[1][0]).toBe('warn')
    expect(stripColor(calls[1][1])).toContain('✖ ERROR test-script.js Fixture[1] (200ms)')
    expect(stripColor(calls[1][1])).not.toContain('Internal Failure')
  })

  it('should print accumulated detailed failures and errors when renderErrors is called', () => {
    const reporter = new ConsoleReporter(mockCmd, 'notice', true)
    reporter.observe(runner as any, 'test-script.js')

    runner.emit('test:fail', {
      i: 0,
      duration: 120,
      passed: false,
      actual: 'bad output',
      expected: 'good output',
      reason: 'mismatch info'
    })

    runner.emit('test:error', {
      i: 1,
      duration: 50,
      passed: false,
      error: new Error('Critical Timeout')
    })

    mockCmd.log.mockClear()

    reporter.renderErrors()

    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')

    expect(allLogs).toContain('Detailed Errors/Failures:')
    expect(allLogs).toContain('1) ✖ FAILED test-script.js Fixture[0] (120ms)')
    expect(allLogs).toContain('Reason: mismatch info')
    expect(allLogs).toContain('Actual Output:')
    expect(allLogs).toContain('"bad output"')
    expect(allLogs).toContain('Expected Output:')
    expect(allLogs).toContain('"good output"')

    expect(allLogs).toContain('2) ✖ ERROR test-script.js Fixture[1] (50ms)')
    expect(allLogs).toContain('🔴 Critical Timeout')
  })

  it('should print runIndex suffix in headers when runIndex is provided', () => {
    const reporter = new ConsoleReporter(mockCmd, 'notice', true, 3)
    reporter.observe(runner as any, 'test-script.js')

    runner.emit('test:fail', {
      i: 0,
      duration: 10,
      passed: false,
      reason: 'minor issue'
    })

    mockCmd.log.mockClear()
    reporter.renderErrors()

    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('Detailed Errors/Failures (Run #3):')
  })

  it('should render LLM parameters when available in actualMeta.ai.parameters', () => {
    const reporter = new ConsoleReporter(mockCmd, 'notice', true)
    reporter.observe(runner as any, 'test-script.js')

    runner.emit('test:fail', {
      i: 0,
      duration: 15,
      passed: false,
      reason: 'mismatch',
      actualMeta: {
        ai: {
          parameters: {
            temperature: 0.7,
            seed: 42,
            max_tokens: 100
          }
        }
      } as any
    })

    runner.emit('test:error', {
      i: 1,
      duration: 25,
      passed: false,
      error: new Error('LLM Error'),
      actualMeta: {
        ai: {
          parameters: {
            temperature: 0.1,
            seed: 123
          }
        }
      } as any
    })

    mockCmd.log.mockClear()
    reporter.renderErrors()

    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')

    // For failed fixture
    expect(allLogs).toContain('LLM Parameters: temperature=0.7, seed=42, max_tokens=100')
    // For errored fixture
    expect(allLogs).toContain('LLM Parameters: temperature=0.1, seed=123')
  })

  it('should render LLM parameters in non-deferred path as well', () => {
    const reporter = new ConsoleReporter(mockCmd, 'notice', false)
    reporter.observe(runner as any, 'test-script.js')

    runner.emit('test:fail', {
      i: 0,
      duration: 15,
      passed: false,
      actualMeta: {
        ai: {
          parameters: {
            temperature: 0.9
          }
        }
      } as any
    })

    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('LLM Parameters: temperature=0.9')
  })

  it('should expand objects in LLM parameters using JSON.stringify and ignore response and empty values', () => {
    const reporter = new ConsoleReporter(mockCmd, 'notice', false)
    reporter.observe(runner as any, 'test-script.js')

    runner.emit('test:fail', {
      i: 0,
      duration: 15,
      passed: false,
      actualMeta: {
        ai: {
          parameters: {
            temperature: 0.7,
            response: 'some large response text',
            chatTemplate: { name: 'qwen' },
            empty_val: '',
            null_val: null,
            undef_val: undefined,
            grammar_id: 'nobj'
          }
        }
      } as any
    })

    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    // Should contain temperature, chatTemplate expanded as JSON, grammar_id
    expect(allLogs).toContain('LLM Parameters: temperature=0.7, chatTemplate={"name":"qwen"}, grammar_id=nobj')
    // Should NOT contain response or empty values
    expect(allLogs).not.toContain('response=')
    expect(allLogs).not.toContain('empty_val=')
    expect(allLogs).not.toContain('null_val=')
    expect(allLogs).not.toContain('undef_val=')
  })

  it('should show Actual Output on failure with diff when logLevel is notice', () => {
    const reporter = new ConsoleReporter(mockCmd, 'notice', true)
    reporter.observe(runner as any, 'test-script.js')

    const longActual = 'actual output '.repeat(15) // 210 chars
    const longExpected = 'expected output '.repeat(15) // 240 chars

    runner.emit('test:fail', {
      i: 0,
      duration: 10,
      passed: false,
      actual: longActual,
      expected: longExpected,
      reason: 'mismatch'
    })

    mockCmd.log.mockClear()
    reporter.renderErrors()

    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('Actual Output:')
    expect(allLogs).toContain(longActual)
  })

  it('should NOT show Actual Output on failure with diff when logLevel is warn', () => {
    const reporter = new ConsoleReporter(mockCmd, 'warn', true)
    reporter.observe(runner as any, 'test-script.js')

    const longActual = 'actual output '.repeat(15) // 210 chars
    const longExpected = 'expected output '.repeat(15) // 240 chars

    runner.emit('test:fail', {
      i: 0,
      duration: 10,
      passed: false,
      actual: longActual,
      expected: longExpected,
      reason: 'mismatch'
    })

    mockCmd.log.mockClear()
    reporter.renderErrors()

    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).not.toContain('Actual Output:')
  })

  it('should not output anything from renderErrors if there are no failures', () => {
    const reporter = new ConsoleReporter(mockCmd, 'notice', true)
    reporter.observe(runner as any, 'test-script.js')

    runner.emit('test:pass', {
      i: 0,
      duration: 10,
      passed: true
    })

    mockCmd.log.mockClear()
    reporter.renderErrors()

    expect(mockCmd.log).not.toHaveBeenCalled()
  })

  it('should not defer or render pass and skip events', () => {
    const reporter = new ConsoleReporter(mockCmd, 'notice', true)
    reporter.observe(runner as any, 'test-script.js')

    runner.emit('test:pass', {
      i: 0,
      duration: 10,
      passed: true
    })

    runner.emit('test:skip', {
      i: 1,
      duration: 10,
      passed: true
    })

    mockCmd.log.mockClear()
    reporter.renderErrors()

    expect(mockCmd.log).not.toHaveBeenCalled()
  })

  it('should handle invalid actualMeta or parameters gracefully', () => {
    const reporter = new ConsoleReporter(mockCmd, 'notice', false)
    reporter.observe(runner as any, 'test-script.js')

    // Null actualMeta
    runner.emit('test:fail', {
      i: 0,
      duration: 10,
      passed: false,
      actualMeta: null as any
    })

    // String actualMeta
    runner.emit('test:fail', {
      i: 1,
      duration: 10,
      passed: false,
      actualMeta: 'invalid-string' as any
    })

    // Non-object parameters
    runner.emit('test:fail', {
      i: 2,
      duration: 10,
      passed: false,
      actualMeta: {
        ai: {
          parameters: 'not-an-object'
        }
      } as any
    })

    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).not.toContain('LLM Parameters:')
  })

  it('should handle circular references gracefully in deferred errors', () => {
    const reporter = new ConsoleReporter(mockCmd, 'notice', true)
    reporter.observe(runner as any, 'test-script.js')

    const circular: any = { a: 1 }
    circular.self = circular

    runner.emit('test:fail', {
      i: 0,
      duration: 10,
      passed: false,
      actual: circular,
      expected: { a: 1 }
    })

    mockCmd.log.mockClear()
    reporter.renderErrors()

    const allLogs = mockCmd.log.mock.calls.map((c: any) => stripColor(c[1])).join('\n')
    expect(allLogs).toContain('[Stringify Error:')
  })
})
