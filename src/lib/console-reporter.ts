import path from 'path'
import cj from 'color-json'
import color from 'ansicolor'
import * as diff from 'diff'
// @ts-ignore
import { LogLevel, LogLevelMap } from '@isdk/ai-tool-agent'
import { AITestRunner, AITestLogItem, AIValidationFailure } from '@isdk/ai-test-runner'

function indent(val: any, prefix = '    ') {
  const str = String(val)
  return str.split('\n').map(line => prefix + line).join('\n')
}

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
      const title = data?.title ? `: ${data.title}` : ''
      this.log('notice', `${color.cyan('▶')} Running ${color.blue(scriptBase)} Fixture[${i}]${title}`)
    })

    runner.on('test:pass', (log: AITestLogItem) => {
      if (!log) return
      const title = log.title ? `: ${log.title}` : ''
      this.log('warn', `${color.green('✔ PASSED')} ${color.blue(scriptBase)} Fixture[${log.i}]${title} (${log.duration}ms)`)
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
      const title = log.title ? `: ${log.title}` : ''
      this.log('warn', `${color.red('✖ FAILED')} ${color.blue(scriptBase)} Fixture[${log.i}]${title} (${log.duration}ms)`)
      if (log.reason) {
        const reason = typeof log.reason === 'string' ? log.reason : (log.reason ? cj(log.reason) : 'null')
        this.log('warn', `  Reason: ${reason}`)
      }
      this.renderDetail(log, true)
    })

    runner.on('test:error', (log: AITestLogItem) => {
      if (!log) return
      const title = log.title ? `: ${log.title}` : ''
      this.log('warn', `${color.red('✖ ERROR')} ${color.blue(scriptBase)} Fixture[${log.i}]${title} (${log.duration}ms)`)
      if (log.error) this.log('warn', `  ${color.red('🔴')} ${color.red(log.error.message || String(log.error))}`)
    })

    runner.on('test:skip', (log: AITestLogItem) => {
      if (!log) return
      const title = log.title ? `: ${log.title}` : ''
      this.log('notice', `${color.darkGray('○')} SKIPPED ${color.blue(scriptBase)} Fixture[${log.i}]${title}`)
    })
  }

  private renderDetail(log: AITestLogItem, isFailed = false) {
    if (!log) return
    const { actual, expected, expectedSchema, failures, input, not: isNot } = log
    const sNot = isNot ? color.red('NOT ') : ''
    const level = isFailed ? 'warn' : 'notice'

    if (isFailed && input !== undefined) {
      this.log(level, `  Input:`)
      this.log(level, indent(this.formatValue(input)))
    }

    const isShort = (v: any) => (typeof v === 'string' || v instanceof String) && v.length < 100
    const bothShort = isShort(actual) && isShort(expected)

    const hasFailDiff = !isNot && ((failures && failures.length > 0) ||
                        (isFailed && expected !== undefined && !(expected instanceof RegExp)))

    if (!isFailed || !hasFailDiff || bothShort) {
      this.log(level, `  Actual Output:`)
      this.log(level, indent(this.formatValue(actual)))
    }

    if (expectedSchema && Object.keys(expectedSchema).length) {
      this.log('notice', `  ${sNot}Expected JSON Schema:`)
      this.log('notice', indent(this.formatValue(expectedSchema)))
    }

    if (expected !== undefined && (!isFailed || !hasFailDiff || bothShort)) {
      this.log('notice', `  ${sNot}Expected Output:`)
      this.log('notice', indent(this.formatValue(expected)))
    }

    if (isFailed) {
      if (Array.isArray(failures) && failures.length > 0) {
        this.log(level, `  ${color.red('Failures:')}`)

        // --- 智能摘要与密度控制 ---
        const isObject = expected && typeof expected === 'object' && !Array.isArray(expected)
        const expectedKeys = isObject ? Object.keys(expected) : []
        const totalItems = expectedKeys.length
        const failCount = failures.length

        if (isObject && totalItems > 5 && failCount > totalItems * 0.8) {
          // 绝大部分失败，显示成功项摘要
          const failedKeys = new Set(failures.map(f => f.key))
          const passedKeys = expectedKeys.filter(k => !failedKeys.has(k))
          this.log(level, `    ${color.red('✖')} ${color.yellow(failCount)} items failed. Only the following matched successfully:`)
          passedKeys.forEach(k => this.log(level, `      ${color.green('✔')} ${color.blue(k)}`))
          if (passedKeys.length === 0) this.log(level, `      (None)`)
        } else if (failCount > 10) {
          // 失败项较多，显示摘要
          for (let i = 0; i < 3; i++) this.renderFailure(failures[i], level)
          this.log(level, `    ... (${color.yellow(failCount - 4)} more items skipped) ...`)
          this.renderFailure(failures[failCount - 1], level)
          this.log(level, `    Total: ${color.red(failCount)} failures found.`)
        } else {
          // 少数失败，全量列出
          failures.forEach(f => this.renderFailure(f, level))
        }
      } else if (expected !== undefined && !isNot && !(expected instanceof RegExp) && !(actual instanceof RegExp)) {
        // No explicit failures, but failed (could be top-level mismatch)
        const actualStr = stableStringify(actual)
        const expectedStr = stableStringify(expected)
        const d = (actualStr.includes('\n') || expectedStr.includes('\n'))
          ? diff.diffLines(expectedStr, actualStr)
          : diff.diffChars(expectedStr, actualStr)
        this.renderDiff(d, '  ', level)
      }
    }
  }

  private formatValue(val: any) {
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

  private renderFailure(f: AIValidationFailure, level: LogLevel) {
    if (!f) return
    const pathPrefix = f.key ? color.yellow(`[${f.key}]`) : ''

    if (f.diff) {
      this.log(level, `    ${color.red('✖')} ${pathPrefix} ${f.message || 'Difference'}:`)
      this.renderDiff(f.diff, '      ', level)
    } else if (f.expected instanceof RegExp) {
      this.log(level, `    ${color.red('✖')} ${pathPrefix} Pattern mismatch:`)
      this.log(level, `      Expected: ${color.magenta(f.expected.toString())}`)
      this.log(level, `      Actual:   ${indent(this.formatValue(f.actual), '      ')}`)
    } else if (f.message) {
      this.log(level, `    ${color.red('✖')} ${pathPrefix} ${color.red(f.message)}`)
      if (f.actual !== undefined || f.expected !== undefined) {
        if (typeof f.actual === 'string' && typeof f.expected === 'string') {
          const d = (f.actual.includes('\n') || f.expected.includes('\n'))
            ? diff.diffLines(f.expected, f.actual)
            : (f.expected.length > 40 ? diff.diffWords(f.expected, f.actual) : diff.diffChars(f.expected, f.actual))
          this.renderDiff(d, '      ', level)
        } else {
          this.log(level, `      Actual:   ${indent(this.formatValue(f.actual), '      ')}`)
          this.log(level, `      Expected: ${indent(this.formatValue(f.expected), '      ')}`)
        }
      } else {
        this.log(level, `      Actual:   ${this.formatValue(f.actual)}`)
        this.log(level, `      Expected: ${this.formatValue(f.expected)}`)
        this.log(level, `      ${color.darkGray('Note: Both actual and expected are undefined.')}`)
      }
    }
  }

  private renderDiff(diffItems: any[], prefix = '  ', level: LogLevel = 'notice') {
    if (!Array.isArray(diffItems)) return
    const isMultiLine = diffItems.some(d => d && d.value && typeof d.value === 'string' && d.value.includes('\n'))
    const indent = prefix + '  '

    // Check if it is JSON Diff
    const isJsonDiff = diffItems.some(d => d.path !== undefined)

    if (isJsonDiff) {
      diffItems.forEach(d => {
        if (!d) return
        const sign = d.added ? color.green('+ ') : d.removed ? color.red('- ') : '  '
        const pathStr = d.path ? color.yellow(`${d.path}: `) : ''
        const val = d.val !== undefined ? d.val : d.value
        const valStr = this.formatValue(val)

        let result = `${sign}${pathStr}${valStr}`
        if (d.verified) {
          result = color.white('✓(' + this.stripConsoleColor(result) + ')')
        }
        this.log(level, `${prefix}${result}`)
      })
      return
    }

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
      this.log(level, `${prefix}${color.red('✖')} Diff: ${diffStr}`)
    } else {
      this.log(level, `${prefix}${color.red('✖')} Diff:`)
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
          this.log(level, `${indent}${result}`)
        })
      })
    }
  }

  private stripConsoleColor(str: string) {
    return str.replace(/\x1B\[\d+m/g, '')
  }
}
