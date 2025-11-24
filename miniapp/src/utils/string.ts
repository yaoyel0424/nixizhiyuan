/**
 * 首字母大写
 * @param str 字符串
 * @returns 首字母大写的字符串
 */
export const capitalize = (str: string): string => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * 驼峰命名转换
 * @param str 字符串
 * @returns 驼峰命名字符串
 */
export const camelCase = (str: string): string => {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * 短横线命名转换
 * @param str 字符串
 * @returns 短横线命名字符串
 */
export const kebabCase = (str: string): string => {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase()
}

/**
 * 生成随机字符串
 * @param length 长度
 * @returns 随机字符串
 */
export const randomString = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 生成UUID
 * @returns UUID字符串
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * 字符串截取
 * @param str 字符串
 * @param length 长度
 * @param suffix 后缀
 * @returns 截取后的字符串
 */
export const truncate = (str: string, length: number, suffix: string = '...'): string => {
  if (str.length <= length) return str
  return str.slice(0, length) + suffix
}

/**
 * 去除字符串两端空格
 * @param str 字符串
 * @returns 去除空格后的字符串
 */
export const trim = (str: string): string => {
  return str.replace(/^\s+|\s+$/g, '')
}

/**
 * 去除所有空格
 * @param str 字符串
 * @returns 去除所有空格后的字符串
 */
export const removeAllSpaces = (str: string): string => {
  return str.replace(/\s/g, '')
}

/**
 * 字符串转数字
 * @param str 字符串
 * @param defaultValue 默认值
 * @returns 数字
 */
export const toNumber = (str: string, defaultValue: number = 0): number => {
  const num = parseFloat(str)
  return isNaN(num) ? defaultValue : num
}

/**
 * 字符串转整数
 * @param str 字符串
 * @param defaultValue 默认值
 * @returns 整数
 */
export const toInt = (str: string, defaultValue: number = 0): number => {
  const num = parseInt(str, 10)
  return isNaN(num) ? defaultValue : num
}
