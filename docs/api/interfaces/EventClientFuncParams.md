[**@isdk/tool-event**](../README.md)

***

[@isdk/tool-event](../globals.md) / EventClientFuncParams

# Interface: EventClientFuncParams

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:8](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L8)

## Properties

### act?

> `optional` **act**: `"sub"` \| `"pub"` \| `"unsub"` \| `"init"`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:11](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L11)

***

### data?

> `optional` **data**: `any`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:10](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L10)

***

### event?

> `optional` **event**: `string` \| `string`[]

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:9](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L9)

***

### listener()?

> `optional` **listener**: (...`args`) => `void`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:12](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L12)

#### Parameters

##### args

...`any`[]

#### Returns

`void`
