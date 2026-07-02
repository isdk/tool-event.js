# @isdk/tool-rpc v2.6 使用手册（AI 开发者版）

## 一、概述

`@isdk/tool-rpc` 是一个 TypeScript 库，用于将本地函数（`ToolFunc`）暴露为远程 RPC 服务。v2.6 重构后，采用 **Trinity 架构**：`RpcTransportManager`（路由管理）、`RpcServerDispatcher`（执行调度）、`RpcActiveTaskTracker`（任务追踪），支持多实例隔离、流式响应、后台任务轮询、物理连接联动等工业级特性。

内置两种传输层：**HTTP**（基于 Node.js http 模块）和 **Mailbox**（基于 `@mboxlabs/mailbox`，适用于跨进程/线程通信）。

## 二、核心概念

### 2.1 三层抽象

| 层次 | 说明 | 典型用途 |
|------|------|----------|
| **ServerTools / ClientTools** | 单个远程函数（如 `ping`） | 简单 RPC |
| **ResServerTools / ResClientTools** | 一组方法组成的 RESTful 资源（CRUD 自动映射） | 资源型服务 |
| **自定义方法** | 在子类中以 `$` 开头的方法（如 `$status`） | 扩展操作，客户端自动去掉 `$` 调用 |

### 2.2 Trinity 组件

| 组件 | 角色 | 关键方法/属性 |
|------|------|---------------|
| `RpcTransportManager` | 协议注册中心、路由审计、连接池管理 | `bindScheme()`, `addServer()`, `startAll()`, `stopAll()`, `validateRpcRequest()` |
| `RpcServerDispatcher` | 执行调度、能力协商、影子实例隔离、超时裁决 | `dispatch()`, `handleError()`, 自动注入 `this.ctx.tracker` |
| `RpcActiveTaskTracker` | 任务注册、状态转换、硬死线、结果保留、物理中止联动 | `register()`, `get()`, 内部维护 `tasks` Map |

### 2.3 内置系统工具

- **`rpcTask`**（`RpcTaskResource`）：由 `RpcServerDispatcher` 自动注册到 `systemRegistry`，提供标准任务轮询和取消端点。
  - `GET /api/rpcTask/{resId}` — 查询任务状态（返回 102/200/404/408）
  - `POST /api/rpcTask/{resId}?act=cancel` — 取消任务

**注意**：不要手动注册 `RpcTaskResource`，否则导致重复注册错误。

### 2.4 标准化数据模型

#### ToolRpcRequest

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `apiUrl` | string | 是 | 完整逻辑 URL（如 `http://localhost:3000/api/`） |
| `toolId` | string | 是 | 工具注册名 |
| `act` | string | 否 | 子方法（如 `status`, `cancel`） |
| `resId` | string | 否 | 资源 ID |
| `requestId` | string | 是 | 唯一调用 ID（用于幂等、追踪） |
| `params` | any | 是 | 业务参数 |
| `headers` | object | 否 | 标准 Header（如 `rpc-timeout`, `rpc-act`） |
| `signal` | AbortSignal | 否 | 取消信号 |

#### ToolRpcResponse

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | number | 状态码（200/102/400/404/408/413/504） |
| `data` | any \| ReadableStream | 业务结果或流 |
| `error` | object | 结构化错误（`code`, `message`, `data`） |
| `headers` | object | 元数据（如 `rpc-retry-after`） |

**常用状态码**：
- 200：成功
- 102：任务进入后台（`keepAliveOnTimeout` 触发）
- 400：能力冲突（请求流但工具不支持）
- 404：工具或任务不存在
- 408：硬死线终止
- 409：requestId 冲突
- 413：请求体超限

### 2.5 任务结果保留策略（`RpcTaskRetention`）

| 值 | 含义 |
|----|------|
| `None` (0) | 完成后立即移除（默认） |
| `Permanent` (-1) | 永久保留 |
| `Once` ('once') | 第一次成功 `get` 后自动清除 |
| `number` (ms) | 保留指定毫秒数 |
| 对象 | `{ onceFallbackMs?, maxRetentionMs? }` |

## 三、快速入门（3 分钟）

### 3.1 安装

```bash
npm install @isdk/tool-rpc @isdk/tool-func
# 如果使用 Mailbox 传输层，还需安装：
npm install @mboxlabs/mailbox
```

### 3.2 服务端：注册工具并启动（HTTP 示例）

