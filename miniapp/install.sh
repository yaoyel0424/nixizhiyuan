#!/bin/bash

echo "🚀 开始安装 Rbridge 项目依赖..."

# 检查 Node.js 版本
echo "📋 检查环境..."
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 16 ]; then
    echo "❌ Node.js 版本过低，需要 >= 16.0.0，当前版本: $(node -v)"
    echo "请访问 https://nodejs.org/ 下载最新版本"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"

# 检查 npm 版本
npm_version=$(npm -v | cut -d'.' -f1)
if [ "$npm_version" -lt 8 ]; then
    echo "❌ npm 版本过低，需要 >= 8.0.0，当前版本: $(npm -v)"
    echo "请运行: npm install -g npm@latest"
    exit 1
fi

echo "✅ npm 版本: $(npm -v)"

# 清理缓存
echo "🧹 清理缓存..."
npm cache clean --force

# 删除旧的 node_modules
if [ -d "node_modules" ]; then
    echo "🗑️ 删除旧的 node_modules..."
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    echo "🗑️ 删除 package-lock.json..."
    rm -f package-lock.json
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 检查安装结果
if [ $? -eq 0 ]; then
    echo "✅ 依赖安装成功！"
    echo ""
    echo "🎉 安装完成！现在可以运行以下命令："
    echo ""
    echo "📱 微信小程序开发："
    echo "   npm run dev:weapp"
    echo ""
    echo "🌐 H5开发："
    echo "   npm run dev:h5"
    echo ""
    echo "📋 其他平台："
    echo "   npm run dev:alipay    # 支付宝小程序"
    echo "   npm run dev:tt        # 字节跳动小程序"
    echo "   npm run dev:swan      # 百度小程序"
    echo "   npm run dev:qq        # QQ小程序"
    echo "   npm run dev:jd        # 京东小程序"
    echo ""
    echo "🔧 构建生产版本："
    echo "   npm run build:weapp   # 构建微信小程序"
    echo "   npm run build:h5      # 构建H5"
    echo ""
    echo "📖 更多信息请查看 README.md"
else
    echo "❌ 依赖安装失败！"
    echo "请检查网络连接或尝试以下解决方案："
    echo "1. 检查网络连接"
    echo "2. 尝试使用 yarn: yarn install"
    echo "3. 使用国内镜像: npm install --registry=https://registry.npmmirror.com"
    exit 1
fi
