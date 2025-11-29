// 徽章组件
import React from 'react'
import { View, Text } from '@tarojs/components'
import { cn } from '@/utils/cn'
import './index.less'

export interface BadgeProps {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string
  children?: React.ReactNode
}

const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const badgeClass = cn('ui-badge', `ui-badge--${variant}`, className)

  return (
    <View className={badgeClass} {...props}>
      <Text className="ui-badge__text">{children}</Text>
    </View>
  )
}

export { Badge }

