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

**测试样例数据格式** 测试样例文件采用YAML格式。每个测试项包括输入（`input`）、预期输出(`output`)及可选的跳过(`skip`)和只执行(`only`)标志：

 ```yaml
 ---
 # Front-matter configurations:
 description: 'This is a AI test fixtures file'
 # (可选) 强制指定要运行的 PPE script 文件名，忽略约定的PPE文件名
 script: '[basename].ai.yaml'
 ---
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

* Fixture Demo: https://github.com/offline-ai/cli/tree/main/examples/split-text-paragraphs

### 模板数据变量示例

```yaml
 ---
 # Front-matter configurations:
 description: 'This is a AI test fixtures file'
 # 声明可以在测试中使用的模板数据变量：
 content: 'hi world'
 # the varaiable can be a template string too.
AnswerPattern: /The Answer is {{answer}}.$/
---
 # 测试样例项
- input: # 输入内容
    content: '{{content}}'
    ...
  output: "{{AnswerPattern}}"
  answer: 42
```

### Input/Output 模板示例

```yaml
---
description: 'This is a AI test fixtures file'
input:
  content: |-
   {{question}}
   At last output at the end of response: "The Answer is {{type}}."
output: /The Answer is {{answer}}.$/i
---
- question: Would a nickel fit inside a koala pouch?
  type: yes/no
  answer: yes
```

### 用 JSON Schema 验证

* 如果在PPE脚本中使用了`output`约定，测试会自动使用该`output`作为`JSON-Schema`对输出进行校验。
* 在测试中可以`outputSchema`使用`JSON-Schema`对输入进行校验
* 在测试中可以使用`checkSchema`来临时禁用`JSON-Schema`校验，默认为 `true`。
* 也可在命令行中禁用`JSON-Schema`校验： `ai test --no-checkSchema`
* `checkSchema` 的优先级为： `命令行参数 > fixture item > fixture front-matter > 默认值`

```yaml
---
description: 'This is a AI test fixtures file'
checkSchema: false # 可以禁用`JSON-Schema`校验，默认为 true
---
- input: # 输入内容
    content: '{{content}}'
    ...
  outputSchema:
    type: object
    properties:
      name:
        type: string
        pattern: "^First" # or use non-standard regexp: /^First/i
        minLength: 2
      age:
        type: number
        minimum: 18
  checkSchema: false # 也可在fixture item中临时禁用`JSON-Schema`校验
```

#### JSON Schema 的字符串 `Format` 扩展

- _date_: 根据 [RFC3339](http://tools.ietf.org/html/rfc3339#section-5.6) 的完整日期格式。
- _time_: 时间格式（时区是必需的）。
- _date-time_: 日期时间格式（时区是必需的）。
- _iso-time_: ISO 时间格式（时区可选）。
- _iso-date-time_: ISO 日期时间格式（时区可选）。
- _duration_: 根据 [RFC3339](https://tools.ietf.org/html/rfc3339#appendix-A) 的持续时间格式。
- _uri_: 完整的 URI 格式。
- _uri-reference_: URI 引用格式，包括完整的和相对的 URI。
- _uri-template_: 根据 [RFC6570](https://tools.ietf.org/html/rfc6570) 的 URI 模板格式。
- _url_（已弃用）: [URL 记录](https://url.spec.whatwg.org/#concept-url)。
- _email_: 电子邮件地址格式。
- _hostname_: 根据 [RFC1034](http://tools.ietf.org/html/rfc1034#section-3.5) 的主机名格式。
- _ipv4_: IPv4 地址格式。
- _ipv6_: IPv6 地址格式。
- _regex_: 通过传递给 `RegExp` 构造函数来验证的正则表达式格式。
- _uuid_: 根据 [RFC4122](http://tools.ietf.org/html/rfc4122) 的通用唯一标识符（UUID）格式。
- _json-pointer_: 根据 [RFC6901](https://tools.ietf.org/html/rfc6901) 的 JSON 指针格式。
- _relative-json-pointer_: 根据 [此草案](http://tools.ietf.org/html/draft-luff-relative-json-pointer-00) 的相对 JSON 指针格式。
- _byte_: 根据 [OpenAPI 3.0.0 规范](https://spec.openapis.org/oas/v3.0.0#data-types) 的 base64 编码数据格式。
- _int32_: 根据 [OpenAPI 3.0.0 规范](https://spec.openapis.org/oas/v3.0.0#data-types) 的 32 位有符号整数格式。
- _int64_: 根据 [OpenAPI 3.0.0 规范](https://spec.openapis.org/oas/v3.0.0#data-types) 的 64 位有符号整数格式。
- _float_: 根据 [OpenAPI 3.0.0 规范](https://spec.openapis.org/oas/v3.0.0#data-types) 的浮点数格式。
- _double_: 根据 [OpenAPI 3.0.0 规范](https://spec.openapis.org/oas/v3.0.0#data-types) 的双精度浮点数格式。
- _password_: 根据 [OpenAPI 3.0.0 规范](https://spec.openapis.org/oas/v3.0.0#data-types) 的密码字符串格式。
- _binary_: 根据 [OpenAPI 3.0.0 规范](https://spec.openapis.org/oas/v3.0.0#data-types) 的二进制字符串格式。

##### 用于比较值的关键字：`formatMaximum` / `formatMinimum` 和 `formatExclusiveMaximum` / `formatExclusiveMinimum`

这些关键字允许在定义了 `format` 关键字的情况下设置最小值/最大值约束。

这些关键字仅适用于字符串。

```yaml
---
outputSchema:
  type: "string",
  format: "date",
  formatMinimum: "2016-02-06",
  formatExclusiveMaximum: "2016-12-27",
---
# 有效数据：
- input:
    echo: "2016-02-06"
- input:
    echo: "2016-12-26"
# 无效数据：
- input:
    echo: "2016-02-05"
- input:
    echo: "2016-12-27"
- input:
    echo: "abc"

## 测试开关

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

3. **禁用`JSON-Schema`校验** 启用该开关(`--no-checkSchema`)，将禁用`JSON-Schema`校验。

   ```bash
   ai test "[basename].fixture.yaml" --no-checkSchema
   ```
