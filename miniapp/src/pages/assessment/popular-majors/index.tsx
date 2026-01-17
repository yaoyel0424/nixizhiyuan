// 热门专业评估页面
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Progress } from '@/components/ui/Progress'
import { QuestionnaireRequiredModal } from '@/components/QuestionnaireRequiredModal'
import { useQuestionnaireCheck } from '@/hooks/useQuestionnaireCheck'
import { getPopularMajors, createOrUpdatePopularMajorAnswer } from '@/services/popular-majors'
import { getScalesByPopularMajorId } from '@/services/scales'
import { PopularMajorResponse, Scale, MajorElementAnalysis } from '@/types/api'
import questionnaireData from '@/data/questionnaire.json'
import './index.less'

// 适配后的专业接口，兼容原有代码
interface Major {
  id: string | number
  name: string
  code: string
  degree: string | null
  limit_year: string | null
  boy_rate?: string
  girl_rate?: string
  salaryavg?: string | null
  fivesalaryavg?: number
  majorBrief?: string | null
  // 从接口返回的测评进度和分数
  progress?: {
    completedCount: number
    totalCount: number
    isCompleted: boolean
  }
  score?: {
    score: number
    lexueScore: number
    shanxueScore: number
    yanxueDeduction: number
    tiaozhanDeduction: number
  } | null
  // 元素分析数据
  elementAnalyses?: MajorElementAnalysis[] | null
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

// 将 Scale 转换为 Question 格式
const scaleToQuestion = (scale: Scale): Question => {
  return {
    id: scale.id,
    content: scale.content,
    elementId: scale.elementId,
    type: scale.type,
    dimension: scale.dimension,
    options: (scale.options || []).map(option => ({
      id: option.id,
      optionName: option.optionName,
      optionValue: option.optionValue,
    })),
  }
}

const STORAGE_KEY = 'popularMajorsResults'

// 元素分析类型配置
const ELEMENT_ANALYSIS_TYPES = {
  lexue: { label: '乐学元素', color: '#4CAF50' },
  shanxue: { label: '善学元素', color: '#2196F3' },
  yanxue: { label: '厌学元素', color: '#FF9800' },
  tiaozhan: { label: '阻学元素', color: '#F44336' },
} as const

// 元素分析显示组件（简化版，对话框在父组件中管理）
function ElementAnalysesDisplay({ 
  analyses, 
  majorName,
  onTypeClick
}: { 
  analyses: MajorElementAnalysis[] | null | undefined
  majorName: string
  onTypeClick: (type: string, analyses: MajorElementAnalysis[], majorName: string) => void
}) {
  if (!analyses || analyses.length === 0) {
    return null
  }

  // 按类型统计元素数量
  const typeCounts = analyses.reduce((acc, analysis) => {
    const type = analysis.type
    if (type && (type === 'lexue' || type === 'shanxue' || type === 'yanxue' || type === 'tiaozhan')) {
      acc[type] = (analysis.elements?.length || 0)
    }
    return acc
  }, {} as Record<string, number>)

  const handleClick = (type: string, e?: any) => {
    if (e) {
      e.stopPropagation()
    }
    onTypeClick(type, analyses, majorName)
  }

  return (
    <View className="popular-majors-page__element-analyses">
      {Object.entries(ELEMENT_ANALYSIS_TYPES).map(([type, config]) => {
        const count = typeCounts[type] || 0
        
        return (
          <View
            key={type}
            className="popular-majors-page__element-analysis-item"
            onClick={(e) => handleClick(type, e)}
          >
            <View className="popular-majors-page__element-analysis-info">
              <Text className="popular-majors-page__element-analysis-label">
                {config.label}
              </Text>
              <Text className="popular-majors-page__element-analysis-count">
                {count}项
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

// 判断专业是理科还是文科
// 理科：07 理学、08 工学、09 农学、10 医学
// 文科：01 哲学、02 经济学、03 法学、04 教育学、05 文学、06 历史学、12 管理学、13 艺术学
const isScienceMajor = (code: string): boolean => {
  const prefix = code.substring(0, 2)
  const sciencePrefixes = ['07', '08', '09', '10']
  return sciencePrefixes.includes(prefix)
}

export default function PopularMajorsPage() {
  // 检查问卷完成状态
  const { isCompleted: isQuestionnaireCompleted, isLoading: isCheckingQuestionnaire, answerCount } = useQuestionnaireCheck()
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  
  const [majors, setMajors] = useState<Major[]>([])
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
  // 学科过滤：all-全部, science-理科, liberal-文科
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'science' | 'liberal'>('all')
  // 元素分析对话框状态
  const [showElementDialog, setShowElementDialog] = useState(false)
  const [selectedElementType, setSelectedElementType] = useState<string | null>(null)
  const [selectedElementMajorName, setSelectedElementMajorName] = useState<string>('')
  const [selectedElementAnalyses, setSelectedElementAnalyses] = useState<MajorElementAnalysis[] | null>(null)

  // 检查问卷完成状态
  useEffect(() => {
    if (!isCheckingQuestionnaire && !isQuestionnaireCompleted) {
      setShowQuestionnaireModal(true)
    }
  }, [isCheckingQuestionnaire, isQuestionnaireCompleted])

  // 将 API 响应数据转换为页面使用的格式
  const transformMajorData = (apiData: PopularMajorResponse): Major => {
    return {
      id: String(apiData.id),
      name: apiData.name || '',
      code: apiData.code || apiData.majorDetail?.code || '',
      degree: apiData.degree || apiData.majorDetail?.awardedDegree || null,
      limit_year: apiData.limitYear || apiData.majorDetail?.studyPeriod || null,
      salaryavg: apiData.averageSalary || null,
      fivesalaryavg: 0, // API 中暂无此字段
      majorBrief: apiData.majorDetail?.majorBrief || null,
      // 保留接口返回的测评进度和分数数据
      progress: apiData.progress,
      score: apiData.score,
      // 元素分析数据（在根级别，不在 majorDetail 中）
      elementAnalyses: apiData.elementAnalyses || null,
    }
  }

  // 加载热门专业数据（一次性加载所有数据）
  const loadMajors = useCallback(async (
    category?: 'ben' | 'gz_ben' | 'zhuan'
  ) => {
    try {
      setLoading(true)
      
      // 使用传入的参数或当前状态
      const currentCategory = category ?? selectedCategory
      
      // 映射分类到 API 的 level1 参数
      const level1Map: Record<string, string> = {
        'ben': 'ben',
        'gz_ben': 'gao_ben',
        'zhuan': 'zhuan',
      }
      
      // 一次性加载所有数据，设置 limit 为 100（足够覆盖30条左右的数据）
      const params: any = {
        limit: 100,
        level1: level1Map[currentCategory],
      }

      const response = await getPopularMajors(params)
      
      if (response && response.items) {
        const transformedMajors = response.items.map(transformMajorData)
        setMajors(transformedMajors)
      } else {
        setMajors([])
      }
    } catch (error) {
      console.error('加载热门专业数据失败:', error)
      Taro.showToast({
        title: '加载数据失败',
        icon: 'none'
      })
      setMajors([])
    } finally {
      setLoading(false)
    }
  }, [selectedCategory])

  // 当分类改变时，重新加载数据
  useEffect(() => {
    loadMajors(selectedCategory)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory])

  // 从本地存储加载已保存的测评结果
  useEffect(() => {
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
    { key: 'gz_ben' as const, label: '本科(职业)' },
    { key: 'zhuan' as const, label: '专科' },
  ]

  // 过滤专业列表：根据学科类型过滤（搜索已通过 API 实现）
  const filteredMajors = useMemo(() => {
    let filtered = majors

    // 学科类型过滤（前端过滤，因为 API 不支持此筛选）
    if (subjectFilter !== 'all') {
      filtered = filtered.filter(major => {
        const isScience = isScienceMajor(major.code)
        return subjectFilter === 'science' ? isScience : !isScience
      })
    }

    return filtered
  }, [majors, subjectFilter])


  // 随机选择8道题目（从本地问卷数据）
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

  // 通过热门专业ID获取量表和答案
  const loadScalesByPopularMajorId = async (popularMajorId: number, restoreAnswers: boolean = true) => {
    try {
      // 直接通过热门专业ID获取量表和答案
      const scalesResponse = await getScalesByPopularMajorId(popularMajorId)
      
      if (!scalesResponse || !scalesResponse.scales || scalesResponse.scales.length === 0) {
        throw new Error('该专业暂无测评题目')
      }

      // 将 Scale 转换为 Question 格式
      const questions = scalesResponse.scales.map(scaleToQuestion)

      // 如果有已保存的答案且需要恢复，恢复答案状态
      // 根据提交逻辑反向推理：提交时 score = answers[question.id] = optionValue
      // 所以恢复时：answers[scaleId] = answer.score（score 就是 optionValue）
      const savedAnswers: Record<number, number> = {}
      if (restoreAnswers && scalesResponse.answers && scalesResponse.answers.length > 0) {
        scalesResponse.answers.forEach(answer => {
          // 直接按照提交逻辑反向恢复：score 就是 optionValue
          // 提交时：score = answers[question.id]，所以恢复时：answers[answer.scaleId] = answer.score
          // 注意：answer.score 可能是字符串，需要转换为数字以匹配 optionValue 的类型
          const scoreValue = typeof answer.score === 'string' ? parseFloat(answer.score) : Number(answer.score)
          if (!isNaN(scoreValue)) {
            savedAnswers[answer.scaleId] = scoreValue
          }
        })
        console.log('恢复答案完成，答案数量:', scalesResponse.answers.length, '恢复后的答案对象:', savedAnswers)
      }

      setQuestions(questions)
      setAnswers(savedAnswers)
      setCurrentQuestionIndex(0)
      setIsCompleted(false)
      setLoveEnergy(null)
      
      // 调试信息：确认答案恢复状态
      if (Object.keys(savedAnswers).length > 0) {
        console.log('答案恢复完成，已恢复的题目ID和答案值:', savedAnswers)
        console.log('题目列表ID:', questions.map(q => q.id))
        // 验证答案值类型
        Object.entries(savedAnswers).forEach(([questionId, answerValue]) => {
          const question = questions.find(q => q.id === Number(questionId))
          if (question) {
            const optionValues = question.options.map(opt => opt.optionValue)
            console.log(`题目 ${questionId}: 答案值=${answerValue} (类型: ${typeof answerValue}), 选项值=${optionValues.join(',')} (类型: ${typeof optionValues[0]})`)
          }
        })
      }
    } catch (error: any) {
      console.error('加载量表和答案失败:', error)
      Taro.showToast({
        title: error?.message || '加载测评题目失败',
        icon: 'none',
        duration: 2000
      })
      setQuestions([])
    }
  }

  // 处理开始测评
  const handleStartAssessment = async (major: Major) => {
    setSelectedMajor(major)
    setShowQuestionnaire(true)
    
    // 通过热门专业ID获取量表和答案
    const popularMajorId = Number(major.id)
    if (isNaN(popularMajorId)) {
      Taro.showToast({
        title: '无法获取热门专业ID',
        icon: 'none'
      })
      return
    }
    await loadScalesByPopularMajorId(popularMajorId)
  }

  // 处理答题（每答完一题立即同步到数据库）
  const handleAnswer = async (questionId: number, optionValue: number) => {
    // 确保 optionValue 是数字类型
    const answerValue = typeof optionValue === 'string' ? parseFloat(optionValue) : Number(optionValue)
    if (!isNaN(answerValue)) {
      // 更新本地答案状态
      setAnswers((prev) => ({ ...prev, [questionId]: answerValue }))
      
      // 立即提交到数据库
      if (selectedMajor) {
        const popularMajorId = Number(selectedMajor.id)
        if (!isNaN(popularMajorId)) {
          try {
            await createOrUpdatePopularMajorAnswer({
              popularMajorId,
              scaleId: questionId,
              score: answerValue,
            })
            // 静默提交，不显示提示，避免影响用户体验
          } catch (error) {
            console.error(`提交题目 ${questionId} 的答案失败:`, error)
            // 提交失败时，可以选择显示提示或静默处理
            // 这里选择静默处理，避免打断用户答题流程
          }
        }
      }
    }
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
  const handleComplete = async () => {
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

      // 答案已经在每答一题时同步到数据库，这里只需要刷新列表数据
      // 刷新数据以获取最新的 progress 和 score
      try {
        loadMajors(selectedCategory)
      } catch (error) {
        console.error('刷新列表数据失败:', error)
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
  const handleRetake = async () => {
    if (selectedMajor) {
      // 重新加载量表和答案（不恢复已保存的答案，清空重新开始）
      const popularMajorId = Number(selectedMajor.id)
      if (isNaN(popularMajorId)) {
        Taro.showToast({
          title: '无法获取热门专业ID',
          icon: 'none'
        })
        return
      }
      await loadScalesByPopularMajorId(popularMajorId, false)
    } else {
      // 如果没有选中的专业，使用本地问卷数据
      loadRandomQuestions()
    }
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
            {filteredMajors.map((major, index) => {
              // 使用接口返回的数据判断是否完成测评
              const isCompleted = major.progress?.isCompleted === true
              // 使用接口返回的分数数据
              const score = major.score?.score
              // 兼容本地存储的数据（作为后备方案）
              const hasLocalResult = majorResults[major.code] !== undefined
              const localResultEnergy = majorResults[major.code]
              
              // 判断是否应该显示元素分析：只有测评完成或者有得分（>0）时才显示
              const shouldShowElementAnalyses = isCompleted || (score !== undefined && score !== null && Number(score) > 0)
              // 获取测评进度（确保转换为数字类型）
              const completedCount = major.progress?.completedCount 
                ? (typeof major.progress.completedCount === 'string' 
                    ? parseInt(major.progress.completedCount, 10) 
                    : Number(major.progress.completedCount))
                : 0
              const totalCount = major.progress?.totalCount
                ? (typeof major.progress.totalCount === 'string'
                    ? parseInt(major.progress.totalCount, 10)
                    : Number(major.progress.totalCount))
                : 0
              const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
              const hasProgress = completedCount > 0 && totalCount > 0
              

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
                      </View>
                    </View>
                    <View className="popular-majors-page__major-actions">
                      {isCompleted || hasLocalResult ? (
                        <View className="popular-majors-page__major-actions-row">
                          {/* 显示测评结果：优先使用接口返回的分数，否则使用本地存储的数据 */}
                          {isCompleted && (score !== undefined && score !== null) ? (
                            <View className="popular-majors-page__major-result">
                              <Text className="popular-majors-page__major-result-icon">⚡</Text>
                              <Text className="popular-majors-page__major-result-value">
                                {Number(score).toFixed(2)}
                              </Text>
                            </View>
                          ) : hasLocalResult ? (
                            <View className="popular-majors-page__major-result">
                              <Text className="popular-majors-page__major-result-icon">⚡</Text>
                              <Text className="popular-majors-page__major-result-value">
                                {localResultEnergy.toFixed(2)}
                              </Text>
                            </View>
                          ) : null}
                          <Button
                            size="sm"
                            className="popular-majors-page__major-button popular-majors-page__major-button--retake"
                            onClick={() => handleStartAssessment(major)}
                          >
                            🔄 重测
                          </Button>
                        </View>
                      ) : (
                        <Button
                          size="sm"
                          className="popular-majors-page__major-button"
                          onClick={() => handleStartAssessment(major)}
                        >
                          测评
                        </Button>
                      )}
                      {/* 显示测评进度：未完成且进度不为0才显示 */}
                      {!isCompleted && hasProgress && (
                        <View className="popular-majors-page__major-progress">
                          <View className="popular-majors-page__major-progress-info">
                            <Text className="popular-majors-page__major-progress-text">
                              {completedCount}/{totalCount}
                            </Text>
                          </View>
                          <Progress 
                            value={progressPercent} 
                            max={100}
                            className="popular-majors-page__major-progress-bar"
                          />
                        </View>
                      )}
                    </View>
                  </View>
                  {/* 元素分析显示：所有专业都显示 */}
                  {major.elementAnalyses && major.elementAnalyses.length > 0 && (
                    <View 
                      className="popular-majors-page__major-element-analyses-wrapper"
                      onClick={(e) => {
                        // 阻止事件冒泡到 Card
                        e.stopPropagation()
                      }}
                    >
                      <ElementAnalysesDisplay 
                        analyses={major.elementAnalyses} 
                        majorName={major.name}
                        onTypeClick={(type, analyses, majorName) => {
                          setSelectedElementType(type)
                          setSelectedElementAnalyses(analyses)
                          setSelectedElementMajorName(majorName)
                          setShowElementDialog(true)
                        }}
                      />
                    </View>
                  )}
                  {/* 专业简介单独一行，占据全宽 */}
                  <View className="popular-majors-page__major-desc-wrapper">
                    <Text className="popular-majors-page__major-desc">
                      {major.majorBrief || '该专业致力于培养具备扎实理论基础和实践能力的专业人才，为学生提供全面的学科知识和职业发展指导。'}
                    </Text>
                  </View>
                </Card>
              )
            })}
          </View>
        )}

        {!loading && filteredMajors.length === 0 && (
          <View className="popular-majors-page__empty">
            <Text className="popular-majors-page__empty-text">
              {subjectFilter !== 'all' ? '未找到匹配的专业' : '暂无数据'}
            </Text>
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
                    <Text className="popular-majors-page__question-content">
                      {currentQuestion.content}
                    </Text>
                  </View>

                  {/* 选项 */}
                  <View className="popular-majors-page__question-options">
                    {currentQuestion.options.map((option) => {
                      // 根据提交逻辑反向推理：提交时 score = answers[question.id] = optionValue
                      // 所以恢复时：answers[scaleId] = answer.score，判断时直接比较
                      // 确保类型一致：都转换为数字进行比较
                      const currentAnswer = answers[currentQuestion.id]
                      const currentAnswerNum = typeof currentAnswer === 'string' ? parseFloat(currentAnswer) : Number(currentAnswer)
                      const optionValueNum = typeof option.optionValue === 'string' ? parseFloat(option.optionValue) : Number(option.optionValue)
                      const isAnswered = currentAnswer !== undefined && !isNaN(currentAnswerNum) && !isNaN(optionValueNum) && currentAnswerNum === optionValueNum
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

      {/* 元素分析详情对话框 */}
      <Dialog open={showElementDialog} onOpenChange={setShowElementDialog}>
        <DialogContent className="popular-majors-page__element-dialog" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>
              {selectedElementType && ELEMENT_ANALYSIS_TYPES[selectedElementType as keyof typeof ELEMENT_ANALYSIS_TYPES]?.label} - {selectedElementMajorName}
            </DialogTitle>
          </DialogHeader>
          <View className="popular-majors-page__element-dialog-content">
            {(() => {
              if (!selectedElementType || !selectedElementAnalyses) {
                return (
                  <View className="popular-majors-page__element-dialog-empty">
                    <Text>暂无数据</Text>
                  </View>
                )
              }
              const analysis = selectedElementAnalyses.find(a => a.type === selectedElementType)
              const elements = analysis?.elements || []
              
              if (elements.length === 0) {
                return (
                  <View className="popular-majors-page__element-dialog-empty">
                    <Text>暂无数据</Text>
                  </View>
                )
              }
              
              // 根据分值返回测评结果文本
              const getScoreResult = (score: number | null): string => {
                if (score === null) {
                  return '待测评'
                }
                const numScore = Number(score)
                if (numScore >= 4 && numScore <= 6) {
                  return '明显'
                } else if (numScore >= -3 && numScore <= 3) {
                  return '待发现'
                } else if (numScore < -3) {
                  return '不明显'
                }
                return '待测评'
              }

              return (
                <View className="popular-majors-page__element-dialog-list">
                  {elements.map((element, index) => {
                    const scoreResult = getScoreResult(element.score)
                    return (
                      <View key={index} className="popular-majors-page__element-dialog-item">
                        <Text className="popular-majors-page__element-dialog-item-name">
                          {element.elementName}
                        </Text>
                        <View className="popular-majors-page__element-dialog-item-score">
                          <Text className="popular-majors-page__element-dialog-item-score-label">
                            测评结果：
                          </Text>
                          <Text className="popular-majors-page__element-dialog-item-score-value">
                            {scoreResult}
                          </Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )
            })()}
          </View>
          <DialogFooter>
            <Button
              onClick={() => setShowElementDialog(false)}
              className="popular-majors-page__element-dialog-button"
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 问卷完成提示弹窗 */}
      <QuestionnaireRequiredModal
        open={showQuestionnaireModal}
        onOpenChange={setShowQuestionnaireModal}
        answerCount={answerCount}
      />
    </PageContainer>
  )
}
