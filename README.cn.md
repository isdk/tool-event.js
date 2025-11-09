# @isdk/tool-event

`@isdk/tool-event` 为 `@isdk/tool-rpc` 生态系统带来了强大的实时、双向事件通信能力。

它的核心设计理念是**将发布/订阅模型无缝地集成到您已经熟悉的 RPC/RESTful 架构中**。您无需再手动管理独立的 WebSocket 或 SSE 连接，而是将实时事件视为另一种“工具”，它可以通过标准的 `tool-rpc` 框架被发现和调用。这种方法极大地简化了构建交互式 AI 代理、实时数据仪表盘、通知系统以及任何需要实时更新的应用的复杂性。

简而言之, `@isdk/tool-event` 让您用统一、简单的方式处理所有远程调用——无论是常规的 RPC 还是实时的事件流。

本项目基于 `@isdk/tool-func` 和 `@isdk/tool-rpc` 构建。在继续之前，请确保您已熟悉它们的核心概念。

## ✨ 核心功能

- **🚀 实时通信:** 提供了一个健壮的 Pub/Sub 模型，用于服务器和客户端之间的实时、双向事件流。
- **🔌 可插拔传输层:** 抽象的传输层允许使用不同的通信协议。内置了对 **服务器发送事件 (SSE)** 的实现。
- **🔗 无缝集成:** 扩展了 `@isdk/tool-rpc` 的 `ResServerTools` 和 `ResClientTools`，使事件端点的行为与其他 RESTful/RPC 工具一样。
- **🔄 自动转发:** 可轻松地将服务器端事件总线上的事件转发给客户端，或将客户端事件总线上的事件转发到服务器。
- **🎯 定向发布:** 从服务器向所有订阅的客户端发布事件，或通过客户端 ID 定向发布给特定客户端。
- **🔐 默认安全:** 客户端发布的事件是沙箱化的，不会自动注入到服务器的主事件总线中，除非显式启用，以防止意外的副作用。

## 🏛️ 架构

`@isdk/tool-event` 引入了 `EventClient` 和 `EventServer`，它们与一个可插拔的传输层协同工作，以促进实时通信。

```mermaid
graph TD
    subgraph 客户端
        A[你的应用] --> B[EventClient];
        B -- 使用 --> C[IPubSubClientTransport (例如, SseClientPubSubTransport)];
    end

    subgraph 服务器端
        G[EventServer] --> H[IPubSubServerTransport (例如, SseServerPubSubTransport)];
        H -- 管理 --> I[底层协议 (SSE, WebSocket, 等)];
        J[服务器端 EventBus] -.->|由 EventServer 转发| H;
    end

    subgraph 网络
        C -- HTTP/SSE 连接 --> I;
    end

    A -- 1. subscribe('my-event') --> B;
    B -- 2. connect() --> C;
    C -- 3. 建立持久连接 --> I;
    I -- 4. 创建会话 --> H;
    H -- 5. 注册订阅 --> H;
    J -- 6. emit('my-event', data) --> G;
    G -- 7. publish(data) --> H;
    H -- 8. 向订阅的客户端发送数据 --> I;
    I -- 9. 推送事件数据 --> C;
    C -- 10. 触发事件 --> B;
    B -- 11. emit('my-event', data) --> A;
```

1. **EventClient/EventServer:** 这些是专门化的 `ResClientTools`/`ResServerTools`，用于处理订阅、取消订阅和发布事件的逻辑。
2. **传输层 (`IPubSub...Transport`):** 这是负责实际通信协议的抽象。该库提供了默认的 `SseServerPubSubTransport` 和 `SseClientPubSubTransport` 用于服务器发送事件。您可以为 WebSockets、IPC 或其他协议创建自己的传输。
3. **事件流:** 客户端使用 `EventClient` 来 `subscribe` (订阅) 主题。传输层建立连接。当服务器的 `EventServer` `publish` (发布) 事件时，传输层会将其仅传递给已订阅的客户端。

## 📦 安装

```bash
npm install @isdk/tool-event @isdk/tool-rpc @isdk/tool-func
```

## 🚀 快速入门

此示例演示了如何设置一个每 3 秒推送一次当前时间的服务器，以及一个订阅该事件的客户端。

### 第 1 步：定义事件服务器

`EventServer` 充当事件管理的中心枢纽。我们将使用内置的 SSE 传输，并使用 `@isdk/tool-rpc` 的 HTTP 传输来托管它。

