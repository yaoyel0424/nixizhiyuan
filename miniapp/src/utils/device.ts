import Taro from '@tarojs/taro'

/**
 * 获取系统信息
 * @returns 系统信息
 */
export const getSystemInfo = async () => {
  try {
    return await Taro.getSystemInfo()
  } catch (error) {
    console.error('获取系统信息失败:', error)
    throw error
  }
}

/**
 * 获取网络状态
 * @returns 网络状态
 */
export const getNetworkType = async () => {
  try {
    return await Taro.getNetworkType()
  } catch (error) {
    console.error('获取网络状态失败:', error)
    throw error
  }
}

/**
 * 监听网络状态变化
 * @param callback 回调函数
 */
export const onNetworkStatusChange = (callback: (res: any) => void) => {
  Taro.onNetworkStatusChange(callback)
}

/**
 * 获取位置信息
 * @param type 类型
 * @returns 位置信息
 */
export const getLocation = async (type: 'wgs84' | 'gcj02' = 'gcj02') => {
  try {
    return await Taro.getLocation({ type })
  } catch (error) {
    console.error('获取位置信息失败:', error)
    throw error
  }
}

/**
 * 检查是否支持某个API
 * @param api API名称
 * @returns 是否支持
 */
export const canIUse = (api: string): boolean => {
  return Taro.canIUse(api)
}

/**
 * 获取设备信息
 * @returns 设备信息
 */
export const getDeviceInfo = async () => {
  try {
    const systemInfo = await getSystemInfo()
    return {
      platform: systemInfo.platform,
      system: systemInfo.system,
      version: systemInfo.version,
      model: systemInfo.model,
      pixelRatio: systemInfo.pixelRatio,
      screenWidth: systemInfo.screenWidth,
      screenHeight: systemInfo.screenHeight,
      windowWidth: systemInfo.windowWidth,
      windowHeight: systemInfo.windowHeight,
      statusBarHeight: systemInfo.statusBarHeight,
      safeArea: systemInfo.safeArea
    }
  } catch (error) {
    console.error('获取设备信息失败:', error)
    throw error
  }
}
