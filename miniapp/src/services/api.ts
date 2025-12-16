import Taro from '@tarojs/taro'
import { BaseResponse, RequestConfig } from '@/types'

// API配置
const API_CONFIG = {
  baseURL: process.env.NODE_ENV === 'development' 
    ? 'https://ziquzixin.com/api/v1' 
    : 'https://ziquzixin.com/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
}

// 请求拦截器
const requestInterceptor = (config: any) => {
  // 添加token
  const token = Taro.getStorageSync('token')
  if (token) {
    config.header = {
      ...config.header,
      Authorization: `Bearer ${token}`
    }
  }
  
  // 添加时间戳防止缓存
  if (config.method === 'GET') {
    config.url += (config.url.includes('?') ? '&' : '?') + `_t=${Date.now()}`
  }
  
  return config
}

// 响应拦截器
const responseInterceptor = (response: any) => {
  const { statusCode, data } = response
  
  // 2xx 状态码都认为是 HTTP 请求成功
  if (statusCode >= 200 && statusCode < 300) {
    // 检查业务层面的成功/失败标识
    if (data && typeof data === 'object') {
      // 优先检查 success 字段：true 表示成功，false 表示失败
      if ('success' in data) {
        if (data.success === false) {
          // 明确标记为失败
          Taro.showToast({
            title: data.message || '请求失败',
            icon: 'none'
          })
          return Promise.reject(new Error(data.message || '请求失败'))
        }
        // success === true，认为是成功，直接返回
        return data
      }
      
      // 检查 code 字段
      if ('code' in data) {
        const code = data.code
        // 如果是字符串 "SUCCESS" 或数字 0，认为是成功
        if ((typeof code === 'string' && (code === 'SUCCESS' || code === '0')) ||
            (typeof code === 'number' && code === 0)) {
          // 成功，直接返回
          return data
        }
        // 其他 code 值认为是错误
        Taro.showToast({
          title: data.message || '请求失败',
          icon: 'none'
        })
        return Promise.reject(new Error(data.message || '请求失败'))
      }
      
      // 检查错误字段
      if (data.error || data.errMsg) {
        const errorMsg = data.error || data.errMsg || '请求失败'
        Taro.showToast({
          title: errorMsg,
          icon: 'none'
        })
        return Promise.reject(new Error(errorMsg))
      }
    }
    
    // 如果没有明确的成功/失败标识，HTTP 2xx 就认为是成功
    return data
  } else if (statusCode === 401) {
    // 未授权，清除token并跳转登录
    Taro.removeStorageSync('token')
    Taro.navigateTo({
      url: '/pages/login/index'
    })
    return Promise.reject(new Error('未授权'))
  } else if (statusCode === 403) {
    Taro.showToast({
      title: '权限不足',
      icon: 'none'
    })
    return Promise.reject(new Error('权限不足'))
  } else if (statusCode >= 500) {
    Taro.showToast({
      title: '服务器错误',
      icon: 'none'
    })
    return Promise.reject(new Error('服务器错误'))
  } else {
    // 其他状态码错误
    const errorMessage = data?.message || `请求失败 (${statusCode})`
    Taro.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 2000
    })
    return Promise.reject(new Error(errorMessage))
  }
}

// 通用请求方法
export const request = async <T = any>(config: RequestConfig): Promise<BaseResponse<T>> => {
  const requestConfig = {
    url: API_CONFIG.baseURL + config.url,
    method: config.method,
    data: config.data,
    header: {
      ...API_CONFIG.headers,
      ...config.headers
    },
    timeout: API_CONFIG.timeout
  }
  
  // 应用请求拦截器（添加 token 等）
  const interceptedConfig = requestInterceptor(requestConfig)
  
  try {
    const response = await Taro.request(interceptedConfig)
    return responseInterceptor(response)
  } catch (error: any) {
    console.error('请求失败:', error)
    // 网络请求失败（如超时、网络不可用等）
    const errorMessage = error?.errMsg || error?.message || '网络请求失败'
    Taro.showToast({
      title: errorMessage.includes('timeout') ? '请求超时，请稍后重试' : '网络连接失败，请检查网络',
      icon: 'none',
      duration: 2000
    })
    return Promise.reject(new Error(errorMessage))
  }
}

// GET请求
export const get = <T = any>(url: string, params?: Record<string, any>): Promise<BaseResponse<T>> => {
  let requestUrl = url
  if (params) {
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&')
    requestUrl += (url.includes('?') ? '&' : '?') + queryString
  }
  
  return request<T>({
    url: requestUrl,
    method: 'GET'
  })
}

// POST请求
export const post = <T = any>(url: string, data?: any): Promise<BaseResponse<T>> => {
  return request<T>({
    url,
    method: 'POST',
    data
  })
}

// PUT请求
export const put = <T = any>(url: string, data?: any): Promise<BaseResponse<T>> => {
  return request<T>({
    url,
    method: 'PUT',
    data
  })
}

// DELETE请求
export const del = <T = any>(url: string, data?: any): Promise<BaseResponse<T>> => {
  return request<T>({
    url,
    method: 'DELETE',
    data
  })
}

// PATCH请求
export const patch = <T = any>(url: string, data?: any): Promise<BaseResponse<T>> => {
  return request<T>({
    url,
    method: 'PATCH',
    data
  })
}
