# 问题排查指南

## 常见启动错误及解决方案

### 1. 环境变量文件缺失

**错误信息：**
- `Cannot find module` 相关错误
- 配置读取失败

**解决方案：**
```bash
# 在 server 目录下创建 .env 文件
cp .env.example .env

# 或者手动创建 .env 文件，内容参考 .env.example
```

### 2. 数据库连接失败

**错误信息：**
- `ECONNREFUSED` 
- `Connection refused`
- `Unable to connect to database`

**解决方案：**

1. 确保 PostgreSQL 服务已启动：
```bash
# 使用 Docker Compose
docker-compose up -d postgres

# 或检查本地 PostgreSQL 服务
# Windows: 检查服务管理器
# Linux/Mac: sudo systemctl status postgresql
```

2. 检查数据库配置（.env 文件）：
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=nestjs_db
```

3. 测试数据库连接：
```bash
# 使用 psql 测试连接
psql -h localhost -U postgres -d nestjs_db
```

### 3. Redis 连接失败

**错误信息：**
- `Redis Client Error`
- `ECONNREFUSED 127.0.0.1:6379`

**解决方案：**

1. 确保 Redis 服务已启动：
```bash
# 使用 Docker Compose
docker-compose up -d redis

# 或检查本地 Redis 服务
redis-cli ping
```

2. 检查 Redis 配置（.env 文件）：
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

**注意：** Redis 连接失败不会阻止应用启动，但会影响缓存和会话功能。

### 4. 端口被占用

**错误信息：**
- `EADDRINUSE: address already in use :::3000`
- `Port 3000 is already in use`

**解决方案：**

1. 查找占用端口的进程：
```bash
# Windows
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :3000
```

2. 杀死进程或更改端口：
```bash
# 修改 .env 文件中的 APP_PORT
APP_PORT=3001
```

### 5. 依赖安装问题

**错误信息：**
- `Module not found`
- `Cannot find module`

**解决方案：**

1. 删除 node_modules 和 package-lock.json：
```bash
rm -rf node_modules package-lock.json
# Windows: rmdir /s node_modules & del package-lock.json
```

2. 重新安装依赖：
```bash
# 在项目根目录执行
npm install

# 或使用工作区命令
npm install --workspace=server
```

### 6. TypeScript 编译错误

**错误信息：**
- `TS2307: Cannot find module`
- `TS2322: Type is not assignable`

**解决方案：**

1. 检查 tsconfig.json 配置
2. 确保所有依赖已正确安装
3. 清理并重新构建：
```bash
npm run build
```

### 7. 权限问题

**错误信息：**
- `EACCES: permission denied`
- `Permission denied`

**解决方案：**

1. 检查文件权限
2. 确保有写入权限（日志文件、上传目录等）

## 启动检查清单

在运行 `npm run server:dev` 之前，请确保：

- [ ] 已创建 `.env` 文件
- [ ] PostgreSQL 服务已启动
- [ ] Redis 服务已启动（可选，但推荐）
- [ ] 所有依赖已安装（`npm install`）
- [ ] 端口 3000 未被占用
- [ ] 数据库已创建（如果使用新数据库）

## 快速启动命令

```bash
# 1. 安装依赖（在项目根目录）
npm install

# 2. 创建 .env 文件（在 server 目录）
cd server
cp .env.example .env
# 编辑 .env 文件，修改数据库和 Redis 配置

# 3. 启动数据库和 Redis（在 server 目录）
docker-compose up -d postgres redis

# 4. 运行数据库迁移（可选）
npm run migration:run

# 5. 启动开发服务器（在项目根目录）
npm run server:dev
```

## 获取详细错误信息

如果问题仍然存在，可以：

1. 查看完整错误日志
2. 启用详细日志：
```bash
# 在 .env 文件中
DB_LOGGING=true
LOG_LEVEL=debug
```

3. 使用调试模式：
```bash
npm run server:start:debug
```

## 联系支持

如果以上方法都无法解决问题，请提供：
- 完整的错误信息
- Node.js 版本 (`node -v`)
- npm 版本 (`npm -v`)
- 操作系统信息
- `.env` 文件配置（隐藏敏感信息）

