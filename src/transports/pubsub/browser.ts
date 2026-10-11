/**
 * Browser-safe barrel entry for transports/pubsub.
 *
 * Excludes Node.js-only modules (sse-server) so this can be safely
 * imported in browser environments without pulling in the `http` module.
 */
export * from './base'
export * from './client'
export * from './server'
export * from './sse-client'

// The `EventSource` this transport uses: the `eventsource` package, declared as
// a peer dependency (https://github.com/EventSource/eventsource). It is
// environment-agnostic — `fetch` + `eventsource-parser`, no Node-only APIs — so
// there is nothing to polyfill and nothing to install on `globalThis.EventSource`;
// the browser and Node paths run the identical class. It is re-exported here
// rather than relied on as the browser's built-in `EventSource`, because a
// built-in one dispatches messages internally and never reaches the JS-visible
// `dispatchEvent` that regex subscriptions are matched in. No alias: the class
// is the same in every environment, so it keeps its own name.
export { EventSource } from 'eventsource'
