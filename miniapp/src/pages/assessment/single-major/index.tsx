// 专业详情页面
import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { RadioGroup, RadioGroupItem, Label } from '@/components/ui/RadioGroup'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/Collapsible'
import { getMajorDetailByCode } from '@/services/majors'
import { getScalesByElementId } from '@/services/scales'
import { MajorDetailInfo, Scale, ScaleAnswer, ScaleOption } from '@/types/api'
import questionnaireData from '@/data/questionnaire.json'
import './index.less'

const STORAGE_KEY = 'questionnaire_answers'

// 字段标签映射
const FIELD_LABELS: Record<string, string> = {
  educationLevel: '学历',
  studyPeriod: '学制',
  awardedDegree: '学位',
  majorBrief: '核心价值',
  majorKey: '快速扫描',
  studyContent: '学习内容',
  academicDevelopment: '学业发展',
}

const INLINE_FIELDS = ['educationLevel', 'studyPeriod', 'awardedDegree']
const SECTION_ORDER = ['studyContent', 'academicDevelopment']

// 学历转换映射
const EDUCATION_LEVEL_MAP: Record<string, string> = {
  'ben': '本科',
  'gao_ben': '高职本科',
  'zhuan': '专科',
}

// 转换学历字段
function formatEducationLevel(value: string): string {
  return EDUCATION_LEVEL_MAP[value] || value
}

// 核心价值显示组件
function CoreValueDisplay({ value }: { value: any }) {
  if (!value) {
    return (
      <View className="single-major-page__empty-text">
        <Text>无数据</Text>
      </View>
    )
  }

  return (
    <Card className="single-major-page__value-card">
      <View className="single-major-page__value-card-header">
        <Text className="single-major-page__value-card-icon">📖</Text>
        <Text className="single-major-page__value-card-title">核心价值</Text>
      </View>
      <View className="single-major-page__value-card-content">
        <Text className="single-major-page__value-card-text">{value}</Text>
      </View>
    </Card>
  )
}

// 快速扫描显示组件
function QuickScanDisplay({ value }: { value: any }) {
  if (!value) {
    return (
      <View className="single-major-page__empty-text">
        <Text>无数据</Text>
      </View>
    )
  }

  return (
    <Card className="single-major-page__value-card">
      <View className="single-major-page__value-card-header">
        <Text className="single-major-page__value-card-icon">🧠</Text>
        <Text className="single-major-page__value-card-title">快速扫描</Text>
      </View>
      <View className="single-major-page__value-card-content">
        <Text className="single-major-page__value-card-text">{value}</Text>
      </View>
    </Card>
  )
}

// 计算分析数量
function getAnalysisCounts(analyses: any[]) {
  let positiveCount = 0
  let negativeCount = 0
  if (Array.isArray(analyses) && analyses.length > 0) {
    analyses.forEach((a) => {
      if (a && a.type) {
        if (a.type === 'shanxue' || a.type === 'lexue') {
          positiveCount++
        } else if (a.type === 'tiaozhan' || a.type === 'yanxue') {
          negativeCount++
        }
      }
    })
  }
  return { positiveCount, negativeCount }
}

// 根据 userElementScore 判断是否明显
// > 3: 明显
// 3 到 -3: 待发现
// < -3: 不明显
function getElementScoreStatus(userElementScore: number | undefined): 'obvious' | 'to-discover' | 'unobvious' | null {
  if (userElementScore === undefined || userElementScore === null) {
    return null
  }
  if (userElementScore > 3) {
    return 'obvious'
  } else if (userElementScore >= -3 && userElementScore <= 3) {
    return 'to-discover'
  } else {
    return 'unobvious'
  }
}

// 获取状态标签文本和图标
function getElementScoreStatusInfo(status: 'obvious' | 'to-discover' | 'unobvious' | null): { label: string; icon: string; description: string } {
  switch (status) {
    case 'obvious':
      return {
        label: '优势明显',
        icon: '✓',
        description: '您的这项特质表现突出，是该专业的明显优势'
      }
    case 'to-discover':
      return {
        label: '潜力待发现',
        icon: '🔍',
        description: '这项特质有待进一步探索和发现'
      }
    case 'unobvious':
      return {
        label: '特点不明显',
        icon: '⚠️',
        description: '这项特质在您身上表现不明显，可能需要特别关注'
      }
    default:
      return {
        label: '',
        icon: '',
        description: ''
      }
  }
}

