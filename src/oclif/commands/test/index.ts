import cj from 'color-json'
import {Flags} from '@oclif/core'
import { logLevel } from '@isdk/ai-tool-agent'

import { AICommand, AICommonFlags, showBanner } from '@offline-ai/cli-common'
import { testFixtureFile } from '../../../lib/test-fixture-file.js'

export default class RunTest extends AICommand {
  static summary = '🔬 Run simple AI fixtures to test(draft).'

  static description = 'Execute fixtures file to test AI script file and check result.'

  static examples = [
    `<%= config.bin %> <%= command.id %> -f ./fixture.yaml -l info`,
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
    const {flags} = opts
    // console.log('🚀 ~ RunScript ~ run ~ flags:', flags)
    const isJson = this.jsonEnabled()
    const userConfig = await this.loadConfig(flags.config, opts)
    logLevel.json = isJson
    const hasBanner = userConfig.banner ?? userConfig.interactive
    const script = userConfig.script
    if (!script) {
      this.error('missing fixture file to run! require argument: `-f <fixture_file_name>`')
    }

    if (hasBanner) {showBanner()}
    userConfig.ThisCmd = this

    const testResult = await testFixtureFile(script, userConfig)
    for (let i = 0; i < testResult.logs.length; i++) {
      const testLog = testResult.logs[i]
      const reason = testLog.reason ? `Reason: ${testLog.reason}` : ''
      if (testLog.passed) {
        console.log(`👍 ~ RunTest[${i}] ~ ok!`, reason);
      } else {
        console.log(`❌ ~ RunTest[${i}] ~ failed:`, cj(testLog.input), reason);
        console.log('🔧 ~ actual output:', cj(testLog.result), 'expected output:', cj(testLog.expected));
      }
    }
    console.log(`${testResult.passedCount} passed, ${testResult.failedCount} failed, total ${testResult.fixtures.length}`)
  }
}
