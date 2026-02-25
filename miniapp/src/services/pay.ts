import Taro from '@tarojs/taro'
import { get } from './api'
import { getCurrentUserId } from './user'

/** 免费额度查询结果（GET /pay/free-quota） */
export interface FreeQuotaResult {
  /** 剩余免费查看次数 */
  remaining: number
  /** 用户已用免费额度查看的热门专业 code 列表 */
  majorCodes?: string[]
  /** 是否已解锁全部（为 true 时不弹温馨提示） */
  hasUnlockAll?: boolean
}

/**
 * 查询免费额度使用情况
 * GET /pay/free-quota
 * @returns 剩余免费次数、已使用的专业 code 列表、是否解锁全部等
 */
export const getFreeQuota = async (): Promise<FreeQuotaResult> => {
  const response: any = await get<FreeQuotaResult>('/pay/free-quota')
  const data = response?.data ?? response ?? {}
  if (response && typeof response === 'object') {
    const remaining =
      typeof data.remaining === 'number'
        ? data.remaining
        : typeof response.remaining === 'number'
          ? response.remaining
          : 0
    const majorCodes = Array.isArray(data.majorCodes)
      ? data.majorCodes
      : Array.isArray(response.majorCodes)
        ? response.majorCodes
        : []
    const hasUnlockAll = Boolean(data.hasUnlockAll ?? response.hasUnlockAll)
    return { remaining, majorCodes, hasUnlockAll }
  }
  return { remaining: 0, majorCodes: [], hasUnlockAll: false }
}

/**
 * 检查是否可查看热门专业（含已支付、免费额度、解锁全部等）
 * GET /pay/can-view
 * @param userId 用户 ID（必填）
 * @param majorCode 热门专业 code（必填）
 */
export const getCanView = async (userId: number, majorCode: string): Promise<{ canView: boolean }> => {
  const response: any = await get<{ canView: boolean }>('/pay/can-view', { userId, majorCode })
  const canView = response?.data?.canView ?? response?.canView ?? false
  return { canView }
}

/**
 * 判断是否拥有免费权益（可用免费额度查看该热门专业）
 * GET /pay/free-entitlement
 * @param popularMajorId 热门专业 ID
 */
export const getFreeEntitlement = async (popularMajorId: number): Promise<{ hasFreeEntitlement: boolean }> => {
  const response: any = await get<{ hasFreeEntitlement: boolean }>('/pay/free-entitlement', { popularMajorId })
  const hasFreeEntitlement = response?.data?.hasFreeEntitlement ?? response?.hasFreeEntitlement ?? false
  return { hasFreeEntitlement }
}

/**
 * 获取解锁全部应付金额（已付热门专业可抵扣）
 * GET /pay/unlock-all-amount
 * 服务端返回 amountCents（分）、deductCents、hasUnlockAll
 */
export const getUnlockAllAmount = async (): Promise<{
  amountCents: number
  amount: number
  hasUnlockAll: boolean
}> => {
  const response: any = await get<{
    amountCents?: number
    amount?: number
    hasUnlockAll?: boolean
  }>('/pay/unlock-all-amount')
  const data = response?.data ?? response ?? {}
  const amountCents = data.amountCents ?? data.amount ?? 0
  const amount = typeof amountCents === 'number' ? amountCents / 100 : 0
  const hasUnlockAll = Boolean(data.hasUnlockAll ?? amountCents <= 0)
  return { amountCents, amount, hasUnlockAll }
}

/**
 * 热门专业权益汇总（免费使用过的专业 + 已交费测评的专业）
 * GET /pay/popular-major-entitlement-summary
 */
export const getPopularMajorEntitlementSummary = async (): Promise<any> => {
  const response: any = await get('/pay/popular-major-entitlement-summary')
  return response?.data ?? response ?? {}
}

/** 每个热门专业价格（元） */
export const POPULAR_MAJOR_PRICE = 29.9

/** JSAPI 预支付订单返回的支付参数（供 Taro.requestPayment 使用） */
export interface JsapiPayParams {
  timeStamp?: string
  nonceStr?: string
  package?: string
  signType?: string
  paySign?: string
}

/**
 * 创建 JSAPI 预支付订单并调起支付
 * GET /pay/transactions_jsapi
 * 参数：userId(必填), productType=popular_major, majorCode(热门专业 code，productType=popular_major 时必传)
 * @param majorCode 热门专业 code（productType=popular_major 时必传）
 * @returns 支付是否完成（用户确认支付成功）
 */
export const requestPayForPopularMajor = async (majorCode: string): Promise<boolean> => {
  const userId = getCurrentUserId()
  if (userId == null) {
    Taro.showToast({ title: '请先登录', icon: 'none' })
    return false
  }
  try {
    const orderRes: any = await get<JsapiPayParams>('/pay/transactions_jsapi', {
      userId,
      productType: 'popular_major',
      majorCode
    })
    // 接口返回结构为 data.data 内才是调起支付所需参数（package、paySign、timeStamp 等）
    const payParams: JsapiPayParams =
      orderRes?.data?.data ?? orderRes?.data ?? orderRes
    if (!payParams || (!payParams.package && !payParams.paySign)) {
      Taro.showToast({
        title: orderRes?.message || '获取支付信息失败',
        icon: 'none'
      })
      return false
    }
    // 只传微信要求的 5 个字段，timeStamp 需为字符串
    const requestPayload = {
      timeStamp: String(payParams.timeStamp ?? ''),
      nonceStr: payParams.nonceStr ?? '',
      package: payParams.package ?? '',
      signType: payParams.signType ?? 'RSA',
      paySign: payParams.paySign ?? ''
    }
    await Taro.requestPayment(requestPayload)
    return true
  } catch (e: any) {
    if (e?.errMsg?.includes('cancel') || e?.errMsg?.includes('取消')) {
      return false
    }
    Taro.showToast({
      title: e?.message || '支付失败',
      icon: 'none'
    })
    return false
  }
}

/**
 * 解锁全部（专业探索/热门专业通用）
 * GET /pay/transactions_jsapi，productType=unlock_all
 * @returns 支付是否完成
 */
export const requestPayForUnlockAll = async (): Promise<boolean> => {
  const userId = getCurrentUserId()
  if (userId == null) {
    Taro.showToast({ title: '请先登录', icon: 'none' })
    return false
  }
  try {
    const orderRes: any = await get<JsapiPayParams>('/pay/transactions_jsapi', {
      userId,
      productType: 'unlock_all',
    })
    const payParams: JsapiPayParams =
      orderRes?.data?.data ?? orderRes?.data ?? orderRes
    if (!payParams || (!payParams.package && !payParams.paySign)) {
      Taro.showToast({
        title: orderRes?.message || '获取支付信息失败',
        icon: 'none',
      })
      return false
    }
    const requestPayload = {
      timeStamp: String(payParams.timeStamp ?? ''),
      nonceStr: payParams.nonceStr ?? '',
      package: payParams.package ?? '',
      signType: payParams.signType ?? 'RSA',
      paySign: payParams.paySign ?? '',
    }
    await Taro.requestPayment(requestPayload)
    return true
  } catch (e: any) {
    if (e?.errMsg?.includes('cancel') || e?.errMsg?.includes('取消')) {
      return false
    }
    Taro.showToast({
      title: e?.message || '支付失败',
      icon: 'none',
    })
    return false
  }
}
