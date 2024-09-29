import cj from 'color-json'
import { Args, Flags } from '@oclif/core'
import { logLevel, LogLevelMap } from '@isdk/ai-tool-agent'

import { AICommand, AICommonFlags, showBanner } from '@offline-ai/cli-common'
import { testFixtureFile, TestFixtureFileResult, TestFixtureLogItem } from '../../../lib/test-fixture-file.js'

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
    ...AICommonFlags,
    script: Flags.string({char: 'f', description: 'the AI fixture file path'}),
    stream: Flags.boolean({char: 'm', description: 'stream mode, defaults to false', default: false}),
    'consoleClear': Flags.boolean({
      aliases: ['console-clear', 'ConsoleClear', 'Console-clear', 'Console-Clear'],
      description: 'Whether console clear after stream output, default to true in interactive, false to non-interactive',
      allowNo: true,
    }),
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

    const testResults = await testFixtureFile(fixtureFilename, userConfig)
    // const testResults: {script: string, test: TestFixtureFileResult}[] = []

    // for await (const {script, test: testInfo} of testFixtureFile(fixtureFilename, userConfig)) {
    for (const vTest of testResults) {
      const {script, test: testInfo} = vTest
      this.log('🚀 ~ Running ~ script:', script)
      let passedCount = 0
      let failedCount = 0
      const test: TestFixtureFileResult = {logs: [], passedCount, failedCount}
      for await (const testLog of testInfo) {
        test.logs.push(testLog)
        const i = testLog.i
        const reason = testLog.reason ? `Reason: ${testLog.reason}` : ''
        const actual = testLog.actual
        const expected = testLog.expected
        if (testLog.passed) {
          passedCount++
          this.log(`👍 ~ RunTest[${i}] ~ ok!`, reason);
          const level = userConfig.logLevel
          if (LogLevelMap[level] >= LogLevelMap['verbose']) {
            this.log('🔧 ~ actual output:', typeof actual === 'string' ? actual : cj(actual));
            this.log('🔧 ~ expected output:', typeof expected === 'string' ? expected : cj(expected))
          }
        } else {
          failedCount++
          this.log(`❌ ~ RunTest[${i}] ~ failed input:`, cj(testLog.input), reason);
          this.log('🔧 ~ actual output:', typeof actual === 'string' ? actual : cj(actual));
          this.log('🔧 ~ expected output:', typeof expected === 'string' ? expected : cj(expected))
        }
      }
      this.log(`${passedCount} passed, ${failedCount} failed, total ${passedCount + failedCount}`)
      test.passedCount = passedCount
      test.failedCount = failedCount
      vTest.test = test as any
      // testResults.push({script, test})
    }

    return testResults as unknown as {script: string, test: TestFixtureFileResult}[]
  }
}
