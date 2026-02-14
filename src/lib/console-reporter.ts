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
  if (obj instanceof RegExp) return obj.toString()
  if (typeof obj === 'string') return obj
  if (obj instanceof String || obj instanceof Number || obj instanceof Boolean) return obj.toString()
  try {
    return JSON.stringify(obj, (key, value) => {
      if (value instanceof RegExp) return value.toString()
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof RegExp)) {
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

function truncateMiddle(str: string, maxLen: number = 500): string {
  if (str.length <= maxLen) return str
  const half = Math.floor((maxLen - 3) / 2)
  return str.substring(0, half) + '...' + str.substring(str.length - half)
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
      if (typeof val === 'string' || val instanceof String) {
        return color.cyan(JSON.stringify(truncateMiddle(String(val))))
      }
      if (typeof val === 'function') return color.yellow(val.name ? val.name + '()' : val.toString())
      if (val instanceof RegExp) return color.magenta(val.toString())
      if (typeof val === 'object') return cj(val)
      return color.cyan(String(val))
    }

    if (isFailed && input !== undefined) {
      this.log(level, `  Input:`)
      this.log(level, indent(formatValue(input)))
    }

    const isShort = (v: any) => (typeof v === 'string' || v instanceof String) && v.length < 100
    const bothShort = isShort(actual) && isShort(expected)

    const hasFailDiff = !isNot && ((failures && failures.length > 0 && failures.some(f => f && (f.diff || (f.actual !== undefined && f.expected !== undefined && !(f.expected instanceof RegExp))))) ||
                        (isFailed && expected !== undefined && !(expected instanceof RegExp) && (!failures || failures.length === 0)))

    if (!isFailed || !hasFailDiff || bothShort) {
      this.log(level, `  Actual Output:`)
      this.log(level, indent(formatValue(actual)))
    }

    if (expectedSchema && Object.keys(expectedSchema).length) {
      this.log('notice', `  ${sNot}Expected JSON Schema:`)
      this.log('notice', indent(formatValue(expectedSchema)))
    }

    if (expected !== undefined && (!isFailed || !hasFailDiff || bothShort)) {
      this.log('notice', `  ${sNot}Expected Output:`)
      this.log('notice', indent(formatValue(expected)))
    }

    if (isFailed) {
      if (Array.isArray(failures) && failures.length > 0) {
        this.log(level, `  ${color.red('Failures:')}`)
        failures.forEach(f => {
          if (!f) return
          if (f.diff) {
            this.renderDiff(f.diff, '    ')
          } else if (f.message) {
            this.log(level, `    ${color.red('✖')} ${color.red(f.message)}${f.key ? ' at ' + color.yellow(f.key) : ''}`)
            if (f.actual !== undefined && f.expected !== undefined) {
              if (!(f.expected instanceof RegExp) && !(f.actual instanceof RegExp)) {
                const actualStr = stableStringify(f.actual)
                const expectedStr = stableStringify(f.expected)
                const d = (actualStr.includes('\n') || expectedStr.includes('\n'))
                  ? diff.diffLines(expectedStr, actualStr)
                  : diff.diffChars(expectedStr, actualStr)
                this.renderDiff(d, '    ')
              } else {
                this.log(level, `      Actual: ${formatValue(f.actual)}`)
                this.log(level, `      Expected: ${formatValue(f.expected)}`)
              }
            }
          }
        })
      } else if (expected !== undefined && !isNot && !(expected instanceof RegExp) && !(actual instanceof RegExp)) {
        // No explicit failures, but failed (could be top-level mismatch)
        const actualStr = stableStringify(actual)
        const expectedStr = stableStringify(expected)
        const d = (actualStr.includes('\n') || expectedStr.includes('\n'))
          ? diff.diffLines(expectedStr, actualStr)
          : diff.diffChars(expectedStr, actualStr)
        this.renderDiff(d, '  ')
      }
    }
  }

  private renderDiff(diffItems: any[], prefix = '  ') {
    if (!Array.isArray(diffItems)) return
    const isMultiLine = diffItems.some(d => d && d.value && typeof d.value === 'string' && d.value.includes('\n'))
    const indent = prefix + '  '

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
      this.log('notice', `${prefix}${color.red('✖')} Diff: ${diffStr}`)
    } else {
      this.log('notice', `${prefix}${color.red('✖')} Diff:`)
      diffItems.forEach(d => {
        if (!d || !d.value) return
        const lines = String(d.value).split('\n')
        lines.forEach((line: string, i: number) => {
          if (i === lines.length - 1 && line === '') return
          let prefixChar = d.added ? '+' : d.removed ? '-' : ' '
          let lineContent = line
          let result = d.added ? color.green(prefixChar + lineContent) :
                       d.removed ? color.red(prefixChar + lineContent) :
                       color.darkGray(prefixChar + lineContent)

          if (d.verified) {
            result = color.white('✓(' + this.stripConsoleColor(result) + ')')
          }
          this.log('notice', `${indent}${result}`)
        })
      })
    }
  }

  private stripConsoleColor(str: string) {
    return str.replace(/\x1B\[\d+m/g, '')
  }
}
