import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface AppState {
  theme: 'light' | 'dark'
  language: 'zh-CN' | 'en-US'
  networkStatus: 'online' | 'offline'
  systemInfo: any
  tabBarIndex: number
}

const initialState: AppState = {
  theme: 'light',
  language: 'zh-CN',
  networkStatus: 'online',
  systemInfo: null,
  tabBarIndex: 0
}

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload
    },
    setLanguage: (state, action: PayloadAction<'zh-CN' | 'en-US'>) => {
      state.language = action.payload
    },
    setNetworkStatus: (state, action: PayloadAction<'online' | 'offline'>) => {
      state.networkStatus = action.payload
    },
    setSystemInfo: (state, action: PayloadAction<any>) => {
      state.systemInfo = action.payload
    },
    setTabBarIndex: (state, action: PayloadAction<number>) => {
      state.tabBarIndex = action.payload
    }
  }
})

export const { 
  setTheme, 
  setLanguage, 
  setNetworkStatus, 
  setSystemInfo, 
  setTabBarIndex 
} = appSlice.actions
export default appSlice.reducer
