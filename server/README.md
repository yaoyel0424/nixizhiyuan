# NestJS 11 后台框架

基于 NestJS 11 的完整后台开发框架，包含 IOC、ORM、日志、异常处理、JWT 授权、路由、ViewModel、数据验证、Redis 等完整功能。

## 技术栈

- **NestJS 11**: 基于 TypeScript 的 Node.js 框架
- **PostgreSQL**: 关系型数据库
- **TypeORM**: ORM 框架
- **Redis**: 内存数据库（使用 node-redis）
- **Pino**: 高性能日志库
- **JWT**: 认证授权
- **Docker**: 容器化部署

## 功能特性

✅ IOC 容器：NestJS 内置依赖注入  
✅ ORM：TypeORM + PostgreSQL  
✅ NoSQL：Redis 缓存和会话管理  
✅ 日志系统：Pino 高性能日志记录  
✅ 异常处理：全局异常过滤器  
✅ JWT 授权：完整的认证授权机制  
✅ 路由管理：RESTful API 路由设计  
✅ ViewModel：统一的响应格式  
✅ 数据验证：DTO 验证机制  
✅ 跨域和静态文件：CORS 配置和静态资源服务  
✅ Repository 模式：自定义仓储封装复杂查询逻辑  
✅ Docker 部署：Docker Compose 一键部署

## 快速开始

### 环境要求

- Node.js >= 18
- PostgreSQL >= 12
- Redis >= 6
- Docker & Docker Compose（可选）

### 安装依赖

```bash
npm install --legacy-peer-deps
```

### 配置环境变量

在 `server` 目录下创建 `.env` 文件：

**方法 1：手动创建**
在 `server` 目录下创建 `.env` 文件，参考 [ENV_SETUP.md](./ENV_SETUP.md) 中的配置模板。

**方法 2：使用命令行（Windows PowerShell）**
```powershell
cd server
# 参考 ENV_SETUP.md 中的 PowerShell 命令创建 .env 文件
```

**方法 3：使用命令行（Linux/Mac）**
```bash
cd server
# 参考 ENV_SETUP.md 中的 bash 命令创建 .env 文件
```

详细配置说明请参考 [ENV_SETUP.md](./ENV_SETUP.md)

### 启动数据库和 Redis

使用 Docker Compose：

```bash
docker-compose up -d postgres redis
```

或手动启动 PostgreSQL 和 Redis 服务。

### 运行数据库迁移

```bash
npm run migration:run
```

### 启动开发服务器

```bash
npm run start:dev
```

应用将在 `http://localhost:3000` 启动。

API 文档地址：`http://localhost:3000/api/docs`

## 项目结构

```
server/
├── src/
│   ├── common/          # 公共模块（装饰器、过滤器、守卫、拦截器、管道等）
│   ├── config/          # 配置模块
│   ├── database/        # 数据库模块
│   ├── redis/           # Redis 模块
│   ├── logger/          # 日志模块
│   ├── auth/            # 认证授权模块
│   ├── users/           # 用户模块（示例）
│   ├── health/          # 健康检查模块
│   ├── app.module.ts    # 根模块
│   └── main.ts          # 应用入口
├── test/                # 测试文件
├── docker-compose.yml   # Docker Compose 配置
└── Dockerfile           # Docker 镜像构建文件
```

## API 路由

### 认证相关

- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/refresh` - 刷新令牌
- `POST /api/v1/auth/logout` - 用户登出

### 用户管理

- `GET /api/v1/users` - 获取用户列表（分页）
- `GET /api/v1/users/:id` - 获取用户详情
- `POST /api/v1/users` - 创建用户（需要 admin 权限）
- `PATCH /api/v1/users/:id` - 更新用户（需要 admin 权限）
- `DELETE /api/v1/users/:id` - 删除用户（需要 admin 权限）

### 健康检查

- `GET /api/v1/health` - 健康检查

## Docker 部署

### 构建和启动

```bash
# 构建镜像
docker-compose build

# 启动所有服务
docker-compose up -d

# 运行数据库迁移
docker-compose exec app npm run migration:run

# 查看日志
docker-compose logs -f
```

### 停止服务

```bash
docker-compose down
```

### 通过 Docker 连接 Redis，查看封禁 IP 与速率数据

本项目的 Redis 由主应用提供，在 `docker-compose.yml` 中通过环境变量指向：

- **主机**：`REDIS_HOST=rbridge-redis`
- **端口**：`REDIS_PORT=6379`
- **密码**：`REDIS_PASSWORD`（来自主应用环境变量，可能为空）

**方式一：Redis 跑在容器里（容器名为 `rbridge-redis`）**

在宿主机执行：

```bash
# 有密码时（与主应用 .env 中 REDIS_PASSWORD 一致）
docker exec -it rbridge-redis redis-cli -a 你的REDIS密码

# 无密码时
docker exec -it rbridge-redis redis-cli
```

**方式二：用临时 redis-cli 容器连接**

```bash
# 有密码时
docker run --rm -it --network rbridge_app-network redis:alpine redis-cli -h rbridge-redis -p 6379 -a 你的REDIS密码

# 无密码时
docker run --rm -it --network rbridge_app-network redis:alpine redis-cli -h rbridge-redis -p 6379
```

连上 Redis 后，在 `redis-cli` 中执行：

**1. 封禁 IP（key 前缀 `ip_block:`）**

```bash
# 列出所有被封禁的 IP 的 key
KEYS ip_block:*

# 查看某 IP 剩余封禁时间（秒）
TTL ip_block:某个IP
```

**2. 访问速率 / DoS 计数（key 前缀 `rate_limit:`）**

```bash
# 列出所有正在计数的 速率限制 key（按 IP + 路径）
KEYS rate_limit:*

# 查看某 key 的当前请求次数
GET rate_limit:某个IP:某路径

# 查看该 key 剩余时间（秒）
TTL rate_limit:某个IP:某路径
```

若不确定 Redis 容器名，可执行 `docker ps -a | grep redis` 查看；网络名见 `docker network ls | grep rbridge`。

## 开发命令

```bash
# 开发模式
npm run start:dev

# 生产构建
npm run build

# 生产启动
npm run start:prod

# 运行测试
npm run test

# 代码格式化
npm run format

# 代码检查
npm run lint
```

## 详细文档

更多详细信息请参考 [FRAMEWORK.md](./FRAMEWORK.md)

## License

MIT

