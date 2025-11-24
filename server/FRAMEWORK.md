# NestJS 11 后台框架结构说明

## 一、技术栈

### 核心框架
- **NestJS 11**: 基于 TypeScript 的 Node.js 框架，提供 IOC 容器和模块化架构
- **TypeScript**: 类型安全的 JavaScript 超集

### 数据库
- **PostgreSQL**: 关系型数据库
- **TypeORM**: ORM 框架，支持数据库迁移和实体管理
- **Redis**: 内存数据库，用于缓存和会话管理
- **node-redis**: Redis 官方 Node.js 客户端，用于连接和操作 Redis

### 认证授权
- **@nestjs/jwt**: JWT 令牌生成和验证
- **@nestjs/passport**: 认证策略管理
- **passport-jwt**: JWT 认证策略
- **bcrypt**: 密码加密

### 数据验证
- **class-validator**: 基于装饰器的数据验证
- **class-transformer**: 对象转换和序列化

### 日志
- **pino**: 高性能日志库（推荐用于生产环境，性能最优）
- **nestjs-pino**: NestJS Pino 集成

### 部署
- **Docker**: 容器化部署
- **Docker Compose**: 多容器编排

### 其他工具
- **helmet**: HTTP 安全头设置
- **compression**: 响应压缩
- **serve-static**: 静态文件服务

---

## 二、项目目录结构

