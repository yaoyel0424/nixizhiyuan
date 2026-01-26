/**
 * 导出进度对话框组件
 */
import React from 'react'
import { View, Text, Progress } from '@tarojs/components'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import './index.less'

export interface ExportProgressDialogProps {
  /** 是否打开 */
  open: boolean
  /** 进度值 (0-100) */
  progress: number
  /** 状态文本 */
  status: string
  /** 是否暂停 */
  paused?: boolean
  /** 暂停回调 */
  onPause?: () => void
  /** 恢复回调 */
  onResume?: () => void
  /** 取消回调 */
  onCancel?: () => void
}

/**
 * 导出进度对话框
 */
export const ExportProgressDialog: React.FC<ExportProgressDialogProps> = ({
  open,
  progress,
  status,
  paused = false,
  onPause,
  onResume,
  onCancel,
}) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="export-progress-dialog" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>导出志愿方案</DialogTitle>
          <DialogDescription>{status}</DialogDescription>
        </DialogHeader>

        <View className="export-progress-dialog__content">
          {/* 进度条 */}
          <View className="export-progress-dialog__progress-container">
            <Progress
              percent={progress}
              strokeWidth={8}
              activeColor="#2563eb"
              backgroundColor="#e5e7eb"
              className="export-progress-dialog__progress"
            />
            <Text className="export-progress-dialog__progress-text">{Math.round(progress)}%</Text>
          </View>

          {/* 操作按钮 - 进度100%时不显示 */}
          {progress < 100 && (
            <View className="export-progress-dialog__actions">
              {paused ? (
                <Button
                  onClick={onResume}
                  className="export-progress-dialog__button"
                  size="md"
                  variant="default"
                >
                  继续导出
                </Button>
              ) : (
                <Button
                  onClick={onPause}
                  className="export-progress-dialog__button"
                  size="md"
                  variant="outline"
                >
                  暂停
                </Button>
              )}
              <Button
                onClick={onCancel}
                className="export-progress-dialog__button"
                size="md"
                variant="ghost"
              >
                取消
              </Button>
            </View>
          )}
        </View>
      </DialogContent>
    </Dialog>
  )
}
