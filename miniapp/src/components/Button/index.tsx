import React from 'react'
import { Button as TaroButton, ButtonProps as TaroButtonProps } from '@tarojs/components'
import { ButtonProps } from '@/types'
import './index.less'

const Button: React.FC<ButtonProps> = ({
  type = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  className = '',
  children,
  onClick,
  ...props
}) => {
  const buttonClass = [
    'custom-button',
    `custom-button--${type}`,
    `custom-button--${size}`,
    disabled ? 'custom-button--disabled' : '',
    loading ? 'custom-button--loading' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <TaroButton
      className={buttonClass}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className="custom-button__loading">⏳</span>}
      {children}
    </TaroButton>
  )
}

export default Button
