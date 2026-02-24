// 热门专业评估页面
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Progress } from '@/components/ui/Progress'
import { getPopularMajors, createOrUpdatePopularMajorAnswer } from '@/services/popular-majors'
import { requestPayForPopularMajor, POPULAR_MAJOR_PRICE } from '@/services/pay'
import { getScalesByPopularMajorId } from '@/services/scales'
import { PopularMajorResponse, Scale, MajorElementAnalysis } from '@/types/api'
import './index.less'

// 适配后的专业接口，兼容原有代码
interface Major {
  id: string | number
  name: string
  code: string
  majorId?: number // 专业详情ID，用于跳转到院校列表
  degree: string | null
  limit_year: string | null
  boy_rate?: string
  girl_rate?: string
  salaryavg?: string | null
  fivesalaryavg?: number
  majorBrief?: string | null
  // 从接口返回的评估进度和分数
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

// 元素分析类型配置（含维度描述）
const ELEMENT_ANALYSIS_TYPES = {
  lexue: { label: '乐学', desc: '始终保有学习动力', color: '#4CAF50' },
  shanxue: { label: '善学', desc: '学习轻松高效', color: '#2196F3' },
  yanxue: { label: '厌学', desc: '学习动力逐步衰减', color: '#FF9800' },
  tiaozhan: { label: '阻学', desc: '学习效率持续损耗', color: '#F44336' },
} as const

// 元素分析显示组件（点击乐学/善学/厌学/阻学与专业名称一致，进入详情页）
function ElementAnalysesDisplay({
  analyses,
  score,
  isCompleted,
  onGoToDetail
}: {
  analyses: MajorElementAnalysis[] | null | undefined
  majorName: string
  score?: {
    score: number
    lexueScore: number
    shanxueScore: number
    yanxueDeduction: number
    tiaozhanDeduction: number
  } | null
  isCompleted?: boolean
  onGoToDetail: () => void
}) {
  // 如果未完成评估，不显示元素分析
  if (!isCompleted || !score || !analyses || analyses.length === 0) {
    return null
  }

  // 从 score 对象中获取各类型的分值
  const getScoreByType = (type: string): number | null => {
    if (!score) return null
    switch (type) {
      case 'lexue':
        return score.lexueScore ?? null
      case 'shanxue':
        return score.shanxueScore ?? null
      case 'yanxue':
        return score.yanxueDeduction ?? null
      case 'tiaozhan':
        return score.tiaozhanDeduction ?? null
      default:
        return null
    }
  }

  const handleClick = (e: any) => {
    e.stopPropagation()
    onGoToDetail()
  }

  // 获取各类型的分值
  const lexueScore = getScoreByType('lexue') ?? 0
  const shanxueScore = getScoreByType('shanxue') ?? 0
  const yanxueScore = getScoreByType('yanxue') ?? 0
  const tiaozhanScore = getScoreByType('tiaozhan') ?? 0
  const totalScore = score?.score ?? 0

  // 定义元素顺序和运算符：乐学+善学-厌学-阻学=score
  const elementOrder = [
    { type: 'lexue', operator: '+' },
    { type: 'shanxue', operator: '-' },
    { type: 'yanxue', operator: '-' },
    { type: 'tiaozhan', operator: '=' },
  ]

  return (
    <View className="popular-majors-page__element-analyses">
      <View className="popular-majors-page__element-analyses-row">
        {elementOrder.map((item, index) => {
          const config = ELEMENT_ANALYSIS_TYPES[item.type as keyof typeof ELEMENT_ANALYSIS_TYPES]
          const typeScore = getScoreByType(item.type)
          const isLast = index === elementOrder.length - 1
          
          return (
            <React.Fragment key={item.type}>
              <View
                className="popular-majors-page__element-analysis-item"
                onClick={handleClick}
              >
                <View className="popular-majors-page__element-analysis-info">
                  <Text className="popular-majors-page__element-analysis-label">
                    {config.label}
                  </Text>
                  {typeScore !== null && typeScore !== undefined && (
                    <Text className="popular-majors-page__element-analysis-score">
                      {typeScore}分
                    </Text>
                  )}
                </View>
              </View>
              {!isLast && (
                <Text className="popular-majors-page__element-analysis-operator">
                  {item.operator}
                </Text>
              )}
              {isLast && (
                <>
                  <Text className="popular-majors-page__element-analysis-operator">
                    =
                  </Text>
                  <View
                    className="popular-majors-page__element-analysis-total"
                    onClick={handleClick}
                  >
                    <Text className="popular-majors-page__element-analysis-total-text">
                      {totalScore}分
                    </Text>
                  </View>
                </>
              )}
            </React.Fragment>
          )
        })}
      </View>
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
  // 学科过滤：all-全部, science-理科, liberal-文科
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'science' | 'liberal'>('all')
  // 元素分析对话框状态

  // 评估内容预览弹窗（completedCount 为 0 时点击评估先展示测量内容）
  const [showPreAssessmentIntro, setShowPreAssessmentIntro] = useState(false)
  const [preAssessmentMajor, setPreAssessmentMajor] = useState<Major | null>(null)
  // 免费提示与支付：点击评估/报告/院校先弹「免费查看2个，其他收费」；是否收费仅由业务接口（如 enroll-plan、scales）返回 PAY_REQUIRED 决定
  const [showFreeQuotaTip, setShowFreeQuotaTip] = useState(false)
  const [showPayRequiredModal, setShowPayRequiredModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ type: 'assessment' | 'report' | 'schools'; major: Major } | null>(null)

  // 将 API 响应数据转换为页面使用的格式
  const transformMajorData = (apiData: PopularMajorResponse): Major => {
    return {
      id: String(apiData.id),
      name: apiData.name || '',
      code: apiData.code || apiData.majorDetail?.code || '',
      majorId: apiData.majorId, // 专业详情ID，用于跳转到院校列表
      degree: apiData.degree || apiData.majorDetail?.awardedDegree || null,
      limit_year: apiData.limitYear || apiData.majorDetail?.studyPeriod || null,
      salaryavg: apiData.averageSalary || null,
      fivesalaryavg: 0, // API 中暂无此字段
      majorBrief: apiData.majorDetail?.majorBrief || null,
      // 保留接口返回的评估进度和分数数据
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


  // 通过热门专业ID获取量表和答案
  const loadScalesByPopularMajorId = async (popularMajorId: number, restoreAnswers: boolean = true) => {
    try {
      // 直接通过热门专业ID获取量表和答案
      const scalesResponse = await getScalesByPopularMajorId(popularMajorId)
      
      if (!scalesResponse || !scalesResponse.scales || scalesResponse.scales.length === 0) {
        throw new Error('该专业暂无评估题目')
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
      // PAY_REQUIRED 需抛给调用方弹支付框（兼容 code 或 message 含关键字）
      const isPayRequired =
        error?.code === 'PAY_REQUIRED' ||
        (typeof error?.message === 'string' && error.message.includes('免费额度已用完'))
      if (isPayRequired) {
        throw error
      }
      Taro.showToast({
        title: error?.message || '加载评估题目失败',
        icon: 'none',
        duration: 2000
      })
      setQuestions([])
    }
  }

  // 处理开始评估（内部用，不包含额度校验；若接口返回 PAY_REQUIRED 则弹支付）
  const handleStartAssessment = async (major: Major) => {
    setSelectedMajor(major)
    setShowQuestionnaire(true)
    const popularMajorId = Number(major.id)
    if (isNaN(popularMajorId)) {
      Taro.showToast({ title: '无法获取热门专业ID', icon: 'none' })
      setShowQuestionnaire(false)
      return
    }
    try {
      await loadScalesByPopularMajorId(popularMajorId)
    } catch (err: any) {
      const isPayRequired =
        err?.code === 'PAY_REQUIRED' ||
        (typeof err?.message === 'string' && err.message.includes('免费额度已用完'))
      if (isPayRequired) {
        setShowQuestionnaire(false)
        setPendingAction({ type: 'assessment', major })
        // 延迟一帧再弹支付框，避免与问卷弹框关闭同一帧导致不展示
        setTimeout(() => {
          setShowPayRequiredModal(true)
        }, 100)
      } else {
        setShowQuestionnaire(false)
        Taro.showToast({ title: err?.message || '加载失败', icon: 'none' })
      }
    }
  }

  // 点击评估按钮：completedCount 为 0 且有 elementAnalyses 时先展示评估内容，否则直接进入评估
  const handleAssessmentButtonClick = (major: Major) => {
    const completedCount = Number(major.progress?.completedCount ?? 0)
    const hasElementAnalyses = major.elementAnalyses && major.elementAnalyses.length > 0
    if (completedCount === 0 && hasElementAnalyses) {
      setPreAssessmentMajor(major)
      setShowPreAssessmentIntro(true)
    } else {
      handleStartAssessment(major)
    }
  }

  // 评估内容预览中点击「开始评估」，关闭预览并进入评估页
  const handleConfirmPreAssessment = () => {
    if (preAssessmentMajor) {
      const major = preAssessmentMajor
      setShowPreAssessmentIntro(false)
      setPreAssessmentMajor(null)
      handleStartAssessment(major)
    }
  }

  // 处理专业卡片点击，跳转到深度探索页面
  const handleMajorCardClick = (major: Major) => {
    if (!major.code) {
      Taro.showToast({
        title: '专业代码不存在',
        icon: 'none'
      })
      return
    }
    const popularMajorId = Number(major.id)
    const url = `/pages/assessment/career-exploration/index?code=${major.code}&from=popular-majors${!isNaN(popularMajorId) ? `&majorId=${popularMajorId}` : ''}`
    Taro.navigateTo({
      url
    })
  }

  // 处理查看院校按钮点击，跳转到院校列表页面（内部用，不包含额度校验）
  const handleViewSchoolsInner = (major: Major) => {
    if (!major.code) {
      Taro.showToast({
        title: '专业代码不存在',
        icon: 'none'
      })
      return
    }
    const majorNameParam = encodeURIComponent(major.name || '')
    let url = `/pages/majors/intended/schools/index?majorCode=${major.code}&majorName=${majorNameParam}&from=popular-majors`
    if (major.majorId) {
      url += `&majorId=${major.majorId}`
    }
    if (major.id != null && major.id !== '') {
      url += `&popularMajorId=${major.id}`
    }
    Taro.navigateTo({ url })
  }

  /** 执行已缓存的操作（评估/报告/院校），在额度通过或支付成功后调用；可传入 action 避免异步后状态丢失 */
  const runPendingAction = useCallback((action?: { type: 'assessment' | 'report' | 'schools'; major: Major } | null) => {
    const actionToRun = action ?? pendingAction
    if (!actionToRun) return
    const { type, major } = actionToRun
    setPendingAction(null)
    if (type === 'assessment') {
      const completedCount = Number(major.progress?.completedCount ?? 0)
      const hasElementAnalyses = major.elementAnalyses && major.elementAnalyses.length > 0
      if (completedCount === 0 && hasElementAnalyses) {
        setPreAssessmentMajor(major)
        setShowPreAssessmentIntro(true)
      } else {
        handleStartAssessment(major)
      }
    } else if (type === 'report') {
      handleMajorCardClick(major)
    } else if (type === 'schools') {
      handleViewSchoolsInner(major)
    }
  }, [pendingAction])

  /** 点击评估/报告/院校：先弹免费提示，继续后直接执行；是否收费仅看业务接口（enroll-plan、scales）是否返回 PAY_REQUIRED */
  const checkQuotaAndRun = useCallback((type: 'assessment' | 'report' | 'schools', major: Major) => {
    setPendingAction({ type, major })
    setShowFreeQuotaTip(true)
  }, [])

  /** 免费提示弹框点「继续」：直接执行操作；是否收费由业务接口决定，接口返回 PAY_REQUIRED 时再弹支付 */
  const handleFreeQuotaTipContinue = useCallback(() => {
    const action = pendingAction
    setShowFreeQuotaTip(false)
    if (action) runPendingAction(action)
  }, [pendingAction, runPendingAction])

  /** 支付弹框「去支付」：调起支付，成功后执行原操作（transactions_jsapi 需传 majorCode） */
  const handlePayConfirm = useCallback(async () => {
    const action = pendingAction
    if (!action) return
    const majorCode = action.major.code
    if (!majorCode) {
      Taro.showToast({ title: '专业代码不存在', icon: 'none' })
      return
    }
    const success = await requestPayForPopularMajor(majorCode)
    if (success) {
      setShowPayRequiredModal(false)
      runPendingAction(action)
    }
  }, [pendingAction, runPendingAction])

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
      // 完成评估，计算热爱能量
      handleComplete()
    }
  }

  // 处理上一题
  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
    }
  }

  // 完成评估
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

    // 答案已经在每答一题时同步到数据库，这里只需要刷新列表数据
    // 刷新数据以获取最新的 progress 和 score
    if (selectedMajor) {
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

  // 重新评估
  const handleRetake = async () => {
    if (!selectedMajor) {
      Taro.showToast({
        title: '未选择专业',
        icon: 'none'
      })
      return
    }
    const popularMajorId = Number(selectedMajor.id)
    if (isNaN(popularMajorId)) {
      Taro.showToast({
        title: '无法获取热门专业ID',
        icon: 'none'
      })
      return
    }
    try {
      await loadScalesByPopularMajorId(popularMajorId, false)
    } catch (err: any) {
      const isPayRequired =
        err?.code === 'PAY_REQUIRED' ||
        (typeof err?.message === 'string' && err.message.includes('免费额度已用完'))
      if (isPayRequired) {
        setPendingAction({ type: 'assessment', major: selectedMajor })
        setTimeout(() => setShowPayRequiredModal(true), 100)
      } else {
        Taro.showToast({ title: err?.message || '加载失败', icon: 'none' })
      }
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
            <Text className="popular-majors-page__header-title">热门专业评估</Text>
            <Text className="popular-majors-page__header-subtitle">进行专业匹配度评估</Text>
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
              // 使用接口返回的数据判断是否完成评估
              const isCompleted = major.progress?.isCompleted === true
              // 使用接口返回的分数数据
              const score = major.score?.score
              
              // 判断是否应该显示元素分析：只有评估完成或者有得分（>0）时才显示
              const shouldShowElementAnalyses = isCompleted || (score !== undefined && score !== null && Number(score) > 0)
              // 获取评估进度（确保转换为数字类型）
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
                <Card 
                  key={major.id} 
                  className="popular-majors-page__major-card"
                  onClick={() => checkQuotaAndRun('report', major)}
                >
                  <View className="popular-majors-page__major-content">
                    <View className="popular-majors-page__major-index">
                      <Text className="popular-majors-page__major-index-text">{index + 1}</Text>
                    </View>
                    <View className="popular-majors-page__major-info">
                      <View className="popular-majors-page__major-name-wrapper">
                        <Text className="popular-majors-page__major-name">{major.name}</Text>
                        {isCompleted && (
                          <View
                            className="popular-majors-page__major-retake-icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              checkQuotaAndRun('assessment', major)
                            }}
                          >
                            <Text className="popular-majors-page__major-retake-icon-text">🔄</Text>
                          </View>
                        )}
                      </View>
                      <View className="popular-majors-page__major-tags">
                        {major.degree && (
                          <Text className="popular-majors-page__major-tag">{major.degree}</Text>
                        )}
                      </View>
                    </View>
                    <View className="popular-majors-page__major-actions">
                      {isCompleted ? (
                        <View className="popular-majors-page__major-actions-container">
                          <View className="popular-majors-page__major-actions-row">
                            <Button
                              size="sm"
                              className="popular-majors-page__major-button popular-majors-page__major-button--view-report popular-majors-page__major-action-item"
                              onClick={(e) => {
                                e.stopPropagation()
                                checkQuotaAndRun('report', major)
                              }}
                            >
                              报告
                            </Button>
                            <Button
                              size="sm"
                              className="popular-majors-page__major-button popular-majors-page__major-button--view-schools popular-majors-page__major-action-item"
                              onClick={(e) => {
                                e.stopPropagation()
                                checkQuotaAndRun('schools', major)
                              }}
                            >
                              院校
                            </Button>
                          </View>
                        </View>
                      ) : (
                        <Button
                          size="sm"
                          className="popular-majors-page__major-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            checkQuotaAndRun('assessment', major)
                          }}
                        >
                          评估
                        </Button>
                      )}
                      {/* 显示评估进度：未完成且进度不为0才显示 */}
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
                  {/* 元素分析显示：只有评估完成的专业才显示 */}
                  {isCompleted && major.elementAnalyses && major.elementAnalyses.length > 0 && (
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
                        score={major.score}
                        isCompleted={isCompleted}
                        onGoToDetail={() => checkQuotaAndRun('report', major)}
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

      {/* 评估对话框 */}
      <Dialog open={showQuestionnaire} onOpenChange={setShowQuestionnaire} className="popular-majors-page__dialog-wrapper">
        <DialogContent className="popular-majors-page__dialog" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle className="popular-majors-page__dialog-title">
              {selectedMajor?.name} - 专业匹配度评估
            </DialogTitle>
          </DialogHeader>

          {isCompleted ? (
            // 完成状态：显示重新评估按钮
            <View className="popular-majors-page__dialog-completed">
              <Text className="popular-majors-page__dialog-energy-desc">
                评估已完成
              </Text>
              <View className="popular-majors-page__dialog-actions">
                <Button
                  onClick={handleRetake}
                  className="popular-majors-page__dialog-button popular-majors-page__dialog-button--primary"
                  size="lg"
                >
                  🔄 重新评估
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
                  {currentQuestionIndex < questions.length - 1 ? '下一题' : '完成评估'}
                </Button>
              </View>
            </View>
          )}
        </DialogContent>
      </Dialog>

      {/* 评估内容预览对话框（completedCount 为 0 时先展示将测量的内容） */}
      <Dialog
        open={showPreAssessmentIntro}
        onOpenChange={(open) => {
          setShowPreAssessmentIntro(open)
          if (!open) setPreAssessmentMajor(null)
        }}
      >
        <DialogContent className="popular-majors-page__dialog popular-majors-page__pre-assessment-dialog" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle className="popular-majors-page__dialog-title">
              {preAssessmentMajor?.name} 
            </DialogTitle>
            <DialogDescription className="popular-majors-page__pre-assessment-desc">
              将测量以下维度，请根据您的真实感受作答。
            </DialogDescription>
          </DialogHeader>
          <ScrollView className="popular-majors-page__pre-assessment-content" scrollY>
            {preAssessmentMajor?.elementAnalyses && (['lexue', 'shanxue', 'yanxue', 'tiaozhan'] as const).map((typeKey) => {
              const analysis = preAssessmentMajor.elementAnalyses!.find((a) => a.type === typeKey)
              if (!analysis || !analysis.elements?.length) return null
              const config = ELEMENT_ANALYSIS_TYPES[typeKey]
              return (
                <View key={typeKey} className="popular-majors-page__pre-assessment-block">
                  <Text className="popular-majors-page__pre-assessment-type-line">
                    <Text style={{ color: config?.color, fontWeight: 600 }}>{config?.label ?? typeKey}</Text>
                    {config?.desc && (
                      <Text className="popular-majors-page__pre-assessment-type-desc"> {config.desc}</Text>
                    )}
                  </Text>
                  <View className="popular-majors-page__pre-assessment-elements">
                    {analysis.elements.map((el, idx) => (
                      <Text key={idx} className="popular-majors-page__pre-assessment-element">
                        · {el.elementName}
                      </Text>
                    ))}
                  </View>
                </View>
              )
            })}
          </ScrollView>
          <DialogFooter className="popular-majors-page__pre-assessment-footer">
            <Button
              onClick={handleConfirmPreAssessment}
              className="popular-majors-page__dialog-button popular-majors-page__dialog-button--primary"
              size="lg"
            >
              开始评估
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 免费提示：仅文案说明；是否需付费完全由业务接口（如 /enroll-plan/major/xx/scores）返回值 PAY_REQUIRED 决定 */}
      <Dialog open={showFreeQuotaTip} onOpenChange={setShowFreeQuotaTip}>
        <DialogContent className="popular-majors-page__dialog" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle className="popular-majors-page__dialog-title">温馨提示</DialogTitle>
            <DialogDescription className="popular-majors-page__pay-tip-desc">
              免费查看 2 个热门专业，其余专业需付费查看。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="popular-majors-page__dialog-footer">
            <Button
              onClick={handleFreeQuotaTipContinue}
              className="popular-majors-page__dialog-button popular-majors-page__dialog-button--primary"
              size="lg"
            >
              继续
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 超额支付弹框：免费额度已用完，调起支付（每个热门专业 29.9 元） */}
      <Dialog open={showPayRequiredModal} onOpenChange={setShowPayRequiredModal}>
        <DialogContent className="popular-majors-page__dialog" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle className="popular-majors-page__dialog-title">免费额度已用完</DialogTitle>
            <DialogDescription className="popular-majors-page__pay-tip-desc">
              请购买该热门专业或解锁全部。每个热门专业 {POPULAR_MAJOR_PRICE} 元。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="popular-majors-page__dialog-footer">
            <Button
              onClick={handlePayConfirm}
              className="popular-majors-page__dialog-button popular-majors-page__dialog-button--primary"
              size="lg"
            >
              去支付
            </Button>
            <Button
              onClick={() => setShowPayRequiredModal(false)}
              className="popular-majors-page__dialog-button"
              size="lg"
              variant="outline"
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageContainer>
  )
}
