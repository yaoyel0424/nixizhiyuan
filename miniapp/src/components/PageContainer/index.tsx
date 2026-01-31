// 页面容器组件
import React, { ReactNode } from 'react'
import { View } from '@tarojs/components'
import { ErrorBoundary } from '../ErrorBoundary'
import { BottomNav } from '../BottomNav'
import './index.less'

interface PageContainerProps {
  children: ReactNode
}

/**
 * 页面容器组件
 * 包含顶部导航条、内容区域和底部导航条
 * 集成了 ErrorBoundary，确保页面错误不会影响整个小程序
 */
export function PageContainer({ children }: PageContainerProps) {
  return (
    <ErrorBoundary
      fallbackTitle="页面加载出错"
      fallbackMessage="页面出现异常，请返回首页或重试。"
    >
      <View className="page-container">
        <ErrorBoundary
          fallbackTitle="内容加载出错"
          fallbackMessage="页面内容出现异常，请重试。"
        >
          <View className="page-container__content">{children}</View>
        </ErrorBoundary>
        <ErrorBoundary
          fallbackTitle="底部导航出错"
          fallbackMessage="底部导航出现异常，但不影响页面其他功能。"
        >
          <BottomNav />
        </ErrorBoundary>
      </View>
    </ErrorBoundary>
  )
}

