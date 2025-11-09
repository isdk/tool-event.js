# @isdk/tool-func

一个功能强大的 TypeScript 框架，用于创建、管理和执行模块化的工具函数。它非常适合用于构建 AI 代理工具、后端服务以及具有清晰、解耦架构的可扩展插件系统。

## ✨ 核心功能

- **📦 模块化与可复用工具:** 将函数定义为包含丰富元数据的 `ToolFunc` 实例。
- **🌐 全局注册表:** 静态注册表 (`ToolFunc.items`) 允许应用程序的任何部分按名称访问和运行已注册的函数。
- **🔗 依赖管理:** 使用 `depends` 属性声明对其他 `ToolFunc` 的依赖，这些依赖项将被自动注册。
- **🏷️ 别名与标签:** 为函数分配多个名称 (`alias`) 或 `tags`，以实现灵活性和分组。
- **🚀 生命周期钩子:** 使用 `setup` 方法执行一次性初始化逻辑。
- **🔄 异步能力:** 使用 `makeToolFuncCancelable` 内置支持可取消的任务、超时和并发控制。
- **🌊 流式响应:** 使用 `stream` 属性和 `createCallbacksTransformer` 轻松创建和处理流式响应。

## 📦 安装

```bash
npm install @isdk/tool-func
```

## 🚀 基本用法

### 1. 定义工具

创建一个 `ToolFunc` 实例来定义工具的元数据和实现。

```typescript
import { ToolFunc } from '@isdk/tool-func';

const getUser = new ToolFunc({
  name: 'getUser',
  description: '根据 ID 检索用户。',
  params: { id: { type: 'string', required: true } },
  func: (params) => ({ id: params.id, name: '张三' }),
});
```

### 2. 注册工具

注册工具，使其在全局注册表中可用。

```typescript
getUser.register();
```

### 3. 运行工具

使用静态 `run` 方法从应用程序的任何位置执行工具。

```typescript
async function main() {
  const user = await ToolFunc.run('getUser', { id: '123' });
  console.log(user); // 输出: { id: '123', name: '张三' }
}

main();
```

## 🌟 高级用法

### 依赖管理

声明对其他工具的依赖，它们将被自动注册。

```typescript
const welcomeUser = new ToolFunc({
  name: 'welcomeUser',
  description: '生成欢迎消息。',
  params: { userId: 'string' },
  depends: {
    // 当 `welcomeUser` 注册时，`getUser` 将被自动注册。
    userFetcher: getUser,
  },
  func: function(params) {
    // `this` 是 ToolFunc 实例，所以我们可以使用 `runSync`
    const user = this.runSync('userFetcher', { id: params.userId });
    return `你好, ${user.name}!`;
  },
});

welcomeUser.register();

const message = await ToolFunc.run('welcomeUser', { userId: '456' });
console.log(message); // "你好, 张三!"
```

### 生命周期钩子: `setup` 方法

`setup` 钩子提供了一种在创建 `ToolFunc` 实例时运行一次性初始化逻辑的方法。这对于在工具被注册或使用之前配置实例、设置初始状态或修改属性非常有用。`setup` 内部的 `this` 上下文指向 `ToolFunc` 实例本身。

```typescript
const statefulTool = new ToolFunc({
  name: 'statefulTool',
  customState: 'initial', // 定义一个自定义属性
  setup() {
    // `this` 是 statefulTool 实例
    console.log(`正在设置 ${this.name}...`);
    this.customState = 'configured';
    this.initializedAt = new Date();
  },
  func() {
    return `状态: ${this.customState}, 初始化于: ${this.initializedAt.toISOString()}`;
  }
});

console.log(statefulTool.customState); // "configured"

statefulTool.register();
console.log(await ToolFunc.run('statefulTool'));
// "状态: configured, 初始化于: ..."
```

### 异步与可取消任务

添加强大的异步功能，如取消和并发控制。

