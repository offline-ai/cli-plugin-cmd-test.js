# AI Client Test Command

> 【[English](./README.md)|中文】
---

[Offline AI Client](https://npmjs.org/package/@offline-ai/cli) 的内置命令插件，用于单元测试[可编程提示引擎](https://github.com/offline-ai/ppe)(智能体)脚本

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/%40offline-ai%2Fcli-plugin-cmd-test.svg)](https://npmjs.org/package/@offline-ai/cli-plugin-cmd-test)
[![Downloads/week](https://img.shields.io/npm/dw/%40offline-ai%2Fcli-plugin-cmd-test.svg)](https://npmjs.org/package/@offline-ai/cli-plugin-cmd-test)

## 安装与测试说明

1. **安装客户端** 如果尚未安装客户端，请通过以下命令进行全局安装：

   ```bash
   npm install -g @offline-ai/cli
   ```

2. **文件命名规范**
   * 测试样例文件应与AI提示或代理脚本文件位于同一目录。
   * 测试样例文件名格式为`[basename].fixture.yaml`。
   * AI提示或代理脚本文件名格式为`[basename].[other-name].ai.yaml`。
3. **执行测试** 运行测试样例文件的命令如下：

   ```bash
   ai test "[basename].fixture.yaml"
   ```

   * 此命令将按顺序运行同一目录下匹配的所有提示或代理脚本文件。
4. **测试样例数据格式** 测试样例文件采用YAML格式。每个测试项包括输入、预期输出及可选的跳过标志：

   ```yaml
   # 测试样例项
   - input: # 输入内容
       content: '...'
       ...
     output: # 预期输出结果
       name: !re /^First/ # 可以是正则表达式字符串匹配
       ...
     skip: true  # 可选跳过标志
     only: true  # 可选只执行标志, skip 和 only 只能设置一个, only 优先
   ```

5. **脚本跳过测试** 若要让指定脚本跳过测试，可以在脚本元数据部分(front-matter)设置:

   ```yaml
   ---
   description: '这是一个AI脚本描述'
   test:
     skip: true
     only: true # skip 和 only 只能设置一个, only 优先
   ---
   ```

6. **生成输出样例** 当测试用例不存在output项的时候，启用该开关(`-g` or `--generateOutput`)，将自动把脚本输出作为output写入到用例文件中。

   ```bash
   ai test "[basename].fixture.yaml" --generateOutput
   ```
