import Taro from '@tarojs/taro'
import { get, post, patch } from './api'

/** 扫码进入时存储的代理商 UUID 的 storage key（来自小程序码 scene） */
export const STORAGE_KEY_LAUNCH_AGENT_UUID = 'launch_agent_uuid'
/** 绑定来源：scan=扫码进入，share_link=分享链接进入 */
export const STORAGE_KEY_LAUNCH_AGENT_FROM = 'launch_agent_from'

/** 创建代理商参数（userId 由后端从当前登录用户获取） */
export interface CreateAgentParams {
  type: 'personal' | 'store'
  name?: string | null
  phone?: string | null
  merchantId?: string | null
}

/**
 * 将小程序码 scene 参数字符串（32 位无横线）还原为标准 UUID
 */
export function sceneToAgentUuid(scene: string): string {
  const s = (scene || '').replace(/-/g, '').trim().slice(0, 32)
  if (s.length !== 32) return ''
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`
}

/**
 * 从本地存储读取本次启动时通过扫码/分享带入的代理商 UUID（若有）
 */
export function getLaunchAgentUuid(): string | null {
  try {
    const uuid = Taro.getStorageSync(STORAGE_KEY_LAUNCH_AGENT_UUID)
    return typeof uuid === 'string' && uuid ? uuid : null
  } catch {
    return null
  }
}

/**
 * 从本地存储读取本次启动时的绑定来源：scan | share_link（若有）
 */
export function getLaunchAgentFrom(): 'scan' | 'share_link' | null {
  try {
    const from = Taro.getStorageSync(STORAGE_KEY_LAUNCH_AGENT_FROM)
    return from === 'scan' || from === 'share_link' ? from : null
  } catch {
    return null
  }
}

/**
 * 获取当前用户的代理商信息：自己是代理商返回自己，否则返回自己归属的代理商，都没有则返回空对象
 */
export interface AgentMeResponse {
  id?: number
  uuid?: string
  type?: string
  name?: string
  phone?: string | null
  merchantId?: string | null
  splitRatio?: number
  status?: string
}

export async function getAgentMe(): Promise<AgentMeResponse> {
  const res = await get<AgentMeResponse>('/agent/me')
  const data = (res as any)?.data ?? res
  return (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as AgentMeResponse
}

/**
 * 通过代理商 UUID 将当前用户绑定到该代理商（PATCH /users/agent）
 * @param from 可选，绑定来源：scan=扫码进入，share_link=分享链接进入
 */
export function bindAgentByUuid(uuid: string, from?: 'scan' | 'share_link') {
  return patch<any>('/users/agent', { uuid, ...(from && { from }) })
}

/**
 * 创建或获取当前用户的代理商（有则跳过）
 */
export function createAgent(params: CreateAgentParams) {
  return post<any>('/agent', params)
}

/**
 * 获取当前用户关联的推广二维码（base64 图片）
 * 若用户未关联代理商，需先调用 createAgent
 */
export async function getAgentQrcodeBase64(page?: string): Promise<string> {
  const params: Record<string, string> = { format: 'base64' }
  if (page) params.page = page
  const res = await get<{ image: string }>('/agent/qrcode', params)
  const image = (res as any)?.data?.image ?? (res as any)?.image
  if (typeof image !== 'string') {
    throw new Error('获取推广二维码失败')
  }
  return image
}
