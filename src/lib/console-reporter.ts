import path from 'path'
import cj from 'color-json'
import color from 'ansicolor'
import * as diff from 'diff'
// @ts-ignore
import { LogLevel, LogLevelMap } from '@isdk/ai-tool-agent'
import { AITestRunner, AITestLogItem } from '@isdk/ai-test-runner'

function stableStringify(obj: any): string {
  if (obj === undefined) return 'undefined'
  if (obj === null) return 'null'
  try {
    return JSON.stringify(obj, (key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce((sorted: any, k) => {
            sorted[k] = value[k]
            return sorted
          }, {})
      }
      return value
    }, 2) || 'undefined'
  } catch (e: any) {
    return `[Stringify Error: ${e.message}]`
  }
}

export class ConsoleReporter {
  constructor(private cmd: any, private logLevel: LogLevel = 'warn') {}

  log(level: LogLevel, ...args: any[]) {
    this.cmd?.log?.(level, ...args)
  }

  observe(runner: AITestRunner, scriptPath: string) {
    const scriptBase = path.basename(scriptPath || 'unknown')

    runner.on('test:start', (data) => {
      const i = data?.i ?? '?'
      this.log('notice', `${color.cyan('▶')} Running ${color.blue(scriptBase)} Fixture[${i}]`)
    })

    runner.on('test:pass', (log: AITestLogItem) => {
      if (!log) return
      this.log('warn', `${color.green('✔ PASSED')} ${color.blue(scriptBase)} Fixture[${log.i}] (${log.duration}ms)`)
      if (log.reason) {
        const reason = typeof log.reason === 'string' ? log.reason : (log.reason ? cj(log.reason) : 'null')
        this.log('warn', `  Reason: ${reason}`)
      }

      if (LogLevelMap[this.logLevel] <= LogLevelMap['notice']) {
        this.renderDetail(log)
      }
    })

    runner.on('test:fail', (log: AITestLogItem) => {
      if (!log) return
      this.log('warn', `${color.red('✖ FAILED')} ${color.blue(scriptBase)} Fixture[${log.i}] (${log.duration}ms)`)
      if (log.reason) {
        const reason = typeof log.reason === 'string' ? log.reason : (log.reason ? cj(log.reason) : 'null')
        this.log('warn', `  Reason: ${reason}`)
      }
      this.renderDetail(log, true)
    })

    runner.on('test:error', (log: AITestLogItem) => {
      if (!log) return
      this.log('warn', `${color.red('✖ ERROR')} ${color.blue(scriptBase)} Fixture[${log.i}] (${log.duration}ms)`)
      if (log.error) this.log('warn', `  ${color.red('🔴')} ${color.red(log.error.message || String(log.error))}`)
    })

    runner.on('test:skip', (log: AITestLogItem) => {
      if (!log) return
      this.log('notice', `${color.darkGray('○')} SKIPPED ${color.blue(scriptBase)} Fixture[${log.i}]`)
    })
  }

