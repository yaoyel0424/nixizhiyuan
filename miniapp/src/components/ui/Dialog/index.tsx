// 对话框组件
import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { cn } from '@/utils/cn'
import './index.less'

export interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export interface DialogContentProps {
  className?: string
  children?: React.ReactNode
  showCloseButton?: boolean
}

export interface DialogHeaderProps {
  className?: string
  children?: React.ReactNode
}

export interface DialogTitleProps {
  className?: string
  children?: React.ReactNode
}

export interface DialogDescriptionProps {
  className?: string
  children?: React.ReactNode
}

export interface DialogFooterProps {
  className?: string
  children?: React.ReactNode
}

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  const [isOpen, setIsOpen] = useState(open || false)

  useEffect(() => {
    setIsOpen(open || false)
  }, [open])

  const handleClose = () => {
    setIsOpen(false)
    onOpenChange?.(false)
  }

  if (!isOpen) return null

  return (
    <View className="ui-dialog" onClick={handleClose}>
      <View className="ui-dialog__overlay" />
      <View className="ui-dialog__content" onClick={(e) => e.stopPropagation()}>
        {children}
      </View>
    </View>
  )
}

const DialogContent: React.FC<DialogContentProps> = ({
  className = '',
  children,
  showCloseButton = true,
}) => {
  return (
    <View className={cn('ui-dialog-content', className)}>
      {children}
      {showCloseButton && (
        <View className="ui-dialog-content__close" onClick={() => {
          // 关闭逻辑由父组件处理
        }}>
          <Text>×</Text>
        </View>
      )}
    </View>
  )
}

const DialogHeader: React.FC<DialogHeaderProps> = ({ className = '', children }) => {
  return (
    <View className={cn('ui-dialog-header', className)}>
      {children}
    </View>
  )
}

const DialogTitle: React.FC<DialogTitleProps> = ({ className = '', children }) => {
  return (
    <Text className={cn('ui-dialog-title', className)}>
      {children}
    </Text>
  )
}

const DialogDescription: React.FC<DialogDescriptionProps> = ({ className = '', children }) => {
  return (
    <View className={cn('ui-dialog-description', className)}>
      {children}
    </View>
  )
}

const DialogFooter: React.FC<DialogFooterProps> = ({ className = '', children }) => {
  return (
    <View className={cn('ui-dialog-footer', className)}>
      {children}
    </View>
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }

