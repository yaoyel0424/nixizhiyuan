// 底部导航组件
import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import './index.less'

// tabBar 页面列表
const TABBAR_PAGES = [
  "/pages/index/index",
  "/pages/assessment/all-majors/index",
  "/pages/majors/index",
  "/pages/profile/index",
]

// 图标映射 - 使用清晰的 Unicode 图标字符
// 这些字符在小程序中显示清晰，无需额外依赖
const ICON_MAP: Record<string, { normal: string; active: string }> = {
  home: {
    normal: '◉',  // 主页图标 - 空心圆点
    active: '●'   // 激活状态 - 实心圆
  },
  clipboard: {
    normal: '▢',  // 探索成果图标 - 空心方框
    active: '■'   // 激活状态 - 实心方框
  },
  target: {
    normal: '△',  // 志愿方案图标 - 空心三角
    active: '▲'   // 激活状态 - 实心三角
  },
  user: {
    normal: '◇',  // 个人中心图标 - 空心菱形
    active: '◆'   // 激活状态 - 实心菱形
  }
}

const navItems = [
  { href: "/pages/index/index", label: "主页", icon: "home" },
  { href: "/pages/assessment/all-majors/index", label: "探索成果", icon: "clipboard" },
  { href: "/pages/majors/index", label: "志愿方案", icon: "target" },
  { href: "/pages/profile/index", label: "个人中心", icon: "user" },
]

export function BottomNav() {
  const router = useRouter()
  const currentPath = router.path || '/pages/index/index'

  const handleNavigate = (href: string) => {
    const [path] = href.split('?')
    // 由于不再使用原生 tabBar，所有页面都使用 reLaunch 或 navigateTo
    // 如果是 tabBar 页面，使用 reLaunch 替换整个页面栈
    if (TABBAR_PAGES.includes(path)) {
      Taro.reLaunch({
        url: path,
      })
    } else {
      // 非 tabBar 页面使用 navigateTo
      Taro.navigateTo({
        url: href,
      })
    }
  }

  return (
    <View className="bottom-nav">
      <View className="bottom-nav__container">
        <View className="bottom-nav__items">
          {navItems.map((item) => {
            const baseHref = item.href.split("?")[0]
            const isActive = baseHref === "/pages/index/index" 
              ? currentPath === "/pages/index/index" 
              : currentPath.startsWith(baseHref)

            const iconData = ICON_MAP[item.icon] || { normal: '●', active: '●' }
            const iconText = isActive ? iconData.active : iconData.normal

            return (
              <View
                key={item.href}
                className={`bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}
                onClick={() => handleNavigate(item.href)}
              >
                <Text className="bottom-nav__icon">{iconText}</Text>
                <Text className="bottom-nav__label">{item.label}</Text>
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}

