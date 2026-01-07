import { get } from './api'

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
 * 根据当前用户信息查询匹配的招生计划（按收藏专业分组）
 * @returns 按收藏专业分组的招生计划列表
 */
export const getUserEnrollmentPlans = async (): Promise<UserEnrollmentPlan[]> => {
  try {
    const response: any = await get<UserEnrollmentPlan[]>('/enroll-plan/user-plans')
    
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
