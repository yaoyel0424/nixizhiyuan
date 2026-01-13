// 评估报告页面
import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { PageContainer } from '@/components/PageContainer'
import { Card } from '@/components/ui/Card'
import { QuestionnaireRequiredModal } from '@/components/QuestionnaireRequiredModal'
import { useQuestionnaireCheck } from '@/hooks/useQuestionnaireCheck'
import './index.less'

export default function ReportPage() {
  // 检查问卷完成状态
  const { isCompleted: isQuestionnaireCompleted, isLoading: isCheckingQuestionnaire, answerCount } = useQuestionnaireCheck()
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)

  // 检查问卷完成状态
  useEffect(() => {
    if (!isCheckingQuestionnaire && !isQuestionnaireCompleted) {
      setShowQuestionnaireModal(true)
    }
  }, [isCheckingQuestionnaire, isQuestionnaireCompleted])

  return (
    <PageContainer>
      <View className="report-page">
        <View className="report-page__content">
          <Card className="report-page__card">
            <Text className="report-page__title">天赋洞察报告</Text>
            <Text className="report-page__desc">报告内容正在生成中...</Text>
            <Text className="report-page__tip">请先完成168题测评以生成完整报告</Text>
          </Card>
        </View>
      </View>

      {/* 问卷完成提示弹窗 */}
      <QuestionnaireRequiredModal
        open={showQuestionnaireModal}
        onOpenChange={setShowQuestionnaireModal}
        answerCount={answerCount}
      />
    </PageContainer>
  )
}

