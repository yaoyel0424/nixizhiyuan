import Taro from '@tarojs/taro'
import { BaseResponse, RequestConfig } from '@/types'

// API配置
const API_CONFIG = {
  baseURL: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000/api' 
    : 'https://api.rbridge.com',
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
  
  if (statusCode === 200) {
    if (data.code === 0 || data.success) {
      return data
    } else {
      // 业务错误
      Taro.showToast({
        title: data.message || '请求失败',
        icon: 'none'
      })
      return Promise.reject(new Error(data.message || '请求失败'))
    }
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
    Taro.showToast({
      title: '网络错误',
      icon: 'none'
    })
    return Promise.reject(new Error('网络错误'))
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
  
  try {
    const response = await Taro.request(requestConfig)
    return responseInterceptor(response)
  } catch (error) {
    console.error('请求失败:', error)
    throw error
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
