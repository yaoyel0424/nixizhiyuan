// 卡片组件
import React from 'react'
import { View } from '@tarojs/components'
import { cn } from '@/utils/cn'
import './index.less'

interface CardProps {
  className?: string
  children?: React.ReactNode
  onClick?: () => void
}

function Card({ className, children, onClick, ...props }: CardProps) {
  return (
    <View
      className={cn('card', className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </View>
  )
}

function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <View
      className={cn('card-header', className)}
      {...props}
    >
      {children}
    </View>
  )
}

function CardTitle({ className, children, ...props }: CardProps) {
  return (
    <View
      className={cn('card-title', className)}
      {...props}
    >
      {children}
    </View>
  )
}

function CardDescription({ className, children, ...props }: CardProps) {
  return (
    <View
      className={cn('card-description', className)}
      {...props}
    >
      {children}
    </View>
  )
}

function CardContent({ className, children, ...props }: CardProps) {
  return (
    <View
      className={cn('card-content', className)}
      {...props}
    >
      {children}
    </View>
  )
}

function CardFooter({ className, children, ...props }: CardProps) {
  return (
    <View
      className={cn('card-footer', className)}
      {...props}
    >
      {children}
    </View>
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }

