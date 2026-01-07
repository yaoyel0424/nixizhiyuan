import Taro from '@tarojs/taro'
import { get, post, put } from './api'
import { UserInfo, UpdateUserParams, ChangePasswordParams } from '@/types/api'

/**
 * 获取当前用户ID
 * @returns 用户ID（number类型），如果获取失败返回 null
 */
function getCurrentUserId(): number | null {
  try {
    // 尝试从 Redux persist 存储中获取用户信息
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
 * 获取用户信息
 * @returns 用户信息
 */
export const getUserInfo = (): Promise<UserInfo> => {
  return get<UserInfo>('/user/info')
}

/**
 * 获取用户详情
 * @param userId 用户ID
 * @returns 用户详情信息
 */
export const getUserDetail = (userId: number): Promise<any> => {
  return get(`/users/${userId}`)
}

/**
 * 获取当前用户详情（自动获取用户ID）
 * @returns 用户详情信息，如果无法获取用户ID则返回 null
 */
export const getCurrentUserDetail = async (): Promise<any | null> => {
  const userId = getCurrentUserId()
  if (!userId) {
    console.warn('无法获取用户ID，请先登录')
    return null
  }
  try {
    return await getUserDetail(userId)
  } catch (error) {
    console.error('获取用户详情失败:', error)
    return null
  }
}

/**
 * 更新用户信息
 * @param params 更新参数
 * @returns 更新结果
 */
export const updateUserInfo = (params: UpdateUserParams): Promise<any> => {
  return put('/user/info', params)
}

/**
 * 修改密码
 * @param params 修改密码参数
 * @returns 修改结果
 */
export const changePassword = (params: ChangePasswordParams): Promise<any> => {
  return post('/user/change-password', params)
}

/**
 * 上传头像
 * @param file 文件
 * @returns 上传结果
 */
export const uploadAvatar = (file: File): Promise<any> => {
  return post('/user/upload-avatar', { file })
}

/**
 * 获取用户设置
 * @returns 用户设置
 */
export const getUserSettings = (): Promise<any> => {
  return get('/user/settings')
}

/**
 * 更新用户设置
 * @param settings 设置
 * @returns 更新结果
 */
export const updateUserSettings = (settings: any): Promise<any> => {
  return put('/user/settings', settings)
}
