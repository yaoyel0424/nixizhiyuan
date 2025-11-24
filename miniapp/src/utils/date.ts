/**
 * 格式化日期
 * @param date 日期
 * @param format 格式
 * @returns 格式化后的日期字符串
 */
export const formatDate = (date: Date | string | number, format: string = 'YYYY-MM-DD'): string => {
  const d = new Date(date)
  
  if (isNaN(d.getTime())) {
    return ''
  }
  
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')
  
  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

/**
 * 获取相对时间
 * @param date 日期
 * @returns 相对时间字符串
 */
export const getRelativeTime = (date: Date | string | number): string => {
  const now = new Date()
  const target = new Date(date)
  const diff = now.getTime() - target.getTime()
  
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day
  const month = 30 * day
  const year = 365 * day
  
  if (diff < minute) {
    return '刚刚'
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`
  } else if (diff < week) {
    return `${Math.floor(diff / day)}天前`
  } else if (diff < month) {
    return `${Math.floor(diff / week)}周前`
  } else if (diff < year) {
    return `${Math.floor(diff / month)}个月前`
  } else {
    return `${Math.floor(diff / year)}年前`
  }
}

/**
 * 判断是否为今天
 * @param date 日期
 * @returns 是否为今天
 */
export const isToday = (date: Date | string | number): boolean => {
  const today = new Date()
  const target = new Date(date)
  
  return today.getFullYear() === target.getFullYear() &&
         today.getMonth() === target.getMonth() &&
         today.getDate() === target.getDate()
}

/**
 * 判断是否为昨天
 * @param date 日期
 * @returns 是否为昨天
 */
export const isYesterday = (date: Date | string | number): boolean => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const target = new Date(date)
  
  return yesterday.getFullYear() === target.getFullYear() &&
         yesterday.getMonth() === target.getMonth() &&
         yesterday.getDate() === target.getDate()
}

/**
 * 获取时间戳
 * @param date 日期
 * @returns 时间戳
 */
export const getTimestamp = (date: Date | string | number = new Date()): number => {
  return new Date(date).getTime()
}

/**
 * 获取当前时间戳
 * @returns 当前时间戳
 */
export const now = (): number => {
  return Date.now()
}
