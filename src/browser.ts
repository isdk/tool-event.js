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
 * - SSE client transport (uses native EventSource API)
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

// SSE client transport (uses native browser EventSource API)
export { SseClientPubSubTransport } from './transports/pubsub/sse-client';

// URL params utility
export { genUrlParamsStr } from './transports/pubsub/gen-url-params';
