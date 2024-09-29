import fs from 'fs'
import path from 'path'
import { LogLevelMap, parseFrontMatter, parseYaml } from '@isdk/ai-tool-agent'
import { AIScriptEx, runScript } from '@offline-ai/cli-plugin-core'
import { expandPath } from '@offline-ai/cli-common'
import { getKeysPath, getMultiLevelExtname, hasDirectoryIn } from '@isdk/ai-tool'
import { get as getByPath, omit } from 'lodash-es'

const DefaultFixtrureExtname = '.fixture.yaml'

export interface TestFixtureLogItem {
  passed: boolean, input: any, actual: any, expected: any, reason?: string,
  i: number,
}

export interface TestFixtureFileResult {
  failedCount: number;
  passedCount: number;
  logs: TestFixtureLogItem[];
}

export async function* testFixtureFileInScript(fixtures: any[], {scriptFilepath, userConfig, fixtureFilepath}: {scriptFilepath: string, userConfig: any, fixtureFilepath: string}) {
  const thisCmd = userConfig.ThisCmd
  if (!userConfig.logLevel) {
    userConfig.logLevel = userConfig.interactive ? 'error' : 'warn'
  }

  // await thisCmd.config.runHook('init_tools', {id: 'run', userConfig})

  let failedCount = 0
  let passedCount = 0
  // const testLogs: TestFixtureLogItem[] = []
  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i]
    const input = fixture.input
    if (!input) {
      thisCmd.error(`fixture[${i}] missing input for the fixture file: ` + fixtureFilepath)
    }
    let output = fixture.output
    if (!output) {
      thisCmd.error(`fixture[${i}] missing output for the fixture file: ` + fixtureFilepath)
    }
    userConfig.data = {...input}
    userConfig.interactive = false

    try {
      thisCmd.log(`🚀 ~ Running ~ fixtures[${i}]`)
      let result = await runScript(scriptFilepath, userConfig)
      // console.log('🚀 ~ testFixtureFileInScript ~ result:', result)
      if (LogLevelMap[userConfig.logLevel] >= LogLevelMap.info && result?.content) {
        result = result.content
      }
      let keys = getKeysPath(output)
      let failed = false
      let expected = output
      let actual = result
      const isResultStr = typeof result === 'string'
      if (isResultStr || typeof output === 'string') {
        keys = ['result']
        if (isResultStr) {result = result.trim()}
        actual = {result}
        if (typeof output === 'string') {output = output.trim()}
        expected = {result: output}
      }

      for (const key of keys) {
        let actualValue = getByPath(actual, key)
        if (typeof actualValue === 'string') { actualValue = actualValue.trim()}
        let expectedValue = getByPath(expected, key)
        if (typeof expectedValue === 'string') { expectedValue = expectedValue.trim()}
        if (expectedValue instanceof RegExp) {
          failed = !expectedValue.test(actualValue)
        } else if (actualValue != expectedValue) {
          // console.log(`❌ ~ RunTest[${i}] ~ failed on ${key}:`, cj(input), '~ expected:', cj(expectedValue), 'actual:', cj(actualValue));
          failed = true
        }
      }
      const reason = result.reason
      if (isResultStr) {
        actual = actual.result
        expected = expected.result
      } else {
        actual = omit(actual, ['reason'])
        expected = omit(expected, ['reason'])
      }
      const testLog: TestFixtureLogItem = {passed: !failed, input, actual, expected, i}
      if (reason) {testLog.reason = reason}

      if (failed) {
        failedCount++
      } else {
        passedCount++
      }
      yield testLog
      // testLogs.push(testLog)
    } catch (error: any) {
      if (error) {
        console.log('🚀 ~ RunTest ~ run ~ error:', error)
        thisCmd.error(error.message)
      }
    }
  }
  // console.log(`${passedCount} passed, ${failedCount} failed, total ${fixtures.length}`)
  // return {failedCount, passedCount, fixtures, logs: testLogs}
}

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

  if (!userConfig.agentDirs) {
    userConfig.agentDirs = []
  }

  if (fixtureFilepath) {
    const fixtureDir = path.dirname(fixtureFilepath)
    if (!hasDirectoryIn(fixtureDir, userConfig.agentDirs)) {
      userConfig.agentDirs.push(fixtureDir)
    }
  }

  const scriptIds: string[] = []

  if (fixtureInfo.data.script) {
    const scriptFilepath = expandPath(fixtureInfo.data.script, userConfig)
    scriptIds.push(scriptFilepath)
  } else {
    // thisCmd.error('missing script to run! the script option should be in the fixture file: ' + script)
    const fixtureFileBaseName = path.basename(fixtureFilepath, getMultiLevelExtname(fixtureFilepath, 2))
    const scriptInfos = await AIScriptEx.getMatchedScriptInfos('/^'+ fixtureFileBaseName + '[.]/', {searchPaths: userConfig.agentDirs})
    scriptIds.push(...Object.keys(scriptInfos))
  }

  if (!scriptIds.length) {
    thisCmd.error('Can not find script to run!')
  }

  let fixtures = parseYaml(fixtureInfo.content)
  if (!fixtures) {
    thisCmd.error('Can not find fixture in the file: ' + fixtureFilepath)
  }
  if (!Array.isArray(fixtures)) {
    fixtures = [fixtures]
  }

  const testResults: {script: string, test: Awaited<ReturnType<typeof testFixtureFileInScript>>}[] = []

  for (const scriptFilepath of scriptIds) {
    const testResult = testFixtureFileInScript(fixtures, {scriptFilepath, userConfig, fixtureFilepath})
    testResults.push({script: scriptFilepath, test: testResult})
    // yield {script: scriptFilepath, test: testResult}
  }

  return testResults
}
