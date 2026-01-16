import { post, get } from './api'
import { LoginParams, LoginResponse, RegisterParams } from '@/types/api'

/**
 * 用户登录
 * @param params 登录参数
 * @returns 登录响应
 */
export const login = async (params: LoginParams): Promise<LoginResponse> => {
  const response: any = await post<LoginResponse>('/auth/login', params)
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    if (response.data) {
      return response.data
    }
    return response
  }
  return response
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
export const refreshToken = async (refreshToken: string): Promise<LoginResponse> => {
  const response: any = await post<LoginResponse>('/auth/refresh', { refreshToken })
  // 响应拦截器可能返回原始数据或 BaseResponse 格式
  if (response && typeof response === 'object') {
    if (response.data) {
      return response.data
    }
    return response
  }
  return response
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
 * @param encryptedData 加密的用户信息（可选，用于手机号登录）
 * @param iv 初始向量（可选，用于手机号登录）
 * @param usePhoneAsNickname 是否将手机号作为昵称（可选，默认为 false）
 * @returns 登录响应
 */
export const wechatLogin = async (
  code: string,
  encryptedData?: string,
  iv?: string,
  usePhoneAsNickname: boolean = false,
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

  // 如果指定将手机号作为昵称，添加标志
  if (usePhoneAsNickname) {
    params.usePhoneAsNickname = true;
  }

  // 使用 POST 请求，code 放在 body 中（后端支持从 query 或 body 获取）
  // 注意：响应拦截器可能返回原始数据或 BaseResponse 格式
  const requestBody: any = { code };
  if (encryptedData && iv) {
    requestBody.encryptedData = encryptedData;
    requestBody.iv = iv;
  }
  // 如果指定将手机号作为昵称，添加标志
  if (usePhoneAsNickname) {
    requestBody.usePhoneAsNickname = true;
  }
  
  const response: any = await post<any>('/auth/wechat/login', requestBody);

  // 后端返回格式：
  // {
  //   success: true,
  //   code: "SUCCESS",
  //   message: "操作成功",
  //   data: {
  //     user: {
  //       id, openid, nickname, accessToken, refreshToken,
  //       user: { id, openid, nickname, avatarUrl }  // 嵌套的 user（包含 avatarUrl）
  //     }
  //   }
  // }
  
  if (response && typeof response === 'object') {
    // 如果包含 data 字段，提取 data（后端标准格式）
    if (response.data) {
      const data = response.data;
      
      // 提取 user 对象
      let user = data.user;
      
      // 如果 user 内部还有嵌套的 user 对象，合并它们
      if (user && typeof user === 'object' && user.user) {
        // 合并嵌套的 user 对象（优先使用外层 user 的属性，嵌套 user 补充缺失的属性）
        user = {
          ...user.user,  // 先使用嵌套 user（包含 avatarUrl）
          ...user,       // 再用外层 user 覆盖（包含 accessToken, refreshToken）
        };
        // 移除嵌套的 user 字段
        delete user.user;
      }
      
      // 构建返回结果
      const result: any = {
        user: user || {},
        accessToken: data.accessToken || user?.accessToken,
        refreshToken: data.refreshToken || user?.refreshToken,
      };
      
      return result;
    }
    
    // 如果直接包含 user 字段，说明是直接返回的用户对象
    if (response.user) {
      // 处理嵌套的 user
      let user = response.user;
      if (user && typeof user === 'object' && user.user) {
        user = {
          ...user.user,
          ...user,
        };
        delete user.user;
      }
      
      return {
        user,
        accessToken: response.accessToken || user?.accessToken,
        refreshToken: response.refreshToken || user?.refreshToken,
      };
    }
    
    // 其他情况直接返回
    return response;
  }

  return response;
};