```
server/
├── src/                          # 源代码目录
│   ├── main.ts                   # 应用入口文件
│   ├── app.module.ts             # 根模块
│   │
│   ├── common/                   # 公共模块
│   │   ├── decorators/           # 自定义装饰器
│   │   │   ├── roles.decorator.ts        # 角色装饰器
│   │   │   ├── public.decorator.ts       # 公开路由装饰器
│   │   │   ├── current-user.decorator.ts # 当前用户装饰器
│   │   │   └── api-response.decorator.ts # API 响应装饰器
│   │   │
│   │   ├── filters/              # 异常过滤器
│   │   │   ├── http-exception.filter.ts  # HTTP 异常过滤器
│   │   │   └── all-exceptions.filter.ts  # 全局异常过滤器
│   │   │
│   │   ├── guards/               # 守卫
│   │   │   ├── jwt-auth.guard.ts         # JWT 认证守卫
│   │   │   └── roles.guard.ts            # 角色权限守卫
│   │   │
│   │   ├── interceptors/         # 拦截器
│   │   │   ├── logging.interceptor.ts         # 日志拦截器
│   │   │   ├── response-format.interceptor.ts # 响应格式统一拦截器（推荐命名）
│   │   │   └── timeout.interceptor.ts         # 超时拦截器
│   │   │
│   │   ├── pipes/                # 管道
│   │   │   └── validation.pipe.ts        # 数据验证管道
│   │   │
│   │   ├── interfaces/           # 接口定义
│   │   │   ├── pagination.interface.ts   # 分页接口
│   │   │   └── response.interface.ts     # 响应接口
│   │   │
│   │   ├── utils/                # 工具函数
│   │   │   ├── logger.util.ts            # 日志工具
│   │   │   ├── hash.util.ts              # 加密工具
│   │   │   └── date.util.ts              # 日期工具
│   │   │
│   │   └── constants/            # 常量定义
│   │       ├── error-code.constant.ts    # 错误码常量
│   │       └── app.constant.ts           # 应用常量
│   │
│   ├── config/                   # 配置模块
│   │   ├── config.module.ts      # 配置模块
│   │   ├── database.config.ts    # 数据库配置
│   │   ├── redis.config.ts       # Redis 配置
│   │   ├── jwt.config.ts         # JWT 配置
│   │   └── app.config.ts         # 应用配置
│   │
│   ├── database/                 # 数据库模块
│   │   ├── database.module.ts    # 数据库模块
│   │   ├── migrations/           # 数据库迁移文件
│   │   │   └── 1234567890-CreateUserTable.ts
│   │   └── seeds/                # 数据库种子文件
│   │       └── user.seed.ts
│   │
│   ├── redis/                    # Redis 模块
│   │   ├── redis.module.ts       # Redis 模块
│   │   ├── redis.service.ts      # Redis 服务
│   │   └── redis.interface.ts    # Redis 接口
│   │
│   ├── logger/                   # 日志模块
│   │   ├── logger.module.ts      # 日志模块
│   │   ├── logger.service.ts     # 日志服务
│   │   └── logger.interface.ts   # 日志接口
│   │
│   ├── auth/                     # 认证授权模块
│   │   ├── auth.module.ts        # 认证模块
│   │   ├── auth.controller.ts    # 认证控制器
│   │   ├── auth.service.ts       # 认证服务
│   │   ├── strategies/           # 认证策略
│   │   │   └── jwt.strategy.ts   # JWT 策略
│   │   ├── dto/                  # 数据传输对象
│   │   │   ├── login.dto.ts      # 登录 DTO
│   │   │   ├── register.dto.ts   # 注册 DTO
│   │   │   └── refresh-token.dto.ts # 刷新令牌 DTO
│   │   └── interfaces/           # 接口定义
│   │       └── jwt-payload.interface.ts # JWT 载荷接口
│   │
│   ├── users/                    # 用户模块（示例模块）
│   │   ├── users.module.ts       # 用户模块
│   │   ├── users.controller.ts   # 用户控制器
│   │   ├── users.service.ts      # 用户服务
│   │   ├── entities/             # 实体定义
│   │   │   └── user.entity.ts    # 用户实体
│   │   ├── dto/                  # 数据传输对象
│   │   │   ├── create-user.dto.ts        # 创建用户 DTO（请求验证）
│   │   │   ├── update-user.dto.ts        # 更新用户 DTO（请求验证）
│   │   │   ├── query-user.dto.ts         # 查询用户 DTO（请求验证）
│   │   │   └── user-response.dto.ts      # 用户响应 DTO（序列化，使用 @Expose/@Exclude）
│   │   └── repositories/         # 自定义仓储层（可选）
│   │       └── users.repository.ts       # 用户自定义仓储（封装复杂查询逻辑）
│   │
│   └── health/                   # 健康检查模块
│       ├── health.module.ts      # 健康检查模块
│       └── health.controller.ts  # 健康检查控制器
│
├── test/                         # 测试文件
│   ├── unit/                     # 单元测试
│   ├── e2e/                      # 端到端测试
│   └── fixtures/                 # 测试数据
│
├── .env.example                  # 环境变量示例
├── .env                          # 环境变量（不提交到版本控制）
├── .gitignore                    # Git 忽略文件
├── .dockerignore                 # Docker 忽略文件
├── docker-compose.yml            # Docker Compose 配置
├── Dockerfile                    # Docker 镜像构建文件
├── nest-cli.json                 # NestJS CLI 配置
├── package.json                  # 项目依赖配置
├── tsconfig.json                 # TypeScript 配置
├── tsconfig.build.json           # TypeScript 构建配置
├── ormconfig.ts                  # TypeORM 配置
└── README.md                     # 项目说明文档
```

---

## 三、核心模块功能说明

### 1. Common 模块（公共模块）

#### 1.1 Decorators（装饰器）
- **@Roles()**: 定义路由所需的角色权限
- **@Public()**: 标记公开路由，跳过 JWT 认证
- **@CurrentUser()**: 获取当前登录用户信息
- **@ApiResponse()**: 统一 API 响应格式装饰器

#### 1.2 Filters（异常过滤器）
- **HttpExceptionFilter**: 处理 HTTP 异常，统一错误响应格式
- **AllExceptionsFilter**: 全局异常捕获，处理所有未捕获的异常

#### 1.3 Guards（守卫）
- **JwtAuthGuard**: JWT 认证守卫，验证请求中的 JWT 令牌
- **RolesGuard**: 角色权限守卫，验证用户是否有访问权限

