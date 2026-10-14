# @isdk/tool-event

> 【[English](./README.md)|中文】

`@isdk/tool-event` 为 `@isdk/tool-rpc` 生态系统带来了强大的实时、双向事件通信能力。

它的核心设计理念是**将发布/订阅模型无缝地集成到您已经熟悉的 RPC/RESTful 架构中**。您无需再手动管理独立的 WebSocket 或 SSE 连接，而是将实时事件视为另一种"工具"，它可以通过标准的 `tool-rpc` 框架被发现和调用。这种方法极大地简化了构建交互式 AI 代理、实时数据仪表盘、通知系统以及任何需要实时更新的应用的复杂性。

简而言之，`@isdk/tool-event` 让您用统一、简单的方式处理所有的事件，无论是远程服务上的事件，还是本地事件。

本项目基于 [`@isdk/tool-func`](https://github.com/isdk/tool-func.js) 和 [`@isdk/tool-rpc`](https://github.com/isdk/tool-rpc.js) 构建。在继续之前，请确保您已熟悉它们的核心概念——各包的使用手册由其自身仓库维护，这里是唯一权威副本（本项目刻意不保留本地副本，以免副本在本地悄悄过时）：

- [`@isdk/tool-func` — AGENT.md](https://github.com/isdk/tool-func.js/blob/main/AGENT.md)（[速览版](https://github.com/isdk/tool-func.js/blob/main/AGENT.Quick.md)）
- [`@isdk/tool-rpc` — AGENT.md](https://github.com/isdk/tool-rpc.js/blob/main/AGENT.md)

## 🧪 测试

项目包含单元测试和基于浏览器的 E2E 测试。

```bash
# 单元测试 (vitest)
pnpm test

# 浏览器 E2E 测试 (Playwright, Chromium)
# 该套件同时覆盖数据面与 RPC 控制面：测试服务器在第二个端口上运行真实的
# EventServer（/api/rpc/，由 Vite 代理），浏览器因此可以真实地跑通发现、
# $sub/$unsub/$publish、定向推送，以及带 Last-Event-ID 重放的重连。
# 第三个挂载点（/api/closebox/）用 `closeSignal: 'server'` 跑同一个传输，
# 于是「服务端宣告关闭」这条路径也在浏览器里得到验证。
pnpm test:e2e

# 浏览器示例应用 (examples/browser-e2e)
pnpm test:examples

# 单元测试重复 3 轮（vitest --repeats）—— 抖动检查（CI 会跑这一项）
pnpm test:repeat

# 运行全部测试
pnpm test:all
```

测试不再使用固定 sleep，而是「轮询条件 + 超时」(`test/utils/wait.ts`)：高负载机器上拥有完整的超时预算，空闲机器上不会为空等待埋单。仅「断言不应有投递」这类场景保留固定观察窗口。

E2E 测试覆盖范围：
- 基本的 SSE 事件通信（发布、订阅、取消订阅）
- 双向回显和并发事件
- 多数据类型支持（对象、数组、字符串）
- 流生命周期（关闭、清理）
- 重连与 `Last-Event-ID` 重放（断连期间丢失事件的恢复）
- 服务端宣告的会话关闭（`closeSignal`）：`$close` 帧结束流，浏览器不再重连
- 通过 SSE 的正则订阅（字符串形式正则与 `RegExp` 对象）
- 回归覆盖：非 JSON 负载、抛异常的 listener、带 `g` 标志的正则、多次 `subscribe` 调用之间的去重
- `@isdk/tool-event/transports/pubsub/browser` 子路径在浏览器中的导入
- `EventServer` 通过 HTTP 桥接传输实现双向通信

`pnpm test:examples` 会用同一套 Playwright harness 运行 `examples/browser-e2e` 下的应用，让文档里的用法持续接受验证，而不是停留在不成文的示例。可通过 `test/e2e/run-e2e.mjs` 的 `--app`、`--config`、`--server`、`--vite-port`、`--sse-port` 参数指向其他应用。

这些测试在每次推送/PR 到 `main` 分支且涉及 `packages/tool-event` 目录变更时自动在 CI 中运行。

## ✨ 核心功能

- **🚀 实时通信:** 提供了一个健壮的 Pub/Sub 模型，用于服务器和客户端之间的实时、双向事件流。
- **🔌 可插拔传输层:** 抽象的传输层允许使用不同的通信协议。内置了对 **服务器发送事件 (SSE)** 的实现。
- **🔗 无缝集成:** 扩展了 `@isdk/tool-rpc` 的 `ResServerTools` 和 `ResClientTools`，使事件端点的行为与其他 RESTful/RPC 工具一样。
- **🔄 自动转发:** 可轻松地将服务器端事件总线上的事件转发给客户端，或将本地客户端事件转发到服务器。
- **🎯 定向发布:** 从服务器向所有订阅的客户端发布事件，或通过客户端 ID 定向发布给特定客户端。
- **🔍 模式订阅:** 服务器端与客户端均支持正则订阅 —— `'/^user-.*/'` 或 `/^user-.*/`；精确事件名与覆盖它的正则同时订阅时，事件只投递一次。
- **🔐 默认安全:** 服务器为每个连接的客户端生成唯一 UUID。客户端发布的事件是沙箱化的，不会自动注入到服务器的主事件总线中，除非显式启用 (`autoInjectToLocalBus`)，以防止意外的副作用。

## 🚀 快速上手

### 1. 安装

```bash
npm install @isdk/tool-event
```

客户端的 SSE 传输使用 [`eventsource`](https://github.com/EventSource/eventsource)，声明为本包的 **peer dependency**（对等依赖）。该实现与运行环境无关 —— 浏览器和 Node.js 中运行的是同一份代码，而 Node.js 本身并没有内置 `EventSource` —— 因此本包直接导入该类，而不是读取全局对象。包管理器会自动安装 peer dependency；如果你的安装流程会跳过 peer dependency，请额外执行 `npm install eventsource`。传输层接口（含正则订阅）见 [pubsub.cn.md](./pubsub.cn.md)。

### 2. 服务端设置 (`server.ts`)

库中已经导出了一个预先实例化的 `EventServer` 类实例，名为 `eventServer`。该实例的工具名称由导出的常量 `EventName` 定义（其值为 `'event'`）。

```typescript
import { EventServer, eventServer, SseServerPubSubTransport, sseCredentialReader } from '@isdk/tool-event';
import { HttpServerToolTransport, RpcSessionIdentityPolicy } from '@isdk/tool-rpc';

// 两面共用一个身份策略：流请求本身就是一次普通 RPC 调用，所以传输层上的策略既决定
// 「这条流是谁」，也决定后续 `$sub`/`$publish` 「来自谁」；`sseCredentialReader` 负
// 责读取流通过 URL 交回的重连凭证（EventSource 无法设置 header）。
const identity = new RpcSessionIdentityPolicy();

// 1. 设置服务端 SSE 传输层 (SSE 是内置的传输协议)
EventServer.setPubSubTransport(new SseServerPubSubTransport({ revoke: (id) => identity.revoke(id) }));

// 2. 注册预设的 EventServer 实例 (其实例名称 eventServer.name 默认为 'event')
eventServer.register();

// 3. 启动 HTTP 服务器。服务发现是内置工具（`rpcApis`），挂在 RPC 前缀上，无需再注册发现处理器
const server = new HttpServerToolTransport({ identity, credentialReader: sseCredentialReader });
server.addRpcHandler('/api');
await server.start({ port: 3000 });

console.log('事件服务端已启动：http://localhost:3000/api');

// 示例：使用静态方法向所有已订阅的客户端广播事件
setInterval(() => {
  EventServer.publish('server-time', { time: new Date().toISOString() });
}, 5000);
```

### 3. 客户端设置 (`client.ts`)

同样，客户端可以直接使用库中导出的 `EventClient` 类实例 `eventClient`。

```typescript
import { EventClient, eventClient, SseClientPubSubTransport, backendEventable } from '@isdk/tool-event';
import { ClientTools } from '@isdk/tool-rpc';

async function main() {
  const apiRoot = 'http://localhost:3000/api';

  // 1. 配置客户端 API URL 并加载远程工具定义
  ClientTools.apiUrl = apiRoot;
  await ClientTools.loadFrom();

  // 2. 设置客户端 SSE 传输层 (必须在设置 apiUrl 之后)
  EventClient.setPubSubTransport(new SseClientPubSubTransport());

  // 3. 让 EventClient 具备事件能力 (注入 .on(), .off(), .emit() 方法)
  backendEventable(EventClient);

  // 4. 注册 eventClient 实例
  eventClient.register();

  // 5. 订阅并监听 'server-time' 事件
  await eventClient.subscribe('server-time');

  eventClient.on('server-time', (name, data) => {
    console.log('收到服务器推送的时间:', data.time);
  });
  // > ⚠️ 注意：`(name, data)` 签名是因为上面第3步调用了 `backendEventable`。
  // > 没有它的话，`on()` 只会收到 `data`（不会自动添加名称）。

  // 6. (可选) 向服务器发布事件
  await eventClient.publish({ event: 'client-hello', data: { message: '你好，服务端！' } });
}

main().catch(console.error);
```

## 🏛️ 架构

`@isdk/tool-event` 系统构建在一个强大而灵活的架构之上，该架构将事件逻辑与底层通信协议分离开来。其核心是一个**可插拔的发布/订阅（PubSub）传输层**，允许您通过简单地提供一个兼容的传输实现，来使用服务器发送事件（SSE）、WebSockets、IPC 或任何其他协议。

要获取完整的开发者指南，请参阅 [**PubSub 开发者指南 (pubsub.cn.md)**](./pubsub.cn.md)。

### 统一事件总线

该系统创建了一个跨越服务器和客户端的无缝、双向事件总线。它通过分离**控制平面**（用于管理订阅）和**数据平面**（用于传递事件）来实现这一点。

- **🛠️ 控制平面 (RPC):** 像 `subscribe` 和 `unsubscribe` 这样的操作，通过主 `@isdk/tool-rpc` 传输作为标准的 RPC 调用来处理（映射为 `$sub` / `$unsub` 动作）。这复用了现有的、熟悉的服务发现和调用基础设施。
- **📡 数据平面 (PubSub):** 实际的事件负载通过一个专用的、抽象的、可插拔的 PubSub 传输（如 SSE）异步地传递给客户端。

```mermaid
graph TD
    subgraph "客户端"
        EC[EventClient<br><i>需 backendEventable 注入 .on/.off/.emit</i>]
        CT[ClientTransport<br><i>RPC: 发起 publish/subscribe</i>]
        PCT[PubSubClientTransport<br><i>接收服务端广播事件</i>]
    end

    subgraph "服务端"
        ES[EventServer<br><i>需 backendEventable 注入 .on/.off/.emit</i>]
        ST[ServerTransport<br><i>RPC: 接收 publish/subscribe</i>]
        PST[PubSubServerTransport<br><i>向客户端广播事件</i>]
    end

    EC -- "RPC: publish/subscribe/unsubscribe" --> CT
    CT -- "→ RPC 请求" --> ST
    ST -- "→ 交由 EventServer 处理 ($sub/$pub/$unsub)" --> ES

    ES -- "PubSub: 广播事件" --> PST
    PST -- "→ PubSub 消息 (如 SSE)" --> PCT
    PCT -- "→ 由 EventClient 分发" --> EC

    class EC,PCT,CT client
    class ES,PST,ST server
```

### 核心概念：设计哲学

为了充分理解 `EventServer` 和 `EventClient`，关键是要明白它们的设计初衷：**将实时事件无缝地集成到 `@isdk/tool-rpc` 的现有 RPC/RESTful 架构中**。它们不仅仅是事件处理器，更是连接本地事件与远程世界的智能桥梁。

#### 1. 为什么要继承 `ResServerTools` / `ResClientTools`？

这个核心设计决策带来了几大好处，避免了重新发明轮子：

- **统一的服务发现与客户端代理**：因为 `EventServer` 是一个标准的 `ResServerTools`，所以 `HttpClientToolTransport` 可以自动发现它，并在客户端动态创建一个功能齐全的 `EventClient` 代理。您无需为事件处理编写任何特殊的客户端配置。

- **统一的 API 调用方式**：订阅、取消订阅和发布事件等操作被巧妙地映射为标准的 RPC 调用。
  - `eventClient.subscribe(...)` 在幕后变成了一个对服务器的 RPC 调用 (`act: '$sub'`)。
  - `eventClient.publish(...)` 同样是一个 RPC 调用 (`act: '$publish'`)。
  这意味着开发者可以使用与项目中其他工具完全相同的方式与事件系统交互，大大降低了学习成本。

- **复用传输层**：整个 `@isdk/tool-rpc` 的传输层和中间件生态系统都可以被直接复用。

#### 2. 事件流作为一种"资源"

该库优雅地将一个有状态的、持久的连接（如 SSE）抽象成一个无状态的、符合 REST 风格的"资源"。

- **获取事件流**：当客户端第一次需要订阅事件时，`EventClient` 会向 `GET /api/event` (这是 `EventServer` 的 `list` 方法) 发起请求。这个请求的响应就是一个 `text/event-stream` 类型的持久流。服务端会分配一个唯一的 UUID 作为 `clientId`，并通过 `welcome` 事件发送给客户端。从概念上讲，这等同于"获取"一个代表实时事件流的资源。

- **会话身份与重连接续**：`welcome` 事件除了携带服务端分配的 `clientId`，还携带一个重连凭证（`sessionToken`）。一次连接归属于哪个会话，由 RPC 传输层上的 tool-rpc `RpcIdentityPolicy` 决定 —— 流就是它的一次请求，因此流与后续调用解析到同一个身份 —— 默认实现是 `RpcSessionIdentityPolicy` 签发的服务端不透明 token。客户端无法自选其 `$sub`/`$publish` 所匹配的 id。连接断开后，客户端带着该凭证重新打开流，续用同一个会话：`clientId` 不变、订阅列表不变，并从它最后收到的事件处重放。重放覆盖从客户端最后确认的事件 id 之后发布的全部消息（在通道历史缓存 `historySize` 范围内，并按续用会话的订阅列表过滤）—— 因此连接断开期间发布的消息也会送达。认证留在事件协议之外 —— 外部认证协议是替换该策略，而不是扩展它。

- **管理事件流**：后续的 `subscribe` 和 `publish` 操作可以被看作是对这个"资源"状态的修改，它们通过独立的、常规的 RPC 请求来完成。

这种设计将复杂的实时连接管理简化为开发者已经非常熟悉的、清晰的 REST/RPC 模型。

#### 3. 作为"桥梁"的角色

`EventServer` 和 `EventClient` 的核心功能是充当**桥梁**：

- **`EventServer`** 是 **服务器内部事件总线** 与 **网络客户端** 之间的桥梁。
  - **出站 (Outbound)**: 通过 `forward()` 方法监听内部事件（例如，数据库更新），并将它们发布到网络上，供所有订阅的客户端接收。
  - **入站 (Inbound)**: 接收从客户端发布来的事件，并通过 `autoInjectToLocalBus` 选项，有选择地将这些事件加上 `client:` 前缀后发送到内部事件总线上，供服务器的其他部分处理。

- **`EventClient`** 是 **网络** 与 **客户端应用本地事件总线** 之间的桥梁。
  - **入站 (Inbound)**: 监听从服务器通过网络推送过来的事件，并在自己的实例上（经 `backendEventable` 注入后）发出这些事件。这使得您的应用程序代码只需通过 `eventClient.on(...)` 即可轻松消费。
  - **出站 (Outbound)**: 通过 `publish()` 或 `forwardEvent()` 方法，将客户端本地的事件发布到网络上，发送给服务器。

## 🚀 高级用法

### 1. 在服务器上处理客户端发布的事件

默认情况下，为安全起见，从客户端发布的事件不会在服务器的事件总线上触发。要启用此行为，您需要设置 `EventServer.autoInjectToLocalBus = true`。然后，您可以监听带有 `client:` 前缀的事件。

**服务器端 (`server.ts`):**

```typescript
import { event } from '@isdk/tool-event'; // 导入底层的 event tool
const eventBus = event.runSync(); // 获取 event bus 实例

// ... 在服务器启动代码中 ...

// 启用自动注入
EventServer.autoInjectToLocalBus = true;

// 监听来自任何客户端的 'client-greeting' 事件
eventBus.on('client:client-greeting', function(data, ctx) {
  // 'this' 是事件对象，'ctx' 包含元信息（含发送者 session）
  const senderId = ctx.sender?.clientId;
  console.log(`[服务器] 收到来自客户端 ${senderId} 的问候:`, data);

  // 作为一个响应，只向发送者回送一个私人事件
  EventServer.publish('private-reply', { message: '我收到你的消息了！' }, {
    clientId: senderId,
  });
});
```

当快速入门中的客户端发送 `client-greeting` 事件时，服务器将打印日志并向该特定客户端发送一个私有回复。

**重要**：`ctx` 中的 `sender` 对象包含从传输层会话中提取的可信 `clientId`（而非客户端负载中的值），这是一个防止身份冒充的关键安全措施。

### 2. 向特定客户端发布 (定向发布)

您可以通过在 `publish` 方法中指定 `clientId` 来将事件发送给特定用户，而不是广播给所有订阅者。

**客户端 (`client.ts`):**

```typescript
// ... 在 main 函数中 ...

// 订阅一个私有事件
await eventClient.subscribe('private-reply');

// 监听该事件
eventClient.on('private-reply', (name, data) => {
  console.log(`[客户端] 收到私有回复:`, data);
});
```

此设置创建了一个请求-响应模式，其中客户端发起一个公共事件，服务器以一个只有该客户端能收到的私有事件作为回应。

### 3. 动态订阅

客户端不仅可以在初始连接时订阅事件，还可以在任何时候通过调用 `subscribe` 或 `unsubscribe` 来更改其订阅。这对于允许用户动态加入或离开"房间"或"频道"非常有用。

```typescript
// client.ts

// ... 假设 eventClient 已经初始化 ...

async function manageSubscriptions() {
  console.log('订阅 "news" 频道...');
  await eventClient.subscribe('news');

  // 模拟一段时间后不再对 "news" 感兴趣
  setTimeout(async () => {
    console.log('取消订阅 "news" 频道...');
    await eventClient.unsubscribe('news');
  }, 10000);
}
```

订阅也可以传入模式（正则），一次调用即可覆盖一类事件，服务器端与客户端均适用：

```typescript
// 字符串形式正则，或直接传入 RegExp 对象 —— 所有接受事件名的位置都接受模式。
await eventClient.subscribe(['/^user-.*/', /^order-/])
eventClient.on('/^user-.*/', (name: string, data: any) => console.log(name, data))

eventServer.forward(['/^log-(error|warning)$/i'])
```

只有形如 `/source/flags` 的字符串才会被当作正则；匹配时 `g` 与 `y` 标志会被忽略；精确事件名与覆盖它的正则同时订阅时，事件只投递**一次**而不会重复。完整规则见[模式（正则）订阅](./pubsub.cn.md#模式正则订阅)。

### 4. 客户端事件转发

`forwardEvent` 方法是将客户端本地事件活动无缝同步到服务器的强大工具。假设您的客户端应用有自己的内部事件总线，用于处理 UI 交互。您可以选择性地将某些事件转发到服务器进行处理或广播。

```typescript
// client.ts

// ... 假设 eventClient 已经初始化且已应用 backendEventable ...

// 1. 配置转发：任何本地发出的 'user-action' 事件都将发送到服务器
eventClient.forwardEvent('user-action');

console.log('[客户端] 设置 "user-action" 事件转发。');

// 2. 模拟一个本地UI事件
setTimeout(() => {
  const actionData = { action: 'button-click', elementId: 'save-button' };
  console.log('[客户端] 在本地总线上发出 "user-action":', actionData);
  eventClient.emit('user-action', actionData);
}, 2000);

// 在服务器端，您可以像处理任何其他客户端发布的事件一样处理 'client:user-action'

// 要停止转发，请使用 unforwardEvent:
// eventClient.unforwardEvent('user-action');
```

此模式对于将客户端行为（如分析、日志记录或状态更改）同步到后端非常有用，而无需在每个事件点手动编写 `publish` 调用。

### 5. 服务端事件总线转发

在服务器端，您可以使用 `forward()` 方法自动将全局事件总线上的事件中继到所有订阅的客户端。

```typescript
import { EventServer, eventServer, event } from '@isdk/tool-event';

const eventBus = event.runSync();

// 1. 配置服务器转发特定事件
eventServer.forward(['user-updated', 'item-added']);

// 2. 现在，服务器的任何其他部分只需在总线上触发事件，
//    它们就会自动广播给所有订阅的客户端。
function updateUser(user: any) {
  // 这将转发给所有订阅的客户端
  eventBus.emit('user-updated', { userId: user.id, status: 'active' });
}

// 停止转发：
// eventServer.unforward(['user-updated']);
```

### 6. 客户端连接生命周期管理

`EventClient` 提供了多种方法来管理 SSE/PubSub 连接的生命周期。

```typescript
// 初始化（重新连接）并订阅特定事件
await eventClient.init(['news', 'updates']);

// 检查连接是否活跃
if (eventClient.active) {
  console.log('连接活跃');
}

// 激活/停用连接
await eventClient.setActive(true);  // 连接
await eventClient.setActive(false); // 断开

// 关闭连接
eventClient.close();
```

### 6.1 会话身份与断线续用

SSE 流是一个**会话**。服务端在 `welcome` 事件中分配它的 `clientId`，每一次 `$sub`/`$publish` 都是针对该会话进行匹配 —— 而不是针对客户端自己放在参数里的 id。

```typescript
// id 由服务端分配，客户端只能读取，不能自选
await eventClient.setActive(true);
console.log(eventClient.clientId); // 服务端分配，且会跟随会话

// 流断开后，客户端会带着 `welcome` 下发的重连凭证（`sessionToken`）重新打开流，
// 因此会话能跨过这次中断：clientId 不变、订阅列表不变（包括流建立之后通过 RPC
// 新增的订阅），并补发客户端尚未确认的消息。
```

一次连接请求归属于哪个会话，由 tool-rpc 的 `RpcIdentityPolicy` 决定 —— 就是装在 RPC 传输层上的那一个，因为流请求本身就经过那条流水线：

```typescript
// 流与后续调用共用同一个策略实例
const identity = new RpcSessionIdentityPolicy({ ttlMs: 30_000 });
const server = new HttpServerToolTransport({ identity, credentialReader: sseCredentialReader });
EventServer.setPubSubTransport(new SseServerPubSubTransport({
  revoke: (id) => identity.revoke(id), // 通道重置时一并抹掉该会话的凭证
}));
```

`match`（凭证 → 身份）每请求只跑一次；`assign` 负责为新会话分配 id，其 `credential` 就是 `welcome` 交回的内容。默认策略签发服务端不透明 token，TTL 滑动、不限使用次数 —— 每个 `$sub` 都是一次出示，设上限会把凭证提前花完。外部认证协议通过替换该策略接入（`match` 可以是异步：JWKS、查库），而不是扩展事件协议。不装策略则流无法建立：没有服务端定的 id 可以定位会话，`list` 会返回 401。

**跨域部署要自己放行凭证所在的请求头。** 控制面调用把凭证放在自定义头 `rpc-session-token` 里，而浏览器只有在服务端把它列进 `Access-Control-Allow-Headers`（并正确应答 preflight）后才会带上自定义头；RPC 前缀前面的反向代理也必须透传该头。流本身不受影响 —— 它走 `session_token` query —— 所以缺头是静默失败：每个控制面调用都解析成一个新会话。同源部署（包括示例用的 dev-server 代理）无需额外配置。

重放覆盖从客户端最后确认的事件 id 之后发布的全部消息（在通道历史缓存 `historySize` 范围内，并按续用会话的订阅列表过滤）—— 连接断开期间发布的消息也会送达。

一个会话只有**一条在任流**：第二个携带凭证的连接会接管该会话（被取代的流会关闭），因此一次发布在每个 `clientId` 上只投递一次。三个通道选项决定了续用的行为，通过 `new SseServerPubSubTransport({ channelOptions })` 传入：

| 选项 | 作用 |
|---|---|
| `resumeWindow`（30s） | 会话断开后可以用原有订阅列表续用的时长。每次断开都会重新开启这个窗口，因此不断掉线的会话始终可续用；设为 `0` 则每次重连都会开一个新会话。 |
| `maxStreamDuration`（30s） | 服务端定时结束该流。这与其他断开没有区别：它开启续用窗口，客户端续用同一个会话且无需感知。设为 `0` 关闭该限制。 |
| `historySize`（100） | 重连可重放的历史深度。 |

**掉线**不是**关闭**。对代理超时或 `maxStreamDuration` 到期而言，续用是正确答案；但当会话是服务端结束的（`session.close()`），它就是错答案：客户端会去续传一个已不存在的会话，而它的流仍报告 `readyState === 1`。`closeSignal` 止为这种情况提供一帧 `$close`——`'server'` 宣告 `session.close()`，`'server+reset'` 还宣告通道重置——客户端用 `new SseClientPubSubTransport({ closeSignal: true })` 识别它：流进入 CLOSED，`closeReason` 说明原因，不再重连。两端默认均关闭，不要求则字节流与旧版本一致。为何帧名叫 `$close`、以及它为何不进入重放历史，见 [pubsub.cn.md](./pubsub.cn.md)。

### 7. 实现并使用可插拔传输层

本库的核心优势之一是其传输层是完全可插拔的。虽然内置了 SSE 实现，但您可以轻松创建并换成您自己的实现（例如，基于 WebSocket 或 IPC）。

您需要做的是实现 `IPubSubServerTransport` 接口。以下是一个基于 `ws` (一个流行的 WebSocket 库) 的概念性骨架示例：

```typescript
// transports/WebSocketServerTransport.ts
import { WebSocketServer } from 'ws';
import type { RpcIdentity } from '@isdk/tool-rpc';
import type { IPubSubServerTransport, PubSubServerSession } from '@isdk/tool-event';

export class WebSocketServerTransport implements IPubSubServerTransport {
  readonly name = 'websocket';
  readonly protocol = 'ws';
  private wss: WebSocketServer;
  private sessions = new Map<string, PubSubServerSession>();
  private onMsg: (session: PubSubServerSession, event: string, data: any) => void;
  private onConn?: (session: PubSubServerSession) => void;
  private onDis?: (session: PubSubServerSession) => void;

  constructor(options: { port: number }) {
    this.wss = new WebSocketServer({ port: options.port });    this.wss.on('connection', (ws, req) => {
      // id 在服务端生成，绝不取自客户端。挂在 RPC 传输层后面的传输，键用身份策略为升级请求
      // 解析出的那个 id；独立运行的传输自己生成，并把这个映射留在服务端。
      const clientId = uuid();
      const session: PubSubServerSession = {
        id: clientId,
        clientId,
        protocol: 'ws',
        send: (event, data) => {
          ws.send(JSON.stringify({ event, data }));
        },
        close: () => ws.close(),
        raw: ws,
      };
      this.sessions.set(clientId, session);
      this.onConn?.(session);

      ws.on('message', (message) => {
        const { event, data } = JSON.parse(message.toString());
        this.onMsg?.(session, event, data);
      });

      ws.on('close', () => {
        this.sessions.delete(clientId);
        this.onDis?.(session);
      });
    });
  }

  connect(options?: { req?: any; res?: any; events?: string[]; identity?: RpcIdentity }) {
    throw new Error('WebSocket 传输使用自己的连接生命周期。');
  }

  // `$sub`/`$unsub`/`$publish` 走的查找：身份策略为该请求解析出的 id（`ctx.identity.id`），客户端无法自选。
  getSessionFromIdentity(identityId?: string): PubSubServerSession | undefined {
    return identityId ? this.sessions.get(identityId) : undefined;
  }

  subscribe(session: PubSubServerSession, events: string[]) {
    // 为此会话跟踪订阅
  }

  unsubscribe(session: PubSubServerSession, events: string[]) {
    // 为此会话移除订阅
  }

  publish(event: string, data: any, target?: { clientId?: string | string[] }) {
    const payload = JSON.stringify({ event, data });
    if (target?.clientId) {
      const ids = Array.isArray(target.clientId) ? target.clientId : [target.clientId];
      ids.forEach(id => this.sessions.get(id)?.raw.send(payload));
    } else {
      this.wss.clients.forEach(client => client.send(payload));
    }
  }

  onMessage(cb: (session: PubSubServerSession, event: string, data: any) => void) {
    this.onMsg = cb;
  }

  onConnection(cb: (session: PubSubServerSession) => void) {
    this.onConn = cb;
  }

  onDisconnect(cb: (session: PubSubServerSession) => void) {
    this.onDis = cb;
  }
}
```

**如何使用它:**

您只需在服务器启动时将 `EventServer` 的传输替换为您自己的实现即可。

```typescript
// server.ts
// import { SseServerPubSubTransport } from '@isdk/tool-event'; // 旧的
import { WebSocketServerTransport } from './transports/WebSocketServerTransport'; // 新的

// const sseTransport = new SseServerPubSubTransport(); // 旧的
const wsTransport = new WebSocketServerTransport({ port: 8080 }); // 新的

// EventServer.setPubSubTransport(sseTransport); // 旧的
EventServer.setPubSubTransport(wsTransport); // 新的

// ... 剩余代码保持不变
```

通过这种方式，您的核心业务逻辑（`EventServer`）与底层通信协议完全解耦。

### 8. 使用 `backendEventable` 简化后端事件处理

为了实现一种更集成、面向对象的事件处理方法，`@isdk/tool-event` 提供了一个强大的 `backendEventable` 工具函数。它使用 `custom-ability` 库的 AOP（面向切面编程）模式，通过 `createAbilityInjector` 将事件能力（`on`、`emit`、`once`、`off` 等）直接注入到类的原型中。

这种模式特别适用于：

- 让 `EventServer` 自身能够触发其生命周期事件。
- 允许任何后端服务（只要它继承自 `ToolFunc`）轻松地发布或订阅事件，而无需直接引用事件总线。
- **增强 `EventClient`，使其成为一个功能强大的本地事件总线，同时连接到服务器和其他客户端。**

**如何使用 `backendEventable`：**

在您的应用程序的主设置文件中，您可以增强希望具备事件感知能力的类。这通常在应用程序启动时一次性完成。

```typescript
// --- 在您的应用程序主设置文件中 ---
import { EventServer, EventClient, backendEventable, EventBusName, event } from '@isdk/tool-event';
import { ToolFunc } from '@isdk/tool-func';

// 1. 增强 EventServer 类本身，使其具备事件感知能力。
// 这会"修补"该类，因此任何 EventServer 实例现在都可以使用 `this.emit()`。
backendEventable(EventServer);

// 2. 增强 EventClient 类，使其具备事件感知能力（使用默认事件总线名称）。
// 如果在同一进程中同时使用 EventServer 和 EventClient（如测试），
// 可以指定自定义事件总线名称以避免冲突：
// const EventBusClientName = 'event-bus-client';
// backendEventable(EventClient, { eventBusName: EventBusClientName });
backendEventable(EventClient);


// (可选) 增强一个自定义服务类
class MyCustomService extends ToolFunc {
  name = 'my-service';
  doSomething() {
    console.log('[MyService] 正在做某事并发出一个事件。');
    this.emit('my-service-event', { info: '发生了一些重要的事情' });
  }
}
backendEventable(MyCustomService);


// --- 稍后，在服务器初始化期间 (server.ts) ---

async function startServer() {
  // 设置共享事件总线（一次性设置）
  const eventBus = event.runSync();
  new ToolFunc(EventBusName, { tools: { emitter: eventBus } }).register();

  // 供 server 端使用（使用不同的名称以避免与预导出的 `eventServer` 单例冲突）
  const eventTool = new EventServer('my-event');
  eventTool.register();

  const myService = new MyCustomService();
  myService.register();

  // 现在，实例之间可以通过事件总线进行通信
  eventTool.on('my-service-event', (name, data) => {
    console.log('EventServer 实例捕获到来自 MyCustomService 的事件:', data);
  });

  // 触发发出事件的方法
  myService.doSomething();

  // 您仍然可以使用静态的 publish 方法，它使用同一个事件总线
  EventServer.publish('another-event', { from: '静态调用' });
}
```

`emit()` 方法会自动将工具的 `name` 作为第一个参数传递给监听器，便于识别事件来源。例如：

```typescript
eventTool.on('my-service-event', function(name, data) {
  // name 将为 'my-service'（来源工具的名称）
  // data 将为 { info: '发生了一些重要的事情' }
});
```

## 🤝 贡献

我们欢迎各种形式的贡献！请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 文件以获取有关如何开始的指南。

## 📄 许可证

该项目根据 MIT 许可证授权。有关更多详细信息，请参阅 [LICENSE-MIT](./LICENSE-MIT) 文件。
