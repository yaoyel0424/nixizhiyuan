/**
 * 导出完成对话框组件
 */
import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import './index.less'

export interface ExportCompleteDialogProps {
  /** 是否打开 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 导出的文件路径 */
  filePath: string
}

/**
 * 导出完成对话框
 */
export const ExportCompleteDialog: React.FC<ExportCompleteDialogProps> = ({
  open,
  onClose,
  filePath,
}) => {
  const [saving, setSaving] = useState(false)

  /**
   * 打开/保存PDF到本地
   */
  const handleSaveToLocal = async () => {
    try {
      setSaving(true)
      // 检查文件是否存在
      const fileExists = await new Promise<boolean>((resolve) => {
        Taro.getFileSystemManager().access({
          path: filePath,
          success: () => resolve(true),
          fail: () => resolve(false),
        })
      })

      if (!fileExists) {
        Taro.showToast({
          title: '文件不存在，请重新导出',
          icon: 'none',
          duration: 2000,
        })
        onClose()
        return
      }

      // 使用 openDocument 打开 PDF，用户可以在系统文档查看器中保存
      Taro.openDocument({
        filePath: filePath,
        fileType: 'pdf',
        success: () => {
          Taro.showToast({
            title: 'PDF已打开，请选择保存',
            icon: 'success',
            duration: 2000,
          })
          onClose()
        },
        fail: (err) => {
          console.error('打开PDF失败:', err)
          Taro.showModal({
            title: '提示',
            content: `打开PDF失败: ${err.errMsg || '未知错误'}`,
            showCancel: false,
            confirmText: '知道了',
          })
        },
      })
    } catch (error: any) {
      console.error('打开PDF失败:', error)
      Taro.showToast({
        title: error?.message || '操作失败',
        icon: 'none',
      })
    } finally {
      setSaving(false)
    }
  }

  /**
   * 分享给好友
   */
  const handleShare = async () => {
    try {
      const fileExists = await new Promise<boolean>((resolve) => {
        Taro.getFileSystemManager().access({
          path: filePath,
          success: () => resolve(true),
          fail: () => resolve(false),
        })
      })

      if (!fileExists) {
        Taro.showToast({
          title: '文件不存在，无法分享',
          icon: 'none',
          duration: 2000,
        })
        onClose()
        return
      }

      // 打开 PDF，用户可以使用系统分享功能
      Taro.openDocument({
        filePath: filePath,
        fileType: 'pdf',
        success: () => {
          Taro.showToast({
            title: 'PDF已打开，请使用右上角分享',
            icon: 'success',
            duration: 2000,
          })
          onClose()
        },
        fail: (err) => {
          console.error('打开PDF失败:', err)
          Taro.showToast({
            title: err.errMsg || '打开PDF失败',
            icon: 'none',
          })
        },
      })
    } catch (error: any) {
      console.error('分享PDF失败:', error)
      Taro.showToast({
        title: error?.message || '操作失败',
        icon: 'none',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="export-complete-dialog" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>导出完成</DialogTitle>
          <DialogDescription>
            志愿方案已成功导出，请选择操作方式
          </DialogDescription>
        </DialogHeader>

        <View className="export-complete-dialog__content">
          <View className="export-complete-dialog__icon">✅</View>
          <Text className="export-complete-dialog__text">
            PDF文件已生成成功！您可以选择打开文件保存或分享给好友
          </Text>
        </View>

        <DialogFooter>
          <View className="export-complete-dialog__actions">
            <Button
              onClick={handleSaveToLocal}
              className="export-complete-dialog__button"
              size="lg"
              variant="default"
              disabled={saving}
            >
              {saving ? '打开中...' : '💾 打开/保存到本地'}
            </Button>
            <Button
              onClick={handleShare}
              className="export-complete-dialog__button"
              size="lg"
              variant="outline"
            >
              📤 分享给好友
            </Button>
          </View>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
