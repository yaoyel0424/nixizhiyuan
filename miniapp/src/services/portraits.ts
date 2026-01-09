import { get } from './api'

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
  quadrant1Niches?: Niche[]
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
