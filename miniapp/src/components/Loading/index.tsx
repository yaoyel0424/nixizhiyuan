import React from 'react'
import { View } from '@tarojs/components'
import { ComponentProps } from '@/types'
import './index.less'

interface LoadingProps extends ComponentProps {
  size?: 'small' | 'medium' | 'large'
  text?: string
  overlay?: boolean
}

const Loading: React.FC<LoadingProps> = ({
  size = 'medium',
  text = '加载中...',
  overlay = false,
  className = '',
  ...props
}) => {
  const loadingClass = [
    'custom-loading',
    `custom-loading--${size}`,
    overlay ? 'custom-loading--overlay' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <View className={loadingClass} {...props}>
      <View className="custom-loading__spinner">
        <View className="custom-loading__dot"></View>
        <View className="custom-loading__dot"></View>
        <View className="custom-loading__dot"></View>
      </View>
      {text && <View className="custom-loading__text">{text}</View>}
    </View>
  )
}

export default Loading