// 问卷测试对话框组件
function QuestionnaireModal({ open, onOpenChange, elementIds }: { open: boolean; onOpenChange: (open: boolean) => void; elementIds: number[] }) {
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  useEffect(() => {
    if (open && elementIds.length > 0) {
      loadQuestions()
    }
  }, [open, elementIds])

  const loadQuestions = () => {
    setIsLoading(true)
    try {
      const allQuestions: any[] = questionnaireData as any[]
      const filtered = allQuestions.filter((q) => elementIds.includes(q.elementId))
      setQuestions(filtered)
      setCurrentQuestionIndex(0)
      setAnswers({})
    } catch (error) {
      console.error('Error loading questionnaire:', error)
      setQuestions([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswer = (questionId: number, optionValue: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionValue }))
  }

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
    }
  }

  const handleSubmit = () => {
    const totalScore = Object.values(answers).reduce((sum, val) => sum + val, 0)
    Taro.showModal({
      title: '问卷完成',
      content: `总分：${totalScore}`,
      showCancel: false,
      success: () => {
        onOpenChange(false)
      }
    })
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="single-major-page__questionnaire-dialog">
        <DialogHeader>
          <DialogTitle>专业匹配度测试</DialogTitle>
          <DialogDescription>
            共 {questions.length} 道题，当前第 {currentQuestionIndex + 1} 题
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <View className="single-major-page__questionnaire-loading">
            <Text>加载问卷中...</Text>
          </View>
        ) : questions.length === 0 ? (
          <View className="single-major-page__questionnaire-empty">
            <Text>暂无相关问卷</Text>
          </View>
        ) : (
          <View className="single-major-page__questionnaire-content">
            {currentQuestion && (
              <View className="single-major-page__questionnaire-question">
                <View className="single-major-page__questionnaire-question-header">
                  <Text className="single-major-page__questionnaire-question-meta">
                    {currentQuestion.dimension} · {currentQuestion.type}
                  </Text>
                  <Text className="single-major-page__questionnaire-question-text">{currentQuestion.content}</Text>
                </View>

                <RadioGroup
                  value={String(answers[currentQuestion.id] ?? '')}
                  onValueChange={(value) => handleAnswer(currentQuestion.id, Number(value))}
                >
                  <View className="single-major-page__questionnaire-options">
                    {currentQuestion.options.map((option: any) => {
                      const isAnswered = answers[currentQuestion.id] === option.optionValue
                      return (
                        <View
                          key={option.id}
                          className={`single-major-page__questionnaire-option ${isAnswered ? 'single-major-page__questionnaire-option--selected' : ''}`}
                          onClick={() => handleAnswer(currentQuestion.id, option.optionValue)}
                        >
                          <RadioGroupItem
                            value={String(option.optionValue)}
                            id={`option-${option.id}`}
                          />
                          <Label htmlFor={`option-${option.id}`} className="single-major-page__questionnaire-option-label">
                            <Text className="single-major-page__questionnaire-option-name">{option.optionName}</Text>
                            {option.additionalInfo && (
                              <Text className="single-major-page__questionnaire-option-info">{option.additionalInfo}</Text>
                            )}
                          </Label>
                        </View>
                      )
                    })}
                  </View>
                </RadioGroup>
              </View>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
              >
                上一题
              </Button>
              {currentQuestionIndex < questions.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={answers[currentQuestion?.id] === undefined}
                >
                  下一题
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={Object.keys(answers).length < questions.length}
                >
                  提交问卷
                </Button>
              )}
            </DialogFooter>
          </View>
        )}
      </DialogContent>
    </Dialog>
  )
}

