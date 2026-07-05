[**@isdk/tool-event**](../README.md)

***

[@isdk/tool-event](../globals.md) / EventServer

# Class: EventServer

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:21](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L21)

## Extends

- `ResServerTools`

## Indexable

> \[`name`: `string`\]: `any`

## Constructors

### Constructor

> **new EventServer**(`name`, `options?`): `EventServer`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:705

#### Parameters

##### name

`string` \| `Function` \| `FuncItem`

##### options?

`any`

#### Returns

`EventServer`

#### Inherited from

`ResServerTools.constructor`

## Properties

### \_registry?

> `optional` **\_registry?**: *typeof* `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:496

**`Internal`**

The registry class where this tool was originally registered.

#### Inherited from

`ResServerTools._registry`

***

### $attributes

> **$attributes**: `Properties`

Defined in: [property-manager.js/src/advance.d.ts:5](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/advance.d.ts#L5)

#### Inherited from

`ResServerTools.$attributes`

***

### action

> **action**: `"res"` \| `"get"` \| `"post"` \| `"put"` \| `"delete"` \| `"list"` \| `"patch"`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:703

The action to be used for the remote call. This typically represents an RPC method name.
Only for RESTful HTTP transports, it might be mapped to a standard HTTP method (e.g., GET, POST)

#### Inherited from

`ResServerTools.action`

***

### alias?

> `optional` **alias?**: `string` \| `string`[]

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:258

Optional aliases for the function name.

#### Inherited from

`ResServerTools.alias`

***

### allowExportFunc?

> `optional` **allowExportFunc?**: `boolean`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:607

#### Inherited from

`ResServerTools.allowExportFunc`

***

### ~~apiRoot?~~

> `optional` **apiRoot?**: `string`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:74

The root endpoint for the remote service.

#### Deprecated

Use `transport` instead.

#### Inherited from

`ResServerTools.apiRoot`

***

### asyncFeatures?

> `optional` **asyncFeatures?**: `number`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:272

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

`ResServerTools.asyncFeatures`

***

### constructor

> **constructor**: `Function`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:125

The initial value of Object.prototype.constructor is the standard built-in Object constructor.

#### Inherited from

`ResServerTools.constructor`

***

### ctx?

> `optional` **ctx?**: `ToolRpcContext`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:620

[V2] 归一化执行上下文

#### Inherited from

`ResServerTools.ctx`

***

### defaultOptions

> **defaultOptions**: `object`

Defined in: [property-manager.js/src/abstract.d.ts:74](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L74)

The default options for export and assign

#### assign?

> `optional` **assign?**: `IMergeOptions`

#### export?

> `optional` **export?**: `IMergeOptions`

#### Inherited from

`ResServerTools.defaultOptions`

***

### depends

> **depends**: `object`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:46](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L46)

A map of dependencies this function has on other tool functions.
Declaring dependencies ensures that they are automatically registered when this function is registered.
This is crucial for building modular functions that rely on each other without needing to manage registration order manually.

#### event-bus

> **event-bus**: [`EventToolFunc`](EventToolFunc.md) = `event`

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

#### Overrides

`ResServerTools.depends`

***

### description

> **description**: `string` = `'subscribe server event'`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:44](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L44)

A detailed description of what the function does.

#### Overrides

`ResServerTools.description`

***

### enableLegacyCompat

> **enableLegacyCompat**: `boolean` = `false`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:22](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L22)

控制是否开启向下兼容注入。

#### Overrides

`ResServerTools.enableLegacyCompat`

***

### expectedDuration?

> `optional` **expectedDuration?**: `number`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:100

The expected duration of the remote call in milliseconds.

#### Inherited from

`ResServerTools.expectedDuration`

***

### fetchOptions?

> `optional` **fetchOptions?**: `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:85

Addtional options to be passed to the underlying `fetch` call in a transport.

#### Inherited from

`ResServerTools.fetchOptions`

***

### isApi?

> `optional` **isApi?**: `boolean`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:247

If true, indicates that this function should be treated as a server-side API.

#### Inherited from

`ResServerTools.isApi`

***

### methods

> **methods**: `string`[]

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:661

#### Inherited from

`ResServerTools.methods`

***

### name?

> `optional` **name?**: `string`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:204

The unique name of the function.

#### Inherited from

`ResServerTools.name`

***

### nonExported1stChar

> **nonExported1stChar**: `string`

Defined in: [property-manager.js/src/abstract.d.ts:78](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L78)

the property with the default prefix '$' will not be exported.

#### Inherited from

`ResServerTools.nonExported1stChar`

***

### params

> **params**: `FuncParams`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:704

#### Inherited from

`ResServerTools.params`

***

### result

> **result**: `string` = `'event'`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:45](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L45)

The expected return type of the function, described as a string or a JSON schema object.

#### Overrides

`ResServerTools.result`

***

### scope?

