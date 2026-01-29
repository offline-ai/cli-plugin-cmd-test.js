import fs from 'fs'
import path from 'path'
// @ts-ignore
import { parseFrontMatter, parseYaml } from '@isdk/ai-tool-agent'
import { AIScriptEx } from '@offline-ai/cli-plugin-core'
import { expandPath, getMultiLevelExtname, hasDirectoryIn } from '@isdk/ai-tool'

const DefaultFixtrureExtname = '.fixture.yaml'

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
    })
  } else if (userConfig.includeIndex || userConfig.excludeIndex) {
    fixtures.forEach((fixture, i) => {
      if (userConfig.includeIndex) {
        skips[i] = !userConfig.includeIndex.includes(i)
      } else if (userConfig.excludeIndex) {
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

export async function getScriptDataByFilepath(filepath: string, userConfig: any) {
  const info = await getScriptInfoByFilepath(filepath, userConfig)
  return info?.data
}
