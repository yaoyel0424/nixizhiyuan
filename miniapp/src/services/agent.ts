import Taro from '@tarojs/taro'
import { get, post, patch } from './api'

/** 扫码进入时存储的代理商 UUID 的 storage key（来自小程序码 scene） */
export const STORAGE_KEY_LAUNCH_AGENT_UUID = 'launch_agent_uuid'

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
 * 从本地存储读取本次启动时通过扫码带入的代理商 UUID（若有）
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
 * 通过代理商 UUID 将当前用户绑定到该代理商（PATCH /users/agent）
 */
export function bindAgentByUuid(uuid: string) {
  return patch<any>('/users/agent', { uuid })
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
