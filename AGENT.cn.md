# @isdk/tool-event — LLM 快速入门指南

一个实时、双向的发布/订阅 (Pub/Sub) 事件系统，可插入 `@isdk/tool-rpc` RPC 框架。事件只是另一种"工具"——通过标准 RPC 机制即可发现和调用。

## 包信息

| 字段 | 值 |
|-------|-------|
| **npm** | `@isdk/tool-event` |
| **导出入口** | `@isdk/tool-event` (主入口), `@isdk/tool-event/browser`, `@isdk/tool-event/transports/pubsub`, `@isdk/tool-event/transports/pubsub/browser` |
| **依赖项** | `@isdk/tool-rpc`, `@isdk/tool-func`, `events-ex`, `custom-ability` |
| **关键常量** | `EventName = 'event'`, `EventBusName = 'event-bus'`, `ClientEventPrefix = 'client:'` |

## 架构（两个平面）

```
┌─ 控制平面 (RPC) ─────────────────────────────┐
│  subscribe / unsubscribe / publish → RPC 调用  │
│  映射为 $sub / $unsub / $publish 动作          │
└────────────────────────────────────────────────┘
┌─ 数据平面 (PubSub) ───────────────────────────┐
│  事件负载通过可插拔传输异步投递                  │
│  (内置实现: SSE)                                │
└────────────────────────────────────────────────┘
```

## ⚠️ 关键：`backendEventable` 注入

**`EventClient` 和 `EventServer` 本身没有 `.on()`、`.off()`、`.emit()` 方法。** 您必须注入它们：

```typescript
import { backendEventable, EventClient, EventServer } from '@isdk/tool-event';

backendEventable(EventClient);  // 注入 .on/.off/.emit
backendEventable(EventServer);
```

**注入后，`emit()` 会将 `this.name` 作为第一个参数前置。** 因此监听器使用：

```typescript
instance.on('event-type', (name: string, data: any) => {
  // name = 工具的名称（例如 'event', 'my-service'）
  // data = 负载
});
```

没有 `backendEventable` 时，`on()` 只接收 `data`。

## 导出

```typescript
// 主入口 (Node.js + SSR):
import {
  EventServer, eventServer,          // 服务端类与单例
  EventClient, eventClient,          // 客户端类与单例
  EventToolFunc, event,              // 事件总线工具与单例
  backendEventable,                  // AOP 事件能力注入器
  EventName, EventBusName,           // 'event', 'event-bus'
  ClientEventPrefix,                 // 'client:'
  // 工具函数 (从 events-ex 重新导出):
  EventEmitter, eventable, EventStates, wrapEventEmitter,
  // 传输层:
  SseServerPubSubTransport,
  SseClientPubSubTransport,
} from '@isdk/tool-event';

// 仅浏览器 (排除 Node.js 依赖, 如 'http'):
import {
  EventClient, eventClient,
  backendEventable,
  EventName, EventBusName, ClientEventPrefix,
  EventEmitter, eventable, EventStates, wrapEventEmitter,
  // 只有 SseClientPubSubTransport (没有 SseServerPubSubTransport):
  SseClientPubSubTransport,
} from '@isdk/tool-event/browser';

// 类型定义 (用于自定义传输):
import type {
  IPubSubServerTransport, PubSubServerSession,
  IPubSubClientTransport, PubSubClientStream,
  PubSubCtx,
} from '@isdk/tool-event';

// 子路径 — 传输层实现:
import { SseServerPubSubTransport, SseClientPubSubTransport } from '@isdk/tool-event/transports/pubsub';

// 仅浏览器传输子路径 (对 Vite 等打包工具安全):
import { SseClientPubSubTransport } from '@isdk/tool-event/transports/pubsub/browser';
```

> 💡 `transports/pubsub/browser` 子路径只导出客户端传输层，使其对无法解析 Node.js 内置模块（如 `http`）的浏览器打包工具安全。

## 快速设置 (SSE)

### 服务端

```typescript
import { EventServer, eventServer, SseServerPubSubTransport } from '@isdk/tool-event';
import { ServerTools, HttpServerToolTransport } from '@isdk/tool-rpc';

EventServer.setPubSubTransport(new SseServerPubSubTransport());
eventServer.register();

const server = new HttpServerToolTransport();
server.addRpcHandler('/api');
server.addDiscoveryHandler('/api', () => ServerTools.toJSON());
await server.start({ port: 3000 });

// 向所有已订阅的客户端广播:
EventServer.publish('server-time', { time: new Date().toISOString() });
```

### 客户端

```typescript
import { EventClient, eventClient, SseClientPubSubTransport, backendEventable } from '@isdk/tool-event';
import { ClientTools } from '@isdk/tool-rpc';

// 1. 发现服务端工具
ClientTools.apiUrl = 'http://localhost:3000/api';
await ClientTools.loadFrom();

// 2. 设置传输层 (必须在 apiUrl 之后)
EventClient.setPubSubTransport(new SseClientPubSubTransport());

// 3. 注入事件能力
backendEventable(EventClient);

// 4. 注册客户端
eventClient.register();

// 5. 订阅并监听
await eventClient.subscribe('server-time');
eventClient.on('server-time', (name, data) => {
  console.log('收到:', data.time);
});

// 6. 向服务端发布事件
await eventClient.publish({ event: 'client-hello', data: { msg: '你好' } });
```

