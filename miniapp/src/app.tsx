import React, { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor } from './store'
import { useAppDispatch } from './store/hooks'
import { setUserInfo, clearUserInfo } from './store/slices/userSlice'
import { checkToken, getUserInfo } from './services'
import Taro from '@tarojs/taro'
import './app.less'

function AppContent({ children }: PropsWithChildren<any>) {
  const dispatch = useAppDispatch()

  useLaunch(async () => {
    console.log('App launched.')
    
    // 检查本地是否有保存的 token
    const token = Taro.getStorageSync('token')
    
    if (token) {
      try {
        // 验证 token 是否有效
        await checkToken()
        
        // Token 有效，获取最新的用户信息
        const userInfo = await getUserInfo()
        
        if (userInfo) {
          // 恢复用户信息到 Redux
          const formattedUserInfo = {
            id: String(userInfo.id || ''),
            username:  '微信用户',
            nickname: '微信用户',
            avatar:'',
            phone: '',
            email: userInfo.email || '',
            token: token || '',
          }
          
          dispatch(setUserInfo(formattedUserInfo))
          
          // 更新本地存储的用户信息和手机号
          Taro.setStorageSync('userInfo', formattedUserInfo)
          if (formattedUserInfo.phone) {
            Taro.setStorageSync('userPhone', formattedUserInfo.phone)
          }
          
          console.log('自动登录成功，用户信息已恢复')
        }
      } catch (error) {
        // Token 无效或过期，清除本地数据并跳转到登录页
        console.warn('Token 验证失败，跳转到登录页:', error)
        Taro.removeStorageSync('token')
        Taro.removeStorageSync('refreshToken')
        Taro.removeStorageSync('userInfo')
        Taro.removeStorageSync('userPhone')
        dispatch(clearUserInfo())
        
        // 跳转到登录页
        const pages = Taro.getCurrentPages()
        const currentPage = pages[pages.length - 1]
        if (currentPage?.route !== 'pages/login/index') {
          Taro.reLaunch({
            url: '/pages/login/index'
          })
        }
      }
    } else {
      // 没有 token，清除可能存在的无效数据
      console.log('未找到保存的 token')
      Taro.removeStorageSync('userInfo')
      Taro.removeStorageSync('userPhone')
      dispatch(clearUserInfo())
    }
  })

  return <>{children || null}</>
}

function App({ children }: PropsWithChildren<any>) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AppContent>{children}</AppContent>
      </PersistGate>
    </Provider>
  )
}

export default App
