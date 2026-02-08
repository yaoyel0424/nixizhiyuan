import { get, post, del } from './api'
import {
  ProvincesListResponse,
  FavoriteProvinceParams,
  FavoriteProvinceResponse,
  FavoriteProvincesListResponse,
  CheckFavoriteResponse,
  FavoriteCountResponse
} from '@/types/api'

/**
 * 获取所有省份列表
 * @returns 省份列表
 */
export const getProvinces = async (): Promise<ProvincesListResponse> => {
  const response: any = await get<ProvincesListResponse>('/provinces')
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提取 data
    if (response.data && typeof response.data === 'object') {
      // API 返回格式：{ data: { provinces: [...], types: [...] } }
      if (Array.isArray(response.data.provinces)) {
        return {
          items: response.data.provinces,
          total: response.data.provinces.length
        }
      }
      // 兼容旧格式：data 中直接包含 items
      if (Array.isArray(response.data.items)) {
        return {
          items: response.data.items,
          total: response.data.total || response.data.items.length
        }
      }
      // 兼容旧格式：data 本身就是数组
      if (Array.isArray(response.data)) {
        return {
          items: response.data,
          total: response.data.length
        }
      }
    }
    // 如果直接包含 items 字段，直接返回
    if (Array.isArray(response.items)) {
      return response
    }
    // 如果直接包含 provinces 字段（兼容处理）
    if (Array.isArray(response.provinces)) {
      return {
        items: response.provinces,
        total: response.provinces.length
      }
    }
    // 如果是数组，包装成标准格式
    if (Array.isArray(response)) {
      return {
        items: response,
        total: response.length
      }
    }
    // 其他情况直接返回
    return response
  }
  return response
}

/**
 * 收藏省份
 * @param params 收藏参数（包含 provinceId）
 * @returns 收藏结果
 */
export const favoriteProvince = async (
  params: FavoriteProvinceParams
): Promise<FavoriteProvinceResponse> => {
  const response: any = await post<FavoriteProvinceResponse>('/provinces/favorites', params)
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提取 data
    if (response.data) {
      return response.data
    }
    // 如果直接包含收藏字段，直接返回
    if (response.id && response.provinceId) {
      return response
    }
    // 其他情况直接返回
    return response
  }
  return response
}

/**
 * 获取用户的收藏列表
 * @returns 收藏列表
 */
export const getFavoriteProvinces = async (): Promise<FavoriteProvincesListResponse> => {
  const response: any = await get<FavoriteProvincesListResponse>('/provinces/favorites')
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提取 data
    if (response.data && typeof response.data === 'object') {
      // 检查 data 中是否包含 items
      if (Array.isArray(response.data.items) || Array.isArray(response.data)) {
        return {
          items: Array.isArray(response.data.items) ? response.data.items : response.data,
          total: response.data.total || response.total
        }
      }
    }
    // 如果直接包含 items 字段，直接返回
    if (Array.isArray(response.items)) {
      return response
    }
    // 如果是数组，包装成标准格式
    if (Array.isArray(response)) {
      return {
        items: response,
        total: response.length
      }
    }
    // 其他情况直接返回
    return response
  }
  return response
}

/**
 * 取消收藏省份
 * @param provinceId 省份ID
 * @returns 删除结果
 */
export const unfavoriteProvince = async (provinceId: number): Promise<void> => {
  await del<void>(`/provinces/favorites/${provinceId}`)
}

/**
 * 批量添加收藏
 * @param provinceIds 省份ID列表
 * @returns { added: number } 本次新增数量
 */
export const batchAddFavorites = async (
  provinceIds: number[]
): Promise<{ added: number }> => {
  const response: any = await post<{ added: number }>('/provinces/favorites/batch', { provinceIds })
  if (response && typeof response === 'object' && response.data) {
    return response.data
  }
  if (response && typeof response.added === 'number') {
    return response
  }
  return response || { added: 0 }
}

/**
 * 批量取消收藏
 * @param provinceIds 省份ID列表
 * @returns { removed: number } 本次取消数量
 */
export const batchRemoveFavorites = async (
  provinceIds: number[]
): Promise<{ removed: number }> => {
  const response: any = await post<{ removed: number }>('/provinces/favorites/batch/remove', { provinceIds })
  if (response && typeof response === 'object' && response.data) {
    return response.data
  }
  if (response && typeof response.removed === 'number') {
    return response
  }
  return response || { removed: 0 }
}

/**
 * 检查是否已收藏某个省份
 * @param provinceId 省份ID
 * @returns 是否已收藏
 */
export const checkFavoriteProvince = async (
  provinceId: number
): Promise<CheckFavoriteResponse> => {
  const response: any = await get<CheckFavoriteResponse>(`/provinces/favorites/check/${provinceId}`)
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提取 data
    if (response.data) {
      return response.data
    }
    // 如果直接包含 isFavorited 字段，直接返回
    if (typeof response.isFavorited === 'boolean') {
      return response
    }
    // 其他情况直接返回
    return response
  }
  return response
}

/**
 * 获取用户的收藏数量
 * @returns 收藏数量
 */
export const getFavoriteCount = async (): Promise<FavoriteCountResponse> => {
  const response: any = await get<FavoriteCountResponse>('/provinces/favorites/count')
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提取 data
    if (response.data) {
      return response.data
    }
    // 如果直接包含 count 字段，直接返回
    if (typeof response.count === 'number') {
      return response
    }
    // 其他情况直接返回
    return response
  }
  return response
}

/** 省份相关 API（默认导出，兼容小程序构建） */
export default {
  getProvinces,
  getFavoriteProvinces,
  favoriteProvince,
  unfavoriteProvince,
  batchAddFavorites,
  batchRemoveFavorites,
  checkFavoriteProvince,
  getFavoriteCount
}
