# @isdk/tool-event — LLM Quick Start Guide

A real-time, bidirectional Pub/Sub event system that plugs into the `@isdk/tool-rpc` RPC framework. Events are just another "tool" — discoverable and callable through the standard RPC mechanism.

## Package Identity

| Field | Value |
|-------|-------|
| **npm** | `@isdk/tool-event` |
| **Exports** | `@isdk/tool-event` (main), `@isdk/tool-event/browser`, `@isdk/tool-event/transports/pubsub`, `@isdk/tool-event/transports/pubsub/browser` |
| **Depends on** | `@isdk/tool-rpc`, `@isdk/tool-func`, `events-ex`, `custom-ability` |
| **Key constants** | `EventName = 'event'`, `EventBusName = 'event-bus'`, `ClientEventPrefix = 'client:'` |

## Architecture (2 Planes)

```
┌─ Control Plane (RPC) ─────────────────────────────┐
│  subscribe / unsubscribe / publish → RPC calls    │
│  mapped to $sub / $unsub / $publish actions       │
└───────────────────────────────────────────────────┘
┌─ Data Plane (PubSub) ─────────────────────────────┐
│  Event payloads delivered async via pluggable     │
│  transport (built-in: SSE)                        │
└───────────────────────────────────────────────────┘
```

## ⚠️ Critical: `backendEventable` Injection

**`EventClient` and `EventServer` do NOT have `.on()`, `.off()`, `.emit()` natively.** You must inject them:

```typescript
import { backendEventable, EventClient, EventServer } from '@isdk/tool-event';

backendEventable(EventClient);  // injects .on/.off/.emit
backendEventable(EventServer);
```

**After injection, `emit()` prepends `this.name` as the first arg.** So listeners use:

```typescript
instance.on('event-type', (name: string, data: any) => {
  // name = the tool's name (e.g. 'event', 'my-service')
  // data = the payload
});
```

Without `backendEventable`, `on()` receives only `data`.

## Exports

```typescript
// Main (Node.js + SSR):
import {
  EventServer, eventServer,          // server-side class & singleton
  EventClient, eventClient,          // client-side class & singleton
  EventToolFunc, event,              // event bus tool & singleton
  backendEventable,                  // AOP injector for event capabilities
  EventName, EventBusName,           // 'event', 'event-bus'
  ClientEventPrefix,                 // 'client:'
  // utils (re-exported from events-ex):
  EventEmitter, eventable, EventStates, wrapEventEmitter,
  // transports:
  SseServerPubSubTransport,
  SseClientPubSubTransport,
} from '@isdk/tool-event';

// Browser-only (excludes Node.js deps like 'http'):
import {
  EventClient, eventClient,
  backendEventable,
  EventName, EventBusName, ClientEventPrefix,
  EventEmitter, eventable, EventStates, wrapEventEmitter,
  // Only SseClientPubSubTransport (no SseServerPubSubTransport):
  SseClientPubSubTransport,
} from '@isdk/tool-event/browser';

// Types (for custom transports):
import type {
  IPubSubServerTransport, PubSubServerSession,
  IPubSubClientTransport, PubSubClientStream,
  PubSubCtx,
} from '@isdk/tool-event';

// Subpath — transport implementations:
import { SseServerPubSubTransport, SseClientPubSubTransport } from '@isdk/tool-event/transports/pubsub';

// Browser-only transport subpath (safe for bundlers like Vite):
import { SseClientPubSubTransport } from '@isdk/tool-event/transports/pubsub/browser';
```

> 💡 The `transports/pubsub/browser` subpath only exports client-side transports, making it safe for browser bundlers that cannot resolve Node.js built-in modules like `http`.

## Quick Setup (SSE)

### Server

```typescript
import { EventServer, eventServer, SseServerPubSubTransport } from '@isdk/tool-event';
import { ServerTools, HttpServerToolTransport } from '@isdk/tool-rpc';

EventServer.setPubSubTransport(new SseServerPubSubTransport());
eventServer.register();

const server = new HttpServerToolTransport();
server.addRpcHandler('/api');
server.addDiscoveryHandler('/api', () => ServerTools.toJSON());
await server.start({ port: 3000 });

// Broadcast to all subscribed clients:
EventServer.publish('server-time', { time: new Date().toISOString() });
```

### Client

```typescript
import { EventClient, eventClient, SseClientPubSubTransport, backendEventable } from '@isdk/tool-event';
import { ClientTools } from '@isdk/tool-rpc';

// 1. Discover server tools
ClientTools.apiUrl = 'http://localhost:3000/api';
await ClientTools.loadFrom();

// 2. Set up transport (AFTER apiUrl)
EventClient.setPubSubTransport(new SseClientPubSubTransport());

// 3. Inject event capabilities
backendEventable(EventClient);

// 4. Register client
eventClient.register();

// 5. Subscribe and listen
await eventClient.subscribe('server-time');
eventClient.on('server-time', (name, data) => {
  console.log('Received:', data.time);
});

// 6. Publish to server
await eventClient.publish({ event: 'client-hello', data: { msg: 'Hi' } });
```

## Core API Reference

### EventClient

| Method | Description |
|--------|-------------|
| `subscribe(events)` | Subscribe to server events (string or string[]). Initiates SSE stream if not active. |
| `unsubscribe(events)` | Unsubscribe from server events. |
| `publish({event, data})` | Publish an event to the server. |
| `forwardEvent(events)` | Forward local `.emit()` calls to server (requires `backendEventable`). |
| `unforwardEvent(events)` | Stop forwarding local events. |
| `init(events)` | Close & re-init stream with event subscriptions. |
| `setActive(bool)` | Connect/disconnect the transport stream. |
| `close()` | Close the transport stream. |
| `get clientId` | The server-assigned UUID for this client. |
| `get active` | Whether the transport stream is open. |

### EventServer

| Method | Description |
|--------|-------------|
| `forward(events)` | Listen to server event bus events and relay them to clients via PubSub. |
| `unforward(events)` | Stop relaying server event bus events. |
| `static publish(event, data, target?)` | Broadcast to all clients or target specific `clientId`. |
| `static autoInjectToLocalBus` | If `true`, client-published events are emitted on server bus with `client:` prefix. Default `false`. |
| `static setPubSubTransport(transport)` | Set the server-side transport. |

### Event Bus

```typescript
import { event } from '@isdk/tool-event';
const eventBus = event.runSync(); // Returns EventEmitter

// Server-side: listen to events on the bus
eventBus.on('my-event', (data) => { ... });
// Listen to client-originated events (requires autoInjectToLocalBus)
eventBus.on('client:my-event', (data, meta) => {
  // meta.sender.clientId = trusted sender ID
});
```

## Event Forwarding Patterns

### Server → Client (event bus relay)

```typescript
eventServer.forward(['user-updated']);       // Start forwarding
eventBus.emit('user-updated', { id: 1 });    // → auto-broadcast to clients
eventServer.unforward(['user-updated']);     // Stop forwarding
```

### Client → Server (local emit relay)

```typescript
// Client:
EventServer.autoInjectToLocalBus = true;     // Server must enable
eventClient.forwardEvent('ui-click');        // Client opts in
eventClient.emit('ui-click', { x: 10 });     // → server gets 'client:ui-click'

// Server:
eventBus.on('client:ui-click', (data, meta) => {
  console.log('From', meta.sender.clientId, data);
});
```

### Targeted publish (to specific client)

```typescript
EventServer.publish('private-msg', { text: 'hi' }, { clientId: 'xxx' });
```

## Custom Transport Interface

Implement `IPubSubServerTransport`:

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

And/or `IPubSubClientTransport`:

```typescript
interface IPubSubClientTransport {
  connect(url: string, params?: any): PubSubClientStream | Promise<PubSubClientStream>;
  disconnect?(stream: PubSubClientStream): void;
  setApiRoot?(apiRoot: string): void;
}
```

## Common Pitfalls

1. ❌ **Calling `.on()` without `backendEventable`** → `TypeError`
2. ❌ **Setting transport before `apiUrl`** → `SseClientPubSubTransport` needs apiRoot
3. ❌ **Using `(data)` signature after injection** → Must use `(name, data)`
4. ❌ **Confusing `eventBus.on` vs `eventClient.on`** → Raw bus = `(data)`, injected = `(name, data)`
5. ❌ **Registering `EventServer('event')` when `eventServer` already exists** → Use different name
6. ❌ **Client `subscribe()` before `register()`** → Register first
7. ❌ **Expecting client events to reach server bus without `autoInjectToLocalBus`** → Default is `false`
