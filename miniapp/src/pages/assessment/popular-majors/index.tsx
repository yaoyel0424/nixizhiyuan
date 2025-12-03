// 热门专业评估页面
import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Progress } from '@/components/ui/Progress'
import hotMajorsData from '@/data/hot.json'
import questionnaireData from '@/data/questionnaire.json'
import './index.less'

interface Major {
  id: string
  name: string
  code: string
  degree: string
  limit_year: string
  boy_rate: string
  girl_rate: string
  salaryavg: string
  fivesalaryavg: number
}

interface HotMajorsData {
  ben: Major[]
  gz_ben: Major[]
  zhuan: Major[]
}

interface Question {
  id: number
  content: string
  elementId: number
  type: string
  dimension: string
  options: Array<{
    id: number
    optionName: string
    optionValue: number
  }>
}

const STORAGE_KEY = 'popularMajorsResults'

export default function PopularMajorsPage() {
  const [hotMajors, setHotMajors] = useState<HotMajorsData | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<'ben' | 'gz_ben' | 'zhuan'>('ben')
  const [loading, setLoading] = useState(true)
  const [showQuestionnaire, setShowQuestionnaire] = useState(false)
  const [selectedMajor, setSelectedMajor] = useState<Major | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [loveEnergy, setLoveEnergy] = useState<number | null>(null)
  // 保存每个专业的测评结果 { majorCode: loveEnergy }
  const [majorResults, setMajorResults] = useState<Record<string, number>>({})

  useEffect(() => {
    // 加载热门专业数据
    try {
      const data = (hotMajorsData as any).data as HotMajorsData
      setHotMajors(data)
      setLoading(false)
    } catch (error) {
      console.error('加载热门专业数据失败:', error)
      Taro.showToast({
        title: '加载数据失败',
        icon: 'none'
      })
      setLoading(false)
    }

    // 从本地存储加载已保存的测评结果
    try {
      const savedResults = Taro.getStorageSync(STORAGE_KEY)
      if (savedResults) {
        setMajorResults(JSON.parse(savedResults))
      }
    } catch (error) {
      console.error('加载保存的测评结果失败:', error)
    }
  }, [])

  const categories = [
    { key: 'ben' as const, label: '本科' },
    { key: 'gz_ben' as const, label: '高职本科' },
    { key: 'zhuan' as const, label: '专科' },
  ]

  // 调换高职本科和专科的数据显示
  const getDisplayCategory = (category: 'ben' | 'gz_ben' | 'zhuan'): 'ben' | 'gz_ben' | 'zhuan' => {
    if (category === 'gz_ben') return 'zhuan' // 高职本科tab显示专科数据
    if (category === 'zhuan') return 'gz_ben' // 专科tab显示高职本科数据
    return category // 本科tab显示本科数据
  }

  const currentMajors = hotMajors?.[getDisplayCategory(selectedCategory)] || []

  // 随机选择8道题目
  const loadRandomQuestions = async () => {
    try {
      const allQuestions: Question[] = questionnaireData as any

      // 随机打乱并选择8道题目
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
      const selectedQuestions = shuffled.slice(0, 8)

      setQuestions(selectedQuestions)
      setCurrentQuestionIndex(0)
      setAnswers({})
      setIsCompleted(false)
      setLoveEnergy(null)
    } catch (error) {
      console.error('加载题目失败:', error)
      Taro.showToast({
        title: '加载题目失败',
        icon: 'none'
      })
      setQuestions([])
    }
  }

  // 处理开始测评
  const handleStartAssessment = (major: Major) => {
    setSelectedMajor(major)
    setShowQuestionnaire(true)
    loadRandomQuestions()
  }

  // 处理答题
  const handleAnswer = (questionId: number, optionValue: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionValue }))
  }

  // 处理下一题
  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
    } else {
      // 完成测评，计算热爱能量
      handleComplete()
    }
  }

  // 处理上一题
  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
    }
  }

  // 完成测评
  const handleComplete = () => {
    // 计算总分（所有选项值的总和）
    // 选项值范围通常是 -2 到 2，需要映射到 0-1 范围
    const totalScore = Object.values(answers).reduce((sum, val) => sum + val, 0)
    // 计算平均分（范围可能是 -2 到 2）
    const avgScore = totalScore / questions.length
    // 将 -2 到 2 的范围映射到 0 到 1 的范围
    // 公式: (value - min) / (max - min) = (avgScore - (-2)) / (2 - (-2)) = (avgScore + 2) / 4
    const energy = Math.min(1, Math.max(0, (avgScore + 2) / 4))
    setLoveEnergy(energy)
    setIsCompleted(true)

    // 保存测评结果到状态和本地存储
    if (selectedMajor) {
      const newResults = {
        ...majorResults,
        [selectedMajor.code]: energy
      }
      setMajorResults(newResults)
      try {
        Taro.setStorageSync(STORAGE_KEY, JSON.stringify(newResults))
      } catch (error) {
        console.error('保存测评结果失败:', error)
      }
    }

    // 延迟关闭对话框，让用户看到完成状态
    setTimeout(() => {
      setShowQuestionnaire(false)
      setIsCompleted(false)
      setLoveEnergy(null)
    }, 2000)
  }

  // 重新测评
  const handleRetake = () => {
    loadRandomQuestions()
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0

  return (
    <PageContainer>
      <View className="popular-majors-page">
        {/* 头部横幅 */}
        <View className="popular-majors-page__header">
          <View className="popular-majors-page__header-content">
            <Text className="popular-majors-page__header-title">
              热门专业测评
            </Text>
            <Text className="popular-majors-page__header-subtitle">
              选择热门专业，进行专业匹配度测评
            </Text>
          </View>
        </View>

        {/* 分类切换 */}
        <View className="popular-majors-page__categories">
          <Card className="popular-majors-page__categories-card">
            <View className="popular-majors-page__categories-grid">
              {categories.map((category) => {
                const isActive = selectedCategory === category.key
                return (
                  <View
                    key={category.key}
                    className={`popular-majors-page__category-item ${isActive ? 'popular-majors-page__category-item--active' : ''}`}
                    onClick={() => setSelectedCategory(category.key)}
                  >
                    <Text className="popular-majors-page__category-text">{category.label}</Text>
                  </View>
                )
              })}
            </View>
          </Card>
        </View>

        {/* 专业列表 */}
        {loading ? (
          <View className="popular-majors-page__loading">
            <Text className="popular-majors-page__loading-text">加载中...</Text>
          </View>
        ) : (
          <View className="popular-majors-page__majors">
            {currentMajors.map((major, index) => {
              const hasResult = majorResults[major.code] !== undefined
              const resultEnergy = majorResults[major.code]

              return (
                <Card key={major.id} className="popular-majors-page__major-card">
                  <View className="popular-majors-page__major-content">
                    <View className="popular-majors-page__major-index">
                      <Text className="popular-majors-page__major-index-text">{index + 1}</Text>
                    </View>
                    <View className="popular-majors-page__major-info">
                      <Text className="popular-majors-page__major-name">{major.name}</Text>
                      <View className="popular-majors-page__major-tags">
                        {major.degree && (
                          <Text className="popular-majors-page__major-tag">{major.degree}</Text>
                        )}
                        {major.limit_year && (
                          <Text className="popular-majors-page__major-tag">{major.limit_year}</Text>
                        )}
                        {major.fivesalaryavg > 0 && (
                          <Text className="popular-majors-page__major-tag">
                            毕业5年薪资: ¥{major.fivesalaryavg}
                          </Text>
                        )}
                      </View>
                      <Text className="popular-majors-page__major-desc">
                        该专业致力于培养具备扎实理论基础和实践能力的专业人才，为学生提供全面的学科知识和职业发展指导。
                      </Text>
                    </View>
                    <View className="popular-majors-page__major-actions">
                      {/* 显示测评结果 */}
                      {hasResult && (
                        <View className="popular-majors-page__major-result">
                          <Text className="popular-majors-page__major-result-icon">⚡</Text>
                          <Text className="popular-majors-page__major-result-value">
                            {resultEnergy.toFixed(2)}
                          </Text>
                        </View>
                      )}
                      {hasResult ? (
                        <Button
                          size="sm"
                          className="popular-majors-page__major-button popular-majors-page__major-button--retake"
                          onClick={() => handleStartAssessment(major)}
                        >
                          🔄 重新测评
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="popular-majors-page__major-button"
                          onClick={() => handleStartAssessment(major)}
                        >
                          测评
                        </Button>
                      )}
                    </View>
                  </View>
                </Card>
              )
            })}
          </View>
        )}

        {!loading && currentMajors.length === 0 && (
          <View className="popular-majors-page__empty">
            <Text className="popular-majors-page__empty-text">暂无数据</Text>
          </View>
        )}
      </View>

      {/* 测评对话框 */}
      <Dialog open={showQuestionnaire} onOpenChange={setShowQuestionnaire}>
        <DialogContent className="popular-majors-page__dialog" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle className="popular-majors-page__dialog-title">
              {selectedMajor?.name} - 专业匹配度测评
            </DialogTitle>
            <DialogDescription>
              <Text className="popular-majors-page__dialog-desc">
                {isCompleted
                  ? '测评完成'
                  : `共 ${questions.length} 道题，当前第 ${currentQuestionIndex + 1} 题`}
              </Text>
            </DialogDescription>
          </DialogHeader>

          {isCompleted ? (
            // 完成状态：显示热爱能量和重新测评按钮
            <View className="popular-majors-page__dialog-completed">
              <View className="popular-majors-page__dialog-energy">
                <View className="popular-majors-page__dialog-energy-icon">
                  <Text className="popular-majors-page__dialog-energy-icon-text">⚡</Text>
                </View>
                <Text className="popular-majors-page__dialog-energy-value">
                  {loveEnergy !== null ? loveEnergy.toFixed(2) : '0.00'}
                </Text>
                <Text className="popular-majors-page__dialog-energy-label">热爱能量</Text>
              </View>
              <Text className="popular-majors-page__dialog-energy-desc">
                基于您的回答，我们计算出您对该专业的匹配度
              </Text>
              <View className="popular-majors-page__dialog-actions">
                <Button
                  onClick={handleRetake}
                  className="popular-majors-page__dialog-button popular-majors-page__dialog-button--primary"
                  size="lg"
                >
                  🔄 重新测评
                </Button>
                <Button
                  onClick={() => setShowQuestionnaire(false)}
                  variant="outline"
                  className="popular-majors-page__dialog-button"
                  size="lg"
                >
                  关闭
                </Button>
              </View>
            </View>
          ) : questions.length === 0 ? (
            <View className="popular-majors-page__dialog-loading">
              <Text className="popular-majors-page__dialog-loading-text">加载题目中...</Text>
            </View>
          ) : (
            // 答题状态
            <View className="popular-majors-page__dialog-question">
              {currentQuestion && (
                <View className="popular-majors-page__question">
                  {/* 进度条 */}
                  <View className="popular-majors-page__question-progress">
                    <Progress value={progress} max={100} />
                    <Text className="popular-majors-page__question-progress-text">
                      {currentQuestionIndex + 1} / {questions.length}
                    </Text>
                  </View>

                  {/* 题目信息 */}
                  <View className="popular-majors-page__question-header">
                    <Text className="popular-majors-page__question-meta">
                      {currentQuestion.dimension} · {currentQuestion.type}
                    </Text>
                    <Text className="popular-majors-page__question-content">
                      {currentQuestion.content}
                    </Text>
                  </View>

                  {/* 选项 */}
                  <View className="popular-majors-page__question-options">
                    {currentQuestion.options.map((option) => {
                      const isAnswered = answers[currentQuestion.id] === option.optionValue
                      return (
                        <View
                          key={option.id}
                          className={`popular-majors-page__option ${isAnswered ? 'popular-majors-page__option--selected' : ''}`}
                          onClick={() => handleAnswer(currentQuestion.id, option.optionValue)}
                        >
                          <View className="popular-majors-page__option-radio">
                            {isAnswered && (
                              <View className="popular-majors-page__option-radio-dot" />
                            )}
                          </View>
                          <Text className="popular-majors-page__option-text">
                            {option.optionName}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              )}

              {/* 导航按钮 */}
              <View className="popular-majors-page__dialog-navigation">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className="popular-majors-page__dialog-nav-button"
                >
                  上一题
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={answers[currentQuestion?.id] === undefined}
                  className="popular-majors-page__dialog-nav-button popular-majors-page__dialog-nav-button--next"
                >
                  {currentQuestionIndex < questions.length - 1 ? '下一题' : '完成测评'}
                </Button>
              </View>
            </View>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
