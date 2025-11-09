**@isdk/tool-event**

***

# @isdk/tool-event

`@isdk/tool-event` brings powerful, real-time, bidirectional event communication to the `@isdk/tool-rpc` ecosystem.

Its core design philosophy is to **seamlessly integrate a publish/subscribe model into the familiar RPC/RESTful architecture you already use**. Instead of manually managing a separate WebSocket or SSE connection, you treat real-time events as just another "tool" that is discoverable and callable through the standard `tool-rpc` framework. This approach dramatically simplifies the complexity of building interactive AI agents, live data dashboards, notification systems, and any application requiring real-time updates.

In short, `@isdk/tool-event` lets you handle all remote communication—whether it's a regular RPC or a real-time event stream—in a unified and simple way.

This package is built upon `@isdk/tool-func` and `@isdk/tool-rpc`. Please ensure you are familiar with their core concepts before proceeding.

## ✨ Core Features

- **🚀 Real-Time Communication:** Provides a robust Pub/Sub model for real-time, bidirectional event flow between server and clients.
- **🔌 Pluggable Transport Layer:** Abstracted transport layer allows using different communication protocols. Comes with a built-in implementation for **Server-Sent Events (SSE)**.
- **🔗 Seamless Integration:** Extends `@isdk/tool-rpc`'s `ResServerTools` and `ResClientTools`, making event endpoints behave like any other RESTful/RPC tool.
- **🔄 Automatic Forwarding:** Easily forward events from a server-side event bus to clients, or from a client-side event bus to the server.
- **🎯 Targeted Publishing:** Publish events from the server to all subscribed clients or target specific clients by their ID.
- **🔐 Secure by Default:** Client-published events are sandboxed and are not automatically injected into the server's main event bus unless explicitly enabled, preventing unintended side effects.

## 🏛️ Architecture

`@isdk/tool-event` introduces `EventClient` and `EventServer` which work in tandem with a pluggable transport layer to facilitate real-time communication.

```mermaid
graph TD
    subgraph Client-Side
        A[Your Application] --> B[EventClient];
        B -- Uses --> C[IPubSubClientTransport (e.g., SseClientPubSubTransport)];
    end

    subgraph Server-Side
        G[EventServer] --> H[IPubSubServerTransport (e.g., SseServerPubSubTransport)];
        H -- Manages --> I[Underlying Protocol (SSE, WebSocket, etc.)];
        J[Server-Side EventBus] -.->|Forwarded by EventServer| H;
    end

    subgraph Network
        C -- HTTP/SSE Connection --> I;
    end

    A -- 1. subscribe('my-event') --> B;
    B -- 2. connect() --> C;
    C -- 3. Establishes persistent connection --> I;
    I -- 4. Creates session --> H;
    H -- 5. Registers subscription --> H;
    J -- 6. emit('my-event', data) --> G;
    G -- 7. publish(data) --> H;
    H -- 8. Sends data to subscribed client --> I;
    I -- 9. Pushes event data --> C;
    C -- 10. Triggers event --> B;
    B -- 11. emit('my-event', data) --> A;
```

1. **EventClient/EventServer:** These are specialized `ResClientTools`/`ResServerTools` that handle the logic of subscribing, unsubscribing, and publishing events.
2. **Transport Layer (`IPubSub...Transport`):** This is the abstraction responsible for the actual communication protocol. The library provides a default `SseServerPubSubTransport` and `SseClientPubSubTransport` for Server-Sent Events. You can create your own transport for WebSockets, IPC, or other protocols.
3. **Event Flow:** The client uses `EventClient` to `subscribe` to topics. The transport establishes a connection. When the server's `EventServer` `publishes` an event, the transport delivers it only to subscribed clients.

## 📦 Installation

```bash
npm install @isdk/tool-event @isdk/tool-rpc @isdk/tool-func
```

## 🚀 Quick Start

This example demonstrates setting up a server that pushes the current time every 3 seconds and a client that subscribes to it.

### Step 1: Define the Event Server

