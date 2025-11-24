import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface UserInfo {
  id: string
  username: string
  nickname: string
  avatar: string
  phone: string
  email: string
  token: string
}

export interface UserState {
  userInfo: UserInfo | null
  isLogin: boolean
  loginLoading: boolean
}

const initialState: UserState = {
  userInfo: null,
  isLogin: false,
  loginLoading: false
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserInfo: (state, action: PayloadAction<UserInfo>) => {
      state.userInfo = action.payload
      state.isLogin = true
    },
    clearUserInfo: (state) => {
      state.userInfo = null
      state.isLogin = false
    },
    setLoginLoading: (state, action: PayloadAction<boolean>) => {
      state.loginLoading = action.payload
    },
    updateUserInfo: (state, action: PayloadAction<Partial<UserInfo>>) => {
      if (state.userInfo) {
        state.userInfo = { ...state.userInfo, ...action.payload }
      }
    }
  }
})

export const { setUserInfo, clearUserInfo, setLoginLoading, updateUserInfo } = userSlice.actions
export default userSlice.reducer
