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
  children: ReactNode
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

const CollapsibleTrigger: React.FC<CollapsibleTriggerProps & { isOpen?: boolean }> = ({ 
  children, 
  className,
  onClick,
  isOpen 
}) => {
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

