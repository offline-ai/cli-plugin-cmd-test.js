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
      this.log('notice', `${color.cyan('▶')} Running ${color.blue(scriptBase)} Fixture[${i}]`)
    })

    runner.on('test:pass', (log: AITestLogItem) => {
      this.log('warn', `${color.green('✔ PASSED')} ${color.blue(scriptBase)} Fixture[${log.i}] (${log.duration}ms)`)
      if (log.reason) {
        const reason = typeof log.reason === 'string' ? log.reason : cj(log.reason)
        this.log('warn', `  Reason: ${reason}`)
      }

      if (LogLevelMap[this.logLevel] <= LogLevelMap['notice']) {
        this.renderDetail(log)
      }
    })

    runner.on('test:fail', (log: AITestLogItem) => {
      this.log('warn', `${color.red('✖ FAILED')} ${color.blue(scriptBase)} Fixture[${log.i}] (${log.duration}ms)`)
      if (log.reason) {
        const reason = typeof log.reason === 'string' ? log.reason : cj(log.reason)
        this.log('warn', `  Reason: ${reason}`)
      }
      this.renderDetail(log, true)
    })

    runner.on('test:error', (log: AITestLogItem) => {
      this.log('warn', `${color.red('✖ ERROR')} ${color.blue(scriptBase)} Fixture[${log.i}] (${log.duration}ms)`)
      if (log.error) this.log('warn', `  ${color.red('🔴')} ${color.red(log.error.message || log.error)}`)
    })

    runner.on('test:skip', (log: AITestLogItem) => {
      this.log('notice', `${color.darkGray('○')} SKIPPED ${color.blue(scriptBase)} Fixture[${log.i}]`)
    })
  }

  private renderDetail(log: AITestLogItem, isFailed = false) {
    const { actual, expected, expectedSchema, failures, input, not: isNot } = log
    const sNot = isNot ? color.red('NOT ') : ''
    const level = isFailed ? 'warn' : 'notice'

    const indent = (str: string, prefix = '    ') => {
      return str.split('\n').map(line => prefix + line).join('\n')
    }

    const formatValue = (val: any) => {
      if (val === undefined) return color.darkGray('undefined')
      if (typeof val === 'string') return color.cyan(val)
      if (typeof val === 'function') return color.yellow(val.name ? val.name + '()' : val.toString())
      if (val instanceof RegExp) return color.magenta(val.toString())
      if (typeof val === 'object' && val !== null) return cj(val)
      return color.cyan(String(val))
    }

    if (isFailed && input) {
      this.log(level, `  Input:`)
      this.log(level, indent(formatValue(input)))
    }

    this.log(level, `  Actual Output:`)
    this.log(level, indent(formatValue(actual)))

    if (expectedSchema && Object.keys(expectedSchema).length) {
      this.log('notice', `  ${sNot}Expected JSON Schema:`)
      this.log('notice', indent(formatValue(expectedSchema)))
    }

    if (expected !== undefined) {
      this.log('notice', `  ${sNot}Expected Output:`)
      this.log('notice', indent(formatValue(expected)))
    }

    if (failures && failures.length > 0) {
      this.log(level, `  ${color.red('Failures:')}`)
      failures.forEach(f => {
        if (f.diff) {
          this.renderDiff(f.diff)
        } else if (f.message) {
          this.log(level, `    ${color.red('✖')} ${color.red(f.message)}${f.key ? ' at ' + color.yellow(f.key) : ''}`)
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
    this.log('notice', `    ${color.red('✖')} Diff: ${diffStr}`)
  }

  private stripConsoleColor(str: string) {
    return str.replace(/\x1B\[\d+m/g, '')
  }
}