```typescript
// ./server.ts
import { HttpServerToolTransport } from '@isdk/tool-rpc';
import { EventServer, SseServerPubSubTransport } from '@isdk/tool-event';

async function startServer() {
  // 1. 为服务器实例化 SSE 传输。
  const sseTransport = new SseServerPubSubTransport();

  // 2. 在 EventServer 类上静态设置传输。
  EventServer.setPubSubTransport(sseTransport);

  // 3. 实例化并注册主事件工具。
  // 名称 'event' 将成为 URL 的一部分 (例如, /api/event)。
  const eventTool = new EventServer('event');
  eventTool.register();

  // 4. 将名为 'server-time' 的服务器端事件转发给客户端。
  // 任何订阅了 'server-time' 的客户端都将收到它。
  eventTool.forward('server-time');

  // 5. 使用 tool-rpc 的标准 HTTP 传输来托管我们的工具。
  const httpTransport = new HttpServerToolTransport();

  // 6. 挂载 EventServer 基类。传输层将找到已注册的 'event' 工具。
  // 这将在 '/api' 前缀下创建必要的端点。
  httpTransport.mount(EventServer, '/api');

  // 7. 启动服务器。
  const port = 3000;
  await httpTransport.start({ port });
  console.log(`✅ 事件服务器已启动于 http://localhost:${port}`);

  // 8. 每 3 秒发布一次 'server-time' 事件。
  setInterval(() => {
    const data = { now: new Date().toISOString() };
    console.log(`
[服务器] 发布 'server-time':`, data);
    // 使用静态的 publish 方法发送事件。
    EventServer.publish('server-time', data);
  }, 3000);
}

startServer();
```

### 第 2 步：设置并使用客户端

`EventClient` 连接到服务器，订阅事件，并且也可以将事件发布回服务器。

```typescript
// ./client.ts
import { HttpClientToolTransport } from '@isdk/tool-rpc';
import { EventClient, SseClientPubSubTransport } from '@isdk/tool-event';

async function main() {
  const apiRoot = 'http://localhost:3000/api';

  // 1. 在 EventClient 类上静态设置 SSE 传输。
  EventClient.setPubSubTransport(new SseClientPubSubTransport());

  // 2. 使用标准的 HTTP 传输来发现远程工具。
  const httpTransport = new HttpClientToolTransport(apiRoot);
  await httpTransport.mount(EventClient);

  // 3. 获取为远程 'event' 工具动态创建的代理。
  const eventClient = EventClient.get('event');
  if (!eventClient) {
    throw new Error('远程事件工具未找到！');
  }

  // 4. 在客户端的本地事件总线上监听 'server-time' 事件。
  eventClient.on('server-time', (data) => {
    console.log(`[客户端] 收到 'server-time' 事件:`, data);
  });

  // 5. 从服务器订阅 'server-time' 事件。
  // 这将打开 SSE 连接。
  console.log('[客户端] 正在订阅 'server-time'...');
  await eventClient.subscribe('server-time');
  console.log('✅ [客户端] 订阅成功！');

  // 6. 演示从客户端向服务器发布事件。
  setTimeout(() => {
    const message = { text: '来自客户端的问候！' };
    console.log('\n[客户端] 正在发布 "client-greeting":', message);
    eventClient.publish({ event: 'client-greeting', data: message });
  }, 5000);
}