The `EventServer` acts as the central hub for event management. We'll use the built-in SSE transport and host it using `@isdk/tool-rpc`'s HTTP transport.

```typescript
// ./server.ts
import { HttpServerToolTransport } from '@isdk/tool-rpc';
import { EventServer, SseServerPubSubTransport } from '@isdk/tool-event';

async function startServer() {
  // 1. Instantiate the SSE transport for the server.
  const sseTransport = new SseServerPubSubTransport();

  // 2. Statically set the transport on the EventServer class.
  EventServer.setPubSubTransport(sseTransport);

  // 3. Instantiate and register the main event tool.
  // The name 'event' will be part of the URL (e.g., /api/event).
  const eventTool = new EventServer('event');
  eventTool.register();

  // 4. Forward a server-side event named 'server-time' to clients.
  // Any client subscribed to 'server-time' will receive it.
  eventTool.forward('server-time');

  // 5. Use the standard HTTP transport from tool-rpc to host our tools.
  const httpTransport = new HttpServerToolTransport();

  // 6. Mount the EventServer base class. The transport will find the registered 'event' tool.
  // This creates the necessary endpoints under the '/api' prefix.
  httpTransport.mount(EventServer, '/api');

  // 7. Start the server.
  const port = 3000;
  await httpTransport.start({ port });
  console.log(`✅ Event server started at http://localhost:${port}`);

  // 8. Publish the 'server-time' event every 3 seconds.
  setInterval(() => {
    const data = { now: new Date().toISOString() };
    console.log(`\n[Server] Publishing 'server-time':`, data);
    // Use the static publish method to send the event.
    EventServer.publish('server-time', data);
  }, 3000);
}

startServer();
```

### Step 2: Set up and Use the Client

The `EventClient` connects to the server, subscribes to events, and can also publish events back to the server.

```typescript
// ./client.ts
import { HttpClientToolTransport } from '@isdk/tool-rpc';
import { EventClient, SseClientPubSubTransport } from '@isdk/tool-event';

async function main() {
  const apiRoot = 'http://localhost:3000/api';

  // 1. Statically set the SSE transport on the EventClient class.
  EventClient.setPubSubTransport(new SseClientPubSubTransport());

  // 2. Use the standard HTTP transport to discover the remote tools.
  const httpTransport = new HttpClientToolTransport(apiRoot);
  await httpTransport.mount(EventClient);

  // 3. Get the dynamically created proxy for the remote 'event' tool.
  const eventClient = EventClient.get('event');
  if (!eventClient) {
    throw new Error('Remote event tool not found!');
  }

  // 4. Listen for the 'server-time' event on the client's local event bus.
  eventClient.on('server-time', (data) => {
    console.log(`[Client] Received 'server-time' event:`, data);
  });

  // 5. Subscribe to the 'server-time' event from the server.
  // This will open the SSE connection.
  console.log("[Client] Subscribing to 'server-time'...");
  await eventClient.subscribe('server-time');
  console.log('✅ [Client] Subscribed successfully!');

  // 6. Demonstrate publishing an event FROM the client TO the server.
  setTimeout(() => {
    const message = { text: 'Hello from the client!' };
    console.log('\n[Client] Publishing "client-greeting":', message);
    eventClient.publish({ event: 'client-greeting', data: message });
  }, 5000);
}

