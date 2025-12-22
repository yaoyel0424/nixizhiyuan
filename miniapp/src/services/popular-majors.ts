import { get } from './api'
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