```typescript
import { ToolFunc, makeToolFuncCancelable, AsyncFeatures } from '@isdk/tool-func';

// 创建 ToolFunc 类的可取消版本
const CancellableToolFunc = makeToolFuncCancelable(ToolFunc, {
  maxTaskConcurrency: 5, // 最多允许 5 个并发任务
});

const longRunningTask = new CancellableToolFunc({
  name: 'longRunningTask',
  asyncFeatures: AsyncFeatures.Cancelable, // 标记为可取消
  func: async function(params, aborter) {
    console.log('任务已开始...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒任务
    aborter.throwIfAborted(); // 检查是否已取消
    console.log('任务已完成!');
    return { success: true };
  }
});

longRunningTask.register();

// 运行任务并获取其 aborter
const promise = ToolFunc.run('longRunningTask');
const task = promise.task;

// 2秒后中止任务
setTimeout(() => {
  task.abort('用户取消');
}, 2000);
```

### 流式响应

要创建一个可以流式输出其结果的工具，请遵循以下步骤：

1. **启用流式传输能力**: 在工具的定义中设置 `stream: true`。这会将该工具标记为*具备*流式传输能力。
2. **检查流式传输请求**: 在 `func` 内部，使用 `this.isStream(params)` 方法。该方法会检查当前调用是否被请求为流。默认情况下，它会检查传入参数中是否存在 `stream: true`。
3. **添加控制参数（可选）**: 如果您的工具需要*同时*支持流式和常规值返回，请在 `params` 定义中添加一个 `stream: { type: 'boolean' }` 参数。这允许用户选择返回类型（例如，通过传递 `{ stream: true }`）。如果您的工具*只*支持流式输出，则不需要此参数。

下面的示例演示了一个可以根据请求返回流或单个值的灵活工具。

```typescript
import { ToolFunc } from '@isdk/tool-func';

// 1. 定义工具的流式传输能力
const streamableTask = new ToolFunc({
  name: 'streamableTask',
  description: '一个可以返回值或流的任务。',
  stream: true, // 标记为支持流式传输
  params: {
    // 声明一个 'stream' 参数来控制输出类型
    stream: { type: 'boolean', description: '是否以流的方式输出。' }
  },
  func: function(params) {
    // 2. 检查是否请求了流式传输
    if (this.isStream(params)) {
      // 返回一个 ReadableStream 以进行流式输出
      return new ReadableStream({
        async start(controller) {
          for (let i = 0; i < 5; i++) {
            controller.enqueue(`数据块 ${i}\n`);
            await new Promise(r => setTimeout(r, 100));
          }
          controller.close();
        }
      });
    } else {
      // 如果不是流式传输，则返回一个常规值
      return '一次性完成';
    }
  }
});

// 3. 注册工具
streamableTask.register();

// 4. 以两种模式运行
async function main() {
  console.log('--- 以非流式模式运行 ---');
  const result = await ToolFunc.run('streamableTask', { stream: false });
  console.log('结果:', result); // 输出: 一次性完成

  console.log('\n--- 以流式模式运行 ---');
  const stream = await ToolFunc.run('streamableTask', { stream: true });

  // 5. 消费流
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('流已结束。');
      break;
    }
    process.stdout.write(value); // 输出: 数据块 0, 数据块 1, ...
  }
}

main();
```

### 使用 `createCallbacksTransformer` 处理流事件

虽然 `ToolFunc` 允许您*返回*流，但您通常还需要处理流*内部*的数据。`createCallbacksTransformer` 实用工具可以创建一个 `TransformStream`，让您能够轻松地挂接到流的生命周期事件中。这对于在数据流经时进行日志记录、数据处理或触发副作用非常有用。

它接受一个包含以下可选回调函数的对象：

- `onStart`: 在流初始化时调用一次。
- `onTransform`: 对于流经的每个数据块调用。
- `onFinal`: 在流成功关闭时调用一次。
- `onError`: 在流处理过程中发生错误时调用。

以下是如何使用它来观察流：

