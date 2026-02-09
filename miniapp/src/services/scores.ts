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

/** 后20%接口单项 */
export type Bottom20ScoreItem = { majorId: number; score: number }

/** 后20%接口响应（含列表及该段内最高分、最低分） */
export type Bottom20ScoresResponse = {
  items: Bottom20ScoreItem[]
  maxScore: number | null
  minScore: number | null
}

/**
 * 获取分数倒序后 20% 的专业（含 items、maxScore、minScore）
 * @returns { items, maxScore, minScore }
 */
export const getBottom20Scores = async (): Promise<Bottom20ScoresResponse> => {
  const response: any = await get<Bottom20ScoresResponse>('/scores/bottom-20')
  if (response && typeof response === 'object') {
    const data = response.data ?? response
    if (data && typeof data === 'object' && Array.isArray(data.items)) {
      return {
        items: data.items,
        maxScore: data.maxScore ?? null,
        minScore: data.minScore ?? null,
      }
    }
    // 兼容旧版直接返回数组
    if (Array.isArray(data)) {
      const items = data as Bottom20ScoreItem[]
      const scores = items.map((r) => r.score).filter(Number.isFinite)
      return {
        items,
        maxScore: scores.length ? Math.max(...scores) : null,
        minScore: scores.length ? Math.min(...scores) : null,
      }
    }
  }
  return { items: [], maxScore: null, minScore: null }
}
