import { get } from './api'
import { MajorScoreResponse } from '@/types/api'

/**
 * 获取所有专业分数
 * @param eduLevel 教育层次（可选）：ben-本科, zhuan-专科, gao_ben-本科(职业)
 * @returns 专业分数列表
 */
export const getAllScores = async (
  eduLevel?: string
): Promise<MajorScoreResponse[]> => {
  const params: Record<string, any> = {}
  if (eduLevel) {
    params.eduLevel = eduLevel
  }
  
  const response: any = await get<MajorScoreResponse[]>('/scores/all', params)
  
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
  return response || []
}