```typescript
import { createCallbacksTransformer } from '@isdk/tool-func';

async function main() {
  // 1. 使用回调创建一个转换器
  const transformer = createCallbacksTransformer({
    onStart: () => console.log('流已开始！'),
    onTransform: (chunk) => {
      console.log('收到数据块:', chunk);
      // 如果需要，您可以在此处修改数据块
      return chunk.toUpperCase();
    },
    onFinal: () => console.log('流已结束！'),
    onError: (err) => console.error('流错误:', err),
  });

  // 2. 创建一个源 ReadableStream
  const readableStream = new ReadableStream({
    start(controller) {
      controller.enqueue('a');
      controller.enqueue('b');
      controller.enqueue('c');
      controller.close();
    },
  });

  // 3. 将流通过转换器进行管道传输
  const transformedStream = readableStream.pipeThrough(transformer);

  // 4. 从转换后的流中读取结果
  const reader = transformedStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log('处理后的数据块:', value);
  }
}

main();
```

此示例将输出：

```sh
流已开始！
收到数据块: a
处理后的数据块: A
收到数据块: b
处理后的数据块: B
收到数据块: c
处理后的数据块: C
流已结束！
```

### 参数处理：对象参数与位置参数

`ToolFunc` 支持基于对象和位置的参数，以提供灵活性。虽然两者都可用，但**通常推荐使用对象参数**，因为它们更清晰且具有自文档性。

#### 对象参数（推荐）

当 `params` 定义为对象时，`func` 会接收一个包含所有命名参数的单一对象参数。这是默认且最直接的方法。

```typescript
const greetUser = new ToolFunc({
  name: 'greetUser',
  description: '根据姓名和年龄问候用户。',
  params: {
    name: { type: 'string', required: true },
    age: { type: 'number' },
  },
  func: (args) => {
    const { name, age } = args;
    return `你好, ${name}! ${age ? `你今年 ${age} 岁。` : ''}`;
  },
});

greetUser.register();
console.log(await ToolFunc.run('greetUser', { name: '爱丽丝', age: 30 }));
// 输出: "你好, 爱丽丝! 你今年 30 岁。"
```

#### 位置参数

如果 `params` 定义为 `FuncParam` 对象的数组，`func` 将按照定义的顺序接收参数。这对于参数数量固定且较少，并且顺序直观的函数很有用。

```typescript
const addNumbers = new ToolFunc({
  name: 'addNumbers',
  description: '将两个数字相加。',
  params: [
    { name: 'num1', type: 'number', required: true },
    { name: 'num2', type: 'number', required: true },
  ],
  func: (num1, num2) => num1 + num2,
});

addNumbers.register();
console.log(await ToolFunc.runWithPos('addNumbers', 5, 3)); // 使用 runWithPos 处理位置参数
// 输出: 8
```

**建议：** 对于大多数用例，将 `params` 定义为对象并在 `func` 中按名称访问参数更清晰且不易出错，尤其当函数的参数列表变长时。

## 🏛️ 核心架构：静态与实例

`ToolFunc` 的一个关键设计原则是静态类和实例之间的角色分离：

- **作为管理者的静态类:** `ToolFunc` 的静态部分（例如 `ToolFunc.register`, `ToolFunc.run`）充当全局的**注册表**和**执行器**。它管理所有工具的定义，允许您的应用程序的任何部分按名称发现和运行工具。

- **作为工具的实例:** 一个实例 (`new ToolFunc(...)`) 代表一个单一的、具体的**工具**。它持有实际的函数逻辑、其所有的元数据（名称、描述、参数）以及任何内部状态。

这种分离提供了两全其美的优势：既有用于定义单个工具的面向对象封装的能力，又有用于管理和执行它们的全局可访问服务的便利性。

## 🤝 贡献

如果您想为项目做出贡献，请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 文件以获取有关如何开始的指南。

## 📄 许可证

该项目根据 MIT 许可证授权。有关更多详细信息，请参阅 [LICENSE-MIT](./LICENSE-MIT) 文件。
