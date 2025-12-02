// 通用类型定义
export interface BaseResponse<T = any> {
  code: number
  message: string
  data: T
  success: boolean
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginationResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// API相关类型
export interface ApiConfig {
  baseURL: string
  timeout: number
  headers?: Record<string, string>
}

export interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  data?: any
  params?: Record<string, any>
  headers?: Record<string, string>
}

// 组件相关类型
export interface ComponentProps {
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

export interface ButtonProps extends ComponentProps {
  type?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
}

export interface InputProps extends ComponentProps {
  value?: string
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  onChange?: (value: string) => void
  onFocus?: () => void
  onBlur?: () => void
}

// 页面相关类型
export interface PageProps {
  className?: string
  title?: string
  showNavBar?: boolean
  navBarTitle?: string
  onBack?: () => void
}

// 路由相关类型
export interface RouteConfig {
  path: string
  component: React.ComponentType<any>
  exact?: boolean
  title?: string
}

// 主题相关类型
export type Theme = 'light' | 'dark'
export type Language = 'zh-CN' | 'en-US'

// 网络状态类型
export type NetworkStatus = 'online' | 'offline'

// 加载状态类型
export interface LoadingState {
  global: boolean
  page: Record<string, boolean>
  component: Record<string, boolean>
}

// 导出问卷相关类型
export * from './questionnaire'
