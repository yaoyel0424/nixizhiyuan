// Taro 存储适配器，用于 redux-persist
import Taro from '@tarojs/taro'

// 创建符合 redux-persist 存储接口的适配器（异步 Promise 版本）
const taroStorage = {
  getItem: (key: string): Promise<string | null> => {
    return new Promise((resolve) => {
      try {
        const value = Taro.getStorageSync(key)
        // redux-persist 期望返回字符串，如果值已经是字符串则直接返回，否则序列化
        if (value === null || value === undefined) {
          resolve(null)
          return
        }
        // 如果已经是字符串，直接返回；否则序列化
        if (typeof value === 'string') {
          resolve(value)
          return
        }
        resolve(JSON.stringify(value))
      } catch (error) {
        console.error('Taro storage getItem error:', error)
        resolve(null)
      }
    })
  },
  
  setItem: (key: string, value: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // redux-persist 传入的是序列化的字符串，需要解析后存储
        let parsedValue: any = value
        try {
          parsedValue = JSON.parse(value)
        } catch {
          // 如果解析失败，直接存储字符串
          parsedValue = value
        }
        Taro.setStorageSync(key, parsedValue)
        resolve()
      } catch (error) {
        console.error('Taro storage setItem error:', error)
        reject(error)
      }
    })
  },
  
  removeItem: (key: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        Taro.removeStorageSync(key)
        resolve()
      } catch (error) {
        console.error('Taro storage removeItem error:', error)
        resolve()
      }
    })
  }
}

export default taroStorage

