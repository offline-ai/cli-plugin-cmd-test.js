import { beforeAll, describe, it, expect, vi, beforeEach } from 'vitest'
import { AITestRunner } from '@isdk/ai-test-runner'
import RunTest from '../../../src/oclif/commands/test/index.js'
import * as fixtureLib from '../../../src/lib/test-fixture-file.js'
import { writeYamlFile } from '../../../src/lib/write-yaml-file.js'
import path from 'node:path'

vi.mock('@isdk/ai-test-runner', () => {
  const run = vi.fn().mockResolvedValue({
    passedCount: 1,
    failedCount: 0,
    skippedCount: 0,
    duration: 100,
    logs: []
  })
  return {
    AITestRunner: vi.fn().mockImplementation(() => ({
      run,
      on: vi.fn(),
    })),
  }
})

vi.mock('../../../src/lib/console-reporter.js', () => ({
  ConsoleReporter: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    renderErrors: vi.fn()
  }))
}))

vi.mock('../../../src/lib/test-fixture-file.js', () => ({
  loadTestFixtureFile: vi.fn()
}))

vi.mock('../../../src/lib/write-yaml-file.js', () => ({
  writeYamlFile: vi.fn()
}))

vi.mock('@offline-ai/cli-plugin-core', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    loadScript: vi.fn().mockResolvedValue({ name: 'test' }),
    runScript: vi.fn().mockResolvedValue({
      content: 'ok',
      messages: [],
      [Symbol.for('isdk.meta')]: {},
    }),
  }
})

vi.mock('@offline-ai/cli-common', async () => {
  const actual = await vi.importActual('@offline-ai/cli-common') as any
  class MockAICommand extends actual.AICommand {
    log() {}
    error(msg: string) { throw new Error(msg) }
  }
  return {
    ...actual,
    AICommand: MockAICommand,
    showBanner: vi.fn()
  }
})

describe('RunTest custom operators', () => {
  let command: RunTest

  beforeAll(() => {
    // Prevent ai-tool's shutdown logic from being triggered by signals
    process.removeAllListeners('SIGTERM')
    process.removeAllListeners('SIGINT')
    // Stub process.exit to do nothing and prevent it from being hijacked or throwing
    vi.stubGlobal('process', {
      ...process,
      exit: vi.fn(),
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-ignore
    command = new RunTest([], {} as any)
  })

  it('should pass baseDir, operators and allowOperatorOverride to runner.run', async () => {
    const fixtureFilepath = '/abs/path/to/my.fixture.yaml'
    const operators = { $isSafe: './safe.js' }
    const fixtureFileInfo = {
      scriptIds: ['test-script.ai.yaml'],
      fixtures: [{ input: 'test', expect: { output: { $isSafe: true } } }],
      skips: {},
      fixtureInfo: {
        data: {
          operators
        }
      },
      fixtureFilepath
    }

    const userConfig = {
      fixtureFileInfo,
      allowOperatorOverride: true,
      logLevel: 'error'
    }

    await command.runTest(userConfig)

    const runnerInstance = vi.mocked(AITestRunner).mock.results[0].value
    expect(runnerInstance.run).toHaveBeenCalledWith(
      'test-script.ai.yaml',
      fixtureFileInfo.fixtures,
      expect.objectContaining({
        baseDir: path.dirname(path.resolve(fixtureFilepath)),
        operators,
        allowOperatorOverride: true
      })
    )
  })

  it('should use default allowOperatorOverride: false if not provided', async () => {
    const fixtureFilepath = 'my.fixture.yaml'
    const fixtureFileInfo = {
      scriptIds: ['test.ai.yaml'],
      fixtures: [],
      skips: {},
      fixtureInfo: { data: {} },
      fixtureFilepath
    }

    const userConfig = {
      fixtureFileInfo,
      logLevel: 'error'
      // allowOperatorOverride is undefined
    }

    await command.runTest(userConfig)

    const runnerInstance = vi.mocked(AITestRunner).mock.results[0].value
    expect(runnerInstance.run).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        allowOperatorOverride: undefined // because userConfig.allowOperatorOverride is undefined
      })
    )
  })

  it('should handle missing operators gracefully', async () => {
    const fixtureFileInfo = {
      scriptIds: ['test.ai.yaml'],
      fixtures: [],
      skips: {},
      fixtureInfo: { data: {} }, // No operators defined
      fixtureFilepath: 'test.fixture.yaml'
    }

    await command.runTest({ fixtureFileInfo, logLevel: 'error' })

    const runnerInstance = vi.mocked(AITestRunner).mock.results[0].value
    expect(runnerInstance.run).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        operators: undefined
      })
    )
  })

  it('should pass correct parameters to all scripts when multiple scriptIds exist', async () => {
    const fixtureFilepath = '/abs/path/to/my.fixture.yaml'
    const operators = { $custom: './op.js' }
    const fixtureFileInfo = {
      scriptIds: ['script1.ai.yaml', 'script2.ai.yaml'],
      fixtures: [{ input: 'test' }],
      skips: {},
      fixtureInfo: { data: { operators } },
      fixtureFilepath
    }

    await command.runTest({ fixtureFileInfo, logLevel: 'error', allowOperatorOverride: false })

    // In each iteration of runTest, a new ConsoleReporter is created but runner is reuse for same scriptIds loop?
    // Wait, in runTest:
    // const runner = new AITestRunner(executor)
    // for (const scriptFilepath of scriptIds) { ... runner.run(...) }
    // So runner instance is same for all scripts in one runTest call.

    const runnerInstance = vi.mocked(AITestRunner).mock.results[0].value
    expect(runnerInstance.run).toHaveBeenCalledTimes(2)

    expect(runnerInstance.run).toHaveBeenNthCalledWith(1,
      'script1.ai.yaml',
      expect.anything(),
      expect.objectContaining({
        baseDir: path.dirname(path.resolve(fixtureFilepath)),
        operators,
        allowOperatorOverride: false
      })
    )

    expect(runnerInstance.run).toHaveBeenNthCalledWith(2,
      'script2.ai.yaml',
      expect.anything(),
      expect.objectContaining({
        baseDir: path.dirname(path.resolve(fixtureFilepath)),
        operators,
        allowOperatorOverride: false
      })
    )
  })

  it('should instantiate ConsoleReporter with deferErrors: true and runIndex, and call renderErrors', async () => {
    const fixtureFileInfo = {
      scriptIds: ['test.ai.yaml'],
      fixtures: [],
      skips: {},
      fixtureInfo: { data: {} },
      fixtureFilepath: 'test.fixture.yaml'
    }

    const { ConsoleReporter } = await import('../../../src/lib/console-reporter.js')

    await command.runTest({ fixtureFileInfo, logLevel: 'error' }, 5)

    expect(ConsoleReporter).toHaveBeenCalledWith(command, 'error', true, 5)

    const reporterInstance = vi.mocked(ConsoleReporter).mock.results[0].value
    expect(reporterInstance.renderErrors).toHaveBeenCalled()
  })
})

