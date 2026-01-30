import React, { Component, ErrorInfo, ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.less'

interface Props {
  children: ReactNode
  /** 出错时显示的标题 */
  fallbackTitle?: string
  /** 出错时显示的消息 */
  fallbackMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * 应用级错误边界：捕获子组件在渲染/生命周期中的未处理错误，
 * 显示友好提示并保留「返回首页」能力，避免一处报错导致整站不可点击。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到错误:', error, errorInfo.componentStack)
  }

  handleBackHome = () => {
    this.setState({ hasError: false, error: null })
    Taro.reLaunch({ url: '/pages/index/index' })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle ?? '页面出错了'
      const message = this.props.fallbackMessage ?? '请返回首页或重试，如仍异常请稍后再试。'

      return (
        <View className="error-boundary">
          <View className="error-boundary__content">
            <Text className="error-boundary__title">{title}</Text>
            <Text className="error-boundary__message">{message}</Text>
            <View className="error-boundary__actions">
              <View className="error-boundary__btn" onClick={this.handleRetry}>
                <Text className="error-boundary__btn-text">重试</Text>
              </View>
              <View className="error-boundary__btn error-boundary__btn--primary" onClick={this.handleBackHome}>
                <Text className="error-boundary__btn-text">返回首页</Text>
              </View>
            </View>
          </View>
        </View>
      )
    }

    return this.props.children
  }
}
