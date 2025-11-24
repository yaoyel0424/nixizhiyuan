#!/bin/bash

echo "🔧 修复依赖问题..."

# 安装缺失的依赖
echo "📦 安装缺失的依赖包..."

# 安装 tsconfig-paths-webpack-plugin
echo "安装 tsconfig-paths-webpack-plugin..."
npm install tsconfig-paths-webpack-plugin@^4.0.0 --save-dev

# 安装 @tarojs/plugin-framework-react
echo "安装 @tarojs/plugin-framework-react..."
npm install @tarojs/plugin-framework-react@3.6.20 --save-dev

# 检查安装结果
if [ $? -eq 0 ]; then
    echo "✅ 依赖安装成功！"
    echo ""
    echo "🎉 现在可以运行项目了："
    echo "npm run dev:weapp"
else
    echo "❌ 依赖安装失败！"
    echo "请尝试手动安装："
    echo "npm install tsconfig-paths-webpack-plugin@^4.0.0 --save-dev"
    echo "npm install @tarojs/plugin-framework-react@3.6.20 --save-dev"
fi
