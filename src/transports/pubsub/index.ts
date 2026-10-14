export * from './base'
export * from './close'
export * from './client'
export * from './server'
export * from './sse-server'
export * from './sse-client'

// Same class the transports use, under its own name: `eventsource` is a peer
// dependency and is environment-agnostic, so the Node entry exposes exactly what
// the browser entry does. Node has no built-in `EventSource` at all, which is
// why the package — not a global — is the single source of the class.
export { EventSource } from 'eventsource'
