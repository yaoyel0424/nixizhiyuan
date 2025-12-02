// 顶部导航组件
import React from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components'
import './index.less'

/**
 * 顶部导航条组件
 * 包含Logo和账号信息菜单
 * 注意：返回按钮已移至微信系统导航栏左侧
 */
export function TopNav() {
  const router = useRouter()
  const currentPath = router.path || '/pages/index/index'

  // 处理退出登录
  const handleLogout = () => {
    // TODO: 实现退出登录逻辑
    console.log("退出登录")
    // 可以清除本地存储、跳转到登录页等
  }

  // 处理跳转到个人中心
  const handleProfile = () => {
    // 使用 navigateTo 跳转到个人中心，保留页面栈显示返回箭头
    Taro.navigateTo({
      url: '/pages/profile/index'
    })
  }

  return (
    <View className="top-nav">
      <View className="top-nav__container">
        <View className="top-nav__content">
          {/* 左侧：Logo */}
          <View className="top-nav__left">
            <View className="top-nav__logo" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
              <Image
                src={require('@/assets/images/logo.png')}
                className="top-nav__logo-img"
                mode="aspectFit"
              />
              <Text className="top-nav__logo-text">逆袭智愿</Text>
            </View>
          </View>

          {/* 右侧：账号信息 */}
          <View className="top-nav__right">
            <View
              className="top-nav__user-btn"
              onClick={handleProfile}
            >
              <Text className="top-nav__user-icon">👤</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

