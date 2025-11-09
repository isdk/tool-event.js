[**@isdk/tool-event**](../README.md)

***

[@isdk/tool-event](../globals.md) / SSEClient

# Type Alias: SSEClient

> **SSEClient** = `object`

Defined in: [@isdk/ai-tools/packages/tool-event/src/utils/sse-channel.ts:10](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/utils/sse-channel.ts#L10)

Represents a client connected to the SSE channel.

## Properties

### clientId

> **clientId**: `string`

Defined in: [@isdk/ai-tools/packages/tool-event/src/utils/sse-channel.ts:20](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/utils/sse-channel.ts#L20)

A unique identifier for the client.

***

### events?

> `optional` **events**: `Events`

Defined in: [@isdk/ai-tools/packages/tool-event/src/utils/sse-channel.ts:16](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/utils/sse-channel.ts#L16)

An array of event names or patterns that the client is subscribed to.

***

### req

> **req**: `IncomingMessage`

Defined in: [@isdk/ai-tools/packages/tool-event/src/utils/sse-channel.ts:12](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/utils/sse-channel.ts#L12)

The incoming HTTP request from the client.

***

### res

> **res**: `ServerResponse`

Defined in: [@isdk/ai-tools/packages/tool-event/src/utils/sse-channel.ts:14](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/utils/sse-channel.ts#L14)

The server response object used to send events to the client.
