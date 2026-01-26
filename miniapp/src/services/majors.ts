import { get, post, del } from './api'
import { 
  MajorDetailInfo,
  FavoriteMajorParams,
  FavoriteMajorResponse,
  FavoriteMajorsListResponse,
  CheckFavoriteMajorResponse,
  FavoriteMajorsCountResponse
} from '@/types/api'

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

/**
 * 通过专业代码获取热门专业详细信息
 * @param majorCode 专业代码
 * @returns 专业详情信息
 */
export const getPopularMajorDetailByCode = async (
  majorCode: string
): Promise<MajorDetailInfo> => {
  const response: any = await get<MajorDetailInfo>(`/majors/popular-majors/detail/${majorCode}`)
  
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

/**
 * 收藏专业
 * API: POST /api/v1/majors/favorites
 * 请求参数: { "majorCode": "010101" }
 * @param majorCode 专业代码，例如 "010101"
 * @returns 收藏结果
 */
export const favoriteMajor = async (
  majorCode: string
): Promise<FavoriteMajorResponse> => {
  const response: any = await post<FavoriteMajorResponse>(
    '/majors/favorites',
    { majorCode }
  )
  
  // 处理响应数据
  if (response && typeof response === 'object') {
    if (response.data && typeof response.data === 'object') {
      if (response.data.id || response.data.majorCode) {
        return response.data
      }
    }
    if (response.id || response.majorCode) {
      return response
    }
  }
  return response
}

/**
 * 查询用户的收藏列表
 * @returns 收藏列表
 */
export const getFavoriteMajors = async (): Promise<FavoriteMajorResponse[]> => {
  const response: any = await get<FavoriteMajorsListResponse>('/majors/favorites')
  
  // 处理响应数据
  if (response && typeof response === 'object') {
    // 如果包含 items 字段，提取 items
    if (response.items && Array.isArray(response.items)) {
      return response.items
    }
    // 如果包含 data 字段，提取 data
    if (response.data) {
      if (Array.isArray(response.data)) {
        return response.data
      }
      if (response.data.items && Array.isArray(response.data.items)) {
        return response.data.items
      }
    }
    // 如果直接是数组，直接返回
    if (Array.isArray(response)) {
      return response
    }
  }
  return []
}

/**
 * 取消收藏专业
 * @param majorCode 专业代码
 * @returns 取消收藏结果
 */
export const unfavoriteMajor = async (
  majorCode: string
): Promise<void> => {
  await del(`/majors/favorites/${majorCode}`)
}

/**
 * 检查是否已收藏某个专业
 * @param majorCode 专业代码
 * @returns 是否已收藏
 */
export const checkFavoriteMajor = async (
  majorCode: string
): Promise<boolean> => {
  const response: any = await get<CheckFavoriteMajorResponse>(
    `/majors/favorites/check/${majorCode}`
  )
  
  // 处理响应数据
  if (response && typeof response === 'object') {
    if (typeof response.isFavorited === 'boolean') {
      return response.isFavorited
    }
    if (response.data && typeof response.data.isFavorited === 'boolean') {
      return response.data.isFavorited
    }
  }
  return false
}

/**
 * 获取用户的收藏数量
 * @returns 收藏数量
 */
export const getFavoriteMajorsCount = async (): Promise<number> => {
  const response: any = await get<FavoriteMajorsCountResponse>('/majors/favorites/count')
  
  // 处理响应数据
  if (response && typeof response === 'object') {
    if (typeof response.count === 'number') {
      return response.count
    }
    if (response.data && typeof response.data.count === 'number') {
      return response.data.count
    }
  }
  return 0
}

