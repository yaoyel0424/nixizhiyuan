# 环境变量配置说明

## 多环境配置支持

项目支持多环境配置，可以根据 `NODE_ENV` 环境变量自动加载对应的配置文件。

### 配置文件优先级

配置文件按以下优先级加载（后面的会覆盖前面的）：

1. `.env.${NODE_ENV}.local` - 环境特定的本地配置（最高优先级，不提交到版本控制）
2. `.env.${NODE_ENV}` - 环境特定的配置（如 `.env.production`、`.env.development`）
3. `.env.local` - 本地开发配置（不提交到版本控制）
4. `.env` - 默认配置（可以提交到版本控制作为模板）

### 环境类型

- **development** - 开发环境（默认）
- **production** - 生产环境
- **test** - 测试环境

## 快速开始

### 1. 复制配置模板

```bash
# Windows (PowerShell)
cd server
Copy-Item .env.example .env

# Linux/Mac
cd server
cp .env.example .env
```

### 2. 创建环境特定配置文件（可选）

#### 开发环境（本地）

创建 `.env.local` 或 `.env.development.local`：

```env
# 应用配置
NODE_ENV=development
APP_PORT=3000
APP_NAME=nestjs-backend-framework
APP_PREFIX=api/v1

# CORS 配置
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=nestjs_db
DB_SYNCHRONIZE=false
DB_LOGGING=true

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT 配置
JWT_SECRET=dev-secret-key-change-me
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=dev-refresh-secret-key-change-me
JWT_REFRESH_EXPIRES_IN=7d

# 日志配置
LOG_LEVEL=debug
LOG_PRETTY=true
```

#### 生产环境

创建 `.env.production`：

```env
# 应用配置
NODE_ENV=production
APP_PORT=3000
APP_NAME=nestjs-backend-framework
APP_PREFIX=api/v1

# CORS 配置
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# 数据库配置
DB_HOST=your-production-db-host
DB_PORT=5432
DB_USERNAME=your-db-username
DB_PASSWORD=your-strong-password
DB_DATABASE=your-db-name
DB_SYNCHRONIZE=false
DB_LOGGING=false

# Redis 配置
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# JWT 配置（生产环境必须使用强密钥）
JWT_SECRET=your-very-strong-secret-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-very-strong-refresh-secret-key-min-32-chars
JWT_REFRESH_EXPIRES_IN=7d

# 日志配置
LOG_LEVEL=info
LOG_PRETTY=false
```

## 使用方式

### 开发环境

```bash
# 方式 1: 使用 npm script（推荐）
npm run start:dev

# 方式 2: 手动设置环境变量
# Windows (PowerShell)
$env:NODE_ENV="development"; npm run start:dev

# Linux/Mac
NODE_ENV=development npm run start:dev
```

### 生产环境

```bash
# 1. 构建项目
npm run build

# 2. 启动生产服务
npm run start:prod

# 或者手动设置
NODE_ENV=production node dist/main
```

### 测试环境

```bash
# 运行测试
npm test

# 或者
npm run test:watch
```

## 配置说明

### 应用配置
- `NODE_ENV`: 运行环境（development/production/test）
- `APP_PORT`: 应用端口号
- `APP_NAME`: 应用名称
- `APP_PREFIX`: API 路由前缀

### 数据库配置
- `DB_HOST`: PostgreSQL 主机地址
- `DB_PORT`: PostgreSQL 端口
- `DB_USERNAME`: 数据库用户名
- `DB_PASSWORD`: 数据库密码
- `DB_DATABASE`: 数据库名称
- `DB_SYNCHRONIZE`: 是否自动同步数据库结构（**生产环境必须为 false**）
- `DB_LOGGING`: 是否启用 SQL 日志（生产环境建议 false）

### Redis 配置
- `REDIS_HOST`: Redis 主机地址
- `REDIS_PORT`: Redis 端口
- `REDIS_PASSWORD`: Redis 密码（如果没有密码则留空）
- `REDIS_DB`: Redis 数据库编号

### JWT 配置
- `JWT_SECRET`: JWT 密钥（**生产环境必须使用强随机字符串，至少 32 个字符**）
- `JWT_EXPIRES_IN`: Access Token 过期时间（如：15m, 1h, 7d）
- `JWT_REFRESH_SECRET`: Refresh Token 密钥（**生产环境必须使用强随机字符串，至少 32 个字符**）
- `JWT_REFRESH_EXPIRES_IN`: Refresh Token 过期时间

### 日志配置
- `LOG_LEVEL`: 日志级别（error/warn/info/debug/verbose）
- `LOG_PRETTY`: 是否使用美化格式（开发环境建议 true，生产环境建议 false）

## 最佳实践

### 1. 配置文件管理

- ✅ **提交到版本控制**：`.env.example`（模板文件，不包含敏感信息）
- ❌ **不提交到版本控制**：
  - `.env`
  - `.env.local`
  - `.env.*.local`
  - `.env.production`
  - `.env.development`
  - `.env.test`

### 2. 生产环境安全

1. **必须修改的配置**：
   - `JWT_SECRET`: 使用强随机字符串（至少 32 个字符）
   - `JWT_REFRESH_SECRET`: 使用强随机字符串（至少 32 个字符）
   - `DB_PASSWORD`: 使用强密码
   - `REDIS_PASSWORD`: 如果使用密码，使用强密码

2. **必须禁用的功能**：
   - `DB_SYNCHRONIZE`: 必须设置为 `false`
   - `DB_LOGGING`: 建议设置为 `false`（避免日志泄露敏感信息）
   - `LOG_PRETTY`: 建议设置为 `false`（生产环境使用结构化日志）

3. **推荐配置**：
   - 使用环境变量而非配置文件（在容器化部署时）
   - 使用密钥管理服务（如 AWS Secrets Manager、Azure Key Vault）
   - 定期轮换密钥和密码

### 3. 环境变量优先级

完整的优先级顺序（从高到低）：

1. **系统环境变量**（最高优先级）
2. `.env.${NODE_ENV}.local`
3. `.env.${NODE_ENV}`
4. `.env.local`
5. `.env`（最低优先级）

### 4. 团队协作

1. 新成员克隆项目后，复制 `.env.example` 为 `.env` 或 `.env.local`
2. 根据本地环境修改配置
3. 不要提交包含真实密码或密钥的配置文件

## 故障排查

### 问题：配置文件未生效

**解决方案**：
1. 检查 `NODE_ENV` 环境变量是否正确设置
2. 确认配置文件名称是否正确（注意大小写）
3. 检查配置文件是否在 `server` 目录下
4. 查看配置文件加载顺序，后面的配置会覆盖前面的

### 问题：生产环境配置被开发环境覆盖

**解决方案**：
1. 确保 `NODE_ENV=production` 已正确设置
2. 使用 `.env.production` 而不是 `.env.local`
3. 检查系统环境变量是否设置了 `NODE_ENV`

### 问题：敏感信息泄露

**解决方案**：
1. 立即轮换所有泄露的密钥和密码
2. 检查 `.gitignore` 确保配置文件不会被提交
3. 如果已提交，使用 `git rm --cached` 移除并提交
4. 考虑使用密钥管理服务

## 快速创建命令

### Windows (PowerShell)

```powershell
cd server

# 创建开发环境配置
@"
NODE_ENV=development
APP_PORT=3000
APP_NAME=nestjs-backend-framework
APP_PREFIX=api/v1
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=nestjs_db
DB_SYNCHRONIZE=false
DB_LOGGING=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
JWT_SECRET=dev-secret-key-change-me
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=dev-refresh-secret-key-change-me
JWT_REFRESH_EXPIRES_IN=7d
LOG_LEVEL=debug
LOG_PRETTY=true
"@ | Out-File -FilePath .env.local -Encoding utf8
```

### Linux/Mac

```bash
cd server

# 创建开发环境配置
cat > .env.local << 'EOF'
NODE_ENV=development
APP_PORT=3000
APP_NAME=nestjs-backend-framework
APP_PREFIX=api/v1
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=nestjs_db
DB_SYNCHRONIZE=false
DB_LOGGING=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
JWT_SECRET=dev-secret-key-change-me
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=dev-refresh-secret-key-change-me
JWT_REFRESH_EXPIRES_IN=7d
LOG_LEVEL=debug
LOG_PRETTY=true
EOF
```
