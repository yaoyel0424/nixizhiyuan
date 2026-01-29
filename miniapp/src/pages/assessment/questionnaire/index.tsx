// 问卷页面
import React, { useState, useEffect } from 'react'
import { View, Text, Slider } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AssessmentCompletionModal } from '@/components/AssessmentCompletionModal'
// 不再使用本地存储，全部使用 API 返回的数据
import { getScalesWithAnswers, submitScaleAnswer } from '@/services/scales'
import { Scale } from '@/types/api'
import './index.less'

// 不再使用本地存储，全部使用 API 返回的数据

export default function QuestionnairePage() {
  const [questions, setQuestions] = useState<Scale[]>([])
  const [loading, setLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [sliderValue, setSliderValue] = useState(50)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [showCompletionModal, setShowCompletionModal] = useState(false)

  const currentQuestion = questions[currentQuestionIndex]
  const progress = currentQuestion ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0

  // 加载题目和答案
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const response = await getScalesWithAnswers()
        
        if (response && response.scales) {
          // 只获取 direction 为 '168' 的题目
          const filteredScales = response.scales.filter((scale: Scale) => scale.direction === '168')
          // 按 dimension 和 id 排序
          const dimensionOrder = ['看', '听', '说', '记', '想', '做', '运动']
          filteredScales.sort((a: Scale, b: Scale) => {
            const indexA = dimensionOrder.indexOf(a.dimension)
            const indexB = dimensionOrder.indexOf(b.dimension)
            const finalIndexA = indexA === -1 ? dimensionOrder.length : indexA
            const finalIndexB = indexB === -1 ? dimensionOrder.length : indexB
            if (finalIndexA !== finalIndexB) {
              return finalIndexA - finalIndexB
            }
            return a.id - b.id
          })
          
          setQuestions(filteredScales)
          
          // 恢复已保存的答案
          const hasApiAnswers = response.answers && Array.isArray(response.answers) && response.answers.length > 0
          
          if (hasApiAnswers) {
            const savedAnswers: Record<number, number> = {}
            response.answers.forEach((answer: any) => {
              if (answer.scaleId && answer.score !== undefined) {
                // 将 score 转换为滑块值（0-100）
                // score 范围通常是 -2 到 2，需要映射到 0-100
                const scoreValue = typeof answer.score === 'string' ? parseFloat(answer.score) : Number(answer.score)
                const sliderValue = Math.min(100, Math.max(0, ((scoreValue + 2) / 4) * 100))
                savedAnswers[answer.scaleId] = sliderValue
              }
            })
            setAnswers(savedAnswers)
            
            // 找到第一个未回答的问题
            const firstUnanswered = filteredScales.findIndex((scale: Scale) => !savedAnswers[scale.id])
            if (firstUnanswered >= 0) {
              setCurrentQuestionIndex(firstUnanswered)
              setSliderValue(savedAnswers[filteredScales[firstUnanswered].id] || 50)
            }
          } else {
            // 如果 API 返回空答案数组，不加载任何答案
            console.log('API 返回空答案数组，不加载任何答案')
            setAnswers({})
            // 从第一题开始
            setCurrentQuestionIndex(0)
            setSliderValue(50)
          }
        }
      } catch (error) {
        console.error('加载题目失败:', error)
        Taro.showToast({
          title: '加载题目失败',
          icon: 'none'
        })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // 计算当前维度进度
  const currentDimension = currentQuestion?.dimension || ""
  const dimensionQuestions = questions.filter((q) => q.dimension === currentDimension)
  const currentDimensionIndex = dimensionQuestions.findIndex((q) => q.id === currentQuestion?.id) + 1
  const totalDimensionQuestions = dimensionQuestions.length

  const handleNext = async () => {
    if (!currentQuestion) return

    try {
      // 将滑块值（0-100）转换为 score（-2 到 2）
      // score = (sliderValue / 100) * 4 - 2
      const score = (sliderValue / 100) * 4 - 2

      // 提交答案到服务器
      const response: any = await submitScaleAnswer(currentQuestion.id, score)
      
      // 检查返回的 code 字段，必须为 'SUCCESS' 才跳转
      // 注意：API拦截器可能已经处理了错误，但这里再次检查确保数据完整性
      const responseCode = response?.code
      const isSuccess = responseCode === 'SUCCESS' || responseCode === '0' || responseCode === 0
      
      if (!isSuccess) {
        console.error('提交答案失败，返回 code 不是 SUCCESS:', responseCode, response)
        // 给出友好的错误提示
        const errorMessage = response?.message || '答案提交失败，请稍后重试'
        Taro.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 3000
        })
        // 不跳转，停留在当前题目，等待用户重试
        return
      }

      // 更新答案状态（不保存到本地，只使用 API 数据）
      const newAnswers = {
        ...answers,
        [currentQuestion.id]: sliderValue,
      }
      setAnswers(newAnswers)

      const nextIndex = currentQuestionIndex + 1

      // 检查是否完成
      if (nextIndex >= questions.length) {
        setShowCompletionModal(true)
        return
      }

      // 移动到下一题
      setCurrentQuestionIndex(nextIndex)
      setSliderValue(newAnswers[questions[nextIndex].id] || 50)
    } catch (error: any) {
      // API调用失败（网络错误、服务器错误等）
      console.error('提交答案失败:', error)
      
      // 提取友好的错误信息
      let errorMessage = '答案提交失败，请稍后重试'
      if (error?.message) {
        // 如果是网络相关错误，给出更友好的提示
        if (error.message.includes('timeout') || error.message.includes('超时')) {
          errorMessage = '网络请求超时，请检查网络后重试'
        } else if (error.message.includes('网络') || error.message.includes('network')) {
          errorMessage = '网络连接失败，请检查网络设置'
        } else {
          errorMessage = error.message
        }
      }
      
      Taro.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      })
      // 不跳转，停留在当前题目，等待用户重试
    }
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

  if (loading || !currentQuestion) {
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
              第 {currentQuestionIndex + 1} 题 / {questions.length}
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