```typescript
// server.ts
import {
  ServerTools,
  RpcServerDispatcher,
  RpcActiveTaskTracker,
  HttpServerToolTransport,
  RpcTransportManager,
} from '@isdk/tool-rpc';

// 定义简单工具
new ServerTools({
  name: 'greet',
  isApi: true,
  func: ({ name }: { name: string }) => `Hello, ${name}!`,
}).register();

// 创建 Dispatcher（自动注册 rpcTask 到 systemRegistry）
const tracker = new RpcActiveTaskTracker();
const dispatcher = new RpcServerDispatcher({ registry: ServerTools.items, tracker });

// 创建 HTTP 传输
const apiUrl = 'http://localhost:3000/api/';
const transport = new HttpServerToolTransport({ apiUrl, dispatcher });
transport.addDiscoveryHandler(apiUrl, () => ServerTools.toJSON());
transport.addRpcHandler(apiUrl);

// 注册到 Manager（自动检测路由冲突）
RpcTransportManager.instance.addServer(transport);
await RpcTransportManager.instance.startAll();
console.log(`Server ready at ${apiUrl}`);
```

### 3.3 客户端：发现并调用（HTTP 示例）

```typescript
// client.ts
import { HttpClientToolTransport, RpcTransportManager, ClientTools } from '@isdk/tool-rpc';

RpcTransportManager.bindScheme('http', HttpClientToolTransport);
await ClientTools.loadFrom(undefined, { apiUrl: 'http://localhost:3000/api/' });

const greet = ClientTools.get('greet');
const result = await greet.run({ name: 'World' });
console.log(result); // "Hello, World!"
```

## 四、进阶用法

### 4.1 流式响应（Streaming）

#### 同时支持流和非流输出（使用 `this.isStream` 判断）

工具可以声明 `params.stream` 参数，让客户端选择输出模式。使用内置的 `this.isStream(params)` 方法来判断是否应该返回流。

```typescript
// 服务端
new ServerTools({
  name: 'flexible-output',
  isApi: true,
  stream: true,                           // 声明支持流式能力
  params: { stream: { type: 'boolean' } }, // 必须在 params 中声明 stream 参数
  func: function (params: any) {
    // 使用内置 isStream 方法判断（注意：必须用 function 声明，不能用箭头函数）
    if (this.isStream(params)) {
      // 流式输出
      return new ReadableStream({
        async start(controller) {
          for (let i = 0; i < 5; i++) {
            controller.enqueue(`块 ${i}\n`);
            await new Promise(r => setTimeout(r, 100));
          }
          controller.close();
        }
      });
    }
    // 非流式输出（一次性返回）
    return '一次性结果';
  },
}).register();

// 客户端：请求流式
const streamResult = await ClientTools.get('flexible-output').run({ stream: true });
for await (const chunk of streamResult) {
  console.log(chunk); // 逐块打印
}

// 客户端：请求非流式
const plainResult = await ClientTools.get('flexible-output').run({ stream: false });
console.log(plainResult); // "一次性结果"
```

**`isStream` 方法逻辑**：
1. 首先检查工具是否具有流式能力（`this.stream` 是否为 `true`）。
2. 如果是，再检查 `params` 定义中是否声明了 `stream` 参数。
3. 如果两者都满足，则返回运行时 `params.stream` 的值；否则返回工具的静态 `stream` 属性。

**关键点**：
- 必须使用 `function` 关键字（而非箭头函数），以保证 `this` 指向工具实例。
- 必须在 `params` 中显式声明 `stream` 参数，否则 `isStream` 会退化为静态 `stream` 属性。
- 客户端无需特殊处理，根据返回值类型自动识别：`ReadableStream` 则迭代，否则直接使用。

#### 流式生命周期行为（基于测试验证）

- Dispatcher 将原始流通过 `TransformStream` 包装，绑定到 Tracker 的 Handle。
- 物理连接关闭（`rawRes.close`）→ 自动调用 `handle.abort('Physical connection closed')` → 流被取消。
- 通过 `handle.abort(reason)` 取消 → 流被取消，原因透传给 `cancel` 回调。
- 流正常结束（`flush`）→ Handle 根据 `retention` 策略自动清理。

### 4.2 后台任务 + 轮询（使用内置 `rpcTask`）

**服务端**：只返回 `requestId`，任务结果通过 `handle.resolve/reject` 通知 Tracker。

```typescript
new ServerTools({
  name: 'long-task',
  isApi: true,
  func: async function (this: any, params: { data: number[] }) {
    const requestId = this.ctx.requestId; // Dispatcher 自动生成
    const handle = this.ctx.tracker.register(requestId, {
      retention: 'once',        // 第一次查询后自动清除
      maxRuntimeMs: 120_000,    // 硬死线 2 分钟
    });
    // 异步执行（不 await）
    this.executeAsync(requestId, params.data, handle).catch(() => {});
    return { requestId };       // 客户端据此轮询
  },
  async executeAsync(requestId: string, data: number[], handle: any) {
    try {
      let total = 0;
      for (let i = 0; i < data.length; i++) {
        await new Promise(r => setTimeout(r, 1000));
        if (handle.signal.aborted) throw new Error('Task aborted');
        total += data[i] * 2;
      }
      handle.resolve(total);
    } catch (err: any) {
      handle.reject(err);
    }
  },
}).register();
```

**客户端**：通过系统内置的 `rpcTask` 工具轮询。

```typescript
const rpcTask = ClientTools.get('rpcTask') as any;
const longTask = ClientTools.get('long-task') as any;
const init = await longTask.run({ data: [1, 2, 3] });
const taskId = init.requestId;

let finished = false;
while (!finished) {
  await new Promise(r => setTimeout(r, 2000));
  try {
    const result = await rpcTask.get({ resId: taskId });
    console.log('Result:', result);
    finished = true;
  } catch (err: any) {
    if (err.status === 102) {
      // 继续轮询
    } else if (err.status === 404) {
      console.log('Task expired');
      finished = true;
    } else if (err.status === 408) {
      console.log('Task terminated');
      finished = true;
    } else {
      throw err;
    }
  }
}
```

**取消任务**：
```typescript
await rpcTask.cancel({ resId: taskId });
```

### 4.3 使用 Mailbox 传输层

Mailbox 传输层适用于跨进程/线程通信，无需 HTTP 服务器。需要安装 `@mboxlabs/mailbox` 包。

**服务端**：
```typescript
import { Mailbox, MemoryProvider } from '@mboxlabs/mailbox';
import { MailboxServerTransport, RpcServerDispatcher, RpcActiveTaskTracker, ServerTools } from '@isdk/tool-rpc';

const mailbox = new Mailbox();
mailbox.registerProvider(new MemoryProvider());

const serverAddr = 'mem://bot@mailbox/api/v1';
const tracker = new RpcActiveTaskTracker();
const dispatcher = new RpcServerDispatcher({ registry: ServerTools.items, tracker });
const transport = new MailboxServerTransport({ mailbox, apiUrl: serverAddr, dispatcher });

// 注册工具（同前）
new ServerTools({ name: 'greet', isApi: true, func: ({ name }: { name: string }) => `Hello, ${name}!` }).register();

// 注册路由
transport.addRpcHandler(serverAddr);
transport.addDiscoveryHandler(serverAddr, () => ServerTools.toJSON());

// 启动
RpcTransportManager.instance.addServer(transport);
await RpcTransportManager.instance.startAll();
```

**客户端**：
```typescript
import { Mailbox, MemoryProvider } from '@mboxlabs/mailbox';
import { MailboxClientTransport, RpcTransportManager, ClientTools } from '@isdk/tool-rpc';

const mailbox = new Mailbox();
mailbox.registerProvider(new MemoryProvider());

const transport = new MailboxClientTransport({
  mailbox,
  apiUrl: 'mem://bot@mailbox/api/v1',
  clientAddress: 'mem://client/inbox', // 客户端收件箱地址
});

RpcTransportManager.bindScheme('mem', () => transport); // 或直接使用实例
await ClientTools.loadFrom(undefined, { apiUrl: 'mem://bot@mailbox/api/v1' });

const greet = ClientTools.get('greet');
const result = await greet.run({ name: 'World' });
console.log(result); // "Hello, World!"
```

**注意**：
- Mailbox 传输层**不支持流式响应**（`canStream` 为 `false`），如果工具返回流会收到 400 错误。
- `clientAddress` 必须指定，用于服务端回调或状态通知。
- 需要确保服务端和客户端使用同一个 `Mailbox` 实例或相同 Provider（如内存、Redis 等）。

### 4.4 自定义传输层

实现 `IServerToolTransport` 或 `IClientToolTransport` 接口。例如集成 Fastify：

```typescript
class FastifyServerTransport implements IServerToolTransport {
  // 必须实现：getListenAddr(), getRoutes(), start(), stop()
  // 以及 addRpcHandler(), addDiscoveryHandler() 等
}
```

### 4.5 多实例与测试隔离

```typescript
// 创建独立 Manager 实例（非全局单例）
const manager = new RpcTransportManager();
const dispatcher = new RpcServerDispatcher({ tracker: new RpcActiveTaskTracker() });
const transport = new HttpServerToolTransport({ apiUrl: 'http://localhost:3001/', dispatcher });
manager.addServer(transport);
await manager.startAll();
```

## 五、关键注意事项

### 5.1 路径规范化
所有逻辑路由必须以 `/` 结尾（Trailing Slash Normalization），否则路由匹配可能失败。

### 5.2 影子实例隔离
Dispatcher 在执行时为每个请求创建 `Object.create(tool)` 的影子实例，`this.ctx` 仅属于本次调用。**严禁在工具函数中修改原始对象的属性**。

### 5.3 物理连接关闭自动清理
传输层（如 `HttpServerToolTransport`）监听 `rawRes.close` 事件，自动调用 `handle.abort('Physical connection closed')`。这适用于流式响应和后台任务，无需手动处理。

### 5.4 requestId 唯一性
`requestId` 由 Dispatcher 自动生成（可通过 `this.ctx.requestId` 获取）。重复提交会收到 409 错误。

### 5.5 能力协商
- 工具声明 `stream: true` 才支持流式输出。
- 客户端请求流但工具不支持 → 返回 400。
- 传输层不支持流（如 Mailbox）但工具返回流 → 返回 400。

### 5.6 不要手动注册 `RpcTaskResource`
它由 `RpcServerDispatcher` 在初始化时自动注册到 `systemRegistry`。手动注册会导致重复注册错误。

### 5.7 超时与死线
- **软死线**：触发 102 Processing，任务转入后台（需设置 `keepAliveOnTimeout: true`）。
- **硬死线**：触发 408 Terminated，强制中止任务。
- 通过 `timeout` 配置对象设置：`{ value: 8000, keepAliveOnTimeout: true }`。

### 5.8 结果保留策略
- `retention: 'once'` 时，第一次成功 `get` 后任务被逻辑删除（`fetchCount++` 触发清理）。
- 如需多次查询，使用 `Permanent` 或指定保留时长。

### 5.9 错误处理
推荐抛出 `RpcError`（`new RpcError(message, code, status?, data?)`），Dispatcher 会自动映射为标准化错误响应。

### 5.10 `isStream` 的正确使用
- 必须使用 `function` 声明（非箭头函数），以保证 `this` 指向工具实例。
- 必须在 `params` 定义中显式声明 `stream` 参数，否则 `isStream` 会退化为静态 `stream` 属性。
- 如果工具始终返回流，可以省略 `params.stream` 声明，此时 `isStream` 返回 `this.stream`（即 `true`）。

## 六、完整示例代码

完整可运行的服务端 + 客户端示例见本文档的“快速入门”和“进阶用法”章节。所有代码可直接复制使用。

## 七、迁移指南（从旧版 v1.x 到 v2.6）

| 旧版 | 新版 |
|------|------|
| `apiRoot` | `apiUrl`（完整 URL） |
| `mount(tools)` | `addServer()` + `addRpcHandler()` |
| 全局单例依赖 | 支持 `new RpcTransportManager()` 独立实例 |
| 无任务追踪 | 内置 `RpcActiveTaskTracker` + `RpcTaskResource` |
| 手动管理流生命周期 | 自动包装 TransformStream，物理连接联动 |
| 自定义轮询端点 | 使用系统内置 `rpcTask` |

**自动桥接**：旧版 `apiRoot` 会被包装为 `http://localhost/apiRoot`，旧版 `setTransport` 会注册到全局单例。

## 八、附录：接口速查

### 服务端关键接口

```typescript
interface IServerToolTransport {
  getListenAddr(): string;          // 物理地址（如 ':3000'）
  getRoutes(): string[];            // 逻辑路由列表（以 '/' 结尾）
  start(): Promise<void>;
  stop(): Promise<void>;
  addRpcHandler(apiUrl: string): void;
  addDiscoveryHandler(apiUrl: string, handler: Function): void;
}
```

### 客户端关键接口

```typescript
interface IClientToolTransport {
  call(request: ToolRpcRequest): Promise<ToolRpcResponse>;
  // 可选：自动处理 102 轮询
}
```

### 任务 Handle 关键方法

```typescript
interface RpcActiveTaskHandle {
  state: 'pending' | 'processing' | 'completed' | 'error' | 'aborted';
  result: any;
  error?: Error;
  signal: AbortSignal;
  resolve(value: any): void;
  reject(error: Error): void;
  abort(reason?: string): void;
  setOutputStream(stream: ReadableStream): void;
}
```
