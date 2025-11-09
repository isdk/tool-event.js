[**@isdk/tool-event**](../README.md)

***

[@isdk/tool-event](../globals.md) / EventClient

# Class: EventClient

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:15](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L15)

## Extends

- `ResClientTools`

## Indexable

\[`name`: `string`\]: `any`

## Constructors

### Constructor

> **new EventClient**(`name`, `options?`): `EventClient`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:521

Initializes a new `ToolFunc` instance.

#### Parameters

##### name

Can be a function name, a function implementation, or a configuration object.

`string` | `Function` | `FuncItem`

##### options?

`any`

Configuration options if not provided in the first argument.

#### Returns

`EventClient`

#### Inherited from

`ResClientTools.constructor`

## Properties

### \_forwardEvents

> **\_forwardEvents**: `Set`\<`string`\>

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:34](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L34)

***

### \_sseListeners

> **\_sseListeners**: `Record`\<`string`, (`data`, `ctx?`) => `void`\> = `{}`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:33](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L33)

***

### \_stream

> **\_stream**: `undefined` \| [`PubSubClientStream`](../interfaces/PubSubClientStream.md)

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:30](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L30)

***

### \_streamEvents

> **\_streamEvents**: `undefined` \| `string`[]

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:31](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L31)

***

### $attributes

> **$attributes**: `Properties`

Defined in: [property-manager.js/src/advance.d.ts:5](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/advance.d.ts#L5)

#### Inherited from

`ResClientTools.$attributes`

***

### action?

> `optional` **action**: `"res"` \| `"get"` \| `"post"` \| `"put"` \| `"delete"` \| `"list"` \| `"patch"`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bh16e\_Wg.d.ts:60

The action to be used for the remote call. This typically represents an RPC method name.
Only for RESTful HTTP transports, it might be mapped to a standard HTTP method (e.g., GET, POST)

#### Inherited from

`ResClientTools.action`

***

### alias?

> `optional` **alias**: `string` \| `string`[]

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:232

Optional aliases for the function name.

#### Inherited from

`ResClientTools.alias`

***

### asyncFeatures?

> `optional` **asyncFeatures**: `number`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:246

A bitmask representing asynchronous features supported by the function, built from `AsyncFeatureBits`.
This allows the system to understand if a function supports capabilities like cancellation or multi-tasking.

#### See

AsyncFeatureBits from `@src/utils/cancelable-ability.ts`

#### Example

```ts
import { AsyncFeatures } from './utils';
const func = new ToolFunc({
  name: 'cancellableTask',
  asyncFeatures: AsyncFeatures.Cancelable | AsyncFeatures.MultiTask,
  // ...
});
```

#### Inherited from

`ResClientTools.asyncFeatures`

***

### constructor

> **constructor**: `Function`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:125

The initial value of Object.prototype.constructor is the standard built-in Object constructor.

#### Inherited from

`ResClientTools.constructor`

***

### defaultOptions

> **defaultOptions**: `object`

Defined in: [property-manager.js/src/abstract.d.ts:74](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L74)

The default options for export and assign

#### assign?

> `optional` **assign**: `IMergeOptions`

#### export?

> `optional` **export**: `IMergeOptions`

#### Inherited from

`ResClientTools.defaultOptions`

***

### depends?

> `optional` **depends**: `object`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:269

A map of dependencies this function has on other tool functions.
Declaring dependencies ensures that they are automatically registered when this function is registered.
This is crucial for building modular functions that rely on each other without needing to manage registration order manually.

#### Index Signature

\[`name`: `string`\]: `ToolFunc`

#### Example

```ts
const helperFunc = new ToolFunc({ name: 'helper', func: () => 'world' });
const mainFunc = new ToolFunc({
  name: 'main',
  depends: {
    helper: helperFunc,
  },
  func() {
    // We can now safely run the dependency
    const result = this.runSync('helper');
    return `Hello, ${result}`;
  }
});
// When mainFunc is registered, helperFunc will be registered automatically.
mainFunc.register();
```

#### Inherited from

`ResClientTools.depends`

***

### description

> **description**: `string` = `'subscribe server event'`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:62](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L62)

A detailed description of what the function does.

#### Overrides

`ResClientTools.description`

***

### ebListener()

> **ebListener**: (`this`, ...`args`) => `Promise`\<`void`\>

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:102](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L102)

#### Parameters

##### this

`Event`

##### args

...`any`[]

#### Returns

`Promise`\<`void`\>

***

### fetchOptions?

> `optional` **fetchOptions**: `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bh16e\_Wg.d.ts:65

Addtional options to be passed to the underlying `fetch` call in a transport.

#### Inherited from

`ResClientTools.fetchOptions`

***

### isApi?

> `optional` **isApi**: `boolean`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:221

If true, indicates that this function should be treated as a server-side API.

#### Inherited from

`ResClientTools.isApi`

***

### name?

> `optional` **name**: `string`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:178

The unique name of the function.

#### Inherited from

`ResClientTools.name`

***

### nonExported1stChar

> **nonExported1stChar**: `string`

Defined in: [property-manager.js/src/abstract.d.ts:78](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L78)

the property with the default prefix '$' will not be exported.

#### Inherited from

`ResClientTools.nonExported1stChar`

***

### params?

> `optional` **params**: `FuncParams` \| `FuncParam`[]

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:183

Parameter definitions, which can be an object mapping names to definitions or an array for positional parameters.

#### Inherited from

`ResClientTools.params`

***

### result?

> `optional` **result**: `string` \| `Record`\<`string`, `any`\>

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:188

The expected return type of the function, described as a string or a JSON schema object.

#### Inherited from

`ResClientTools.result`

***

### scope?

> `optional` **scope**: `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:193

The execution scope or context (`this`) for the function.

#### Inherited from

`ResClientTools.scope`

***

### setup()?

> `optional` **setup**: (`this`, `options?`) => `void`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:216

A lifecycle hook called once during the `ToolFunc` instance's initialization.
It allows for initial setup, state configuration, or property modification on the instance
before it is used or registered. The `this` context is the `ToolFunc` instance itself.

