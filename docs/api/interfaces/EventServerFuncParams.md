[**@isdk/tool-event**](../README.md)

***

[@isdk/tool-event](../globals.md) / EventServerFuncParams

# Interface: EventServerFuncParams

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:14](https://github.com/isdk/tool-event.js/blob/97bf967d51a335edb0e7c9a65ca0ff8d5609ccf9/src/event-server.ts#L14)

## Extends

- `ServerFuncParams`

## Indexable

\[`name`: `string`\]: `any`

## Properties

### \_req?

> `optional` **\_req**: `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bh16e\_Wg.d.ts:236

The underlying request object from the transport layer (e.g., `IncomingMessage`).

#### Inherited from

`ServerFuncParams._req`

***

### \_res?

> `optional` **\_res**: `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bh16e\_Wg.d.ts:241

The underlying response or reply object from the transport layer (e.g., `ServerResponse`).

#### Inherited from

`ServerFuncParams._res`

***

### act?

> `optional` **act**: `"sub"` \| `"pub"` \| `"unsub"`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:17](https://github.com/isdk/tool-event.js/blob/97bf967d51a335edb0e7c9a65ca0ff8d5609ccf9/src/event-server.ts#L17)

***

### clientId?

> `optional` **clientId**: `string`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:18](https://github.com/isdk/tool-event.js/blob/97bf967d51a335edb0e7c9a65ca0ff8d5609ccf9/src/event-server.ts#L18)

***

### data?

> `optional` **data**: `any`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:16](https://github.com/isdk/tool-event.js/blob/97bf967d51a335edb0e7c9a65ca0ff8d5609ccf9/src/event-server.ts#L16)

***

### event?

> `optional` **event**: `string` \| `string`[]

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:15](https://github.com/isdk/tool-event.js/blob/97bf967d51a335edb0e7c9a65ca0ff8d5609ccf9/src/event-server.ts#L15)
