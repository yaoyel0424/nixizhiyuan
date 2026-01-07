import { get, put } from './api'

/**
 * 高考信息接口
 */
export interface ExamInfo {
  province?: string
  preferredSubjects?: string
  secondarySubjects?: string
  score?: number
  rank?: number
  enrollType?: string
}

/**
 * 高考科目配置信息
 */
export interface GaokaoSubjectConfig {
  province: string
  mode: string
  primarySubjects?: {
    count: number
    subjects: string[]
  }
  secondarySubjects?: {
    count: number
    subjects: string[]
  }
  traditionalSubjects?: string[]
}

/**
 * 获取用户高考信息
 * 注意：后端 PUT /users/profile 接口在更新后会返回用户信息，可以用于获取
 * 如果后端有专门的 GET 接口，可以修改此函数
 * @returns 用户高考信息
 */
export const getExamInfo = async (): Promise<ExamInfo> => {
  try {
    // 由于后端 PUT /users/profile 在更新后会返回用户信息
    // 我们可以通过调用一个空的更新请求来获取当前用户信息
    // 但更好的方式是后端提供一个 GET /users/profile 接口
    // 这里先尝试使用 GET 方法，如果失败则返回空对象
    const response: any = await get('/users/profile')
    
    // 响应拦截器可能返回原始数据或 BaseResponse 格式
    if (response && typeof response === 'object') {
      // 如果包含 data 字段，提取 data
      if (response.data && typeof response.data === 'object') {
        return {
          province: response.data.province,
          preferredSubjects: response.data.preferredSubjects,
          secondarySubjects: response.data.secondarySubjects,
          score: response.data.score,
          rank: response.data.rank,
          enrollType: response.data.enrollType,
        }
      }
      // 如果直接包含高考信息字段，直接返回
      if (response.province || response.score !== undefined) {
        return {
          province: response.province,
          preferredSubjects: response.preferredSubjects,
          secondarySubjects: response.secondarySubjects,
          score: response.score,
          rank: response.rank,
          enrollType: response.enrollType,
        }
      }
    }
  } catch (error) {
    // 如果 GET 请求失败（接口可能不存在），返回空对象
    // 用户可以通过编辑对话框来设置高考信息
    console.warn('获取用户高考信息失败，接口可能不存在，将返回空对象:', error)
  }
  return {}
}

/**
 * 更新用户高考信息
 * @param examInfo 高考信息
 * @returns 更新后的用户信息（包含高考信息）
 */
export const updateExamInfo = async (examInfo: ExamInfo): Promise<ExamInfo> => {
  const response: any = await put('/users/profile', examInfo)
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提取 data
    if (response.data && typeof response.data === 'object') {
      return {
        province: response.data.province,
        preferredSubjects: response.data.preferredSubjects,
        secondarySubjects: response.data.secondarySubjects,
        score: response.data.score,
        rank: response.data.rank,
        enrollType: response.data.enrollType,
      }
    }
    // 如果直接包含高考信息字段，直接返回
    if (response.province || response.score !== undefined) {
      return {
        province: response.province,
        preferredSubjects: response.preferredSubjects,
        secondarySubjects: response.secondarySubjects,
        score: response.score,
        rank: response.rank,
        enrollType: response.enrollType,
      }
    }
  }
  return examInfo
}

/**
 * 获取高考科目配置信息
 * @returns 高考科目配置列表
 */
export const getGaokaoConfig = async (): Promise<GaokaoSubjectConfig[]> => {
  const response: any = await get('/enroll-config/gaokao')
  
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
}

/**
 * 分数范围信息接口
 */
export interface ScoreRangeInfo {
  num: number
  total: number
  rankRange: string
  batchName: string
  controlScore: number
}

/**
 * 获取分数范围信息
 * @param provinceName 省份名称
 * @param subjectType 科目类型（首选科目）
 * @param score 分数
 * @returns 分数范围信息
 */
export const getScoreRange = async (
  provinceName: string,
  subjectType: string,
  score: string
): Promise<ScoreRangeInfo | null> => {
  try {
    const response: any = await get('/enroll-config/score-range', {
      provinceName,
      subjectType,
      score
    })
    
    // 响应拦截器可能返回原始数据或 BaseResponse 格式
    if (response && typeof response === 'object') {
      // 如果包含 data 字段，提取 data
      if (response.data && typeof response.data === 'object') {
        return {
          num: response.data.num,
          total: response.data.total,
          rankRange: response.data.rankRange,
          batchName: response.data.batchName,
          controlScore: response.data.controlScore,
        }
      }
      // 如果直接包含分数范围信息字段，直接返回
      if (response.rankRange !== undefined) {
        return {
          num: response.num,
          total: response.total,
          rankRange: response.rankRange,
          batchName: response.batchName,
          controlScore: response.controlScore,
        }
      }
    }
    return null
  } catch (error: any) {
    // 404错误是正常的（数据库中可能没有对应数据），不输出错误日志
    // 其他错误才输出日志
    if (error?.message && !error.message.includes('未找到')) {
      console.error('获取分数范围信息失败:', error)
    }
    return null
  }
}
