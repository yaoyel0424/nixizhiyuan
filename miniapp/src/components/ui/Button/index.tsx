// 按钮组件
import React from 'react'
import { Button as TaroButton, ButtonProps as TaroButtonProps } from '@tarojs/components'
import { cn } from '@/utils/cn'
import './index.less'

export interface ButtonProps extends Omit<TaroButtonProps, 'size'> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'
  className?: string
  children?: React.ReactNode
}

const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'default',
  className = '',
  children,
  ...props
}) => {
  const buttonClass = cn(
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    className
  )

  return (
    <TaroButton
      className={buttonClass}
      {...props}
    >
      {children}
    </TaroButton>
  )
}

export { Button }

