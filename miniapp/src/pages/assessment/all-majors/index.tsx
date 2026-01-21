// 所有专业评估页面
import React, { useState, useEffect, useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Progress } from '@/components/ui/Progress'
import { Question } from '@/types/questionnaire'
import { Scale, ScaleAnswer } from '@/types/api'
import { getScalesWithAnswers, submitScaleAnswer } from '@/services/scales'
import { useAppSelector } from '@/store/hooks'
import './index.less'

const STORAGE_KEY = 'questionnaire_answers'
const PREVIOUS_ANSWERS_KEY = 'questionnaire_previous_answers'

const DIMENSION_ORDER = ['看', '听', '说', '记', '想', '做', '运动']

// 排序题目：按维度顺序，然后按类型（like优先），最后按id
function sortQuestions(questions: Question[]): Question[] {
  return [...questions].sort((a, b) => {
    const aDimensionIndex = DIMENSION_ORDER.indexOf(a.dimension)
    const bDimensionIndex = DIMENSION_ORDER.indexOf(b.dimension)

    if (aDimensionIndex !== bDimensionIndex) {
      if (aDimensionIndex === -1) return 1
      if (bDimensionIndex === -1) return -1
      return aDimensionIndex - bDimensionIndex
    }

    if (a.type !== b.type) {
      return a.type === 'like' ? -1 : 1
    }
    return a.id - b.id
  })
}

// 加载答案
function loadAnswersFromStorage(): Record<number, number> {
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.error('加载答案失败:', error)
    return {}
  }
}

// 保存答案
function saveAnswersToStorage(answers: Record<number, number>) {
  try {
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(answers))
  } catch (error) {
    console.error('保存答案失败:', error)
  }
}