#### 1.4 Interceptors（拦截器）
- **LoggingInterceptor**: 记录请求日志，包括请求路径、方法、参数、响应时间
- **ResponseFormatInterceptor**（推荐命名，原名 transform.interceptor.ts）: 统一响应格式转换，将响应包装成标准格式 `{success, code, message, data, timestamp}`
- **TimeoutInterceptor**: 请求超时处理

#### 1.5 Pipes（管道）
- **ValidationPipe**: 数据验证管道，使用 class-validator 验证 DTO

#### 1.6 Interfaces（接口）
- **PaginationInterface**: 分页查询接口定义
- **ResponseInterface**: 统一响应接口定义

### 2. Config 模块（配置模块）

#### 功能说明
- 集中管理应用配置
- 支持环境变量配置
- 提供类型安全的配置访问
- 配置项包括：
  - 数据库连接配置（PostgreSQL）
  - Redis 连接配置
  - JWT 密钥和过期时间
  - 应用端口、环境等

### 3. Database 模块（数据库模块）

#### 功能说明
- TypeORM 配置和初始化
- 数据库连接管理
- 数据库迁移管理
- 数据库种子数据管理
- 支持多数据库连接（如需要）

### 4. Redis 模块（Redis 模块）

#### 功能说明
- 基于 **node-redis** 客户端实现 Redis 连接和操作
- Redis 连接管理（连接池、重连机制）
- 缓存服务封装（get、set、del、exists 等常用操作）
- 会话存储（存储 Refresh Token、用户会话等）
- 分布式锁（防止并发问题）
- 发布订阅功能（消息通知、事件驱动）

### 5. Logger 模块（日志模块）

#### 功能说明
- **Pino**：高性能日志库（推荐用于生产环境）
  - 性能最优，异步日志写入，不阻塞主线程
  - 结构化日志输出（JSON 格式）
  - 日志级别：error, warn, info, debug, verbose
  - 日志输出：控制台、文件
  - 日志格式：JSON 格式，包含时间戳、级别、消息、上下文
  - 日志轮转：按日期和大小自动轮转
  - 支持日志级别过滤
  - 适合高并发场景
  - 资源占用低，性能优异

### 6. Auth 模块（认证授权模块）

#### 功能说明
- 用户注册
- 用户登录（生成 JWT）
- 令牌刷新
- 用户登出
- JWT 策略实现
- 密码加密（bcrypt）

#### 认证流程
1. 用户登录 → 验证用户名密码
2. 生成 JWT Access Token 和 Refresh Token
3. Access Token 存储在内存，Refresh Token 存储在 Redis
4. 后续请求携带 Access Token
5. Token 过期后使用 Refresh Token 刷新

### 7. Users 模块（用户模块 - 示例）

#### 功能说明
- 用户 CRUD 操作
- 用户查询（支持分页、排序、筛选）
- 用户实体定义
- 用户 DTO 定义和验证
- 用户仓储层封装

#### 实体定义
- User Entity: 用户实体，包含 id, username, email, password, roles 等字段

#### DTO 定义
- **CreateUserDto**: 创建用户数据传输对象（使用 `class-validator` 装饰器进行验证）
- **UpdateUserDto**: 更新用户数据传输对象（使用 `class-validator` 装饰器进行验证）
- **QueryUserDto**: 查询用户数据传输对象（分页、排序、筛选，使用 `class-validator` 装饰器进行验证）
- **UserResponseDto**: 用户响应数据传输对象（使用 `class-transformer` 的 `@Expose()` 和 `@Exclude()` 进行序列化，不包含敏感信息如密码）

#### Repository 层说明
- **自定义仓储（Custom Repository）**：用于封装复杂的查询逻辑，保持 Service 层代码精简
- TypeORM 推荐使用内置的 `Repository` 或 `DataSource` 实例
- 如果业务逻辑简单，可以直接在 Service 中使用 TypeORM 的 Repository
- 复杂查询（如多表关联、复杂条件查询）建议封装到自定义仓储中

