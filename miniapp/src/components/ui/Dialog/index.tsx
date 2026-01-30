// 对话框组件
import React, { useState, useEffect, createContext, useContext } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { cn } from '@/utils/cn'
import './index.less'

// 创建 Context 用于传递关闭函数
const DialogContext = createContext<{ onClose: () => void } | null>(null)

export interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  className?: string
}

export interface DialogContentProps {
  className?: string
  children?: React.ReactNode
  showCloseButton?: boolean
  onClose?: () => void
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

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children, className = '' }) => {
  const [isOpen, setIsOpen] = useState(open || false)

  useEffect(() => {
    setIsOpen(open || false)
  }, [open])

  // 弹窗打开时，阻止父页面滚动；关闭后恢复（H5 用 body overflow，其他端用阻止触摸滚动）
  useEffect(() => {
    if (!isOpen) return
    if (Taro.getEnv && Taro.getEnv() === Taro.ENV_TYPE.WEB) {
      const body = document?.body
      if (!body) return
      const prevOverflow = body.style.overflow
      body.style.overflow = 'hidden'
      return () => {
        body.style.overflow = prevOverflow
      }
    }
  }, [isOpen])

  const handleClose = () => {
    setIsOpen(false)
    onOpenChange?.(false)
  }

  if (!isOpen) return null

  return (
    <DialogContext.Provider value={{ onClose: handleClose }}>
      {/* @ts-expect-error 小程序端用于阻止背景滚动 */}
      <View className={cn('ui-dialog', className)} onClick={handleClose} catchMove>
        <View className="ui-dialog__overlay" />
        <View className="ui-dialog__content" onClick={(e) => e.stopPropagation()}>
          {children}
        </View>
      </View>
    </DialogContext.Provider>
  )
}

const DialogContent: React.FC<DialogContentProps> = ({
  className = '',
  children,
  showCloseButton = true,
  onClose,
}) => {
  const context = useContext(DialogContext)
  const handleClose = onClose || context?.onClose || (() => {})
  
  // 检查是否需要滚动（通过 className 判断，如 popular-majors-page__dialog）
  // 真机 iOS 低版本需要使用 ScrollView 组件才能滚动
  const needsScroll = className.includes('popular-majors-page__dialog') || 
                      className.includes('pre-assessment-dialog') ||
                      className.includes('element-dialog')

  return (
    <View className={cn('ui-dialog-content', className)}>
      {showCloseButton && (
        <View className="ui-dialog-content__close" onClick={handleClose}>
          <Text>×</Text>
        </View>
      )}
      {needsScroll ? (
        // 真机 iOS 低版本需要使用 ScrollView 组件才能滚动
        <ScrollView 
          className="ui-dialog-content__scroll"
          scrollY
          enableBackToTop={false}
          scrollWithAnimation={false}
          // 关键：阻止事件冒泡，避免被 catchMove 捕获
          onTouchMove={(e) => {
            e.stopPropagation()
          }}
        >
          {children}
        </ScrollView>
      ) : (
        children
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

