# 构建自助终端静态资源（dist）；生产由 nixizhiyuan-nginx 挂载 kioskweb_static 卷
FROM node:22-alpine

WORKDIR /app

# 依赖
COPY package.json ./
RUN npm install

# 显式拷贝源码与配置，避免构建上下文不完整时遗漏 src/assets、public 等（COPY . . 在非完整仓库克隆时易漏）
COPY vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js index.html ./
COPY src ./src
COPY public ./public

RUN npm run build

# 产物：/app/dist（含打包结果与 vite 复制的 dist/__kiosk_assets）
