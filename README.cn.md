# AI Client Test Command

> 【[English](./README.md)|中文】
---

[Offline AI Client](https://npmjs.org/package/@offline-ai/cli) 的内置命令插件，用于单元测试[可编程提示引擎](https://github.com/offline-ai/ppe)(智能体)脚本

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/%40offline-ai%2Fcli-plugin-cmd-test.svg)](https://npmjs.org/package/@offline-ai/cli-plugin-cmd-test)
[![Downloads/week](https://img.shields.io/npm/dw/%40offline-ai%2Fcli-plugin-cmd-test.svg)](https://npmjs.org/package/@offline-ai/cli-plugin-cmd-test)

## 安装

**安装客户端** 如果尚未安装客户端，请通过以下命令进行全局安装：

```bash
npm install -g @offline-ai/cli
```

## 使用说明

### 文件命名规范

* 测试样例文件应与AI提示或代理脚本文件位于同一目录。
* 测试样例文件名格式为`[basename].fixture.yaml`。
* AI提示或代理脚本文件名格式为`[basename][.additional-name].ai.yaml`, `[.additional-name]`部分可选。

### 执行测试

运行测试样例文件的命令如下：

 ```bash
 ai test "[basename].fixture.yaml"
 ```

注意:

* 此命令将按顺序运行同一目录下匹配的所有PPE脚本文件。
* **测试样例数据格式** 测试样例文件采用YAML格式。每个测试项包括输入、预期输出及可选的跳过标志：

   ```yaml
   ---
   # Front-matter configurations:
   description: 'This is a AI test fixtures file'
   # (可选) 强制指定要运行的 PPE script 文件名，忽略约定的PPE文件名
   script: '[basename].ai.yaml'
   # 声明可以在测试中使用的模板数据变量：
   content: 'hi world'
   ---
   # 测试样例项
   - input: # 输入内容
       content: '...{{content}}'
       ...
     output: # 预期输出结果
       name: !re /^First/ # 可以是正则表达式字符串匹配
       ...
     skip: true  # 可选跳过标志
     only: true  # 可选只执行标志, skip 和 only 只能设置一个, only 优先
   ```

* Demo: https://github.com/offline-ai/cli/tree/main/examples/split-text-paragraphs

1. **脚本跳过测试** 若要让指定PPE脚本跳过测试，可以在脚本元数据部分(front-matter)设置:

   ```yaml
   ---
   description: '这是一个AI脚本描述'
   test:
     skip: true
     only: true # skip 和 only 只能设置一个, only 优先
   ---
   ```

2. **生成输出样例** 当测试用例不存在output项的时候，启用该开关(`-g` or `--generateOutput`)，将自动把脚本输出作为output写入到用例文件中。

   ```bash
   ai test "[basename].fixture.yaml" --generateOutput
   ```
