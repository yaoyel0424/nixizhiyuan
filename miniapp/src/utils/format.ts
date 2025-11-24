import Taro from '@tarojs/taro'

/**
 * 格式化金额
 * @param amount 金额
 * @param decimals 小数位数
 * @returns 格式化后的金额字符串
 */
export const formatMoney = (amount: number, decimals: number = 2): string => {
  return amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 格式化手机号
 * @param phone 手机号
 * @returns 格式化后的手机号
 */
export const formatPhone = (phone: string): string => {
  if (!phone) return ''
  return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1****$3')
}

/**
 * 格式化身份证号
 * @param idCard 身份证号
 * @returns 格式化后的身份证号
 */
export const formatIdCard = (idCard: string): string => {
  if (!idCard) return ''
  return idCard.replace(/(\d{6})(\d{8})(\d{4})/, '$1********$3')
}

/**
 * 格式化银行卡号
 * @param cardNumber 银行卡号
 * @returns 格式化后的银行卡号
 */
export const formatBankCard = (cardNumber: string): string => {
  if (!cardNumber) return ''
  return cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ')
}

/**
 * 格式化数字为千分位
 * @param num 数字
 * @returns 格式化后的数字字符串
 */
export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 格式化百分比
 * @param value 数值
 * @param decimals 小数位数
 * @returns 格式化后的百分比字符串
 */
export const formatPercent = (value: number, decimals: number = 2): string => {
  return (value * 100).toFixed(decimals) + '%'
}
