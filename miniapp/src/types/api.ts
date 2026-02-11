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
 * 元素信息
 */
export interface ElementInfo {
  elementName: string
  score: number | null
}

/**
 * 专业元素分析
 */
export interface MajorElementAnalysis {
  type: 'lexue' | 'shanxue' | 'yanxue' | 'tiaozhan'
  elements: ElementInfo[]
}

/**
 * 专业匹配分数
 */
export interface MajorScore {
  score?: number | string
  lexueScore?: number | string
  shanxueScore?: number | string
  yanxueDeduction?: number | string
  tiaozhanDeduction?: number | string
}

/**
 * 专业详情信息
 */
export interface MajorDetailInfo {
  id?: number
  code: string
  name?: string
  educationLevel?: string | null
  studyPeriod?: string | null
  awardedDegree?: string | null
  majorBrief?: string | null
  majorKey?: string | null
  major?: MajorScore | null
  majorElementAnalyses?: MajorElementAnalysis[] | null
  studyContent?: any
  academicDevelopment?: any
  careerDevelopment?: any
  industryProspects?: any
  growthPotential?: any
  [key: string]: any // 允许其他字段
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
  majorId:number
  averageSalary: string | null
  majorDetail?: MajorDetailInfo
  progress?: ProgressInfo
  score?: ScoreInfo | null
  // 元素分析数据（在根级别）
  elementAnalyses?: MajorElementAnalysis[] | null
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
  majorId?: number
  level3MajorId?: number
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

// 省份相关类型定义
/**
 * 省份信息
 */
export interface ProvinceResponse {
  id: number
  name: string
  type: string
  overallImpression: string | null
  livingCost: string | null
  suitablePerson: string | null
  keyIndustries: string | null
  typicalEmployers: string | null
  createdAt?: string
  updatedAt?: string
}

/**
 * 省份列表响应
 */
export interface ProvincesListResponse {
  items: ProvinceResponse[]
  total?: number
}

/**
 * 收藏省份请求参数
 */
export interface FavoriteProvinceParams {
  provinceId: number
}

/**
 * 收藏省份响应
 */
export interface FavoriteProvinceResponse {
  id: number
  userId: number
  provinceId: number
  province?: ProvinceResponse
  createdAt?: string
  updatedAt?: string
}

/**
 * 收藏列表响应
 */
export interface FavoriteProvincesListResponse {
  items: FavoriteProvinceResponse[]
  total?: number
}

/**
 * 检查收藏状态响应
 */
export interface CheckFavoriteResponse {
  isFavorited: boolean
}

/**
 * 收藏数量响应
 */
export interface FavoriteCountResponse {
  count: number
}

// 专业收藏相关类型定义
/**
 * 收藏专业请求参数
 */
export interface FavoriteMajorParams {
  majorCode: string
}

/**
 * 收藏专业响应
 */
export interface FavoriteMajorResponse {
  id: number
  userId: number
  majorCode: string
  majorName?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * 专业收藏列表响应
 */
export interface FavoriteMajorsListResponse {
  items: FavoriteMajorResponse[]
  total?: number
}

/**
 * 检查专业收藏状态响应
 */
export interface CheckFavoriteMajorResponse {
  isFavorited: boolean
}

/**
 * 专业收藏数量响应
 */
export interface FavoriteMajorsCountResponse {
  count: number
}

/**
 * 用户相关数据统计响应
 */
export interface UserRelatedDataResponse {
  scaleAnswersCount: number
  majorFavoritesCount: number
  provinceFavoritesCount: number
  choicesCount: number
  preferredSubjects?: string | null
}
