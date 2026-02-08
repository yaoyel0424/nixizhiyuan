# 安全方案说明文档

## 概述

本安全方案针对服务器遭受的大量恶意扫描和攻击请求，实现了多层防护机制，包括：

1. **恶意路径检测和阻止** - 自动识别并阻止常见攻击路径
2. **IP 封禁机制** - 自动封禁恶意 IP
3. **速率限制** - 防止暴力破解和 DDoS 攻击
4. **安全日志记录** - 记录所有安全事件
5. **敏感信息保护** - 减少错误响应中的信息泄露

## 功能模块

### 1. 安全中间件 (SecurityMiddleware)

**位置**: `server/src/common/middleware/security.middleware.ts`

**功能**:
- 检测恶意 URL 路径（如 `.git`, `.env`, Laravel 漏洞路径等）
- 检测恶意请求负载（如 `androxgh0st` 等恶意 payload）
- **SQL 注入防护**：对 Query 与 Body 做常见 SQL 注入模式检测（如 `union select`、`drop table`、`' or '1'='1` 等），命中即**拒绝并立即封禁该 IP**（不做速率限制）
- 识别可疑 User-Agent（扫描工具、爬虫等）
- 自动记录安全威胁并触发 IP 封禁

**检测的恶意模式**:
- Laravel 相关漏洞路径
- Git 信息泄露路径
- 敏感文件扫描（`.env`, `config.php` 等）
- PHP 相关漏洞路径
- 网络设备扫描路径
- 恶意 payload

### 2. IP 封禁守卫 (IpBlockGuard)

**位置**: `server/src/common/guards/ip-block.guard.ts`

**功能**:
- 检查请求 IP 是否被封禁
- 自动封禁违规 IP（违规次数超过阈值时）
- 支持手动封禁/解封 IP
- 使用 Redis 存储封禁列表

**配置项** (环境变量):
- `SECURITY_IP_BLOCK_DURATION`: IP 封禁时长（秒），默认 3600 秒（1小时）
- `SECURITY_MAX_VIOLATIONS`: 触发封禁的最大违规次数，默认 5 次
- `SECURITY_VIOLATION_WINDOW`: 违规计数窗口（秒），默认 300 秒（5分钟）

**工作原理**:
1. 每次检测到恶意请求，记录违规行为
2. 在时间窗口内累计违规次数
3. 超过阈值时自动封禁 IP
4. 封禁的 IP 在指定时长内无法访问

### 3. DoS 防护守卫 (RateLimitGuard)

**位置**: `server/src/common/guards/rate-limit.guard.ts`

**功能**:
- **超限即封禁 IP**：每个 IP 在时间窗内请求超过阈值时，**直接封禁该 IP**（调用 IpBlockGuard），并返回 403，不做 429 速率限制
- 使用 Redis 统计请求次数
- 支持为不同接口配置不同阈值；支持 `@SkipRateLimit()` 跳过

**配置项** (环境变量):
- `RATE_LIMIT_MAX_REQUESTS`: 默认最大请求数，默认 300 次
- `RATE_LIMIT_WINDOW_SECONDS`: 默认时间窗口（秒），默认 60 秒

**DoS 防护**：请求超限时直接封禁 IP（403），不返回 429。另在 `main.ts` 中设置请求体大小上限（默认 1MB），防止超大 body 导致 DoS。

**使用示例**:
```typescript
// 在 Controller 中使用
@Get('sensitive-endpoint')
@RateLimit(10, 60) // 60秒内最多10次请求
async sensitiveEndpoint() {
  // ...
}

// 跳过速率限制
@Get('public-endpoint')
@SkipRateLimit()
async publicEndpoint() {
  // ...
}
```

### 4. 安全日志服务 (SecurityLogService)

**位置**: `server/src/common/services/security-log.service.ts`

**功能**:
- 记录所有安全威胁事件
- 自动触发 IP 封禁逻辑
- 提供详细的威胁信息（IP、URL、User-Agent 等）

**日志级别**:
- `MALICIOUS_REQUEST`: 恶意请求
- `SUSPICIOUS_ACTIVITY`: 可疑活动

### 5. 异常过滤器优化

**位置**: `server/src/common/filters/all-exceptions.filter.ts`

**优化内容**:
- 404 错误降级为 debug 级别，减少日志噪音
- 生产环境不暴露具体路径，减少信息泄露
- 统一错误响应格式

