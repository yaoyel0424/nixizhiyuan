#!/bin/bash

echo "🖼️ 转换图标文件..."

# 检查是否安装了ImageMagick
if ! command -v convert &> /dev/null; then
    echo "❌ 未找到ImageMagick，请先安装："
    echo "   brew install imagemagick"
    echo "   或者使用在线工具转换SVG到PNG"
    exit 1
fi

# 转换SVG到PNG
echo "转换 home.svg..."
convert src/assets/images/home.svg -resize 40x40 src/assets/images/home.png

echo "转换 home-active.svg..."
convert src/assets/images/home-active.svg -resize 40x40 src/assets/images/home-active.png

echo "转换 user.svg..."
convert src/assets/images/user.svg -resize 40x40 src/assets/images/user.png

echo "转换 user-active.svg..."
convert src/assets/images/user-active.svg -resize 40x40 src/assets/images/user-active.png

echo "✅ 图标转换完成！"
