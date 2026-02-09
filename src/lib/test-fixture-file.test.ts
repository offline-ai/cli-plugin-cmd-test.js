import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { loadTestFixtureFile } from './test-fixture-file.js'
// @ts-ignore
import { parseFrontMatter, parseYaml } from '@isdk/ai-tool-agent'

vi.mock('fs', async () => {
  const actual: any = await vi.importActual<typeof fs>('fs')
  return {
    ...actual,
    default: {
      ...actual.default,
      readFileSync: vi.fn(),
    },
    readFileSync: vi.fn(),
  }
})

vi.mock('@isdk/ai-tool-agent', () => ({
  parseFrontMatter: vi.fn(),
  parseYaml: vi.fn(),
}))

vi.mock('@offline-ai/cli-plugin-core', () => ({
  AIScriptEx: {
    getMatchedScriptInfos: vi.fn(),
  },
}))

vi.mock('@isdk/ai-tool', () => ({
  expandPath: vi.fn((p) => p),
  getMultiLevelExtname: vi.fn(() => '.fixture.yaml'),
  hasDirectoryIn: vi.fn(() => true),
}))

describe('loadTestFixtureFile', () => {
  const mockThisCmd = {
    error: vi.fn((msg) => { throw new Error(msg) })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(path, 'join').mockImplementation((...args) => args.join('/'))
    vi.spyOn(path, 'dirname').mockReturnValue('/test')
    vi.spyOn(path, 'basename').mockReturnValue('test.fixture')
  })

  it('should generate correct skips for includeIndex', async () => {
    const fixtureContent = 'fixtures content'
    const fixtures = [
      { input: '1' },
      { input: '2' },
      { input: '3' }
    ]

    vi.mocked(fs.readFileSync).mockReturnValue(`frontmatter
---
content`)
    vi.mocked(parseFrontMatter).mockReturnValue({ data: { script: 'test.ai.yaml' }, content: fixtureContent } as any)
    vi.mocked(parseYaml).mockReturnValue(fixtures)

    const userConfig = {
      ThisCmd: mockThisCmd,
      includeIndex: [1] // 仅包含第2项
    }

    const result = await loadTestFixtureFile('test.fixture.yaml', userConfig)

    expect(result.skips).toEqual({
      0: true,
      1: false,
      2: true
    })
    expect(result.fixtures).toEqual(fixtures)
  })

  it('should generate correct skips for excludeIndex', async () => {
    const fixtures = [
      { input: '1' },
      { input: '2' }
    ]

    vi.mocked(fs.readFileSync).mockReturnValue('...')
    vi.mocked(parseFrontMatter).mockReturnValue({ data: { script: 'test.ai.yaml' }, content: '...' } as any)
    vi.mocked(parseYaml).mockReturnValue(fixtures)

    const userConfig = {
      ThisCmd: mockThisCmd,
      excludeIndex: [0] // 排除第1项
    }

    const result = await loadTestFixtureFile('test.fixture.yaml', userConfig)

    expect(result.skips).toEqual({
      0: true,
      1: false
    })
  })

  it('should not generate skips when no index filters provided', async () => {
    const fixtures = [{ input: '1' }]
    vi.mocked(fs.readFileSync).mockReturnValue('...')
    vi.mocked(parseFrontMatter).mockReturnValue({ data: { script: 'test.ai.yaml' }, content: '...' } as any)
    vi.mocked(parseYaml).mockReturnValue(fixtures)

    const userConfig = { ThisCmd: mockThisCmd }
    const result = await loadTestFixtureFile('test.fixture.yaml', userConfig)

    expect(result.skips).toEqual({})
  })

  it('should preserve skip and only in fixtures for ai-test-runner', async () => {
    const fixtures = [
      { input: '1', only: true },
      { input: '2', skip: true }
    ]
    vi.mocked(fs.readFileSync).mockReturnValue('...')
    vi.mocked(parseFrontMatter).mockReturnValue({ data: { script: 'test.ai.yaml' }, content: '...' } as any)
    vi.mocked(parseYaml).mockReturnValue(fixtures)

    const userConfig = { ThisCmd: mockThisCmd }
    const result = await loadTestFixtureFile('test.fixture.yaml', userConfig)

    expect(result.fixtures[0].only).toBe(true)
    expect(result.fixtures[1].skip).toBe(true)
    // 此时 skips 应该为空，因为过滤逻辑交由 runner 处理
    expect(result.skips).toEqual({})
  })
})
