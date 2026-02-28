import { get, post } from './api'

/** 创建代理商参数（userId 由后端从当前登录用户获取） */
export interface CreateAgentParams {
  type: 'personal' | 'store'
  name?: string | null
  phone?: string | null
  merchantId?: string | null
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