main();
```

### 第 3 步：运行示例

1. 运行服务器: `ts-node ./server.ts`
2. 在新的终端中，运行客户端: `ts-node ./client.ts`

您将看到客户端每 3 秒从服务器接收一次时间更新。

## 核心概念：设计哲学

为了充分理解 `EventServer` 和 `EventClient`，关键是要明白它们的设计初衷：**将实时事件无缝地集成到 `@isdk/tool-rpc` 的现有 RPC/RESTful 架构中**。它们不仅仅是事件处理器，更是连接本地事件与远程世界的智能桥梁。

### 1. 为什么要继承 `ResServerTools` / `ResClientTools`？

这个核心设计决策带来了几大好处，避免了重新发明轮子：

- **统一的服务发现与客户端代理**：因为 `EventServer` 是一个标准的 `ResServerTools`，所以 `HttpClientToolTransport` 可以自动发现它，并在客户端动态创建一个功能齐全的 `EventClient` 代理。您无需为事件处理编写任何特殊的客户端配置。

- **统一的 API 调用方式**：订阅、取消订阅和发布事件等操作被巧妙地映射为标准的 RPC 调用。
  - `eventClient.subscribe(...)` 在幕后变成了一个对服务器的 RPC 调用 (`act: '$sub'`)。
  - `eventClient.publish(...)` 同样是一个 RPC 调用 (`act: '$publish'`)。
  这意味着开发者可以使用与项目中其他工具完全相同的方式与事件系统交互，大大降低了学习成本。

- **复用传输层**：整个 `@isdk/tool-rpc` 的传输层和中间件生态系统都可以被直接复用。

### 2. 事件流作为一种“资源”

该库优雅地将一个有状态的、持久的连接（如 SSE）抽象成一个无状态的、符合 REST 风格的“资源”。

- **获取事件流**：当客户端第一次需要订阅事件时，`EventClient` 会向 `GET /api/event` (这是 `EventServer` 的 `list` 方法) 发起请求。这个请求的响应就是一个 `text/event-stream` 类型的持久流。从概念上讲，这等同于“获取”一个代表实时事件流的资源。

- **管理事件流**：后续的 `subscribe` 和 `publish` 操作可以被看作是对这个“资源”状态的修改，它们通过独立的、常规的 RPC 请求来完成。

这种设计将复杂的实时连接管理简化为开发者已经非常熟悉的、清晰的 REST/RPC 模型。

### 3. 作为“桥梁”的角色

`EventServer` 和 `EventClient` 的核心功能是充当**桥梁**：

- **`EventServer`** 是 **服务器内部事件总线** 与 **网络客户端** 之间的桥梁。
  - **出站 (Outbound)**: 它通过 `forward()` 方法监听内部事件（例如，数据库更新），并将它们“发布”到网络上，供所有订阅的客户端接收。
  - **入站 (Inbound)**: 它接收从客户端“发布”来的事件，并通过 `autoInjectToLocalBus` 选项，有选择地将这些事件加上 `client:` 前缀后“发”到内部事件总线上，供服务器的其他部分处理。

- **`EventClient`** 是 **网络** 与 **客户端应用本地事件总线** 之间的桥梁。
  - **入站 (Inbound)**: 它监听从服务器通过网络推送过来的事件，并在自己的实例上（它本身就是一个 `EventEmitter`）“发”出这些事件。这使得您的应用程序代码只需通过 `eventClient.on(...)` 即可轻松消费。
  - **出站 (Outbound)**: 它通过 `publish()` 或 `forwardEvent()` 方法，将客户端本地的事件“发布”到网络上，发送给服务器。

总之，这种设计使得开发者在大部分时间里都无需关心底层复杂的网络协议和连接管理。您只需在相应的事件总线上监听或触发事件，`@isdk/tool-event` 会负责处理好所有繁琐的中间环节。

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
  // 'this' 是事件对象, 'ctx' 包含元信息
  const senderId = ctx.sender?.clientId;
  console.log(`[服务器] 收到来自客户端 ${senderId} 的问候:`, data);

  // 作为一个响应，只向发送者回送一个私人事件
  EventServer.publish('private-reply', { message: '我收到你的消息了！' }, {
    clientId: senderId,
  });
});
```

当快速入门中的客户端发送 `client-greeting` 事件时，服务器现在将打印日志并向该特定客户端发送一个私有回复。

### 2. 向特定客户端发布 (定向发布)

您可以通过在 `publish` 方法中指定 `clientId` 来将事件发送给特定用户，而不是广播给所有订阅者。

**客户端 (`client.ts`):**

```typescript
// ... 在 main 函数中 ...

// 订阅一个私有事件
eventClient.subscribe('private-reply');

// 监听该事件
eventClient.on('private-reply', (data) => {
  console.log(`[客户端] 收到私有回复:`, data);
});
```

此设置创建了一个请求-响应模式，其中客户端发起一个公共事件，服务器以一个只有该客户端能收到的私有事件作为回应。

### 3. 动态订阅

客户端不仅可以在初始连接时订阅事件，还可以在任何时候通过调用 `subscribe` 或 `unsubscribe` 来更改其订阅。这对于允许用户动态加入或离开“房间”或“频道”非常有用。

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

### 4. 客户端事件转发

`forwardEvent` 方法是将客户端本地事件活动无缝同步到服务器的强大工具。假设您的客户端应用有自己的内部事件总线，用于处理 UI 交互。您可以选择性地将某些事件转发到服务器进行处理或广播。

