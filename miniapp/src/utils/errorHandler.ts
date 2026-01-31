// 事件处理函数错误处理工具
import Taro from '@tarojs/taro'

/**
 * 包装事件处理函数，自动捕获错误并显示友好提示
 * 
 * @param handler 要包装的事件处理函数
 * @param errorMessage 自定义错误提示信息（可选）
 * @returns 包装后的事件处理函数
 * 
 * @example
 * const handleClick = withErrorHandler(() => {
 *   // 可能出错的代码
 *   someFunction()
 * }, '操作失败，请稍后重试')
 */
export function withErrorHandler<T extends (...args: any[]) => any>(
  handler: T,
  errorMessage?: string
): T {
  return ((...args: any[]) => {
    try {
      const result = handler(...args)
      // 如果返回 Promise，也捕获其错误
      if (result && typeof result.then === 'function') {
        return result.catch((error: any) => {
          handleError(error, errorMessage)
          // 返回一个已拒绝的 Promise，避免继续执行
          return Promise.reject(error)
        })
      }
      return result
    } catch (error: any) {
      handleError(error, errorMessage)
      // 返回 undefined，避免继续执行
      return undefined
    }
  }) as T
}

/**
 * 统一处理错误，显示友好提示
 * 
 * @param error 错误对象
 * @param customMessage 自定义错误提示信息（可选）
 */
function handleError(error: any, customMessage?: string) {
  console.error('[事件处理错误]', error)
  
  // 提取友好的错误信息
  let errorMessage = customMessage || '操作失败，请稍后重试'
  
  if (error?.message) {
    // 如果是未定义函数/变量错误，给出更友好的提示
    if (error.message.includes('is not defined') || error.message.includes('未定义')) {
      errorMessage = '功能暂时不可用，请稍后重试'
    } else if (error.message.includes('timeout') || error.message.includes('超时')) {
      errorMessage = '操作超时，请检查网络后重试'
    } else if (error.message.includes('网络') || error.message.includes('network')) {
      errorMessage = '网络连接失败，请检查网络设置'
    } else if (!customMessage) {
      // 如果没有自定义消息，使用原始错误消息（但截断过长的消息）
      const originalMessage = error.message
      errorMessage = originalMessage.length > 50 
        ? originalMessage.substring(0, 50) + '...' 
        : originalMessage
    }
  }
  
  // 显示错误提示
  Taro.showToast({
    title: errorMessage,
    icon: 'none',
    duration: 3000
  })
}

/**
 * 异步事件处理函数包装器
 * 专门用于包装 async 函数
 * 
 * @param handler 异步事件处理函数
 * @param errorMessage 自定义错误提示信息（可选）
 * @returns 包装后的异步事件处理函数
 * 
 * @example
 * const handleSubmit = withAsyncErrorHandler(async () => {
 *   await submitData()
 * }, '提交失败，请稍后重试')
 */
export function withAsyncErrorHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  errorMessage?: string
): T {
  return ((...args: any[]) => {
    return handler(...args).catch((error: any) => {
      handleError(error, errorMessage)
      // 返回一个已拒绝的 Promise，避免继续执行
      return Promise.reject(error)
    })
  }) as T
}
