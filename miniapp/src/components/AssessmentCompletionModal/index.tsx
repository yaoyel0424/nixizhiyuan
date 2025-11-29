// 测评完成模态框组件
import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import './index.less'

/**
 * 测评完成与提交时的反馈模态框
 */
interface AssessmentCompletionModalProps {
  /** 是否显示 */
  open: boolean
  /** 生成报告的回调 */
  onGenerateReport: () => void
}

const loadingMessages = [
  "正在点亮你的天赋星辰...",
  "正在为你连接最适合的未来赛道...",
  "我们即将完成这次探索之旅的最后一块拼图...",
]

export function AssessmentCompletionModal({
  open,
  onGenerateReport,
}: AssessmentCompletionModalProps) {
  const [stage, setStage] = useState<"submitting" | "generating" | "completed">("submitting")
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)

  useEffect(() => {
    if (!open) {
      // 重置状态
      setStage("submitting")
      setCurrentMessageIndex(0)
      return
    }

    // 提交阶段
    setStage("submitting")
    setCurrentMessageIndex(0)
    
    const submitTimer = setTimeout(() => {
      setStage("generating")
    }, 2000)

    // 生成报告阶段 - 循环显示消息
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length)
    }, 2000)

    // 完成阶段
    const completeTimer = setTimeout(() => {
      setStage("completed")
      clearInterval(messageInterval)
    }, 6000)

    return () => {
      clearTimeout(submitTimer)
      clearTimeout(completeTimer)
      clearInterval(messageInterval)
    }
  }, [open])

  if (!open) return null

  return (
    <View className="assessment-completion-modal">
      <View className="assessment-completion-modal__content">
        {stage === "submitting" && (
          <View className="assessment-completion-modal__stage">
            <Text className="assessment-completion-modal__emoji">✨</Text>
            <Text className="assessment-completion-modal__title">所有答案已收到！</Text>
            <Text className="assessment-completion-modal__desc">
              我们正在为你整合信息，绘制专属你的天赋图谱。
            </Text>
            <View className="assessment-completion-modal__dots">
              <View className="assessment-completion-modal__dot" />
              <View className="assessment-completion-modal__dot" />
              <View className="assessment-completion-modal__dot" />
            </View>
          </View>
        )}

        {stage === "generating" && (
          <View className="assessment-completion-modal__stage">
            <View className="assessment-completion-modal__spinner">
              <View className="assessment-completion-modal__spinner-circle" />
            </View>
            <Text className="assessment-completion-modal__title">正在生成你的专属报告</Text>
            <View className="assessment-completion-modal__message-box">
              <Text className="assessment-completion-modal__message">
                {loadingMessages[currentMessageIndex]}
              </Text>
            </View>
            <View className="assessment-completion-modal__hint">
              <Text className="assessment-completion-modal__hint-text">请稍候，精彩即将呈现...</Text>
            </View>
          </View>
        )}

        {stage === "completed" && (
          <View className="assessment-completion-modal__stage">
            <Text className="assessment-completion-modal__emoji-large">🎉</Text>
            <Text className="assessment-completion-modal__title-large">恭喜你！</Text>
            <Text className="assessment-completion-modal__desc-large">
              你完成了一次非常勇敢的自我探索。
            </Text>
            <View className="assessment-completion-modal__success-box">
              <View className="assessment-completion-modal__success-header">
                <Text className="assessment-completion-modal__success-icon">✓</Text>
                <Text className="assessment-completion-modal__success-text">
                  专属你的天赋洞察报告已准备就绪
                </Text>
              </View>
              <Text className="assessment-completion-modal__success-desc">
                我们一同来揭开你的闪光点吧！
              </Text>
            </View>
            <Button
              onClick={onGenerateReport}
              className="assessment-completion-modal__button"
              size="lg"
            >
              查看我的报告 →
            </Button>
          </View>
        )}
      </View>
    </View>
  )
}