> `optional` **scope?**: `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:219

The execution scope or context (`this`) for the function.

#### Inherited from

`ResServerTools.scope`

***

### setup?

> `optional` **setup?**: (`this`, `options?`) => `void`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:242

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

`ResServerTools.setup`

***

### stream?

> `optional` **stream?**: `boolean`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:253

If true, indicates that the function has the *capability* to stream its output.
Whether a specific call is streamed is determined by a `stream` property in the runtime parameters.

#### Inherited from

`ResServerTools.stream`

***

### tags?

> `optional` **tags?**: `string` \| `string`[]

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:224

Tags for grouping or filtering functions.

#### Inherited from

`ResServerTools.tags`

***

### timeout?

> `optional` **timeout?**: `number` \| \{ `keepAliveOnTimeout?`: `boolean`; `streamIdleTimeout?`: `number`; `value`: `number`; \}

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:89

The timeout configuration for the remote call.

#### Union Members

`number`

***

##### Type Literal

\{ `keepAliveOnTimeout?`: `boolean`; `streamIdleTimeout?`: `number`; `value`: `number`; \}

##### keepAliveOnTimeout?

> `optional` **keepAliveOnTimeout?**: `boolean`

Whether to keep the server-side function running after a timeout.

##### streamIdleTimeout?

> `optional` **streamIdleTimeout?**: `number`

The idle timeout for streaming responses in milliseconds.

##### value

> **value**: `number`

The hard timeout in milliseconds.

#### Inherited from

`ResServerTools.timeout`

***

### title?

> `optional` **title?**: `string`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:307

A concise, human-readable title for the function, often used in UI or by AI.

#### Inherited from

`ResServerTools.title`

***

### \_pubSubTransport

> `static` **\_pubSubTransport**: [`IPubSubServerTransport`](../interfaces/IPubSubServerTransport.md) \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:32](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L32)

***

### \_refCounts

> `protected` `static` **\_refCounts**: `object`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:489

Tracks the number of active registration holds on each function name.
A function is truly removed only when its reference count drops to zero.

#### Index Signature

\[`name`: `string`\]: `number`

#### Inherited from

`ResServerTools._refCounts`

***

### aliases

> `static` **aliases**: `object`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:480

A static map of aliases to their corresponding primary function names.

#### Index Signature

\[`name`: `string`\]: `string`

#### Inherited from

`ResServerTools.aliases`

***

### autoInjectToLocalBus

> `static` **autoInjectToLocalBus**: `boolean` = `false`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:28](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L28)

Controls whether the client-published events are auto-emitted on server's localBus.
Defaults to false for security. Must be explicitly enabled for 'client:' prefixed events to be emitted.

***

### ctx?

> `static` `optional` **ctx?**: `ToolFuncContext`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:508

The static execution context for proxy classes created via ToolFunc.with().

#### Inherited from

`ResServerTools.ctx`

***

### dataPath

> `static` **dataPath**: `string`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:503

A conventional property to designate a file path for saving the registered `ToolFunc` data.
Note: The `ToolFunc` class itself does not implement persistence logic. It is up to the
developer to use this path to save and load the `ToolFunc.items` registry if needed.

#### Inherited from

`ResServerTools.dataPath`

***

### items

> `static` **items**: `Funcs`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:475

A static registry of all `ToolFunc` implementations, indexed by their primary name.

#### Inherited from

`ResServerTools.items`

***

### SpecialRpcMethodNames

> `static` **SpecialRpcMethodNames**: `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:702

#### Inherited from

`ResServerTools.SpecialRpcMethodNames`

## Accessors

### pubSubTransport

#### Get Signature

> **get** **pubSubTransport**(): [`IPubSubServerTransport`](../interfaces/IPubSubServerTransport.md) \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:48](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L48)

##### Returns

[`IPubSubServerTransport`](../interfaces/IPubSubServerTransport.md) \| `undefined`

***

### SpecialRpcMethodNames

#### Get Signature

> **get** **SpecialRpcMethodNames**(): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:669

##### Returns

`any`

#### Inherited from

`ResServerTools.SpecialRpcMethodNames`

***

### pubSubTransport

#### Get Signature

> **get** `static` **pubSubTransport**(): [`IPubSubServerTransport`](../interfaces/IPubSubServerTransport.md) \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:34](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L34)

##### Returns

[`IPubSubServerTransport`](../interfaces/IPubSubServerTransport.md) \| `undefined`

## Methods

### \_prepareContext()

> `protected` **\_prepareContext**(`params?`, `ctx?`): `ToolFuncContext`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:806

Creates the final execution context (`this.ctx`) for a Shadow Instance.

NOTE: We MUST use 'this._prepareContext' (instance path) instead of
'Static._prepareContext' to allow AOP plugins (like CancelableAbility)
to hook into context preparation via method overloading ($_prepareContext).

#### Parameters

##### params?

`any`

##### ctx?

`ToolFuncContext`

#### Returns

`ToolFuncContext`

#### Inherited from

`ResServerTools._prepareContext`

***

### \_shouldIsolate()

> `protected` **\_shouldIsolate**(`params?`, `ctx?`): `boolean`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:798

Determines if the function execution should be isolated into a "Shadow Instance".

PRIORITY LOGIC:
1. Explicit 'ctx.isolated' in the current call (Highest).
2. Any explicit 'ctx' provided (Safe default: isolate to apply new overrides).
3. Prevention of recursion (If already an own 'ctx' property exists).
4. Inherited 'this.ctx.isolated' configuration.
5. Presence of any inherited context (Default: isolate for concurrency safety).

#### Parameters

##### params?

`any`

##### ctx?

`ToolFuncContext`

#### Returns

`boolean`

#### Inherited from

`ResServerTools._shouldIsolate`

***

### $publish()

> **$publish**(`params`, `context?`): `object`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:174](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L174)

#### Parameters

##### params

[`EventServerFuncParams`](../interfaces/EventServerFuncParams.md)

##### context?

`ToolRpcContext`

#### Returns

`object`

##### event

> **event**: `string`[] = `events`

##### senderId

> **senderId**: `any`

***

### $sub()

> **$sub**(`params`, `context?`): \{ `clientId`: `any`; `event`: `string` \| `string`[]; `forward`: `boolean`; `subscribed`: `boolean`; \} \| \{ `clientId?`: `undefined`; `event`: `string` \| `string`[]; `forward`: `boolean`; `subscribed?`: `undefined`; \}

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:114](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L114)

#### Parameters

##### params

[`EventServerFuncParams`](../interfaces/EventServerFuncParams.md)

##### context?

`ToolRpcContext`

