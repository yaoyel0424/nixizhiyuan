// API相关类型定义
export interface LoginParams {
  username: string
  password: string
  captcha?: string
}

export interface LoginResponse {
  token: string
  refreshToken: string
  expiresIn: number
  userInfo: UserInfo
}

export interface UserInfo {
  id: string
  username: string
  nickname: string
  avatar: string
  phone: string
  email: string
  role: string
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export interface RegisterParams {
  username: string
  password: string
  confirmPassword: string
  phone: string
  email?: string
  captcha: string
}

export interface UpdateUserParams {
  nickname?: string
  avatar?: string
  phone?: string
  email?: string
}

export interface ChangePasswordParams {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

// 文件上传相关
export interface UploadFileParams {
  file: File
  type: 'image' | 'video' | 'audio' | 'document'
  category?: string
}

export interface UploadFileResponse {
  url: string
  filename: string
  size: number
  type: string
}

// 通用列表查询参数
export interface ListParams {
  page?: number
  pageSize?: number
  keyword?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  filters?: Record<string, any>
}

// 通用列表响应
export interface ListResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// 量表相关类型定义
/**
 * 量表选项
 */
export interface ScaleOption {
  id: number
  optionName: string
  optionValue: number
  displayOrder: number | null
  additionalInfo: string | null
}

/**
 * 量表
 */
export interface Scale {
  id: number
  content: string
  elementId: number
  type: 'like' | 'talent'
  dimension: '看' | '听' | '说' | '记' | '想' | '做' | '运动'
  options?: ScaleOption[]
  answers?: ScaleAnswer[]
}

/**
 * 量表答案
 */
export interface ScaleAnswer {
  id: number
  scaleId: number
  userId: number
  score: number
  submittedAt: string
}

/**
 * 量表列表及用户答案响应
 */
export interface ScalesWithAnswersResponse {
  scales: Scale[]
  answers: ScaleAnswer[]
}

/**
 * 创建或更新量表答案的请求参数
 */
export interface CreateScaleAnswerParams {
  scaleId: number
  userId: number
  score: number
}
