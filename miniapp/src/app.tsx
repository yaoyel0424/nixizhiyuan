/**
 * iOS 真机兼容：微信小程序不允许 setInterval 的 delay 为 0，否则报 "setInterval time can not be zero"
 * 在应用入口对 setInterval 做兜底，避免第三方或运行时传入 0 导致登录/启动失败
 */
const _setInterval = globalThis.setInterval
if (typeof _setInterval === 'function') {
  globalThis.setInterval = function (fn: TimerHandler, delay?: number, ...args: any[]) {
    const safeDelay = typeof delay === 'number' && delay >= 0 ? Math.max(1, delay) : (delay ?? 1)
    return _setInterval(fn, safeDelay, ...args)
  }
}

import React, { PropsWithChildren, useEffect, useRef } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor } from './store'
import { silentLogin } from './utils/auth'
import { getLaunchAgentUuid, bindAgentByUuid, sceneToAgentUuid, STORAGE_KEY_LAUNCH_AGENT_UUID } from './services/agent'
import { ErrorBoundary } from './components/ErrorBoundary'
import './app.less'

/**
 * 在 redux-persist 完成 rehydration 后再执行静默登录，避免 iOS 上 rehydration 覆盖登录态
 * 若启动时有 uuid（分享链接或扫码），登录成功后调用 /api/v1/users/agent 绑定代理商
 */
function AuthInit({ children }: PropsWithChildren<any>) {
  const didRun = useRef(false)
  useEffect(() => {
    if (didRun.current) return
    didRun.current = true
    silentLogin()
      .then((ok) => {
        if (ok) {
          const uuid = getLaunchAgentUuid()
          if (uuid) bindAgentByUuid(uuid).catch(() => {})
        }
      })
      .catch(error => {
        console.error('静默登录失败:', error)
      })
  }, [])
  return <>{children}</>
}

function App({ children }: PropsWithChildren<any>) {
  useLaunch((options) => {
    console.log('App launched.')
    // 若启动参数带 uuid（分享链接）或 scene（扫码进入小程序码），写入 storage，供 AuthInit 登录后绑定
    const query = options?.query || {}
    try {
      if (query.uuid && typeof query.uuid === 'string' && query.uuid.trim()) {
        Taro.setStorageSync(STORAGE_KEY_LAUNCH_AGENT_UUID, query.uuid.trim())
      } else if (query.scene && typeof query.scene === 'string') {
        const uuid = sceneToAgentUuid(query.scene)
        if (uuid) Taro.setStorageSync(STORAGE_KEY_LAUNCH_AGENT_UUID, uuid)
      }
    } catch (_) {}
  })

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthInit>
          <ErrorBoundary>
            {children || null}
          </ErrorBoundary>
        </AuthInit>
      </PersistGate>
    </Provider>
  )
}

export default App
