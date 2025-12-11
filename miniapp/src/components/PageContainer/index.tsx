// 页面容器组件
import React, { ReactNode } from 'react'
import { View } from '@tarojs/components'
import { BottomNav } from '../BottomNav'
import './index.less'

interface PageContainerProps {
  children: ReactNode
}

/**
 * 页面容器组件
 * 包含顶部导航条、内容区域和底部导航条
 */
export function PageContainer({ children }: PageContainerProps) {
  return (
    <View className="page-container">
      <View className="page-container__content">{children}</View>
      <BottomNav />
    </View>
  )
}