describe('RunTest --generateOutput side effect', () => {
  let command: RunTest

  // The mocked AITestRunner shares one `run` mock: grab it via a throwaway
  // instance and make its next run() resolve the given test logs.
  async function mockRunLogs(logs: any[]) {
    const runner = new AITestRunner({} as any)
    vi.mocked(runner.run).mockResolvedValueOnce({
      passedCount: 1,
      failedCount: 0,
      skippedCount: 0,
      duration: 10,
      logs,
    } as any)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-ignore
    command = new RunTest([], {} as any)
  })

  it('should write missing outputs back to the fixture file', async () => {
    await mockRunLogs([
      { i: 0, actual: 'generated-0' },
      { i: 1, actual: 'generated-1' }, // output already defined
      { i: 2 }, // no actual
    ])
    const fixtureFileInfo = {
      scriptIds: ['test.ai.yaml'],
      fixtures: [{ input: 'a' }, { input: 'b', output: 'preset' }, { input: 'c' }],
      skips: {},
      fixtureInfo: { data: {} },
      fixtureFilepath: 'test.fixture.yaml',
    }

    const logSpy = vi.spyOn(command, 'log')

    await command.runTest({ fixtureFileInfo, logLevel: 'error', generateOutput: true })

    expect(fixtureFileInfo.fixtures[0].output).toBe('generated-0')
    expect(fixtureFileInfo.fixtures[1].output).toBe('preset')
    expect(fixtureFileInfo.fixtures[2]).not.toHaveProperty('output')

    expect(writeYamlFile).toHaveBeenCalledTimes(1)
    expect(writeYamlFile).toHaveBeenCalledWith('test.fixture.yaml', fixtureFileInfo.fixtures)
    expect(logSpy).toHaveBeenCalledWith('warn', 'Without output: write the result as output')
  })

  it('should not write the fixture file when no output is missing', async () => {
    await mockRunLogs([{ i: 0, actual: 'generated' }])
    const fixtureFileInfo = {
      scriptIds: ['test.ai.yaml'],
      fixtures: [{ input: 'a', output: 'preset' }],
      skips: {},
      fixtureInfo: { data: {} },
      fixtureFilepath: 'test.fixture.yaml',
    }

    await command.runTest({ fixtureFileInfo, logLevel: 'error', generateOutput: true })

    expect(fixtureFileInfo.fixtures[0].output).toBe('preset')
    expect(writeYamlFile).not.toHaveBeenCalled()
  })

  it('should not touch fixtures nor write file when generateOutput is disabled', async () => {
    await mockRunLogs([{ i: 0, actual: 'generated' }])
    const fixtureFileInfo = {
      scriptIds: ['test.ai.yaml'],
      fixtures: [{ input: 'a' }],
      skips: {},
      fixtureInfo: { data: {} },
      fixtureFilepath: 'test.fixture.yaml',
    }

    await command.runTest({ fixtureFileInfo, logLevel: 'error' })

    expect(fixtureFileInfo.fixtures[0]).not.toHaveProperty('output')
    expect(writeYamlFile).not.toHaveBeenCalled()
  })
})

