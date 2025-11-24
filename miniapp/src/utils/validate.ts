/**
 * 验证手机号
 * @param phone 手机号
 * @returns 是否为有效手机号
 */
export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

/**
 * 验证邮箱
 * @param email 邮箱
 * @returns 是否为有效邮箱
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 验证身份证号
 * @param idCard 身份证号
 * @returns 是否为有效身份证号
 */
export const validateIdCard = (idCard: string): boolean => {
  const idCardRegex = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/
  return idCardRegex.test(idCard)
}

/**
 * 验证密码强度
 * @param password 密码
 * @returns 密码强度等级 (weak, medium, strong)
 */
export const validatePasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
  if (password.length < 6) return 'weak'
  
  let score = 0
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z\d]/.test(password)) score++
  
  if (score < 2) return 'weak'
  if (score < 4) return 'medium'
  return 'strong'
}

/**
 * 验证URL
 * @param url URL字符串
 * @returns 是否为有效URL
 */
export const validateUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * 验证银行卡号
 * @param cardNumber 银行卡号
 * @returns 是否为有效银行卡号
 */
export const validateBankCard = (cardNumber: string): boolean => {
  const cleanCardNumber = cardNumber.replace(/\s/g, '')
  return /^\d{16,19}$/.test(cleanCardNumber)
}

/**
 * 验证用户名
 * @param username 用户名
 * @returns 是否为有效用户名
 */
export const validateUsername = (username: string): boolean => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
  return usernameRegex.test(username)
}

/**
 * 验证中文姓名
 * @param name 姓名
 * @returns 是否为有效中文姓名
 */
export const validateChineseName = (name: string): boolean => {
  const nameRegex = /^[\u4e00-\u9fa5]{2,10}$/
  return nameRegex.test(name)
}
