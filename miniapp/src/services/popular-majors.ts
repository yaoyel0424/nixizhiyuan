import { get, post } from './api'
import { PopularMajorsListResponse, QueryPopularMajorParams } from '@/types/api'

/**
 * 获取热门专业列表（支持分页、排序、筛选）
 * @param params 查询参数
 * @returns 热门专业列表及分页信息
 */
export const getPopularMajors = async (
  params?: QueryPopularMajorParams
): Promise<PopularMajorsListResponse> => {
  const response: any = await get<PopularMajorsListResponse>('/popular-majors', params)
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提取 data
    if (response.data && typeof response.data === 'object') {
      // 检查 data 中是否包含 items 和 meta
      if (response.data.items || response.data.meta) {
        return response.data
      }
      // 如果 data 本身没有 items 和 meta，但 response 有，说明 data 就是 items 和 meta
      if (response.items || response.meta) {
        return response
      }
    }
    // 如果直接包含 items 和 meta 字段，直接返回
    if (response.items || response.meta) {
      return response
    }
    // 其他情况直接返回
    return response
  }
  return response
}

/**
 * 根据教育层次获取热门专业列表（路径参数接口）
 * @param level1 教育层次：ben-本科, zhuan-专科, gao_ben-高职本科
 * @param params 其他查询参数（可选）
 * @returns 热门专业列表及分页信息
 */
export const getPopularMajorsByLevel = async (
  level1: 'ben' | 'zhuan' | 'gao_ben',
  params?: Omit<QueryPopularMajorParams, 'level1'>
): Promise<PopularMajorsListResponse> => {
  const response: any = await get<PopularMajorsListResponse>(
    `/popular-majors/level/${level1}`,
    params
  )
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提取 data
    if (response.data && typeof response.data === 'object') {
      // 检查 data 中是否包含 items 和 meta
      if (response.data.items || response.data.meta) {
        return response.data
      }
      // 如果 data 本身没有 items 和 meta，但 response 有，说明 data 就是 items 和 meta
      if (response.items || response.meta) {
        return response
      }
    }
    // 如果直接包含 items 和 meta 字段，直接返回
    if (response.items || response.meta) {
      return response
    }
    // 其他情况直接返回
    return response
  }
  return response
}

/**
 * 创建或更新热门专业问卷答案的请求参数
 */
export interface CreatePopularMajorAnswerParams {
  /**
   * 热门专业ID
   */
  popularMajorId: number
  /**
   * 量表ID（问卷题目ID）
   */
  scaleId: number
  /**
   * 得分（值范围为 -2 到 2）
   */
  score: number
}

/**
 * 热门专业问卷答案响应数据
 */
export interface PopularMajorAnswerResponse {
  id: number
  popularMajorId: number
  scaleId: number
  userId: number
  score: number
  createdAt?: string
  updatedAt?: string
}

/**
 * 创建或更新热门专业问卷答案
 * @param params 答案参数（包含 popularMajorId, scaleId, score）
 * @returns 创建或更新后的答案
 */
export const createOrUpdatePopularMajorAnswer = async (
  params: CreatePopularMajorAnswerParams
): Promise<PopularMajorAnswerResponse> => {
  const response: any = await post<PopularMajorAnswerResponse>('/popular-majors/answers', params)
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提取 data（后端标准格式）
    if (response.data) {
      return response.data
    }
    // 如果直接包含答案字段，直接返回
    if (response.id && response.popularMajorId && response.scaleId !== undefined) {
      return response
    }
    // 其他情况直接返回
    return response
  }
  return response
}