main();
```

### Step 3: Run the Example

1. Run the server: `ts-node ./server.ts`
2. In a new terminal, run the client: `ts-node ./client.ts`

You will see the client receive time updates from the server every 3 seconds.

## Core Concepts: The Design Philosophy

To fully grasp `EventServer` and `EventClient`, it's crucial to understand their design goal: **to seamlessly integrate real-time events into the existing RPC/RESTful architecture of `@isdk/tool-rpc`**. They are more than just event handlers; they are intelligent bridges connecting local events to the remote world.

### 1. Why Inherit from `ResServerTools` / `ResClientTools`?

This core design decision provides several major benefits by extending a familiar framework rather than reinventing the wheel:

- **Unified Discovery and Client Proxying**: Because `EventServer` is a standard `ResServerTools`, the `HttpClientToolTransport` can automatically discover it and dynamically create a full-featured `EventClient` proxy on the client-side. You don't need to write any special client configuration for event handling.

- **Unified API Invocation**: Actions like subscribing, unsubscribing, and publishing are cleverly mapped to standard RPC calls.
  - `eventClient.subscribe(...)` becomes an RPC call (`act: '$sub'`) to the server behind the scenes.
  - `eventClient.publish(...)` is likewise an RPC call (`act: '$publish'`).
  This means developers can interact with the event system in the exact same way they interact with other tools in the project, dramatically reducing the learning curve.

- **Transport Reuse**: The entire transport and middleware ecosystem of `@isdk/tool-rpc` is reused out-of-the-box.

### 2. The Event Stream as a "Resource"

The library elegantly abstracts a stateful, persistent connection (like SSE) into a stateless, REST-style "resource."

- **Getting the Event Stream**: When a client needs to subscribe to an event for the first time, the `EventClient` makes a request to `GET /api/event` (which is the `list` method of the `EventServer`). The response to this request is a persistent stream of type `text/event-stream`. Conceptually, this is equivalent to "getting" a resource that represents the real-time event flow.

- **Managing the Event Stream**: Subsequent actions like `subscribe` and `publish` can be seen as modifications to the state of this "resource," and they are handled through separate, conventional RPC requests.

This design simplifies the complexity of real-time connection management into a clean REST/RPC model that developers are already very familiar with.

### 3. The Role as a "Bridge"

The core function of `EventServer` and `EventClient` is to act as a **bridge**:

- **`EventServer`** is the bridge between the **internal server-side event bus** and **networked clients**.
  - **Outbound**: Through the `forward()` method, it listens to internal events (e.g., a database update) and "publishes" them over the network for all subscribed clients to receive.
  - **Inbound**: It receives events "published" from clients and, via the `autoInjectToLocalBus` option, selectively "emits" them (prefixed with `client:`) onto the internal event bus for other parts of the server to process.

- **`EventClient`** is the bridge between the **network** and the **client application's local event bus**.
  - **Inbound**: It listens for events pushed from the server over the network and "emits" them on its own instance (which is itself an `EventEmitter`). This allows your application code to consume them easily with `eventClient.on(...)`.
  - **Outbound**: Through the `publish()` or `forwardEvent()` methods, it "publishes" local client-side events over the network to the server.

In summary, this design allows developers to ignore the complex details of network protocols and connection management most of the time. You simply listen for or emit events on the appropriate event bus, and `@isdk/tool-event` handles all the tedious work in between.

## 🚀 Advanced Usage

### 1. Handling Client-Published Events on the Server

By default, for security, events published from a client do not trigger on the server's event bus. To enable this, set `EventServer.autoInjectToLocalBus = true`. You can then listen for events prefixed with `client:`.

**Server-Side (`server.ts`):**

```typescript
import { event } from '@isdk/tool-event'; // Import the underlying event tool
const eventBus = event.runSync(); // Get the event bus instance

// ... in your server startup code ...

// Enable auto-injection
EventServer.autoInjectToLocalBus = true;

// Listen for the 'client-greeting' event from any client
eventBus.on('client:client-greeting', function(data, ctx) {
  // 'this' is the event object, 'ctx' contains metadata
  const senderId = ctx.sender?.clientId;
  console.log(`[Server] Received greeting from client ${senderId}:`, data);

  // As a response, echo back a private event only to the sender
  EventServer.publish('private-reply', { message: 'I got your message!' }, {
    clientId: senderId,
  });
});
```

When the client from the Quick Start sends its `client-greeting` event, the server will now log it and send a private reply back to that specific client.

### 2. Publishing to a Specific Client (Targeted Publishing)

Instead of broadcasting to all subscribers, you can send an event to a specific user by providing their `clientId` in the `publish` method.

**Client-Side (`client.ts`):**

```typescript
// ... in your main function ...

