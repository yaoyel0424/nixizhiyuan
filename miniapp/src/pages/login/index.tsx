import React, { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { useAppDispatch } from '@/store/hooks'
import { setUserInfo, setLoginLoading } from '@/store/slices/userSlice'
import { Button, Input, Loading } from '@/components'
import { login } from '@/services'
import { validatePhone } from '@/utils'
import Taro from '@tarojs/taro'
import './index.less'

const Login: React.FC = () => {
  const dispatch = useAppDispatch()
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleLogin = async () => {
    const { username, password } = formData

    if (!username.trim()) {
      Taro.showToast({
        title: '请输入用户名',
        icon: 'none'
      })
      return
    }

    if (!password.trim()) {
      Taro.showToast({
        title: '请输入密码',
        icon: 'none'
      })
      return
    }

    if (username.includes('@')) {
      if (!validateEmail(username)) {
        Taro.showToast({
          title: '请输入正确的邮箱格式',
          icon: 'none'
        })
        return
      }
    } else if (validatePhone(username)) {
      // 手机号验证
    } else {
      Taro.showToast({
        title: '请输入正确的用户名格式',
        icon: 'none'
      })
      return
    }

    setLoading(true)
    dispatch(setLoginLoading(true))

    try {
      const response = await login({
        username,
        password
      })

      if (response.success) {
        dispatch(setUserInfo(response.data.userInfo))
        Taro.setStorageSync('token', response.data.token)
        
        Taro.showToast({
          title: '登录成功',
          icon: 'success'
        })

        setTimeout(() => {
          Taro.switchTab({
            url: '/pages/index/index'
          })
        }, 1500)
      }
    } catch (error) {
      console.error('登录失败:', error)
      Taro.showToast({
        title: '登录失败，请检查用户名和密码',
        icon: 'none'
      })
    } finally {
      setLoading(false)
      dispatch(setLoginLoading(false))
    }
  }

  const handleRegister = () => {
    Taro.navigateTo({
      url: '/pages/register/index'
    })
  }

  const handleForgotPassword = () => {
    Taro.navigateTo({
      url: '/pages/forgot-password/index'
    })
  }

  return (
    <View className="login-page">
      <View className="login-page__header">
        <Image 
          className="login-page__logo" 
          src="/assets/images/logo.png" 
        />
        <Text className="login-page__title">欢迎回来</Text>
        <Text className="login-page__subtitle">请登录您的账户</Text>
      </View>

      <View className="login-page__form">
        <View className="login-page__input-group">
          <Input
            placeholder="请输入用户名/手机号/邮箱"
            value={formData.username}
            onChange={(value) => handleInputChange('username', value)}
          />
        </View>

        <View className="login-page__input-group">
          <Input
            placeholder="请输入密码"
            value={formData.password}
            onChange={(value) => handleInputChange('password', value)}
            password
          />
        </View>

        <View className="login-page__forgot">
          <Text 
            className="login-page__forgot-link"
            onClick={handleForgotPassword}
          >
            忘记密码？
          </Text>
        </View>

        <Button
          type="primary"
          loading={loading}
          onClick={handleLogin}
          className="login-page__login-btn"
        >
          登录
        </Button>

        <View className="login-page__register">
          <Text className="login-page__register-text">还没有账户？</Text>
          <Text 
            className="login-page__register-link"
            onClick={handleRegister}
          >
            立即注册
          </Text>
        </View>
      </View>

      {loading && <Loading overlay text="登录中..." />}
    </View>
  )
}

export default Login