## 核心 API 参考

### EventClient

| 方法 | 说明 |
|--------|-------------|
| `subscribe(events)` | 订阅服务端事件 (string 或 string[])。如果尚未激活则启动 SSE 流。 |
| `unsubscribe(events)` | 取消订阅服务端事件。 |
| `publish({event, data})` | 向服务端发布事件。 |
| `forwardEvent(events)` | 将本地 `.emit()` 调用转发到服务端 (需要 `backendEventable`)。 |
| `unforwardEvent(events)` | 停止转发本地事件。 |
| `init(events)` | 关闭并重新初始化带事件订阅的流。 |
| `setActive(bool)` | 连接/断开传输流。 |
| `close()` | 关闭传输流。 |
| `get clientId` | 服务端为此客户端分配的 UUID。 |
| `get active` | 传输流是否已打开。 |

### EventServer

| 方法 | 说明 |
|--------|-------------|
| `forward(events)` | 监听服务端事件总线事件并通过 PubSub 中继到客户端。 |
| `unforward(events)` | 停止中继服务端事件总线事件。 |
| `static publish(event, data, target?)` | 广播给所有客户端，或定向发送给特定 `clientId`。 |
| `static autoInjectToLocalBus` | 如果为 `true`，客户端发布的事件会以 `client:` 前缀在服务端总线上触发。默认 `false`。 |
| `static setPubSubTransport(transport)` | 设置服务端传输层。 |

### 事件总线

```typescript
import { event } from '@isdk/tool-event';
const eventBus = event.runSync(); // 返回 EventEmitter

// 服务端：监听总线上的事件
eventBus.on('my-event', (data) => { ... });
// 监听来自客户端的事件 (需要 autoInjectToLocalBus)
eventBus.on('client:my-event', (data, meta) => {
  // meta.sender.clientId = 可信的发送者 ID
});
```

## 事件转发模式

### 服务端 → 客户端 (事件总线中继)

```typescript
eventServer.forward(['user-updated']);       // 开始转发
eventBus.emit('user-updated', { id: 1 });    // → 自动广播给客户端
eventServer.unforward(['user-updated']);     // 停止转发
```

### 客户端 → 服务端 (本地 emit 中继)

```typescript
// 客户端:
EventServer.autoInjectToLocalBus = true;     // 服务端必须启用
eventClient.forwardEvent('ui-click');        // 客户端选择加入
eventClient.emit('ui-click', { x: 10 });     // → 服务端收到 'client:ui-click'

// 服务端:
eventBus.on('client:ui-click', (data, meta) => {
  console.log('来自', meta.sender.clientId, data);
});
```

### 定向发布 (发送给特定客户端)

```typescript
EventServer.publish('private-msg', { text: '你好' }, { clientId: 'xxx' });
```

## 自定义传输层接口

实现 `IPubSubServerTransport`:

```typescript
interface IPubSubServerTransport {
  readonly name: string;
  readonly protocol: string;
  connect(options?: { req, res, clientId?, events? }): PubSubServerSession;
  subscribe(session: PubSubServerSession, events: string[]): void;
  unsubscribe(session: PubSubServerSession, events: string[]): void;
  publish(event: string, data: any, target?: { clientId?: string|string[] }, ctx?: PubSubCtx): void;
  onConnection(cb: (session: PubSubServerSession) => void): void;
  onDisconnect(cb: (session: PubSubServerSession) => void): void;
  onMessage?(cb: (session, event, data, ctx?) => void): void;
  getSessionFromReq?(req: any): PubSubServerSession | undefined;
}
```

和/或 `IPubSubClientTransport`:

```typescript
interface IPubSubClientTransport {
  connect(url: string, params?: any): PubSubClientStream | Promise<PubSubClientStream>;
  disconnect?(stream: PubSubClientStream): void;
  setApiRoot?(apiRoot: string): void;
}
```

## 常见陷阱

1. ❌ **未调用 `backendEventable` 就使用 `.on()`** → `TypeError`
2. ❌ **在 `apiUrl` 之前设置传输层** → `SseClientPubSubTransport` 需要 apiRoot
3. ❌ **注入后仍使用 `(data)` 签名** → 必须使用 `(name, data)`
4. ❌ **混淆 `eventBus.on` 与 `eventClient.on`** → 原始总线 = `(data)`，注入后 = `(name, data)`
5. ❌ **注册 `EventServer('event')` 但 `eventServer` 已存在** → 使用不同的名称
6. ❌ **客户端在 `register()` 之前调用 `subscribe()`** → 先注册
7. ❌ **期望客户端事件在没有 `autoInjectToLocalBus` 时到达服务端总线** → 默认是 `false`
