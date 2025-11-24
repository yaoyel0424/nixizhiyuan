import React, { useState } from 'react'
import { Input as TaroInput, InputProps as TaroInputProps } from '@tarojs/components'
import { InputProps } from '@/types'
import './index.less'

const Input: React.FC<InputProps> = ({
  value = '',
  placeholder = '',
  disabled = false,
  maxLength,
  className = '',
  onChange,
  onFocus,
  onBlur,
  ...props
}) => {
  const [focused, setFocused] = useState(false)

  const handleFocus = () => {
    setFocused(true)
    onFocus?.()
  }

  const handleBlur = () => {
    setFocused(false)
    onBlur?.()
  }

  const handleChange = (e: any) => {
    onChange?.(e.detail.value)
  }

  const inputClass = [
    'custom-input',
    focused ? 'custom-input--focused' : '',
    disabled ? 'custom-input--disabled' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className="custom-input-wrapper">
      <TaroInput
        className={inputClass}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        maxlength={maxLength}
        onInput={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    </div>
  )
}

export default Input
