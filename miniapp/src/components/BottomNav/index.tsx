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
  const currentParams = router.params || {}
  const currentTab = currentParams.tab || ''

  const handleNavigate = (href: string) => {
    // 底部导航为 tab 切换：统一使用 reLaunch 避免多次 navigateTo 导致页面栈超限（webview count limit exceed）
    Taro.reLaunch({
      url: href,
    })
  }

  // 判断是否为院校探索相关页面
  const isSchoolExplorationPage = 
    (currentPath === '/pages/majors/intended/index' && currentTab === '专业赛道') ||
    currentPath === '/pages/majors/intended/schools/index'
  
  // 判断是否为专业探索页面（热门专业评估页面）
  const isPopularMajorsPage = currentPath === '/pages/assessment/popular-majors/index'

  return (
    <View className="bottom-nav">
      <View className="bottom-nav__container">
        <View className="bottom-nav__items">
          {navItems.map((item) => {
            const baseHref = item.href.split("?")[0]
            // 特殊处理：探索成果tab，所有 /pages/assessment 下的页面都激活
            // 以及院校探索相关的页面（专业赛道tab和院校列表页面）
            // 但是专业探索页面（popular-majors）应该激活主页 tab
            let isActive: boolean
            if (baseHref === "/pages/index/index") {
              // 主页 tab：主页本身或专业探索页面都激活
              isActive = currentPath === "/pages/index/index" || isPopularMajorsPage
            } else if (baseHref === "/pages/assessment/index") {
              // 探索成果tab：所有 assessment 下的页面都激活（除了专业探索页面）
              // 以及院校探索相关的页面
              isActive = (currentPath.startsWith("/pages/assessment") && !isPopularMajorsPage) || isSchoolExplorationPage
            } else if (baseHref === "/pages/majors/intended/index") {
              // 志愿方案tab：只有意向志愿tab激活，院校探索相关页面不激活
              isActive = currentPath.startsWith(baseHref) && !isSchoolExplorationPage
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