#### Parameters

##### this

`ToolFunc`

##### options?

`FuncItem`

The configuration options for the function.

#### Returns

`void`

#### Example

```ts
const myFunc = new ToolFunc({
  name: 'myFunc',
  customState: 'initial',
  setup() {
    // `this` is the myFunc instance
    this.customState = 'configured';
  }
});
console.log(myFunc.customState); // Outputs: 'configured'
```

#### Inherited from

`ResClientTools.setup`

***

### stream?

> `optional` **stream**: `boolean`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:227

If true, indicates that the function has the *capability* to stream its output.
Whether a specific call is streamed is determined by a `stream` property in the runtime parameters.

#### Inherited from

`ResClientTools.stream`

***

### tags?

> `optional` **tags**: `string` \| `string`[]

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:198

Tags for grouping or filtering functions.

#### Inherited from

`ResClientTools.tags`

***

### title?

> `optional` **title**: `string`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:281

A concise, human-readable title for the function, often used in UI or by AI.

#### Inherited from

`ResClientTools.title`

***

### \_pubSubTransport

> `static` **\_pubSubTransport**: `undefined` \| [`IPubSubClientTransport`](../interfaces/IPubSubClientTransport.md)

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:16](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L16)

***

### action?

> `static` `optional` **action**: `string`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bh16e\_Wg.d.ts:166

#### Inherited from

`ResClientTools.action`

***

### aliases

> `static` **aliases**: `object`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:403

A static map of aliases to their corresponding function names.

#### Index Signature

\[`name`: `string`\]: `string`

#### Inherited from

`ResClientTools.aliases`

***

### dataPath

> `static` **dataPath**: `string`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:412

A conventional property to designate a file path for saving the registered `ToolFunc` data.
Note: The `ToolFunc` class itself does not implement persistence logic. It is up to the
developer to use this path to save and load the `ToolFunc.items` registry if needed.

#### Inherited from

`ResClientTools.dataPath`

***

### items

> `static` **items**: `Funcs`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:398

A static registry of all `ToolFunc` instances, indexed by name.

#### Inherited from

`ResClientTools.items`

## Accessors

### active

#### Get Signature

> **get** **active**(): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:48](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L48)

##### Returns

`boolean`

***

### apiRoot

#### Get Signature

> **get** **apiRoot**(): `string`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bh16e\_Wg.d.ts:196

Gets the root URL for API endpoints from the configured transport.
This is used as the base for constructing request URLs.

##### Returns

`string`

#### Inherited from

`ResClientTools.apiRoot`

***

### clientId

#### Get Signature

> **get** **clientId**(): `undefined` \| `string`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:36](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L36)

##### Returns

`undefined` \| `string`

***

### apiRoot

#### Get Signature

> **get** `static` **apiRoot**(): `string`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bh16e\_Wg.d.ts:172

Gets the root URL for API endpoints from the configured transport.
This is used as the base for constructing request URLs.

##### Returns

`string`

#### Inherited from

`ResClientTools.apiRoot`

***

### pubSubTransport

#### Get Signature

> **get** `static` **pubSubTransport**(): [`IPubSubClientTransport`](../interfaces/IPubSubClientTransport.md)

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:25](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L25)

##### Returns

[`IPubSubClientTransport`](../interfaces/IPubSubClientTransport.md)

***

### transport

#### Get Signature

> **get** `static` **transport**(): `IClientToolTransport`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bh16e\_Wg.d.ts:179

##### Returns

`IClientToolTransport`

#### Inherited from

`ResClientTools.transport`

## Methods

### \_func()

> **\_func**(`action`, `options`, `fetchOptions?`): `Promise`\<`any`\>

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index.d.ts:13

#### Parameters

##### action

`"res"` | `"get"` | `"post"` | `"put"` | `"delete"` | `"list"` | `"patch"`

##### options

`RpcMethodsClientFuncParams`

##### fetchOptions?

`any`

#### Returns

`Promise`\<`any`\>

#### Inherited from

`ResClientTools._func`

***

### arr2ObjParams()

> **arr2ObjParams**(`params`): `any`[]

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:539

Converts an array of positional arguments into a named parameters object.
This is used internally to support functions defined with named parameters.

#### Parameters

##### params

`any`[]

An array of positional arguments.

#### Returns

`any`[]

An array containing a single parameters object.

#### Inherited from

`ResClientTools.arr2ObjParams`

***

### assign()

> **assign**(`src`, `options?`): `this`

Defined in: [property-manager.js/src/abstract.d.ts:106](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L106)

Assign the values from the src object.

#### Parameters

##### src

`any`

the source object

##### options?

`IMergeOptions`

#### Returns

`this`

this object

#### Inherited from

`ResClientTools.assign`

***

### assignMethods()

> **assignMethods**(`methods`): `void`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index.d.ts:15

#### Parameters

##### methods

`string`[]

#### Returns

`void`

#### Inherited from

`ResClientTools.assignMethods`

***

### assignProperty()

> **assignProperty**(`src`, `name`, `value`, `attrs?`, `options?`): `void`

Defined in: [property-manager.js/src/abstract.d.ts:117](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L117)

Assign a property of src to this object.

#### Parameters

##### src

`any`

the src object

##### name

`string`

the property name to assign

##### value

`any`

the property value to assign

##### attrs?

`any`

the attributes object

##### options?

`IMergeOptions`

#### Returns

`void`

#### Inherited from

`ResClientTools.assignProperty`

***

### assignPropertyTo()

> `abstract` **assignPropertyTo**(`dest`, `src`, `name`, `value`, `attrs?`, `options?`): `void`

Defined in: [property-manager.js/src/abstract.d.ts:131](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L131)

Assign the property value from the src to destination object.

#### Parameters

##### dest

`any`

The destination object

##### src

`any`

The src object

##### name

`string`

The property name

##### value

`any`

The property value

##### attrs?

`any`

The attributes object of the property

##### options?

`IMergeOptions`

#### Returns

`void`

#### Inherited from

`ResClientTools.assignPropertyTo`

