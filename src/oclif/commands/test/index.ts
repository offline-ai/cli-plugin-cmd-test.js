import { Args, Flags } from '@oclif/core'
import { omit } from 'lodash-es'
// @ts-ignore
import { LogLevel, logLevel, LogLevelMap } from '@isdk/ai-tool-agent'

import { AICommand, AICommonFlags, showBanner } from '@offline-ai/cli-common'
import { loadTestFixtureFile } from '../../../lib/test-fixture-file.js'
import '../../../lib/yaml-types/index.js'

import { AITestRunner, AITestFixtureResult } from '@isdk/ai-test-runner'
import { CLIScriptExecutor } from '../../../lib/cli-executor.js'
import { ConsoleReporter } from '../../../lib/console-reporter.js'
import { writeYamlFile } from '../../../lib/write-yaml-file.js'

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
    const testResults: {script: string, test: AITestFixtureResult}[][] = []
    for (let i = 0; i < runCount; i++) {
      const test = await this.runTest(userConfig)
      this.log('warn', `----------------------------------------`)
      testResults.push(test)
    }

    if (runCount > 1) {
      // check if the results are consistent with the previous run, and to record the counts of matching and non-matching results
      const firstTestResult = testResults[0]
      let notMatchedFailedCount = 0
      let totalPassed = 0
      let totalFailed = 0
      let totalSkipped = 0
      let totalDuration = 0

      for (let i=0; i < testResults.length; i++) {
        const vTestResult = testResults[i]
        let failed = false
        for (let j=0; j < vTestResult.length; j++) {
          const vTest = vTestResult[j]

          const {script, test: testInfo} = vTest
          totalPassed += testInfo.passedCount
          totalFailed += testInfo.failedCount
          totalSkipped += testInfo.skippedCount
          totalDuration += testInfo.duration
          // const {passedCount, failedCount, duration} = test as any
          const vFirstTest = firstTestResult[j]
          if (script !== vFirstTest.script) {
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
        if (failed) {notMatchedFailedCount++}
      }
      this.log('warn', `Repeated(${runCount}) All: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped, total ${totalPassed + totalFailed + totalSkipped}, time ${totalDuration}ms, ${notMatchedFailedCount} missmatched.`)
    }
    return testResults
  }

  async runTest(userConfig: any) {
    const { scriptIds, fixtures, skips, fixtureInfo, fixtureFilepath } = userConfig.fixtureFileInfo
    const fixtureConfig = fixtureInfo.data

    const executor = new CLIScriptExecutor(userConfig)
    const runner = new AITestRunner(executor)
    const reporter = new ConsoleReporter(this, userConfig.logLevel)

    const testResults: { script: string, test: any }[] = []
    let totalPassed = 0
    let totalFailed = 0
    let totalSkipped = 0
    let totalDuration = 0

    for (const scriptFilepath of scriptIds) {
      reporter.observe(runner, scriptFilepath)

      const testResult = await runner.run(scriptFilepath, fixtures, {
        fixtureConfig,
        userConfig,
        skips,
        // Optional: scriptConfig metadata if we can load it here
      })

      // Side effect: Handle --generateOutput
      if (userConfig.generateOutput) {
        let modified = false
        testResult.logs.forEach(log => {
          if (log.actual !== undefined && fixtures[log.i].output === undefined) {
            fixtures[log.i].output = log.actual
            modified = true
          }
        })
        if (modified) {
          this.log(`Without output: write the result as output`)
          await writeYamlFile(fixtureFilepath, fixtures)
        }
      }

      totalPassed += testResult.passedCount
      totalFailed += testResult.failedCount
      totalSkipped += testResult.skippedCount
      totalDuration += testResult.duration

      testResults.push({ script: scriptFilepath, test: testResult })

      this.log('warn', `${scriptFilepath}: ${testResult.passedCount} passed, ${testResult.failedCount} failed, ${testResult.skippedCount} skipped, total ${testResult.passedCount + testResult.failedCount + testResult.skippedCount}, time ${testResult.duration}ms`)
    }

    this.log('warn', `All: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped, total ${totalPassed + totalFailed + totalSkipped}, time ${totalDuration}ms`)

    return testResults
  }
}
