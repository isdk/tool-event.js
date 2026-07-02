# @isdk/tool-func
一个用于创建、管理和执行模块化工具函数的 TypeScript 框架。适用于 AI Agent 工具调用、后端服务和插件系统。
## 核心概念
- **静态类 (`ToolFunc`)**: 充当全局注册表和执行器。提供 `run`, `register`, `get` 等静态方法。
- **实例 (`new ToolFunc()`)**: 代表一个具体的工具。包含元数据 (`name`, `params`, `description`) 和实现逻辑 (`func`)。
## 快速上手
```typescript
import { ToolFunc } from '@isdk/tool-func';
// 1. 定义并注册工具
new ToolFunc({
  name: 'getUser',
  description: '根据 ID 获取用户',
  params: { id: { type: 'string', required: true } },
  func: (params) => ({ id: params.id, name: '张三' }) // 若无需访问 this，可使用箭头函数
}).register();
// 2. 运行工具
async function main() {
  const user = await ToolFunc.run('getUser', { id: '123' });
  console.log(user); // { id: '123', name: '张三' }
}
```
## API 速查表 (面向 AI 重点)
### 1. 参数定义与调用
统一使用对象形式定义参数，调用时传入对应的参数对象。
```typescript
new ToolFunc({
  name: 'greet',
  params: { name: { type: 'string' } },
  func: (args) => `Hello ${args.name}`
}).register();
// 调用: ToolFunc.run('greet', { name: 'AI' })
```
### 2. 依赖管理 (`depends`)
工具间可声明依赖。依赖项会被自动注册，并支持局部别名。
```typescript
new ToolFunc({
  name: 'welcomeUser',
  depends: { fetcher: 'getUser' }, // 别名: 全局名
  func: function(params) { // 使用 function 以便访问 this
    // 使用 this.runAsSync 或 this.runAs 调用依赖
    const user = this.runAsSync('fetcher', { id: params.id });
    return `Welcome ${user.name}`;
  }
}).register();
```
### 3. 执行上下文 (`this.ctx`) 与 链式传播
用于传递 traceId、权限、AbortSignal 等运行时环境信息。**上下文会在工具函数的调用链上自动传播**：如果工具 A 内部调用了工具 B，B 会自动继承 A 的上下文。
```typescript
// 定义子工具：读取上下文
new ToolFunc({
  name: 'logTrace',
  func: function() { // 使用 function 以便访问 this
    // B 可以直接获取到调用链上游注入的 traceId
    console.log(`当前 Trace: ${this.ctx.traceId}`);
    return true;
  }
}).register();
// 定义父工具：内部调用子工具
new ToolFunc({
  name: 'parentAction',
  func: function() {
    // 调用链开始传播：parentAction -> logTrace
    this.runAs('logTrace');
    return 'Action completed';
  }
}).register();
// 运行时：在最外层注入上下文
ToolFunc.with({ traceId: 'TRACE-987' }).run('parentAction');
// 控制台将输出: 当前 Trace: TRACE-987
```
> **注意**：如需访问 `this.ctx` 或调用其他工具，**必须使用 `function` 关键字**定义 `func`，严禁使用箭头函数 `() =>`（会导致 `this` 绑定丢失）。如需阻断上下文传播，使用 `ToolFunc.run('name', params, { inheritContext: false })`。
### 4. 并发安全与影子实例
理解框架的并发模型对于编写无状态工具至关重要：
- **实例是共享的**：`ToolFunc` 实例在应用生命周期内是长生命周期的单例定义，多个并发请求会共享同一个实例。
- **上下文是隔离的**：为了保证并发安全，当您调用 `tool.with(ctx).run()` 或 `ToolFunc.with(ctx).run()` 时，框架会利用原型链创建一个极低开销的“影子实例”。每次调用都在独立的影子实例上执行，因此 `this.ctx` 是并发安全的。
**状态存放原则**：
- ✅ **瞬时/请求级状态** (如 userId, traceId, 临时计算结果)：必须存放在 `this.ctx` 中。
- ✅ **静态配置** (如只读常量)：可以在 `setup()` 中初始化并挂载到 `this` 上。
- ❌ **可变的持久状态**：绝对不要在 `func` 执行期间直接修改 `this` 上的属性，这会导致并发污染。
### 5. 异步与取消 (`makeToolFuncCancelable`)
长耗时任务支持中途取消。`run` 返回的 Promise 上会挂载 `task` 句柄。
```typescript
import { ToolFunc, makeToolFuncCancelable, AsyncFeatures } from '@isdk/tool-func';
const CancellableToolFunc = makeToolFuncCancelable(ToolFunc);
new CancellableToolFunc({
  name: 'longTask',
  asyncFeatures: AsyncFeatures.Cancelable,
  func: async function() { // 使用 function 以便访问 this
    const aborter = this.ctx.aborter; // 框架自动注入到上下文
    for (let i = 0; i < 100; i++) {
      await doWork();
      aborter.throwIfAborted(); // 检查中止状态，抛出 AbortError
    }
  }
}).register();
const p = ToolFunc.run('longTask');
setTimeout(() => p.task.abort('不再需要'), 1000); // 外部取消
```
### 6. 流式响应 (`stream`)
工具可返回 `ReadableStream` 以支持流式输出。
```typescript
new ToolFunc({
  name: 'streamData',
  stream: true, // 声明具备流式能力
  params: { stream: { type: 'boolean' } }, // 允许调用方选择是否流式
  func: function(params) {
    if (this.isStream(params)) { // 检查本次调用是否要求流式
      return new ReadableStream({
        start(controller) {
          controller.enqueue('chunk1');
          controller.close();
        }
      });
    }
    return 'normal response';
  }
}).register();
// 调用: const stream = await ToolFunc.run('streamData', { stream: true });
```
### 7. 生命周期与注册表控制
- **`setup()`**: 实例化时执行的一次性初始化钩子。
- **引用计数**: 多次 `register()` 同名工具会增加计数，`unregister()` 减少计数，归零才移除。
- **覆盖**: `register({ allowOverride: true })` 强制替换已有工具逻辑。
- **分层注册表**: 通过 `static { this.isolateRegistry(); }` 创建子注册表，实现工具作用域隔离和影子遮蔽。
---
## 给 AI Agent 的开发提示：
1. **`this` 指向**：定义 `func` 时，若需访问 `this.ctx` 或 `this.runAs`，**必须使用 `function` 关键字**，**严禁使用箭头函数 `() =>`**，否则 `this` 将无法正确绑定到工具实例。
2. **工具调用**：调用其他工具时，使用 `this.runAs('toolName', params)` 或 `this.runAsSync`。
3. **上下文透传**：传递上下文给子工具时，框架会自动传播 `this.ctx`，无需在调用 `this.runAs` 时手动透传上下文对象。
4. **状态安全**：由于并发环境下的影子实例机制，请始终通过 `this.ctx` 读写请求级状态，避免直接修改实例属性。
