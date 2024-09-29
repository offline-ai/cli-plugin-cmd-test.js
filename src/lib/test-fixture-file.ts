import fs from 'fs'
import path from 'path'
import { LogLevelMap, parseFrontMatter, parseYaml } from '@isdk/ai-tool-agent'
import { AIScriptEx, runScript } from '@offline-ai/cli-plugin-core'
import { expandPath } from '@offline-ai/cli-common'
import { getMultiLevelExtname, hasDirectoryIn } from '@isdk/ai-tool'
import { omit } from 'lodash-es'
import { toMatchObject } from './to-match-object.js'

const DefaultFixtrureExtname = '.fixture.yaml'

export interface TestFixtureLogItem {
  passed: boolean, input: any, actual: any, expected: any, reason?: string,
  error?: any,
  i: number,
}

export interface TestFixtureFileResult {
  failedCount: number;
  passedCount: number;
  logs: TestFixtureLogItem[];
}

const ReasonNames = ['reason', 'reasons', 'explanation', 'explanations', 'reasoning', 'reasonings']

function getReasonValue(obj: any) {
  // get obj value by any ReasonNames
  const name = ReasonNames.find(name => name in obj)
  return name && obj[name]
}

export async function* testFixtureFileInScript(fixtures: any[], {scriptFilepath, userConfig, fixtureFilepath}: {scriptFilepath: string, userConfig: any, fixtureFilepath: string}) {
  const thisCmd = userConfig.ThisCmd

  // await thisCmd.config.runHook('init_tools', {id: 'run', userConfig})

  let failedCount = 0
  let passedCount = 0
  // const testLogs: TestFixtureLogItem[] = []
  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i]
    if (fixture.skip) {
      continue
    }
    const input = fixture.input
    if (!input) {
      thisCmd.error(`fixture[${i}] missing input for the fixture file: ` + fixtureFilepath)
    }
    const output = fixture.output
    if (!output) {
      thisCmd.error(`fixture[${i}] missing output for the fixture file: ` + fixtureFilepath)
    }
    userConfig.data = {...input}
    userConfig.interactive = false

    try {
      thisCmd.log(`🚀 ~ Running(${path.basename(scriptFilepath)}) ~ fixture[${i}]`)
      let result = await runScript(scriptFilepath, userConfig)
      // console.log('🚀 ~ testFixtureFileInScript ~ result:', result)
      if (LogLevelMap[userConfig.logLevel] >= LogLevelMap.info && result?.content) {
        result = result.content
      }
      let failed = false
      let expected = output
      let actual = result
      let error
      const isResultStr = typeof result === 'string'

      const failedKeys = toMatchObject(actual, expected)
      if (failedKeys) {
        failed = true
        error = `MisMatch:\n    ${failedKeys.join('\n    ')}`
      }

      const reason = !isResultStr ? getReasonValue(result) : undefined
      if (!isResultStr) {
        if (!Array.isArray(actual) && typeof actual === 'object') {actual = omit(actual, ReasonNames)}
        if (!Array.isArray(expected) && typeof expected === 'object') {expected = omit(expected, ReasonNames)}
      }
      const testLog: TestFixtureLogItem = {passed: !failed, input, actual, expected, i}
      if (error) {testLog.error = error}
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
    scriptIds.push(...Object.keys(scriptInfos).filter( id => !scriptInfos[id].data.test?.skip))
  }

  if (!scriptIds.length) {
    thisCmd.error('Can not find script to run!')
  }

  let fixtures = parseYaml(fixtureInfo.content) as any[]
  if (!fixtures) {
    thisCmd.error('Can not find fixture in the file: ' + fixtureFilepath)
  }
  if (!Array.isArray(fixtures)) {
    fixtures = [fixtures]
  }

  if (userConfig.includeIndex || userConfig.excludeIndex) {
    fixtures.forEach((fixture, i) => {
      if (userConfig.includeIndex) {
        fixture.skip = !userConfig.includeIndex.includes(i)
      } else if (userConfig.excludeIndex) {
        fixture.skip = userConfig.excludeIndex.includes(i)
      }
    })
  }

  const testResults: {script: string, test: Awaited<ReturnType<typeof testFixtureFileInScript>>}[] = []

  for (const scriptFilepath of scriptIds) {
    const testResult = testFixtureFileInScript(fixtures, {scriptFilepath, userConfig, fixtureFilepath})
    testResults.push({script: scriptFilepath, test: testResult})
    // yield {script: scriptFilepath, test: testResult}
  }

  return testResults
}
