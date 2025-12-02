// 进度条组件
import React from 'react'
import { View } from '@tarojs/components'
import { cn } from '@/utils/cn'
import './index.less'

export interface ProgressProps {
  className?: string
  value?: number
  max?: number
}

const Progress: React.FC<ProgressProps> = ({
  className = '',
  value = 0,
  max = 100,
  ...props
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <View
      className={cn('ui-progress', className)}
      {...props}
    >
      <View
        className="ui-progress__indicator"
        style={{ width: `${percentage}%` }}
      />
    </View>
  )
}

export { Progress }

