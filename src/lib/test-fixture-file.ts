import fs from 'fs'
import path from 'path'
import { LogLevelMap, parseFrontMatter, parseYaml } from '@isdk/ai-tool-agent'
import {runScript} from '@offline-ai/cli-plugin-core'
import { expandPath } from '@offline-ai/cli-common'
import { getKeysPath, getMultiLevelExtname } from '@isdk/ai-tool'
import { get as getByPath, omit } from 'lodash-es'

const DefaultFixtrureExtname = '.fixture.yaml'

export async function testFixtureFile(fixtureFilepath: string, userConfig: any) {
  const thisCmd = userConfig.ThisCmd
  fixtureFilepath = expandPath(fixtureFilepath, userConfig)
  const extname = getMultiLevelExtname(fixtureFilepath, 2)
  if (!extname || extname.length === 1) {
    fixtureFilepath = path.join(path.dirname(fixtureFilepath), path.basename(fixtureFilepath, extname) + DefaultFixtrureExtname)
  } //

  const fixtureText = fs.readFileSync(fixtureFilepath, {encoding: 'utf8'})
  if (!fixtureText) {
    thisCmd.error(`fixture file not found: ${fixtureFilepath}`)
  }

  const fixtureInfo = parseFrontMatter(fixtureText)
  if (!fixtureInfo.data.script) {
    // thisCmd.error('missing script to run! the script option should be in the fixture file: ' + script)
    fixtureInfo.data.script = path.basename(fixtureFilepath, getMultiLevelExtname(fixtureFilepath, 2))
  }

  let fixtures = parseYaml(fixtureInfo.content)
  if (!fixtures) {
    thisCmd.error('Can not find fixture in the file: ' + fixtureFilepath)
  }
  if (!Array.isArray(fixtures)) {
    fixtures = [fixtures]
  }

  const scriptFilepath = expandPath(fixtureInfo.data.script, userConfig)
  if (!userConfig.logLevel) {
    userConfig.logLevel = userConfig.interactive ? 'error' : 'warn'
  }

  // await thisCmd.config.runHook('init_tools', {id: 'run', userConfig})

  let failedCount = 0
  let passedCount = 0
  const testLogs: {passed: boolean, input: any, result: any, expected: any, reason?: string}[] = []
  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i]
    const input = fixture.input
    if (!input) {
      thisCmd.error(`fixture[${i}] missing input for the fixture file: ` + fixtureFilepath)
    }
    const output = fixture.output
    if (!output) {
      thisCmd.error(`fixture[${i}] missing output for the fixture file: ` + fixtureFilepath)
    }
    userConfig.data = fixture.input
    userConfig.interactive = false

    try {
      let result = await runScript(scriptFilepath, userConfig)
      if (LogLevelMap[userConfig.logLevel] >= LogLevelMap.info && result?.content) {
        result = result.content
      }
      const keys = getKeysPath(output)
      let failed = false
      for (const key of keys) {
        const actualValue = getByPath(result, key)
        const expectedValue = getByPath(output, key)
        if (expectedValue instanceof RegExp) {
          failed = !expectedValue.test(actualValue)
        } else if (actualValue != expectedValue) {
          // console.log(`❌ ~ RunTest[${i}] ~ failed on ${key}:`, cj(input), '~ expected:', cj(expectedValue), 'actual:', cj(actualValue));
          failed = true
        }
      }
      const reason = result.reason
      const testLog: any = {passed: !failed, input, result: omit(result, ['reason']), expected: omit(output, ['reason'])}
      if (reason) {testLog.reason = reason}
      testLogs.push(testLog)

      if (failed) {
        failedCount++
      } else {
        passedCount++
      }
    } catch (error: any) {
      if (error) {
        console.log('🚀 ~ RunTest ~ run ~ error:', error)
        thisCmd.error(error.message)
      }
    }
  }
  // console.log(`${passedCount} passed, ${failedCount} failed, total ${fixtures.length}`)
  return {failedCount, passedCount, fixtures, logs: testLogs}
}