***

### assignTo()

> **assignTo**(`dest?`, `options?`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:191](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L191)

Assign this attributes to the dest object

#### Parameters

##### dest?

`any`

the destination object

##### options?

`IMergeOptions`

#### Returns

`any`

the dest object

#### Inherited from

`ResClientTools.assignTo`

***

### clone()

> **clone**(`options?`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:155](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L155)

Create a new object with the same values of attributes.

#### Parameters

##### options?

`IMergeOptions`

#### Returns

`any`

the new object

#### Inherited from

`ResClientTools.clone`

***

### cloneTo()

> **cloneTo**(`dest`, `options?`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:148](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L148)

Create and assign the values to the destination object.

#### Parameters

##### dest

`any`

the destination object

##### options?

`IMergeOptions`

#### Returns

`any`

the new dest object

#### Inherited from

`ResClientTools.cloneTo`

***

### close()

> **close**(): `void`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:212](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L212)

#### Returns

`void`

***

### defineProperties()

> `abstract` **defineProperties**(`aProperties`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:89](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L89)

Define the attributes of this object.

#### Parameters

##### aProperties

`SimplePropDescriptors`

the defined attributes of the object

#### Returns

`any`

#### Inherited from

`ResClientTools.defineProperties`

***

### delete()?

> `optional` **delete**(`__namedParameters`): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index.d.ts:54

#### Parameters

##### \_\_namedParameters

`ResClientFuncParams`

#### Returns

`any`

#### Inherited from

`ResClientTools.delete`

***

### esListener()

> **esListener**(`evtType`, `data`, `ctx?`): `void`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:91](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L91)

#### Parameters

##### evtType

`string`

##### data

`any`

##### ctx?

[`PubSubCtx`](../type-aliases/PubSubCtx.md)

#### Returns

`void`

***

### exportTo()

> **exportTo**(`dest`, `options?`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:173](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L173)

Export attributes to the dest json object.

#### Parameters

##### dest

`any`

the destination object

##### options?

`IExportOptions`

#### Returns

`any`

the dest object.

#### Inherited from

`ResClientTools.exportTo`

***

### fetch()

> **fetch**(`options`, `action`, ...`args`): `Promise`\<`any`\>

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index.d.ts:58

#### Parameters

##### options

`ResClientFuncParams`

##### action

`"res"` | `"get"` | `"post"` | `"put"` | `"delete"` | `"list"` | `"patch"`

##### args

...`any`[]

#### Returns

`Promise`\<`any`\>

#### Inherited from

`ResClientTools.fetch`

***

### forwardEvent()

> **forwardEvent**(`events`): `void`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:173](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L173)

forward local event(s) to server

subscribe these local events to forward/publish to server

Note: pls backendEventable(ClientTools or EventClient) first

#### Parameters

##### events

`string` | `string`[]

#### Returns

`void`

***

### func()

> **func**(`options`): `Promise`\<`any`\>

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index.d.ts:14

The core implementation for a client-side tool. When a `ClientTools` instance
is "run", this `func` method is executed. It delegates the call to the
configured transport, which handles the network communication.

#### Parameters

##### options

`RpcMethodsClientFuncParams`

#### Returns

`Promise`\<`any`\>

The result from the remote tool.

#### Inherited from

`ResClientTools.func`

***

### get()?

> `optional` **get**(`__namedParameters`): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index.d.ts:51

#### Parameters

##### \_\_namedParameters

`ResClientFuncParams`

#### Returns

`any`

#### Inherited from

`ResClientTools.get`

***

### getEvtSource()

> **getEvtSource**(): `Promise`\<[`PubSubClientStream`](../interfaces/PubSubClientStream.md)\>

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:40](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L40)

#### Returns

`Promise`\<[`PubSubClientStream`](../interfaces/PubSubClientStream.md)\>

***

### getFunc()

> **getFunc**(`name?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:583

Gets a bound function reference for execution with named parameters.
If a name is provided, it retrieves a different function from the registry.
Otherwise, it returns a bound version of this instance's `runSync`.

#### Parameters

##### name?

`string`

Optional name of the function to retrieve.

#### Returns

`any`

A function reference or `undefined` if not found.

#### Inherited from

`ResClientTools.getFunc`

***

### getFuncWithPos()

> **getFuncWithPos**(`name?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:621

Gets a bound function reference suitable for positional argument execution.
If a name is provided, it retrieves a different function from the registry.
Otherwise, it returns a bound version of this instance's `runWithPosSync`.

#### Parameters

##### name?

`string`

Optional name of the function to retrieve.

#### Returns

`any`

A function reference or `undefined` if not found.

#### Inherited from

`ResClientTools.getFuncWithPos`

***

### getProperties()

> `abstract` **getProperties**(): `PropDescriptors`

Defined in: [property-manager.js/src/abstract.d.ts:98](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L98)

Get the defined attributes.

#### Returns

`PropDescriptors`

the descriptors of properties object

#### Inherited from

`ResClientTools.getProperties`

***

### hasAsyncFeature()

> **hasAsyncFeature**(`feature`): `boolean`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:627

Checks if the current function instance supports a specific async feature.

#### Parameters

##### feature

`AsyncFeatureBits`

The async feature bit to check for.

#### Returns

`boolean`

`true` if the feature is supported, otherwise `false`.

#### Inherited from

`ResClientTools.hasAsyncFeature`

***

### hasOwnProperty()

> **hasOwnProperty**(`v`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:140

Determines whether an object has a property with the specified name.

#### Parameters

##### v

`PropertyKey`

A property name.

#### Returns

`boolean`

#### Inherited from

`ResClientTools.hasOwnProperty`

***

### init()

> **init**(`events`): `Promise`\<`any`\>

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:205](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L205)

#### Parameters

##### events

`string` | `string`[]

#### Returns

`Promise`\<`any`\>

***

### initEventStream()

> **initEventStream**(`events?`): `Promise`\<[`PubSubClientStream`](../interfaces/PubSubClientStream.md)\>

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:64](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L64)

#### Parameters

##### events?

`string` | `string`[]

