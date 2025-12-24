// 分享弹窗组件
import React, { useState, useRef, useEffect } from 'react'
import { View, Text, Image, Canvas, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import './index.less'

export interface ShareModalProps {
  /** 是否显示弹窗 */
  open: boolean
  /** 关闭弹窗回调 */
  onClose: () => void
}

/**
 * 分享弹窗组件
 * 展示宣传内容，支持保存分享图片和直接分享
 */
export const ShareModal: React.FC<ShareModalProps> = ({
  open,
  onClose,
}) => {
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef<any>(null)

  /**
   * 保存分享图片到相册
   */
  const handleSaveImage = async () => {
    try {
      setSaving(true)

      // 检查相册权限
      const authResult = await Taro.getSetting()
      if (!authResult.authSetting['scope.writePhotosAlbum']) {
        // 请求相册权限
        await Taro.authorize({
          scope: 'scope.writePhotosAlbum',
        })
      }

      // 获取系统信息
      const systemInfo = await Taro.getSystemInfo()
      const { windowWidth } = systemInfo

      // Canvas 尺寸（设计稿尺寸，单位：rpx，需要转换为 px）
      const canvasWidth = 750 // rpx
      const canvasHeight = 1334 // rpx
      const dpr = systemInfo.pixelRatio || 2
      const canvasWidthPx = (canvasWidth / 750) * windowWidth * dpr
      const canvasHeightPx = (canvasHeight / 750) * windowWidth * dpr

      // 创建 Canvas 上下文
      const query = Taro.createSelectorQuery()
      query
        .select('#shareCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            Taro.showToast({
              title: 'Canvas 初始化失败',
              icon: 'none',
            })
            setSaving(false)
            return
          }

          const canvas = res[0].node
          const ctx = canvas.getContext('2d')

          // 设置 Canvas 实际尺寸
          canvas.width = canvasWidthPx
          canvas.height = canvasHeightPx

          // 设置 Canvas 显示尺寸
          if (canvas) {
            // 绘制背景（渐变蓝色）
            const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeightPx)
            gradient.addColorStop(0, '#1A4099')
            gradient.addColorStop(1, '#2563eb')
            ctx.fillStyle = gradient
            ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx)

            // 绘制文字内容和导出图片
            function drawText() {
              // 尝试绘制Logo（如果可能）
              const logoSize = 120 * dpr
              const logoX = (canvasWidthPx - logoSize) / 2
              const logoY = 100 * dpr
              
              // 先绘制文字，Logo在UI中显示即可
              // 绘制标题 "逆袭智愿"
              ctx.fillStyle = '#FFFFFF'
              ctx.font = `bold ${72 * dpr}px sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText('逆袭智愿', canvasWidthPx / 2, 280 * dpr)

              // 绘制问题文案
              ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
              ctx.font = `${32 * dpr}px sans-serif`
              ctx.fillText('你是否在想:', canvasWidthPx / 2, 360 * dpr)
              ctx.font = `${30 * dpr}px sans-serif`
              ctx.fillText('我的喜欢是什么?天赋在哪里?', canvasWidthPx / 2, 420 * dpr)
              ctx.fillText('怎样的专业,能让我闪闪发光?', canvasWidthPx / 2, 470 * dpr)
              ctx.fillText('如何用分数,创造出最理想的志愿?', canvasWidthPx / 2, 520 * dpr)

              // 绘制底部文案
              ctx.fillStyle = '#FFFFFF'
              ctx.font = `bold ${36 * dpr}px sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText('让「喜欢」和「天赋」,带你找到答案', canvasWidthPx / 2, 600 * dpr)

              // 绘制底部提示文字
              ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
              ctx.font = `${28 * dpr}px sans-serif`
              ctx.fillText('逆袭智愿体验版', canvasWidthPx / 2, canvasHeightPx - 100 * dpr)

              // 导出图片 - 使用 setTimeout 确保绘制完成
              setTimeout(() => {
                Taro.canvasToTempFilePath({
                  canvas: canvas,
                  success: (exportRes) => {
                    // 保存图片到相册
                    Taro.saveImageToPhotosAlbum({
                      filePath: exportRes.tempFilePath,
                      success: () => {
                        Taro.showToast({
                          title: '保存成功',
                          icon: 'success',
                        })
                        setSaving(false)
                      },
                      fail: (err) => {
                        console.error('保存图片失败:', err)
                        Taro.showToast({
                          title: err.errMsg || '保存失败，请检查相册权限',
                          icon: 'none',
                        })
                        setSaving(false)
                      },
                    })
                  },
                  fail: (err) => {
                    console.error('导出图片失败:', err)
                    Taro.showToast({
                      title: err.errMsg || '生成图片失败',
                      icon: 'none',
                    })
                    setSaving(false)
                  },
                })
              }, 500)
            }
          }
        })
    } catch (error) {
      console.error('保存分享图片失败:', error)
      Taro.showToast({
        title: '操作失败',
        icon: 'none',
      })
      setSaving(false)
    }
  }

  /**
   * 使用小程序原生分享功能
   * 通过 Button 的 openType="share" 直接触发分享
   */
  const handleShareApp = () => {
    // 关闭弹窗，让 Button 的 openType="share" 处理分享
    onClose()
  }

  /**
   * 分享成功回调
   */
  const onShareAppMessage = () => {
    return {
      title: '逆袭智愿 - 让「喜欢」和「天赋」，带你找到答案',
      path: '/pages/index/index',
      imageUrl: '', // 可选：分享图片
    }
  }

  // 在页面中注册分享函数（如果需要在 profile 页面处理）
  useEffect(() => {
    if (open) {
      // 可以在这里设置页面分享配置
    }
  }, [open])

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="share-modal__content" showCloseButton={true} onClose={onClose}>
          <DialogHeader className="share-modal__header">
            <DialogTitle className="share-modal__title">分享给朋友</DialogTitle>
          </DialogHeader>

          <View className="share-modal__body">
            {/* 宣传内容区域 */}
            <View className="share-modal__promo">
              <View className="share-modal__promo-icon">
                <Image
                  src={require('@/assets/images/logo.png')}
                  className="share-modal__promo-logo"
                  mode="aspectFit"
                />
              </View>
              <View className="share-modal__promo-header">
                <Text className="share-modal__promo-title">逆袭智愿</Text>
              </View>
              <View className="share-modal__promo-content">
                <Text className="share-modal__promo-question">你是否在想:</Text>
                <Text className="share-modal__promo-text">
                  我的喜欢是什么?天赋在哪里?怎样的专业,能让我闪闪发光?如何用分数,创造出最理想的志愿?
                </Text>
              </View>
              <View className="share-modal__promo-footer">
                <Text className="share-modal__promo-answer">
                  让「喜欢」和「天赋」,带你找到答案
                </Text>
              </View>
            </View>
          </View>

          <DialogFooter>
            <View className="share-modal__actions">
              <Button
                className="share-modal__btn share-modal__btn--primary"
                openType="share"
                onClick={handleShareApp}
              >
                <Text className="share-modal__btn-text">📤 分享给朋友</Text>
              </Button>
              <View className="share-modal__btn share-modal__btn--secondary" onClick={handleSaveImage}>
                <Text className="share-modal__btn-text">
                  {saving ? '保存中...' : '💾 保存图片'}
                </Text>
              </View>
            </View>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 隐藏的 Canvas，用于生成分享图片 */}
      <Canvas
        type="2d"
        id="shareCanvas"
        className="share-modal__canvas"
        style={{ width: '750rpx', height: '1334rpx', position: 'fixed', top: '-9999rpx', left: '-9999rpx' }}
      />
    </>
  )
}