## 配置说明

### 环境变量配置

在 `.env` 文件中添加以下配置：

```env
# Redis 配置（必需）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# IP 封禁配置
SECURITY_IP_BLOCK_DURATION=3600        # IP 封禁时长（秒），默认 1 小时
SECURITY_MAX_VIOLATIONS=5               # 触发封禁的最大违规次数，默认 5 次
SECURITY_VIOLATION_WINDOW=300          # 违规计数窗口（秒），默认 5 分钟

# 速率限制配置
RATE_LIMIT_MAX_REQUESTS=100            # 默认最大请求数，默认 100 次
RATE_LIMIT_WINDOW_SECONDS=60           # 默认时间窗口（秒），默认 60 秒
```

### 模块注册

安全模块已在 `app.module.ts` 中自动注册：

```typescript
imports: [
  // ...
  RedisModule,      // 启用 Redis（安全功能需要）
  SecurityModule,   // 安全模块
  // ...
],
providers: [
  // ...
  {
    provide: APP_GUARD,
    useClass: IpBlockGuard,     // IP 封禁守卫
  },
  {
    provide: APP_GUARD,
    useClass: RateLimitGuard,   // 速率限制守卫
  },
],
```

中间件已在 `app.module.ts` 中注册：

```typescript
configure(consumer: MiddlewareConsumer) {
  consumer.apply(SecurityMiddleware).forRoutes('*');  // 安全中间件（最先执行）
  consumer.apply(helmet()).forRoutes('*');            // 安全头
  consumer.apply(compression()).forRoutes('*');       // 压缩
}
```

## 工作流程

1. **请求到达** → SecurityMiddleware 检测恶意路径和负载
2. **恶意请求** → 记录安全威胁 → 触发 IP 违规记录
3. **IP 封禁检查** → IpBlockGuard 检查 IP 是否被封禁
4. **速率限制** → RateLimitGuard 检查请求频率
5. **正常请求** → 继续处理
6. **违规累计** → 超过阈值自动封禁 IP

## 监控和管理

### 查看封禁的 IP

可以通过 Redis 查看被封禁的 IP：

```bash
# 连接 Redis
redis-cli

# 查看所有封禁的 IP
KEYS ip_block:*

# 查看特定 IP 的封禁信息
GET ip_block:192.168.1.100
TTL ip_block:192.168.1.100
```

### 手动封禁/解封 IP

可以通过代码手动封禁或解封 IP：

```typescript
// 在 Service 中注入 IpBlockGuard
constructor(private readonly ipBlockGuard: IpBlockGuard) {}

// 封禁 IP
await this.ipBlockGuard.blockIp('192.168.1.100', 3600); // 封禁1小时

// 解封 IP
await this.ipBlockGuard.unblockIp('192.168.1.100');
```

### 查看安全日志

安全威胁日志会记录在应用日志中，查找包含 `[安全威胁]` 的日志条目。

## 注意事项

1. **Redis 依赖**: 安全功能需要 Redis 服务正常运行，如果 Redis 连接失败，相关功能会降级（不阻止请求，但会记录警告）

2. **性能影响**: 
   - 安全中间件在请求链的最前端，对性能影响最小
   - Redis 操作是异步的，不会阻塞请求处理
   - 速率限制使用 Redis，支持分布式部署

3. **误封处理**: 
   - 如果合法 IP 被误封，可以通过手动解封或等待封禁时间到期
   - 建议根据实际情况调整 `SECURITY_MAX_VIOLATIONS` 阈值

4. **日志管理**: 
   - 404 错误已降级为 debug 级别，减少日志噪音
   - 安全威胁日志使用 warn 级别，便于监控和告警

5. **生产环境**: 
   - 建议在生产环境启用所有安全功能
   - 定期检查安全日志，分析攻击模式
   - 根据实际情况调整配置参数

## 扩展建议

1. **白名单机制**: 可以为特定 IP 或路径添加白名单，避免误封
2. **告警通知**: 集成邮件或短信通知，当检测到严重威胁时及时通知
3. **统计分析**: 记录攻击统计，分析攻击来源和模式
4. **自动解封**: 实现自动解封机制，避免长期封禁
5. **地理位置过滤**: 根据 IP 地理位置进行过滤（需要 IP 地理位置数据库）

## 更新日志

- 2025-01-XX: 初始版本，实现基础安全防护功能