### 8. Health 模块（健康检查模块）

#### 功能说明
- 应用健康检查
- 数据库连接检查
- Redis 连接检查
- 返回服务状态信息

---

## 四、数据验证机制

### DTO 验证和序列化

#### 请求 DTO（Request DTO）
- 使用 `class-validator` 装饰器进行字段验证
- 验证规则包括：
  - `@IsString()`: 字符串验证
  - `@IsEmail()`: 邮箱验证
  - `@IsNotEmpty()`: 非空验证
  - `@MinLength()`: 最小长度验证
  - `@MaxLength()`: 最大长度验证
  - `@IsOptional()`: 可选字段
  - `@IsEnum()`: 枚举验证
  - 自定义验证装饰器

#### 响应 DTO（Response DTO）
- 使用 `class-transformer` 进行对象序列化
- 使用 `@Expose()` 明确暴露需要返回的字段
- 使用 `@Exclude()` 排除敏感信息（如密码）
- **不使用** `class-validator` 的验证装饰器（响应不需要验证）
- 示例：
  ```typescript
  export class UserResponseDto {
    @Expose()
    id: number;
    
    @Expose()
    username: string;
    
    @Expose()
    email: string;
    
    @Exclude() // 排除密码字段
    password: string;
  }
  ```

### 验证流程
1. 请求到达控制器
2. ValidationPipe 拦截请求
3. 使用 class-validator 验证请求 DTO
4. 验证失败返回详细错误信息
5. 验证通过继续处理请求
6. 返回数据时使用 class-transformer 序列化响应 DTO

---

## 五、异常处理机制

### 异常类型
- **HttpException**: HTTP 异常（400, 401, 403, 404, 500 等），NestJS 内置异常基类
- **BusinessException**: 业务异常（自定义业务错误），继承自 `HttpException`，便于全局异常过滤器统一捕获和处理
- **ValidationException**: 验证异常（数据验证失败），继承自 `HttpException`

### 自定义异常实现
```typescript
// BusinessException 示例
export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: number = HttpStatus.BAD_REQUEST,
    errorCode?: string,
  ) {
    super({ message, errorCode }, statusCode);
  }
}
```

### 异常处理流程
1. 业务层抛出异常
2. 全局异常过滤器捕获
3. 统一格式化错误响应
4. 记录错误日志
5. 返回标准错误响应格式

