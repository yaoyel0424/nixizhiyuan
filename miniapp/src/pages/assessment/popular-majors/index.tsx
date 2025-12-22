// 热门专业评估页面
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Progress } from '@/components/ui/Progress'
import { Input } from '@/components/ui/Input'
import { getPopularMajors } from '@/services/popular-majors'
import { getMajorDetailByCode } from '@/services/majors'
import { getScalesByMajorDetailId } from '@/services/scales'
import { PopularMajorResponse, Scale } from '@/types/api'
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

// 判断专业是理科还是文科
// 理科：07 理学、08 工学、09 农学、10 医学
// 文科：01 哲学、02 经济学、03 法学、04 教育学、05 文学、06 历史学、12 管理学、13 艺术学
const isScienceMajor = (code: string): boolean => {
  const prefix = code.substring(0, 2)
  const sciencePrefixes = ['07', '08', '09', '10']
  return sciencePrefixes.includes(prefix)
}

// 自定义导航栏组件
function SystemNavBar({ searchQuery, onSearchChange, subjectFilter, onSubjectFilterChange, onHeightChange }: {
  searchQuery: string
  onSearchChange: (value: string) => void
  subjectFilter: 'all' | 'science' | 'liberal'
  onSubjectFilterChange: (filter: 'all' | 'science' | 'liberal') => void
  onHeightChange?: (height: number) => void
}) {
  const [systemInfo, setSystemInfo] = useState<any>(null)

  useEffect(() => {
    const info = Taro.getSystemInfoSync()
    setSystemInfo(info)
    
    // 计算导航栏总高度并通知父组件
    if (info) {
      const statusBarHeight = info.statusBarHeight || 0
      const navigationBarHeight = 44 // 微信导航栏标准高度（px）
      // 搜索框高度 72rpx + 上margin 40rpx + 下margin 16rpx = 128rpx，过滤标签高度约 60rpx，总共约 188rpx
      // rpx 转 px: 1rpx = screenWidth / 750
      const screenWidth = info.screenWidth || 375
      const rpxToPx = screenWidth / 750
      const searchAndFilterHeight = 188 * rpxToPx // 搜索框和过滤标签的总高度（已增加顶部间距）
      const totalHeight = statusBarHeight + navigationBarHeight + searchAndFilterHeight
      onHeightChange?.(totalHeight)
    }
  }, [onHeightChange])

  if (!systemInfo) return null

  const statusBarHeight = systemInfo.statusBarHeight || 0
  const navigationBarHeight = 44 // 微信导航栏标准高度（px）

  return (
    <View 
      className="popular-majors-nav-bar"
      style={{ 
        height: `${statusBarHeight + navigationBarHeight + 80}px`, // 增加10rpx间距（约5px）
        paddingTop: `${statusBarHeight}px`,
        backgroundColor: '#f0f7ff'
      }}
    >
      <View className="popular-majors-nav-bar__content">
        <View className="popular-majors-nav-bar__header">
          <View className="popular-majors-nav-bar__back" onClick={() => Taro.navigateBack()}>
            <Text className="popular-majors-nav-bar__back-icon">←</Text>
          </View>
          <View className="popular-majors-nav-bar__title">热门专业</View>
          <View className="popular-majors-nav-bar__placeholder"></View>
        </View>
        
        {/* 搜索框 */}
        <View className="popular-majors-nav-bar__search">
          <View className="popular-majors-nav-bar__search-icon">🔍</View>
          <Input
            className="popular-majors-nav-bar__search-input"
            placeholder="搜索专业名称或代码..."
            value={searchQuery}
            onInput={(e) => onSearchChange(e.detail.value)}
          />
        </View>

        {/* 理科/文科过滤标签 */}
        <View className="popular-majors-nav-bar__filters">
          <View
            className={`popular-majors-nav-bar__filter ${subjectFilter === 'all' ? 'popular-majors-nav-bar__filter--active' : ''}`}
            onClick={() => onSubjectFilterChange('all')}
          >
            <Text className="popular-majors-nav-bar__filter-text">全部</Text>
          </View>
          <View
            className={`popular-majors-nav-bar__filter ${subjectFilter === 'science' ? 'popular-majors-nav-bar__filter--active' : ''}`}
            onClick={() => onSubjectFilterChange('science')}
          >
            <Text className="popular-majors-nav-bar__filter-text">理科</Text>
          </View>
          <View
            className={`popular-majors-nav-bar__filter ${subjectFilter === 'liberal' ? 'popular-majors-nav-bar__filter--active' : ''}`}
            onClick={() => onSubjectFilterChange('liberal')}
          >
            <Text className="popular-majors-nav-bar__filter-text">文科</Text>
          </View>
        </View>
      </View>
    </View>
  )
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
  // 保存每个专业的测评结果 { majorCode: loveEnergy }
  const [majorResults, setMajorResults] = useState<Record<string, number>>({})
  // 搜索关键词
  const [searchQuery, setSearchQuery] = useState('')
  // 学科过滤：all-全部, science-理科, liberal-文科
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'science' | 'liberal'>('all')
  // 导航栏高度，用于计算页面内容的 padding-top
  const [navBarHeight, setNavBarHeight] = useState(0)
  // 系统信息，用于rpx转px
  const [systemInfo, setSystemInfo] = useState<any>(null)
  // 分页相关
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const info = Taro.getSystemInfoSync()
    setSystemInfo(info)
  }, [])

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
    }
  }

  // 加载热门专业数据
  const loadMajors = useCallback(async (
    pageNum: number = 1,
    reset: boolean = false,
    category?: 'ben' | 'gz_ben' | 'zhuan',
    query?: string
  ) => {
    try {
      setLoading(true)
      
      // 使用传入的参数或当前状态
      const currentCategory = category ?? selectedCategory
      const currentQuery = query ?? searchQuery
      
      // 映射分类到 API 的 level1 参数
      const level1Map: Record<string, string> = {
        'ben': 'ben',
        'gz_ben': 'gao_ben',
        'zhuan': 'zhuan',
      }
      
      const params: any = {
        page: pageNum,
        limit: 20, // 每页20条
        level1: level1Map[currentCategory],
      }

      // 如果有搜索关键词，添加到参数中
      if (currentQuery.trim()) {
        // 判断是专业名称还是代码
        if (/^\d+$/.test(currentQuery.trim())) {
          params.code = currentQuery.trim()
        } else {
          params.name = currentQuery.trim()
        }
      }

      const response = await getPopularMajors(params)
      
      if (response && response.items) {
        const transformedMajors = response.items.map(transformMajorData)
        
        if (reset) {
          setMajors(transformedMajors)
        } else {
          setMajors(prev => [...prev, ...transformedMajors])
        }
        
        setTotal(response.meta.total)
        setHasMore(pageNum < response.meta.totalPages)
      } else {
        if (reset) {
          setMajors([])
        }
        setHasMore(false)
      }
    } catch (error) {
      console.error('加载热门专业数据失败:', error)
      Taro.showToast({
        title: '加载数据失败',
        icon: 'none'
      })
      if (reset) {
        setMajors([])
      }
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, searchQuery])

  // 当分类改变时，重新加载数据
  useEffect(() => {
    setPage(1)
    setHasMore(true)
    loadMajors(1, true, selectedCategory, searchQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory])

  // 搜索防抖处理
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setHasMore(true)
      loadMajors(1, true, selectedCategory, searchQuery)
    }, 500) // 500ms 防抖

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

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
    { key: 'gz_ben' as const, label: '高职本科' },
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

  // 加载更多数据
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      loadMajors(nextPage, false, selectedCategory, searchQuery)
    }
  }, [page, hasMore, loading, selectedCategory, searchQuery, loadMajors])

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

  // 通过专业code获取量表和答案
  const loadScalesByMajorCode = async (majorCode: string, restoreAnswers: boolean = true) => {
    try {
      // 1. 通过专业code获取专业详情（包含 majorDetailId）
      const majorDetail = await getMajorDetailByCode(majorCode)
      
      if (!majorDetail || !majorDetail.id) {
        throw new Error('获取专业详情失败')
      }

      // 2. 通过 majorDetailId 获取量表和答案
      const scalesResponse = await getScalesByMajorDetailId(majorDetail.id)
      
      if (!scalesResponse || !scalesResponse.scales || scalesResponse.scales.length === 0) {
        throw new Error('该专业暂无测评题目')
      }

      // 3. 将 Scale 转换为 Question 格式
      const questions = scalesResponse.scales.map(scaleToQuestion)

      // 4. 如果有已保存的答案且需要恢复，恢复答案状态
      // answer.score 就是用户选择的选项值（optionValue）
      const savedAnswers: Record<number, number> = {}
      if (restoreAnswers && scalesResponse.answers && scalesResponse.answers.length > 0) {
        scalesResponse.answers.forEach(answer => {
          savedAnswers[answer.scaleId] = answer.score
        })
      }

      setQuestions(questions)
      setAnswers(savedAnswers)
      setCurrentQuestionIndex(0)
      setIsCompleted(false)
      setLoveEnergy(null)
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
    
    // 通过专业code获取量表和答案
    await loadScalesByMajorCode(major.code)
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
  const handleRetake = async () => {
    if (selectedMajor) {
      // 重新加载量表和答案（不恢复已保存的答案，清空重新开始）
      await loadScalesByMajorCode(selectedMajor.code, false)
    } else {
      // 如果没有选中的专业，使用本地问卷数据
      loadRandomQuestions()
    }
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0

  return (
    <PageContainer>
      {/* 自定义导航栏 */}
      <SystemNavBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        subjectFilter={subjectFilter}
        onSubjectFilterChange={setSubjectFilter}
        onHeightChange={setNavBarHeight}
      />
      
      <View 
        className="popular-majors-page"
        style={{ 
          paddingTop: navBarHeight > 0 && systemInfo 
            ? `${navBarHeight - (10 * (systemInfo.screenWidth || 375) / 750)}px` 
            : '0' 
        }}
      >
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
                        {major.salaryavg && (
                          <Text className="popular-majors-page__major-tag">
                            平均薪资: {major.salaryavg}
                          </Text>
                        )}
                      </View>
                      <Text className="popular-majors-page__major-desc">
                        {major.majorBrief || '该专业致力于培养具备扎实理论基础和实践能力的专业人才，为学生提供全面的学科知识和职业发展指导。'}
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

        {!loading && filteredMajors.length === 0 && (
          <View className="popular-majors-page__empty">
            <Text className="popular-majors-page__empty-text">
              {searchQuery || subjectFilter !== 'all' ? '未找到匹配的专业' : '暂无数据'}
            </Text>
          </View>
        )}

        {/* 加载更多 */}
        {!loading && hasMore && filteredMajors.length > 0 && (
          <View className="popular-majors-page__load-more">
            <Button
              variant="outline"
              onClick={loadMore}
              className="popular-majors-page__load-more-button"
            >
              加载更多
            </Button>
          </View>
        )}

        {/* 没有更多数据提示 */}
        {!loading && !hasMore && filteredMajors.length > 0 && (
          <View className="popular-majors-page__no-more">
            <Text className="popular-majors-page__no-more-text">
              已加载全部 {total} 条数据
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
