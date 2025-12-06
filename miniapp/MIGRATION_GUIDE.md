# 迁移指南

## 已完成的工作

### 1. 数据文件和静态资源
- ✅ 数据文件已复制到 `src/data/`
- ✅ 静态资源已复制到 `src/assets/images/` 和 `src/assets/data/`

### 2. 工具函数
- ✅ `src/utils/cn.ts` - 类名合并工具
- ✅ `src/utils/majors-data.ts` - 专业数据工具
- ✅ `src/utils/education-data.ts` - 教育数据工具

### 3. 关键组件
- ✅ `src/components/BottomNav/` - 底部导航
- ✅ `src/components/PageContainer/` - 页面容器
- ✅ `src/components/ui/Card/` - 卡片组件

## 需要完成的工作

### 1. 组件转换（剩余约 65 个组件）

需要将 Next.js 组件转换为 Taro 组件格式：

**转换规则：**
- `div` → `View`
- `span` → `Text`
- `Link` → 使用 `Taro.navigateTo`
- `Image` (Next.js) → `Image` (Taro)
- `useRouter` → `Taro.useRouter` 或 `Taro.navigateTo`
- `usePathname` → 使用 `Taro.useRouter().path`

**需要转换的组件目录：**
- `components/ui/*` - UI 组件库（约 60 个文件）
- `components/*.tsx` - 业务组件（约 9 个文件）

### 2. 页面转换（44 个页面文件）

需要将 Next.js 页面转换为 Taro 页面格式：

**页面结构：**
```
src/pages/
├── index/              # 首页（已存在，需要替换）
├── assessment/         # 评估相关页面
│   ├── all-majors/
│   ├── popular-majors/
│   ├── questionnaire/
│   ├── report/
│   └── ...
├── majors/            # 专业相关页面
│   ├── [code]/        # 动态路由需要特殊处理
│   ├── intended/
│   └── ...
├── applications/      # 申请相关页面
├── profile/           # 个人中心
└── ...
```

**转换规则：**
- 每个页面需要创建对应的目录和 `index.tsx`、`index.less` 文件
- 动态路由 `[code]` 需要转换为 Taro 的参数传递方式
- `page.tsx` → `index.tsx`
- `*-client.tsx` → 可以合并到主页面或作为组件

### 3. 路由配置

需要更新 `src/app.config.ts` 添加所有新页面：

```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/assessment/all-majors/index',
    'pages/assessment/popular-majors/index',
    // ... 添加所有页面
  ],
  // ...
})
```

### 4. API 路由处理

Next.js 的 API 路由（`app/api/*`）需要：
- 转换为独立的 API 服务文件
- 或使用 Taro 的请求功能直接调用后端 API

## 转换示例

### 组件转换示例

**Next.js 组件：**
```tsx
import Link from "next/link"
import { useRouter } from "next/navigation"

export function MyComponent() {
  const router = useRouter()
  return (
    <div className="container">
      <Link href="/page">跳转</Link>
      <button onClick={() => router.push('/page')}>按钮</button>
    </div>
  )
}
```

**Taro 组件：**
```tsx
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

export function MyComponent() {
  const handleNavigate = () => {
    Taro.navigateTo({ url: '/pages/page/index' })
  }
  return (
    <View className="container">
      <View onClick={handleNavigate}>跳转</View>
      <View onClick={handleNavigate}>按钮</View>
    </View>
  )
}
```

### 页面转换示例

**Next.js 页面：**
```tsx
"use client"
import { useState } from "react"
import Link from "next/link"

export default function Page() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <h1>标题</h1>
      <Link href="/other">链接</Link>
    </div>
  )
}
```

**Taro 页面：**
```tsx
import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.less'

export default function Page() {
  const [count, setCount] = useState(0)
  
  const handleNavigate = () => {
    Taro.navigateTo({ url: '/pages/other/index' })
  }
  
  return (
    <View className="page">
      <Text className="page__title">标题</Text>
      <View onClick={handleNavigate}>链接</View>
    </View>
  )
}
```

## 注意事项

1. **样式保持不变**：所有 CSS 类名和样式文件保持原样
2. **本地存储**：`localStorage` → `Taro.getStorageSync` / `Taro.setStorageSync`
3. **环境变量**：`process.env` → 使用 Taro 的配置或常量
4. **图标**：Lucide React 图标需要替换为图片或 Taro 支持的图标组件
5. **动态路由**：Next.js 的 `[param]` 路由需要转换为 Taro 的页面参数

## 下一步

1. 批量转换 UI 组件（可以使用脚本辅助）
2. 转换业务组件
3. 转换所有页面
4. 更新路由配置
5. 测试和修复

