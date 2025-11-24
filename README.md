# 项目根目录

使用 npm workspaces 管理多个子项目的工作区。

## 项目结构

```
.
├── server/          # NestJS 后台服务
├── miniapp/         # 小程序项目
├── package.json     # 根目录 package.json（工作区配置）
└── README.md        # 本文件
```

## 工作区说明

本项目使用 npm workspaces 管理多个子项目：

- **server**: NestJS 11 后台框架
- **miniapp**: 小程序项目

## 快速开始

### 安装依赖

**重要：使用 npm workspaces 时，必须在根目录执行 `npm install`**

#### 安装所有工作区的依赖（推荐）

在项目根目录执行：

```bash
npm install
# 或者使用脚本别名
npm run install
```

这会自动安装所有工作区（server 和 miniapp）的依赖，并将它们统一管理在根目录的 `node_modules` 中。

#### 只安装特定工作区的依赖

```bash
# 只安装 server 的依赖
npm run install:server
# 或
npm install --workspace=server

# 只安装 miniapp 的依赖
npm run install:miniapp
# 或
npm install --workspace=miniapp
```

#### 安装新依赖到特定工作区

```bash
# 安装到 server 工作区
npm install <package> --workspace=server
# 或简写
npm install <package> -w server

# 安装到 miniapp 工作区
npm install <package> --workspace=miniapp
# 或简写
npm install <package> -w miniapp

# 安装到所有工作区
npm install <package> --workspaces
```

**注意：**
- ❌ **不要**在子目录（server/ 或 miniapp/）中执行 `npm install`
- ✅ **必须**在根目录执行 `npm install` 来安装所有依赖
- 所有依赖都会安装在根目录的 `node_modules` 中
- 子项目的依赖会被提升到根目录（如果版本兼容）

### 运行子项目

#### Server（后台服务）

```bash
# 开发模式
npm run server:dev

# 构建
npm run server:build

# 生产模式
npm run server:start:prod

# 测试
npm run server:test

# 代码检查
npm run server:lint
```

#### Miniapp（小程序）

```bash
# 开发模式
npm run miniapp:dev

# 构建
npm run miniapp:build

# 测试
npm run miniapp:test
```

### 其他命令

```bash
# 构建所有项目
npm run build:all

# 清理所有项目
npm run clean
```

## 工作区命令说明

### 在特定工作区执行命令

```bash
# 在 server 工作区执行命令
npm run <script> --workspace=server

# 在所有工作区执行命令
npm run <script> --workspaces

# 在满足条件的工作区执行命令
npm run <script> --workspaces --if-present
```

### 安装依赖到特定工作区

```bash
# 安装到 server 工作区
npm install <package> --workspace=server

# 安装到所有工作区
npm install <package> --workspaces
```

## 子项目文档

- [Server 文档](./server/README.md)
- [Miniapp 文档](./miniapp/README.md)（待创建）

## 注意事项

### 依赖安装

1. **必须在根目录执行 `npm install`**，不要进入子目录执行
2. 所有依赖都会安装在根目录的 `node_modules` 中
3. 子项目的依赖会被提升到根目录（如果版本兼容）
4. 使用 `--workspace` 或 `-w` 参数可以指定在哪个工作区安装依赖
5. 建议在根目录统一管理依赖版本

### 工作区命令

1. 使用 `--workspace=<name>` 或 `-w <name>` 可以指定在哪个工作区执行命令
2. 使用 `--workspaces` 可以在所有工作区执行命令
3. 使用 `--if-present` 可以跳过没有该脚本的工作区

### 常见问题

**Q: 为什么在子目录执行 `npm install` 没有效果？**  
A: 使用 workspaces 时，npm 会忽略子目录中的 `npm install` 命令。必须在根目录执行。

**Q: 如何查看工作区的依赖？**  
A: 使用 `npm ls --workspace=server` 或 `npm ls -w server` 查看特定工作区的依赖树。

**Q: 如何更新依赖？**  
A: 在根目录执行 `npm update` 会更新所有工作区的依赖，或使用 `npm update -w server` 更新特定工作区。

