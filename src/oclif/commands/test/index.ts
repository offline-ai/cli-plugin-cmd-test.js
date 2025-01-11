import path from 'path'
import cj from 'color-json'
import { Args, Flags } from '@oclif/core'
import { omit } from 'lodash-es'
import { LogLevel, logLevel, LogLevelMap } from '@isdk/ai-tool-agent'

import { AICommand, AICommonFlags, showBanner } from '@offline-ai/cli-common'
import { getTestFixtures, loadTestFixtureFile, TestFixtureFileResult } from '../../../lib/test-fixture-file.js'
import '../../../lib/yaml-types/index.js'

export default class RunTest extends AICommand {
  declare logLevel: LogLevel
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
      char: 'x',
      description: 'the index of the fixture to exclude from running',
      multiple: true,
    }),
    generateOutput: Flags.boolean({char: 'g', description: 'generate output to fixture file if no output is provided'}),
    runCount: Flags.integer({
      char: 'c', description: 'The number of times to run the test case to check if the results are consistent with the previous run, and to record the counts of matching and non-matching results',
      default: 1,
    }),
    checkSchema: Flags.boolean({
      description: 'Whether check JSON schema of output',
      aliases: ['checkschema', 'check-schema'],
      default: true, allowNo: true,
    }),
  }

  log(level: LogLevel, ...args: any[]) {
    if (LogLevelMap[this.logLevel] <= LogLevelMap[level]) {
      return super.log(...args)
    }
  }

  async run(): Promise<any> {
    const opts = await this.parse(RunTest as any)
    const {args, flags} = opts
    // console.log('🚀 ~ RunScript ~ run ~ flags:', flags)
    const isJson = this.jsonEnabled()

    // if (!flags.script) {
    //   flags.script = args.file
    // }

    const userConfig = await this.loadConfig(flags.config, opts)
    this.logLevel = userConfig.logLevel = userConfig.logLevel ?? 'warn'
    logLevel.json = isJson
    const hasBanner = userConfig.banner ?? userConfig.interactive
    const fixtureFilename = args.file
    if (!fixtureFilename) {
      this.error('missing fixture file to run! require argument: `-f <fixture_file_name>`')
    }

    if (hasBanner) {showBanner()}
    userConfig.ThisCmd = this

    if (!userConfig.logLevel) {
      userConfig.logLevel = 'error'
    }

    const fixtureFileInfo = await loadTestFixtureFile(fixtureFilename, userConfig)
    userConfig.fixtureFileInfo = fixtureFileInfo
    const runCount = userConfig.runCount >= 1 ? userConfig.runCount : 1
    const testResults: {script: string, test: TestFixtureFileResult}[][] = []
    for (let i = 0; i < runCount; i++) {
      const test = await this.runTest(userConfig)
      this.log('warn', `----------------------------------------`)
      testResults.push(test)
    }

    if (runCount > 1) {
      // check if the results are consistent with the previous run, and to record the counts of matching and non-matching results
      const firstTestResult = testResults[0]
      let failedCount = 0
      for (let i=0; i < testResults.length; i++) {
        const vTestResult = testResults[i]
        let failed = false
        for (let j=0; j < vTestResult.length; j++) {
          const vTest = vTestResult[j]
          const {script, test: testInfo} = vTest
          const vFirstTest = firstTestResult[j]
          if (vTest.script !== vFirstTest.script) {
            // this.error(`The script name is different in the two runs: ${vTest.script} and ${vFirstTest.script}`)
            this.log('notice', `${i}: The script name is different in the two runs: ${script} and ${vFirstTest.script}`)
            failed = true
          }
          if (testInfo.failedCount !== vFirstTest.test.failedCount) {
            this.log('notice', `${i}: The failed count is different in the two runs: ${testInfo.failedCount} and ${vFirstTest.test.failedCount}`)
            failed = true
          }
          if (testInfo.passedCount !== vFirstTest.test.passedCount) {
            this.log('notice', `${i}: The passed count is different in the two runs: ${testInfo.passedCount} and ${vFirstTest.test.passedCount}`)
            failed = true
          }
        }
        if (failed) {failedCount++}
      }
      this.log('warn', `Repeated(${runCount}): ${failedCount} failed.`)
    }
    return testResults
  }

  async runTest(userConfig: any) {

    const level = userConfig.logLevel

    const testResult = getTestFixtures(userConfig.fixtureFileInfo)
    // const testResults: {script: string, test: TestFixtureFileResult}[] = []
    let totalPassed = 0
    let totalFailed = 0
    let totalDuration = 0

    // for await (const {script, test: testInfo} of testFixtureFile(fixtureFilename, userConfig)) {
    for (const vTest of testResult) {
      const {script, test: testInfo} = vTest
      // this.log('🚀 ~ Running ~ script:', script)
      let passedCount = 0
      let failedCount = 0
      let duration = 0
      const test: TestFixtureFileResult = {logs: [], passedCount, failedCount, duration}
      for await (const testLog of testInfo) {
        test.logs.push(testLog)
        const i = testLog.i
        const reason = testLog.reason ? `Reason: ${typeof testLog.reason === 'string' ? testLog.reason : cj(testLog.reason)}` : ''
        const actual = testLog.actual
        let expected = testLog.expected
        const expectedSchema = testLog.expectedSchema
        duration += testLog.duration
        const sNot = testLog.not ? 'not': ''
        if (expected !== undefined) {
          const vType= typeof expected
          if (vType === 'function') {
            expected = expected.toString()
          } else if (vType === 'object') {
            expected = cj(expected)
          }
        }
        if (testLog.passed) {
          passedCount++
          totalPassed++
          this.log('warn', `👍 ~ Run(${path.basename(script)}) ~ Fixture[${i}] ~ ok!`, reason, ` time ${testLog.duration}ms`);
          if (LogLevelMap[level] <= LogLevelMap['notice']) {
            this.log('notice', '👍🔧 ~ actual output:', typeof actual === 'string' ? actual : cj(actual));
            if (expectedSchema !== undefined) {this.log('notice', '👍🔧 ~ ' +sNot+ ' expected JSON Schema:', cj(expectedSchema))}
            if (expected !== undefined) {
              this.log('notice', '👍🔧 ' +sNot+ ' expected output:', expected)
            }
          }
        } else {
          failedCount++
          totalFailed++
          this.log('warn', `❌ ~ Run(${path.basename(script)}) ~ Fixture[${i}] ~ failed!`, reason, ` time ${testLog.duration}ms`);
          this.log('warn', `🔴🔧 ~ failed input:`, cj(testLog.input));
          this.log('notice', '🔴🔧 ~ actual output:', typeof actual === 'string' ? actual : cj(actual));
          if (expectedSchema !== undefined) {this.log('notice', '🔴🔧 ~ ' +sNot+ ' expected JSON Schema:', cj(expectedSchema))}
          if (expected !== undefined) {this.log('notice', '🔴🔧 ~ ' +sNot+ ' expected output:', expected)}
          if (testLog.error) this.log('warn', '🔴 ', testLog.error.message || testLog.error)
        }
      }
      // this.log(`${script}: ${passedCount} passed, ${failedCount} failed, total ${passedCount + failedCount}`)
      test.passedCount = passedCount
      test.failedCount = failedCount
      test.duration = duration
      totalDuration += duration
      vTest.test = test as any
      // testResults.push({script, test})
    }
    for (const vTest of testResult) {
      const {script, test} = vTest
      const {passedCount, failedCount, duration} = test as any
      this.log('warn', `${script}: ${passedCount} passed, ${failedCount} failed, total ${passedCount + failedCount}, time ${duration}ms`)
    }
    this.log('warn', `All: ${totalPassed} passed, ${totalFailed} failed, total ${totalPassed + totalFailed}, time ${totalDuration}ms`)

    return testResult as unknown as {script: string, test: TestFixtureFileResult}[]
  }
}
