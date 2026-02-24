// 专业详情页面
import React, { useState, useEffect, useRef } from 'react'
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
import './index.less'

const STORAGE_KEY = 'questionnaire_answers'

// 元素分析类型配置（含注释，同一行显示）
const ELEMENT_ANALYSIS_TYPES = {
  lexue: { label: '乐学', desc: '始终保有学习动力', color: '#4CAF50' },
  shanxue: { label: '善学', desc: '学习更轻松高效', color: '#2196F3' },
  yanxue: { label: '厌学', desc: '学习动力逐步衰减', color: '#FF9800' },
  tiaozhan: { label: '阻学', desc: '学习效率持续损耗', color: '#F44336' },
} as const

// 状态条颜色：乐学/善学 4-6 绿、-4～-6 黄；厌学/阻学 相反
const SCORE_BAR_GREEN = '#4CAF50'
const SCORE_BAR_YELLOW = '#FFC107'

/** 根据类型返回「学习动力」或「学习效率」及是否为正向维度（乐学/善学为正，厌学/阻学为反） */
function getScoreBarConfig(type: string | null): { label: string; isPositive: boolean } {
  if (type === 'lexue' || type === 'yanxue') return { label: '学习动力', isPositive: type === 'lexue' }
  if (type === 'shanxue' || type === 'tiaozhan') return { label: '学习效率', isPositive: type === 'shanxue' }
  return { label: '学习动力', isPositive: true }
}

// 字段标签映射
const FIELD_LABELS: Record<string, string> = {
  educationLevel: '学历',
  studyPeriod: '学制',
  awardedDegree: '学位',
  majorBrief: '核心价值',
  majorKey: '快速扫描',
  studyContent: '学习内容',
}

const INLINE_FIELDS = ['educationLevel', 'studyPeriod', 'awardedDegree']
const SECTION_ORDER = ['studyContent']

