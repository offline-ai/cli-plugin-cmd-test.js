import { AIScriptExecutor, AIExecutionContext, AIExecutionResult } from '@isdk/ai-test-runner'
import { runScript } from '@offline-ai/cli-plugin-core'
import { normalizeMessages } from './normalize-messages.js'
import { getMeta } from '@isdk/ai-tool-agent'

export class CLIScriptExecutor implements AIScriptExecutor {
  constructor(private userConfig: any) {}

  async execute(context: AIExecutionContext): Promise<AIExecutionResult> {
    const { script, args, options } = context
    // Merge userConfig and individual test options
    const mergedConfig = { ...this.userConfig, ...options, data: args, chatsDir: '' }

    // Call the original runScript from cli-plugin-core
    const result = await runScript(script, mergedConfig)
    const meta = getMeta(result)

    const messages = normalizeMessages(result?.messages)

    return {
      output: result?.content !== undefined ? result.content : result,
      messages: messages.length > 0 ? messages : undefined,
      meta,
    }
  }
}
