/**
 * Browser entry point for @isdk/tool-event.
 *
 * This module exports only browser-safe components, excluding Node.js-specific
 * modules such as SSEChannel (http), SseServerPubSubTransport, etc.
 *
 * Use this entry when bundling for browser environments (webpack, vite, rollup, etc.).
 *
 * Browser-safe exports:
 * - Event bus singleton and utilities
 * - EventClient (PubSub/SSE client for browser)
 * - Abstract EventServer class (framework-agnostic, transport-agnostic)
 * - SSE client transport (uses the `eventsource` peer dependency)
 * - `EventSource` from the `eventsource` peer dependency (required for regex
 *   subscriptions — a built-in `EventSource` never reaches `dispatchEvent`)
 * - PubSub type definitions
 */

// Base utilities (excluding sse-channel which is Node.js-only)
export {
  EventEmitter,
  eventable,
  EventStates,
  wrapEventEmitter,
  EventName,
  EventBusName,
  backendEventable,
} from './utils/event-ability';

// Event bus singleton
export { EventToolFunc, event } from './event';

// Event client (browser-safe)
export { EventClient, eventClient, type EventClientFuncParams } from './event-client';

// Abstract EventServer (framework-agnostic, does not import Node.js modules directly)
// The singleton `eventServer` instance is also exported as it is just a class instance
// that requires a transport to be set before use.
export { EventServer, eventServer, type EventServerFuncParams, ClientEventPrefix } from './event-server';

// PubSub transport type definitions (interfaces only, no Node.js implementation)
export type {
  PubSubCtx,
  PubSubClientStream,
  IPubSubClientTransport,
  IPubSubServerTransport,
  PubSubServerSession,
  PubSubClientId,
} from './transports/pubsub';

// SSE client transport (uses the `eventsource` peer dependency)
export { SseClientPubSubTransport } from './transports/pubsub/sse-client';

// The `EventSource` the transport uses (the `eventsource` peer dependency —
// environment-agnostic, so no global install). Re-exported from the browser
// barrel, not from the Node one, which would pull `http` into this bundle.
export { EventSource } from './transports/pubsub/browser';

// URL params utility
export { genUrlParamsStr } from './transports/pubsub/gen-url-params';

// Event pattern utilities (browser-safe)
export {
  normalizeEventPattern,
  toEventMatcher,
  eventPatternKey,
} from './utils/event-pattern';

// SSE payload decoding (browser-safe)
export { parseEventData } from './utils/sse-payload';