#### Returns

`Promise`\<[`PubSubClientStream`](../interfaces/PubSubClientStream.md)\>

***

### initialize()

> **initialize**(`src?`): `this`

Defined in: [property-manager.js/src/abstract.d.ts:139](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L139)

Initialize object and assign attribute values from src if src exists.

#### Parameters

##### src?

`any`

#### Returns

`this`

this object.

#### Inherited from

`ResClientTools.initialize`

***

### isPrototypeOf()

> **isPrototypeOf**(`v`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:146

Determines whether an object exists in another object's prototype chain.

#### Parameters

##### v

`Object`

Another object whose prototype chain is to be checked.

#### Returns

`boolean`

#### Inherited from

`ResClientTools.isPrototypeOf`

***

### isSame()

> **isSame**(`src`, `options?`): `boolean`

Defined in: [property-manager.js/src/abstract.d.ts:200](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L200)

Check the src object whether “equals” this object.

#### Parameters

##### src

`any`

The source object

##### options?

`IMergeOptions`

#### Returns

`boolean`

#### Inherited from

`ResClientTools.isSame`

***

### isStream()

> **isStream**(`params`): `undefined` \| `boolean`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:640

Determines if a function call should produce a stream.

The logic is as follows:
1. It first checks if the function is generally capable of streaming (`this.stream`).
2. If it is, it then checks if a `stream` parameter is formally declared in the function's `params` definition.
3. If both are true, the method returns the value of the `stream` property from the runtime `params` object.
Otherwise, it returns the function's static `stream` capability.

#### Parameters

##### params

`any`

The runtime parameters passed to the function call.

#### Returns

`undefined` \| `boolean`

`true` if the call should be streamed, `false` or `undefined` otherwise.

#### Inherited from

`ResClientTools.isStream`

***

### list()?

> `optional` **list**(`options?`): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index.d.ts:55

#### Parameters

##### options?

`ResClientFuncParams`

#### Returns

`any`

#### Inherited from

`ResClientTools.list`

***

### mergeTo()

> **mergeTo**(`dest`, `options?`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:164](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L164)

Merge this attributes to dest object.

#### Parameters

##### dest

`any`

The destination object

##### options?

`IMergeOptions`

#### Returns

`any`

the dest object.

#### Inherited from

`ResClientTools.mergeTo`

***

### obj2ArrParams()

> **obj2ArrParams**(`params?`): `any`[]

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:546

Converts a named parameters object into an array of positional arguments.
This is used for functions defined with positional parameters.

#### Parameters

##### params?

`any`

A named parameters object.

#### Returns

`any`[]

An array of positional arguments.

#### Inherited from

`ResClientTools.obj2ArrParams`

***

### post()?

> `optional` **post**(`options`): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index.d.ts:52

#### Parameters

##### options

`ResClientFuncParams`

#### Returns

`any`

#### Inherited from

`ResClientTools.post`

***

### propertyIsEnumerable()

> **propertyIsEnumerable**(`v`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:152

Determines whether a specified property is enumerable.

#### Parameters

##### v

`PropertyKey`

A property name.

#### Returns

`boolean`

#### Inherited from

`ResClientTools.propertyIsEnumerable`

***

### put()?

> `optional` **put**(`__namedParameters`): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index.d.ts:53

#### Parameters

##### \_\_namedParameters

`ResClientFuncParams`

#### Returns

`any`

#### Inherited from

`ResClientTools.put`

***

### register()

> **register**(): `boolean` \| `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:527

Registers the current `ToolFunc` instance into the static registry.
Also registers any declared dependencies.

#### Returns

`boolean` \| `ToolFunc`

The instance itself upon successful registration, or `false` if it already exists.

#### Inherited from

`ResClientTools.register`

***

### run()

> **run**(`params?`): `Promise`\<`any`\>

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:559

Executes the function asynchronously with a named parameters object.

#### Parameters

##### params?

`any`

The parameters object for the function.

#### Returns

`Promise`\<`any`\>

A promise that resolves with the function's result.

#### Inherited from

`ResClientTools.run`

***

### runAs()

> **runAs**(`name`, `params?`): `Promise`\<`any`\>

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:567

Asynchronously executes another registered function by name.
This method delegates to `runAsSync()` internally.

#### Parameters

##### name

`string`

The name of the target function to run.

##### params?

`any`

Optional parameters to pass to the function.

#### Returns

`Promise`\<`any`\>

A promise that resolves with the result of the function execution.

#### Inherited from

`ResClientTools.runAs`

***

### runAsSync()

> **runAsSync**(`name`, `params?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:575

Synchronously executes another registered function by name.
This is a convenience method that forwards the call to the static `runSync()` method.

#### Parameters

##### name

`string`

The name of the target function to run.

##### params?

`any`

Optional parameters to pass to the function.

#### Returns

`any`

The result of the function execution.

#### Inherited from

`ResClientTools.runAsSync`

***

### runSync()

> **runSync**(`params?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:553

Executes the function synchronously with a named parameters object.

#### Parameters

##### params?

`any`

The parameters object for the function.

#### Returns

`any`

The result of the function execution.

#### Throws

Will throw an error if an array of parameters is passed to a function that expects an object.

#### Inherited from

`ResClientTools.runSync`

***

### runWithPos()

> **runWithPos**(...`params`): `Promise`\<`any`\>

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:605

Executes the function asynchronously using positional arguments.
Delegates to `runWithPosSync()` internally.

#### Parameters

##### params

...`any`[]

Positional arguments passed to the function.

#### Returns

`Promise`\<`any`\>

A promise that resolves with the result of the function execution.

#### Inherited from

`ResClientTools.runWithPos`

***

### runWithPosAs()

> **runWithPosAs**(`name`, ...`params`): `Promise`\<`any`\>

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:613

Asynchronously executes another function by name using positional arguments.
Delegates to `runWithPosAsSync()` internally.

#### Parameters

##### name

`string`

The name of the target function to run.

##### params

...`any`[]

Positional arguments to pass to the function.

#### Returns

`Promise`\<`any`\>

A promise that resolves with the result of the function execution.

#### Inherited from

`ResClientTools.runWithPosAs`

***

### runWithPosAsSync()

> **runWithPosAsSync**(`name`, ...`params`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:598

Synchronously executes another function by name using positional arguments.
This is a convenience wrapper around the static `runWithPosSync()` method.

#### Parameters

##### name

`string`

The name of the target function to run.

##### params

...`any`[]

Positional arguments to pass to the function.

#### Returns

`any`

The result of the function execution.

#### Inherited from

`ResClientTools.runWithPosAsSync`

***

### runWithPosSync()

> **runWithPosSync**(...`params`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:590

Executes the function synchronously using positional arguments.
If the function expects named parameters, it converts the arguments automatically.

#### Parameters

##### params

...`any`[]

Positional arguments passed to the function.

#### Returns

`any`

The result of the function execution.

#### Inherited from

`ResClientTools.runWithPosSync`

***

### setActive()

> **setActive**(`v`): `Promise`\<`void`\>

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:52](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L52)

#### Parameters

##### v

`boolean`

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> **subscribe**(`events`): `Promise`\<`any`\>

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:127](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L127)

subscribe server event

#### Parameters

##### events

`string` | `string`[]

#### Returns

`Promise`\<`any`\>

***

### toJSON()

> **toJSON**(): `any`

Defined in: [property-manager.js/src/abstract.d.ts:182](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L182)

#### Returns

`any`

#### Inherited from

`ResClientTools.toJSON`

***

### toLocaleString()

> **toLocaleString**(): `string`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:131

Returns a date converted to a string using the current locale.

#### Returns

`string`

#### Inherited from

`ResClientTools.toLocaleString`

***

### toObject()

> **toObject**(`options?`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:181](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/abstract.d.ts#L181)

Convert the attributes to the json object

#### Parameters

##### options?

`any`

#### Returns

`any`

the json object.

#### Inherited from

`ResClientTools.toObject`

***

### toString()

> **toString**(): `string`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:128

Returns a string representation of an object.

#### Returns

`string`

#### Inherited from

`ResClientTools.toString`

***

### unforwardEvent()

> **unforwardEvent**(`events`): `void`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:193](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L193)

unforward local event(s) to server

unsubscribe these local events not to forward/publish to server

Note: pls backendEventable(ClientTools or EventClient) first

#### Parameters

##### events

`string` | `string`[]

#### Returns

`void`

***

### unregister()

> **unregister**(): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:532

Removes the current `ToolFunc` instance from the static registry.

#### Returns

`any`

The instance that was unregistered.

#### Inherited from

`ResClientTools.unregister`

***

### unsubscribe()

> **unsubscribe**(`events`): `Promise`\<`any`\>

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:149](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L149)

unsubscribe server event

#### Parameters

##### events

`string` | `string`[]

#### Returns

`Promise`\<`any`\>

***

### valueOf()

> **valueOf**(): `Object`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:134

Returns the primitive value of the specified object.

#### Returns

`Object`

#### Inherited from

`ResClientTools.valueOf`

***

### assign()

#### Call Signature

> `static` **assign**\<`T`, `U`\>(`target`, `source`): `T` & `U`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:286

Copy the values of all of the enumerable own properties from one or more source objects to a
target object. Returns the target object.

##### Type Parameters

###### T

`T` *extends* `object`

###### U

`U`

##### Parameters

###### target

`T`

The target object to copy to.

###### source

`U`

The source object from which to copy properties.

##### Returns

`T` & `U`

##### Inherited from

`ResClientTools.assign`

#### Call Signature

> `static` **assign**\<`T`, `U`, `V`\>(`target`, `source1`, `source2`): `T` & `U` & `V`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:295

Copy the values of all of the enumerable own properties from one or more source objects to a
target object. Returns the target object.

##### Type Parameters

###### T

`T` *extends* `object`

###### U

`U`

###### V

`V`

##### Parameters

###### target

`T`

The target object to copy to.

###### source1

`U`

The first source object from which to copy properties.

###### source2

`V`

The second source object from which to copy properties.

##### Returns

`T` & `U` & `V`

##### Inherited from

`ResClientTools.assign`

#### Call Signature

> `static` **assign**\<`T`, `U`, `V`, `W`\>(`target`, `source1`, `source2`, `source3`): `T` & `U` & `V` & `W`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:305

Copy the values of all of the enumerable own properties from one or more source objects to a
target object. Returns the target object.

##### Type Parameters

###### T

`T` *extends* `object`

###### U

`U`

###### V

`V`

###### W

`W`

##### Parameters

###### target

`T`

The target object to copy to.

###### source1

`U`

The first source object from which to copy properties.

###### source2

`V`

The second source object from which to copy properties.

###### source3

`W`

The third source object from which to copy properties.

##### Returns

`T` & `U` & `V` & `W`

##### Inherited from

`ResClientTools.assign`

#### Call Signature

> `static` **assign**(`target`, ...`sources`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:313

Copy the values of all of the enumerable own properties from one or more source objects to a
target object. Returns the target object.

##### Parameters

###### target

`object`

The target object to copy to.

###### sources

...`any`[]

One or more source objects from which to copy properties

##### Returns

`any`

##### Inherited from

`ResClientTools.assign`

***

### create()

#### Call Signature

> `static` **create**(`o`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:188

Creates an object that has the specified prototype or that has null prototype.

##### Parameters

###### o

Object to use as a prototype. May be null.

`null` | `object`

##### Returns

`any`

##### Inherited from

`ResClientTools.create`

#### Call Signature

> `static` **create**(`o`, `properties`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:195

Creates an object that has the specified prototype, and that optionally contains specified properties.

##### Parameters

###### o

Object to use as a prototype. May be null

`null` | `object`

###### properties

`PropertyDescriptorMap` & `ThisType`\<`any`\>

JavaScript object that contains one or more property descriptors.

##### Returns

`any`

##### Inherited from

`ResClientTools.create`

***

### defineProperties()

> `static` **defineProperties**(`aTarget`, `aProperties`, `recreate?`): `any`

Defined in: [property-manager.js/src/advance.d.ts:11](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/advance.d.ts#L11)

Adds one or more properties to an object, and/or modifies attributes of existing properties.

#### Parameters

##### aTarget

`any`

##### aProperties

`PropDescriptors`

##### recreate?

`boolean`

#### Returns

`any`

#### Inherited from

`ResClientTools.defineProperties`

***

### defineProperty()

> `static` **defineProperty**\<`T`\>(`o`, `p`, `attributes`): `T`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:203

Adds a property to an object, or modifies attributes of an existing property.

#### Type Parameters

##### T

`T`

#### Parameters

##### o

`T`

Object on which to add or modify the property. This can be a native JavaScript object (that is, a user-defined object or a built in object) or a DOM object.

##### p

`PropertyKey`

The property name.

##### attributes

`PropertyDescriptor` & `ThisType`\<`any`\>

Descriptor for the property. It can be for a data property or an accessor property.

#### Returns

`T`

#### Inherited from

`ResClientTools.defineProperty`

***

### entries()

#### Call Signature

> `static` **entries**\<`T`\>(`o`): \[`string`, `T`\][]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2017.object.d.ts:36

Returns an array of key/values of the enumerable own properties of an object

##### Type Parameters

###### T

`T`

##### Parameters

###### o

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

\{\[`s`: `string`\]: `T`; \} | `ArrayLike`\<`T`\>

##### Returns

\[`string`, `T`\][]

##### Inherited from

`ResClientTools.entries`

#### Call Signature

> `static` **entries**(`o`): \[`string`, `any`\][]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2017.object.d.ts:42

Returns an array of key/values of the enumerable own properties of an object

##### Parameters

###### o

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

##### Returns

\[`string`, `any`\][]

##### Inherited from

`ResClientTools.entries`

***

### fetch()

> `static` **fetch**(`name`, `objParam?`, ...`args?`): `Promise`\<`any`\>

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bh16e\_Wg.d.ts:191

#### Parameters

##### name

`string`

##### objParam?

`any`

##### args?

...`any`[]

#### Returns

`Promise`\<`any`\>

#### Inherited from

`ResClientTools.fetch`

***

### freeze()

#### Call Signature

> `static` **freeze**\<`T`\>(`f`): `T`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:222

Prevents the modification of existing property attributes and values, and prevents the addition of new properties.

##### Type Parameters

###### T

`T` *extends* `Function`

##### Parameters

###### f

`T`

Object on which to lock the attributes.

##### Returns

`T`

##### Inherited from

`ResClientTools.freeze`

#### Call Signature

> `static` **freeze**\<`T`, `U`\>(`o`): `Readonly`\<`T`\>

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:228

Prevents the modification of existing property attributes and values, and prevents the addition of new properties.

##### Type Parameters

###### T

`T` *extends* `object`

###### U

`U` *extends* `string` \| `number` \| `bigint` \| `boolean` \| `symbol`

##### Parameters

###### o

`T`

Object on which to lock the attributes.

##### Returns

`Readonly`\<`T`\>

##### Inherited from

`ResClientTools.freeze`

#### Call Signature

> `static` **freeze**\<`T`\>(`o`): `Readonly`\<`T`\>

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:234

Prevents the modification of existing property attributes and values, and prevents the addition of new properties.

##### Type Parameters

###### T

`T`

##### Parameters

###### o

`T`

Object on which to lock the attributes.

##### Returns

`Readonly`\<`T`\>

##### Inherited from

`ResClientTools.freeze`

***

### fromEntries()

#### Call Signature

> `static` **fromEntries**\<`T`\>(`entries`): `object`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2019.object.d.ts:26

Returns an object created by key-value entries for properties and methods

##### Type Parameters

###### T

`T` = `any`

##### Parameters

###### entries

`Iterable`\<readonly \[`PropertyKey`, `T`\]\>

An iterable object that contains key-value entries for properties and methods.

##### Returns

`object`

##### Inherited from

`ResClientTools.fromEntries`

#### Call Signature

> `static` **fromEntries**(`entries`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2019.object.d.ts:32

Returns an object created by key-value entries for properties and methods

##### Parameters

###### entries

`Iterable`\<readonly `any`[]\>

An iterable object that contains key-value entries for properties and methods.

##### Returns

`any`

##### Inherited from

`ResClientTools.fromEntries`

***

### get()

> `static` **get**(`name`): `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:418

Retrieves a registered function by its name or alias.

#### Parameters

##### name

`string`

The name or alias of the function to retrieve.

#### Returns

`ToolFunc`

The `ToolFunc` instance if found, otherwise `undefined`.

#### Inherited from

`ResClientTools.get`

***

### getAllByTag()

> `static` **getAllByTag**(`tagName`): `ToolFunc`[]

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:435

Retrieves all registered functions that have a specific tag.

#### Parameters

##### tagName

`string`

The tag to search for.

#### Returns

`ToolFunc`[]

An array of matching `ToolFunc` instances.

#### Inherited from

`ResClientTools.getAllByTag`

***

### getByTag()

> `static` **getByTag**(`tagName`): `undefined` \| `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:429

Finds the first registered function that has a specific tag.

#### Parameters

##### tagName

`string`

The tag to search for.

#### Returns

`undefined` \| `ToolFunc`

The first matching `ToolFunc` instance, or `undefined` if none is found.

#### Inherited from

`ResClientTools.getByTag`

***

### getFunc()

> `static` **getFunc**(`name`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:464

Retrieves a bound, runnable function reference for a registered function.
This reference is suitable for execution with an object of named parameters.

#### Parameters

##### name

`string`

The name of the function.

#### Returns

`any`

A bound function reference, or `undefined` if not found.

#### Inherited from

`ResClientTools.getFunc`

***

### getFuncWithPos()

> `static` **getFuncWithPos**(`name`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:487

Retrieves a bound, runnable function reference for a registered function.
This reference is suitable for execution with positional arguments.

#### Parameters

##### name

`string`

The name of the function.

#### Returns

`any`

A bound function reference, or `undefined` if not found.

#### Inherited from

`ResClientTools.getFuncWithPos`

***

### getOwnPropertyDescriptor()

> `static` **getOwnPropertyDescriptor**(`o`, `p`): `undefined` \| `PropertyDescriptor`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:175

Gets the own property descriptor of the specified object.
An own property descriptor is one that is defined directly on the object and is not inherited from the object's prototype.

#### Parameters

##### o

`any`

Object that contains the property.

##### p

`PropertyKey`

Name of the property.

#### Returns

`undefined` \| `PropertyDescriptor`

#### Inherited from

`ResClientTools.getOwnPropertyDescriptor`

***

### getOwnPropertyDescriptors()

> `static` **getOwnPropertyDescriptors**\<`T`\>(`o`): \{ \[P in string \| number \| symbol\]: TypedPropertyDescriptor\<T\[P\]\> \} & `object`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2017.object.d.ts:48

Returns an object containing all own property descriptors of an object

#### Type Parameters

##### T

`T`

#### Parameters

##### o

`T`

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

#### Returns

\{ \[P in string \| number \| symbol\]: TypedPropertyDescriptor\<T\[P\]\> \} & `object`

#### Inherited from

`ResClientTools.getOwnPropertyDescriptors`

***

### getOwnPropertyNames()

> `static` **getOwnPropertyNames**(`o`): `string`[]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:182

Returns the names of the own properties of an object. The own properties of an object are those that are defined directly
on that object, and are not inherited from the object's prototype. The properties of an object include both fields (objects) and functions.

#### Parameters

##### o

`any`

Object that contains the own properties.

#### Returns

`string`[]

#### Inherited from

`ResClientTools.getOwnPropertyNames`

***

### getOwnPropertySymbols()

> `static` **getOwnPropertySymbols**(`o`): `symbol`[]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:319

Returns an array of all symbol properties found directly on object o.

#### Parameters

##### o

`any`

Object to retrieve the symbols from.

#### Returns

`symbol`[]

#### Inherited from

`ResClientTools.getOwnPropertySymbols`

***

### getProperties()

> `static` **getProperties**(): `PropDescriptors`

Defined in: [property-manager.js/src/advance.d.ts:10](https://github.com/snowyu/property-manager.js/blob/e9ebf4c62be9b6d84e5868ed098df041a53bb90a/src/advance.d.ts#L10)

get all properties descriptor include inherited.

#### Returns

`PropDescriptors`

#### Inherited from

`ResClientTools.getProperties`

***

### getPrototypeOf()

> `static` **getPrototypeOf**(`o`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:167

Returns the prototype of an object.

#### Parameters

##### o

`any`

The object that references the prototype.

#### Returns

`any`

#### Inherited from

`ResClientTools.getPrototypeOf`

***

### hasAsyncFeature()

> `static` **hasAsyncFeature**(`feature`): `boolean`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:441

Checks if any registered function has a specific asynchronous feature.

#### Parameters

##### feature

`AsyncFeatureBits`

The async feature bit to check for.

#### Returns

`boolean`

`true` if the feature is present in any function, otherwise `false`.

#### Inherited from

`ResClientTools.hasAsyncFeature`

***

### hasOwn()

> `static` **hasOwn**(`o`, `v`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2022.object.d.ts:25

Determines whether an object has a property with the specified name.

#### Parameters

##### o

`object`

An object.

##### v

`PropertyKey`

A property name.

#### Returns

`boolean`

#### Inherited from

`ResClientTools.hasOwn`

***

### is()

> `static` **is**(`value1`, `value2`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:332

Returns true if the values are the same value, false otherwise.

#### Parameters

##### value1

`any`

The first value.

##### value2

`any`

The second value.

#### Returns

`boolean`

#### Inherited from

`ResClientTools.is`

***

### isExtensible()

> `static` **isExtensible**(`o`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:258

Returns a value that indicates whether new properties can be added to an object.

#### Parameters

##### o

`any`

Object to test.

#### Returns

`boolean`

#### Inherited from

`ResClientTools.isExtensible`

***

### isFrozen()

> `static` **isFrozen**(`o`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:252

Returns true if existing property attributes and values cannot be modified in an object, and new properties cannot be added to the object.

#### Parameters

##### o

`any`

Object to test.

#### Returns

`boolean`

#### Inherited from

`ResClientTools.isFrozen`

***

### isSealed()

> `static` **isSealed**(`o`): `boolean`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:246

Returns true if existing property attributes cannot be modified in an object and new properties cannot be added to the object.

#### Parameters

##### o

`any`

Object to test.

#### Returns

`boolean`

#### Inherited from

`ResClientTools.isSealed`

***

### keys()

#### Call Signature

> `static` **keys**(`o`): `string`[]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:264

Returns the names of the enumerable string properties and methods of an object.

##### Parameters

###### o

`object`

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

##### Returns

`string`[]

##### Inherited from

`ResClientTools.keys`

#### Call Signature

> `static` **keys**(`o`): `string`[]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:325

Returns the names of the enumerable string properties and methods of an object.

##### Parameters

###### o

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

##### Returns

`string`[]

##### Inherited from

`ResClientTools.keys`

***

### list()

> `static` **list**(): `Funcs`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:423

Returns the complete map of all registered functions.

#### Returns

`Funcs`

The map of `ToolFunc` instances.

#### Inherited from

`ResClientTools.list`

***

### loadFrom()

> `static` **loadFrom**(`items?`): `Promise`\<`Funcs`\>

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bh16e\_Wg.d.ts:184

Loads tool definitions from the remote server via the configured transport.
This method populates the local `ToolFunc` registry with `ClientTools` stubs.

#### Parameters

##### items?

`Funcs`

#### Returns

`Promise`\<`Funcs`\>

#### Inherited from

`ResClientTools.loadFrom`

***

### loadFromSync()

> `static` **loadFromSync**(`items`): `void`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bh16e\_Wg.d.ts:190

Synchronously loads tool definitions from a provided object, registering
each one as a `ClientTools` instance.

#### Parameters

##### items

`Funcs`

A map of tool function metadata, typically from a server.

#### Returns

`void`

#### Inherited from

`ResClientTools.loadFromSync`

***

### preventExtensions()

> `static` **preventExtensions**\<`T`\>(`o`): `T`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:240

Prevents the addition of new properties to an object.

#### Type Parameters

##### T

`T`

#### Parameters

##### o

`T`

Object to make non-extensible.

#### Returns

`T`

#### Inherited from

`ResClientTools.preventExtensions`

***

### register()

#### Call Signature

> `static` **register**(`name`, `options`): `boolean` \| `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:506

Registers a new tool function.

##### Parameters

###### name

`string`

The name of the function.

###### options

`FuncItem`

The function's configuration.

##### Returns

`boolean` \| `ToolFunc`

The new `ToolFunc` instance, or `false` if a function with that name already exists.

##### Inherited from

`ResClientTools.register`

#### Call Signature

> `static` **register**(`func`, `options`): `boolean` \| `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:507

Registers a new tool function.

##### Parameters

###### func

`Function`

The function implementation.

###### options

`FuncItem`

The function's configuration.

##### Returns

`boolean` \| `ToolFunc`

The new `ToolFunc` instance, or `false` if a function with that name already exists.

##### Inherited from

`ResClientTools.register`

#### Call Signature

> `static` **register**(`name`, `options?`): `boolean` \| `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:508

Registers a new tool function.

##### Parameters

###### name

The name of the function.

`string` | `Function` | `ToolFunc` | `FuncItem`

###### options?

`FuncItem`

The function's configuration.

##### Returns

`boolean` \| `ToolFunc`

The new `ToolFunc` instance, or `false` if a function with that name already exists.

##### Inherited from

`ResClientTools.register`

***

### run()

> `static` **run**(`name`, `params?`): `Promise`\<`any`\>

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:449

Asynchronously executes a registered function by name with named parameters.

#### Parameters

##### name

`string`

The name of the function to run.

##### params?

`any`

The parameters object for the function.

#### Returns

`Promise`\<`any`\>

A promise that resolves with the function's result.

#### Throws

If the function with the given name is not found.

#### Inherited from

`ResClientTools.run`

***

### runSync()

> `static` **runSync**(`name`, `params?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:457

Synchronously executes a registered function by name with named parameters.

#### Parameters

##### name

`string`

The name of the function to run.

##### params?

`any`

The parameters object for the function.

#### Returns

`any`

The result of the function's execution.

#### Throws

If the function with the given name is not found.

#### Inherited from

`ResClientTools.runSync`

***

### runWithPos()

> `static` **runWithPos**(`name`, ...`params`): `Promise`\<`any`\>

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:472

Asynchronously executes a function using positional arguments.

#### Parameters

##### name

`string`

The name of the function to run.

##### params

...`any`[]

Positional arguments to pass to the function.

#### Returns

`Promise`\<`any`\>

A promise that resolves with the function's result.

#### Throws

If the function with the given name is not found.

#### Inherited from

`ResClientTools.runWithPos`

***

### runWithPosSync()

> `static` **runWithPosSync**(`name`, ...`params`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:480

Synchronously executes a function using positional arguments.

#### Parameters

##### name

`string`

The name of the function to run.

##### params

...`any`[]

Positional arguments to pass to the function.

#### Returns

`any`

The result of the function's execution.

#### Throws

If the function with the given name is not found.

#### Inherited from

`ResClientTools.runWithPosSync`

***

### seal()

> `static` **seal**\<`T`\>(`o`): `T`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:216

Prevents the modification of attributes of existing properties, and prevents the addition of new properties.

#### Type Parameters

##### T

`T`

#### Parameters

##### o

`T`

Object on which to lock the attributes.

#### Returns

`T`

#### Inherited from

`ResClientTools.seal`

***

### setPrototypeOf()

> `static` **setPrototypeOf**(`o`, `proto`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2015.core.d.ts:339

Sets the prototype of a specified object o to object proto or null. Returns the object o.

#### Parameters

##### o

`any`

The object to change its prototype.

##### proto

The value of the new prototype or null.

`null` | `object`

#### Returns

`any`

#### Inherited from

`ResClientTools.setPrototypeOf`

***

### setPubSubTransport()

> `static` **setPubSubTransport**(`t?`): `void`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-client.ts:18](https://github.com/isdk/tool-event.js/blob/c19901f0aa18ed5118b1cde16440f4dc8f21db7f/src/event-client.ts#L18)

#### Parameters

##### t?

[`IPubSubClientTransport`](../interfaces/IPubSubClientTransport.md)

#### Returns

`void`

***

### setTransport()

> `static` **setTransport**(`transport`): `void`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bh16e\_Wg.d.ts:178

Injects the client-side transport implementation. This is a crucial step
to enable communication with the server.

#### Parameters

##### transport

`IClientToolTransport`

The transport instance to use for all client-server communication.

#### Returns

`void`

#### Inherited from

`ResClientTools.setTransport`

***

### unregister()

> `static` **unregister**(`name`): `undefined` \| `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:514

Unregisters a function by its name, also removing any associated aliases.

#### Parameters

##### name

`string`

The name of the function to unregister.

#### Returns

`undefined` \| `ToolFunc`

The unregistered `ToolFunc` instance, or `undefined` if it was not found.

#### Inherited from

`ResClientTools.unregister`

***

### values()

#### Call Signature

> `static` **values**\<`T`\>(`o`): `T`[]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2017.object.d.ts:24

Returns an array of values of the enumerable own properties of an object

##### Type Parameters

###### T

`T`

##### Parameters

###### o

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

\{\[`s`: `string`\]: `T`; \} | `ArrayLike`\<`T`\>

##### Returns

`T`[]

##### Inherited from

`ResClientTools.values`

#### Call Signature

> `static` **values**(`o`): `any`[]

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es2017.object.d.ts:30

Returns an array of values of the enumerable own properties of an object

##### Parameters

###### o

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

##### Returns

`any`[]

##### Inherited from

`ResClientTools.values`
