import { AIScriptExecutor, AIExecutionContext, AIExecutionResult } from '@isdk/ai-test-runner'
import { runScript } from '@offline-ai/cli-plugin-core'

export class CLIScriptExecutor implements AIScriptExecutor {
  constructor(private userConfig: any) {}

  async execute(context: AIExecutionContext): Promise<AIExecutionResult> {
    const { script, args, options } = context
    // Merge userConfig and individual test options
    const mergedConfig = { ...this.userConfig, ...options, data: args }

    // Call the original runScript from cli-plugin-core
    const result = await runScript(script, mergedConfig)

    return {
      output: result?.content !== undefined ? result.content : result
    }
  }
}
