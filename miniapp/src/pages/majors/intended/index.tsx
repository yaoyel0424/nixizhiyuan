// 志愿方案页面
import React, { useState, useEffect, useRef } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { BottomNav } from '@/components/BottomNav'
import { QuestionnaireRequiredModal } from '@/components/QuestionnaireRequiredModal'
import { useQuestionnaireCheck } from '@/hooks/useQuestionnaireCheck'
import { getStorage, setStorage } from '@/utils/storage'
import { getExamInfo, updateExamInfo, getGaokaoConfig, getScoreRange, ExamInfo, GaokaoSubjectConfig } from '@/services/exam-info'
import { getCurrentUserDetail } from '@/services/user'
import { getUserEnrollmentPlans, UserEnrollmentPlan, getProvincialControlLines, ProvincialControlLine, getMajorGroupInfo, MajorGroupInfo } from '@/services/enroll-plan'
import { getChoices, deleteChoice, adjustMgIndex, adjustMajorIndex, GroupedChoiceResponse, ChoiceInGroup, Direction } from '@/services/choices'
import { RangeSlider } from '@/components/RangeSlider'
import intentionData from '@/assets/data/intention.json'
import groupData from '@/assets/data/group.json'
import './index.less'

interface Major {
  code: string
  name: string
  displayName: string
  developmentPotential: string
  score: string
  opportunityScore: string
  academicDevelopmentScore: string
  careerDevelopmentScore: string
  growthPotentialScore: string
  industryProspectsScore: string
  lexueScore: string
  shanxueScore: string
  yanxueDeduction: string
  tiaozhanDeduction: string
  eduLevel?: string
}

interface HistoryScore {
  year: number
  historyScore: Array<{ [key: string]: string }>
  remark: string
  planNum: number
  batch?: string
  majorGroupName?: string | null
}

interface School {
  schoolName: string
  schoolNature: string
  rankDiffPer: number
  group: number
  historyScores: HistoryScore[]
  schoolFeature: string
  belong: string
  provinceName: string
  cityName: string
  enrollmentRate: string
  employmentRate: string
  majorGroupName?: string | null
}

interface IntentionMajor {
  major: Major
  schools: School[]
}