// 学历转换映射
const EDUCATION_LEVEL_MAP: Record<string, string> = {
  'ben': '本科',
  'gao_ben': '本科(职业)',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, elementIds])

  const loadQuestions = async () => {
    setIsLoading(true)
    try {
      // 通过 API 获取所有相关元素的题目
      // 由于 API 是按单个 elementId 获取，我们需要合并多个 elementId 的结果
      const allScales: any[] = []
      for (const elementId of elementIds) {
        try {
          const response = await getScalesByElementId(elementId)
          if (response && response.scales) {
            // 只获取 direction 为 '168' 的题目
            const filtered = response.scales.filter((scale: any) => scale.direction === '168')
            allScales.push(...filtered)
          }
        } catch (error) {
          console.error(`获取 elementId ${elementId} 的题目失败:`, error)
        }
      }
      
      // 去重（按 id）
      const uniqueScales = allScales.filter((scale, index, self) => 
        index === self.findIndex((s) => s.id === scale.id)
      )
      
      setQuestions(uniqueScales)
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

// 元素分析显示组件（与热门专业页面一致）
function ElementAnalysesDisplay({ 
  analyses, 
  majorName,
  onToggleType,
  expandedType
}: { 
  analyses: any[] | null | undefined
  majorName: string
  onToggleType: (type: string, analyses: any[], majorName: string) => void
  expandedType: string | null
}) {
  if (!analyses || analyses.length === 0) {
    return null
  }

  // 按类型统计元素数量
  // 兼容两种数据结构：
  // 1. 热门专业格式：analysis.elements (数组)
  // 2. 专业详情格式：analysis.element (单个对象)
  const typeCounts = analyses.reduce((acc, analysis) => {
    const type = analysis.type
    if (type && (type === 'lexue' || type === 'shanxue' || type === 'yanxue' || type === 'tiaozhan')) {
      // 优先使用 elements 数组，如果没有则检查是否有单个 element
      if (analysis.elements && Array.isArray(analysis.elements)) {
        acc[type] = analysis.elements.length
      } else if (analysis.element) {
        // 单个 element 算作 1 个元素
        acc[type] = (acc[type] || 0) + 1
      } else {
        acc[type] = 0
      }
    }
    return acc
  }, {} as Record<string, number>)

  const handleClick = (type: string, e?: any) => {
    if (e) {
      e.stopPropagation()
    }
    onToggleType(type, analyses, majorName)
  }

  return (
    <View className="single-major-page__element-analysis-types">
      {Object.entries(ELEMENT_ANALYSIS_TYPES).map(([type, config]) => {
        const count = typeCounts[type] || 0
        
        return (
          <View
            key={type}
            className={`single-major-page__element-analysis-item ${expandedType === type ? 'single-major-page__element-analysis-item--active' : ''}`}
            onClick={(e) => handleClick(type, e)}
          >
            <View className="single-major-page__element-analysis-info">
              <Text className="single-major-page__element-analysis-label">
                {config.label}
              </Text>
              <Text className="single-major-page__element-analysis-count">
                {count}项
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

// 喜欢与天赋概览组件
function MajorAnalysisActionCard({ analyses, onViewDetail, onRedoQuestionnaire, majorName }: any) {
  const { positiveCount, negativeCount } = getAnalysisCounts(analyses)
  const totalCount = positiveCount + negativeCount
  const [expandedElementType, setExpandedElementType] = useState<string | null>(null)
  const [expandedElementMajorName, setExpandedElementMajorName] = useState<string>('')
  const [expandedElementAnalyses, setExpandedElementAnalyses] = useState<any[] | null>(null)
  const hasAutoExpandedRef = useRef(false)
  const [expandedQuestionnaireElementIds, setExpandedQuestionnaireElementIds] = useState<Set<number>>(
    new Set(),
  )
  const [questionnaireLoadingElementIds, setQuestionnaireLoadingElementIds] = useState<Set<number>>(
    new Set(),
  )
  const [questionnaireErrorByElementId, setQuestionnaireErrorByElementId] = useState<Record<number, string>>(
    {},
  )
  const [questionnaireCacheByElementId, setQuestionnaireCacheByElementId] = useState<
    Record<number, { scales: Scale[]; answers: ScaleAnswer[] }>
  >({})

  /**
   * 兼容两种数据结构，提取当前类型下的元素列表
   */
  const getElementsByType = (type: string | null, allAnalyses: any[] | null): any[] => {
    if (!type || !allAnalyses) return []
    const elements: any[] = []
    const matchingAnalyses = allAnalyses.filter((a) => a.type === type)
    matchingAnalyses.forEach((analysis) => {
      // 热门专业格式：analysis.elements (数组)
      if (analysis.elements && Array.isArray(analysis.elements)) {
        elements.push(
          ...analysis.elements.map((el: any) => ({
            elementName: el?.elementName || el?.name || el?.element?.name || '未命名',
            elementId: el?.elementId ?? el?.id ?? el?.element?.id ?? null,
            score: el?.score ?? null,
            // 兼容不同字段命名；如果元素自身没有原因，则回退到分析项上的原因
            matchReason: el?.matchReason ?? el?.match_reason ?? analysis.matchReason ?? null,
            // 转化潜力（主要用于厌学/阻学）
            potentialConversionValue:
              el?.potentialConversionValue ?? analysis?.potentialConversionValue ?? null,
            potentialConversionReason:
              el?.potentialConversionReason ?? analysis?.potentialConversionReason ?? null,
          })),
        )
      }
      // 专业详情格式：analysis.element (单个对象)
      else if (analysis.element) {
        elements.push({
          elementName: analysis.element.name || '未命名',
          elementId: analysis.element.id ?? null,
          score: analysis.userElementScore ?? null,
          matchReason: analysis.matchReason ?? null,
          // 转化潜力（主要用于厌学/阻学）
          potentialConversionValue: analysis?.potentialConversionValue ?? null,
          potentialConversionReason: analysis?.potentialConversionReason ?? null,
        })
      }
    })
    return elements
  }

  /**
   * 转化潜力等级映射
   * - high -> 高
   * - medium -> 中
   * - low -> 低
   */
  const getPotentialConversionLabel = (value: any): { level: 'high' | 'medium' | 'low' | 'unknown'; text: string } => {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (raw === 'high') return { level: 'high', text: '高' }
    if (raw === 'medium') return { level: 'medium', text: '中' }
    if (raw === 'low') return { level: 'low', text: '低' }
    if (value === null || value === undefined || raw === '') return { level: 'unknown', text: '' }
    return { level: 'unknown', text: String(value) }
  }

  const handleToggleType = (type: string, allAnalyses: any[], mName: string) => {
    // 用户已交互：不再触发默认展开逻辑
    hasAutoExpandedRef.current = true
    setExpandedElementAnalyses(allAnalyses)
    setExpandedElementMajorName(mName)
    setExpandedElementType((prev) => (prev === type ? null : type))
  }

  const inlineElements = getElementsByType(expandedElementType, expandedElementAnalyses)

  // 默认展开“乐学”，若无数据则按顺序降级
  useEffect(() => {
    if (!analyses || !Array.isArray(analyses) || analyses.length === 0) return
    if (hasAutoExpandedRef.current) return

    const preferredTypes = ['lexue', 'shanxue', 'yanxue', 'tiaozhan']
    const firstAvailable = preferredTypes.find((t) => getElementsByType(t, analyses).length > 0) || 'lexue'

    hasAutoExpandedRef.current = true
    setExpandedElementAnalyses(analyses)
    setExpandedElementMajorName(majorName || '')
    setExpandedElementType(firstAvailable)
  }, [analyses, majorName])
  const reasonKind = expandedElementType === 'yanxue'
    ? 'yanxue'
    : expandedElementType === 'tiaozhan'
      ? 'tiaozhan'
      : 'match'
  const reasonLabel = reasonKind === 'yanxue'
    ? '厌学原因'
    : reasonKind === 'tiaozhan'
      ? '阻学原因'
      : '匹配原因'

  /**
   * 获取 element 的问卷与答案（带缓存）
   */
  const fetchElementQuestionnaire = async (elementId: number) => {
    try {
      setQuestionnaireErrorByElementId((prev) => {
        const next = { ...prev }
        delete next[elementId]
        return next
      })
      setQuestionnaireLoadingElementIds((prev) => {
        const next = new Set(prev)
        next.add(elementId)
        return next
      })
      const res = await getScalesByElementId(elementId)
      setQuestionnaireCacheByElementId((prev) => ({
        ...prev,
        [elementId]: {
          scales: Array.isArray(res?.scales) ? res.scales : [],
          answers: Array.isArray(res?.answers) ? res.answers : [],
        },
      }))
    } catch (e: any) {
      setQuestionnaireErrorByElementId((prev) => ({
        ...prev,
        [elementId]: e?.message || '获取问卷失败，请稍后重试',
      }))
    } finally {
      setQuestionnaireLoadingElementIds((prev) => {
        const next = new Set(prev)
        next.delete(elementId)
        return next
      })
    }
  }

  /**
   * 切换 element 问卷展示
   */
  const toggleElementQuestionnaire = async (elementId: number) => {
    setExpandedQuestionnaireElementIds((prev) => {
      const next = new Set(prev)
      if (next.has(elementId)) {
        next.delete(elementId)
      } else {
        next.add(elementId)
      }
      return next
    })

    // 首次展开且无缓存时拉取
    if (!questionnaireCacheByElementId[elementId] && !questionnaireLoadingElementIds.has(elementId)) {
      await fetchElementQuestionnaire(elementId)
    }
  }

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
        <ElementAnalysesDisplay
          analyses={analyses}
          majorName={majorName || ''}
          onToggleType={handleToggleType}
          expandedType={expandedElementType}
        />

        {/* 点击后不再弹框：直接在下方展开/收起 */}
        {expandedElementType && (
          <View className="single-major-page__element-inline">
            <View className="single-major-page__element-inline-header">
              <Text className="single-major-page__element-inline-title">
                {(() => {
                  const key = expandedElementType as keyof typeof ELEMENT_ANALYSIS_TYPES
                  const config = ELEMENT_ANALYSIS_TYPES[key]
                  if (!config) return expandedElementMajorName
                  const label = config.label
                  const desc = 'desc' in config ? config.desc : undefined
                  if (!desc) return `${label} - ${expandedElementMajorName}`
                  return (
                    <>
                      {label}{' '}
                      <Text className="single-major-page__element-inline-title-desc">
                        （{desc}）
                      </Text>
                      {' - '}{expandedElementMajorName}
                    </>
                  )
                })()}
              </Text>
              <Text
                className="single-major-page__element-inline-toggle"
                onClick={(e) => {
                  e?.stopPropagation?.()
                  // 用户已交互：不再触发默认展开逻辑
                  hasAutoExpandedRef.current = true
                  setExpandedElementType(null)
                }}
              >
                ▲
              </Text>
            </View>

            {inlineElements.length === 0 ? (
              <View className="single-major-page__element-dialog-empty">
                <Text>暂无数据</Text>
              </View>
            ) : (
              <View className="single-major-page__element-dialog-list">
                {inlineElements.map((element: any, index: number) => {
                  const elementId: number | null = typeof element.elementId === 'number' ? element.elementId : null
                  const { label: scoreBarLabel, isPositive: scoreBarPositive } = getScoreBarConfig(expandedElementType)
                  const numScore = element.score != null ? Math.max(-6, Math.min(6, Number(element.score))) : null
                  const rawPercent = numScore != null ? ((numScore + 6) / 12) * 100 : null
                  const markerPercent = rawPercent != null
                    ? (scoreBarPositive ? rawPercent : 100 - rawPercent)
                    : null
                  const barGradient = scoreBarPositive
                    ? `linear-gradient(to right, ${SCORE_BAR_YELLOW} 0%, ${SCORE_BAR_YELLOW} 16.67%, ${SCORE_BAR_GREEN} 83.33%, ${SCORE_BAR_GREEN} 100%)`
                    : `linear-gradient(to right, ${SCORE_BAR_GREEN} 0%, ${SCORE_BAR_GREEN} 16.67%, ${SCORE_BAR_YELLOW} 83.33%, ${SCORE_BAR_YELLOW} 100%)`
                  const isQuestionnaireExpanded =
                    elementId !== null && expandedQuestionnaireElementIds.has(elementId)
                  const isQuestionnaireLoading =
                    elementId !== null && questionnaireLoadingElementIds.has(elementId)
                  const questionnaireError = elementId !== null ? questionnaireErrorByElementId[elementId] : undefined
                  const questionnaireData = elementId !== null ? questionnaireCacheByElementId[elementId] : undefined

                  // answers.score 对应 options.optionValue，通过 scaleId 对应题目
                  const answerByScaleId = new Map<number, number>()
                  if (questionnaireData?.answers && Array.isArray(questionnaireData.answers)) {
                    questionnaireData.answers.forEach((a) => {
                      if (typeof a?.scaleId === 'number' && typeof a?.score === 'number') {
                        answerByScaleId.set(a.scaleId, a.score)
                      }
                    })
                  }

                  return (
                    <View
                      key={elementId !== null ? `element-${elementId}` : `element-${element.elementName || index}`}
                      className="single-major-page__element-dialog-item"
                    >
                      <Text className="single-major-page__element-dialog-item-name">
                        {element.elementName}
                      </Text>
                      {element.matchReason && (
                        <Text className="single-major-page__element-dialog-item-reason">
                          <Text
                            className={`single-major-page__element-dialog-item-reason-label single-major-page__element-dialog-item-reason-label--${reasonKind}`}
                          >
                            {reasonLabel}：
                          </Text>
                          {element.matchReason}
                        </Text>
                      )}
                      <View className="single-major-page__element-dialog-item-score single-major-page__score-result-row">
                        <View className="single-major-page__score-result-label-wrap">
                          <Text className="single-major-page__element-dialog-item-score-label">自评结果：</Text>
                        </View>
                        <View className="single-major-page__score-bar-wrap">
                          <View className="single-major-page__score-bar-inner">
                            <View className="single-major-page__score-bar-row">
                              <Text className="single-major-page__score-bar-end">
                                减弱
                              </Text>
                              <View className="single-major-page__score-bar-track-wrap">
                                {markerPercent != null && (
                                  <View className="single-major-page__score-bar-marker-col" style={{ left: `${markerPercent}%` }}>
                                    <Text className="single-major-page__score-bar-label">{scoreBarLabel}</Text>
                                    <Text className="single-major-page__score-bar-arrow">▼</Text>
                                  </View>
                                )}
                                <View className="single-major-page__score-bar-track">
                                  <View
                                    className="single-major-page__score-bar-fill"
                                    style={{ background: numScore == null ? '#d1d5db' : barGradient }}
                                  />
                                </View>
                              </View>
                              <Text className="single-major-page__score-bar-end">
                                增强
                              </Text>
                            </View>
                          </View>
                          {numScore == null && (
                            <Text className="single-major-page__score-bar-placeholder">待评估</Text>
                          )}
                        </View>
                        {elementId !== null && (
                          <View className="single-major-page__score-result-action-wrap">
                            <Text
                              className="single-major-page__element-dialog-item-score-action"
                              onClick={() => toggleElementQuestionnaire(elementId)}
                            >
                              查看问卷
                              <Text className="single-major-page__element-dialog-item-score-action-icon">
                                {isQuestionnaireExpanded ? '▲' : '▼'}
                              </Text>
                            </Text>
                          </View>
                        )}
                      </View>

                      {(() => {
                        // 仅在“厌学/阻学”元素下展示转化潜力（放在“评估结果”下面）
                        const shouldShowConversion = reasonKind === 'yanxue' || reasonKind === 'tiaozhan'
                        if (!shouldShowConversion) return null
                        const { level, text } = getPotentialConversionLabel(element?.potentialConversionValue)
                        const reasonText = element?.potentialConversionReason ? String(element.potentialConversionReason) : ''
                        if (!text && !reasonText) return null

                        return (
                          <View className="single-major-page__element-dialog-item-conversion">
                            {text && (
                              <View className="single-major-page__element-dialog-item-conversion-row">
                                <Text className="single-major-page__element-dialog-item-conversion-label">
                                  转化潜力：
                                </Text>
                                <Text
                                  className={`single-major-page__element-dialog-item-conversion-tag single-major-page__element-dialog-item-conversion-tag--${level}`}
                                >
                                  {text}
                                </Text>
                              </View>
                            )}
                            {reasonText && (
                              <Text className="single-major-page__element-dialog-item-conversion-reason">
                                {reasonText}
                              </Text>
                            )}
                          </View>
                        )
                      })()}

                      {elementId !== null && isQuestionnaireExpanded && (
                        <View className="single-major-page__element-questionnaire">
                          {isQuestionnaireLoading && (
                            <Text className="single-major-page__element-questionnaire-loading">加载中...</Text>
                          )}
                          {!isQuestionnaireLoading && questionnaireError && (
                            <View className="single-major-page__element-questionnaire-error">
                              <Text className="single-major-page__element-questionnaire-error-text">
                                {questionnaireError}
                              </Text>
                              <Text
                                className="single-major-page__element-questionnaire-retry"
                                onClick={() => fetchElementQuestionnaire(elementId)}
                              >
                                点击重试
                              </Text>
                            </View>
                          )}
                          {!isQuestionnaireLoading && !questionnaireError && questionnaireData && (
                            <View className="single-major-page__element-questionnaire-content">
                              {questionnaireData.scales.length === 0 ? (
                                <Text className="single-major-page__element-questionnaire-empty">暂无问卷内容</Text>
                              ) : (
                                questionnaireData.scales.map((scale, scaleIndex) => {
                                  const selectedScore = answerByScaleId.get(scale.id)
                                  const options = Array.isArray(scale.options) ? [...scale.options] : []
                                  options.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                                  return (
                                    <View key={scale.id} className="single-major-page__element-questionnaire-scale">
                                      <Text className="single-major-page__element-questionnaire-scale-content">
                                        {scaleIndex + 1}. {scale.content}
                                      </Text>
                                      <View className="single-major-page__element-questionnaire-options">
                                        {options.map((opt) => {
                                          const isSelected =
                                            typeof selectedScore === 'number' &&
                                            typeof opt.optionValue === 'number' &&
                                            opt.optionValue === selectedScore
                                          return (
                                            <View
                                              key={opt.id}
                                              className={`single-major-page__element-questionnaire-option ${isSelected ? 'single-major-page__element-questionnaire-option--selected' : ''}`}
                                            >
                                              <View className="single-major-page__element-questionnaire-option-header">
                                                <Text className="single-major-page__element-questionnaire-option-name">
                                                  {opt.optionName}
                                                </Text>
                                                {isSelected && (
                                                  <Text className="single-major-page__element-questionnaire-option-badge">
                                                    你的选择
                                                  </Text>
                                                )}
                                              </View>
                                              {opt.additionalInfo && String(opt.additionalInfo).trim() && (
                                                <Text className="single-major-page__element-questionnaire-option-info">
                                                  {opt.additionalInfo}
                                                </Text>
                                              )}
                                            </View>
                                          )
                                        })}
                                      </View>
                                    </View>
                                  )
                                })
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}
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
          <ScrollView
            className="single-major-page__score-detail-scroll"
            scrollX
            showScrollbar={false}
          >
            <View className="single-major-page__score-detail-tags">
              {[
                majorData.lexueScore !== undefined
                  ? {
                      label: '乐学',
                      sign: '+',
                      value: majorData.lexueScore,
                      type: 'positive',
                    }
                  : null,
                majorData.shanxueScore !== undefined
                  ? {
                      label: '善学',
                      sign: '+',
                      value: majorData.shanxueScore,
                      type: 'positive',
                    }
                  : null,
                majorData.yanxueDeduction !== undefined
                  ? {
                      label: '厌学',
                      sign: '-',
                      value: majorData.yanxueDeduction,
                      type: 'negative',
                    }
                  : null,
                majorData.tiaozhanDeduction !== undefined
                  ? {
                      label: '阻学',
                      sign: '-',
                      value: majorData.tiaozhanDeduction,
                      type: 'negative',
                    }
                  : null,
              ]
                .filter(Boolean)
                .map((item: any) => (
                  <View
                    key={item.label}
                    className={`single-major-page__score-detail-tag single-major-page__score-detail-tag--${item.type}`}
                  >
                    <Text className="single-major-page__score-detail-tag-label">{item.label}</Text>
                    <Text className="single-major-page__score-detail-tag-value">
                      {item.sign}
                      {typeof item.value === 'string' ? parseFloat(item.value).toFixed(2) : item.value.toFixed(2)}
                    </Text>
                  </View>
                ))}
            </View>
          </ScrollView>
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
  /** 专业探索前五条带入的 sign，未缴费时必传才能访问详情 */
  const signParam = router.params?.sign || ''
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
  // 元素分析对话框状态
  // 元素分析点击后改为页面内展开显示，不再使用弹框

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
        const detail = await getMajorDetailByCode(majorCode, signParam || undefined)
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
  }, [majorCode, signParam])


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
              majorName={majorName}
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

