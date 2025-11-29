import { configureStore } from '@reduxjs/toolkit'
import { persistStore, persistReducer } from 'redux-persist'
import storage from './storage' // 使用 Taro 存储适配器
import { combineReducers } from '@reduxjs/toolkit'

// 导入各个模块的reducer
import userReducer from './slices/userSlice'
import appReducer from './slices/appSlice'
import loadingReducer from './slices/loadingSlice'

// 持久化配置
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['user', 'app'] // 只持久化user和app状态
}

// 合并所有reducer
const rootReducer = combineReducers({
  user: userReducer,
  app: appReducer,
  loading: loadingReducer
})

// 创建持久化的reducer
const persistedReducer = persistReducer(persistConfig, rootReducer)

// 配置store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE']
      }
    }),
  devTools: process.env.NODE_ENV !== 'production'
})

// 创建persistor
export const persistor = persistStore(store)

// 导出类型
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
