import React, { useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { setTabBarIndex } from '@/store/slices/appSlice'
import { clearUserInfo } from '@/store/slices/userSlice'
import { Button } from '@/components'
import Taro from '@tarojs/taro'
import './index.less'

const User: React.FC = () => {
  const dispatch = useAppDispatch()
  const { isLogin, userInfo } = useAppSelector(state => state.user)

  useEffect(() => {
    dispatch(setTabBarIndex(1))
  }, [dispatch])

  const handleLogin = () => {
    Taro.navigateTo({
      url: '/pages/login/index'
    })
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          dispatch(clearUserInfo())
          Taro.showToast({
            title: '已退出登录',
            icon: 'success'
          })
        }
      }
    })
  }

  const handleEditProfile = () => {
    // 使用 reLaunch 跳转到个人中心页面
    Taro.reLaunch({
      url: '/pages/profile/index'
    })
  }

  return (
    <View className="user-page">
      <View className="user-page__header">
        {isLogin && userInfo ? (
          <View className="user-page__user-info">
            <Image 
              className="user-page__avatar" 
              src={userInfo.avatar || '/assets/images/default-avatar.png'} 
            />
            <View className="user-page__info">
              <Text className="user-page__name">
                {userInfo.nickname || userInfo.username}
              </Text>
              <Text className="user-page__phone">
                {userInfo.phone}
              </Text>
            </View>
            <Button 
              type="secondary" 
              size="small"
              onClick={handleEditProfile}
            >
              编辑
            </Button>
          </View>
        ) : (
          <View className="user-page__login-prompt">
            <Text className="user-page__login-title">请先登录</Text>
            <Text className="user-page__login-desc">登录后享受更多服务</Text>
            <Button type="primary" onClick={handleLogin}>
              立即登录
            </Button>
          </View>
        )}
      </View>

      <View className="user-page__content">
        <View className="user-page__menu">
          <View className="user-page__menu-item">
            <Text className="user-page__menu-icon">📋</Text>
            <Text className="user-page__menu-text">我的订单</Text>
            <Text className="user-page__menu-arrow">></Text>
          </View>
          <View className="user-page__menu-item">
            <Text className="user-page__menu-icon">❤️</Text>
            <Text className="user-page__menu-text">我的收藏</Text>
            <Text className="user-page__menu-arrow">></Text>
          </View>
          <View className="user-page__menu-item">
            <Text className="user-page__menu-icon">⚙️</Text>
            <Text className="user-page__menu-text">设置</Text>
            <Text className="user-page__menu-arrow">></Text>
          </View>
          <View className="user-page__menu-item">
            <Text className="user-page__menu-icon">📞</Text>
            <Text className="user-page__menu-text">联系客服</Text>
            <Text className="user-page__menu-arrow">></Text>
          </View>
        </View>

        {isLogin && (
          <View className="user-page__actions">
            <Button type="danger" onClick={handleLogout}>
              退出登录
            </Button>
          </View>
        )}
      </View>
    </View>
  )
}

export default User