#### Returns

\{ `clientId`: `any`; `event`: `string` \| `string`[]; `forward`: `boolean`; `subscribed`: `boolean`; \} \| \{ `clientId?`: `undefined`; `event`: `string` \| `string`[]; `forward`: `boolean`; `subscribed?`: `undefined`; \}

***

### $unsub()

> **$unsub**(`params`, `context?`): \{ `clientId`: `any`; `event`: `string` \| `string`[]; `forward`: `boolean`; `subscribed`: `boolean`; \} \| \{ `clientId?`: `undefined`; `event`: `string` \| `string`[]; `forward`: `boolean`; `subscribed?`: `undefined`; \}

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:144](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L144)

#### Parameters

##### params

[`EventServerFuncParams`](../interfaces/EventServerFuncParams.md)

##### context?

`ToolRpcContext`

#### Returns

\{ `clientId`: `any`; `event`: `string` \| `string`[]; `forward`: `boolean`; `subscribed`: `boolean`; \} \| \{ `clientId?`: `undefined`; `event`: `string` \| `string`[]; `forward`: `boolean`; `subscribed?`: `undefined`; \}

***

### arr2ObjParams()

> **arr2ObjParams**(`params`): `any`[]

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:770

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

`ResServerTools.arr2ObjParams`

***

### assign()

> **assign**(`src`, `options?`): `this`

Defined in: [property-manager.js/src/abstract.d.ts:106](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L106)

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

`ResServerTools.assign`

***

### assignProperty()

> **assignProperty**(`src`, `name`, `value`, `attrs?`, `options?`): `void`

Defined in: [property-manager.js/src/abstract.d.ts:117](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L117)

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

`ResServerTools.assignProperty`

***

### assignPropertyTo()

> `abstract` **assignPropertyTo**(`dest`, `src`, `name`, `value`, `attrs?`, `options?`): `void`

Defined in: [property-manager.js/src/abstract.d.ts:131](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L131)

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

`ResServerTools.assignPropertyTo`

***

### assignTo()

> **assignTo**(`dest?`, `options?`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:191](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L191)

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

`ResServerTools.assignTo`

***

### cast()

> **cast**(`key`, `value`, `vType?`): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:676

#### Parameters

##### key

`string`

##### value

`any`

##### vType?

`any`

#### Returns

`any`

#### Inherited from

`ResServerTools.cast`

***

### castParams()

> **castParams**(`params`, `context?`): `ResServerFuncParams`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:717

资源 ID 映射逻辑：将协议层的 resId 灌回给业务层的 params.id

#### Parameters

##### params

`ResServerFuncParams`

##### context?

`ToolRpcContext`

#### Returns

`ResServerFuncParams`

#### Inherited from

`ResServerTools.castParams`

***

### clone()

> **clone**(`options?`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:155](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L155)

Create a new object with the same values of attributes.

#### Parameters

##### options?

`IMergeOptions`

#### Returns

`any`

the new object

#### Inherited from

`ResServerTools.clone`

***

### cloneTo()

> **cloneTo**(`dest`, `options?`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:148](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L148)

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

`ResServerTools.cloneTo`

***

### defineProperties()

> `abstract` **defineProperties**(`aProperties`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:89](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L89)

Define the attributes of this object.

#### Parameters

##### aProperties

`SimplePropDescriptors`

the defined attributes of the object

#### Returns

`any`

#### Inherited from

`ResServerTools.defineProperties`

***

### delete()?

> `optional` **delete**(`params`, `context?`): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:695

#### Parameters

##### params

`ResServerFuncParams`

##### context?

`ToolRpcContext`

#### Returns

`any`

#### Inherited from

`ResServerTools.delete`

***

### exportTo()

> **exportTo**(`dest`, `options?`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:173](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L173)

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

`ResServerTools.exportTo`

***

### forward()

> **forward**(`events`): `void`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:74](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L74)

#### Parameters

##### events

`string` \| `string`[]

#### Returns

`void`

***

### func()

> **func**(`params`, `context?`): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:679

业务实现函数模板。

#### Parameters

##### params

`RpcMethodsServerFuncParams`

##### context?

`ToolRpcContext`

#### Returns

`any`

#### Inherited from

`ResServerTools.func`

***

### get()?

> `optional` **get**(`params`, `context?`): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:692

#### Parameters

##### params

`ResServerFuncParams`

##### context?

`ToolRpcContext`

#### Returns

`any`

#### Inherited from

`ResServerTools.get`

***

### getFunc()

