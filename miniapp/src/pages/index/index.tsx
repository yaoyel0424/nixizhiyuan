import React, { useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { setTabBarIndex } from '@/store/slices/appSlice'
import { Button, Loading } from '@/components'
import './index.less'

const Index: React.FC = () => {
  const dispatch = useAppDispatch()
  const { tabBarIndex } = useAppSelector(state => state.app)
  const { isLogin, userInfo } = useAppSelector(state => state.user)

  useEffect(() => {
    dispatch(setTabBarIndex(0))
  }, [dispatch])

  return (
    <View className="index-page">
      <View className="index-page__header">
        <Text className="index-page__title">欢迎使用 Rbridge</Text>
        {isLogin && userInfo && (
          <Text className="index-page__welcome">
            你好，{userInfo.nickname || userInfo.username}
          </Text>
        )}
      </View>
      
      <View className="index-page__content">
        <View className="index-page__card">
          <Text className="index-page__card-title">快速开始</Text>
          <Text className="index-page__card-desc">
            这是一个基于 Taro + React + TypeScript 的微信小程序框架
          </Text>
          <Button type="primary" className="index-page__button">
            开始使用
          </Button>
        </View>
        
        <View className="index-page__features">
          <View className="index-page__feature">
            <Text className="index-page__feature-title">🚀 快速开发</Text>
            <Text className="index-page__feature-desc">基于 Taro 框架，支持多端开发</Text>
          </View>
          <View className="index-page__feature">
            <Text className="index-page__feature-title">📱 响应式设计</Text>
            <Text className="index-page__feature-desc">适配不同屏幕尺寸</Text>
          </View>
          <View className="index-page__feature">
            <Text className="index-page__feature-title">🔧 易于维护</Text>
            <Text className="index-page__feature-desc">清晰的目录结构和代码组织</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default Index
