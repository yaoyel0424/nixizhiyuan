// 问卷页面
import React, { useState, useEffect } from 'react'
import { View, Text, Slider } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AssessmentCompletionModal } from '@/components/AssessmentCompletionModal'
import { getStorage, setStorage } from '@/utils/storage'
import { Question } from '@/types/questionnaire'
import questionsData from '@/data/questionnaire.json'
import './index.less'

const STORAGE_KEY = "questionnaire_answers"

export default function QuestionnairePage() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [sliderValue, setSliderValue] = useState(50)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [showCompletionModal, setShowCompletionModal] = useState(false)

  const questions = questionsData as Question[]
  const currentQuestion = questions[currentQuestionIndex]
  const progress = currentQuestion ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0

  // 加载已保存的答案
  useEffect(() => {
    const loadAnswers = async () => {
      const saved = await getStorage<Record<number, number>>(STORAGE_KEY)
      if (saved) {
        setAnswers(saved)
        // 找到第一个未回答的问题
        const firstUnanswered = questions.findIndex(q => !saved[q.id])
        if (firstUnanswered >= 0) {
          setCurrentQuestionIndex(firstUnanswered)
          setSliderValue(saved[questions[firstUnanswered].id] || 50)
        }
      }
    }
    loadAnswers()
  }, [])

  // 计算当前维度进度
  const currentDimension = currentQuestion?.dimension || ""
  const dimensionQuestions = questions.filter((q) => q.dimension === currentDimension)
  const currentDimensionIndex = dimensionQuestions.findIndex((q) => q.id === currentQuestion?.id) + 1
  const totalDimensionQuestions = dimensionQuestions.length

  const handleNext = async () => {
    if (!currentQuestion) return

    // 保存答案
    const newAnswers = {
      ...answers,
      [currentQuestion.id]: sliderValue,
    }
    setAnswers(newAnswers)
    await setStorage(STORAGE_KEY, newAnswers)

    const nextIndex = currentQuestionIndex + 1

    // 检查是否完成
    if (nextIndex >= questions.length) {
      setShowCompletionModal(true)
      return
    }

    // 移动到下一题
    setCurrentQuestionIndex(nextIndex)
    setSliderValue(newAnswers[questions[nextIndex].id] || 50)
  }

  const handleExit = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要退出问卷吗？您的进度已保存。',
      success: (res) => {
        if (res.confirm) {
          Taro.navigateBack()
        }
      }
    })
  }

  const handleGenerateReport = () => {
    setShowCompletionModal(false)
    Taro.navigateTo({
      url: '/pages/assessment/report/index'
    })
  }

  if (!currentQuestion) {
    return (
      <View className="questionnaire-page">
        <View className="questionnaire-page__loading">加载中...</View>
      </View>
    )
  }

  return (
    <View className="questionnaire-page">
      
      {/* 进度条 */}
      <View className="questionnaire-page__progress">
        <View className="questionnaire-page__progress-header">
          <View className="questionnaire-page__exit" onClick={handleExit}>
            <Text>×</Text>
          </View>
          <View className="questionnaire-page__progress-info">
            <Text className="questionnaire-page__progress-text">
              第 {currentQuestionIndex + 1} 题 / 168
            </Text>
            <Text className="questionnaire-page__dimension-text">
              当前：{currentDimension} 维度 {currentDimensionIndex}/{totalDimensionQuestions}
            </Text>
          </View>
          <View className="questionnaire-page__spacer" />
        </View>
        <View className="questionnaire-page__progress-bar">
          <View 
            className="questionnaire-page__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      {/* 问题内容 */}
      <View className="questionnaire-page__content">
        <Card className="questionnaire-page__question-card">
          <Text className="questionnaire-page__question-text">
            {currentQuestion.content}
          </Text>
          
          {/* 滑块 */}
          <View className="questionnaire-page__slider-container">
            <Text className="questionnaire-page__slider-label">选择你的答案</Text>
            <Slider
              value={sliderValue}
              min={0}
              max={100}
              step={1}
              activeColor="#1890ff"
              backgroundColor="#e5e7eb"
              blockColor="#1890ff"
              blockSize={20}
              onChange={(e) => setSliderValue(e.detail.value)}
              className="questionnaire-page__slider"
            />
            <View className="questionnaire-page__slider-values">
              <Text className="questionnaire-page__slider-value">0</Text>
              <Text className="questionnaire-page__slider-value">50</Text>
              <Text className="questionnaire-page__slider-value">100</Text>
            </View>
          </View>
        </Card>

        {/* 下一题按钮 */}
        <Button
          onClick={handleNext}
          className="questionnaire-page__next-button"
          size="lg"
        >
          下一题
        </Button>
      </View>

      {/* 完成模态框 */}
      <AssessmentCompletionModal
        open={showCompletionModal}
        onGenerateReport={handleGenerateReport}
      />
    </View>
  )
}

