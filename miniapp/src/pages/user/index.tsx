import React, { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { setTabBarIndex } from '@/store/slices/appSlice'
import { clearUserInfo } from '@/store/slices/userSlice'
import { Button } from '@/components'
import Taro from '@tarojs/taro'
import { silentLogin } from '@/utils/auth'
import './index.less'

const User: React.FC = () => {
  const dispatch = useAppDispatch()
  const { isLogin, userInfo } = useAppSelector(state => state.user)
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    dispatch(setTabBarIndex(1))
  }, [dispatch])

  /** 静默登录：重新尝试登录，不跳转登录页 */
  const handleLogin = async () => {
    if (loginLoading) return
    setLoginLoading(true)
    try {
      const ok = await silentLogin()
      if (ok) {
        Taro.showToast({ title: '登录成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '登录失败，请重新打开小程序', icon: 'none' })
      }
    } finally {
      setLoginLoading(false)
    }
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
    // 使用 navigateTo 跳转到个人中心页面，保留页面栈显示返回箭头
    Taro.navigateTo({
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
            <Text className="user-page__login-title">未登录</Text>
            <Text className="user-page__login-desc">重新打开小程序将自动登录</Text>
            <Button type="primary" onClick={handleLogin} disabled={loginLoading}>
              {loginLoading ? '登录中…' : '重新登录'}
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