> **getFunc**(`name?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:866

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

`ResServerTools.getFunc`

***

### getFuncWithPos()

> **getFuncWithPos**(`name?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:910

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

`ResServerTools.getFuncWithPos`

***

### getMethodFromParams()

> **getMethodFromParams**(`params`, `context?`): `string`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:713

确定执行的方法

#### Parameters

##### params

`ResServerFuncParams`

##### context?

`ToolRpcContext`

#### Returns

`string`

#### Inherited from

`ResServerTools.getMethodFromParams`

***

### getProperties()

> `abstract` **getProperties**(): `PropDescriptors`

Defined in: [property-manager.js/src/abstract.d.ts:98](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L98)

Get the defined attributes.

#### Returns

`PropDescriptors`

the descriptors of properties object

#### Inherited from

`ResServerTools.getProperties`

***

### getResId()

> **getResId**(`params`, `context?`): `string` \| `undefined`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:709

仅在 Res 类及其派生类中启用资源 ID 获取

#### Parameters

##### params

`any`

##### context?

`ToolRpcContext`

#### Returns

`string` \| `undefined`

#### Inherited from

`ResServerTools.getResId`

***

### getRpcAct()

> **getRpcAct**(`params`, `context?`): `string` \| `undefined`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:673

仅在 RpcMethods 类及其派生类中启用 Act 获取

#### Parameters

##### params

`any`

##### context?

`ToolRpcContext`

#### Returns

`string` \| `undefined`

#### Inherited from

`ResServerTools.getRpcAct`

***

### hasAsyncFeature()

> **hasAsyncFeature**(`feature`): `boolean`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:916

Checks if the current function instance supports a specific async feature.

#### Parameters

##### feature

`AsyncFeatureBits`

The async feature bit to check for.

#### Returns

`boolean`

`true` if the feature is supported, otherwise `false`.

#### Inherited from

`ResServerTools.hasAsyncFeature`

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

`ResServerTools.hasOwnProperty`

***

### initialize()

> **initialize**(`src?`): `this`

Defined in: [property-manager.js/src/abstract.d.ts:139](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L139)

Initialize object and assign attribute values from src if src exists.

#### Parameters

##### src?

`any`

#### Returns

`this`

this object.

#### Inherited from

`ResServerTools.initialize`

***

### initRpcMethods()

> **initRpcMethods**(`methods?`): `void`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:674

#### Parameters

##### methods?

`string`[]

#### Returns

`void`

#### Inherited from

`ResServerTools.initRpcMethods`

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

`ResServerTools.isPrototypeOf`

***

### isSame()

> **isSame**(`src`, `options?`): `boolean`

Defined in: [property-manager.js/src/abstract.d.ts:200](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L200)

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

`ResServerTools.isSame`

***

### isStream()

> **isStream**(`params`, `context?`): `boolean`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:207](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L207)

Determines if a function call should produce a stream.

The logic is as follows:
1. It first checks if the function is generally capable of streaming (`this.stream`).
2. If it is, it then checks if a `stream` parameter is formally declared in the function's `params` definition.
3. If both are true, the method returns the value of the `stream` property from the runtime `params` object.
Otherwise, it returns the function's static `stream` capability.

#### Parameters

##### params

`ServerFuncParams`

The runtime parameters passed to the function call.

##### context?

`ToolRpcContext`

#### Returns

`boolean`

`true` if the call should be streamed, `false` or `undefined` otherwise.

#### Overrides

`ResServerTools.isStream`

***

### list()

> **list**(`params`, `context?`): [`PubSubServerSession`](../interfaces/PubSubServerSession.md)

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:103](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L103)

#### Parameters

##### params

[`EventServerFuncParams`](../interfaces/EventServerFuncParams.md)

##### context?

`ToolRpcContext`

#### Returns

[`PubSubServerSession`](../interfaces/PubSubServerSession.md)

#### Overrides

`ResServerTools.list`

***

### mergeTo()

> **mergeTo**(`dest`, `options?`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:164](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L164)

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

`ResServerTools.mergeTo`

***

### obj2ArrParams()

> **obj2ArrParams**(`params?`): `any`[]

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:777

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

`ResServerTools.obj2ArrParams`

***

### post()?

> `optional` **post**(`params`, `context?`): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:693

#### Parameters

##### params

`ResServerFuncParams`

##### context?

`ToolRpcContext`

#### Returns

`any`

#### Inherited from

`ResServerTools.post`

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

`ResServerTools.propertyIsEnumerable`

***

### publishServerEvent()

> **publishServerEvent**(`event`, `data`): `any`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:69](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L69)

#### Parameters

##### event

`string`

##### data

`any`

#### Returns

`any`

***

### put()?

> `optional` **put**(`params`, `context?`): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:694

#### Parameters

##### params

`ResServerFuncParams`

##### context?

`ToolRpcContext`

#### Returns

`any`

#### Inherited from

`ResServerTools.put`

***

### register()

> **register**(): `boolean` \| `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:757

Registers the current `ToolFunc` instance into the static registry.
Also registers any declared dependencies.

#### Returns

`boolean` \| `ToolFunc`

The instance itself upon successful registration, or `false` if it already exists.

#### Inherited from

`ResServerTools.register`

***

### run()

> **run**(`params`, `context?`): `any`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:629

[V2 标准执行入口]

#### Parameters

##### params

`ServerFuncParams`

##### context?

`ToolRpcContext`

#### Returns

`any`

#### Inherited from

`ResServerTools.run`

***

### runAs()

> **runAs**(`name`, `params?`, `ctx?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:837

Asynchronously executes another registered function by name.

Note: This method returns a `Promise` if the underlying function is asynchronous,
otherwise it may return the result synchronously.

#### Parameters

##### name

`string`

The name of the target function to run.

##### params?

`any`

Optional parameters to pass to the function.

##### ctx?

`ToolFuncContext`

The execution context.

#### Returns

`any`

A promise or the direct result of the function's execution.

#### Inherited from

`ResServerTools.runAs`

***

### runAsSync()

