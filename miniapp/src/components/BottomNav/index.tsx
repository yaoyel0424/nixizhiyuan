// 底部导航组件
import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import './index.less'

// tabBar 页面列表
const TABBAR_PAGES = [
  "/pages/index/index",
  "/pages/assessment/index",
  "/pages/majors/intended/index",
  "/pages/profile/index",
]

// 图标映射 - 使用线条风格的几何图形
const ICON_MAP: Record<string, { normal: string; active: string }> = {
  home: {
    normal: '○',  // 主页图标 - 空心圆
    active: '●'   // 激活状态 - 实心圆
  },
  clipboard: {
    normal: '△',  // 探索成果图标 - 空心三角形
    active: '▲'   // 激活状态 - 实心三角形
  },
  target: {
    normal: '◇',  // 志愿方案图标 - 空心菱形
    active: '◆'   // 激活状态 - 实心菱形
  },
  user: {
    normal: '□',  // 个人中心图标 - 空心方形
    active: '■'   // 激活状态 - 实心方形
  }
}

const navItems = [
  { href: "/pages/index/index", label: "主页", icon: "home" },
  { href: "/pages/assessment/index", label: "探索成果", icon: "clipboard" },
  { href: "/pages/majors/intended/index?tab=意向志愿", label: "志愿方案", icon: "target" },
  { href: "/pages/profile/index", label: "个人中心", icon: "user" },
]

export function BottomNav() {
  const router = useRouter()
  const currentPath = router.path || '/pages/index/index'

  const handleNavigate = (href: string) => {
    const [path] = href.split('?')
    
    // 只有跳转到首页时才使用 reLaunch（清空页面栈，首页不显示返回箭头）
    // 其他所有跳转都使用 navigateTo（保留页面栈，显示返回箭头）
    if (path === '/pages/index/index') {
      // 跳转到首页时，清空页面栈
      Taro.reLaunch({
        url: path,
      })
    } else {
      // 跳转到其他页面时，使用 navigateTo 保留页面栈，显示返回箭头
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
            // 特殊处理：探索成果tab，所有 /pages/assessment 下的页面都激活
            let isActive: boolean
            if (baseHref === "/pages/index/index") {
              isActive = currentPath === "/pages/index/index"
            } else if (baseHref === "/pages/assessment/index") {
              // 探索成果tab：所有 assessment 下的页面都激活
              isActive = currentPath.startsWith("/pages/assessment")
            } else {
              isActive = currentPath.startsWith(baseHref)
            }

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

