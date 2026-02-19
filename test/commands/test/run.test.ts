import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AITestRunner } from '@isdk/ai-test-runner'
import RunTest from '../../../src/oclif/commands/test/index.js'
import * as fixtureLib from '../../../src/lib/test-fixture-file.js'
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
    observe: vi.fn()
  }))
}))

vi.mock('../../../src/lib/test-fixture-file.js', () => ({
  loadTestFixtureFile: vi.fn()
}))

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
})
