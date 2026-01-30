import Taro from '@tarojs/taro'

/**
 * 获取系统信息（合并 getWindowInfo / getAppBaseInfo / getDeviceInfo，替代已弃用的 getSystemInfo）
 * @returns 系统信息
 */
export const getSystemInfo = async () => {
  try {
    // 小程序部分环境返回同步值，用 Promise.resolve 统一成 Promise
    const [windowInfo, appBaseInfo, deviceInfo] = await Promise.all([
      Promise.resolve(Taro.getWindowInfo()),
      Promise.resolve(Taro.getAppBaseInfo()),
      Promise.resolve(Taro.getDeviceInfo()),
    ])
    return {
      ...windowInfo,
      ...appBaseInfo,
      ...deviceInfo,
    } as any
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
 * 获取设备信息（使用 getWindowInfo + getDeviceInfo + getAppBaseInfo）
 * @returns 设备信息
 */
export const getDeviceInfo = async () => {
  try {
    const [windowInfo, appBaseInfo, deviceInfo] = await Promise.all([
      Promise.resolve(Taro.getWindowInfo()),
      Promise.resolve(Taro.getAppBaseInfo()),
      Promise.resolve(Taro.getDeviceInfo()),
    ])
    return {
      platform: deviceInfo.platform,
      system: deviceInfo.system,
      version: appBaseInfo.version,
      model: deviceInfo.model,
      pixelRatio: windowInfo.pixelRatio,
      screenWidth: windowInfo.screenWidth,
      screenHeight: windowInfo.screenHeight,
      windowWidth: windowInfo.windowWidth,
      windowHeight: windowInfo.windowHeight,
      statusBarHeight: windowInfo.statusBarHeight,
      safeArea: windowInfo.safeArea,
    }
  } catch (error) {
    console.error('获取设备信息失败:', error)
    throw error
  }
}