// 高考信息对话框组件
function ExamInfoDialog({ 
  open, 
  onOpenChange,
  examInfo,
  onUpdate
}: { 
  open: boolean
  onOpenChange: (open: boolean) => void
  examInfo?: ExamInfo
  onUpdate?: (updatedInfo?: ExamInfo) => void
}) {
  const [selectedProvince, setSelectedProvince] = useState<string>('四川')
  const [firstChoice, setFirstChoice] = useState<string | null>(null)
  const [optionalSubjects, setOptionalSubjects] = useState<Set<string>>(new Set())
  const [totalScore, setTotalScore] = useState<string>('580')
  const [ranking, setRanking] = useState<string>('9150')
  const [gaokaoConfig, setGaokaoConfig] = useState<GaokaoSubjectConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false)
  const [isUpdatingProvince, setIsUpdatingProvince] = useState(false)
  const [isFetchingRank, setIsFetchingRank] = useState(false)
  const scoreChangeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastProcessedScoreRef = useRef<string | null>(null) // 记录上次处理的分数，避免重复调用

  // 获取当前省份的科目配置
  const currentProvinceConfig = gaokaoConfig.find(config => config.province === selectedProvince)
  
  // 获取所有省份列表
  const provinceList = gaokaoConfig.map(config => config.province).sort()

  // 根据省份变化，重置科目选择
  useEffect(() => {
    if (currentProvinceConfig) {
      // 如果省份配置中没有首选科目要求，清空首选
      if (!currentProvinceConfig.primarySubjects || currentProvinceConfig.primarySubjects.count === 0) {
        setFirstChoice(null)
      } else {
        // 如果有首选科目要求，但当前选择不在可选列表中，清空
        if (firstChoice && !currentProvinceConfig.primarySubjects.subjects.includes(firstChoice)) {
          setFirstChoice(null)
        }
      }
      
      // 清空不在可选列表中的次选科目
      if (currentProvinceConfig.secondarySubjects) {
        setOptionalSubjects(prev => {
          const newSet = new Set<string>()
          prev.forEach(subject => {
            if (currentProvinceConfig.secondarySubjects!.subjects.includes(subject)) {
              newSet.add(subject)
            }
          })
          return newSet
        })
      } else {
        setOptionalSubjects(new Set())
      }
    }
  }, [selectedProvince, currentProvinceConfig])

  // 清理定时器和状态
  useEffect(() => {
    return () => {
      if (scoreChangeTimerRef.current) {
        clearTimeout(scoreChangeTimerRef.current)
        scoreChangeTimerRef.current = null
      }
      // 对话框关闭时，清除上次处理的分数记录
      lastProcessedScoreRef.current = null
    }
  }, [])

  // 从 API 或本地存储加载数据
  useEffect(() => {
    if (open && !isUpdatingProvince) {
      // 对话框打开时，清除上次处理的分数记录，避免影响新的输入
      lastProcessedScoreRef.current = null
      
      const loadData = async () => {
        try {
          // 先加载高考科目配置（如果还没有加载）
          if (gaokaoConfig.length === 0) {
            const config = await getGaokaoConfig()
            setGaokaoConfig(config)
          }

          // 优先使用传入的 examInfo
          if (examInfo) {
            if (examInfo.province && examInfo.province !== selectedProvince) {
              setSelectedProvince(examInfo.province)
            }
            if (examInfo.preferredSubjects && examInfo.preferredSubjects !== firstChoice) {
              setFirstChoice(examInfo.preferredSubjects)
            }
            if (examInfo.secondarySubjects) {
              const subjects = examInfo.secondarySubjects.split(',').map(s => s.trim())
              const currentSubjects = Array.from(optionalSubjects).sort().join(',')
              const newSubjects = subjects.sort().join(',')
              if (currentSubjects !== newSubjects) {
                setOptionalSubjects(new Set(subjects))
              }
            }
            if (examInfo.score !== undefined && String(examInfo.score) !== totalScore) {
              setTotalScore(String(examInfo.score))
            }
            if (examInfo.rank !== undefined && String(examInfo.rank) !== ranking) {
              setRanking(String(examInfo.rank))
            }
          } else {
            // 从本地存储加载
            const savedProvince = await getStorage<string>('examProvince')
            if (savedProvince && savedProvince !== selectedProvince) {
              setSelectedProvince(savedProvince)
            }
            const savedFirstChoice = await getStorage<string>('examFirstChoice')
            if (savedFirstChoice && savedFirstChoice !== firstChoice) {
              setFirstChoice(savedFirstChoice)
            }
            const savedOptional = await getStorage<string[]>('examOptionalSubjects')
            if (savedOptional) {
              const currentSubjects = Array.from(optionalSubjects).sort().join(',')
              const newSubjects = savedOptional.sort().join(',')
              if (currentSubjects !== newSubjects) {
                setOptionalSubjects(new Set(savedOptional))
              }
            }
            const savedScore = await getStorage<string>('examTotalScore')
            if (savedScore && savedScore !== totalScore) {
              setTotalScore(savedScore)
            }
            const savedRanking = await getStorage<string>('examRanking')
            if (savedRanking && savedRanking !== ranking) {
              setRanking(savedRanking)
            }
          }
        } catch (error) {
          console.error('加载高考信息失败:', error)
        }
      }
      loadData()
    } else if (!open) {
      // 对话框关闭时，清除定时器和状态
      if (scoreChangeTimerRef.current) {
        clearTimeout(scoreChangeTimerRef.current)
        scoreChangeTimerRef.current = null
      }
      lastProcessedScoreRef.current = null
    }
  }, [open, examInfo])

  // 处理首选科目选择
  const handlePrimarySubjectChange = (subject: string) => {
    if (currentProvinceConfig?.primarySubjects) {
      if (currentProvinceConfig.primarySubjects.count === 1) {
        // 单选模式
        setFirstChoice(subject === firstChoice ? null : subject)
      } else {
        // 多选模式（虽然目前没有，但预留）
        setFirstChoice(subject)
      }
    }
  }

  // 处理次选科目选择
  const handleSecondarySubjectToggle = (subject: string) => {
    if (!currentProvinceConfig?.secondarySubjects) return
    
    setOptionalSubjects((prev) => {
      const newSet = new Set(prev)
      const maxCount = currentProvinceConfig.secondarySubjects!.count
      
      if (newSet.has(subject)) {
        newSet.delete(subject)
      } else {
        if (newSet.size < maxCount) {
          newSet.add(subject)
        } else {
          Taro.showToast({
            title: `最多只能选择${maxCount}门科目`,
            icon: 'none',
            duration: 2000
          })
        }
      }
      return newSet
    })
  }

  // 处理分数变化，自动获取排名
  const handleScoreChange = async (score: string) => {
    // 如果分数为空或无效，不调用API
    if (!score || score.trim() === '' || isNaN(Number(score))) {
      return
    }
    
    // 检查必要参数是否齐全
    if (!selectedProvince || !firstChoice) {
      return
    }
    
    // 如果分数和上次处理的相同，不重复调用
    if (lastProcessedScoreRef.current === score) {
      return
    }
    
    // 防止重复请求
    if (isFetchingRank) {
      return
    }
    
    // 记录当前要处理的分数
    lastProcessedScoreRef.current = score
    setIsFetchingRank(true)
    
    try {
      // 调用API获取排名信息
      const scoreRangeInfo = await getScoreRange(
        selectedProvince,
        firstChoice,
        score
      )
      
      if (scoreRangeInfo && scoreRangeInfo.rankRange) {
        // 解析排名范围，取最小值作为排名
        // rankRange 格式可能是 "1000-2000" 或 "1000"
        const rankMatch = scoreRangeInfo.rankRange.match(/^(\d+)/)
        if (rankMatch) {
          const minRank = rankMatch[1]
          setRanking(minRank)
        }
      }
    } catch (error) {
      console.error('获取排名信息失败:', error)
      // 不显示错误提示，避免打扰用户输入
      // 如果请求失败，清除记录，允许重试
      lastProcessedScoreRef.current = null
    } finally {
      setIsFetchingRank(false)
    }
  }

  // 处理省份选择
  const handleProvinceChange = async (province: string) => {
    // 防止重复请求
    if (isUpdatingProvince || province === selectedProvince) {
      setShowProvinceDropdown(false)
      return
    }
    
    setIsUpdatingProvince(true)
    setShowProvinceDropdown(false)
    
    // 先更新本地状态
    setSelectedProvince(province)
    
    // 更新高考信息中的省份
    try {
      const updatedInfo: ExamInfo = {
        province,
        preferredSubjects: firstChoice || undefined,
        secondarySubjects: optionalSubjects.size > 0 ? Array.from(optionalSubjects).join(',') : undefined,
        score: totalScore ? parseInt(totalScore, 10) : undefined,
        rank: ranking ? parseInt(ranking, 10) : undefined,
      }
      // updateExamInfo 已经返回更新后的信息，不需要再次调用 API
      const result = await updateExamInfo(updatedInfo)
      
      // 使用返回的数据更新父组件状态，避免重复调用 API
      if (onUpdate) {
        // 将更新后的信息传递给父组件，而不是让父组件再次调用 API
        onUpdate(result)
      }
    } catch (error) {
      console.error('更新省份失败:', error)
      // 更新失败，恢复原省份
      setSelectedProvince(examInfo?.province || '四川')
      Taro.showToast({
        title: '更新失败，请重试',
        icon: 'none'
      })
    } finally {
      setIsUpdatingProvince(false)
    }
  }

  const handleConfirm = async () => {
    try {
      setLoading(true)
      
      // 准备更新数据
      const updateData: ExamInfo = {
        province: selectedProvince,
        preferredSubjects: firstChoice || undefined,
        secondarySubjects: optionalSubjects.size > 0 ? Array.from(optionalSubjects).join(',') : undefined,
        score: totalScore ? parseInt(totalScore, 10) : undefined,
        rank: ranking ? parseInt(ranking, 10) : undefined,
      }

      // 调用 API 更新
      const updatedInfo = await updateExamInfo(updateData)

      // 同时保存到本地存储（作为备份）
      await setStorage('examProvince', selectedProvince)
      if (firstChoice) {
        await setStorage('examFirstChoice', firstChoice)
      }
      await setStorage('examOptionalSubjects', Array.from(optionalSubjects))
      await setStorage('examTotalScore', totalScore)
      await setStorage('examRanking', ranking)

      Taro.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      })

      // 通知父组件更新（传入更新后的信息，避免重复调用 API）
      if (onUpdate) {
        onUpdate(updatedInfo)
      }
    } catch (error) {
      console.error('保存高考信息失败:', error)
      Taro.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000
      })
    } finally {
      setLoading(false)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="exam-info-dialog">
        <DialogHeader>
          <DialogTitle>高考信息</DialogTitle>
        </DialogHeader>
        <View className="exam-info-dialog__content">
          {/* 高考省份选择 */}
          <View className="exam-info-dialog__row">
            <Text className="exam-info-dialog__label">高考省份</Text>
            <View className="exam-info-dialog__province-select-wrapper">
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowProvinceDropdown(!showProvinceDropdown)
                }}
                className="exam-info-dialog__province-button"
                variant="outline"
              >
                <Text>{selectedProvince || '请选择省份'}</Text>
                <Text className={`exam-info-dialog__province-arrow ${showProvinceDropdown ? 'exam-info-dialog__province-arrow--open' : ''}`}>▼</Text>
              </Button>
              
              {/* 浮动下拉框 */}
              {showProvinceDropdown && (
                <View className="exam-info-dialog__province-dropdown">
                  <View className="exam-info-dialog__province-dropdown-content">
                    {provinceList.length === 0 ? (
                      <View className="exam-info-dialog__province-dropdown-loading">
                        <Text>加载中...</Text>
                      </View>
                    ) : (
                      <View className="exam-info-dialog__province-dropdown-grid">
                        {provinceList.map((province) => (
                          <Button
                            key={province}
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              if (!isUpdatingProvince) {
                                handleProvinceChange(province)
                              }
                            }}
                            disabled={isUpdatingProvince}
                            className={`exam-info-dialog__province-dropdown-item ${selectedProvince === province ? 'exam-info-dialog__province-dropdown-item--active' : ''}`}
                            variant={selectedProvince === province ? 'default' : 'ghost'}
                          >
                            {province}
                          </Button>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* 选择科目 */}
          {currentProvinceConfig && (
            <View className="exam-info-dialog__section">
              <Text className="exam-info-dialog__section-title">
                选择科目 ({currentProvinceConfig.mode})
              </Text>
              
              {/* 首选科目 */}
              {currentProvinceConfig.primarySubjects && currentProvinceConfig.primarySubjects.count > 0 && (
                <>
                  <View className="exam-info-dialog__divider">
                    <Text className="exam-info-dialog__divider-text">
                      首选 ({currentProvinceConfig.primarySubjects.count}选{currentProvinceConfig.primarySubjects.count})
                    </Text>
                  </View>
                  <View className="exam-info-dialog__button-group">
                    {currentProvinceConfig.primarySubjects.subjects.map((subject) => (
                      <Button
                        key={subject}
                        onClick={() => handlePrimarySubjectChange(subject)}
                        className={`exam-info-dialog__button ${firstChoice === subject ? 'exam-info-dialog__button--active' : ''}`}
                      >
                        {subject}
                      </Button>
                    ))}
                  </View>
                </>
              )}

              {/* 次选科目 */}
              {currentProvinceConfig.secondarySubjects && currentProvinceConfig.secondarySubjects.count > 0 && (
                <>
                  <View className="exam-info-dialog__divider">
                    <Text className="exam-info-dialog__divider-text">
                      次选 ({currentProvinceConfig.secondarySubjects.subjects.length}选{currentProvinceConfig.secondarySubjects.count})
                    </Text>
                  </View>
                  <View className="exam-info-dialog__button-grid">
                    {currentProvinceConfig.secondarySubjects.subjects.map((subject) => (
                      <Button
                        key={subject}
                        onClick={() => handleSecondarySubjectToggle(subject)}
                        disabled={!optionalSubjects.has(subject) && optionalSubjects.size >= currentProvinceConfig.secondarySubjects!.count}
                        className={`exam-info-dialog__button ${optionalSubjects.has(subject) ? 'exam-info-dialog__button--active' : ''}`}
                      >
                        {subject}
                      </Button>
                    ))}
                  </View>
                </>
              )}

              {/* 传统文理科模式 */}
              {currentProvinceConfig.traditionalSubjects && currentProvinceConfig.traditionalSubjects.length > 0 && (
                <>
                  <View className="exam-info-dialog__divider">
                    <Text className="exam-info-dialog__divider-text">选择科类</Text>
                  </View>
                  <View className="exam-info-dialog__button-group">
                    {currentProvinceConfig.traditionalSubjects.map((subject) => (
                      <Button
                        key={subject}
                        onClick={() => setFirstChoice(subject)}
                        className={`exam-info-dialog__button ${firstChoice === subject ? 'exam-info-dialog__button--active' : ''}`}
                      >
                        {subject}
                      </Button>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {/* 未选择省份时的提示 */}
          {!currentProvinceConfig && gaokaoConfig.length > 0 && (
            <View className="exam-info-dialog__tip">
              <Text className="exam-info-dialog__tip-icon">⚠️</Text>
              <Text className="exam-info-dialog__tip-text">请先选择省份</Text>
            </View>
          )}

          {/* 预估或实际总分 */}
          <View className="exam-info-dialog__row">
            <Text className="exam-info-dialog__label">预估或实际总分</Text>
            <Input
              type="number"
              value={totalScore}
              onInput={(e) => {
                // 使用防抖，延迟500ms后调用API
                const score = e.detail.value
                setTotalScore(score)
                
                // 清除之前的定时器
                if (scoreChangeTimerRef.current) {
                  clearTimeout(scoreChangeTimerRef.current)
                  scoreChangeTimerRef.current = null
                }
                
                // 如果分数为空或无效，不设置定时器
                if (!score || score.trim() === '' || isNaN(Number(score))) {
                  // 清除上次处理的分数记录
                  lastProcessedScoreRef.current = null
                  return
                }
                
                // 设置新的定时器
                scoreChangeTimerRef.current = setTimeout(() => {
                  handleScoreChange(score)
                  scoreChangeTimerRef.current = null
                }, 500)
              }}
              className="exam-info-dialog__input"
            />
            {isFetchingRank && (
              <Text className="exam-info-dialog__loading-text">正在获取排名...</Text>
            )}
          </View>

          {/* 高考排名 */}
          <View className="exam-info-dialog__row">
            <Text className="exam-info-dialog__label">高考排名</Text>
            <Input
              type="number"
              value={ranking}
              onInput={(e) => setRanking(e.detail.value)}
              className="exam-info-dialog__input"
            />
          </View>

          {/* 提示信息 */}
          <View className="exam-info-dialog__tip">
            <Text className="exam-info-dialog__tip-icon">💡</Text>
            <Text className="exam-info-dialog__tip-text">输入分数后系统将自动获取排名位次</Text>
          </View>

          {/* 确认按钮 */}
          <Button
            onClick={handleConfirm}
            className="exam-info-dialog__confirm-button"
            size="lg"
          >
            确认
          </Button>
        </View>
      </DialogContent>

    </Dialog>
  )
}

export default function IntendedMajorsPage() {
  // 检查问卷完成状态
  const { isCompleted: isQuestionnaireCompleted, isLoading: isCheckingQuestionnaire, answerCount } = useQuestionnaireCheck()
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  
  const router = useRouter()
  const tabParam = router.params?.tab || '意向志愿'
  const activeTab = tabParam === '意向志愿' ? '意向志愿' : '专业赛道'
  
  const [data, setData] = useState<IntentionMajor[]>([])
  const [enrollmentPlans, setEnrollmentPlans] = useState<UserEnrollmentPlan[]>([]) // 用户招生计划数据
  const [loading, setLoading] = useState(true)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [wishlistItems, setWishlistItems] = useState<any[]>([])
  const [wishlistCounts, setWishlistCounts] = useState<Record<string, number>>({})
  const [groupedChoices, setGroupedChoices] = useState<GroupedChoiceResponse | null>(null) // API返回的分组数据
  const [showExamInfoDialog, setShowExamInfoDialog] = useState(false)
  const [currentScore, setCurrentScore] = useState<number>(580)
  const [scoreRange, setScoreRange] = useState<[number, number]>([500, 650])
  const [minControlScore, setMinControlScore] = useState<number>(0) // 省份最低省控线
  const [expandedHistoryScores, setExpandedHistoryScores] = useState<Set<string>>(new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)
  const [groupToDelete, setGroupToDelete] = useState<{ items: any[], schoolName: string, majorGroupName: string } | null>(null)
  const [choiceToDelete, setChoiceToDelete] = useState<{ choiceId: number; majorName: string } | null>(null) // 要删除的单个专业
  const [selectedGroupInfo, setSelectedGroupInfo] = useState<{
    schoolName: string
    majorGroupName: string
    majorGroupId?: number
  } | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupDataList, setGroupDataList] = useState<any[]>([])
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [examInfo, setExamInfo] = useState<ExamInfo | null>(null)
  const [expandedMajorGroups, setExpandedMajorGroups] = useState<Set<string>>(new Set()) // 展开的专业组
  const [groupInfoData, setGroupInfoData] = useState<any[]>([]) // 专业组详细信息
  const [loadingGroupInfo, setLoadingGroupInfo] = useState(false)

  // 检查问卷完成状态
  useEffect(() => {
    if (!isCheckingQuestionnaire && !isQuestionnaireCompleted) {
      setShowQuestionnaireModal(true)
    }
  }, [isCheckingQuestionnaire, isQuestionnaireCompleted])

  // 使用 ref 防止重复调用招生计划接口
  const fetchingEnrollmentPlansRef = useRef(false)

  // 加载数据（院校探索页面使用API数据，意向志愿页面使用静态数据）
  useEffect(() => {
    const loadData = async () => {
      try {
        if (activeTab === '专业赛道') {
          // 如果正在获取中，避免重复调用
          if (fetchingEnrollmentPlansRef.current) {
            return
          }
          
          try {
            fetchingEnrollmentPlansRef.current = true
            // 院校探索页面：调用API获取用户招生计划
            const plans = await getUserEnrollmentPlans()
            setEnrollmentPlans(plans)
            console.log('获取用户招生计划成功:', plans)
          } finally {
            fetchingEnrollmentPlansRef.current = false
          }
        } else {
          // 意向志愿页面：使用静态数据
          setData(intentionData as unknown as IntentionMajor[])
        }
        setLoading(false)
      } catch (error) {
        console.error('加载数据失败:', error)
        setLoading(false)
      }
    }
    loadData()
  }, [activeTab])

  // 加载专业组数据
  useEffect(() => {
    try {
      const groupJson = groupData as any
      if (groupJson.data && Array.isArray(groupJson.data)) {
        setGroupDataList(groupJson.data)
      }
    } catch (error) {
      console.error('加载专业组数据失败:', error)
    }
  }, [])

  // 将API返回的分组数据转换为扁平化的列表
  const convertGroupedChoicesToItems = (groupedData: GroupedChoiceResponse): any[] => {
    const items: any[] = []
    
    // 按mgIndex排序
    const sortedVolunteers = [...groupedData.volunteers].sort((a, b) => {
      const aIndex = a.mgIndex ?? 999999
      const bIndex = b.mgIndex ?? 999999
      return aIndex - bIndex
    })
    
    sortedVolunteers.forEach((volunteer) => {
      volunteer.majorGroups.forEach((majorGroup) => {
        // 按majorIndex排序
        const sortedChoices = [...majorGroup.choices].sort((a, b) => {
          const aIndex = a.majorIndex ?? 999999
          const bIndex = b.majorIndex ?? 999999
          return aIndex - bIndex
        })
        
        sortedChoices.forEach((choice) => {
          items.push({
            id: choice.id,
            key: `${choice.schoolCode}-${choice.majorGroupId || 'no-group'}-${choice.id}`,
            majorCode: '', // API数据中没有majorCode，需要从其他地方获取
            majorName: choice.enrollmentMajor || '',
            schoolName: volunteer.school.name || '',
            schoolCode: choice.schoolCode,
            provinceName: volunteer.school.provinceName || '',
            cityName: volunteer.school.cityName || '',
            belong: volunteer.school.belong || '',
            schoolFeature: volunteer.school.features || '',
            schoolNature: volunteer.school.nature || 'public',
            enrollmentRate: volunteer.school.enrollmentRate ? `${volunteer.school.enrollmentRate}` : '0',
            employmentRate: volunteer.school.employmentRate ? `${volunteer.school.employmentRate}` : '0',
            majorGroupName: majorGroup.majorGroup.mgName || choice.majorGroupInfo || null,
            majorGroupId: choice.majorGroupId || majorGroup.majorGroup.mgId || null,
            batch: choice.batch || null,
            studyPeriod: choice.studyPeriod || null,
            tuitionFee: choice.tuitionFee || null,
            remark: choice.remark || null,
            enrollmentMajor: choice.enrollmentMajor || null,
            subjectSelectionMode: choice.subjectSelectionMode || majorGroup.majorGroup.subjectSelectionMode || null,
            enrollmentQuota: choice.enrollmentQuota || null,
            // 历史分数数据（从majorScores转换）
            historyScore: choice.majorScores.length > 0 ? [{
              year: choice.majorScores[0].year ? parseInt(choice.majorScores[0].year) : 2024,
              historyScore: choice.majorScores.map(score => ({
                [score.year || '2024']: `${score.minScore || ''},${score.minRank || ''},${score.admitCount || 0}`
              })),
              remark: choice.remark || '',
              planNum: choice.majorScores[0]?.admitCount || 0,
              batch: choice.batch || undefined,
              majorGroupName: majorGroup.majorGroup.mgName || null,
            }] : [],
            mgIndex: volunteer.mgIndex,
            majorIndex: choice.majorIndex,
          })
        })
      })
    })
    
    return items
  }

  // 加载志愿列表（从API）
  const loadChoicesFromAPI = async () => {
    try {
      const groupedData = await getChoices()
      setGroupedChoices(groupedData)
      
      // 转换为扁平化列表
      const items = convertGroupedChoicesToItems(groupedData)
      setWishlistItems(items)
      
      // 计算专业数量
      const counts: Record<string, number> = {}
      items.forEach((item: any) => {
        if (item.majorCode) {
          counts[item.majorCode] = (counts[item.majorCode] || 0) + 1
        }
      })
      setWishlistCounts(counts)
    } catch (error) {
      console.error('从API加载志愿列表失败:', error)
      // 降级：从本地存储加载
      const savedItems = await getStorage<any[]>('wishlist-items').catch(() => [])
      if (savedItems && savedItems.length > 0) {
        setWishlistItems(savedItems)
      }
    }
  }

  // 加载志愿列表
  useEffect(() => {
    if (activeTab === '意向志愿') {
      loadChoicesFromAPI()
    }
  }, [activeTab])

  // 获取省份最低省控线（通过 provincial-control-lines 接口）
  const getMinControlScore = async () => {
    try {
      // 调用接口获取省控线列表（根据当前用户信息自动查询）
      const controlLines = await getProvincialControlLines()
      
      if (!controlLines || controlLines.length === 0) {
        console.warn('未获取到省控线数据')
        return 0
      }
      
      // 从省控线列表中找出最低的分数
      const scores = controlLines
        .map(line => line.score)
        .filter((score): score is number => score !== null && score !== undefined && score > 0)
      
      if (scores.length === 0) {
        console.warn('省控线数据中没有有效的分数')
        return 0
      }
      
      const minScore = Math.min(...scores)
      console.log('获取省控线成功:', {
        controlLinesCount: controlLines.length,
        minControlScore: minScore,
        allScores: scores
      })
      
      return minScore
    } catch (error) {
      console.error('获取省控线失败:', error)
      return 0
    }
  }

  // 从本地存储加载高考信息（页面加载时，不调用 API）
  const loadExamInfoFromStorage = async () => {
    try {
      const savedProvince = await getStorage<string>('examProvince')
      const savedFirstChoice = await getStorage<string>('examFirstChoice')
      const savedOptional = await getStorage<string[]>('examOptionalSubjects')
      const savedScore = await getStorage<string>('examTotalScore')
      const savedRanking = await getStorage<string>('examRanking')
      
      const info: ExamInfo = {
        province: savedProvince || undefined,
        preferredSubjects: savedFirstChoice || undefined,
        secondarySubjects: savedOptional ? savedOptional.join(',') : undefined,
        score: savedScore ? parseInt(savedScore, 10) : undefined,
        rank: savedRanking ? parseInt(savedRanking, 10) : undefined,
      }
      
      setExamInfo(info)
      
      // 更新分数相关状态
      const score = info.score || 580
      setCurrentScore(score)
      
      // 不在这里获取省控线，让 useEffect 统一处理，避免重复调用
      // 先设置默认的分数区间，等省控线获取后再更新
      const savedRange = await getStorage<[number, number]>('scoreRange')
      if (savedRange && Array.isArray(savedRange) && savedRange.length === 2) {
        setScoreRange(savedRange)
      } else {
        const minScore = Math.max(0, score - 50)
        const maxScore = Math.min(750, score + 50)
        setScoreRange([minScore, maxScore])
      }
    } catch (error) {
      console.error('从本地存储加载高考信息失败:', error)
      setCurrentScore(580)
    }
  }

  // 从 API 加载高考信息（仅在需要时调用，如更新后刷新）
  // 如果提供了 updatedInfo，直接使用，避免重复调用 API
  const loadExamInfo = async (updatedInfo?: ExamInfo) => {
    try {
      // 如果提供了更新后的信息，直接使用，不调用 API
      const info = updatedInfo || await getExamInfo()
      setExamInfo(info)
      
      // 更新分数相关状态
      const score = info.score || 580
      setCurrentScore(score)
      
      // 不在这里获取省控线，让 useEffect 统一处理，避免重复调用
      // 先设置默认的分数区间，等省控线获取后再更新
      const savedRange = await getStorage<[number, number]>('scoreRange')
      if (savedRange && Array.isArray(savedRange) && savedRange.length === 2) {
        setScoreRange(savedRange)
      } else {
        const minScore = Math.max(0, score - 50)
        const maxScore = Math.min(750, score + 50)
        setScoreRange([minScore, maxScore])
      }
    } catch (error) {
      console.error('从 API 加载高考信息失败:', error)
      // 如果 API 失败，从本地存储加载
      await loadExamInfoFromStorage()
    }
  }

  // 页面加载时，只从本地存储加载，不调用 API
  useEffect(() => {
    loadExamInfoFromStorage()
  }, [])

  // 使用 ref 防止重复调用省控线接口
  const fetchingControlScoreRef = useRef(false)

  // 监听 examInfo 变化，更新省控线（统一在这里处理，避免重复调用）
  useEffect(() => {
    if (examInfo?.province && examInfo?.preferredSubjects && !fetchingControlScoreRef.current) {
      const updateControlScore = async () => {
        // 如果正在获取中，避免重复调用
        if (fetchingControlScoreRef.current) {
          return
        }
        
        try {
          fetchingControlScoreRef.current = true
          const controlScore = await getMinControlScore()
          setMinControlScore(controlScore)
          // 如果当前分数区间的最小值低于省控线，则更新左侧滑块位置
          setScoreRange((prevRange) => {
            if (prevRange[0] < controlScore) {
              const newMinValue = Math.max(controlScore, prevRange[0])
              const newRange: [number, number] = [newMinValue, prevRange[1]]
              // 保存更新后的区间
              setStorage('scoreRange', newRange).catch((error) => {
                console.error('保存分数区间失败:', error)
              })
              return newRange
            }
            return prevRange
          })
        } finally {
          fetchingControlScoreRef.current = false
        }
      }
      updateControlScore()
    }
  }, [examInfo?.province, examInfo?.preferredSubjects])

  // 使用 ref 防止重复调用用户详情接口
  const fetchingUserDetailRef = useRef(false)

  // 院校探索页面加载时获取用户详情
  useEffect(() => {
    // 使用 activeTab 判断是否为院校探索页面
    if (activeTab !== '意向志愿' && !fetchingUserDetailRef.current) {
      const fetchUserDetail = async () => {
        // 如果正在获取中，避免重复调用
        if (fetchingUserDetailRef.current) {
          return
        }
        
        try {
          fetchingUserDetailRef.current = true
          const userDetail = await getCurrentUserDetail()
          if (userDetail) {
            console.log('用户详情:', userDetail)
            // 这里可以根据需要处理用户详情数据
            // 例如更新某些状态或执行其他操作
          }
        } catch (error) {
          console.error('获取用户详情失败:', error)
        } finally {
          fetchingUserDetailRef.current = false
        }
      }
      fetchUserDetail()
    }
  }, [activeTab])


  // 监听 wishlistItems 变化，更新志愿数量
  useEffect(() => {
    const counts: Record<string, number> = {}
    wishlistItems.forEach((item: any) => {
      if (item.majorCode) {
        counts[item.majorCode] = (counts[item.majorCode] || 0) + 1
      }
    })
    setWishlistCounts(counts)
  }, [wishlistItems])

  // 监听滚动，显示返回顶部按钮
  useEffect(() => {
    // 小程序中需要使用 Taro 的页面滚动事件
    // 这里使用一个简单的方案：当列表项超过一定数量时显示返回顶部按钮
    if (activeTab === '意向志愿' && wishlistItems.length > 5) {
      setShowBackToTop(true)
    } else {
      setShowBackToTop(false)
    }
  }, [activeTab, wishlistItems.length])

  // 处理分数区间变化
  const handleScoreRangeChange = async (newRange: [number, number]) => {
    // 确保最小值不低于省控线
    const minValue = Math.max(newRange[0], minControlScore || 0)
    const finalRange: [number, number] = [minValue, newRange[1]]
    
    if (finalRange[0] <= finalRange[1]) {
      setScoreRange(finalRange)
      try {
        await setStorage('scoreRange', finalRange)
      } catch (error) {
        console.error('保存分数区间失败:', error)
      }
    }
  }

  // 删除志愿项
  const handleDeleteClick = (index: number) => {
    setItemToDelete(index)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteWishlistItem = async () => {
    try {
      // 如果是删除单个专业
      if (choiceToDelete) {
        await deleteChoice(choiceToDelete.choiceId)
        
        // 重新加载志愿列表
        await loadChoicesFromAPI()
        
        Taro.showToast({
          title: '删除成功',
          icon: 'success',
          duration: 2000
        })
        
        setChoiceToDelete(null)
      } else if (groupToDelete) {
        // 如果是删除专业组
        const deletePromises = groupToDelete.items
          .filter((item: any) => item.id)
          .map((item: any) => deleteChoice(item.id))
        
        await Promise.all(deletePromises)
        
        // 重新加载志愿列表
        await loadChoicesFromAPI()
        
        Taro.showToast({
          title: '删除成功',
          icon: 'success',
          duration: 2000
        })
        
        setGroupToDelete(null)
      } else if (itemToDelete !== null) {
        // 删除单个志愿项
        const deletedItem = wishlistItems[itemToDelete]
        
        if (deletedItem?.id) {
          await deleteChoice(deletedItem.id)
          
          // 重新加载志愿列表
          await loadChoicesFromAPI()
          
          Taro.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 2000
          })
        } else {
          // 降级：从本地存储删除
          const newItems = wishlistItems.filter((_, i) => i !== itemToDelete)
          await setStorage('wishlist-items', newItems)
          setWishlistItems(newItems)
        }
        
        setItemToDelete(null)
      }
    } catch (error: any) {
      console.error('删除失败:', error)
      Taro.showToast({
        title: error?.message || '删除失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
    
    setDeleteConfirmOpen(false)
  }

  // 移动志愿项（上移/下移）
  const moveWishlistItem = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === wishlistItems.length - 1) return

    const currentItem = wishlistItems[index]
    const targetItem = wishlistItems[direction === 'up' ? index - 1 : index + 1]

    try {
      // 判断是移动专业组还是移动专业
      // 如果mgIndex相同，则是移动专业（使用adjustMajorIndex）
      // 如果mgIndex不同，则是移动专业组（使用adjustMgIndex）
      if (currentItem.mgIndex === targetItem.mgIndex && currentItem.mgIndex !== null) {
        // 移动专业：使用adjustMajorIndex
        if (currentItem.id) {
          await adjustMajorIndex(currentItem.id, { direction: direction as Direction })
        }
      } else {
        // 移动专业组：使用adjustMgIndex
        if (currentItem.mgIndex !== null) {
          await adjustMgIndex({ 
            mgIndex: currentItem.mgIndex, 
            direction: direction as Direction 
          })
        }
      }

      // 重新加载志愿列表
      await loadChoicesFromAPI()

      Taro.showToast({
        title: '移动成功',
        icon: 'success',
        duration: 1500
      })
    } catch (error: any) {
      console.error('移动志愿项失败:', error)
      Taro.showToast({
        title: error?.message || '移动失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  }

  // 返回顶部
  const scrollToTop = () => {
    Taro.pageScrollTo({
      scrollTop: 0,
      duration: 300
    })
  }

  const pageTitle = activeTab === '意向志愿' ? '志愿填报' : '院校探索'
  const pageDescription = activeTab === '意向志愿' 
    ? '基于天赋匹配的智能志愿推荐' 
    : '探索各专业对应的院校'
  const isProfessionalTrack = activeTab !== '意向志愿'

  if (loading) {
    return (
      <View className="intended-majors-page">
        <View className="intended-majors-page__loading">
          <Text>加载中...</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  // 计算前20%的专业
  const allMajorsWithScores = data
    .map(item => ({
      code: item.major.code,
      name: item.major.name,
      score: parseFloat(item.major.score || '0')
    }))
    .filter(major => major.score > 0)
  
  const sortedAllMajors = [...allMajorsWithScores].sort((a, b) => b.score - a.score)
  const top20PercentThresholdIndex = sortedAllMajors.length > 0 
    ? Math.ceil(sortedAllMajors.length * 0.2) 
    : 0
  const top20PercentMajorCodes = new Set(
    sortedAllMajors.slice(0, top20PercentThresholdIndex).map(m => m.code)
  )
  const top20PercentInWishlist = wishlistItems.filter(item => {
    return top20PercentMajorCodes.has(item.majorCode)
  })
  const top20PercentCount = top20PercentInWishlist.length

  return (
    <View className="intended-majors-page">
      
      {/* 头部 */}
      <View className="intended-majors-page__header">
        <View className="intended-majors-page__header-content">
          <View className="intended-majors-page__header-top">
            <View className="intended-majors-page__header-title-section">
              <Text className="intended-majors-page__title">{pageTitle}</Text>
              <Text className="intended-majors-page__subtitle">{pageDescription}</Text>
            </View>
            <View className="intended-majors-page__header-actions">
              {activeTab !== '意向志愿' && (
                <Button
                  onClick={() => setShowExamInfoDialog(true)}
                  className="intended-majors-page__action-button"
                  size="sm"
                >
                  📄 高考信息
                </Button>
              )}
              {activeTab === '意向志愿' ? (
                <Button
                  onClick={() => {
                    Taro.showToast({
                      title: '导出功能开发中',
                      icon: 'none'
                    })
                  }}
                  className="intended-majors-page__action-button"
                  size="sm"
                >
                  📄 导出志愿
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    Taro.navigateTo({
                      url: '/pages/assessment/provinces/index'
                    })
                  }}
                  className="intended-majors-page__action-button"
                  size="sm"
                >
                  📍 意向省份
                </Button>
              )}
            </View>
          </View>
        </View>
        <View className="intended-majors-page__wave" />
      </View>

      {/* 分数区间筛选条 - 仅在专业赛道tab显示 */}
      {isProfessionalTrack && (
        <View className="intended-majors-page__score-filter">
          <View className="intended-majors-page__score-filter-content">
            <Text className="intended-majors-page__score-filter-tip">
              💡 滑动滑块可查看不同分数区间的院校
            </Text>
            <View className="intended-majors-page__slider-container">
              <RangeSlider
                min={minControlScore || 0}
                max={750}
                value={scoreRange}
                onChange={handleScoreRangeChange}
                step={1}
                currentScore={currentScore}
              />
              <View className="intended-majors-page__slider-labels">
                <View className="intended-majors-page__slider-label">
                  <Text className="intended-majors-page__slider-label-text">最低:</Text>
                  <Text className="intended-majors-page__slider-label-value">{scoreRange[0]}</Text>
                </View>
                <View className="intended-majors-page__slider-label">
                  <Text className="intended-majors-page__slider-label-text">区间:</Text>
                  <Text className="intended-majors-page__slider-label-value intended-majors-page__slider-label-value--range">
                    {scoreRange[0]}-{scoreRange[1]}
                  </Text>
                </View>
                <View className="intended-majors-page__slider-label">
                  <Text className="intended-majors-page__slider-label-text">最高:</Text>
                  <Text className="intended-majors-page__slider-label-value">{scoreRange[1]}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 内容区域 */}
      <View className="intended-majors-page__content">
        {activeTab === '意向志愿' ? (
          // 意向志愿tab
          wishlistItems.length === 0 ? (
            <View className="intended-majors-page__empty">
              <Text className="intended-majors-page__empty-icon">🔍</Text>
              <Text className="intended-majors-page__empty-text">暂无志愿数据</Text>
              <Text className="intended-majors-page__empty-desc">请先进行院校探索，添加心仪的志愿</Text>
              <Button
                onClick={() => {
                  Taro.redirectTo({
                    url: '/pages/majors/intended/index?tab=专业赛道'
                  })
                }}
                className="intended-majors-page__empty-button"
              >
                前往院校探索
              </Button>
            </View>
          ) : (
            <View className="intended-majors-page__wishlist">
                            {(() => {
                // 按专业组分组：同一个学校+专业组ID的组合只算一个志愿
                const groupedByMajorGroup = new Map<string, any[]>()
                
                wishlistItems.forEach((item) => {
                  // 优先使用 schoolCode + majorGroupId 作为key（更可靠）
                  // 如果没有majorGroupId，再使用schoolCode + majorGroupName
                  let groupKey: string
                  if (item.majorGroupId) {
                    groupKey = `${item.schoolCode || item.schoolName}-${item.majorGroupId}`
                  } else if (item.majorGroupName && item.majorGroupName.trim() && item.majorGroupName !== '()') {
                    groupKey = `${item.schoolCode || item.schoolName}-${item.majorGroupName}`
                  } else {
                    // 如果没有专业组信息，使用 schoolCode + id 作为唯一标识
                    groupKey = `${item.schoolCode || item.schoolName}-no-group-${item.id}`
                  }
                  
                  if (!groupedByMajorGroup.has(groupKey)) {
                    groupedByMajorGroup.set(groupKey, [])
                  }
                  groupedByMajorGroup.get(groupKey)!.push(item)
                })
                
                // 转换为数组并按mgIndex排序，过滤掉没有专业组信息的项
                const groupedArray = Array.from(groupedByMajorGroup.entries())
                  .map(([key, items]) => {
                    // 取第一个item作为代表（它们属于同一个专业组）
                    const firstItem = items[0]
                    return {
                      key,
                      items,
                      mgIndex: firstItem.mgIndex ?? 999999,
                      schoolName: firstItem.schoolName,
                      schoolCode: firstItem.schoolCode,
                      majorGroupName: firstItem.majorGroupName || items.find((i: any) => i.majorGroupName)?.majorGroupName,
                      majorGroupId: firstItem.majorGroupId || items.find((i: any) => i.majorGroupId)?.majorGroupId,
                      school: groupedChoices?.volunteers.find(v => v.school.name === firstItem.schoolName || v.school.code === firstItem.schoolCode)?.school,
                      majorGroup: groupedChoices?.volunteers
                        .find(v => v.school.name === firstItem.schoolName || v.school.code === firstItem.schoolCode)
                        ?.majorGroups.find(mg => {
                          // 优先通过majorGroupId匹配
                          if (firstItem.majorGroupId) {
                            return mg.majorGroup.mgId === firstItem.majorGroupId || 
                                   mg.choices.some(c => c.majorGroupId === firstItem.majorGroupId)
                          }
                          // 如果没有majorGroupId，通过majorGroupName匹配
                          return mg.majorGroup.mgName === firstItem.majorGroupName
                        })?.majorGroup,
                    }
                  })
                  .filter(group => {
                    // 过滤掉没有专业组信息的项
                    // 如果有majorGroupId，就显示；如果没有majorGroupId，但有有效的majorGroupName，也显示
                    const hasMajorGroupId = group.majorGroupId !== null && group.majorGroupId !== undefined
                    const hasMajorGroupName = group.majorGroupName && group.majorGroupName.trim() && group.majorGroupName !== '()'
                    return hasMajorGroupId || hasMajorGroupName
                  })
                  .sort((a, b) => a.mgIndex - b.mgIndex)
                
                return groupedArray.map((group, idx) => {
                  const volunteerNumber = idx + 1
                  const school = group.school
                  const majorGroup = group.majorGroup
                  const groupKey = `${group.key}-${idx}`
                  const isExpanded = expandedMajorGroups.has(groupKey)
                  
                  const firstItem = group.items[0]
                  const schoolFeatures = school?.features || firstItem.schoolFeature || ''
                  const provinceName = school?.provinceName || firstItem.provinceName || ''
                  const cityName = school?.cityName || firstItem.cityName || ''
                  const belong = school?.belong || firstItem.belong || ''
                  const schoolCode = school?.code || firstItem.schoolCode || ''
                  const nature = school?.nature || firstItem.schoolNature || ''
                  
                  // 处理学校特征标签
                              let validFeatures: string[] = []
                  if (schoolFeatures) {
                    const featureStr = String(schoolFeatures).trim()
                                if (featureStr && featureStr !== '[]' && featureStr !== 'null' && featureStr !== 'undefined') {
                                  try {
                                    const parsed = JSON.parse(featureStr)
                                    if (Array.isArray(parsed)) {
                          validFeatures = parsed.filter((f: any) => f && String(f).trim())
                                    } else {
                          validFeatures = featureStr.split(',').filter((f: string) => f.trim())
                                    }
                                  } catch {
                        validFeatures = featureStr.split(',').filter((f: string) => f.trim())
                      }
                    }
                  }
                  
                  // 获取专业组信息
                  const mgId = majorGroup?.mgId || group.majorGroupId
                  const majorGroupName = majorGroup?.mgName || group.majorGroupName || ''
                  const subjectSelectionMode = majorGroup?.subjectSelectionMode || firstItem.subjectSelectionMode || ''
                  
                  return (
                    <Card key={groupKey} className="intended-majors-page__wishlist-item">
                      <View className="intended-majors-page__wishlist-item-content">
                        {/* 志愿编号和学校名称 */}
                        <View className="intended-majors-page__wishlist-item-header">
                          <View className="intended-majors-page__wishlist-item-volunteer-badge">
                            <Text className="intended-majors-page__wishlist-item-volunteer-text">志愿{volunteerNumber}</Text>
                          </View>
                          <View className="intended-majors-page__wishlist-item-main">
                            <View className="intended-majors-page__wishlist-item-title-section">
                              <Text className="intended-majors-page__wishlist-item-school">
                                {group.schoolName}
                                {majorGroupName ? ` [${majorGroupName}]` : ''}
                                    </Text>
                              <View className="intended-majors-page__wishlist-item-school-info">
                                <Text>{provinceName}</Text>
                                {validFeatures.length > 0 && (
                                  <>
                                    {validFeatures.map((feature, i) => (
                                      <Text key={i}>{feature}</Text>
                                    ))}
                                  </>
                                )}
                                {nature && <Text>{nature === 'public' ? '公办' : '民办'}</Text>}
                                </View>
                          </View>
                            {/* 冲稳保标签暂时隐藏，等待数据 */}
                            {/* <View className="intended-majors-page__wishlist-item-probability">
                              <View className="intended-majors-page__wishlist-item-probability-box">
                                <Text className="intended-majors-page__wishlist-item-probability-percent">23%</Text>
                                <Text className="intended-majors-page__wishlist-item-probability-label">冲</Text>
                        </View>
                          </View> */}
                          </View>
                        </View>
                        
                        {/* 计划信息 */}
                        <View className="intended-majors-page__wishlist-item-plan-info">
                          <Text>25年计划{firstItem.enrollmentQuota || group.items.length}人</Text>
                          {schoolCode && <Text>院校代码 {schoolCode}</Text>}
                          {subjectSelectionMode && <Text>选科要求{subjectSelectionMode}</Text>}
                        </View>
                        
                        {/* 专业组展开按钮 */}
                        {majorGroupName && (
                          <View 
                            className={`intended-majors-page__wishlist-item-group-toggle ${isExpanded ? 'intended-majors-page__wishlist-item-group-toggle--expanded' : ''}`}
                            onClick={async () => {
                              if (isExpanded) {
                                setExpandedMajorGroups((prev) => {
                                  const newSet = new Set(prev)
                                  newSet.delete(groupKey)
                                  return newSet
                                })
                                setGroupInfoData([])
                              } else {
                                setExpandedMajorGroups((prev) => {
                                  const newSet = new Set(prev)
                                  newSet.add(groupKey)
                                  return newSet
                                })
                                
                                // 加载专业组详细信息
                                if (mgId) {
                                  try {
                                    setLoadingGroupInfo(true)
                                    const groupInfo = await getMajorGroupInfo(mgId)
                                    setGroupInfoData(groupInfo)
                                  } catch (error) {
                                    console.error('获取专业组信息失败:', error)
                                    Taro.showToast({
                                      title: '获取专业组信息失败',
                                      icon: 'none'
                                    })
                                  } finally {
                                    setLoadingGroupInfo(false)
                                  }
                                }
                              }
                            }}
                          >
                            <Text className="intended-majors-page__wishlist-item-group-text">
                              专业组{majorGroupName}
                            </Text>
                            <Text className="intended-majors-page__wishlist-item-group-info">
                              {subjectSelectionMode ? `${subjectSelectionMode}, ` : ''}
                              已选中{group.items.length}个专业
                            </Text>
                            <Text className={`intended-majors-page__wishlist-item-group-arrow ${isExpanded ? 'intended-majors-page__wishlist-item-group-arrow--expanded' : ''}`}>
                              {isExpanded ? '^' : '▼'}
                            </Text>
                        </View>
                        )}
                        
                        {/* 展开的专业组内容 */}
                        {isExpanded && (
                          <View className="intended-majors-page__wishlist-item-group-content">
                            {loadingGroupInfo ? (
                              <View className="intended-majors-page__wishlist-item-group-loading">
                                <Text>加载中...</Text>
                      </View>
                            ) : groupInfoData.length > 0 ? (
                              // 只显示用户已选择的专业（group.items），而不是专业组中的所有专业
                              group.items.map((item: any, itemIdx: number) => {
                                // 从groupInfoData中找到对应的plan信息
                                const matchedPlan = groupInfoData.find((plan: MajorGroupInfo) => 
                                  plan.enrollmentMajor === item.enrollmentMajor ||
                                  plan.remark === item.remark
                                ) || groupInfoData[0]
                                
                                // 从matchedPlan.scores中找到对应的score信息
                                const matchedScore = matchedPlan?.scores.find((score: any) => 
                                  score.majorName === item.enrollmentMajor ||
                                  score.majorName === item.majorName ||
                                  item.enrollmentMajor === score.majorName
                                ) || matchedPlan?.scores[0]
                                
                                // 标准化热爱能量值：如果值在0-1之间，乘以100取整
                                const normalizeLoveEnergy = (value: number | null): number | null => {
                                  if (value === null || value === undefined) return null
                                  if (value > 0 && value < 1) {
                                    return Math.floor(value * 100)
                                  }
                                  return value
                                }
                                
                                // 找出最低的热爱能量分数（基于matchedPlan的所有scores，使用标准化后的值）
                                const scores = matchedPlan?.scores
                                  .map((s: any) => normalizeLoveEnergy(s.loveEnergy))
                                  .filter((s: any) => s !== null && s > 0) as number[] || []
                                const minScore = scores.length > 0 ? Math.min(...scores) : null
                                
                                const loveEnergy = normalizeLoveEnergy(matchedScore?.loveEnergy || null)
                                const isLowest = minScore !== null && loveEnergy !== null && loveEnergy > 0 && 
                                  (loveEnergy === minScore || loveEnergy === minScore + 1)
                                
                                const historyScoreKey = `${groupKey}-history-${itemIdx}`
                                const isHistoryExpanded = expandedHistoryScores.has(historyScoreKey)
                                
                                return (
                                  <View key={itemIdx} className="intended-majors-page__wishlist-item-group-plan-item">
                                    {/* 专业编号（绿色圆圈）- 基于已选择的专业序号 */}
                                    <View className="intended-majors-page__wishlist-item-group-plan-item-number">
                                      <Text>{itemIdx + 1}</Text>
                                    </View>
                                      
                                      {/* 专业信息 */}
                                      <View className="intended-majors-page__wishlist-item-group-plan-item-content">
                                        {/* 专业名称和代码 */}
                                        <View className="intended-majors-page__wishlist-item-group-plan-item-header">
                                          <Text className="intended-majors-page__wishlist-item-group-plan-item-major">
                                            {item.enrollmentMajor || item.majorName || matchedScore?.majorName || '未知专业'}
                                            {matchedPlan?.enrollmentMajor && matchedPlan.enrollmentMajor !== (item.enrollmentMajor || item.majorName) ? ` (${matchedPlan.enrollmentMajor})` : ''}
                                          </Text>
                                        </View>
                                        
                                        {/* 专业详情 - 显示全面信息 */}
                                        <View className="intended-majors-page__wishlist-item-group-plan-item-details">
                                          {item.batch && (
                                            <Text>批次: {item.batch}</Text>
                                          )}
                                          {matchedPlan?.studyPeriod && (
                                            <Text>学制: {matchedPlan.studyPeriod}</Text>
                                          )}
                                          {matchedPlan?.enrollmentQuota && (
                                            <Text>招生人数: {matchedPlan.enrollmentQuota}</Text>
                                          )}
                                          {item.tuitionFee && (
                                            <Text>学费: {(() => {
                                              const fee = item.tuitionFee
                                              return fee.includes('元') ? fee : `${fee}元`
                                            })()}</Text>
                                          )}
                                          {item.subjectSelectionMode && (
                                            <Text>选科要求: {item.subjectSelectionMode}</Text>
                                          )}
                                          {item.majorGroupInfo && (
                                            <Text>专业组信息: {item.majorGroupInfo}</Text>
                                          )}
                                          {loveEnergy !== null && loveEnergy > 0 && (
                                            <Text className={isLowest ? 'intended-majors-page__wishlist-item-group-plan-item-love-energy--low' : ''}>
                                              热爱能量: {loveEnergy}
                                              {isLowest && ' ⚠️'}
                                            </Text>
                                          )}
                                          {(matchedPlan?.remark || item.remark) && (
                                            <Text className="intended-majors-page__wishlist-item-group-plan-item-remark">
                                              备注: {matchedPlan?.remark || item.remark}
                                            </Text>
                                          )}
                                        </View>
                                        
                                        {/* 历年分数（如果有） */}
                                        {item.historyScore && item.historyScore.length > 0 && (
                                          <>
                                            <View 
                                              className="intended-majors-page__wishlist-item-group-plan-item-history"
                            onClick={() => {
                                                setExpandedHistoryScores((prev) => {
                                                  const newSet = new Set(prev)
                                                  if (isHistoryExpanded) {
                                                    newSet.delete(historyScoreKey)
                                                  } else {
                                                    newSet.add(historyScoreKey)
                                                  }
                                                  return newSet
                                                })
                                              }}
                                            >
                                              <Text>历年分数</Text>
                                              <Text className={`intended-majors-page__wishlist-item-group-plan-item-history-arrow ${isHistoryExpanded ? 'intended-majors-page__wishlist-item-group-plan-item-history-arrow--expanded' : ''}`}>
                                                ▼
                            </Text>
                                            </View>
                                            
                                            {/* 历年分数详细内容 */}
                                            {isHistoryExpanded && (
                                              <View className="intended-majors-page__wishlist-item-group-plan-item-history-content">
                                                <View className="intended-majors-page__wishlist-item-group-plan-item-history-table">
                                                  <View className="intended-majors-page__wishlist-item-group-plan-item-history-header">
                                                    <Text>年份</Text>
                                                    <Text>最低分数</Text>
                                                    <Text>最低位次</Text>
                                                    <Text>招生人数</Text>
                                                  </View>
                                                  {item.historyScore[0].historyScore.map((score: any, scoreIdx: number) => {
                                                    const [year, data] = Object.entries(score)[0]
                                                    const [minScore, minRank, planNum] = String(data).split(',')
                                                    return (
                                                      <View key={scoreIdx} className="intended-majors-page__wishlist-item-group-plan-item-history-row">
                                                        <Text>{year}</Text>
                                                        <Text>{minScore || '-'}</Text>
                                                        <Text>{minRank || '-'}</Text>
                                                        <Text>{planNum || '-'}</Text>
                                                      </View>
                                                    )
                                                  })}
                                                </View>
                                                {item.historyScore[0].batch && (
                                                  <View className="intended-majors-page__wishlist-item-group-plan-item-history-batch">
                                                    <Text>{item.historyScore[0].batch}</Text>
                                                  </View>
                                                )}
                          </View>
                                            )}
                                          </>
                        )}
                        
                        {/* 移除按钮 */}
                        {item.id && (
                          <View className="intended-majors-page__wishlist-item-group-plan-item-actions">
                            <Button
                              onClick={() => {
                                setChoiceToDelete({
                                  choiceId: item.id,
                                  majorName: item.enrollmentMajor || item.majorName || matchedScore?.majorName || '该专业'
                                })
                                setDeleteConfirmOpen(true)
                              }}
                              className="intended-majors-page__wishlist-item-group-plan-item-remove-button"
                              size="sm"
                              variant="ghost"
                            >
                              <Text className="intended-majors-page__wishlist-item-group-plan-item-remove-text">移除</Text>
                            </Button>
                          </View>
                        )}
                                      </View>
                                    </View>
                                  )
                                })
                            ) : group.items.length > 0 ? (
                              // 如果API没有返回数据，使用group.items中的数据
                              group.items.map((item: any, itemIdx: number) => {
                                const historyScoreKey = `${groupKey}-history-${itemIdx}`
                                const isHistoryExpanded = expandedHistoryScores.has(historyScoreKey)
                                
                                return (
                                  <View key={itemIdx} className="intended-majors-page__wishlist-item-group-plan-item">
                                    {/* 专业编号（绿色圆圈） */}
                                    <View className="intended-majors-page__wishlist-item-group-plan-item-number">
                                      <Text>{itemIdx + 1}</Text>
                                    </View>
                                    
                                    {/* 专业信息 */}
                                    <View className="intended-majors-page__wishlist-item-group-plan-item-content">
                                      {/* 专业名称和代码 */}
                                      <View className="intended-majors-page__wishlist-item-group-plan-item-header">
                                        {item.enrollmentMajor && (
                                          <Text className="intended-majors-page__wishlist-item-group-plan-item-major">
                                            {item.enrollmentMajor}
                                          </Text>
                                        )}
                                      </View>
                                      
                                      {/* 专业详情 - 显示全面信息 */}
                                      <View className="intended-majors-page__wishlist-item-group-plan-item-details">
                                        {item.batch && (
                                          <Text>批次: {item.batch}</Text>
                                        )}
                                        {item.studyPeriod && (
                                          <Text>学制: {item.studyPeriod}</Text>
                                        )}
                                        {item.enrollmentQuota && (
                                          <Text>招生人数: {item.enrollmentQuota}</Text>
                                        )}
                                        {item.tuitionFee && (
                                          <Text>学费: {item.tuitionFee.includes('元') ? item.tuitionFee : `${item.tuitionFee}元`}</Text>
                                        )}
                                        {item.subjectSelectionMode && (
                                          <Text>选科要求: {item.subjectSelectionMode}</Text>
                                        )}
                                        {item.majorGroupInfo && (
                                          <Text>专业组信息: {item.majorGroupInfo}</Text>
                                        )}
                                        {item.remark && (
                                          <Text className="intended-majors-page__wishlist-item-group-plan-item-remark">
                                            备注: {item.remark}
                                          </Text>
                                        )}
                                      </View>
                                      
                                      {/* 历年分数（如果有） */}
                                      {item.historyScore && item.historyScore.length > 0 && (
                                        <>
                                          <View 
                                            className="intended-majors-page__wishlist-item-group-plan-item-history"
                            onClick={() => {
                              setExpandedHistoryScores((prev) => {
                                const newSet = new Set(prev)
                                                if (isHistoryExpanded) {
                                                  newSet.delete(historyScoreKey)
                                } else {
                                                  newSet.add(historyScoreKey)
                                }
                                return newSet
                              })
                            }}
                          >
                            <Text>历年分数</Text>
                                            <Text className={`intended-majors-page__wishlist-item-group-plan-item-history-arrow ${isHistoryExpanded ? 'intended-majors-page__wishlist-item-group-plan-item-history-arrow--expanded' : ''}`}>
                              ▼
                            </Text>
                                          </View>
                                          
                                          {/* 历年分数详细内容 */}
                                          {isHistoryExpanded && (
                                            <View className="intended-majors-page__wishlist-item-group-plan-item-history-content">
                                              <View className="intended-majors-page__wishlist-item-group-plan-item-history-table">
                                                <View className="intended-majors-page__wishlist-item-group-plan-item-history-header">
                                  <Text>年份</Text>
                                                  <Text>最低分数</Text>
                                  <Text>最低位次</Text>
                                                  <Text>招生人数</Text>
                                </View>
                                                {item.historyScore[0].historyScore.map((score: any, scoreIdx: number) => {
                                  const [year, data] = Object.entries(score)[0]
                                  const [minScore, minRank, planNum] = String(data).split(',')
                                  return (
                                                    <View key={scoreIdx} className="intended-majors-page__wishlist-item-group-plan-item-history-row">
                                      <Text>{year}</Text>
                                                      <Text>{minScore || '-'}</Text>
                                                      <Text>{minRank || '-'}</Text>
                                                      <Text>{planNum || '-'}</Text>
                                    </View>
                                  )
                                })}
                              </View>
                                  {item.historyScore[0].batch && (
                                                <View className="intended-majors-page__wishlist-item-group-plan-item-history-batch">
                                                  <Text>{item.historyScore[0].batch}</Text>
                                                </View>
                                  )}
                                </View>
                                          )}
                                        </>
                                      )}
                                      
                                      {/* 移除按钮 */}
                                      {item.id && (
                                        <View className="intended-majors-page__wishlist-item-group-plan-item-actions">
                                          <Button
                                            onClick={() => {
                                              setChoiceToDelete({
                                                choiceId: item.id,
                                                majorName: item.enrollmentMajor || item.majorName || '该专业'
                                              })
                                              setDeleteConfirmOpen(true)
                                            }}
                                            className="intended-majors-page__wishlist-item-group-plan-item-remove-button"
                                            size="sm"
                                            variant="ghost"
                                          >
                                            <Text className="intended-majors-page__wishlist-item-group-plan-item-remove-text">移除</Text>
                                          </Button>
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                )
                              })
                            ) : (
                              <View className="intended-majors-page__wishlist-item-group-empty">
                                <Text>暂无专业组信息</Text>
                            </View>
                          )}
                        </View>
                      )}
                        
                        {/* 操作按钮 */}
                        <View className="intended-majors-page__wishlist-item-actions">
                          <View className="intended-majors-page__wishlist-item-move-buttons">
                            {idx > 0 && (
                          <Button
                                onClick={() => {
                                  // 移动专业组逻辑
                                  const firstItemInGroup = group.items[0]
                                  if (firstItemInGroup.mgIndex !== null) {
                                    adjustMgIndex({ 
                                      mgIndex: firstItemInGroup.mgIndex, 
                                      direction: 'up' as Direction 
                                    }).then(() => {
                                      loadChoicesFromAPI()
                                    })
                                  }
                                }}
                                className="intended-majors-page__wishlist-item-move-button intended-majors-page__wishlist-item-move-button--up"
                            size="sm"
                            variant="ghost"
                          >
                                <Text className="intended-majors-page__wishlist-item-move-text">上移</Text>
                          </Button>
                            )}
                            {idx < groupedArray.length - 1 && (
                          <Button
                            onClick={() => {
                                  // 移动专业组逻辑
                                  const firstItemInGroup = group.items[0]
                                  if (firstItemInGroup.mgIndex !== null) {
                                    adjustMgIndex({ 
                                      mgIndex: firstItemInGroup.mgIndex, 
                                      direction: 'down' as Direction 
                                    }).then(() => {
                                      loadChoicesFromAPI()
                                    })
                                  }
                                }}
                                className="intended-majors-page__wishlist-item-move-button intended-majors-page__wishlist-item-move-button--down"
                            size="sm"
                            variant="ghost"
                          >
                                <Text className="intended-majors-page__wishlist-item-move-text">下移</Text>
                          </Button>
                        )}
                          </View>
                          <Button
                            onClick={() => {
                              // 显示删除确认对话框
                              setGroupToDelete({
                                items: group.items,
                                schoolName: group.schoolName,
                                majorGroupName: majorGroupName || '未命名专业组'
                              })
                              setDeleteConfirmOpen(true)
                            }}
                            className="intended-majors-page__wishlist-item-delete"
                            size="sm"
                            variant="ghost"
                          >
                            <Text className="intended-majors-page__wishlist-item-delete-text">移除</Text>
                          </Button>
                                </View>
                    </View>
                  </Card>
                )
                })
              })()}
              <Card 
                className="intended-majors-page__add-more"
                onClick={() => {
                  Taro.redirectTo({
                    url: '/pages/majors/intended/index?tab=专业赛道'
                  })
                }}
              >
                <View className="intended-majors-page__add-more-content">
                  <Text className="intended-majors-page__add-more-icon">➕</Text>
                  <Text className="intended-majors-page__add-more-text">
                    热爱能量高的专业({top20PercentCount}个)较少,继续添加
                  </Text>
                </View>
              </Card>
            </View>
          )
        ) : (
          // 专业赛道tab - 使用API数据（按收藏专业分组）
          enrollmentPlans.length === 0 ? (
            <View className="intended-majors-page__empty">
              <Text className="intended-majors-page__empty-icon">📚</Text>
              <Text className="intended-majors-page__empty-text">暂无数据</Text>
              <Text className="intended-majors-page__empty-desc">暂无院校探索数据，请稍后再试</Text>
            </View>
          ) : (
            <View className="intended-majors-page__majors-list">
              {enrollmentPlans.map((plan) => {
                const major = plan.majorFavorite.major
                const majorCode = plan.majorFavorite.majorCode
                return (
                  <Card key={majorCode} className="intended-majors-page__major-item">
                    <View className="intended-majors-page__major-item-content">
                      <View className="intended-majors-page__major-item-header">
                        <View>
                          <Text 
                            className="intended-majors-page__major-item-name"
                            onClick={() => {
                              // 跳转到专业详情页面
                              Taro.navigateTo({
                                url: `/pages/assessment/single-major/index?code=${majorCode}&name=${encodeURIComponent(major.name || '')}`
                              })
                            }}
                          >
                            {major.name}
                          </Text>
                          <Text className="intended-majors-page__major-item-code">({major.code})</Text>
                          {wishlistCounts[majorCode] > 0 && (
                            <View className="intended-majors-page__major-item-badge">
                              <Text>{wishlistCounts[majorCode]} 个志愿</Text>
                            </View>
                          )}
                        </View>
                        <Button
                          onClick={() => {
                            // 传递 majorId 和 majorCode，院校列表页面可以根据 majorId 调用 API
                            Taro.navigateTo({
                              url: `/pages/majors/intended/schools/index?majorCode=${majorCode}&majorId=${major.id}`
                            })
                          }}
                          className="intended-majors-page__major-item-link"
                          variant="ghost"
                        >
                          <Text className="intended-majors-page__major-item-link-number">{plan.schoolCount}所</Text>
                          <Text className="intended-majors-page__major-item-link-arrow">→</Text>
                        </Button>
                      </View>
                      <View className="intended-majors-page__major-item-info">
                        <View className="intended-majors-page__major-item-tag">
                          <Text>
                            {(() => {
                              // 教育层次映射：ben -> 本科, zhuan -> 专科, gao_ben -> 高职本科
                              const eduLevelMap: Record<string, string> = {
                                'ben': '本科',
                                'zhuan': '专科',
                                'gao_ben': '高职本科'
                              }
                              return eduLevelMap[major.eduLevel || ''] || '本科'
                            })()}
                          </Text>
                        </View>
                        <View className="intended-majors-page__major-item-score">
                          <Text className="intended-majors-page__major-item-score-label">热爱能量:</Text>
                          <Text className="intended-majors-page__major-item-score-value">
                            {(() => {
                              // 标准化热爱能量值：如果值在0-1之间，乘以100取整
                              const normalizeLoveEnergy = (value: number | string | null | undefined): number | null => {
                                if (value === null || value === undefined) return null
                                const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
                                if (isNaN(numValue)) return null
                                if (numValue > 0 && numValue < 1) {
                                  return Math.floor(numValue * 100)
                                }
                                return Math.round(numValue)
                              }
                              
                              // 处理 score 值：可能是数字或字符串
                              const normalizedScore = normalizeLoveEnergy(plan.score)
                              return normalizedScore !== null ? normalizedScore.toString() : '-'
                            })()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Card>
                )
              })}
            </View>
          )
        )}
      </View>

      <BottomNav />

      {/* 返回顶部按钮 */}
      {showBackToTop && activeTab === '意向志愿' && (
        <Button
          onClick={scrollToTop}
          className="intended-majors-page__back-to-top"
          size="icon"
        >
          ↑
        </Button>
      )}

      {/* 高考信息对话框 */}
      <ExamInfoDialog 
        open={showExamInfoDialog} 
        onOpenChange={setShowExamInfoDialog}
        examInfo={examInfo || undefined}
        onUpdate={loadExamInfo}
      />

      {/* 删除确认对话框 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              {choiceToDelete
                ? `确定要删除专业"${choiceToDelete.majorName}"吗？此操作无法撤销。`
                : groupToDelete 
                ? `确定要删除"${groupToDelete.schoolName} - ${groupToDelete.majorGroupName}"专业组吗？此操作将删除该专业组下的所有志愿项，且无法撤销。`
                : '确定要删除此志愿项吗？此操作无法撤销。'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setDeleteConfirmOpen(false)
                setChoiceToDelete(null)
                setGroupToDelete(null)
                setItemToDelete(null)
              }}
              variant="outline"
            >
              取消
            </Button>
            <Button
              onClick={confirmDeleteWishlistItem}
              className="intended-majors-page__delete-button"
            >
              确定删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 专业组信息对话框 */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="intended-majors-page__group-dialog">
          <DialogHeader>
            <DialogTitle>
              {selectedGroupInfo?.schoolName} - {selectedGroupInfo?.majorGroupName} 专业组信息
            </DialogTitle>
          </DialogHeader>
          <View className="intended-majors-page__group-dialog-content">
            {groupDataList.length === 0 ? (
              <View className="intended-majors-page__group-dialog-empty">
                <Text>暂无专业组信息</Text>
                <Text className="intended-majors-page__group-dialog-empty-desc">数据未加载或为空</Text>
              </View>
            ) : (
              (() => {
                const groupedByInfo = groupDataList.reduce((acc, item) => {
                  const key = item.majorGroupInfo || '未分组'
                  if (!acc[key]) {
                    acc[key] = []
                  }
                  acc[key].push(item)
                  return acc
                }, {} as Record<string, typeof groupDataList>)

                return Object.entries(groupedByInfo).map(([groupInfo, majors]) => {
                  // 标准化热爱能量值：如果值在0-1之间，乘以100取整
                  const normalizeLoveEnergy = (value: any): number | null => {
                    if (value === null || value === undefined) return null
                    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
                    if (isNaN(numValue)) return null
                    if (numValue > 0 && numValue < 1) {
                      return Math.floor(numValue * 100)
                    }
                    return Math.round(numValue)
                  }
                  
                  const majorsList = majors as any[]
                  const scores = majorsList
                    .map((m: any) => normalizeLoveEnergy(m.developmentPotential))
                    .filter((s: number | null): s is number => s !== null && s > 0)
                  const minScore = scores.length > 0 ? Math.min(...scores) : null
                  const lowestScoreMajors = minScore !== null 
                    ? majorsList.filter((m: any) => {
                        const score = normalizeLoveEnergy(m.developmentPotential)
                        return score !== null && score > 0 && (score === minScore || score === minScore + 1)
                      })
                    : []
                  
                  return (
                    <View key={groupInfo} className="intended-majors-page__group-section">
                      {lowestScoreMajors.length > 0 && (
                        <View className="intended-majors-page__group-warning">
                          <Text className="intended-majors-page__group-warning-title">⚠️ 提醒</Text>
                          <Text className="intended-majors-page__group-warning-text">
                            该专业组中包含热爱能量低的专业，选择该专业组可能会被调剂到这些专业，请谨慎选择。
                          </Text>
                        </View>
                      )}
                      <Text className="intended-majors-page__group-section-title">{groupInfo}</Text>
                      <View className="intended-majors-page__group-table">
                        <View className="intended-majors-page__group-table-header">
                          <Text>专业</Text>
                          <Text>批次</Text>
                          <Text>招生人数</Text>
                          <Text>学费</Text>
                          <Text>学制</Text>
                          <Text>热爱能量</Text>
                        </View>
                        {majorsList.map((major: any, idx: number) => {
                          const score = normalizeLoveEnergy(major.developmentPotential)
                          const isLowest = minScore !== null && score !== null && score > 0 && (score === minScore || score === minScore + 1)
                          
                          return (
                            <View 
                              key={idx} 
                              className={`intended-majors-page__group-table-row ${isLowest ? 'intended-majors-page__group-table-row--warning' : ''}`}
                            >
                              <View>
                                <Text className="intended-majors-page__group-table-major-name">{major.majorName}</Text>
                              </View>
                              <Text>{major.batch || '-'}</Text>
                              <Text>{major.num || '-'}</Text>
                              <Text>{major.tuition ? `${major.tuition}元` : '-'}</Text>
                              <Text>{major.studyPeriod || '-'}</Text>
                              <View className="intended-majors-page__group-table-score">
                                <Text className={isLowest ? 'intended-majors-page__group-table-score--low' : ''}>
                                  {score !== null ? score : '-'}
                                </Text>
                                {isLowest && <Text>⚠️</Text>}
                              </View>
                            </View>
                          )
                        })}
                      </View>
                    </View>
                  )
                })
              })()
            )}
          </View>
        </DialogContent>
      </Dialog>

      {/* 问卷完成提示弹窗 */}
      <QuestionnaireRequiredModal
        open={showQuestionnaireModal}
        onOpenChange={setShowQuestionnaireModal}
        answerCount={answerCount}
      />
    </View>
  )
}

