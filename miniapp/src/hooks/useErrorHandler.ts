// 事件处理函数错误处理 Hook
import { useCallback } from 'react'
import { withErrorHandler, withAsyncErrorHandler } from '@/utils/errorHandler'

/**
 * 自动为事件处理函数添加错误处理的 Hook
 * 
 * @param handler 事件处理函数
 * @param errorMessage 自定义错误提示信息（可选）
 * @returns 包装后的事件处理函数
 * 
 * @example
 * const handleClick = useErrorHandler(() => {
 *   // 可能出错的代码
 *   someFunction()
 * }, '操作失败，请稍后重试')
 * 
 * @example
 * const handleSubmit = useErrorHandler(async () => {
 *   await submitData()
 * }, '提交失败，请稍后重试')
 */
export function useErrorHandler<T extends (...args: any[]) => any>(
  handler: T,
  errorMessage?: string
): T {
  // 判断是否是异步函数
  const isAsync = handler.constructor.name === 'AsyncFunction' || 
                  (handler as any)[Symbol.toStringTag] === 'AsyncFunction'
  
  return useCallback(
    isAsync 
      ? withAsyncErrorHandler(handler as any, errorMessage)
      : withErrorHandler(handler, errorMessage),
    [handler, errorMessage]
  ) as T
}

/**
 * 同步事件处理函数错误处理 Hook
 */
export function useSyncErrorHandler<T extends (...args: any[]) => any>(
  handler: T,
  errorMessage?: string
): T {
  return useCallback(
    withErrorHandler(handler, errorMessage),
    [handler, errorMessage]
  ) as T
}

/**
 * 异步事件处理函数错误处理 Hook
 */
export function useAsyncErrorHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  errorMessage?: string
): T {
  return useCallback(
    withAsyncErrorHandler(handler, errorMessage),
    [handler, errorMessage]
  ) as T
}
