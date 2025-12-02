// 文本域组件
import React from 'react'
import { Textarea as TaroTextarea, TextareaProps as TaroTextareaProps } from '@tarojs/components'
import { cn } from '@/utils/cn'
import './index.less'

export interface TextareaProps extends Omit<TaroTextareaProps, 'type'> {
  className?: string
}

const Textarea: React.FC<TextareaProps> = ({
  className = '',
  ...props
}) => {
  const textareaClass = cn('ui-textarea', className)

  return (
    <TaroTextarea
      className={textareaClass}
      {...props}
    />
  )
}

export { Textarea }

