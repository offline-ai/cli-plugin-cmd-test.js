# @isdk/ai-test-runner

> 【[English](./README.md)|中文】
---

一个轻量级、解耦的 AI 脚本、智能体及提示词测试核心引擎。
虽然它源自 [ISDK AI](https://github.com/isdk) 生态，但它被设计为**通用的 AI 测试引擎**。你只需简单地实现 `AIScriptExecutor` 接口，即可将其应用于任何 AI 测试场景。

`ai-test-runner` 提供了一套强大的框架，用于执行 AI 测试样例（Fixtures）并利用多种策略验证输出结果。

## 核心特性

### 🧩 完全解耦的架构

核心逻辑独立于任何 CLI 框架或文件系统。通过实现简单的 `AIScriptExecutor` 接口，你可以将其集成到 Node.js 服务器、Web 环境或 CI/CD 流水线中。

### 🛠️ AI 工具测试 (New)

支持将 AI 函数脚本作为“工具”进行集成测试。引擎会自动重定向到驱动脚本（`toolTester`），并允许验证复杂的工具调用序列。

### 📐 全面的验证策略

- **字符串与正则**: 支持部分字符串匹配和复杂的正则表达式。
- **深度对象/数组**: 递归验证嵌套的数据结构，支持对象键的正则匹配。
- **高级操作符 (New)**: 提供 `$contains`, `$all`, `$sequence`, `$not` 等强大的集合验证能力。
- **语义化 Diff**: 通过结构化的 `diff` 规则允许输出中的微小差异（例如：忽略额外的空行或特定的字符替换）。
- **JSON Schema (Ajv)**: 内置支持 JSON Schema，并包含丰富的自定义关键字和格式扩展。
- **自定义函数**: 支持通过 JavaScript/TypeScript 函数实现任意复杂的匹配逻辑。
  - 当 `output` 为函数时，它接收 `(actualOutput, input)`。
  - 当 `expect` 为函数时，它接收 `(fullResult, input)`，其中 `fullResult` 包含 `output` 和 `messages`。
  - 函数返回 `true` 表示通过，返回字符串表示失败原因。

### 📝 高级模板系统

- **动态变量**: 在输入、输出甚至验证规则中注入变量。
- **递归解析**: 自动处理深层依赖链（例如：`a` 依赖 `b`，`b` 依赖 `c`）。
- **环境感知**: 支持 `__fixture_dir__` 和 `__script_dir__` 等目录变量。
- **动态正则键 (New)**: 支持在对象匹配中使用包含模板变量的正则键：`"/^{{id}}_/"`。

### 🌓 灵活的匹配模式

支持细粒度的 `严格 (Strict)` 和 `部分 (Partial)` 匹配。你可以配置是否允许对象中存在多余属性、数组长度是否必须一致、或 Diff 中存在未声明的变化。

---

## 技术规范 (Specification)

### 1. AIScriptExecutor 契约

执行器必须返回一个符合以下结构的 Promise：

```typescript
interface AIExecutionResult {
  output: any;      // 最终生成的输出（用于 output 匹配）
  messages?: any[]; // (可选) 执行过程的全量消息列表（用于 expect 匹配）
}
```

#### 标准消息格式 (Message)

- `role`: `'user' | 'assistant' | 'tool' | 'system'`
- `content`: `string` (可选)
- `tools`: `ToolCall[]` (可选)
  - `name`: 工具名称
  - `args`: 调用参数 (Object)
  - `result`: 工具执行结果 (可选)

### 2. 操作符行为

- **`$contains`**: 针对数组，只要有一个元素匹配模式即通过。
- **`$all`**: 针对数组，必须包含所有指定的匹配项（顺序无关）。
- **`$sequence`**: 针对数组，必须按顺序出现指定的匹配项（中间允许干扰）。
- **`$not`**: 反向断言，如果内容匹配模式则测试失败。
- **`$schema`**: 显式使用 JSON Schema 验证值（推荐）。

---

## 安装

```bash
pnpm add @isdk/ai-test-runner
```

## 详细使用指南

### 1. 数据格式 (Fixture)

一个测试用例通常由 `input`（输入）、预期 `output`（输出）或 `expect`（执行全量验证）组成。

```yaml
---
tools: [calculator.ai.yaml]
toolTester: agent.ai.yaml # 默认为 'toolTester'
---
- input: "1+1 等于几？"
  output: "2"
  expect:
    tools: # 语法糖：在消息链路中查找工具调用
      - name: calculator
        args: { a: 1, b: 1 }
  not: false   # 如果为真，则当输出不匹配时测试才通过
  skip: false
  strict: object # 为此用例启用对象的严格匹配模式
```

### 2. 语法糖：expect.tools

`expect.tools` 是专门为工具测试设计的简化断言。它会自动扫描 `messages` 链路中所有由 AI（`assistant` 角色）发起的工具调用，并将其聚合后与预期进行匹配。

**规范说明：**

- **自动聚合**: 引擎会遍历所有消息，提取所有 `tools` 列表。
- **匹配模式**:
  - 如果 `expect.tools` 是一个 **数组**，默认采用 **`$all`** 逻辑（所有项必须出现，顺序无关）。
  - 如果 `expect.tools` 包含 **`$sequence`**，则要求工具按指定的顺序被调用。
- **深度匹配**: 每个工具项的 `name`、`args` 和 `result` 均支持正则、部分对象匹配及模板变量。

```yaml
expect:
  tools: [ { name: 'weather', args: { city: 'Shanghai' } } ]
```

### 3. 模板变量与动态键

你可以在 `fixtureConfig` 中定义变量，并在测试中通过 `{{name}}` 使用。现在连 **对象键名** 也可以是动态正则或嵌套路径：

**动态正则键：**

```yaml
# fixtureConfig
variables:
  id: "123"
---
- input: { query: "user" }
  output:
    "/^user_{{id}}_/": "ok" # 动态匹配 user_123_... 格式的键
```

**嵌套路径键：**

你可以使用点号分隔的路径（如 `a.b.c`）直接验证深层属性：

```yaml
- input: "获取个人信息"
  output:
    "user.profile.name": "Alice"
    "user.profile.age": 30
```

### 4. Diff 验证字符串

使用 `diff` 可以对字符串进行补充验证。在 `ai-test-runner` 中，`diff` 列表被视为一个 **“允许的偏差白名单”**。

#### 白名单逻辑说明

1. **区分“允许”与“错误”**：如果没有这份清单，任何字符差异（哪怕是一个空格或换行）都会导致验证失败。通过在 `diff` 中列出 `\n`，你是在告诉引擎：“如果输出末尾多了个换行，那是可以接受的；但如果多了一个感叹号 `!`，那就是错误的。”
2. **子集匹配 (Subset Matching) - 默认模式**：
    * 实际发生的变更必须是白名单的 **子集**。
    * 你可以不发生白名单里的变更（除非该项设为 `required: true`），但绝对不能发生白名单之外的变更。
3. **严格模式 (`strict: diff`)**：实际发生的变更必须与白名单 **完全一致**（全集匹配）。
4. **宽容模式 (`diffPermissive: true`)**：忽略所有未声明的变更，仅验证是否存在标记为 `required` 的必须变更项。

#### 示例

```yaml
- input: "测试内容"
  output: "测试内容"
  # 默认行为：白名单模式
  diff:
    - value: "。"
      added: true   # 允许：结尾多一个点是可以接受的
    - value: "\n"
      added: true   # 允许：额外的空行是可以接受的
    - value: "必须包含"
      added: true
      required: true # 强制：实际输出中必须存在此变更
```

**高级 Diff 配置：**

```yaml
diff:
  permissive: true # 开启宽容模式（忽略未在 items 中声明的变更）
  items:
    - { value: "\n", added: true }
```

可以匹配: `测试内容\n` 或 `测试内容必须包含\n`

### 5. 用 JSON Schema 验证

`ai-test-runner` 提供了强大的 JSON Schema 支持来验证复杂的数据结构。

#### 显式验证 (推荐)

使用 `$schema` 操作符显式指示一个数据块应作为 JSON Schema 进行验证：

```yaml
- input: { get_user: 1 }
  output:
    profile:
      $schema:
        type: object
        properties:
          name: { type: string, pattern: "^[A-Z]" }
          age: { type: number, minimum: 18 }
```

#### 启发式识别 (旧版)

引擎也会自动将包含标准 `type` 属性（如 string, number 等）的对象识别为 JSON Schema。但为了避免歧义，建议优先使用 `$schema`。

**禁用启发式识别：**

如果你的数据中本身就包含名为 `type` 且不是 Schema 的属性，你可以全局或在单个用例中禁用此行为：

```yaml
# 在配置或单个用例中
disableHeuristicSchema: true
```

禁用后，只有 `$schema` 操作符或 `!json-schema` 标签会触发 JSON Schema 验证。

```yaml
- input: { get_user: 1 }
  output:
    name: { type: string, pattern: "^[A-Z]" }
```

#### 扩展关键字说明

- **字符串**: `regexp` (正则), `transform` (trim, toLowerCase 等)。
- **数值**: `range` (范围), `exclusiveRange`。
- **对象**: `allRequired` (全部必填), `anyRequired` (任意必填), `deepProperties` (深层属性)。
- **动态默认值**: `timestamp`, `datetime`, `randomint` 等。

---

## 集成 API 示例

### 实现执行器

```typescript
import { AITestRunner, AIScriptExecutor } from '@isdk/ai-test-runner';

// 1. 实现执行器，对接你的 AI 引擎
const executor: AIScriptExecutor = {
  async execute({ script, args }) {
    // 你的 AI 执行逻辑
    return {
      output: "执行结果",
      messages: [ /* 交互历史 */ ]
    };
  }
};

// 2. 初始化 Runner
const runner = new AITestRunner(executor);

// 3. 监听事件进行实时日志输出
runner.on('test:pass', (log) => console.log(`用例 ${log.i} 通过`));
runner.on('test:fail', (log) => console.error(`用例 ${log.i} 失败`, log.failures));

// 4. 运行测试
const result = await runner.run('script-id', fixtures, {
  fixtureConfig: { /* 全局配置 */ },
  strict: false
});
```

## 开源协议

MIT