  private renderDetail(log: AITestLogItem, isFailed = false) {
    if (!log) return
    const { actual, expected, expectedSchema, failures, input, not: isNot } = log
    const sNot = isNot ? color.red('NOT ') : ''
    const level = isFailed ? 'warn' : 'notice'

    const indent = (val: any, prefix = '    ') => {
      const str = String(val)
      return str.split('\n').map(line => prefix + line).join('\n')
    }

    const formatValue = (val: any) => {
      if (val === null) return color.darkGray('null')
      if (val === undefined) return color.darkGray('undefined')
      if (typeof val === 'string') return color.cyan(val)
      if (typeof val === 'function') return color.yellow(val.name ? val.name + '()' : val.toString())
      if (val instanceof RegExp) return color.magenta(val.toString())
      if (typeof val === 'object') return cj(val)
      return color.cyan(String(val))
    }

    if (isFailed && input !== undefined) {
      this.log(level, `  Input:`)
      this.log(level, indent(formatValue(input)))
    }

    const hasFailDiff = !isNot && ((failures && failures.length > 0 && failures.some(f => f && (f.diff || (f.actual !== undefined && f.expected !== undefined)))) ||
                        (isFailed && expected !== undefined && (!failures || failures.length === 0)))

    if (!isFailed || !hasFailDiff) {
      this.log(level, `  Actual Output:`)
      this.log(level, indent(formatValue(actual)))
    }

    if (expectedSchema && Object.keys(expectedSchema).length) {
      this.log('notice', `  ${sNot}Expected JSON Schema:`)
      this.log('notice', indent(formatValue(expectedSchema)))
    }

    if (expected !== undefined && (!isFailed || !hasFailDiff)) {
      this.log('notice', `  ${sNot}Expected Output:`)
      this.log('notice', indent(formatValue(expected)))
    }

    if (isFailed) {
      if (Array.isArray(failures) && failures.length > 0) {
        this.log(level, `  ${color.red('Failures:')}`)
        failures.forEach(f => {
          if (!f) return
          if (f.diff) {
            this.renderDiff(f.diff)
          } else if (f.message) {
            this.log(level, `    ${color.red('✖')} ${color.red(f.message)}${f.key ? ' at ' + color.yellow(f.key) : ''}`)
            if (f.actual !== undefined && f.expected !== undefined) {
              const actualStr = typeof f.actual === 'string' ? f.actual : stableStringify(f.actual)
              const expectedStr = typeof f.expected === 'string' ? f.expected : stableStringify(f.expected)
              const d = (actualStr.includes('\n') || expectedStr.includes('\n'))
                ? diff.diffLines(expectedStr, actualStr)
                : diff.diffChars(expectedStr, actualStr)
              this.renderDiff(d)
            }
          }
        })
      } else if (expected !== undefined && !isNot) {
        // No explicit failures, but failed (could be top-level mismatch)
        const actualStr = typeof actual === 'string' ? actual : stableStringify(actual)
        const expectedStr = typeof expected === 'string' ? expected : stableStringify(expected)
        const d = (actualStr.includes('\n') || expectedStr.includes('\n'))
          ? diff.diffLines(expectedStr, actualStr)
          : diff.diffChars(expectedStr, actualStr)
        this.renderDiff(d)
      }
    }
  }

  private renderDiff(diffItems: any[]) {
    if (!Array.isArray(diffItems)) return
    const isMultiLine = diffItems.some(d => d && d.value && typeof d.value === 'string' && d.value.includes('\n'))

    if (!isMultiLine) {
      const diffStr = diffItems.map(d => {
        if (!d) return ''
        const value = d.value ?? ''
        let result = d.added ? color.green('+' + value) :
          d.removed ? color.red('-' + value) : color.darkGray(value)

        if (d.verified) {
          result = color.white('✓('+ this.stripConsoleColor(result) + ')')
        }
        return result
      }).join('')
      this.log('notice', `    ${color.red('✖')} Diff: ${diffStr}`)
    } else {
      this.log('notice', `    ${color.red('✖')} Diff:`)
      diffItems.forEach(d => {
        if (!d || !d.value) return
        const lines = String(d.value).split('\n')
        lines.forEach((line: string, i: number) => {
          if (i === lines.length - 1 && line === '') return
          let prefix = d.added ? '+' : d.removed ? '-' : ' '
          let lineContent = line
          let result = d.added ? color.green(prefix + lineContent) :
                       d.removed ? color.red(prefix + lineContent) :
                       color.darkGray(prefix + lineContent)

          if (d.verified) {
            result = color.white('✓(' + this.stripConsoleColor(result) + ')')
          }
          this.log('notice', `      ${result}`)
        })
      })
    }
  }

  private stripConsoleColor(str: string) {
    return str.replace(/\x1B\[\d+m/g, '')
  }
}