// 加载上一次答案
function loadPreviousAnswersFromStorage(): Record<number, number> {
  try {
    const stored = Taro.getStorageSync(PREVIOUS_ANSWERS_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.error('加载上一次答案失败:', error)
    return {}
  }
}

// 保存上一次答案
function savePreviousAnswersToStorage(answers: Record<number, number>) {
  try {
    Taro.setStorageSync(PREVIOUS_ANSWERS_KEY, JSON.stringify(answers))
  } catch (error) {
    console.error('保存上一次答案失败:', error)
  }
}

// 查找第一个未答题的索引
function findFirstUnansweredIndex(questions: Question[], answers: Record<number, number>): number {
  const index = questions.findIndex((q) => !(q.id in answers))
  return index === -1 ? 0 : index
}

// 查找所有未答题的题目索引
function findUnansweredQuestions(questions: Question[], answers: Record<number, number>): number[] {
  return questions
    .map((q, index) => (!(q.id in answers) ? index : -1))
    .filter((index) => index !== -1)
}

// 将 Scale 转换为 Question 格式
function convertScaleToQuestion(scale: Scale): Question {
  return {
    id: scale.id,
    content: scale.content,
    elementId: scale.elementId,
    type: scale.type,
    direction: '168',
    dimension: scale.dimension,
    action: '',
    options: (scale.options || []).map((opt) => ({
      id: opt.id,
      scaleId: scale.id,
      optionName: opt.optionName,
      optionValue: opt.optionValue,
      displayOrder: opt.displayOrder || 0,
      additionalInfo: opt.additionalInfo || '',
    })),
  }
}

export default function AllMajorsPage() {
  // 获取路由参数，判断是否是重新开始
  const router = useRouter()
  const isRestart = router.params?.restart === 'true'
  
  // 从 Redux store 获取用户信息
  const userInfo = useAppSelector((state) => state.user.userInfo)
  
  const [scales, setScales] = useState<Scale[]>([])
  const [apiAnswers, setApiAnswers] = useState<ScaleAnswer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 使用 useMemo 缓存排序后的题目，避免每次渲染都重新计算
  const sortedQuestions = useMemo(() => {
    if (scales.length === 0) return []
    const questions = scales.map(convertScaleToQuestion)
    return sortQuestions(questions)
  }, [scales])
  const totalQuestions = sortedQuestions.length

  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [previousAnswers, setPreviousAnswers] = useState<Record<number, number>>({})
  const [isInitialized, setIsInitialized] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progressAnimation, setProgressAnimation] = useState(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [showUnansweredDialog, setShowUnansweredDialog] = useState(false)
  const [showUnansweredBlink, setShowUnansweredBlink] = useState(false)

  // 从 API 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        setLoadError(null)
        const result = await getScalesWithAnswers()
        
        console.log('API 返回的数据:', result)
        
        // 设置量表数据
        setScales(result.scales || [])
        
        // 设置 API 返回的答案
        setApiAnswers(result.answers || [])
        
        // 如果是重新开始，不加载任何答案，从头开始
        if (isRestart) {
          // 清空所有答案，从头开始
          setAnswers({})
          setPreviousAnswers({})
          // 确保本地存储也被清空（双重保险）
          Taro.removeStorageSync(STORAGE_KEY)
          Taro.removeStorageSync(PREVIOUS_ANSWERS_KEY)
        } else {
          // 正常流程：加载答案
          // 将 API 答案转换为本地答案格式
          // 注意：answer.scaleId 对应 question.id，answer.score 对应 option.optionValue
          const apiAnswersMap: Record<number, number> = {}
          if (result.answers && Array.isArray(result.answers)) {
            result.answers.forEach((answer) => {
              if (answer.scaleId && answer.score !== undefined && answer.score !== null) {
                // 确保 scaleId 和 score 都是数字类型
                const scaleId = Number(answer.scaleId)
                const score = Number(answer.score)
                if (!isNaN(scaleId) && !isNaN(score)) {
                  apiAnswersMap[scaleId] = score
                }
              }
            })
          }
          
          console.log('API 返回的答案数组:', result.answers)
          console.log('API 答案映射:', apiAnswersMap)
          
          // 加载本地存储的答案
          const storedAnswers = loadAnswersFromStorage()
          const storedPreviousAnswers = loadPreviousAnswersFromStorage()
          
          console.log('本地存储的答案:', storedAnswers)
          
          // 合并 API 答案和本地答案（本地答案优先，用于未提交的答案）
          // 注意：这里本地答案会覆盖 API 答案，因为本地可能有未提交的新答案
          const mergedAnswers = { ...apiAnswersMap, ...storedAnswers }
          console.log('合并后的答案:', mergedAnswers)
          console.log('题目总数:', result.scales?.length || 0)
          
          setAnswers(mergedAnswers)
          setPreviousAnswers(storedPreviousAnswers)
        }
        
        // 如果有题目数据，初始化当前索引
        if (result.scales && result.scales.length > 0) {
          const questions = result.scales.map(convertScaleToQuestion)
          const sorted = sortQuestions(questions)
          
          if (isRestart) {
            // 重新开始：从第一题开始
            setCurrentIndex(0)
          } else {
            // 正常流程：找到第一个未答题的题目
            // 需要重新获取合并后的答案（因为 setAnswers 是异步的）
            const storedAnswers = loadAnswersFromStorage()
            const apiAnswersMap: Record<number, number> = {}
            if (result.answers && Array.isArray(result.answers)) {
              result.answers.forEach((answer) => {
                if (answer.scaleId && answer.score !== undefined && answer.score !== null) {
                  const scaleId = Number(answer.scaleId)
                  const score = Number(answer.score)
                  if (!isNaN(scaleId) && !isNaN(score)) {
                    apiAnswersMap[scaleId] = score
                  }
                }
              })
            }
            const mergedAnswers = { ...apiAnswersMap, ...storedAnswers }
            // 查找第一个未答题的题目索引
            const firstUnanswered = findFirstUnansweredIndex(sorted, mergedAnswers)
            // 查找所有未答题的题目
            const unansweredIndices = findUnansweredQuestions(sorted, mergedAnswers)
            
            // 检查完成状态：只有当所有题目都有答案时才认为完成
            // 注意：不仅要检查答案数量，还要确保没有未答的题目
            const answeredCount = Object.keys(mergedAnswers).length
            const hasUnansweredQuestions = unansweredIndices.length > 0
            
            if (answeredCount === sorted.length && !hasUnansweredQuestions) {
              // 所有题目都已答完：不进入“完成页”，直接展示题目与已选答案
              setCurrentIndex(0)
            } else {
              // 有未答题的题目，跳转到第一个未答题的题目
              setCurrentIndex(firstUnanswered)
              
              // 只有当已经有部分题目答过，且还有未答题的题目时，才提示未答题
              // 如果 answeredCount === 0，说明用户还没有开始答题，不应该提示未答题
              if (answeredCount > 0 && unansweredIndices.length > 0) {
                // 延迟显示提示，避免与加载状态冲突
                setTimeout(() => {
                  Taro.showToast({
                    title: `检测到 ${unansweredIndices.length} 道未答题，已跳转到第 ${firstUnanswered + 1} 题`,
                    icon: 'none',
                    duration: 3000
                  })
                }, 500)
              }
            }
          }
        }
        
        setIsInitialized(true)
      } catch (error: any) {
        console.error('加载评估数据失败:', error)
        setLoadError(error?.message || '加载数据失败，请稍后重试')
        Taro.showToast({
          title: '加载数据失败',
          icon: 'none',
          duration: 2000
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isRestart])

  // 当题目切换时，清除闪烁状态
  useEffect(() => {
    setShowUnansweredBlink(false)
  }, [currentIndex])

  const currentQuestion = sortedQuestions[currentIndex]
  const currentDimension = currentQuestion?.dimension || ''
  const questionsInCurrentDimension = sortedQuestions.filter((q) => q.dimension === currentDimension)
  const answeredInCurrentDimension = questionsInCurrentDimension.filter((q) => q.id in answers).length
  const totalInCurrentDimension = questionsInCurrentDimension.length

  const answeredCount = Object.keys(answers).length
  const completedDimensions = DIMENSION_ORDER.filter((dim) => {
    const dimQuestions = sortedQuestions.filter((q) => q.dimension === dim)
    const dimAnswered = dimQuestions.filter((q) => q.id in answers).length
    return dimAnswered === dimQuestions.length
  }).length

  // 完成168题后解锁功能
  const UNLOCK_THRESHOLD = 168
  const isUnlocked = answeredCount >= UNLOCK_THRESHOLD

  // 处理重新探索：保存当前答案为上一次答案，清空当前答案，计数归零
  const handleRestartExploration = () => {
    setShowRestartConfirm(true)
  }

  // 确认重新探索
  const confirmRestartExploration = () => {
    // 保存当前答案为上一次答案
    if (Object.keys(answers).length > 0) {
      savePreviousAnswersToStorage(answers)
      setPreviousAnswers(answers)
    }
    // 清空当前答案
    const emptyAnswers: Record<number, number> = {}
    setAnswers(emptyAnswers)
    saveAnswersToStorage(emptyAnswers)
    // 回到第一题
    setCurrentIndex(0)
    // 关闭确认对话框
    setShowRestartConfirm(false)
    // 显示提示
    Taro.showToast({
      title: '已开始重新探索',
      icon: 'success',
      duration: 2000
    })
  }

  const dimensionProgress = DIMENSION_ORDER.map((dim) => {
    const dimQuestions = sortedQuestions.filter((q) => q.dimension === dim)
    const dimAnswered = dimQuestions.filter((q) => q.id in answers).length
    const dimTotal = dimQuestions.length
    return {
      dimension: dim,
      answered: dimAnswered,
      total: dimTotal,
      progress: dimTotal > 0 ? (dimAnswered / dimTotal) * 100 : 0,
    }
  })

  const unifiedProgressColor = '#FF7F50' // Orange accent color

  const handleAnswer = async (optionValue: number) => {
    if (!currentQuestion) return

    // 清除闪烁状态
    setShowUnansweredBlink(false)

    const newAnswers = {
      ...answers,
      [currentQuestion.id]: optionValue,
    }
    setAnswers(newAnswers)
    saveAnswersToStorage(newAnswers)

    // 提交答案到服务器
    try {
      // 获取 userId（优先使用 Redux store，否则使用自动获取）
      const userId = userInfo?.id ? parseInt(userInfo.id, 10) : undefined
      await submitScaleAnswer(currentQuestion.id, optionValue, userId)
      // 提交成功，静默处理（不显示提示，避免干扰用户体验）
    } catch (error: any) {
      // 提交失败，记录错误但不影响用户操作
      console.error('提交答案失败:', error)
      // 可以选择显示一个不干扰的提示，或者静默失败（因为本地已保存）
      // Taro.showToast({
      //   title: '答案已保存到本地',
      //   icon: 'none',
      //   duration: 1500
      // })
    }

    const answeredCount = Object.keys(newAnswers).length
    // 检查是否有未答题的题目
    const unansweredIndices = findUnansweredQuestions(sortedQuestions, newAnswers)
    const hasUnansweredQuestions = unansweredIndices.length > 0

    if (answeredCount % 24 === 0 && answeredCount < totalQuestions) {
      const completedDimensionIndex = Math.floor(answeredCount / 24) - 1
      const dimensionName = DIMENSION_ORDER[completedDimensionIndex]

      setProgressAnimation(true)
      setTimeout(() => setProgressAnimation(false), 1000)

      // 计算个人特质解锁项数（已完成的维度数）
      const completedDimensionsCount = DIMENSION_ORDER.filter((dim) => {
        const dimQuestions = sortedQuestions.filter((q) => q.dimension === dim)
        const dimAnswered = dimQuestions.filter((q) => q.id in newAnswers).length
        return dimAnswered === dimQuestions.length
      }).length

      // 计算匹配专业数（每20题一个专业）
      const matchedMajorsCount = Math.floor(answeredCount / 20)

      Taro.showToast({
        title: `🎉 维度解锁：${dimensionName}！`,
        icon: 'none',
        duration: 3000
      })
    }
    
    // 如果有未答题的题目，提示用户
    if (hasUnansweredQuestions && currentIndex === totalQuestions - 1) {
      // 如果当前是最后一题，但还有未答题的题目，跳转到第一个未答题的题目
      const firstUnanswered = unansweredIndices[0]
      if (firstUnanswered !== undefined) {
        setTimeout(() => {
          setCurrentIndex(firstUnanswered)
          Taro.showToast({
            title: `检测到 ${unansweredIndices.length} 道未答题，已跳转`,
            icon: 'none',
            duration: 2000
          })
        }, 500)
        return
      }
    }

    if (currentIndex < totalQuestions - 1) {
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1)
      }, 200)
    }
  }

  const handleJumpToDimension = (dimensionIndex: number) => {
    const startIndex = dimensionIndex * 24
    setShowUnansweredBlink(false)
    setCurrentIndex(startIndex)
  }

  // 检查当前题目是否已回答
  const isCurrentQuestionAnswered = currentQuestion ? currentQuestion.id in answers : false

  // 获取所有未答题的题目索引
  const unansweredIndices = findUnansweredQuestions(sortedQuestions, answers)

  // 跳转到下一题（需要先答题）
  const handleNextQuestion = () => {
    if (!isCurrentQuestionAnswered) {
      // 触发闪烁提示
      setShowUnansweredBlink(true)
      // 3秒后自动停止闪烁
      setTimeout(() => {
        setShowUnansweredBlink(false)
      }, 3000)

      Taro.showToast({
        title: '请先回答当前题目',
        icon: 'none',
        duration: 2000
      })
      return
    }

    // 清除闪烁状态
    setShowUnansweredBlink(false)

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  // 跳转到第一个未答题的题目
  const handleJumpToFirstUnanswered = () => {
    if (unansweredIndices.length === 0) {
      Taro.showToast({
        title: '所有题目已完成',
        icon: 'success',
        duration: 2000
      })
      return
    }

    const firstUnansweredIndex = unansweredIndices[0]
    setShowUnansweredBlink(false)
    setCurrentIndex(firstUnansweredIndex)
    setShowUnansweredDialog(false)
    Taro.showToast({
      title: `已跳转到第 ${firstUnansweredIndex + 1} 题`,
      icon: 'none',
      duration: 2000
    })
  }

  // 跳转到指定的未答题题目
  const handleJumpToUnanswered = (index: number) => {
    setShowUnansweredBlink(false)
    setCurrentIndex(index)
    setShowUnansweredDialog(false)
    Taro.showToast({
      title: `已跳转到第 ${index + 1} 题`,
      icon: 'none',
      duration: 1500
    })
  }

  if (isLoading || !isInitialized) {
    return (
      <View className="all-majors-page__fullscreen">
        <View className="all-majors-page__loading">
          <Text className="all-majors-page__loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (loadError) {
    return (
      <View className="all-majors-page__fullscreen">
        <View className="all-majors-page__loading">
          <Text className="all-majors-page__loading-text">{loadError}</Text>
          <Button
            onClick={async () => {
              setIsLoading(true)
              setLoadError(null)
              try {
                const result = await getScalesWithAnswers()
                setScales(result.scales || [])
                setApiAnswers(result.answers || [])
                const apiAnswersMap: Record<number, number> = {}
                result.answers?.forEach((answer) => {
                  apiAnswersMap[answer.scaleId] = answer.score
                })
                const storedAnswers = loadAnswersFromStorage()
                const mergedAnswers = { ...apiAnswersMap, ...storedAnswers }
                setAnswers(mergedAnswers)
                if (result.scales && result.scales.length > 0) {
                  const questions = result.scales.map(convertScaleToQuestion)
                  const sorted = sortQuestions(questions)
                  setCurrentIndex(findFirstUnansweredIndex(sorted, mergedAnswers))
                }
                setIsInitialized(true)
              } catch (error: any) {
                setLoadError(error?.message || '加载数据失败')
              } finally {
                setIsLoading(false)
              }
            }}
            style={{ marginTop: '20px' }}
          >
            重试
          </Button>
        </View>
      </View>
    )
  }

  if (!currentQuestion) {
    return (
      <View className="all-majors-page__fullscreen">
        <View className="all-majors-page__loading">
          <Text className="all-majors-page__loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  const progress = ((currentIndex + 1) / totalQuestions) * 100
  const sortedOptions = [...(currentQuestion.options || [])].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))

  return (
    <View className="all-majors-page__fullscreen">
      <View className="all-majors-page">
        {/* 顶部进度条 */}
        <View className="all-majors-page__header">
          <View className="all-majors-page__header-top">
            <View className="all-majors-page__header-spacer" />
            <Text className={`all-majors-page__header-title ${progressAnimation ? 'all-majors-page__header-title--animated' : ''}`}>
              第 {currentIndex + 1} / {totalQuestions}题
            </Text>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestartExploration}
              className="all-majors-page__header-clear"
            >
              重新探索
            </Button>
          </View>

          {/* 维度进度条 */}
          <View className="all-majors-page__dimension-progress">
            <View className="all-majors-page__dimension-bars">
              {dimensionProgress.map((dim, index) => {
                const dimQuestions = sortedQuestions.filter((q) => q.dimension === dim.dimension)
                const dimUnanswered = dimQuestions.some((q) => !(q.id in answers))
                const hasUnanswered = dimUnanswered && dim.progress < 100

                return (
                  <View
                    key={dim.dimension}
                    className={`all-majors-page__dimension-bar ${hasUnanswered ? 'all-majors-page__dimension-bar--unanswered' : ''}`}
                    onClick={() => handleJumpToDimension(index)}
                  >
                    <View
                      className="all-majors-page__dimension-bar-fill"
                      style={{
                        width: `${dim.progress}%`,
                        backgroundColor: unifiedProgressColor,
                      }}
                    />
                  </View>
                )
              })}
            </View>

            <View className="all-majors-page__dimension-labels">
              {DIMENSION_ORDER.map((dim, index) => {
                const dimQuestions = sortedQuestions.filter((q) => q.dimension === dim)
                const dimUnanswered = dimQuestions.some((q) => !(q.id in answers))
                const hasUnanswered = dimUnanswered && dimensionProgress[index].progress < 100

                return (
                  <Text
                    key={dim}
                    className={`all-majors-page__dimension-label ${hasUnanswered ? 'all-majors-page__dimension-label--unanswered' : ''}`}
                    onClick={() => handleJumpToDimension(index)}
                    style={{
                      color: dimensionProgress[index].progress > 0 ? unifiedProgressColor : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {dim}
                  </Text>
                )
              })}
            </View>
          </View>

          {/* 当前维度信息 */}
          <View className="all-majors-page__header-info">
            <Text className="all-majors-page__header-info-text">
              当前：{currentDimension} 维度 {answeredInCurrentDimension}/{totalInCurrentDimension}
            </Text>
            {/* 只有当已经有部分题目答过，且还有未答题的题目时，才显示未答题按钮 */}
            {answeredCount > 0 && unansweredIndices.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnansweredDialog(true)}
                className="all-majors-page__header-unanswered"
              >
                未答 {unansweredIndices.length} 题
              </Button>
            )}
          </View>
        </View>

        {/* 题目内容 */}
        <View className="all-majors-page__content">
          <Card className={`all-majors-page__question-card ${showUnansweredBlink && !isCurrentQuestionAnswered ? 'all-majors-page__question-card--blink' : ''}`}>
            <View className="all-majors-page__question-header">
              <Text className="all-majors-page__question-content">{currentQuestion.content}</Text>
            </View>

            <View className="all-majors-page__question-options">
              {sortedOptions.map((option) => {
                // 确保比较时类型一致（都转换为数字）
                const questionId = Number(currentQuestion.id)
                const answerValue = Number(answers[questionId])
                const optionValue = Number(option.optionValue)
                const isSelected = answerValue === optionValue && !isNaN(answerValue) && !isNaN(optionValue)
                const hasCurrentAnswer = questionId in answers && answers[questionId] !== undefined && answers[questionId] !== null
                const wasPreviousAnswer = !hasCurrentAnswer && Number(previousAnswers[questionId]) === optionValue
                const additionalInfoLines = (option.additionalInfo || '')
                  .split(';;')
                  .map((line) => line.trim())
                  .filter(Boolean)
                const additionalInfoText = additionalInfoLines.join('；')

                return (
                  <View
                    key={option.id}
                    onClick={() => handleAnswer(option.optionValue)}
                    className={`all-majors-page__option ${isSelected ? 'all-majors-page__option--selected' : ''} ${wasPreviousAnswer ? 'all-majors-page__option--previous' : ''}`}
                  >
                    <View className="all-majors-page__option-content">
                      <View className="all-majors-page__option-text-wrapper">
                        <Text className="all-majors-page__option-text">{option.optionName}</Text>
                        {additionalInfoText && (
                          <View className="all-majors-page__option-additional">
                            <Text className="all-majors-page__option-additional-line">{additionalInfoText}</Text>
                          </View>
                        )}
                      </View>
                      {wasPreviousAnswer && (
                        <Text className="all-majors-page__option-previous-badge">上次选择</Text>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>
          </Card>
        </View>

        {/* 底部导航 */}
        <View className="all-majors-page__footer">
          <Button
            onClick={() => {
              setShowUnansweredBlink(false)
              setCurrentIndex((prev) => Math.max(0, prev - 1))
            }}
            disabled={currentIndex === 0}
            variant="outline"
            className="all-majors-page__footer-button"
          >
            ← 上一题
          </Button>

          <Button
            onClick={() => {
              if (isUnlocked) {
                setShowUnansweredBlink(false)
                setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))
                return
              }
              handleNextQuestion()
            }}
            disabled={currentIndex === totalQuestions - 1}
            className="all-majors-page__footer-button all-majors-page__footer-button--primary"
          >
            下一题 →
          </Button>

          {isUnlocked && (
            <Button
              onClick={() => {
                Taro.reLaunch({
                  url: '/pages/majors/index',
                })
              }}
              className="all-majors-page__footer-button all-majors-page__footer-button--primary"
            >
              探索专业 →
            </Button>
          )}
        </View>
      </View>

      {/* 重新探索确认对话框 */}
      <Dialog open={showRestartConfirm} onOpenChange={setShowRestartConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认重新探索</DialogTitle>
            <DialogDescription>
              确定要重新探索吗？当前答案将被保存为参考，答题进度将归零重新开始。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRestartConfirm(false)}
              className="all-majors-page__dialog-button"
            >
              取消
            </Button>
            <Button
              onClick={confirmRestartExploration}
              className="all-majors-page__dialog-button all-majors-page__dialog-button--primary"
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 未答题提示对话框 */}
      <Dialog open={showUnansweredDialog} onOpenChange={setShowUnansweredDialog}>
        <DialogContent className="all-majors-page__unanswered-dialog">
          <DialogHeader>
            <DialogTitle>未答题提示</DialogTitle>
            <DialogDescription>
              检测到 {unansweredIndices.length} 道题目未回答，请完成所有题目后再提交。
            </DialogDescription>
          </DialogHeader>
          <View className="all-majors-page__unanswered-content">
            {unansweredIndices.length > 0 ? (
              <View className="all-majors-page__unanswered-list">
                <Button
                  onClick={handleJumpToFirstUnanswered}
                  className="all-majors-page__unanswered-jump-button"
                >
                  跳转到第一道未答题（第 {unansweredIndices[0] + 1} 题）
                </Button>
                <Text className="all-majors-page__unanswered-list-title">所有未答题列表：</Text>
                <View className="all-majors-page__unanswered-grid">
                  {unansweredIndices.map((index) => {
                    const question = sortedQuestions[index]
                    return (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleJumpToUnanswered(index)}
                        className="all-majors-page__unanswered-item"
                      >
                        第 {index + 1} 题
                        {'\n'}
                        <Text className="all-majors-page__unanswered-item-dimension">{question.dimension}</Text>
                      </Button>
                    )
                  })}
                </View>
              </View>
            ) : (
              <View className="all-majors-page__unanswered-empty">
                <Text>所有题目已完成！</Text>
              </View>
            )}
          </View>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUnansweredDialog(false)}
              className="all-majors-page__dialog-button"
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
