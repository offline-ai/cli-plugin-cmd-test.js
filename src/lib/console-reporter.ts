import path from 'path'
import cj from 'color-json'
import color from 'ansicolor'
// @ts-ignore
import { LogLevel, LogLevelMap } from '@isdk/ai-tool-agent'
import { AITestRunner, AITestLogItem } from '@isdk/ai-test-runner'

export class ConsoleReporter {
  constructor(private cmd: any, private logLevel: LogLevel = 'warn') {}

  log(level: LogLevel, ...args: any[]) {
    this.cmd.log(level, ...args)
  }

  observe(runner: AITestRunner, scriptPath: string) {
    const scriptBase = path.basename(scriptPath)

    runner.on('test:start', ({ i }) => {
      this.log('notice', `🚀 ~ Running(${scriptBase}) ~ fixture[${i}]`)
    })

    runner.on('test:pass', (log: AITestLogItem) => {
      const reason = log.reason ? `Reason: ${typeof log.reason === 'string' ? log.reason : cj(log.reason)}` : ''
      this.log('warn', `👍 ~ Run(${scriptBase}) ~ Fixture[${log.i}] ~ ok!`, reason, ` time ${log.duration}ms`)

      if (LogLevelMap[this.logLevel] <= LogLevelMap['notice']) {
        this.renderDetail(log)
      }
    })

    runner.on('test:fail', (log: AITestLogItem) => {
      const reason = log.reason ? `Reason: ${typeof log.reason === 'string' ? log.reason : cj(log.reason)}` : ''
      this.log('warn', `❌ ~ Run(${scriptBase}) ~ Fixture[${log.i}] ~ failed!`, reason, ` time ${log.duration}ms`)
      this.renderDetail(log, true)
    })

    runner.on('test:error', (log: AITestLogItem) => {
      this.log('warn', `❌ ~ Run(${scriptBase}) ~ Fixture[${log.i}] ~ ERROR!`, ` time ${log.duration}ms`)
      if (log.error) this.log('warn', '🔴 ', log.error.message || log.error)
    })
  }

  private renderDetail(log: AITestLogItem, isFailed = false) {
    const { actual, expected, expectedSchema, failures, input, not: isNot } = log
    const sNot = isNot ? 'not' : ''
    const prefix = isFailed ? '🔴' : '👍'
    const level = isFailed ? 'warn' : 'notice'

    if (isFailed && input) {
        this.log(level, `${prefix}🔧 ~ input:`, typeof input !== 'object' ? color.cyan(input) : cj(input))
    }

    this.log(level, `${prefix}🔧 ~ actual output:`, typeof actual === 'string' ? color.cyan(actual) : cj(actual))

    if (expectedSchema && Object.keys(expectedSchema).length) {
        this.log('notice', `${prefix}🔧 ~ ${sNot} expected JSON Schema:`, cj(expectedSchema))
    }

    if (expected !== undefined) {
        let expectedStr = expected
        if (typeof expected === 'function') expectedStr = expected.toString()
        else if (typeof expected === 'object' && !(expected instanceof RegExp)) expectedStr = cj(expected)

        this.log('notice', `${prefix}🔧 ${sNot} expected output:`, typeof expectedStr === 'string' ? color.cyan(expectedStr) : expectedStr)
    }

    if (failures && failures.length > 0) {
        failures.forEach(f => {
            if (f.diff) {
                this.renderDiff(f.diff)
            } else if (f.message) {
                this.log(level, `   ${color.red(f.message)}${f.key ? ' at ' + color.yellow(f.key) : ''}`)
            }
        })
    }
  }

  private renderDiff(diff: any[]) {
    const diffStr = diff.map(d => {
      const changed = d.added || d.removed || d.verified
      const value = changed ? JSON.stringify(d.value) : d.value
      let result = d.added ? color.green('+'+value) :
        d.removed ? color.red('-'+value) : color.darkGray(value)

      if (d.verified) {
        result = color.white('✓('+ this.stripConsoleColor(result) + ')')
      }
      return result
    }).join('')
    this.log('notice', `   Diff: ${diffStr}`)
  }

  private stripConsoleColor(str: string) {
    return str.replace(/\x1B\[\d+m/g, '')
  }
}