### 错误响应格式
```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "错误描述",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

---

## 六、JWT 授权机制

### JWT 结构
- **Access Token**: 短期有效（如 15 分钟），用于 API 访问
- **Refresh Token**: 长期有效（如 7 天），用于刷新 Access Token

### 授权流程
1. 用户登录获取 Token
2. 客户端存储 Token
3. 请求时在 Header 中携带：`Authorization: Bearer <token>`
4. JwtAuthGuard 验证 Token
5. 验证通过提取用户信息
6. RolesGuard 验证用户权限
7. 权限验证通过允许访问

### 权限控制
- 基于角色的访问控制（RBAC）
- 使用 `@Roles()` 装饰器定义所需角色
- RolesGuard 验证用户角色

---

## 七、日志系统

### 日志级别
- **error**: 错误日志（系统错误、异常）
- **warn**: 警告日志（潜在问题）
- **info**: 信息日志（重要操作、请求记录）
- **debug**: 调试日志（开发调试信息）
- **verbose**: 详细日志（详细执行信息）

### 日志内容
- 请求日志：方法、路径、参数、IP、用户、响应时间
- 错误日志：错误堆栈、错误上下文
- 业务日志：关键业务操作记录

### 日志输出
- 开发环境：控制台输出（彩色格式）
- 生产环境：文件输出（JSON 格式）
- 日志轮转：按日期和大小自动轮转

---

## 八、响应格式（ViewModel）

### 成功响应格式
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    // 业务数据
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 分页响应格式
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "查询成功",
  "data": {
    "items": [],
    "meta": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 错误响应格式
```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "错误描述",
  "errors": [
    {
      "field": "email",
      "message": "邮箱格式不正确"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

---

## 九、IOC 容器机制

### 依赖注入
- NestJS 内置 IOC 容器
- 使用 `@Injectable()` 装饰器标记可注入类
- 使用构造函数注入依赖
- 支持单例、请求作用域等生命周期

### 模块化设计
- 每个功能模块独立封装
- 模块间通过 exports 和 imports 管理依赖
- 清晰的模块边界和职责划分

---

## 十、跨域和静态文件访问

### CORS 配置
- 在 `main.ts` 中启用 CORS
- 支持配置允许的源、方法、请求头
- 支持凭证传递（credentials）
- 生产环境建议明确指定允许的域名

### 静态文件服务
- 使用 `@nestjs/serve-static` 提供静态文件服务
- 支持配置静态资源目录
- 支持配置静态资源路径前缀
- 可用于提供上传的文件、图片等静态资源访问

### 配置示例
```typescript
// main.ts
app.enableCors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
});

// app.module.ts
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', 'uploads'),
  serveRoot: '/uploads',
});
```

---

## 十一、Docker 部署配置

### Docker Compose 服务
1. **app**: NestJS 应用服务
2. **postgres**: PostgreSQL 数据库服务
3. **redis**: Redis 缓存服务

### 网络配置
- 服务间通过 Docker 网络通信
- 端口映射到宿主机

### 数据持久化
- PostgreSQL 数据卷挂载
- Redis 数据卷挂载（可选）

### 环境变量
- 通过 .env 文件管理环境变量
- Docker Compose 自动加载环境变量

---

## 十二、开发工作流

### 本地开发
1. 安装依赖：`npm install`
2. 配置环境变量：复制 `.env.example` 为 `.env`
3. 启动数据库和 Redis：`docker-compose up -d postgres redis`
4. 运行数据库迁移：`npm run migration:run`
5. 启动开发服务器：`npm run start:dev`

### 生产部署
1. 构建 Docker 镜像：`docker-compose build`
2. 启动所有服务：`docker-compose up -d`
3. 运行数据库迁移：`docker-compose exec app npm run migration:run`
4. 查看日志：`docker-compose logs -f`

---

## 十三、API 路由设计

### 路由前缀
- 所有 API 路由前缀：`/api/v1`

### 路由示例
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/refresh` - 刷新令牌
- `POST /api/v1/auth/logout` - 用户登出
- `GET /api/v1/users` - 获取用户列表（分页）
- `GET /api/v1/users/:id` - 获取用户详情
- `POST /api/v1/users` - 创建用户
- `PATCH /api/v1/users/:id` - 更新用户
- `DELETE /api/v1/users/:id` - 删除用户
- `GET /api/v1/health` - 健康检查

---

## 十四、安全特性

### 认证安全
- JWT Token 加密存储
- Refresh Token 存储在 Redis
- Token 过期自动失效
- 密码使用 bcrypt 加密

### 数据安全
- SQL 注入防护（TypeORM 参数化查询）
- XSS 防护（数据验证和转义）
- CSRF 防护（JWT Token 机制）

### 接口安全
- 请求频率限制（可集成 rate-limit）
- 敏感接口权限验证
- 请求参数验证

---

## 十五、性能优化

### 数据库优化
- 数据库连接池配置
- 查询优化（索引、分页）
- 数据库迁移管理

### 缓存优化
- Redis 缓存热点数据
- 缓存失效策略
- 缓存预热

### 代码优化
- 异步处理
- 请求超时控制
- 响应压缩

---

## 十六、扩展性设计

### 模块化架构
- 功能模块独立，易于扩展
- 清晰的模块边界
- 统一的接口规范

### 插件化设计
- 中间件可插拔
- 策略模式支持多种认证方式
- 可扩展的异常处理

### 微服务就绪
- 模块化设计便于拆分
- 支持服务间通信
- 可集成消息队列

---

## 十七、测试支持

### 测试类型
- 单元测试：测试单个函数和类
- 集成测试：测试模块间交互
- E2E 测试：测试完整业务流程

### 测试工具
- Jest：测试框架
- Supertest：HTTP 断言库
- 测试数据库隔离

---

## 十八、其他最佳实践

### 18.1 代码规范和质量
- **ESLint**: 代码风格检查
- **Prettier**: 代码格式化
- **Husky**: Git hooks 管理
- **lint-staged**: 提交前代码检查
- **Commitlint**: 提交信息规范（Conventional Commits）

### 18.2 环境配置管理
- 使用 `.env` 文件管理环境变量
- 支持多环境配置（development, staging, production）
- 使用 `@nestjs/config` 进行配置验证
- 敏感信息使用环境变量，不硬编码

### 18.3 API 文档
- **Swagger/OpenAPI**: 自动生成 API 文档
- 使用 `@nestjs/swagger` 装饰器标注 API
- 支持在线测试 API
- 自动生成 TypeScript 客户端代码

### 18.4 请求追踪
- 为每个请求生成唯一 Request ID
- 在日志中记录 Request ID，便于问题追踪
- 在响应头中返回 Request ID

### 18.5 数据库事务管理
- 使用 TypeORM 的 `@Transaction()` 装饰器
- 支持嵌套事务
- 自动回滚机制

### 18.6 软删除
- 实体支持软删除（deletedAt 字段）
- 查询时自动过滤已删除数据
- 支持恢复已删除数据

### 18.7 审计日志
- 记录数据变更历史
- 记录操作人、操作时间、操作类型
- 支持数据版本管理

### 18.8 限流和防护
- **Rate Limiting**: 请求频率限制
- **Helmet**: HTTP 安全头设置
- **Throttler**: NestJS 限流模块
- 防止暴力破解和 DDoS 攻击

### 18.9 优雅关闭
- 实现优雅关闭机制
- 关闭前完成正在处理的请求
- 关闭数据库连接
- 关闭 Redis 连接

### 18.10 监控和告警
- 集成 APM（应用性能监控）
- 集成错误追踪（如 Sentry）
- 健康检查端点
- 指标收集（Prometheus）

### 18.11 任务队列
- 使用 Bull/BullMQ 处理异步任务
- 支持任务重试
- 支持任务优先级
- 支持任务调度

### 18.12 文件上传
- 支持单文件和多文件上传
- 文件类型验证
- 文件大小限制
- 文件存储（本地或云存储）

---

## 总结

本框架提供了完整的 NestJS 11 后台开发解决方案，包括：

✅ **IOC 容器**：NestJS 内置依赖注入
✅ **ORM**：TypeORM + PostgreSQL
✅ **NoSQL**：Redis 缓存和会话管理
✅ **日志系统**：Pino 高性能日志记录
✅ **异常处理**：全局异常过滤器（自定义业务异常继承 HttpException）
✅ **JWT 授权**：完整的认证授权机制
✅ **路由管理**：RESTful API 路由设计
✅ **ViewModel**：统一的响应格式（ResponseFormatInterceptor）
✅ **数据验证**：DTO 验证机制（请求 DTO 验证，响应 DTO 序列化）
✅ **跨域和静态文件**：CORS 配置和静态资源服务
✅ **Repository 模式**：自定义仓储封装复杂查询逻辑
✅ **Docker 部署**：Docker Compose 一键部署

### 核心最佳实践
- ✅ 请求 DTO 使用 `class-validator` 进行验证
- ✅ 响应 DTO 使用 `class-transformer` 进行序列化
- ✅ 自定义异常继承 `HttpException` 便于统一处理
- ✅ 自定义仓储封装复杂查询，保持 Service 层精简
- ✅ 拦截器使用具体命名（如 ResponseFormatInterceptor）
- ✅ 生产环境推荐使用 Pino 日志库提升性能

框架采用模块化设计，代码结构清晰，易于维护和扩展，适合中大型项目开发。