describe('RunTest runCount>1 consistency check', () => {
  const testResult = (script: string, passedCount: number, failedCount: number, skippedCount = 0, duration = 10) => ({
    script,
    test: { passedCount, failedCount, skippedCount, duration, logs: [] },
  })

  // Stub the oclif/AICommand entry dependencies at instance level so run()
  // can be driven without touching real config/flag parsing.
  function createRunCommand(args: any, flags: any) {
    const command: any = new RunTest([], {} as any)
    command.parse = vi.fn().mockResolvedValue({ args, flags })
    command.loadConfig = vi.fn().mockResolvedValue({})
    command.jsonEnabled = vi.fn().mockReturnValue(false)
    return command
  }

  function getSummaryLog(logSpy: any) {
    return logSpy.mock.calls.map((c: any[]) => c[1]).find((s: any) => typeof s === 'string' && s.startsWith('Repeated('))
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should run runTest runCount times with runIndex and aggregate consistent runs', async () => {
    const command = createRunCommand({ file: 'my.fixture.yaml' }, { runCount: 2 })
    const logSpy = vi.spyOn(command, 'log')
    const runTestSpy = vi.spyOn(command, 'runTest')
      .mockResolvedValueOnce([testResult('s.ai.yaml', 2, 1, 0, 50)])
      .mockResolvedValueOnce([testResult('s.ai.yaml', 2, 1, 0, 70)])

    const testResults = await command.run()

    expect(runTestSpy).toHaveBeenCalledTimes(2)
    expect(runTestSpy.mock.calls[0][1]).toBe(1)
    expect(runTestSpy.mock.calls[1][1]).toBe(2)
    expect(testResults).toHaveLength(2)

    const summary = getSummaryLog(logSpy)
    expect(summary).toContain('Repeated(2) All: 4 passed, 2 failed, 0 skipped, total 6')
    expect(summary).toContain('0 missmatched.')
  })

  it('should report mismatch when counts differ across runs', async () => {
    const command = createRunCommand({ file: 'my.fixture.yaml' }, { runCount: 2 })
    const logSpy = vi.spyOn(command, 'log')
    vi.spyOn(command, 'runTest')
      .mockResolvedValueOnce([testResult('s.ai.yaml', 2, 0)])
      .mockResolvedValueOnce([testResult('s.ai.yaml', 1, 1)])

    await command.run()

    const summary = getSummaryLog(logSpy)
    expect(summary).toContain('3 passed, 1 failed')
    expect(summary).toContain('1 missmatched.')
  })

  it('should report mismatch when script names differ across runs', async () => {
    const command = createRunCommand({ file: 'my.fixture.yaml' }, { runCount: 2 })
    const logSpy = vi.spyOn(command, 'log')
    vi.spyOn(command, 'runTest')
      .mockResolvedValueOnce([testResult('a.ai.yaml', 1, 0)])
      .mockResolvedValueOnce([testResult('b.ai.yaml', 1, 0)])

    await command.run()

    const summary = getSummaryLog(logSpy)
    expect(summary).toContain('1 missmatched.')
  })

  it('should run once without runIndex and no consistency summary when runCount defaults to 1', async () => {
    const command = createRunCommand({ file: 'my.fixture.yaml' }, {})
    const logSpy = vi.spyOn(command, 'log')
    const runTestSpy = vi.spyOn(command, 'runTest').mockResolvedValue([testResult('s.ai.yaml', 1, 0)])

    await command.run()

    expect(runTestSpy).toHaveBeenCalledTimes(1)
    expect(runTestSpy.mock.calls[0][1]).toBeUndefined()
    expect(getSummaryLog(logSpy)).toBeUndefined()
  })

  it('should error when the fixture file argument is missing', async () => {
    const command = createRunCommand({}, {})
    await expect(command.run()).rejects.toThrow('missing fixture file to run')
  })
})
