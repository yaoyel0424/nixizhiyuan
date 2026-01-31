// 页面级错误边界高阶组件
import React, { ComponentType } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

/**
 * 页面级错误边界 HOC
 * 用于包裹页面组件，确保页面错误不会影响整个小程序
 * 
 * @param Component 要包裹的页面组件
 * @param fallbackTitle 错误时显示的标题（可选）
 * @param fallbackMessage 错误时显示的消息（可选）
 * @returns 包裹了 ErrorBoundary 的组件
 */
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  fallbackTitle?: string,
  fallbackMessage?: string
) {
  const WrappedComponent = (props: P) => {
    return (
      <ErrorBoundary
        fallbackTitle={fallbackTitle || '页面加载出错'}
        fallbackMessage={fallbackMessage || '页面出现异常，请返回首页或重试。'}
      >
        <Component {...props} />
      </ErrorBoundary>
    )
  }

  // 设置显示名称，方便调试
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`

  return WrappedComponent
}
