import fs from 'fs'
import path from 'path'
// @ts-ignore
import { getTemplateData, LogLevelMap, parseFrontMatter, parseYaml } from '@isdk/ai-tool-agent'
import { AIScriptEx, runScript } from '@offline-ai/cli-plugin-core'
import { expandPath, getMultiLevelExtname, hasDirectoryIn } from '@isdk/ai-tool'
import { cloneDeep, defaultsDeep, omit, omitBy } from 'lodash-es'
import { formatObject, validateMatch } from './to-match-object.js'
import { writeYamlFile } from './write-yaml-file.js'
import { YamlTypeJsonSchema } from './yaml-types/index.js'

const DefaultFixtrureExtname = '.fixture.yaml'

export interface TestFixtureLogItem {
  passed: boolean, input: any, actual: any, expected: any, reason?: string, expectedSchema?: any,
  error?: any,
  i: number,
  duration: number // ms
  not?: boolean
}

export interface TestFixtureFileResult {
  failedCount: number;
  passedCount: number;
  logs: TestFixtureLogItem[];
  duration: number;
}

const ReasonNames = ['thinking', 'reasonings', 'reasoning', 'reasons', 'reason', 'explanations', 'explanation']

function getReasonValue(obj: any) {
  // get obj value by any ReasonNames
  const name = ReasonNames.find(name => name in obj)
  return name && obj[name]
}

