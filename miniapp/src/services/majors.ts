import { get } from './api'
import { MajorDetailInfo } from '@/types/api'

/**
 * 通过专业代码获取专业详细信息
 * @param majorCode 专业代码
 * @returns 专业详情信息
 */
export const getMajorDetailByCode = async (
  majorCode: string
): Promise<MajorDetailInfo> => {
  const response: any = await get<MajorDetailInfo>(`/majors/detail/${majorCode}`)
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提取 data
    if (response.data && typeof response.data === 'object') {
      // 检查 data 中是否包含专业详情字段
      if (response.data.id || response.data.code) {
        return response.data
      }
      // 如果 data 本身没有专业详情字段，但 response 有，说明 data 就是专业详情
      if (response.id || response.code) {
        return response
      }
    }
    // 如果直接包含专业详情字段，直接返回
    if (response.id || response.code) {
      return response
    }
    // 其他情况直接返回
    return response
  }
  return response
}

