[**@isdk/tool-event**](../README.md)

***

[@isdk/tool-event](../globals.md) / SSEClient

# Type Alias: SSEClient

> **SSEClient** = `object`

Defined in: [@isdk/ai-tools/packages/tool-event/src/utils/sse-channel.ts:10](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/utils/sse-channel.ts#L10)

Represents a client connected to the SSE channel.

## Properties

### clientId

> **clientId**: `string`

Defined in: [@isdk/ai-tools/packages/tool-event/src/utils/sse-channel.ts:20](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/utils/sse-channel.ts#L20)

A unique identifier for the client.

***

### events?

> `optional` **events?**: `Events`

Defined in: [@isdk/ai-tools/packages/tool-event/src/utils/sse-channel.ts:16](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/utils/sse-channel.ts#L16)

An array of event names or patterns that the client is subscribed to.

***

### req

> **req**: `IncomingMessage`

Defined in: [@isdk/ai-tools/packages/tool-event/src/utils/sse-channel.ts:12](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/utils/sse-channel.ts#L12)

The incoming HTTP request from the client.

***

### res

> **res**: `ServerResponse`

Defined in: [@isdk/ai-tools/packages/tool-event/src/utils/sse-channel.ts:14](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/utils/sse-channel.ts#L14)

The server response object used to send events to the client.