// Subscribe to a private event
eventClient.subscribe('private-reply');

// Listen for it
eventClient.on('private-reply', (data) => {
  console.log(`[Client] Received a private reply:`, data);
});
```

This setup creates a request-response pattern where a client initiates a public event, and the server responds with a private event that only the originating client receives.

### 3. Dynamic Subscriptions

A client can change its subscriptions at any time, not just on initial connection, by calling `subscribe` or `unsubscribe`. This is useful for scenarios like allowing users to dynamically join or leave "rooms" or "channels".

```typescript
// client.ts

// ... assuming eventClient is already initialized ...

async function manageSubscriptions() {
  console.log('Subscribing to the "news" channel...');
  await eventClient.subscribe('news');

  // Simulate losing interest in "news" after a while
  setTimeout(async () => {
    console.log('Unsubscribing from the "news" channel...');
    await eventClient.unsubscribe('news');
  }, 10000);
}
```

### 4. Client-Side Event Forwarding

The `forwardEvent` method is a powerful way to seamlessly sync local client-side activity to the server. Imagine your client application has its own internal event bus for UI interactions. You can selectively forward certain events to the server for processing or broadcasting.

```typescript
// client.ts

// ... assuming eventClient is initialized and is eventable ...

// Let's say 'ui-event-bus' is a local EventEmitter used in your app.
// For demonstration, we'll have the eventClient play this role.
const localEventBus = eventClient;

// 1. Configure forwarding: any 'user-action' emitted on localEventBus will be sent to the server.
eventClient.forwardEvent('user-action');

console.log('[Client] Set up forwarding for "user-action" events.');

// 2. Simulate a local UI event
setTimeout(() => {
  const actionData = { action: 'button-click', elementId: 'save-button' };
  console.log('[Client] Emitting "user-action" on local bus:', actionData);
  localEventBus.emit('user-action', actionData);
}, 2000);

// On the server, you can now handle 'client:user-action' just like any other client-published event.
```

This pattern is excellent for syncing client behaviors (like analytics, logging, or state changes) to a backend without needing to write manual `publish` calls at every event site.

### 5. Implementing and Using Pluggable Transports

One of the library's core strengths is its pluggable transport layer. While it ships with an SSE implementation, you can easily create and swap in your own (e.g., based on WebSockets or IPC).

To do this, you need to implement the `IPubSubServerTransport` interface. Here is a conceptual skeleton example for a transport based on `ws`, a popular WebSocket library:

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
      const clientId = uuid(); // Generate a unique ID
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
        // Invoke the callback registered by EventServer to handle inbound messages
        this.onMsg?.(session, event, data);
      });

      ws.on('close', () => {
        this.sessions.delete(clientId);
      });
    });
  }

  // EventServer will call this to register its message handler
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

  // Note: For WebSockets, connect/subscribe/unsubscribe are often handled
  // within the connection and message events, so these might be no-ops or for logging.
  connect(options) { /* ... */ }
  subscribe(session, events) { /* ... */ }
  unsubscribe(session, events) { /* ... */ }
  onConnection(cb) { /* ... */ }
  onDisconnect(cb) { /* ... */ }
}
```

**How to use it:**

You would simply replace the transport on your `EventServer` during startup.

```typescript
// server.ts
// import { SseServerPubSubTransport } from '@isdk/tool-event'; // Old
import { WebSocketServerTransport } from './transports/WebSocketServerTransport'; // New

// ...

// const sseTransport = new SseServerPubSubTransport(); // Old
const wsTransport = new WebSocketServerTransport({ port: 8080 }); // New

// EventServer.setPubSubTransport(sseTransport); // Old
EventServer.setPubSubTransport(wsTransport); // New

// ... the rest of your code remains the same
```

This way, your core business logic in `EventServer` remains completely decoupled from the underlying communication protocol.

## 🤝 Contributing

Contributions are welcome! Please read the [CONTRIBUTING.md](_media/CONTRIBUTING.md) file for guidelines on how to get started.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE-MIT](_media/LICENSE-MIT) file for more details.
