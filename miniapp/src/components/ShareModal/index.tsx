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
  /** 生成宣传图后回调本地临时路径，供分享卡片 imageUrl 使用（不依赖上传） */
  onShareImageReady?: (localPath: string) => void
}

/**
 * 分享弹窗组件
 * 展示宣传内容，支持保存分享图片和直接分享
 */
export const ShareModal: React.FC<ShareModalProps> = ({
  open,
  onClose,
  onShareImageReady,
}) => {
  const [saving, setSaving] = useState(false)
  /** 宣传图已生成（本地路径已就绪），可展示「分享给朋友」按钮 */
  const [shareImageReady, setShareImageReady] = useState(false)
  const canvasRef = useRef<any>(null)
  const openRef = useRef(open)
  openRef.current = open

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

      const windowInfo = await Promise.resolve(Taro.getWindowInfo())
      const windowWidth = windowInfo.windowWidth

      // Canvas 尺寸（设计稿尺寸，单位：rpx，需要转换为 px）
      const canvasWidth = 750 // rpx
      const canvasHeight = 1334 // rpx
      const dpr = windowInfo.pixelRatio || 2
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

          // 绘制背景（渐变蓝色）
            const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeightPx)
            gradient.addColorStop(0, '#1A4099')
            gradient.addColorStop(1, '#2563eb')
            ctx.fillStyle = gradient
            ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx)

            // 装饰：右上、左下半透明圆形
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
            ctx.beginPath()
            ctx.arc(canvasWidthPx * 0.85, canvasHeightPx * 0.15, canvasWidthPx * 0.25, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
            ctx.beginPath()
            ctx.arc(canvasWidthPx * 0.12, canvasHeightPx * 0.78, canvasWidthPx * 0.2, 0, Math.PI * 2)
            ctx.fill()

            // 宣传文案：textBaseline 为 middle，中心距需 > 两行字高之和才有可见空隙
            const scale = Math.min(1, canvasWidthPx / 750)
            const fTitle = 68 * scale
            const fMid = fTitle
            const fLast = 56 * scale
            const lineGap = 96 * scale
            const extraGap = 32 * scale   // 希望看到的空白像素
            const titleGap = (fTitle + fMid) / 2 + extraGap  // 逆袭智愿与中间文字：留出明显间距
            const lastGap = (fMid + fLast) / 2 + extraGap    // 最后一句与中间文字：留出明显间距
            const y0 = 140 * scale
            const midY0 = y0 + titleGap
            ctx.fillStyle = '#FFFFFF'
            ctx.font = `bold ${fTitle}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('逆袭智愿', canvasWidthPx / 2, y0)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
            ctx.font = `${fMid}px sans-serif`
            ctx.fillText('你是否在想:', canvasWidthPx / 2, midY0)
            ctx.fillText('我的喜欢是什么?天赋在哪里?', canvasWidthPx / 2, midY0 + lineGap)
            ctx.fillText('怎样的专业,能让我闪闪发光?', canvasWidthPx / 2, midY0 + lineGap * 2)
            ctx.fillText('如何用分数,创造出最理想的志愿?', canvasWidthPx / 2, midY0 + lineGap * 3)
            ctx.fillStyle = '#FFFFFF'
            ctx.font = `bold ${fLast}px sans-serif`
            ctx.fillText('让「喜欢」和「天赋」,带你找到答案', canvasWidthPx / 2, midY0 + lineGap * 3 + lastGap)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
            ctx.font = `${fMid}px sans-serif`
            ctx.fillText('逆袭智愿体验版', canvasWidthPx / 2, canvasHeightPx - 80 * scale)

            setTimeout(() => {
              Taro.canvasToTempFilePath({
                canvas,
                success: (exportRes) => {
                  Taro.saveImageToPhotosAlbum({
                    filePath: exportRes.tempFilePath,
                    success: () => {
                      Taro.showToast({ title: '保存成功', icon: 'success' })
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
                  Taro.showToast({ title: err.errMsg || '生成图片失败', icon: 'none' })
                  setSaving(false)
                },
              })
            }, 500)
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
   * 弹窗打开时生成宣传图（蓝底+装饰圆+文案），导出为本地临时文件并回传路径，供分享卡片使用（不依赖上传）
   */
  useEffect(() => {
    if (!open || !onShareImageReady) return
    setShareImageReady(false)
    const fallback = setTimeout(() => {
      if (openRef.current) setShareImageReady(true)
    }, 6000)
    const timer = setTimeout(() => {
      Promise.resolve(Taro.getWindowInfo()).then((windowInfo) => {
        const windowWidth = windowInfo.windowWidth
        const canvasWidth = 750
        const canvasHeight = 1334
        const dpr = windowInfo.pixelRatio || 2
        const canvasWidthPx = (canvasWidth / 750) * windowWidth * dpr
        const canvasHeightPx = (canvasHeight / 750) * windowWidth * dpr

        const query = Taro.createSelectorQuery()
        query.select('#shareCanvas').fields({ node: true, size: true }).exec((res) => {
          if (!res?.[0]?.node) {
            clearTimeout(fallback)
            if (openRef.current) setShareImageReady(true)
            return
          }
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          canvas.width = canvasWidthPx
          canvas.height = canvasHeightPx

          const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeightPx)
          gradient.addColorStop(0, '#1A4099')
          gradient.addColorStop(1, '#2563eb')
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx)

          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
          ctx.beginPath()
          ctx.arc(canvasWidthPx * 0.85, canvasHeightPx * 0.15, canvasWidthPx * 0.25, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
          ctx.beginPath()
          ctx.arc(canvasWidthPx * 0.12, canvasHeightPx * 0.78, canvasWidthPx * 0.2, 0, Math.PI * 2)
          ctx.fill()

          const scale = Math.min(1, canvasWidthPx / 750)
          const fTitle = 68 * scale
          const fMid = fTitle
          const fLast = 56 * scale
          const lineGap = 96 * scale
          const extraGap = 32 * scale
          const titleGap = (fTitle + fMid) / 2 + extraGap
          const lastGap = (fMid + fLast) / 2 + extraGap
          const y0 = 140 * scale
          const midY0 = y0 + titleGap
          ctx.fillStyle = '#FFFFFF'
          ctx.font = `bold ${fTitle}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('逆袭智愿', canvasWidthPx / 2, y0)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
          ctx.font = `${fMid}px sans-serif`
          ctx.fillText('你是否在想:', canvasWidthPx / 2, midY0)
          ctx.fillText('我的喜欢是什么?天赋在哪里?', canvasWidthPx / 2, midY0 + lineGap)
          ctx.fillText('怎样的专业,能让我闪闪发光?', canvasWidthPx / 2, midY0 + lineGap * 2)
          ctx.fillText('如何用分数,创造出最理想的志愿?', canvasWidthPx / 2, midY0 + lineGap * 3)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = `bold ${fLast}px sans-serif`
          ctx.fillText('让「喜欢」和「天赋」,带你找到答案', canvasWidthPx / 2, midY0 + lineGap * 3 + lastGap)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
          ctx.font = `${fMid}px sans-serif`
          ctx.fillText('逆袭智愿体验版', canvasWidthPx / 2, canvasHeightPx - 80 * scale)

          setTimeout(() => {
              Taro.canvasToTempFilePath({
                canvas,
              success: (exportRes) => {
                if (openRef.current && exportRes.tempFilePath) {
                  clearTimeout(fallback)
                  onShareImageReady(exportRes.tempFilePath)
                  setShareImageReady(true)
                }
              },
            })
          }, 500)
        })
      })
    }, 500)
    return () => {
      clearTimeout(timer)
      clearTimeout(fallback)
    }
  }, [open, onShareImageReady])

  useEffect(() => {
    if (!open) setShareImageReady(false)
  }, [open])

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="share-modal__content" showCloseButton={true} onClose={onClose}>
          <DialogHeader className="share-modal__header">
            <DialogTitle className="share-modal__title">分享给朋友</DialogTitle>
            <Text className="share-modal__subtitle">邀请好友使用</Text>
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
                disabled={onShareImageReady != null && !shareImageReady}
                onClick={handleShareApp}
              >
                <Text className="share-modal__btn-text">
                  {onShareImageReady != null && !shareImageReady
                    ? '生成分享图中…'
                    : '📤 分享给朋友'}
                </Text>
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