async function defaultValue(value: any, defaultValue?: any, data?: any) {
  const isYamlJsonSchema = (value instanceof YamlTypeJsonSchema) || (defaultValue instanceof YamlTypeJsonSchema)

  if (value == null) {
    value = defaultValue
  } else if (typeof value === 'object' && defaultValue && typeof defaultValue === 'object') {
    value = defaultsDeep({}, value, defaultValue)
  }

  if (typeof value !== 'function'){
    if (data) {
      value = await formatObject(value, {data})
    }
    if (value && (!Array.isArray(value)) && typeof value === 'object') {
      value = omitBy(value, (v, k) => v == null || (typeof v === 'string' && v.trim() === ''))
    }

    if (isYamlJsonSchema) {
      value = YamlTypeJsonSchema.create(value)
    }
  }

  return value
}
export interface TestFixtureFileOptions {
  scriptFilepath: string
  userConfig: any
  fixtureFilepath: string
  fixtureConfig: any
  skips: {[k: number]: boolean}
}
export async function* testFixtureFileInScript(fixtures: any[], {scriptFilepath, userConfig, fixtureFilepath, skips, fixtureConfig}: TestFixtureFileOptions) {
  const thisCmd = userConfig.ThisCmd

  // await thisCmd.config.runHook('init_tools', {id: 'run', userConfig})

  let failedCount = 0
  let passedCount = 0
  const _fixtureConfig = fixtureConfig
  const fixtureDir = path.dirname(path.resolve(fixtureFilepath))
  const scriptDir = path.dirname(path.resolve(scriptFilepath))
  const scriptConfig = await getScriptDataByFilepath(scriptFilepath, userConfig)
  if (scriptConfig.output) {
    _fixtureConfig.outputSchema = defaultsDeep({}, _fixtureConfig.outputSchema, scriptConfig.output)
  }

  // const testLogs: TestFixtureLogItem[] = []
  for (let i = 0; i < fixtures.length; i++) {
    fixtureConfig = cloneDeep(_fixtureConfig)
    const fixture = cloneDeep(fixtures[i])
    fixture.__fixture_dir__ = fixtureDir
    fixture.__script_dir__  = scriptDir
    if (skips[i] || fixture.skip) {
      continue
    }
    const input = await defaultValue(fixture.input, fixtureConfig?.input)

    // if (!input) {
    //   thisCmd.error(`fixture[${i}] missing input for the fixture file: ` + fixtureFilepath)
    // }
    const output = await defaultValue(fixtures[i].output, fixtureConfig?.output)
    if (output == null && !userConfig.generateOutput && !fixture.outputSchema && !fixtureConfig.outputSchema) {
      thisCmd.error(`fixture[${i}] missing output or outputSchema for the fixture file: ` + fixtureFilepath)
    }
    fixtureConfig = await formatObject(fixtureConfig, {data: {...input, ...fixtureConfig}, input: fixture});
    userConfig.data = await formatObject({...input}, {data: {...getTemplateData(scriptConfig), ...input, fixtureConfig}, input: fixture});

    userConfig.interactive = false
    // userConfig.chatsDir = undefined
    if (userConfig.newChat === undefined) userConfig.newChat = true
    const data = {...fixtureConfig, ...userConfig.data}

    const ts = Date.now()
    try {
      thisCmd.log('notice', `🚀 ~ Running(${path.basename(scriptFilepath)}) ~ fixture[${i}]`)
      let result = await runScript(scriptFilepath, userConfig)
      const duration = Date.now() - ts
      if (LogLevelMap[userConfig.logLevel] >= LogLevelMap.info && result?.content) {
        result = result.content
      }
      if (output == null && userConfig.generateOutput) {
        fixture.output = fixtures[i].output = result
        thisCmd.log(`Without output: write the result as output`)
        await writeYamlFile(fixtureFilepath, fixtures)
      }

      let failed = false
      let expected = output
      const actual = result
      let error
      const isResultStr = typeof result === 'string'

      let failedKeys: string[]|false|undefined

      const checkSchema = userConfig.checkSchema ?? fixture.checkSchema ?? fixtureConfig.checkSchema
      let expectedSchema: any

      if (checkSchema !== false) {
        expectedSchema = defaultsDeep ({}, fixture.outputSchema, fixtureConfig.outputSchema)
        if (expectedSchema.type) {
          failedKeys = await validateMatch(actual, YamlTypeJsonSchema.create(expectedSchema), {data, input: fixture})
        }
        if (failedKeys) {
          failed = true
          error = `JSON Schema MisMatch:\n    ${failedKeys.join('\n    ')}`
        }
      }

      if (!failed && expected !== undefined) {
        failedKeys = await validateMatch(actual, expected, {data, input: fixture})
        if (failedKeys) {
          failed = true
          error = `MisMatch:\n    ${failedKeys.join('\n    ')}`
        }
      }

      // no any validateMatch() be executed.
      if (failedKeys === undefined) { continue }

      const reason = !isResultStr ? getReasonValue(result) : undefined
      if (!isResultStr) {
        // if (!Array.isArray(actual) && typeof actual === 'object') {actual = omit(actual, ReasonNames)}
        if (!Array.isArray(expected) && typeof expected === 'object') {expected = omit(expected, ReasonNames)}
      }
      if (typeof expected !== 'function'){
        expected = await formatObject(expected, {data, input: fixture})
      }
      if (fixture.not) {failed = !failed}
      const testLog: TestFixtureLogItem = {passed: !failed, input, actual, expected, i, duration, expectedSchema}
      if (fixture.not) {testLog.not = true}
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
  const info = await loadTestFixtureFile(fixtureFilepath, userConfig)
  return getTestFixtures(info)
}

export function getTestFixtures({scriptIds, fixtures, skips, fixtureInfo, userConfig, fixtureFilepath}) {
  const testResults: {script: string, test: Awaited<ReturnType<typeof testFixtureFileInScript>>}[] = []
  const fixtureConfig = fixtureInfo.data //await formatObject(fixtureInfo.data, {data: fixtureInfo.data})

  for (const scriptFilepath of scriptIds) {
    const testResult = testFixtureFileInScript(fixtures, {scriptFilepath, userConfig, fixtureFilepath, skips, fixtureConfig})
    testResults.push({script: scriptFilepath, test: testResult})
    // yield {script: scriptFilepath, test: testResult}
  }

  return testResults
}

export async function loadTestFixtureFile(fixtureFilepath: string, userConfig: any) {
  const thisCmd = userConfig.ThisCmd
  fixtureFilepath = expandPath(fixtureFilepath, userConfig)
  const extname = getMultiLevelExtname(fixtureFilepath, 2)
  if (!extname || extname.length === 1) {
    fixtureFilepath = path.join(path.dirname(fixtureFilepath), path.basename(fixtureFilepath, extname) + DefaultFixtrureExtname)
  }

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

  let scripts: string[] = userConfig.script
  if (scripts) {
    scripts = [scripts as any]
    const t = fixtureInfo.data.script || fixtureInfo.data.scripts
    if (t) {
      if (Array.isArray(t)) {scripts.push(...t)} else {scripts.push(t)}
    }
  } else {
    scripts = fixtureInfo.data.script || fixtureInfo.data.scripts
  }

  if (scripts) {
    scripts = Array.isArray(scripts) ? scripts : [scripts]
    // filter duplicated items
    scripts.filter((item, ix, arr)=>arr.indexOf(item) === ix)
    .forEach((script: string) => {
      const scriptFilepath = expandPath(script, userConfig)
      if (!scriptIds.includes(scriptFilepath)) {
        scriptIds.push(scriptFilepath)
      }
    })
  } else {
    // thisCmd.error('missing script to run! the script option should be in the fixture file: ' + script)
    const fixtureFileBaseName = path.basename(fixtureFilepath, getMultiLevelExtname(fixtureFilepath, 2))
    const scriptInfos = await AIScriptEx.getMatchedScriptInfos('/^'+ fixtureFileBaseName + '([.]|$)/', {searchPaths: userConfig.agentDirs})
    const keys = Object.keys(scriptInfos)
    const onlyIndex = keys.findIndex(id => scriptInfos[id].data.test?.only)
    if (onlyIndex >= 0) {
      scriptIds.push(keys[onlyIndex])
    } else {
      scriptIds.push(...keys.filter(id => !scriptInfos[id].data.test?.skip))
    }
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

  const onlyIndex = fixtures.findIndex(fixture => fixture.only)
  const skips = {} as {[key: number]: boolean}

  if (onlyIndex >= 0) {
    fixtures.forEach((fixture, i) => {
      skips[i] = i !== onlyIndex
      // fixture.skip = i !== onlyIndex
    })
  } else if (userConfig.includeIndex || userConfig.excludeIndex) {
    fixtures.forEach((fixture, i) => {
      if (userConfig.includeIndex) {
        // fixture.skip = !userConfig.includeIndex.includes(i)
        skips[i] = !userConfig.includeIndex.includes(i)
      } else if (userConfig.excludeIndex) {
        // fixture.skip = userConfig.excludeIndex.includes(i)
        skips[i] = userConfig.excludeIndex.includes(i)
      }
    })
  }

  return { scriptIds, fixtures, skips, fixtureInfo, userConfig, fixtureFilepath }
}

async function getScriptInfoByFilepath(filepath: string, userConfig: any) {
  const id = path.basename(filepath, getMultiLevelExtname(filepath, 2))
  const scriptInfos = await AIScriptEx.getMatchedScriptInfos(id, {searchPaths: userConfig.agentDirs})
  return scriptInfos[id]
}

async function getScriptDataByFilepath(filepath: string, userConfig: any) {
  const info = await getScriptInfoByFilepath(filepath, userConfig)
  return info?.data
}