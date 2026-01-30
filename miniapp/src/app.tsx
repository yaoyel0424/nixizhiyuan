import React, { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor } from './store'
import { silentLogin } from './utils/auth'
import { ErrorBoundary } from './components/ErrorBoundary'
import './app.less'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    // 应用启动时静默执行登录流程，获取 token
    silentLogin().catch(error => {
      console.error('应用启动时静默登录失败:', error)
    })
  })

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ErrorBoundary>
          {children || null}
        </ErrorBoundary>
      </PersistGate>
    </Provider>
  )
}

export default App
