import React, { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor } from './store'
import './app.less'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
  })

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children || null}
      </PersistGate>
    </Provider>
  )
}

export default App
