
结合你项目里的用法，直接说结论和区别。

---

## Guard / Interceptor / Middleware 在 NestJS 里的区别

| 维度 | **Middleware** | **Guard** | **Interceptor** |
|------|----------------|-----------|------------------|
| **执行时机** | 最早，在路由匹配前后 | 路由匹配后、handler 前 | handler 前后都可包一层 |
| **职责** | 请求/响应的通用处理（CORS、body、日志等） | **是否允许访问**（鉴权、授权、权益） | 包装 handler、改请求/响应、日志、缓存等 |
| **依赖注入** | 要用 Nest 的 `MiddlewareConsumer` 等才能用 DI | ✅ 正常注入 Service | ✅ 正常注入 Service |
| **能否拿到「当前路由、参数、装饰器」** | 只有 `req`/`res`，没有 ExecutionContext | ✅ 有 ExecutionContext（handler、class、params、query） | ✅ 有 ExecutionContext |
| **是否适合做「放行/拒绝」** | 可以但不直观，要自己 `next()` 或结束响应 | ✅ 专门做「能/不能访问」，抛异常或返回 false 即拒绝 | 一般不做「能不能访问」的主逻辑 |

- **Middleware**：适合和「具体业务无关」的横切逻辑（日志、限流、body 解析）；要按「哪个路由、哪个参数」做收费判断会很难看，且用 DI 也不方便。  
- **Interceptor**：适合在「已经允许访问」之后做统一包装（改返回结构、日志、缓存）；用来决定 402 会模糊「谁在决定能不能访问」的职责。  
- **Guard**：就是为「是否允许访问」设计的，能拿路由、参数、装饰器，能注入 `EntitlementService`，抛 402 也很自然。

所以：**收费/权益校验更适合做成 Guard，而不是 Interceptor 或 Middleware。**

---

## 最佳方案思路：用 Guard + 装饰器统一收费逻辑

你已经有类似实现：

- `server/src/scales/guards/popular-major-entitlement.guard.ts`：按 `params.popularMajorId` 做权益校验并扣减免费次数。  
- `server/src/common/guards/entitlement.guard.ts`：通过 `@RequireEntitlement()` 元数据决定是否做「热门专业」权益校验。

推荐思路是：**把「是否收费」统一成「权益 Guard + 装饰器」，而不是 Interceptor 或 Middleware。**

### 1. 统一用 Guard 做「收费判断」

- **只做一件事**：根据「当前用户 + 当前资源（如 popularMajorId / majorCode）」调用 `EntitlementService`：
  - 无权益 → 抛 402（`PAYMENT_REQUIRED`）；
  - 若是免费额度 → 调用 `recordFreeViewByUserId` 扣一次。
- 不在 Guard 里写业务逻辑（例如查量表列表），只做「允许/拒绝访问」。

### 2. 用装饰器控制「哪些接口要校验」

- 不是所有接口都要收费校验（例如普通量表、非热门专业详情等不需要）。
- 用**自定义装饰器**标记需要校验的路由，例如：
  - `@RequireEntitlement({ type: 'popular_major', paramKey: 'popularMajorId' })`  
  或  
  - `@RequireEntitlement({ type: 'popular_major', paramKey: 'majorCode' })`（若参数是 majorCode）。
- Guard 里用 `Reflector` 读该装饰器：
  - 有标记 → 做权益校验（并扣减免费次数）；
  - 无标记 → 直接放行。

这样「收费逻辑」集中在一个 Guard 里，**哪些接口要收费**由装饰器声明，清晰可维护。

### 3. 参数来源要统一、可配置

- 有的接口是 **path 参数**：`popular-major/:popularMajorId` 或 `element/:elementId/popular-major/:popularMajorId`；
- 有的可能是 **query**：`majorCode=xxx`。
- Guard 里根据装饰器里的 `paramKey`（如 `popularMajorId` 或 `majorCode`）从 `request.params` 或 `request.query` 取 id/code；
- 若需要 **popularMajorId → majorCode**，可注入 `ScalesService.getPopularMajorCodeById`，或在 Pay 模块里提供 `getMajorCodeByPopularMajorId`（你 common guard 里已有类似思路），避免每个 controller 自己写一遍。

### 4. 和「登录」的关系

- 收费 Guard 应放在**已认证**之后：即先有「当前用户」（如 `request.user.id`），再谈权益。
- 若未登录，Guard 里直接抛 401（或你项目里用的未登录异常），不继续做权益和扣减。

### 5. 不推荐 Interceptor / Middleware 做收费的原因简述

- **Interceptor**：更适合「通过之后」的统一处理；用 interceptor 抛 402 会让人误以为「是包装层在拒绝」，语义上不如 Guard 清晰。  
- **Middleware**：拿不到 Nest 的 ExecutionContext，按「路由 + 参数」做不同校验很麻烦，且用 `EntitlementService` 要额外适配 DI，不值得。

---

## 小结

- **区别**：Guard 管「能不能访问」（含收费），Interceptor 管「通过后的包装」，Middleware 管「最外层的通用处理」；收费是典型的「能不能访问」逻辑。  
- **最佳方案**：  
  - 用 **Guard** 做「收费/权益校验 + 免费次数扣减」；  
  - 用 **装饰器**（如 `@RequireEntitlement(...)`）标记需要校验的路由；  
  - 在需要收费的接口上挂该 Guard（或全局挂 Guard + 用装饰器/元数据排除不需要的），这样「所有需要判断是否收费的接口」都走同一套逻辑，易维护、职责清晰。  

你当前项目里已经有 `PopularMajorEntitlementGuard` 和 `EntitlementGuard` + `@RequireEntitlement`，最佳路线就是：**统一收敛到一套 Guard + 装饰器**，让所有「需要收费判断」的接口都走这一套，而不是再引入 Interceptor 或 Middleware 来做收费。