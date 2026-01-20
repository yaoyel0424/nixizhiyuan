import { get } from './api'

/**
 * 省控线响应数据
 */
export interface ProvincialControlLine {
  id: number
  typeName: string | null
  batchName: string | null
  score: number | null
  rank: number | null
  year: string | null
  province: string | null
  scoreSection: string | null
  name: string | null
}

/**
 * 用户招生计划（按收藏专业分组）
 */
export interface UserEnrollmentPlan {
  majorFavorite: {
    id: number
    majorCode: string
    major: {
      id: number
      name: string
      code: string
      eduLevel: string
    }
  }
  score: number | string | null
  schools: Array<{
    code: string
    name: string | null
  }>
  schoolCount: number
}

/**
 * 根据当前用户信息查询省控线
 * @returns 省控线列表
 */
export const getProvincialControlLines = async (): Promise<ProvincialControlLine[]> => {
  try {
    const response: any = await get<ProvincialControlLine[]>('/enroll-config/provincial-control-lines')
    
    // 响应拦截器可能返回原始数据或 BaseResponse 格式
    if (response && typeof response === 'object') {
      // 如果包含 data 字段，提取 data
      if (response.data && Array.isArray(response.data)) {
        return response.data
      }
      // 如果直接是数组，直接返回
      if (Array.isArray(response)) {
        return response
      }
    }
    return []
  } catch (error) {
    console.error('获取省控线失败:', error)
    return []
  }
}

/**
 * 招生计划项（包含学校、专业组和分数信息）
 */
export interface EnrollmentPlanItem {
  id: number
  schoolCode: string
  majorGroupId: number | null
  majorGroupInfo: string | null
  province: string | null
  year: string | null
  batch: string | null
  subjectSelectionMode: string | null
  studyPeriod: string | null
  enrollmentQuota: string | null
  enrollmentType: string | null
  remark: string | null
  tuitionFee: string | null
  enrollmentMajor: string | null
  curUnit: string | null
  majorGroup: {
    schoolCode: string
    province: string | null
    year: string | null
    subjectSelectionMode: string | null
    batch: string | null
    mgId: number | null
    mgName: string | null
    mgInfo: string | null
  } | null
  majorScores: Array<{
    schoolCode: string
    province: string | null
    year: string | null
    subjectSelectionMode: string | null
    batch: string | null
    minScore: number | null
    minRank: number | null
    admitCount: number | null
    enrollmentType: string | null
  }>
}

/**
 * 按学校分组的招生计划
 */
export interface EnrollmentPlanWithScores {
  school: {
    code: string
    name: string
    nature: string
    level: string
    belong: string
    categories: string
    features: string
    provinceName: string
    cityName: string
    enrollmentRate: number | null
    employmentRate: number | null
  }
  plans: EnrollmentPlanItem[]
}

/**
 * 根据专业ID查询招生计划和分数信息
 * @param majorId 专业ID
 * @returns 按学校分组的招生计划列表
 */
export const getEnrollmentPlansByMajorId = async (majorId: number): Promise<EnrollmentPlanWithScores[]> => {
  try {
    const response: any = await get<EnrollmentPlanWithScores[]>(`/enroll-plan/major/${majorId}/scores`)
    
    // 响应拦截器可能返回原始数据或 BaseResponse 格式
    if (response && typeof response === 'object') {
      // 如果包含 data 字段，提取 data
      if (response.data && Array.isArray(response.data)) {
        return response.data
      }
      // 如果直接是数组，直接返回
      if (Array.isArray(response)) {
        return response
      }
    }
    return []
  } catch (error) {
    console.error('获取专业招生计划失败:', error)
    return []
  }
}

/**
 * 根据当前用户信息查询匹配的招生计划（按收藏专业分组）
 * @param minScore 最低分（可选）
 * @param maxScore 最高分（可选）
 * @returns 按收藏专业分组的招生计划列表
 */
export const getUserEnrollmentPlans = async (
  minScore?: number,
  maxScore?: number,
): Promise<UserEnrollmentPlan[]> => {
  try {
    const params: Record<string, any> = {}
    if (minScore !== undefined && minScore !== null) {
      params.minScore = minScore
    }
    if (maxScore !== undefined && maxScore !== null) {
      params.maxScore = maxScore
    }

    const response: any = await get<UserEnrollmentPlan[]>('/enroll-plan/user-plans', params)
    
    // 响应拦截器可能返回原始数据或 BaseResponse 格式
    if (response && typeof response === 'object') {
      // 如果包含 data 字段，提取 data
      if (response.data && Array.isArray(response.data)) {
        return response.data
      }
      // 如果直接是数组，直接返回
      if (Array.isArray(response)) {
        return response
      }
    }
    return []
  } catch (error) {
    console.error('获取用户招生计划失败:', error)
    return []
  }
}

/**
 * 专业热爱能量信息
 */
export interface MajorLoveEnergy {
  majorCode: string
  majorName: string
  loveEnergy: number | null
}

/**
 * 专业组信息响应
 */
export interface MajorGroupInfo {
  id: number
  studyPeriod: string | null
  enrollmentQuota: string | null
  remark: string | null
  enrollmentMajor: string | null
  scores: MajorLoveEnergy[]
}

/**
 * 通过专业组ID查询专业组信息
 * @param mgId 专业组ID
 * @returns 专业组信息列表
 */
export const getMajorGroupInfo = async (mgId: number): Promise<MajorGroupInfo[]> => {
  try {
    const response: any = await get<MajorGroupInfo[]>(`/enroll-plan/major-group/${mgId}`)
    
    // 响应拦截器可能返回原始数据或 BaseResponse 格式
    if (response && typeof response === 'object') {
      // 如果包含 data 字段，提取 data
      if (response.data && Array.isArray(response.data)) {
        return response.data
      }
      // 如果直接是数组，直接返回
      if (Array.isArray(response)) {
        return response
      }
    }
    return []
  } catch (error) {
    console.error('获取专业组信息失败:', error)
    return []
  }
}