```typescript
// client.ts

// ... 假设 eventClient 已经初始化并具备 eventable 特性 ...

// 假设 'ui-event-bus' 是您应用中使用的本地 EventEmitter
// 为了演示，我们让 eventClient 也扮演这个角色
const localEventBus = eventClient;

// 1. 配置转发：任何在 localEventBus 上发出的 'user-action' 事件都将发送到服务器
eventClient.forwardEvent('user-action');

console.log('[客户端] 设置 'user-action' 事件转发。');

// 2. 模拟一个本地UI事件
setTimeout(() => {
  const actionData = { action: 'button-click', elementId: 'save-button' };
  console.log('[客户端] 在本地总线上发出 "user-action":', actionData);
  localEventBus.emit('user-action', actionData);
}, 2000);

// 在服务器端，您可以像处理任何其他客户端发布的事件一样处理 'client:user-action'
```

此模式对于将客户端行为（如分析、日志记录或状态更改）同步到后端非常有用，而无需在每个事件点手动编写 `publish` 调用。

### 5. 实现并使用可插拔传输层

本库的核心优势之一是其传输层是完全可插拔的。虽然内置了 SSE 实现，但您可以轻松创建并换成您自己的实现（例如，基于 WebSocket 或 IPC）。

您需要做的是实现 `IPubSubServerTransport` 接口。以下是一个基于 `ws` (一个流行的 WebSocket 库) 的概念性骨架示例：

```typescript
// transports/WebSocketServerTransport.ts
import { WebSocketServer } from 'ws';
import type { IPubSubServerTransport, PubSubServerSession } from '@isdk/tool-event';

export class WebSocketServerTransport implements IPubSubServerTransport {
  readonly name = 'websocket';
  readonly protocol = 'ws';
  private wss: WebSocketServer;
  private sessions = new Map<string, PubSubServerSession>();
  private onMsg: (session: PubSubServerSession, event: string, data: any) => void;

  constructor(options: { port: number }) {
    this.wss = new WebSocketServer({ port: options.port });

    this.wss.on('connection', (ws) => {
      const clientId = uuid(); // 生成唯一ID
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

      ws.on('message', (message) => {
        const { event, data } = JSON.parse(message.toString());
        // 调用 EventServer 注册的回调来处理入站消息
        this.onMsg?.(session, event, data);
      });

      ws.on('close', () => {
        this.sessions.delete(clientId);
      });
    });
  }

  // EventServer 将调用此方法来注册其消息处理器
  onMessage(cb) {
    this.onMsg = cb;
  }

  publish(event: string, data: any, target?: { clientId: string | string[] }) {
    const payload = JSON.stringify({ event, data });
    if (target?.clientId) {
      const ids = Array.isArray(target.clientId) ? target.clientId : [target.clientId];
      ids.forEach(id => this.sessions.get(id)?.raw.send(payload));
    } else {
      this.wss.clients.forEach(client => client.send(payload));
    }
  }

  // 注意：对于 WebSocket，connect/subscribe/unsubscribe 通常在连接和消息事件中处理，
  // 因此这些方法可能只是空操作或用于记录日志。
  connect(options) { /* ... */ }
  subscribe(session, events) { /* ... */ }
  unsubscribe(session, events) { /* ... */ }
  onConnection(cb) { /* ... */ }
  onDisconnect(cb) { /* ... */ }
}
```

**如何使用它:**

您只需在服务器启动时将 `EventServer` 的传输替换为您自己的实现即可。

```typescript
// server.ts
// import { SseServerPubSubTransport } from '@isdk/tool-event'; // 旧的
import { WebSocketServerTransport } from './transports/WebSocketServerTransport'; // 新的

// ...

// const sseTransport = new SseServerPubSubTransport(); // 旧的
const wsTransport = new WebSocketServerTransport({ port: 8080 }); // 新的

// EventServer.setPubSubTransport(sseTransport); // 旧的
EventServer.setPubSubTransport(wsTransport); // 新的

// ... 剩余代码保持不变
```

通过这种方式，您的核心业务逻辑（`EventServer`）与底层通信协议完全解耦。

## 🤝 贡献

我们欢迎各种形式的贡献！请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 文件以获取有关如何开始的指南。

## 📄 许可证

该项目根据 MIT 许可证授权。有关更多详细信息，请参阅 [LICENSE-MIT](./LICENSE-MIT) 文件。
