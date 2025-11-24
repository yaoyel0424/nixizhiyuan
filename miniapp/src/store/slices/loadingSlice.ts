import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface LoadingState {
  global: boolean
  page: { [key: string]: boolean }
  component: { [key: string]: boolean }
}

const initialState: LoadingState = {
  global: false,
  page: {},
  component: {}
}

const loadingSlice = createSlice({
  name: 'loading',
  initialState,
  reducers: {
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.global = action.payload
    },
    setPageLoading: (state, action: PayloadAction<{ page: string; loading: boolean }>) => {
      const { page, loading } = action.payload
      state.page[page] = loading
    },
    setComponentLoading: (state, action: PayloadAction<{ component: string; loading: boolean }>) => {
      const { component, loading } = action.payload
      state.component[component] = loading
    },
    clearAllLoading: (state) => {
      state.global = false
      state.page = {}
      state.component = {}
    }
  }
})

export const { 
  setGlobalLoading, 
  setPageLoading, 
  setComponentLoading, 
  clearAllLoading 
} = loadingSlice.actions
export default loadingSlice.reducer