> **runAsSync**(`name`, `params?`, `ctx?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:858

Executes another registered function by name, using hierarchical dependency resolution.

This method supports **Late-Binding Polymorphism**. It uses the `rootRegistry` and
`binding` strategy from the execution context to resolve dependencies.

### Binding Modes:
- `'auto'` (Default): **Lineage-Aware**. Uses late-binding only if the `rootRegistry`
  is a descendant of the tool's definition registry and has shadowed the dependency.
  Otherwise, uses early-binding for stability.
- `'early'`: **Safety First**. Always prefers the pre-bound instance from `depends`.
- `'late'`: **Forced Polymorphism**. Always resolves from the `rootRegistry`,
  ignoring the definer's environment.

#### Parameters

##### name

`string`

The name or alias of the target function to run.

##### params?

`any`

Optional parameters to pass to the target function.

##### ctx?

`ToolFuncContext`

The execution context.

#### Returns

`any`

The result of the target function execution.

#### Throws

If the target function cannot be found in the current lineage.

#### Inherited from

`ResServerTools.runAsSync`

***

### runSync()

> **runSync**(`params?`, `ctx?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:814

Executes the function synchronously with a named parameters object.

#### Parameters

##### params?

`any`

The parameters object for the function.

##### ctx?

`ToolFuncContext`

The execution context.

#### Returns

`any`

The result of the function execution.

#### Throws

Will throw an error if an array of parameters is passed to a function that expects an object.

#### Inherited from

`ResServerTools.runSync`

***

### runWithPos()

> **runWithPos**(...`params`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:891

Executes the function asynchronously using positional arguments.

Note: This method returns a `Promise` if the underlying function is asynchronous,
otherwise it may return the result synchronously.

#### Parameters

##### params

...`any`[]

Positional arguments passed to the function.

#### Returns

`any`

A promise or the direct result of the function's execution.

#### Inherited from

`ResServerTools.runWithPos`

***

### runWithPosAs()

> **runWithPosAs**(`name`, ...`params`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:902

Asynchronously executes another function by name using positional arguments.

Note: This method returns a `Promise` if the underlying function is asynchronous,
otherwise it may return the result synchronously.

#### Parameters

##### name

`string`

The name of the target function to run.

##### params

...`any`[]

Positional arguments to pass to the function.

#### Returns

`any`

A promise or the direct result of the function's execution.

#### Inherited from

`ResServerTools.runWithPosAs`

***

### runWithPosAsSync()

> **runWithPosAsSync**(`name`, ...`params`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:881

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

`ResServerTools.runWithPosAsSync`

***

### runWithPosSync()

> **runWithPosSync**(...`params`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:873

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

`ResServerTools.runWithPosSync`

***

### toJSON()

> **toJSON**(): `any`

Defined in: [property-manager.js/src/abstract.d.ts:182](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L182)

#### Returns

`any`

#### Inherited from

`ResServerTools.toJSON`

***

### toLocaleString()

> **toLocaleString**(): `string`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:131

Returns a date converted to a string using the current locale.

#### Returns

`string`

#### Inherited from

`ResServerTools.toLocaleString`

***

### toObject()

> **toObject**(`options?`): `any`

Defined in: [property-manager.js/src/abstract.d.ts:181](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/abstract.d.ts#L181)

Convert the attributes to the json object

#### Parameters

##### options?

`any`

#### Returns

`any`

the json object.

#### Inherited from

`ResServerTools.toObject`

***

### toString()

> **toString**(): `string`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:128

Returns a string representation of an object.

#### Returns

`string`

#### Inherited from

`ResServerTools.toString`

***

### unforward()

> **unforward**(`events`): `void`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:91](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L91)

#### Parameters

##### events

`string` \| `string`[]

#### Returns

`void`

***

### unregister()

> **unregister**(`options?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:763

Removes the current `ToolFunc` instance from the static registry.

#### Parameters

##### options?

`boolean` \| `UnregisterOptions`

Unregistration options or a boolean force flag.

#### Returns

`any`

The instance that was unregistered.

#### Inherited from

`ResServerTools.unregister`

***

### valueOf()

> **valueOf**(): `Object`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:134

Returns the primitive value of the specified object.

#### Returns

`Object`

#### Inherited from

`ResServerTools.valueOf`

***

### with()

> **with**(`ctx`): `this`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:542

Returns an isolated instance with the provided context.

#### Parameters

##### ctx

`ToolFuncContext`

The context to use.

#### Returns

`this`

An isolated ToolFunc instance.

#### Inherited from

`ResServerTools.with`

***

### \_acquireDependencies()

> `protected` `static` **\_acquireDependencies**(`inst`, `stack?`): `void`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:740

#### Parameters

##### inst

`ToolFunc`

##### stack?

`Set`\<`string`\>

#### Returns

`void`

#### Inherited from

`ResServerTools._acquireDependencies`

***

### \_decRefCount()

> `protected` `static` **\_decRefCount**(`name`): `number`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:739

#### Parameters

##### name

`string`

#### Returns

`number`

#### Inherited from

`ResServerTools._decRefCount`

***

### \_getRegistrationAction()

> `protected` `static` **\_getRegistrationAction**(`name`, `override`): `"create"` \| `"shadow"` \| `"replace"` \| `"increment"`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:670

Analyzes the registration context and determines the appropriate action.

#### Parameters

##### name

`string`

The function name to register.

##### override

Override options.

###### name?

`boolean`

#### Returns

`"create"` \| `"shadow"` \| `"replace"` \| `"increment"`

The determined registration action.

#### Inherited from

`ResServerTools._getRegistrationAction`

***

### \_incRefCount()

> `protected` `static` **\_incRefCount**(`name`): `void`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:738

#### Parameters

##### name

`string`

#### Returns

`void`

#### Inherited from

`ResServerTools._incRefCount`

***

### \_normalizeArguments()

> `protected` `static` **\_normalizeArguments**(`name`, `options?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:643

**`Internal`**

Internal helper to normalize arguments from various input patterns.
Priority: name (arg1) > options (arg2).

#### Parameters

##### name

`string` \| `Function` \| `ToolFunc` \| `FuncItem`

Primary config.

##### options?

`any`

Default config.

#### Returns

`any`

Normalized options object.

#### Inherited from

`ResServerTools._normalizeArguments`

***

### \_normalizeRegisterArguments()

> `protected` `static` **\_normalizeRegisterArguments**(`name`, `options?`): `RegisterOptions`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:682

**`Internal`**

Normalizes the arguments passed to the `register` method into a unified `RegisterOptions` object.

#### Parameters

##### name

`string` \| `Function` \| `ToolFunc` \| `RegisterOptions`

The primary identification or implementation.

##### options?

`RegisterOptions`

Additional or overriding configuration.

#### Returns

`RegisterOptions`

A normalized options object ready for registration.

#### Inherited from

`ResServerTools._normalizeRegisterArguments`

***

### \_prepareContext()

> `static` **\_prepareContext**(`parentCtx?`, `ctx?`): `ToolFuncContext`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:535

**`Internal`**

Internal helper to prepare the execution context, maintaining the prototype chain.

#### Parameters

##### parentCtx?

`ToolFuncContext`

The parent context to inherit from.

##### ctx?

`ToolFuncContext`

The new context properties to apply.

#### Returns

`ToolFuncContext`

The merged context.

DANGER - DO NOT "OPTIMIZE" UNLESS YOU UNDERSTAND:
1. Why NOT Object.assign(target, ctx) alone?
   Object.assign only copies 'own' properties. In nested calls (e.g., .with().with()),
   parent properties exist on the prototype. Using assign would drop all inherited
   context data (like traceId from a parent runner).
2. Why NOT Object.setPrototypeOf?
   It's a heavy performance killer in V8. We use Object.create(proto) instead.
3. Why check isPrototypeOf?
   If ctx is already in the chain, we return it to maintain identity and avoid
   redundant shadow layers, which is required by many AOP plugins and unit tests.

#### Inherited from

`ResServerTools._prepareContext`

***

### \_releaseDependencies()

> `protected` `static` **\_releaseDependencies**(`inst`): `void`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:741

#### Parameters

##### inst

`ToolFunc`

#### Returns

`void`

#### Inherited from

`ResServerTools._releaseDependencies`

***

### alreadyForward()

> `static` **alreadyForward**(`event`): `true` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:62](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L62)

#### Parameters

##### event

`string`

#### Returns

`true` \| `undefined`

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

`ResServerTools.assign`

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

`ResServerTools.assign`

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

`ResServerTools.assign`

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

`ResServerTools.assign`

***

### clear()

> `static` **clear**(): `void`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:661

Resets the local registry by clearing all registered items, aliases, and reference counts.

In a hierarchical registry, this only clears properties "owned" by the current
layer. Inherited items from parent registries remain visible through the prototype chain.

#### Returns

`void`

#### Inherited from

`ResServerTools.clear`

***

### create()

#### Call Signature

> `static` **create**(`o`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:188

Creates an object that has the specified prototype or that has null prototype.

##### Parameters

###### o

`object` \| `null`

Object to use as a prototype. May be null.

##### Returns

`any`

##### Inherited from

`ResServerTools.create`

#### Call Signature

> `static` **create**(`o`, `properties`): `any`

Defined in: @isdk/ai-tools/node\_modules/.pnpm/typescript@5.7.3/node\_modules/typescript/lib/lib.es5.d.ts:195

Creates an object that has the specified prototype, and that optionally contains specified properties.

##### Parameters

###### o

`object` \| `null`

Object to use as a prototype. May be null

###### properties

`PropertyDescriptorMap` & `ThisType`\<`any`\>

JavaScript object that contains one or more property descriptors.

##### Returns

`any`

##### Inherited from

`ResServerTools.create`

***

### defineProperties()

> `static` **defineProperties**(`aTarget`, `aProperties`, `recreate?`): `any`

Defined in: [property-manager.js/src/advance.d.ts:11](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/advance.d.ts#L11)

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

`ResServerTools.defineProperties`

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

`ResServerTools.defineProperty`

***

### ebListener()

> `static` **ebListener**(`eventType`, ...`data`): `void`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:58](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L58)

#### Parameters

##### eventType

`string`

##### data

...`any`[]

#### Returns

`void`

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

\{\[`s`: `string`\]: `T`; \} \| `ArrayLike`\<`T`\>

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

##### Returns

\[`string`, `T`\][]

##### Inherited from

`ResServerTools.entries`

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

`ResServerTools.entries`

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

`ResServerTools.freeze`

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

`ResServerTools.freeze`

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

`ResServerTools.freeze`

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

`ResServerTools.fromEntries`

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

`ResServerTools.fromEntries`

***

### get()

> `static` **get**(`name`): `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:553

Retrieves a registered function by its name or alias.

#### Parameters

##### name

`string`

The name or alias of the function to retrieve.

#### Returns

`ToolFunc`

The `ToolFunc` instance if found, otherwise `undefined`.

#### Inherited from

`ResServerTools.get`

***

### getAllByTag()

> `static` **getAllByTag**(`tagName`): `ToolFunc`[]

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:570

Retrieves all registered functions that have a specific tag.

#### Parameters

##### tagName

`string`

The tag to search for.

#### Returns

`ToolFunc`[]

An array of matching `ToolFunc` instances.

#### Inherited from

`ResServerTools.getAllByTag`

***

### getByTag()

> `static` **getByTag**(`tagName`): `ToolFunc` \| `undefined`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:564

Finds the first registered function that has a specific tag.

#### Parameters

##### tagName

`string`

The tag to search for.

#### Returns

`ToolFunc` \| `undefined`

The first matching `ToolFunc` instance, or `undefined` if none is found.

#### Inherited from

`ResServerTools.getByTag`

***

### getFunc()

> `static` **getFunc**(`name`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:605

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

`ResServerTools.getFunc`

***

### getFuncWithPos()

> `static` **getFuncWithPos**(`name`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:632

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

`ResServerTools.getFuncWithPos`

***

### getOwnPropertyDescriptor()

> `static` **getOwnPropertyDescriptor**(`o`, `p`): `PropertyDescriptor` \| `undefined`

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

`PropertyDescriptor` \| `undefined`

#### Inherited from

`ResServerTools.getOwnPropertyDescriptor`

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

`ResServerTools.getOwnPropertyDescriptors`

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

`ResServerTools.getOwnPropertyNames`

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

`ResServerTools.getOwnPropertySymbols`

***

### getProperties()

> `static` **getProperties**(): `PropDescriptors`

Defined in: [property-manager.js/src/advance.d.ts:10](https://github.com/snowyu/property-manager.js/blob/4214417b21b4740d5e51a16e79d083126265f03e/src/advance.d.ts#L10)

get all properties descriptor include inherited.

#### Returns

`PropDescriptors`

#### Inherited from

`ResServerTools.getProperties`

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

`ResServerTools.getPrototypeOf`

***

### hasAsyncFeature()

> `static` **hasAsyncFeature**(`feature`): `boolean`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:576

Checks if any registered function has a specific asynchronous feature.

#### Parameters

##### feature

`AsyncFeatureBits`

The async feature bit to check for.

#### Returns

`boolean`

`true` if the feature is present in any function, otherwise `false`.

#### Inherited from

`ResServerTools.hasAsyncFeature`

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

`ResServerTools.hasOwn`

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

`ResServerTools.is`

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

`ResServerTools.isExtensible`

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

`ResServerTools.isFrozen`

***

### isolateRegistry()

> `static` **isolateRegistry**(`options?`): `void`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:654

Isolates the current registry layer by branching off its parent using prototype shadowing.

This creates a new "scope" where:
1. New registrations are stored only in the local layer, supporting tool shadowing.
2. Parent tools remain accessible via the prototype chain (read-only) unless shadowed.
3. Reference counting is isolated, enabling clean per-layer lifecycle management.

#### Parameters

##### options?

`ToolFuncRegistryIsolateOptions`

Options to selectively isolate specific maps (items, aliases, refCounts).

#### Returns

`void`

#### Inherited from

`ResServerTools.isolateRegistry`

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

`ResServerTools.isSealed`

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

`ResServerTools.keys`

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

`ResServerTools.keys`

***

### list()

> `static` **list**(): `Funcs`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:558

Returns the complete map of all registered functions.

#### Returns

`Funcs`

The map of `ToolFunc` instances.

#### Inherited from

`ResServerTools.list`

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

`ResServerTools.preventExtensions`

***

### publish()

> `static` **publish**(`event`, `data`, `target?`): `void` \| `undefined`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:52](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L52)

#### Parameters

##### event

`string`

##### data

`any`

##### target?

###### clientId?

`string` \| `string`[]

#### Returns

`void` \| `undefined`

***

### register()

#### Call Signature

> `static` **register**(`name`, `options`): `boolean` \| `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:718

**`Internal`**

Registers a `ToolFunc` instance into the registry.

This method supports multiple overloads and handles hierarchical registration,
alias collision protection, and automatic dependency registration with cycle detection.

### Hierarchical Behavior:
- In an isolated registry, items are stored locally, shadowing parent items with the same name.
- Alias consistency is enforced across the hierarchy: registering a colliding alias throws an error
  unless `allowOverride.alias` is explicitly granted.

### Circular Dependencies:
Automatically detects and manages circular dependency chains using an internal stack.
Reference counts are precisely managed (count=1 for back-edges) to prevent memory leaks
and enable clean group unregistration.

##### Parameters

###### name

`string`

The tool instance, function, or name to register.

###### options

`RegisterOptions`

Configuration or implementation for the tool.

##### Returns

`boolean` \| `ToolFunc`

The registered ToolFunc instance on success (creation, shadowing, or override),
or `false` if registration was ignored (e.g., ref-count increment only).

##### Example

```ts
// 1. Registering with explicit name and function
ToolFunc.register('add', { func: (a, b) => a + b });

// 2. Registering with shadowing permission in an isolated registry
MyPluginTools.register('calc', { func: () => 2 }, { allowOverride: true });

// 3. Registering an existing ToolFunc instance
const tool = new ToolFunc({ name: 'my-tool', func: () => 'ok' });
ToolFunc.register(tool);
```

##### Throws

If name is missing, or if an alias collision occurs without permission.

##### Inherited from

`ResServerTools.register`

#### Call Signature

> `static` **register**(`func`, `options`): `boolean` \| `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:719

**`Internal`**

Registers a `ToolFunc` instance into the registry.

This method supports multiple overloads and handles hierarchical registration,
alias collision protection, and automatic dependency registration with cycle detection.

### Hierarchical Behavior:
- In an isolated registry, items are stored locally, shadowing parent items with the same name.
- Alias consistency is enforced across the hierarchy: registering a colliding alias throws an error
  unless `allowOverride.alias` is explicitly granted.

### Circular Dependencies:
Automatically detects and manages circular dependency chains using an internal stack.
Reference counts are precisely managed (count=1 for back-edges) to prevent memory leaks
and enable clean group unregistration.

##### Parameters

###### func

`Function`

###### options

`RegisterOptions`

Configuration or implementation for the tool.

##### Returns

`boolean` \| `ToolFunc`

The registered ToolFunc instance on success (creation, shadowing, or override),
or `false` if registration was ignored (e.g., ref-count increment only).

##### Example

```ts
// 1. Registering with explicit name and function
ToolFunc.register('add', { func: (a, b) => a + b });

// 2. Registering with shadowing permission in an isolated registry
MyPluginTools.register('calc', { func: () => 2 }, { allowOverride: true });

// 3. Registering an existing ToolFunc instance
const tool = new ToolFunc({ name: 'my-tool', func: () => 'ok' });
ToolFunc.register(tool);
```

##### Throws

If name is missing, or if an alias collision occurs without permission.

##### Inherited from

`ResServerTools.register`

#### Call Signature

> `static` **register**(`name`, `options?`, `_stack?`): `boolean` \| `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:720

**`Internal`**

Registers a `ToolFunc` instance into the registry.

This method supports multiple overloads and handles hierarchical registration,
alias collision protection, and automatic dependency registration with cycle detection.

### Hierarchical Behavior:
- In an isolated registry, items are stored locally, shadowing parent items with the same name.
- Alias consistency is enforced across the hierarchy: registering a colliding alias throws an error
  unless `allowOverride.alias` is explicitly granted.

### Circular Dependencies:
Automatically detects and manages circular dependency chains using an internal stack.
Reference counts are precisely managed (count=1 for back-edges) to prevent memory leaks
and enable clean group unregistration.

##### Parameters

###### name

`string` \| `Function` \| `ToolFunc` \| `RegisterOptions`

The tool instance, function, or name to register.

###### options?

`RegisterOptions`

Configuration or implementation for the tool.

###### \_stack?

`Set`\<`string`\>

Used for cycle detection during recursive registration.

##### Returns

`boolean` \| `ToolFunc`

The registered ToolFunc instance on success (creation, shadowing, or override),
or `false` if registration was ignored (e.g., ref-count increment only).

##### Example

```ts
// 1. Registering with explicit name and function
ToolFunc.register('add', { func: (a, b) => a + b });

// 2. Registering with shadowing permission in an isolated registry
MyPluginTools.register('calc', { func: () => 2 }, { allowOverride: true });

// 3. Registering an existing ToolFunc instance
const tool = new ToolFunc({ name: 'my-tool', func: () => 'ok' });
ToolFunc.register(tool);
```

##### Throws

If name is missing, or if an alias collision occurs without permission.

##### Inherited from

`ResServerTools.register`

***

### run()

> `static` **run**(`name`, `params?`, `ctx?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:589

Asynchronously executes a registered function by name with named parameters.

Note: This method returns a `Promise` if the underlying function is asynchronous,
otherwise it may return the result synchronously.

#### Parameters

##### name

`string`

The name of the function to run.

##### params?

`any`

The parameters object for the function.

##### ctx?

`ToolFuncContext`

The execution context.

#### Returns

`any`

A promise or the direct result of the function's execution.

#### Throws

If the function with the given name is not found.

#### Inherited from

`ResServerTools.run`

***

### runSync()

> `static` **runSync**(`name`, `params?`, `ctx?`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:598

Synchronously executes a registered function by name with named parameters.

#### Parameters

##### name

`string`

The name of the function to run.

##### params?

`any`

The parameters object for the function.

##### ctx?

`ToolFuncContext`

The execution context.

#### Returns

`any`

The result of the function's execution.

#### Throws

If the function with the given name is not found.

#### Inherited from

`ResServerTools.runSync`

***

### runWithPos()

> `static` **runWithPos**(`name`, ...`params`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:617

Asynchronously executes a function using positional arguments.

Note: This method returns a `Promise` if the underlying function is asynchronous,
otherwise it may return the result synchronously.

#### Parameters

##### name

`string`

The name of the function to run.

##### params

...`any`[]

Positional arguments to pass to the function.

#### Returns

`any`

A promise or the direct result of the function's execution.

#### Throws

If the function with the given name is not found.

#### Inherited from

`ResServerTools.runWithPos`

***

### runWithPosSync()

> `static` **runWithPosSync**(`name`, ...`params`): `any`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:625

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

`ResServerTools.runWithPosSync`

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

`ResServerTools.seal`

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

`object` \| `null`

The value of the new prototype or null.

#### Returns

`any`

#### Inherited from

`ResServerTools.setPrototypeOf`

***

### setPubSubTransport()

> `static` **setPubSubTransport**(`t?`): `void`

Defined in: [@isdk/ai-tools/packages/tool-event/src/event-server.ts:33](https://github.com/isdk/tool-event.js/blob/1ef8e2920d1f7a865c06f671102c2c2b3d432d07/src/event-server.ts#L33)

#### Parameters

##### t?

[`IPubSubServerTransport`](../interfaces/IPubSubServerTransport.md)

#### Returns

`void`

***

### toJSON()

> `static` **toJSON**(): `object`

Defined in: @isdk/ai-tools/packages/tool-rpc/dist/index-Bemsc4p1.d.ts:623

#### Returns

`object`

#### Inherited from

`ResServerTools.toJSON`

***

### unregister()

> `static` **unregister**(`target`, `options?`): `ToolFunc` \| `undefined`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:737

Unregisters a tool function implementation from the registry by its name, alias, or instance.

This method supports hierarchical unregistration. If a function's reference count
reaches zero, it is physically removed from the registry and its dependencies are released.

#### Parameters

##### target

`string` \| `ToolFunc`

The name, alias, or implementation instance.

##### options?

`boolean` \| `UnregisterOptions`

Options or a simple 'force' boolean flag.

`boolean`

***

`UnregisterOptions`

#### Returns

`ToolFunc` \| `undefined`

The unregistered ToolFunc instance, or `undefined` if not found.

#### Inherited from

`ResServerTools.unregister`

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

\{\[`s`: `string`\]: `T`; \} \| `ArrayLike`\<`T`\>

Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.

##### Returns

`T`[]

##### Inherited from

`ResServerTools.values`

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

`ResServerTools.values`

***

### with()

> `static` **with**(`ctx`): *typeof* `ToolFunc`

Defined in: @isdk/ai-tools/packages/tool-func/dist/index.d.ts:515

Returns a static proxy with the provided context.

#### Parameters

##### ctx

`ToolFuncContext`

The context to use.

#### Returns

*typeof* `ToolFunc`

A static proxy of ToolFunc class.

#### Inherited from

`ResServerTools.with`
