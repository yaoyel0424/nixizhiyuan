import { post, get } from './api'
import { LoginParams, LoginResponse, RegisterParams } from '@/types/api'

/**
 * 用户登录
 * @param params 登录参数
 * @returns 登录响应
 */
export const login = (params: LoginParams): Promise<LoginResponse> => {
  return post<LoginResponse>('/auth/login', params)
}

/**
 * 用户注册
 * @param params 注册参数
 * @returns 注册响应
 */
export const register = (params: RegisterParams): Promise<any> => {
  return post('/auth/register', params)
}

/**
 * 用户登出
 * @returns 登出响应
 */
export const logout = (): Promise<any> => {
  return post('/auth/logout')
}

/**
 * 刷新token
 * @param refreshToken 刷新token
 * @returns 新的token
 */
export const refreshToken = (refreshToken: string): Promise<LoginResponse> => {
  return post<LoginResponse>('/auth/refresh', { refreshToken })
}

/**
 * 获取验证码
 * @param phone 手机号
 * @returns 验证码响应
 */
export const getCaptcha = (phone: string): Promise<any> => {
  return post('/auth/captcha', { phone })
}

/**
 * 验证验证码
 * @param phone 手机号
 * @param captcha 验证码
 * @returns 验证响应
 */
export const verifyCaptcha = (phone: string, captcha: string): Promise<any> => {
  return post('/auth/verify-captcha', { phone, captcha })
}

/**
 * 忘记密码
 * @param phone 手机号
 * @param captcha 验证码
 * @param newPassword 新密码
 * @returns 重置响应
 */
export const resetPassword = (phone: string, captcha: string, newPassword: string): Promise<any> => {
  return post('/auth/reset-password', { phone, captcha, newPassword })
}

/**
 * 检查token是否有效
 * @returns 检查结果
 */
export const checkToken = (): Promise<any> => {
  return get('/auth/check-token')
}

/**
 * 微信登录
 * @param code 微信授权码
 * @param encryptedData 加密的用户信息（可选）
 * @param iv 初始向量（可选）
 * @returns 登录响应
 */
export const wechatLogin = async (
  code: string,
  encryptedData?: string,
  iv?: string,
): Promise<any> => {
  // 构建请求参数
  const params: any = {
    code,
  };

  // 如果有加密数据，添加到请求体中
  if (encryptedData && iv) {
    params.encryptedData = encryptedData;
    params.iv = iv;
  }

  // 使用 POST 请求，code 放在 query 中，加密数据放在 body 中
  const response = await post<any>(
    '/auth/wechat/login?code=' + encodeURIComponent(code),
    encryptedData && iv ? { encryptedData, iv } : undefined,
  );

  // 如果返回的是标准 BaseResponse 格式
  if (response.data) {
    return response.data;
  }

  // 如果直接返回用户对象（后端可能直接返回）
  if (response.data.user) {
    return response.data;
  }

  return response.data;
};
