import { get, post, put } from './api'
import { UserInfo, UpdateUserParams, ChangePasswordParams } from '@/types/api'

/**
 * 获取用户信息
 * @returns 用户信息
 */
export const getUserInfo = (): Promise<UserInfo> => {
  return get<UserInfo>('/user/info')
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
