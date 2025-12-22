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

// 热门专业相关类型定义
/**
 * 专业详情信息
 */
export interface MajorDetailInfo {
  id: number
  code: string
  educationLevel: string | null
  studyPeriod: string | null
  awardedDegree: string | null
  majorBrief: string | null
}

/**
 * 填写进度信息
 */
export interface ProgressInfo {
  completedCount: number
  totalCount: number
  isCompleted: boolean
}

/**
 * 专业分数信息
 */
export interface ScoreInfo {
  score: number
  lexueScore: number
  shanxueScore: number
  yanxueDeduction: number
  tiaozhanDeduction: number
}

/**
 * 热门专业响应数据
 */
export interface PopularMajorResponse {
  id: number
  averageSalary: string | null
  majorDetail?: MajorDetailInfo
  progress?: ProgressInfo
  score?: ScoreInfo | null
  // 从 majorDetail 中提取的字段，方便使用
  name?: string
  code?: string
  degree?: string | null
  limitYear?: string | null
  majorBrief?: string | null
}

/**
 * 分页元数据
 */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * 热门专业列表响应
 */
export interface PopularMajorsListResponse {
  items: PopularMajorResponse[]
  meta: PaginationMeta
}

/**
 * 查询热门专业参数
 */
export interface QueryPopularMajorParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  level1?: 'ben' | 'zhuan' | 'gao_ben'
  name?: string
  code?: string
}

/**
 * 专业分数响应数据
 * 注意：API 返回的分数字段可能是字符串类型
 */
export interface MajorScoreResponse {
  majorCode: string
  majorName: string
  majorBrief: string | null
  eduLevel: string
  yanxueDeduction: number | string
  tiaozhanDeduction: number | string
  score: number | string
  lexueScore: number | string
  shanxueScore: number | string
}
