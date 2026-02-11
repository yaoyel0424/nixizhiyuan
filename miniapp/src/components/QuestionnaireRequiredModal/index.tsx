import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import './index.less'

interface QuestionnaireRequiredModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  answerCount?: number
}

/**
 * 问卷完成提示弹窗组件
 * 当用户访问需要先完成问卷的页面时显示
 */
export function QuestionnaireRequiredModal({
  open,
  onOpenChange,
  answerCount = 0,
}: QuestionnaireRequiredModalProps) {
  const UNLOCK_THRESHOLD = 168
  const remainingCount = Math.max(0, UNLOCK_THRESHOLD - answerCount)

  const handleGoToQuestionnaire = () => {
    onOpenChange(false)
    Taro.navigateTo({
      url: '/pages/assessment/questionnaire/index'
    })
  }

  const handleGoToAllMajors = () => {
    onOpenChange(false)
    Taro.navigateTo({
      url: '/pages/assessment/all-majors/index'
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="questionnaire-required-modal">
        <DialogHeader>
          <DialogTitle className="questionnaire-required-modal__title">
            需要先完成问卷
          </DialogTitle>
          <DialogDescription className="questionnaire-required-modal__description">
            此功能需要先完成168题专业匹配测评才能使用
          </DialogDescription>
        </DialogHeader>

        <View className="questionnaire-required-modal__content">
          <View className="questionnaire-required-modal__progress">
            <Text className="questionnaire-required-modal__progress-text">
              当前进度：{answerCount} / {UNLOCK_THRESHOLD} 题
            </Text>
            {remainingCount > 0 && (
              <Text className="questionnaire-required-modal__progress-remaining">
                还需完成 {remainingCount} 题
              </Text>
            )}
          </View>

          <View className="questionnaire-required-modal__benefits">
            <Text className="questionnaire-required-modal__benefits-title">完成问卷后您将获得：</Text>
            <View className="questionnaire-required-modal__benefits-list">
              <Text className="questionnaire-required-modal__benefits-item">✓ 完整的天赋画像分析</Text>
              <Text className="questionnaire-required-modal__benefits-item">✓ 专业匹配度推荐</Text>
              <Text className="questionnaire-required-modal__benefits-item">✓ 详细的专业契合度报告</Text>
            </View>
          </View>
        </View>

        <DialogFooter className="questionnaire-required-modal__footer">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="questionnaire-required-modal__button"
          >
            稍后再说
          </Button>
          <Button
            onClick={handleGoToAllMajors}
            className="questionnaire-required-modal__button questionnaire-required-modal__button--primary"
          >
            继续答题
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 默认导出，兼容不同的导入方式
export default QuestionnaireRequiredModal
