/**
 * 导出完成对话框组件
 */
import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import './index.less'

// 声明微信小程序全局对象类型
// 在微信小程序环境中，wx 是全局对象
declare const wx: any

/** 导出文件类型，用于 openDocument / 分享 */
export type ExportFileType = 'pdf' | 'xlsx'

export interface ExportCompleteDialogProps {
  /** 是否打开 */
  open: boolean
  /** 关闭回调 */
  onClose: () => void
  /** 导出的文件路径 */
  filePath: string
  /** 文件类型，默认 pdf（用于打开与分享） */
  fileType?: ExportFileType
  /** 分享时的文件名，默认根据 fileType 推断 */
  fileName?: string
}

/**
 * 导出完成对话框
 */
export const ExportCompleteDialog: React.FC<ExportCompleteDialogProps> = ({
  open,
  onClose,
  filePath,
  fileType = 'pdf',
  fileName: fileNameProp,
}) => {
  const [saving, setSaving] = useState(false)
  const fileName = fileNameProp ?? (fileType === 'xlsx' ? '志愿方案.xlsx' : '志愿方案.pdf')

  /**
   * 打开/保存文件到本地（PDF 或 Excel）
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

      // 使用 openDocument 打开文件，用户可保存或通过右上角转发给好友/文件传输助手
      Taro.openDocument({
        filePath: filePath,
        fileType: fileType,
        success: () => {
          Taro.showToast({
            title: '文件已打开，可保存或转发给好友',
            icon: 'success',
            duration: 2000,
          })
          onClose()
        },
        fail: (err) => {
          console.error('打开文件失败:', err)
          Taro.showModal({
            title: '提示',
            content: `打开文件失败: ${err.errMsg || '未知错误'}`,
            showCancel: false,
            confirmText: '知道了',
          })
        },
      })
    } catch (error: any) {
      console.error('打开文件失败:', error)
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
   * 注意：wx.shareFileMessage 必须在用户交互事件中直接调用，不能是异步的
   */
  const handleShare = () => {
    // 先检查文件是否存在（使用同步方法）
    try {
      const fs = Taro.getFileSystemManager()
      fs.accessSync(filePath)
    } catch {
      // 如果同步检查失败，提示用户
      Taro.showToast({
        title: '文件不存在，无法分享',
        icon: 'none',
        duration: 2000,
      })
      onClose()
      return
    }

    // 使用推荐 API 获取基础库版本（兼容同步/异步返回值）
    Promise.resolve(Taro.getAppBaseInfo()).then((baseInfo) => {
      const SDKVersion = baseInfo.SDKVersion || '0.0.0'
      const versionParts = SDKVersion.split('.').map(Number)
      const majorVersion = versionParts[0] || 0
      const minorVersion = versionParts[1] || 0
      const isVersionSupported = majorVersion > 2 || (majorVersion === 2 && minorVersion >= 19)

      console.log('微信基础库版本:', SDKVersion, '是否支持分享文件:', isVersionSupported)

      // 在微信小程序环境中，直接使用 wx.shareFileMessage API
      // 注意：需要基础库版本 >= 2.19.0，且必须在用户交互事件中直接调用（同步）
      if (isVersionSupported) {
        try {
        // 直接使用全局 wx 对象（在 Taro 编译到微信小程序时，wx 是全局可用的）
        // 使用多种方式尝试访问 wx 对象
        const wxObj = typeof wx !== 'undefined' ? wx : (typeof globalThis !== 'undefined' && (globalThis as any).wx) || (typeof window !== 'undefined' && (window as any).wx) || null
        
        // 检查 wx.shareFileMessage 是否存在
        if (wxObj && typeof wxObj.shareFileMessage === 'function') {
          console.log('找到 shareFileMessage API，开始分享文件')
          wxObj.shareFileMessage({
            filePath: filePath,
            fileName: fileName,
            success: () => {
              console.log('分享成功')
              Taro.showToast({
                title: '分享成功',
                icon: 'success',
                duration: 2000,
              })
              onClose()
            },
            fail: (err: any) => {
              console.error('分享失败:', err, err.errMsg)
              // 分享失败时，提示用户
              Taro.showModal({
                title: '分享失败',
                content: err.errMsg || '无法直接分享文件，请先打开文件后使用右上角分享',
                showCancel: false,
                confirmText: '知道了',
                success: () => {
                  // 用户确认后，打开文件让用户手动分享
                  Taro.openDocument({
                    filePath: filePath,
                    fileType: fileType,
                    success: () => {
                      Taro.showToast({
                        title: '文件已打开，请使用右上角分享',
                        icon: 'success',
                        duration: 2000,
                      })
                      onClose()
                    },
                    fail: (openErr) => {
                      console.error('打开文件失败:', openErr)
                      Taro.showToast({
                        title: openErr.errMsg || '打开文件失败',
                        icon: 'none',
                      })
                    },
                  })
                },
              })
            },
          })
          // 分享已启动，等待回调
          return
        } else {
          console.warn('wx.shareFileMessage 不存在或不可用', {
            wxExists: typeof wx !== 'undefined',
            wxType: typeof wx !== 'undefined' ? typeof wx : 'undefined',
            shareFileMessageExists: typeof wx !== 'undefined' && wx ? typeof wx.shareFileMessage : 'N/A'
          })
        }
        } catch (error: any) {
          console.error('调用 shareFileMessage 失败:', error)
        }
      }

      // 如果不支持或调用失败，使用降级方案
      console.log('使用降级方案：打开文件让用户手动分享')
      if (!isVersionSupported) {
        Taro.showModal({
          title: '提示',
          content: '您的微信版本较低，无法直接分享文件。请先打开文件，然后使用右上角分享。',
          showCancel: false,
          confirmText: '知道了',
          success: () => {
            Taro.openDocument({
              filePath: filePath,
              fileType: fileType,
              success: () => {
                onClose()
              },
              fail: (err) => {
                console.error('打开文件失败:', err)
                Taro.showToast({
                  title: err.errMsg || '打开文件失败',
                  icon: 'none',
                })
              },
            })
          },
        })
      } else {
        Taro.openDocument({
          filePath: filePath,
          fileType: fileType,
          success: () => {
            Taro.showToast({
              title: '文件已打开，请使用右上角分享',
              icon: 'success',
              duration: 2000,
            })
            onClose()
          },
          fail: (err) => {
            console.error('打开文件失败:', err)
            Taro.showToast({
              title: err.errMsg || '打开文件失败',
              icon: 'none',
            })
          },
        })
      }
    })
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
            文件已导出成功！可打开保存或分享给好友/文件传输助手
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
