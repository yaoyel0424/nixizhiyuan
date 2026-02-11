import Taro from '@tarojs/taro'
import { get, post } from './api'
import { ScalesWithAnswersResponse, CreateScaleAnswerParams, ScaleAnswer } from '@/types/api'

/**
 * 获取当前用户ID
 * @returns 用户ID（number类型），如果获取失败返回 null
 */
function getCurrentUserId(): number | null {
  try {
    // 尝试�?Redux persist 存储中获取用户信�?
    // Redux persist 通常使用 'persist:root' 或类似的 key
    const persistRoot = Taro.getStorageSync('persist:root')
    if (persistRoot) {
      try {
        const rootData = typeof persistRoot === 'string' ? JSON.parse(persistRoot) : persistRoot
        if (rootData && rootData.user) {
          const userData = typeof rootData.user === 'string' ? JSON.parse(rootData.user) : rootData.user
          if (userData && userData.userInfo && userData.userInfo.id) {
            const userId = parseInt(userData.userInfo.id, 10)
            if (!isNaN(userId)) {
              return userId
            }
          }
        }
      } catch (parseError) {
        console.warn('解析 Redux persist 数据失败:', parseError)
      }
    }
    
    // 备选方案：尝试从直接存储的 userInfo 获取
    const userInfoStr = Taro.getStorageSync('userInfo')
    if (userInfoStr) {
      const userInfo = typeof userInfoStr === 'string' ? JSON.parse(userInfoStr) : userInfoStr
      if (userInfo && userInfo.id) {
        const userId = parseInt(userInfo.id, 10)
        if (!isNaN(userId)) {
          return userId
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('获取用户ID失败:', error)
    return null
  }
}

/**
 * 获取所有量表列表及用户答案
 * @returns 包含量表列表和答案列表的响应
 */
export const getScalesWithAnswers = async (): Promise<ScalesWithAnswersResponse> => {
  const response: any = await get<ScalesWithAnswersResponse>('/scales')
  console.log('getScalesWithAnswers 原始响应:', response)
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提�?data（后端标准格式：{ success, code, message, data: { scales, answers } }�?
    if (response.data && typeof response.data === 'object') {
      // 检�?data 中是否包�?scales �?answers
      if (response.data.scales || response.data.answers) {
        console.log('�?response.data 提取数据:', response.data)
        return response.data
      }
      // 如果 data 本身没有 scales �?answers，但 response 有，说明 data 就是 scales �?answers
      if (response.scales || response.answers) {
        console.log('直接使用 response:', response)
        return response
      }
    }
    // 如果直接包含 scales �?answers 字段，直接返�?
    if (response.scales || response.answers) {
      console.log('直接返回 response（包�?scales/answers�?', response)
      return response
    }
    // 其他情况直接返回
    console.log('其他情况，直接返�?response:', response)
    return response
  }
  console.log('响应格式异常:', response)
  return response
}

/**
 * 创建或更新量表答�?
 * @param params 答案参数（包�?scaleId, userId, score�?
 * @returns 创建或更新后的答�?
 */
export const createOrUpdateScaleAnswer = async (
  params: CreateScaleAnswerParams
): Promise<any> => {
  const response: any = await post<ScaleAnswer>('/scales/answers', params)
  // 返回完整响应，包含 code 字段，用于检查是否成功
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  // 但我们需要保留完整的响应对象，以便检查 code 字段
  return response
}

/**
 * 提交量表答案（自动获�?userId�?
 * @param scaleId 量表ID
 * @param score 分数
 * @param userId 用户ID（可选，如果不提供则自动获取�?
 * @returns 创建或更新后的答�?
 */
export const submitScaleAnswer = async (
  scaleId: number,
  score: number,
  userId?: number
): Promise<any> => {
  // 如果没有提供 userId，尝试自动获�?
  let finalUserId = userId || getCurrentUserId()

  // 无 userId 时先尝试静默登录（兼容启动未完成或 iOS 等真机时序），再重试获取
  if (!finalUserId) {
    try {
      const { silentLogin } = await import('@/utils/auth')
      const ok = await silentLogin()
      if (ok) finalUserId = getCurrentUserId()
    } catch (_) {
      // 静默登录失败则下方统一抛错
    }
  }

  if (!finalUserId) {
    throw new Error('无法获取用户ID，请先登陆')
  }

  return createOrUpdateScaleAnswer({
    scaleId,
    userId: finalUserId,
    score,
  })
}

/**
 * 根据专业详情ID获取对应的量表列表及用户答案
 * @param majorDetailId 专业详情ID
 * @returns 包含量表列表和答案列表的响应
 */
export const getScalesByMajorDetailId = async (
  majorDetailId: number
): Promise<ScalesWithAnswersResponse> => {
  const response: any = await get<ScalesWithAnswersResponse>(
    `/scales/major-detail/${majorDetailId}`
  )
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提�?data
    if (response.data && typeof response.data === 'object') {
      // 检�?data 中是否包�?scales �?answers
      if (response.data.scales || response.data.answers) {
        return response.data
      }
      // 如果 data 本身没有 scales �?answers，但 response 有，说明 data 就是 scales �?answers
      if (response.scales || response.answers) {
        return response
      }
    }
    // 如果直接包含 scales �?answers 字段，直接返�?
    if (response.scales || response.answers) {
      return response
    }
    // 其他情况直接返回
    return response
  }
  return response
}

/**
 * 根据热门专业ID获取对应的量表列表及用户答案
 * @param popularMajorId 热门专业ID
 * @returns 包含量表列表和答案列表的响应
 */
export const getScalesByPopularMajorId = async (
  popularMajorId: number
): Promise<ScalesWithAnswersResponse> => {
  const response: any = await get<ScalesWithAnswersResponse>(
    `/scales/popular-major/${popularMajorId}`
  )
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提�?data
    if (response.data && typeof response.data === 'object') {
      // 检�?data 中是否包�?scales �?answers
      if (response.data.scales || response.data.answers) {
        return response.data
      }
      // 如果 data 本身没有 scales �?answers，但 response 有，说明 data 就是 scales �?answers
      if (response.scales || response.answers) {
        return response
      }
    }
    // 如果直接包含 scales �?answers 字段，直接返�?
    if (response.scales || response.answers) {
      return response
    }
    // 其他情况直接返回
    return response
  }
  return response
}

