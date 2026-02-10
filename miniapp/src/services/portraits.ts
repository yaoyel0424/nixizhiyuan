import { get, post } from './api'

/**
 * 用户画像数据接口
 */
export interface PortraitData {
  portrait: Portrait[]
  challenge: Challenge[]
  element: Element[]
  mechanism: Mechanism[]
}

/**
 * 元素信息接口
 */
export interface ElementInfo {
  id: number
  name: string
  type: 'like' | 'talent'
  dimension?: string
}

/**
 * 象限信息接口
 */
export interface QuadrantInfo {
  id: number
  quadrants: number
  name: string
  title: string
}

/**
 * 生态位接口（适配角色）
 */
export interface Niche {
  id: number
  title: string
  description: string
  possibleRoles: string
  explorationSuggestions: string
}

/**
 * 象限挑战/困境通用接口（第一象限挑战、第二象限生活挑战、第三象限弱点、第四象限困境等）
 */
export interface Quadrant4Dilemma {
  id: number
  type: string
  name: string
  description: string
  cultivationStrategy: string
  strategy: string
  capabilityBuilding?: string
}

/** 第二象限可行性研究 */
export interface Quadrant2FeasibilityStudy {
  id: number
  title: string
  talentValue?: string
  exploratoryReference?: string
  sceneSetting?: string
}

/** 第三象限补偿策略 */
export interface Quadrant3Compensation {
  id: number
  name: string
  description?: string
}

/**
 * 第四象限成长路径接口（核心生态位）
 */
export interface Quadrant4GrowthPath {
  id: number
  title: string
  description: string
  possibleRoles: string
  explorationSuggestions: string
}

/**
 * 画像接口
 */
export interface Portrait {
  id: number
  name: string
  status: string
  partOneMainTitle?: string
  partOneSubTitle?: string
  partOneDescription: string
  partTwoDescription?: string
  likeElement: ElementInfo
  talentElement: ElementInfo
  quadrant: QuadrantInfo
  quadrant1Challenges?: Quadrant4Dilemma[]
  quadrant1Niches?: Niche[]
  quadrant2LifeChallenges?: Quadrant4Dilemma[]
  quadrant2FeasibilityStudies?: Quadrant2FeasibilityStudy[]
  quadrant3Weaknesses?: Quadrant4Dilemma[]
  quadrant3Compensations?: Quadrant3Compensation[]
  quadrant4Dilemmas?: Quadrant4Dilemma[]
  quadrant4GrowthPaths?: Quadrant4GrowthPath[]
  // 兼容旧字段
  like_id?: number
  talent_id?: number
  like_obvious?: boolean
  talent_obvious?: boolean
  explain?: string
}

/**
 * 挑战接口
 */
export interface Challenge {
  id: number
  like_id: number
  talent_id: number
  like_obvious: boolean
  talent_obvious: boolean
  type: string
  name: string
  content: string
  strategy: string
}

/**
 * 要素接口
 */
export interface Element {
  id: number
  name: string
  type: string
  dimension: string
  correlation_talent_id: number | null
}

/**
 * 机制接口
 */
export interface Mechanism {
  id: number
  reason_id: number
  element_id: number
  content: string
  brief: string
  remarks: string | null
}

/**
 * 查询用户画像
 * @returns 用户画像数据（包含 portraits 数组，对应7个维度）
 */
export const getUserPortrait = async (): Promise<PortraitData> => {
  const response: any = await get<any>('/portraits/user')
  
  // 处理响应数据
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提取 data
    const data = response.data || response
    
    // 新API格式：直接返回portraits数组
    if (Array.isArray(data.portraits)) {
      return {
        portrait: data.portraits || [],
        challenge: data.challenge || [],
        element: data.element || [],
        mechanism: data.mechanism || []
      }
    }
    
    // 兼容旧格式：如果包含portrait字段（单数）
    if (Array.isArray(data.portrait)) {
      return {
        portrait: data.portrait || [],
        challenge: data.challenge || [],
        element: data.element || [],
        mechanism: data.mechanism || []
      }
    }
  }
  
  // 默认返回空数据
  return {
    portrait: [],
    challenge: [],
    element: [],
    mechanism: []
  }
}

/**
 * 获取画像反馈（不传 portraitId 返回全部，传则返回该画像的反馈）
 */
export const getPortraitFeedback = async (
  portraitId?: number,
): Promise<
  | { id: number; option: string; portraitId: number | null; createdAt: string }
  | { id: number; option: string; portraitId: number | null; createdAt: string }[]
  | null
> => {
  const url = portraitId != null ? `/portraits/feedback?portraitId=${portraitId}` : '/portraits/feedback'
  const res: any = await get(url)
  const data = res?.data ?? res
  return data
}

/**
 * 创建画像反馈（存在则更新）
 * @param option 反馈选项
 * @param portraitId 画像ID（可选）
 */
export const createPortraitFeedback = async (
  option: string,
  portraitId?: number,
): Promise<{ id: number; option: string; portraitId: number | null; createdAt: string }> => {
  const payload: { option: string; portraitId?: number } = { option }
  if (portraitId != null) payload.portraitId = portraitId
  const res: any = await post('/portraits/feedback', payload)
  const data = res?.data ?? res
  return data
}
