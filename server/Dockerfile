# 构建阶段
FROM node:22-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖（如果没有 package-lock.json，使用 npm install）
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 复制源代码
COPY . .

# 构建应用（确保失败时退出）
RUN set -e && npm run build

# 验证构建产物
RUN test -f /app/dist/src/main.js || (echo "ERROR: /app/dist/src/main.js not found!" && exit 1)

# 生产阶段
FROM node:22-alpine AS production

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 从构建阶段复制已编译的 node_modules
COPY --from=builder /app/node_modules ./node_modules

# 清理开发依赖（保留已编译的原生模块）
RUN npm prune --production

# 从构建阶段复制构建产物
COPY --from=builder /app/dist ./dist

# 验证构建产物已复制
RUN test -f /app/dist/src/main.js || (echo "Copy failed: main.js not found" && exit 1)

# 创建上传目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3002

# 启动应用
CMD ["node", "dist/src/main"]