/**
 * 根据元素ID获取对应的量表列表及用户答案
 * @param elementId 元素ID
 * @returns 包含量表列表和答案列表的响应
 */
export const getScalesByElementId = async (
  elementId: number
): Promise<ScalesWithAnswersResponse> => {
  const response: any = await get<ScalesWithAnswersResponse>(
    `/scales/element/${elementId}`
  )
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提�?data
    if (response.data && typeof response.data === 'object') {
      // 检�?data 中是否包�?scales �?answers
      if (response.data.scales || response.data.answers) {
        return response.data
      }
      // 如果 data 本身没有 scales �?answers，但 response 有，说明 data 就是 scales �?answers
      if (response.scales || response.answers) {
        return response
      }
    }
    // 如果直接包含 scales �?answers 字段，直接返�?
    if (response.scales || response.answers) {
      return response
    }
    // 其他情况直接返回
    return response
  }
  return response
}

/**
 * 根据元素ID和热门专业ID获取对应的量表列表及用户答案（从 popular_major_answers 表查询）
 * @param elementId 元素ID
 * @param popularMajorId 热门专业ID
 * @returns 包含量表列表和答案列表的响应
 */
export const getScalesByElementIdForPopularMajor = async (
  elementId: number,
  popularMajorId: number
): Promise<ScalesWithAnswersResponse> => {
  const response: any = await get<ScalesWithAnswersResponse>(
    `/scales/element/${elementId}/popular-major/${popularMajorId}`
  )
  
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提�?data
    if (response.data && typeof response.data === 'object') {
      // 检�?data 中是否包�?scales �?answers
      if (response.data.scales || response.data.answers) {
        return response.data
      }
      // 如果 data 本身没有 scales �?answers，但 response 有，说明 data 就是 scales �?answers
      if (response.scales || response.answers) {
        return response
      }
    }
    // 如果直接包含 scales �?answers 字段，直接返�?
    if (response.scales || response.answers) {
      return response
    }
    // 其他情况直接返回
    return response
  }
  return response
}