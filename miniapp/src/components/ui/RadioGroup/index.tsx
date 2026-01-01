// 单选组组件
import React, { useState, ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import { cn } from '@/utils/cn'
import './index.less'

export interface RadioGroupProps {
  value?: string
  onValueChange?: (value: string) => void
  children: ReactNode
  className?: string
}

export interface RadioGroupItemProps {
  value: string
  id: string
  className?: string
  checked?: boolean
  onCheck?: () => void
}

export interface LabelProps {
  htmlFor?: string
  children: ReactNode
  className?: string
  onClick?: () => void
}

const RadioGroup: React.FC<RadioGroupProps> = ({ 
  value, 
  onValueChange, 
  children,
  className 
}) => {
  return (
    <View className={cn('ui-radio-group', className)}>
      {React.Children.map(children, (child: any) => {
        if (React.isValidElement(child)) {
          if (child.type === RadioGroupItem || child.type === Label) {
            return React.cloneElement(child, { 
              checked: value === child.props.value,
              onCheck: () => onValueChange?.(child.props.value)
            } as any)
          }
        }
        return child
      })}
    </View>
  )
}

const RadioGroupItem: React.FC<RadioGroupItemProps> = ({ 
  value, 
  id, 
  className,
  checked,
  onCheck
}) => {
  return (
    <View 
      className={cn('ui-radio-group-item', className, checked && 'ui-radio-group-item--checked')}
      onClick={onCheck}
    >
      <View className="ui-radio-group-item__indicator">
        {checked && <View className="ui-radio-group-item__dot" />}
      </View>
    </View>
  )
}

const Label: React.FC<LabelProps> = ({ 
  htmlFor, 
  children, 
  className,
  onClick
}) => {
  return (
    <View 
      className={cn('ui-label', className)}
      onClick={onClick}
    >
      {children}
    </View>
  )
}

export { RadioGroup, RadioGroupItem, Label }

