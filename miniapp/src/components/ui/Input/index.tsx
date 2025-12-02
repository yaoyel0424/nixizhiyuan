// 输入框组件
import React from 'react'
import { Input as TaroInput, InputProps as TaroInputProps } from '@tarojs/components'
import { cn } from '@/utils/cn'
import './index.less'

export interface InputProps extends Omit<TaroInputProps, 'type'> {
  type?: 'text' | 'number' | 'digit' | 'password'
  className?: string
}

const Input: React.FC<InputProps> = ({
  className = '',
  type = 'text',
  ...props
}) => {
  const inputClass = cn('ui-input', className)

  return (
    <TaroInput
      className={inputClass}
      type={type}
      {...props}
    />
  )
}

export { Input }

