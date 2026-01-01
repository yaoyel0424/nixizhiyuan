// 标签页组件
import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { cn } from '@/utils/cn'
import './index.less'

export interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  children?: React.ReactNode
}

export interface TabsListProps {
  className?: string
  children?: React.ReactNode
}

export interface TabsTriggerProps {
  value: string
  className?: string
  children?: React.ReactNode
}

export interface TabsContentProps {
  value: string
  className?: string
  children?: React.ReactNode
}

const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value: controlledValue,
  onValueChange,
  className = '',
  children,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue || '')
  const value = controlledValue !== undefined ? controlledValue : internalValue

  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }

  return (
    <View className={cn('ui-tabs', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // 直接给所有子组件传递属性，让它们自己判断是否需要
          return React.cloneElement(child as any, {
            activeValue: value,
            onValueChange: handleValueChange,
          })
        }
        return child
      })}
    </View>
  )
}

const TabsList: React.FC<TabsListProps & { activeValue?: string; onValueChange?: (value: string) => void }> = ({ 
  className = '', 
  children,
  activeValue,
  onValueChange
}) => {
  return (
    <View className={cn('ui-tabs-list', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, {
            activeValue,
            onValueChange,
          })
        }
        return child
      })}
    </View>
  )
}

TabsList.displayName = 'TabsList'

const TabsTrigger: React.FC<TabsTriggerProps & { value: string; onValueChange?: (value: string) => void; activeValue?: string }> = ({
  value,
  className = '',
  children,
  onValueChange,
  activeValue,
}) => {
  const isActive = activeValue === value

  return (
    <View
      className={cn('ui-tabs-trigger', isActive && 'ui-tabs-trigger--active', className)}
      onClick={() => onValueChange?.(value)}
    >
      {typeof children === 'string' ? (
        <Text className="ui-tabs-trigger__text">{children}</Text>
      ) : (
        children
      )}
    </View>
  )
}

const TabsContent: React.FC<TabsContentProps & { activeValue?: string }> = ({
  value,
  className = '',
  children,
  activeValue,
}) => {
  // 如果没有 activeValue，不渲染（等待 Tabs 传递）
  if (activeValue === undefined) {
    return null
  }
  
  // 如果 activeValue 不匹配，不渲染
  if (activeValue !== value) {
    return null
  }

  return (
    <View className={cn('ui-tabs-content', className)}>
      {children}
    </View>
  )
}

TabsContent.displayName = 'TabsContent'
TabsTrigger.displayName = 'TabsTrigger'

export { Tabs, TabsList, TabsTrigger, TabsContent }

