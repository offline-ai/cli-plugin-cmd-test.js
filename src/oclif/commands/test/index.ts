import path from 'path'
import cj from 'color-json'
import { Args, Flags } from '@oclif/core'
import { logLevel, LogLevelMap } from '@isdk/ai-tool-agent'

import { AICommand, AICommonFlags, showBanner } from '@offline-ai/cli-common'
import { testFixtureFile, TestFixtureFileResult } from '../../../lib/test-fixture-file.js'
import { omit } from 'lodash-es'

export default class RunTest extends AICommand {
  static args = {
    file: Args.string({
      description: 'the test fixtures file path',
    }),
  }

  static summary = '🔬 Run simple AI fixtures to test(draft).'

  static description = 'Execute fixtures file to test AI script file and check result.'

  static examples = [
    `<%= config.bin %> <%= command.id %> ./named.fixture.yaml -l info`,
  ]

  static flags = {
    ...AICommand.flags,
    ...omit(AICommonFlags, ['interactive']),
    // stream: Flags.boolean({char: 'm', description: 'stream mode, defaults to false', default: false}),
    streamEcho: Flags.string({
      char: 'e', description: 'stream echo mode, defaults to true',
      default: 'line',
      options: ['true', 'false', 'line'],
      allowNo: true,
      // dependsOn: ['stream'],
    }),

    streamEchoChars: Flags.integer({
      char: 'e', description: 'stream echo max characters limit, defaults to no limit',
      default: 80,
      // dependsOn: ['stream'],
    }),

    'consoleClear': Flags.boolean({
      aliases: ['console-clear', 'ConsoleClear', 'Console-clear', 'Console-Clear'],
      description: 'Whether console clear after stream output, default to true in interactive, false to non-interactive',
      allowNo: true,
    }),
    includeIndex: Flags.integer({char: 'i', description: 'the index of the fixture to run', multiple: true}),
    excludeIndex: Flags.integer({
      char: 'e',
      description: 'the index of the fixture to exclude from running',
      multiple: true,
    }),
    generateOutput: Flags.boolean({char: 'g', description: 'generate output to fixture file if no output is provided'}),
  }

  async run(): Promise<any> {
    const opts = await this.parse(RunTest as any)
    const {args, flags} = opts
    // console.log('🚀 ~ RunScript ~ run ~ flags:', flags)
    const isJson = this.jsonEnabled()

    if (!flags.script) {
      flags.script = args.file
    }

    const userConfig = await this.loadConfig(flags.config, opts)
    logLevel.json = isJson
    const hasBanner = userConfig.banner ?? userConfig.interactive
    const fixtureFilename = userConfig.script
    if (!fixtureFilename) {
      this.error('missing fixture file to run! require argument: `-f <fixture_file_name>`')
    }

    if (hasBanner) {showBanner()}
    userConfig.ThisCmd = this

    if (!userConfig.logLevel) {
      userConfig.logLevel = 'error'
    }
    const level = userConfig.logLevel

    const testResults = await testFixtureFile(fixtureFilename, userConfig)
    // const testResults: {script: string, test: TestFixtureFileResult}[] = []
    let totalPassed = 0
    let totalFailed = 0

    // for await (const {script, test: testInfo} of testFixtureFile(fixtureFilename, userConfig)) {
    for (const vTest of testResults) {
      const {script, test: testInfo} = vTest
      // this.log('🚀 ~ Running ~ script:', script)
      let passedCount = 0
      let failedCount = 0
      const test: TestFixtureFileResult = {logs: [], passedCount, failedCount}
      for await (const testLog of testInfo) {
        test.logs.push(testLog)
        const i = testLog.i
        const reason = testLog.reason ? `Reason: ${typeof testLog.reason === 'string' ? testLog.reason : cj(testLog.reason)}` : ''
        const actual = testLog.actual
        const expected = testLog.expected
        if (testLog.passed) {
          passedCount++
          totalPassed++
          this.log(`👍 ~ Run(${path.basename(script)}) ~ Fixture[${i}] ~ ok!`, reason);
          if (LogLevelMap[level] <= LogLevelMap['notice']) {
            this.log('👍🔧 ~ actual output:', typeof actual === 'string' ? actual : cj(actual));
            this.log('👍🔧 ~ expected output:', typeof expected === 'string' ? expected : cj(expected))
          }
        } else {
          failedCount++
          totalFailed++
          this.log(`❌ ~ Run(${path.basename(script)}) ~ Fixture[${i}] ~ failed input:`, cj(testLog.input), reason);
          this.log('🔴🔧 ~ actual output:', typeof actual === 'string' ? actual : cj(actual));
          this.log('🔴🔧 ~ expected output:', typeof expected === 'string' ? expected : cj(expected))
          if (testLog.error) this.log('🔴 ', testLog.error.message || testLog.error)
        }
      }
      // this.log(`${script}: ${passedCount} passed, ${failedCount} failed, total ${passedCount + failedCount}`)
      test.passedCount = passedCount
      test.failedCount = failedCount
      vTest.test = test as any
      // testResults.push({script, test})
    }
    for (const vTest of testResults) {
      const {script, test} = vTest
      const {passedCount, failedCount} = test as any
      this.log(`${script}: ${passedCount} passed, ${failedCount} failed, total ${passedCount + failedCount}`)
    }
    this.log(`All: ${totalPassed} passed, ${totalFailed} failed, total ${totalPassed + totalFailed}`)

    return testResults as unknown as {script: string, test: TestFixtureFileResult}[]
  }
}