// 查看问卷对话框组件
function QuestionnaireViewModal({ open, onOpenChange, elementId }: { open: boolean; onOpenChange: (open: boolean) => void; elementId: number | undefined }) {
  const [questions, setQuestions] = useState<Scale[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open && elementId) {
      loadQuestionsAndAnswers()
    } else {
      // 关闭对话框时清空数据
      setQuestions([])
      setAnswers({})
    }
  }, [open, elementId])

  const loadQuestionsAndAnswers = async () => {
    if (!elementId) {
      return
    }

    setIsLoading(true)
    try {
      // 调用 API 获取量表列表和用户答案
      const response = await getScalesByElementId(elementId)
      
      // 设置量表列表（作为题目）
      setQuestions(response.scales || [])

      // 将答案列表转换为以 scaleId 为 key 的映射
      // ScaleAnswer.score 对应选项的 optionValue
      const answersMap: Record<number, number> = {}
      if (response.answers && Array.isArray(response.answers)) {
        response.answers.forEach((answer: ScaleAnswer) => {
          answersMap[answer.scaleId] = answer.score
        })
      }
      setAnswers(answersMap)
    } catch (error) {
      console.error('加载问卷失败:', error)
      Taro.showToast({
        title: '加载问卷失败',
        icon: 'none',
        duration: 2000
      })
      setQuestions([])
      setAnswers({})
    } finally {
      setIsLoading(false)
    }
  }

  // 根据 scaleId 和 score 获取答案文本
  const getAnswerText = (scale: Scale, answerScore: number) => {
    if (!scale.options || scale.options.length === 0) {
      return '未作答'
    }
    
    // 查找匹配的选项（optionValue 对应 score）
    const option = scale.options.find((opt) => opt.optionValue === answerScore)
    return option ? option.optionName : '未作答'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="single-major-page__questionnaire-view-dialog">
        <DialogHeader>
          <DialogTitle>查看对应问卷内容和答案</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <View className="single-major-page__questionnaire-loading">
            <Text>加载中...</Text>
          </View>
        ) : questions.length === 0 ? (
          <View className="single-major-page__questionnaire-empty">
            <Text>暂无相关问卷题目</Text>
          </View>
        ) : (
          <ScrollView className="single-major-page__questionnaire-view-content" scrollY>
            {questions.map((question, index) => {
              const answerValue = answers[question.id]
              const hasAnswer = answerValue !== undefined

              return (
                <Card key={question.id} className="single-major-page__questionnaire-view-item">
                  <Text className="single-major-page__questionnaire-view-item-content">{question.content}</Text>

                  {hasAnswer ? (
                    <View className="single-major-page__questionnaire-view-answer single-major-page__questionnaire-view-answer--has">
                      <Text className="single-major-page__questionnaire-view-answer-label">您的答案：</Text>
                      <Text className="single-major-page__questionnaire-view-answer-text">
                        {getAnswerText(question, answerValue)}
                      </Text>
                    </View>
                  ) : (
                    <View className="single-major-page__questionnaire-view-answer">
                      <Text className="single-major-page__questionnaire-view-answer-empty">未作答</Text>
                    </View>
                  )}

                  {question.options && question.options.length > 0 && (
                    <View className="single-major-page__questionnaire-view-options">
                      <Text className="single-major-page__questionnaire-view-options-label">选项：</Text>
                      {question.options.map((option: ScaleOption) => {
                        const isSelected = hasAnswer && option.optionValue === answerValue
                        return (
                          <View
                            key={option.id}
                            className={`single-major-page__questionnaire-view-option ${isSelected ? 'single-major-page__questionnaire-view-option--selected' : ''}`}
                          >
                            {isSelected && (
                              <Text className="single-major-page__questionnaire-view-option-check">✓</Text>
                            )}
                            <View className="single-major-page__questionnaire-view-option-content">
                              <View className="single-major-page__questionnaire-view-option-header">
                                <Text className={`single-major-page__questionnaire-view-option-name ${isSelected ? 'single-major-page__questionnaire-view-option-name--selected' : ''}`}>
                                  {option.optionName}
                                </Text>
                                {isSelected && (
                                  <Text className="single-major-page__questionnaire-view-option-badge">您的选择</Text>
                                )}
                              </View>
                              {option.additionalInfo && (
                                <Text className="single-major-page__questionnaire-view-option-info">{option.additionalInfo}</Text>
                              )}
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </Card>
              )
            })}
          </ScrollView>
        )}
      </DialogContent>
    </Dialog>
  )
}

// 专业匹配元素分析显示组件
function MajorElementAnalysesDisplay({ analyses }: { analyses: any[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [showQuestionnaire, setShowQuestionnaire] = useState(false)
  const [selectedElementId, setSelectedElementId] = useState<number | undefined>(undefined)

  if (!Array.isArray(analyses) || analyses.length === 0) {
    return (
      <View className="single-major-page__empty-text">
        <Text>无数据</Text>
      </View>
    )
  }

  const grouped = analyses.reduce(
    (acc, analysis, index) => {
      const type = analysis.type || '未分类'

      if (type === 'lexue' || type === 'shanxue') {
        if (!acc['积极助力']) {
          acc['积极助力'] = []
        }
        acc['积极助力'].push({ ...analysis, originalIndex: index })
      } else if (type === 'tiaozhan' || type === 'yanxue') {
        if (!acc['潜在挑战']) {
          acc['潜在挑战'] = []
        }
        acc['潜在挑战'].push({ ...analysis, originalIndex: index })
      } else {
        if (!acc[type]) {
          acc[type] = []
        }
        acc[type].push({ ...analysis, originalIndex: index })
      }

      return acc
    },
    {} as Record<string, any[]>,
  )

  const sortedTypes = Object.keys(grouped).sort()

  return (
    <View className="single-major-page__element-analyses">
      {sortedTypes.map((type) => {
        const items = grouped[type]
        const isChallengeType = type === '潜在挑战'
        const isPositiveType = type === '积极助力'

        let typeIcon = '⚡'
        let typeColor = '#666'
        let typeBg = 'rgba(156, 163, 175, 0.1)'

        if (isPositiveType) {
          typeIcon = '📈'
          typeColor = '#22c55e'
          typeBg = 'rgba(34, 197, 94, 0.1)'
        } else if (isChallengeType) {
          typeIcon = '⚠️'
          typeColor = '#ef4444'
          typeBg = 'rgba(239, 68, 68, 0.1)'
        }

        return (
          <View key={type} className="single-major-page__element-analyses-group">
            <View className="single-major-page__element-analyses-group-header" style={{ background: typeBg }}>
              <View className="single-major-page__element-analyses-group-icon" style={{ color: typeColor }}>
                <Text>{typeIcon}</Text>
              </View>
              <Text className="single-major-page__element-analyses-group-title" style={{ color: typeColor }}>
                {type}
              </Text>
            </View>
            <View className="single-major-page__element-analyses-group-content">
              {items.map((item: any) => {
                const isExpanded = expandedIndex === item.originalIndex
                const scoreStatus = getElementScoreStatus(item.userElementScore)
                const statusInfo = getElementScoreStatusInfo(scoreStatus)

                return (
                  <View key={item.originalIndex} className="single-major-page__element-analyses-item">
                    <View
                      className={`single-major-page__element-analyses-item-trigger ${isExpanded ? 'single-major-page__element-analyses-item-trigger--expanded' : ''}`}
                      onClick={() => {
                        setExpandedIndex(isExpanded ? null : item.originalIndex)
                      }}
                    >
                      <View className="single-major-page__element-analyses-item-name-wrapper">
                        <Text className="single-major-page__element-analyses-item-name">
                          {item.element?.name || '未命名'}
                        </Text>
                        {scoreStatus && (
                          <View className={`single-major-page__element-analyses-item-badge single-major-page__element-analyses-item-badge--${scoreStatus}`}>
                            <Text className="single-major-page__element-analyses-item-badge-icon">{statusInfo.icon}</Text>
                            <Text className="single-major-page__element-analyses-item-badge-text">{statusInfo.label}</Text>
                          </View>
                        )}
                      </View>
                      <Text className={`single-major-page__element-analyses-item-arrow ${isExpanded ? 'single-major-page__element-analyses-item-arrow--expanded' : ''}`}>
                        ▼
                      </Text>
                    </View>
                    {isExpanded && (
                      <View className="single-major-page__element-analyses-item-content">
                        {/* 特质表现评估 */}
                        {scoreStatus && item.userElementScore !== undefined && (
                          <View className="single-major-page__element-analyses-item-field single-major-page__element-analyses-item-field--highlight">
                            <View className="single-major-page__element-analyses-item-field-header">
                              <Text className="single-major-page__element-analyses-item-field-label">特质表现评估</Text>
                              <View className={`single-major-page__element-analyses-item-badge single-major-page__element-analyses-item-badge--${scoreStatus}`}>
                                <Text className="single-major-page__element-analyses-item-badge-icon">{statusInfo.icon}</Text>
                                <Text className="single-major-page__element-analyses-item-badge-text">{statusInfo.label}</Text>
                              </View>
                            </View>
                            <Text className="single-major-page__element-analyses-item-field-description">{statusInfo.description}</Text>
                            <Text className="single-major-page__element-analyses-item-field-score">
                              匹配得分：{typeof item.userElementScore === 'number' ? item.userElementScore.toFixed(1) : item.userElementScore}
                            </Text>
                          </View>
                        )}
                        {item.summary && (
                          <View className="single-major-page__element-analyses-item-field">
                            <Text className="single-major-page__element-analyses-item-field-label">摘要</Text>
                            <Text className="single-major-page__element-analyses-item-field-value">{item.summary}</Text>
                          </View>
                        )}
                        {item.matchReason && (
                          <View className="single-major-page__element-analyses-item-field">
                            <Text className="single-major-page__element-analyses-item-field-label">匹配原因</Text>
                            <Text className="single-major-page__element-analyses-item-field-value">{item.matchReason}</Text>
                          </View>
                        )}
                        {item.element?.status && (
                          <View className="single-major-page__element-analyses-item-field">
                            <Text className="single-major-page__element-analyses-item-field-label">状态</Text>
                            <Text className="single-major-page__element-analyses-item-field-value">{item.element.status}</Text>
                          </View>
                        )}
                        {item.element?.id && (
                          <View className="single-major-page__element-analyses-item-action">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedElementId(item.element.id)
                                setShowQuestionnaire(true)
                              }}
                              variant="outline"
                              size="sm"
                            >
                              <Text>📄 查看对应问卷内容和答案</Text>
                            </Button>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          </View>
        )
      })}
      <QuestionnaireViewModal
        open={showQuestionnaire}
        onOpenChange={setShowQuestionnaire}
        elementId={selectedElementId}
      />
    </View>
  )
}

// 喜欢与天赋概览组件
function MajorAnalysisActionCard({ analyses, onViewDetail, onRedoQuestionnaire }: any) {
  const { positiveCount, negativeCount } = getAnalysisCounts(analyses)
  const totalCount = positiveCount + negativeCount

  if (totalCount === 0) {
    return (
      <Card className="single-major-page__analysis-empty-card">
        <View className="single-major-page__analysis-empty-content">
          <Text className="single-major-page__analysis-empty-text">暂无天赋匹配度数据。请先完成问卷。</Text>
          <Button onClick={onRedoQuestionnaire} className="single-major-page__analysis-empty-button">
            <Text>🔄 立即进行专业匹配问卷</Text>
          </Button>
        </View>
      </Card>
    )
  }

  return (
    <Card className="single-major-page__analysis-card">
      <View className="single-major-page__analysis-header">
        <Text className="single-major-page__analysis-icon">🧠</Text>
        <Text className="single-major-page__analysis-title">喜欢与天赋概览</Text>
      </View>
      <View className="single-major-page__analysis-content">
        <View className="single-major-page__analysis-buttons">
          <View 
            className="single-major-page__analysis-button single-major-page__analysis-button--positive"
            onClick={onViewDetail}
          >
            <View className="single-major-page__analysis-button-content">
              <Text className="single-major-page__analysis-button-value">{positiveCount}</Text>
              <Text className="single-major-page__analysis-button-icon">📈</Text>
            </View>
            <Text className="single-major-page__analysis-button-label">积极助力项</Text>
          </View>
          <View 
            className="single-major-page__analysis-button single-major-page__analysis-button--negative"
            onClick={onViewDetail}
          >
            <View className="single-major-page__analysis-button-content">
              <Text className="single-major-page__analysis-button-value">{negativeCount}</Text>
              <Text className="single-major-page__analysis-button-icon">⚠️</Text>
            </View>
            <Text className="single-major-page__analysis-button-label">潜在挑战项</Text>
          </View>
        </View>
      </View>
    </Card>
  )
}

// 热爱能量分显示组件（简化版，只显示分数）
function LoveEnergyScoreDisplay({ majorData }: { majorData: any }) {
  if (!majorData || typeof majorData !== 'object') {
    return null
  }

  // 检查 score 字段是否存在且有效
  if (majorData.score === undefined || majorData.score === null) {
    return null
  }

  const score = typeof majorData.score === 'string' 
    ? parseFloat(majorData.score).toFixed(2) 
    : majorData.score.toFixed(2)

  return (
    <Card className="single-major-page__love-energy-card">
      <View className="single-major-page__love-energy-content">
        <Text className="single-major-page__love-energy-value">{score}</Text>
        <Text className="single-major-page__love-energy-label">热爱能量得分</Text>
      </View>
    </Card>
  )
}

// 专业分数显示组件
function MajorScoreDisplay({ majorData }: { majorData: any }) {
  const [expanded, setExpanded] = useState(false)

  if (!majorData || typeof majorData !== 'object') {
    return (
      <View className="single-major-page__empty-text">
        <Text>无数据</Text>
      </View>
    )
  }

  return (
    <Card className="single-major-page__score-card">
      {/* 热爱能量分数 */}
      {majorData.score !== undefined && (
        <View className="single-major-page__score-main">
          <Text className="single-major-page__score-value">
            {typeof majorData.score === 'string' ? parseFloat(majorData.score).toFixed(2) : majorData.score.toFixed(2)}
          </Text>
          <Text className="single-major-page__score-label">热爱能量得分</Text>
        </View>
      )}

      {/* 详细分解 */}
      <View className="single-major-page__score-details">
        <View className="single-major-page__score-details-trigger" onClick={() => setExpanded(!expanded)}>
          <Text className="single-major-page__score-details-title">详细分解</Text>
          <Text className={`single-major-page__score-details-icon ${expanded ? 'single-major-page__score-details-icon--expanded' : ''}`}>
            ▼
          </Text>
        </View>
        {expanded && (
          <View className="single-major-page__score-details-content">
            {majorData.lexueScore !== undefined && (
              <View className="single-major-page__score-detail-item">
                <Text className="single-major-page__score-detail-label">乐学:</Text>
                <Text className="single-major-page__score-detail-value single-major-page__score-detail-value--positive">
                  +{typeof majorData.lexueScore === 'string' ? parseFloat(majorData.lexueScore).toFixed(2) : majorData.lexueScore.toFixed(2)}
                </Text>
              </View>
            )}
            {majorData.shanxueScore !== undefined && (
              <View className="single-major-page__score-detail-item">
                <Text className="single-major-page__score-detail-label">善学:</Text>
                <Text className="single-major-page__score-detail-value single-major-page__score-detail-value--positive">
                  +{typeof majorData.shanxueScore === 'string' ? parseFloat(majorData.shanxueScore).toFixed(2) : majorData.shanxueScore.toFixed(2)}
                </Text>
              </View>
            )}
            {majorData.yanxueDeduction !== undefined && (
              <View className="single-major-page__score-detail-item">
                <Text className="single-major-page__score-detail-label">厌学:</Text>
                <Text className="single-major-page__score-detail-value single-major-page__score-detail-value--negative">
                  -{typeof majorData.yanxueDeduction === 'string' ? parseFloat(majorData.yanxueDeduction).toFixed(2) : majorData.yanxueDeduction.toFixed(2)}
                </Text>
              </View>
            )}
            {majorData.tiaozhanDeduction !== undefined && (
              <View className="single-major-page__score-detail-item">
                <Text className="single-major-page__score-detail-label">阻学:</Text>
                <Text className="single-major-page__score-detail-value single-major-page__score-detail-value--negative">
                  -{typeof majorData.tiaozhanDeduction === 'string' ? parseFloat(majorData.tiaozhanDeduction).toFixed(2) : majorData.tiaozhanDeduction.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Card>
  )
}

// 内联字段显示组件
function InlineFieldsDisplay({ data }: { data: Record<string, any> }) {
  const inlineData = INLINE_FIELDS.filter((key) => data[key] !== undefined && data[key] !== null).map((key) => {
    let value = data[key]
    // 转换学历字段
    if (key === 'educationLevel' && typeof value === 'string') {
      value = formatEducationLevel(value)
    }
    return {
      key,
      value,
      label: FIELD_LABELS[key] || key,
    }
  })

  if (inlineData.length === 0) return null

  return (
    <View className="single-major-page__inline-fields">
      {inlineData.map(({ key, value, label }) => (
        <View key={key} className="single-major-page__inline-field">
          <Text className="single-major-page__inline-field-label">{label}:</Text>
          <Text className="single-major-page__inline-field-value">{String(value)}</Text>
        </View>
      ))}
    </View>
  )
}

// 学习内容显示组件（支持展开/收起）
function StudyContentDisplay({ value }: { value: any }) {
  const [expanded, setExpanded] = useState(false)

  if (!value) {
    return (
      <View className="single-major-page__empty-text">
        <Text>无数据</Text>
      </View>
    )
  }

  // 解析数据
  let parsedData: any = null
  if (typeof value === 'string') {
    try {
      parsedData = JSON.parse(value)
    } catch {
      // 如果不是 JSON，直接作为文本显示
      parsedData = value
    }
  } else if (typeof value === 'object') {
    parsedData = value
  } else {
    parsedData = String(value)
  }

  // 如果是对象，格式化显示
  if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
    return (
      <View className="single-major-page__study-content">
        <View className={`single-major-page__study-content-text ${expanded ? 'single-major-page__study-content-text--expanded' : ''}`}>
          {/* 专业基础课 */}
          {parsedData.专业基础课 && Array.isArray(parsedData.专业基础课) && parsedData.专业基础课.length > 0 && (
            <View className="single-major-page__study-content-section">
              <Text className="single-major-page__study-content-section-title">专业基础课</Text>
              <View className="single-major-page__study-content-list">
                {parsedData.专业基础课.map((item: string, index: number) => (
                  <View key={index} className="single-major-page__study-content-item">
                    <Text className="single-major-page__study-content-bullet">•</Text>
                    <Text className="single-major-page__study-content-item-text">{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 专业核心课 */}
          {parsedData.专业核心课 && Array.isArray(parsedData.专业核心课) && parsedData.专业核心课.length > 0 && (
            <View className="single-major-page__study-content-section">
              <Text className="single-major-page__study-content-section-title">专业核心课</Text>
              <View className="single-major-page__study-content-list">
                {parsedData.专业核心课.map((item: string, index: number) => (
                  <View key={index} className="single-major-page__study-content-item">
                    <Text className="single-major-page__study-content-bullet">•</Text>
                    <Text className="single-major-page__study-content-item-text">{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 核心实训 */}
          {parsedData.核心实训 && Array.isArray(parsedData.核心实训) && parsedData.核心实训.length > 0 && (
            <View className="single-major-page__study-content-section">
              <Text className="single-major-page__study-content-section-title">核心实训</Text>
              <View className="single-major-page__study-content-list">
                {parsedData.核心实训.map((item: string, index: number) => (
                  <View key={index} className="single-major-page__study-content-item">
                    <Text className="single-major-page__study-content-bullet">•</Text>
                    <Text className="single-major-page__study-content-item-text">{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 一句话总结 */}
          {parsedData.一句话总结 && (
            <View className="single-major-page__study-content-section">
              <Text className="single-major-page__study-content-section-title">一句话总结</Text>
              <Text className="single-major-page__study-content-summary">{parsedData.一句话总结}</Text>
            </View>
          )}
        </View>
        <View 
          className="single-major-page__study-content-toggle"
          onClick={() => setExpanded(!expanded)}
        >
          <Text className="single-major-page__study-content-toggle-text">
            {expanded ? '收起' : '展开'}
          </Text>
          <Text className={`single-major-page__study-content-toggle-icon ${expanded ? 'single-major-page__study-content-toggle-icon--expanded' : ''}`}>
            ▼
          </Text>
        </View>
      </View>
    )
  }

  // 如果是字符串或其他类型，直接显示
  const contentText = typeof parsedData === 'string' ? parsedData : String(parsedData)
  return (
    <View className="single-major-page__study-content">
      <View className={`single-major-page__study-content-text ${expanded ? 'single-major-page__study-content-text--expanded' : ''}`}>
        <Text className="single-major-page__text-content">{contentText}</Text>
      </View>
      <View 
        className="single-major-page__study-content-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <Text className="single-major-page__study-content-toggle-text">
          {expanded ? '收起' : '展开'}
        </Text>
        <Text className={`single-major-page__study-content-toggle-icon ${expanded ? 'single-major-page__study-content-toggle-icon--expanded' : ''}`}>
          ▼
        </Text>
      </View>
    </View>
  )
}

// 值显示组件
function DisplayValue({ value, depth = 0, fieldKey }: { value: any; depth?: number; fieldKey?: string }) {
  if (fieldKey === 'major' && typeof value === 'object') {
    return <MajorScoreDisplay majorData={value} />
  }

  if (fieldKey === 'majorBrief') {
    return <CoreValueDisplay value={value} />
  }

  if (fieldKey === 'majorKey') {
    return <QuickScanDisplay value={value} />
  }

  if (fieldKey === 'studyContent') {
    return <StudyContentDisplay value={value} />
  }

  if (value === null || value === undefined) {
    return (
      <View className="single-major-page__empty-text">
        <Text>无数据</Text>
      </View>
    )
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object') {
        return <DisplayValue value={parsed} depth={depth} />
      }
    } catch {}
    return (
      <Text className="single-major-page__text-content">{value}</Text>
    )
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return <Text className="single-major-page__text-content">{String(value)}</Text>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <View className="single-major-page__empty-text">
          <Text>空列表</Text>
        </View>
      )
    }
    return (
      <View className="single-major-page__list">
        {value.map((item, index) => (
          <View key={index} className="single-major-page__list-item">
            <Text className="single-major-page__list-bullet">•</Text>
            <DisplayValue value={item} depth={depth + 1} />
          </View>
        ))}
      </View>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      return (
        <View className="single-major-page__empty-text">
          <Text>空对象</Text>
        </View>
      )
    }
    return (
      <View className={`single-major-page__object ${depth > 0 ? 'single-major-page__object--nested' : ''}`}>
        {entries.map(([key, val]) => {
          const label = FIELD_LABELS[key] || key.replace(/_/g, ' ')
          return (
            <View key={key} className="single-major-page__object-item">
              <Text className="single-major-page__object-label">{label}</Text>
              <DisplayValue value={val} depth={depth + 1} />
            </View>
          )
        })}
      </View>
    )
  }

  return <Text className="single-major-page__text-content">{String(value)}</Text>
}

export default function SingleMajorPage() {
  const router = useRouter()
  const majorCode = router.params?.code || ''
  // 从路由参数获取专业名称，Taro 会自动解码，但如果还是乱码则手动解码
  let majorName = router.params?.name || ''
  try {
    // 如果参数看起来是编码过的，尝试解码
    if (majorName && (majorName.includes('%') || majorName.includes('+'))) {
      majorName = decodeURIComponent(majorName.replace(/\+/g, ' '))
    }
  } catch (e) {
    // 如果解码失败，使用原始值
    console.warn('解码专业名称失败:', e)
  }
  
  const [loading, setLoading] = useState(true)
  const [majorDetail, setMajorDetail] = useState<MajorDetailInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showQuestionnaire, setShowQuestionnaire] = useState(false)

  // 加载专业详情
  useEffect(() => {
    if (!majorCode) {
      setError('缺少专业代码参数')
      setLoading(false)
      return
    }

    const loadMajorDetail = async () => {
      try {
        setLoading(true)
        setError(null)
        const detail = await getMajorDetailByCode(majorCode)
        // API 返回的字段可能是 analyses，统一转换为 majorElementAnalyses
        if (detail && !detail.majorElementAnalyses && detail.analyses) {
          detail.majorElementAnalyses = detail.analyses
        }
        setMajorDetail(detail)
        
        // 设置页面标题
        if (majorName || detail.code) {
          Taro.setNavigationBarTitle({
            title: majorName || `${detail.code} 专业详情`
          })
        }
      } catch (err: any) {
        console.error('加载专业详情失败:', err)
        setError(err?.message || '加载专业详情失败')
        Taro.showToast({
          title: '加载失败',
          icon: 'none',
          duration: 2000
        })
      } finally {
        setLoading(false)
      }
    }

    loadMajorDetail()
  }, [majorCode])


  if (loading) {
    return (
      <View className="single-major-page">
        <View className="single-major-page__loading">
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  if (error || !majorDetail) {
    return (
      <View className="single-major-page">
        <View className="single-major-page__error">
          <Text className="single-major-page__error-title">加载失败</Text>
          <Text className="single-major-page__error-message">{error || '未找到专业数据'}</Text>
          <Button
            onClick={() => Taro.navigateBack()}
            className="single-major-page__error-button"
          >
            返回
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className="single-major-page">
      <ScrollView className="single-major-page__scroll" scrollY>
        {/* 头部信息卡片 */}
        <Card className="single-major-page__header-card">
          {majorName && (
            <Text className="single-major-page__major-name">{majorName}</Text>
          )}
          <InlineFieldsDisplay data={majorDetail} />
        </Card>

        {/* 快速扫描和核心价值 */}
        <View className="single-major-page__value-cards">
          {majorDetail.majorKey && (
            <QuickScanDisplay value={majorDetail.majorKey} />
          )}
          {majorDetail.majorBrief && (
            <CoreValueDisplay value={majorDetail.majorBrief} />
          )}
        </View>

        {/* 热爱能量分（在核心价值下面） */}
        {majorDetail.major && majorDetail.major.score !== undefined && majorDetail.major.score !== null && (
          <View className="single-major-page__love-energy-wrapper">
            <LoveEnergyScoreDisplay majorData={majorDetail.major} />
          </View>
        )}

        {/* 专业匹配分数 */}
        {majorDetail.major && (
          <View className="single-major-page__score-wrapper">
            <MajorScoreDisplay majorData={majorDetail.major} />
          </View>
        )}

        {/* 喜欢与天赋概览 */}
        {majorDetail.majorElementAnalyses !== undefined && majorDetail.majorElementAnalyses !== null && (
          <View className="single-major-page__analysis-wrapper">
            <MajorAnalysisActionCard
              analyses={Array.isArray(majorDetail.majorElementAnalyses) ? majorDetail.majorElementAnalyses : []}
              onViewDetail={() => {
                setShowDetailModal(true)
              }}
              onRedoQuestionnaire={() => {
                setShowQuestionnaire(true)
              }}
            />
          </View>
        )}

        {/* 其他内容部分 */}
        {SECTION_ORDER.map((key) => {
          const value = majorDetail[key as keyof MajorDetailInfo]
          if (!value) return null

          const label = FIELD_LABELS[key] || key.replace(/_/g, ' ')
          return (
            <Card key={key} className="single-major-page__section-card">
              <View className="single-major-page__section-header">
                <Text className="single-major-page__section-title">{label}</Text>
              </View>
              <View className="single-major-page__section-content">
                <DisplayValue value={value} fieldKey={key} />
              </View>
            </Card>
          )
        })}

        {/* 底部间距 */}
        <View className="single-major-page__footer-spacer" />
      </ScrollView>

      {/* 详情对话框 */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="single-major-page__detail-dialog">
          <DialogHeader>
            <DialogTitle>天赋匹配度详细分析</DialogTitle>
          </DialogHeader>
          {majorDetail?.majorElementAnalyses && (
            <ScrollView className="single-major-page__detail-content" scrollY>
              <MajorElementAnalysesDisplay analyses={majorDetail.majorElementAnalyses} />
            </ScrollView>
          )}
        </DialogContent>
      </Dialog>

      {/* 问卷对话框 */}
      {majorDetail?.majorElementAnalyses && (
        <QuestionnaireModal
          open={showQuestionnaire}
          onOpenChange={setShowQuestionnaire}
          elementIds={majorDetail.majorElementAnalyses
            .map((analysis: any) => analysis?.element?.id)
            .filter((id: any) => id !== undefined && id !== null)}
        />
      )}
    </View>
  )
}

