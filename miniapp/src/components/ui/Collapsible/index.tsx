// 可折叠组件
import React, { useState, ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import { cn } from '@/utils/cn'
import './index.less'

export interface CollapsibleProps {
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export interface CollapsibleTriggerProps {
  /**
   * 触发器内容
   * - 支持直接传 ReactNode
   * - 也支持 render props：children(isOpen) => ReactNode（用于根据展开状态渲染箭头等）
   */
  children: ReactNode | ((isOpen?: boolean) => ReactNode)
  className?: string
  onClick?: () => void
}

export interface CollapsibleContentProps {
  children: ReactNode
  className?: string
}

const Collapsible: React.FC<CollapsibleProps> = ({ 
  children, 
  defaultOpen = false,
  className 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  return (
    <View className={cn('ui-collapsible', className)}>
      {React.Children.map(children, (child: any) => {
        if (React.isValidElement(child)) {
          if (child.type === CollapsibleTrigger) {
            return React.cloneElement(child, { 
              onClick: handleToggle,
              isOpen 
            } as any)
          }
          if (child.type === CollapsibleContent) {
            return React.cloneElement(child, { isOpen } as any)
          }
        }
        return child
      })}
    </View>
  )
}

const CollapsibleTrigger = ({ 
  children, 
  className,
  onClick,
  isOpen 
}: CollapsibleTriggerProps & { isOpen?: boolean }) => {
  return (
    <View 
      className={cn('ui-collapsible-trigger', className)}
      onClick={onClick}
    >
      {typeof children === 'function' ? children(isOpen) : children}
    </View>
  )
}

const CollapsibleContent: React.FC<CollapsibleContentProps & { isOpen?: boolean }> = ({ 
  children, 
  className,
  isOpen 
}) => {
  if (!isOpen) return null

  return (
    <View className={cn('ui-collapsible-content', className)}>
      {children}
    </View>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }

