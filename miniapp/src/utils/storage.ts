import Taro from '@tarojs/taro'

/**
 * 存储数据到本地
 * @param key 键名
 * @param data 数据
 */
export const setStorage = async (key: string, data: any): Promise<void> => {
  try {
    await Taro.setStorage({
      key,
      data: JSON.stringify(data)
    })
  } catch (error) {
    console.error('存储数据失败:', error)
    throw error
  }
}

/**
 * 从本地获取数据
 * @param key 键名
 * @returns 数据
 */
export const getStorage = async <T = any>(key: string): Promise<T | null> => {
  try {
    const result = await Taro.getStorage({ key })
    return JSON.parse(result.data)
  } catch (error: any) {
    // 数据不存在是正常情况，不应该打印错误日志
    // 只有当是其他类型的错误时才打印
    const errMsg = error?.errMsg || error?.message || ''
    // 如果错误信息包含 "data not found"，说明数据不存在，这是正常情况
    if (errMsg && !errMsg.includes('data not found')) {
      console.error('获取数据失败:', error)
    }
    return null
  }
}

/**
 * 删除本地数据
 * @param key 键名
 */
export const removeStorage = async (key: string): Promise<void> => {
  try {
    await Taro.removeStorage({ key })
  } catch (error) {
    console.error('删除数据失败:', error)
    throw error
  }
}

/**
 * 清空本地存储
 */
export const clearStorage = async (): Promise<void> => {
  try {
    await Taro.clearStorage()
  } catch (error) {
    console.error('清空存储失败:', error)
    throw error
  }
}

/**
 * 获取存储信息
 * @returns 存储信息
 */
export const getStorageInfo = async () => {
  try {
    return await Taro.getStorageInfo()
  } catch (error) {
    console.error('获取存储信息失败:', error)
    throw error
  }
}

/**
 * 检查键是否存在
 * @param key 键名
 * @returns 是否存在
 */
export const hasStorage = async (key: string): Promise<boolean> => {
  try {
    await Taro.getStorage({ key })
    return true
  } catch {
    return false
  }
}
