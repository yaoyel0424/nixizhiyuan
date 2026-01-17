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
import { getChoices, deleteChoice, adjustMgIndex, adjustMajorIndex, GroupedChoiceResponse, ChoiceInGroup, Direction, createChoice, CreateChoiceDto } from '@/services/choices'
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
  majorGroupId?: number
}

interface IntentionMajor {
  major: Major
  schools: School[]
}

// 3+3模式省份列表（提交时 preferredSubjects 统一填写"综合"）
const PROVINCES_3_3_MODE = ['北京', '上海', '浙江', '天津', '山东', '海南', '西藏', '新疆']

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
    
    // 判断是否为3+3模式省份
    const is3Plus3Mode = PROVINCES_3_3_MODE.includes(selectedProvince)
    // 3+3模式省份使用"综合"，其他模式需要 firstChoice
    const subjectType = is3Plus3Mode ? '综合' : firstChoice
    
    // 检查必要参数是否齐全
    if (!selectedProvince || !subjectType) {
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
        subjectType,
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
      // 判断是否为3+3模式省份
      const is3Plus3Mode = PROVINCES_3_3_MODE.includes(province)
      
      const updatedInfo: ExamInfo = {
        province,
        // 3+3模式省份：preferredSubjects 统一填写"综合"，选科信息放在 secondarySubjects
        preferredSubjects: is3Plus3Mode ? '综合' : (firstChoice || undefined),
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
      
      // 判断是否为3+3模式省份
      const is3Plus3Mode = PROVINCES_3_3_MODE.includes(selectedProvince)
      
      // 准备更新数据
      const updateData: ExamInfo = {
        province: selectedProvince,
        // 3+3模式省份：preferredSubjects 统一填写"综合"，选科信息放在 secondarySubjects
        preferredSubjects: is3Plus3Mode ? '综合' : (firstChoice || undefined),
        secondarySubjects: optionalSubjects.size > 0 ? Array.from(optionalSubjects).join(',') : undefined,
        score: totalScore ? parseInt(totalScore, 10) : undefined,
        rank: ranking ? parseInt(ranking, 10) : undefined,
      }

      // 调用 API 更新
      const updatedInfo = await updateExamInfo(updateData)

      // 同时保存到本地存储（作为备份）
      await setStorage('examProvince', selectedProvince)
      // 3+3模式省份保存"综合"，其他模式保存 firstChoice
      const savedFirstChoice = is3Plus3Mode ? '综合' : firstChoice
      if (savedFirstChoice) {
        await setStorage('examFirstChoice', savedFirstChoice)
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
  const [groupInfoData, setGroupInfoData] = useState<MajorGroupInfo[]>([]) // 专业组详细信息
  const [loadingGroupInfo, setLoadingGroupInfo] = useState(false)
  const [selectedSchoolData, setSelectedSchoolData] = useState<School | null>(null)
  const [selectedPlanData, setSelectedPlanData] = useState<any | null>(null) // 保存选中的plan数据
  const [expandedChoicesInGroup, setExpandedChoicesInGroup] = useState<Set<string>>(new Set()) // 展开的专业组内的志愿列表
  const [expandedScores, setExpandedScores] = useState<Set<number>>(new Set()) // 展开的 scores 列表索引（用于多个 scores 的展开）

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

  // 判断plan是否已加入志愿（根据专业组名称和备注匹配）
  const isPlanInWishlist = (plan: MajorGroupInfo): { isIn: boolean; choiceId?: number } => {
    if (!selectedSchoolData || !selectedGroupInfo) {
      return { isIn: false }
    }
    
    // 获取目标专业组信息
    const targetMajorGroupName = selectedGroupInfo.majorGroupName
    // 从 selectedGroupInfo 或 selectedPlanData 获取 majorGroupId
    const targetMajorGroupId = selectedGroupInfo.majorGroupId || selectedPlanData?.majorGroupId || selectedPlanData?.majorGroup?.mgId || null
    const targetRemark = selectedPlanData?.remark || plan.remark || null
    const targetEnrollmentMajor = plan.enrollmentMajor || selectedPlanData?.enrollmentMajor || null
    
    if (!targetMajorGroupName && !targetMajorGroupId) {
      return { isIn: false }
    }
    
    // 获取学校代码（从 groupedChoices 中获取）
    let schoolCode: string | undefined
    if (groupedChoices && groupedChoices.volunteers.length > 0) {
      const volunteer = groupedChoices.volunteers.find(v => v.school.name === selectedSchoolData.schoolName)
      schoolCode = volunteer?.school.code
    }
    
    // 优先从 groupedChoices 中查找（最准确，直接从API返回的数据判断）
    if (groupedChoices && groupedChoices.volunteers.length > 0) {
      // 遍历所有志愿者，查找匹配的学校
      for (const volunteer of groupedChoices.volunteers) {
        // 匹配学校：优先通过学校代码，其次通过学校名称
        const isSchoolMatch = 
          (schoolCode && volunteer.school.code === schoolCode) ||
          volunteer.school.name === selectedSchoolData.schoolName ||
          volunteer.school.name?.trim() === selectedSchoolData.schoolName?.trim()
        
        if (isSchoolMatch) {
          // 遍历该学校下的所有专业组
          for (const majorGroup of volunteer.majorGroups) {
            // 遍历该专业组下的所有 choice
            for (const choice of majorGroup.choices) {
              // 获取志愿中的专业组信息
              const choiceMajorGroupName = choice.majorGroupInfo || majorGroup.majorGroup?.mgName || null
              const choiceMajorGroupId = choice.majorGroupId || majorGroup.majorGroup?.mgId || null
              const choiceRemark = choice.remark || null
              const choiceEnrollmentMajor = choice.enrollmentMajor || null
              
              // 优先使用 majorGroupId 匹配（最准确）
              let isGroupMatch = false
              if (targetMajorGroupId && choiceMajorGroupId) {
                isGroupMatch = (targetMajorGroupId === choiceMajorGroupId)
              } else if (targetMajorGroupName && choiceMajorGroupName) {
                // 如果没有 majorGroupId，则使用名称匹配（精确匹配）
                isGroupMatch = (
                  choiceMajorGroupName === targetMajorGroupName ||
                  choiceMajorGroupName.trim() === targetMajorGroupName.trim()
                )
              }
              
              if (!isGroupMatch) {
                // 如果专业组不匹配，直接跳过
                continue
              }
              
              // 匹配备注（必须精确匹配）
              let isRemarkMatch = false
              if (!targetRemark && !choiceRemark) {
                isRemarkMatch = true
              } else if (targetRemark && choiceRemark) {
                isRemarkMatch = (
                  choiceRemark === targetRemark ||
                  choiceRemark.trim() === targetRemark.trim()
                )
              } else {
                isRemarkMatch = false
              }
              
              // 匹配招生专业（必须精确匹配）
              let isEnrollmentMajorMatch = false
              const targetMajor = targetEnrollmentMajor?.trim() || null
              const choiceMajor = choiceEnrollmentMajor?.trim() || null
              
              if (!targetMajor && !choiceMajor) {
                isEnrollmentMajorMatch = true
              } else if (targetMajor && choiceMajor) {
                isEnrollmentMajorMatch = (choiceMajor === targetMajor)
              } else {
                isEnrollmentMajorMatch = false
              }
              
              // 只有当专业组名称匹配，且备注和招生专业都匹配时，才认为已加入志愿
              if (isRemarkMatch && isEnrollmentMajorMatch) {
                return { isIn: true, choiceId: choice.id }
              }
            }
          }
        }
      }
    }
    
    return { isIn: false }
  }

  // 处理plan加入志愿
  const handleAddPlanToWishlist = async (plan: MajorGroupInfo) => {
    if (!selectedSchoolData || !selectedGroupInfo) {
      Taro.showToast({
        title: '学校信息缺失',
        icon: 'none'
      })
      return
    }

    const { isIn, choiceId } = isPlanInWishlist(plan)
    
    if (isIn && choiceId) {
      // 移除志愿（显示确认框）
      setChoiceToDelete({
        choiceId,
        majorName: plan.enrollmentMajor || '该专业'
      })
      setDeleteConfirmOpen(true)
      return
    }

    try {
      // 找到对应的plan数据
      let matchedPlan: any = selectedPlanData
      
      if (!matchedPlan) {
        // 如果没有 selectedPlanData，尝试从 groupedChoices 中获取信息
        // 或者使用 plan 数据本身
        matchedPlan = {
          majorGroupId: selectedGroupInfo.majorGroupId || null,
          schoolCode: groupedChoices?.volunteers.find(v => v.school.name === selectedSchoolData.schoolName)?.school.code || null,
          enrollmentMajor: plan.enrollmentMajor || null,
          batch: null,
          majorGroupInfo: null,
          subjectSelectionMode: null,
          studyPeriod: plan.studyPeriod || null,
          enrollmentQuota: plan.enrollmentQuota || null,
          remark: plan.remark || null,
          tuitionFee: null,
          curUnit: null,
          majorScores: null,
        }
      }

      // 构建创建志愿的DTO
      const createChoiceDto: CreateChoiceDto = {
        mgId: matchedPlan.majorGroupId || selectedGroupInfo.majorGroupId || null,
        schoolCode: matchedPlan.schoolCode || groupedChoices?.volunteers.find(v => v.school.name === selectedSchoolData.schoolName)?.school.code || null,
        enrollmentMajor: plan.enrollmentMajor || matchedPlan.enrollmentMajor || null,
        batch: matchedPlan.batch || null,
        majorGroupInfo: matchedPlan.majorGroupInfo || null,
        subjectSelectionMode: matchedPlan.subjectSelectionMode || null,
        studyPeriod: plan.studyPeriod || matchedPlan.studyPeriod || null,
        enrollmentQuota: plan.enrollmentQuota || matchedPlan.enrollmentQuota || null,
        remark: plan.remark || matchedPlan.remark || null,
        tuitionFee: matchedPlan.tuitionFee || null,
        curUnit: matchedPlan.curUnit || null,
        majorScores: matchedPlan.majorScores?.map((score: any) => ({
          schoolCode: score.schoolCode,
          province: score.province,
          year: score.year,
          subjectSelectionMode: score.subjectSelectionMode,
          batch: score.batch,
          minScore: score.minScore,
          minRank: score.minRank,
          admitCount: score.admitCount,
          enrollmentType: score.enrollmentType,
        })) || null,
      }

      // 调用API创建志愿
      await createChoice(createChoiceDto)

      // 重新加载志愿列表
      await loadChoicesFromAPI()

      Taro.showToast({
        title: '已加入志愿',
        icon: 'success',
        duration: 2000
      })
    } catch (error: any) {
      console.error('加入志愿失败:', error)
      Taro.showToast({
        title: error?.message || '加入志愿失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
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
              {groupedChoices && groupedChoices.volunteers.length > 0 ? (
                // 直接使用 groupedChoices 的数据结构，按照 volunteers -> majorGroups -> choices 的顺序显示
                groupedChoices.volunteers
                  .sort((a, b) => (a.mgIndex ?? 999999) - (b.mgIndex ?? 999999))
                  .map((volunteer, volunteerIdx) => {
                    const volunteerNumber = volunteerIdx + 1
                    const school = volunteer.school
                    const schoolFeatures = school?.features || ''
                    const provinceName = school?.provinceName || ''
                    const cityName = school?.cityName || ''
                    const belong = school?.belong || ''
                    const enrollmentRate = school?.enrollmentRate ? `${school.enrollmentRate}` : '0'
                    const employmentRate = school?.employmentRate ? `${school.employmentRate}` : '0'
                    
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
                    
                    return (
                      <Card key={`volunteer-${volunteer.mgIndex}`} className="intended-majors-page__wishlist-item">
                        <View className="intended-majors-page__wishlist-item-content">
                          {/* 志愿编号和操作按钮（删除、上移、下移）- 同一行 */}
                          <View className="intended-majors-page__wishlist-item-header-row">
                            <View className="intended-majors-page__wishlist-item-volunteer-badge">
                              <Text className="intended-majors-page__wishlist-item-volunteer-text">志愿{volunteerNumber}</Text>
                            </View>
                            {/* 专业组的删除、上移、下移按钮 - 放到志愿编号同一行的右侧 */}
                            <View className="intended-majors-page__wishlist-item-volunteer-actions">
                              {/* 删除按钮：删除整个志愿（所有 majorGroups） */}
                              <Button
                                onClick={async () => {
                                  // 收集所有 choices
                                  const allChoices = volunteer.majorGroups.flatMap(mg => mg.choices)
                                  setGroupToDelete({
                                    items: allChoices.map(c => ({ id: c.id, enrollmentMajor: c.enrollmentMajor })),
                                    schoolName: school?.name || '',
                                    majorGroupName: '该志愿'
                                  })
                                  setDeleteConfirmOpen(true)
                                }}
                                className="intended-majors-page__wishlist-item-major-group-delete"
                                size="sm"
                                variant="ghost"
                              >
                                <Text className="intended-majors-page__wishlist-item-major-group-delete-text">删除</Text>
                              </Button>
                              {/* 上移按钮：移动整个志愿 - 始终显示 */}
                              {(() => {
                                const currentVolunteerIndex = groupedChoices?.volunteers.findIndex(v => v.mgIndex === volunteer.mgIndex) ?? -1
                                const canMoveUp = currentVolunteerIndex > 0
                                
                                return (
                                  <Button
                                    onClick={async () => {
                                      if (!canMoveUp || volunteer.mgIndex === null) return
                                      await adjustMgIndex({ 
                                        mgIndex: volunteer.mgIndex, 
                                        direction: 'up' as Direction 
                                      })
                                      await loadChoicesFromAPI()
                                      Taro.showToast({
                                        title: '移动成功',
                                        icon: 'success',
                                        duration: 1500
                                      })
                                    }}
                                    className="intended-majors-page__wishlist-item-major-group-move"
                                    size="sm"
                                    variant="ghost"
                                    disabled={!canMoveUp || volunteer.mgIndex === null}
                                  >
                                    <Text className="intended-majors-page__wishlist-item-major-group-move-text">上移</Text>
                                  </Button>
                                )
                              })()}
                              {/* 下移按钮：移动整个志愿 - 始终显示 */}
                              {(() => {
                                const currentVolunteerIndex = groupedChoices?.volunteers.findIndex(v => v.mgIndex === volunteer.mgIndex) ?? -1
                                const canMoveDown = currentVolunteerIndex < (groupedChoices?.volunteers.length ?? 0) - 1
                                
                                return (
                                  <Button
                                    onClick={async () => {
                                      if (!canMoveDown || volunteer.mgIndex === null) return
                                      await adjustMgIndex({ 
                                        mgIndex: volunteer.mgIndex, 
                                        direction: 'down' as Direction 
                                      })
                                      await loadChoicesFromAPI()
                                      Taro.showToast({
                                        title: '移动成功',
                                        icon: 'success',
                                        duration: 1500
                                      })
                                    }}
                                    className="intended-majors-page__wishlist-item-major-group-move"
                                    size="sm"
                                    variant="ghost"
                                    disabled={!canMoveDown || volunteer.mgIndex === null}
                                  >
                                    <Text className="intended-majors-page__wishlist-item-major-group-move-text">下移</Text>
                                  </Button>
                                )
                              })()}
                            </View>
                          </View>
                          
                          {/* 学校相关信息 - 放到志愿编号下面 */}
                          <View className="intended-majors-page__wishlist-item-school-section">
                            {/* 学校名称 + 省份/城市/归属（同一行） */}
                            <View className="intended-majors-page__wishlist-item-name-row">
                              <Text className="intended-majors-page__wishlist-item-school">
                                {school?.name || ''}
                              </Text>
                              {(() => {
                                const locationParts: string[] = []
                                if (provinceName) locationParts.push(provinceName)
                                if (cityName) locationParts.push(cityName)
                                if (belong) locationParts.push(belong)
                                
                                return locationParts.length > 0 ? (
                                  <Text className="intended-majors-page__wishlist-item-location-inline">
                                    {locationParts.join(' · ')}
                                  </Text>
                                ) : null
                              })()}
                            </View>
                            {/* features（下一行，如果有） */}
                            {validFeatures.length > 0 && (
                              <View className="intended-majors-page__wishlist-item-features">
                                {validFeatures.map((feature, i) => (
                                  <Text key={i} className="intended-majors-page__wishlist-item-feature">
                                    {feature.trim()}
                                  </Text>
                                ))}
                              </View>
                            )}
                            {/* 升学率/就业率（下一行） */}
                            <View className="intended-majors-page__wishlist-item-rates">
                              <View className="intended-majors-page__wishlist-item-rate">
                                <Text className="intended-majors-page__wishlist-item-rate-label">升学率:</Text>
                                <Text className="intended-majors-page__wishlist-item-rate-value">{enrollmentRate}%</Text>
                              </View>
                              <View className="intended-majors-page__wishlist-item-rate">
                                <Text className="intended-majors-page__wishlist-item-rate-label">就业率:</Text>
                                <Text className="intended-majors-page__wishlist-item-rate-value">{employmentRate}%</Text>
                              </View>
                            </View>
                          </View>
                          
                          {/* 先显示 majorGroups */}
                          {volunteer.majorGroups.map((majorGroup, mgIdx) => {
                            const majorGroupName = majorGroup.majorGroup?.mgName || ''
                            // 使用 majorGroup.majorGroup.mgId 作为专业组ID
                            const mgId = majorGroup.majorGroup?.mgId
                            const majorGroupInfo = majorGroup.choices[0]?.majorGroupInfo || majorGroup.majorGroup?.mgInfo || ''
                            const groupKey = `${volunteer.mgIndex}-${mgId}-${mgIdx}`
                            const isChoicesExpanded = expandedChoicesInGroup.has(groupKey)
                            const choicesCount = majorGroup.choices.length
                            const sortedChoices = [...majorGroup.choices].sort((a, b) => (a.majorIndex ?? 999999) - (b.majorIndex ?? 999999))
                            
                            return (
                              <View key={`majorGroup-${mgIdx}`} className="intended-majors-page__wishlist-item-major-group" data-major-group="true">
                                {/* majorGroup 信息显示区域 - 专业组和选科同一行 */}
                                {majorGroup.majorGroup && (
                                  <View className="intended-majors-page__wishlist-item-major-group-info">
                                    <View className="intended-majors-page__wishlist-item-major-group-header">
                                      <View className="intended-majors-page__wishlist-item-major-group-header-left">
                                        <Text 
                                          className="intended-majors-page__wishlist-item-major-group-name" 
                                          data-major-group-name="true"
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            if (!mgId) {
                                              Taro.showToast({
                                                title: '专业组ID缺失',
                                                icon: 'none'
                                              })
                                              return
                                            }
                                            try {
                                              setLoadingGroupInfo(true)
                                              setSelectedGroupInfo({
                                                schoolName: school?.name || '',
                                                majorGroupName: majorGroupName,
                                                majorGroupId: mgId,
                                              })
                                              setSelectedSchoolData({
                                                schoolName: school?.name || '',
                                                schoolNature: school?.nature || 'public',
                                                rankDiffPer: 0,
                                                group: 0,
                                                historyScores: [],
                                                schoolFeature: schoolFeatures,
                                                belong: belong,
                                                provinceName: provinceName,
                                                cityName: cityName,
                                                enrollmentRate: enrollmentRate,
                                                employmentRate: employmentRate,
                                                majorGroupName: majorGroupName,
                                                majorGroupId: mgId,
                                              })
                                              // 使用第一个 choice 的数据作为 selectedPlanData
                                              const firstChoice = majorGroup.choices[0]
                                              setSelectedPlanData({
                                                enrollmentMajor: firstChoice?.enrollmentMajor || null,
                                                remark: firstChoice?.remark || null,
                                                subjectSelectionMode: firstChoice?.subjectSelectionMode || null,
                                                enrollmentQuota: firstChoice?.enrollmentQuota || null,
                                                studyPeriod: firstChoice?.studyPeriod || null,
                                                tuitionFee: firstChoice?.tuitionFee || null,
                                                batch: firstChoice?.batch || null,
                                                majorGroupId: mgId,
                                              } as any)
                                              
                                              // 调用 API 获取专业组信息
                                              // 确保 mgId 是数字类型
                                              const mgIdNumber = typeof mgId === 'string' ? parseInt(mgId, 10) : mgId
                                              if (!mgIdNumber || isNaN(mgIdNumber)) {
                                                Taro.showToast({
                                                  title: '专业组ID无效',
                                                  icon: 'none'
                                                })
                                                return
                                              }
                                              console.log('准备获取专业组信息，mgId:', mgIdNumber)
                                              const groupInfo = await getMajorGroupInfo(mgIdNumber)
                                              console.log('获取到的专业组信息:', groupInfo)
                                              setGroupInfoData(groupInfo)
                                              setGroupDialogOpen(true)
                                              console.log('设置弹框打开，groupDialogOpen:', true)
                                            } catch (error) {
                                              console.error('获取专业组信息失败:', error)
                                              Taro.showToast({
                                                title: '获取专业组信息失败',
                                                icon: 'none',
                                              })
                                            } finally {
                                              setLoadingGroupInfo(false)
                                            }
                                          }}
                                        >
                                          专业组: {majorGroupName}
                                        </Text>
                                        {majorGroupInfo && (
                                          <Text className="intended-majors-page__wishlist-item-major-group-subject">
                                            选科: {majorGroupInfo}
                                          </Text>
                                        )}
                                      </View>
                                      {/* 折叠/展开按钮 - 放到同一行右侧 */}
                                      <Text 
                                        className="intended-majors-page__wishlist-item-major-group-toggle"
                                        onClick={() => {
                                          setExpandedChoicesInGroup((prev) => {
                                            const newSet = new Set(prev)
                                            if (isChoicesExpanded) {
                                              newSet.delete(groupKey)
                                            } else {
                                              newSet.add(groupKey)
                                            }
                                            return newSet
                                          })
                                        }}
                                      >
                                        {isChoicesExpanded ? '收起' : '展开'} ({choicesCount})
                                        <Text className={`intended-majors-page__wishlist-item-major-group-arrow ${isChoicesExpanded ? 'intended-majors-page__wishlist-item-major-group-arrow--expanded' : ''}`}>
                                          ▼
                                        </Text>
                                      </Text>
                                    </View>
                                  </View>
                                )}
                                
                                {/* 然后在下面显示 choices（可折叠） */}
                                {isChoicesExpanded && (
                                  <View className="intended-majors-page__wishlist-item-plans">
                                    {sortedChoices.map((choice, choiceIdx) => {
                                      return (
                                        <View key={choiceIdx} className="intended-majors-page__wishlist-item-plan">
                                          {/* enrollmentMajor + 操作按钮（移除、上移、下移） */}
                                          {choice.enrollmentMajor && (
                                            <View className="intended-majors-page__wishlist-item-plan-major">
                                              <Text className="intended-majors-page__wishlist-item-plan-major-value" data-enrollment-major="true">
                                                {choice.enrollmentMajor}
                                              </Text>
                                              {/* 操作按钮：移除、上移、下移 */}
                                              <View className="intended-majors-page__wishlist-item-plan-actions-inline">
                                                <Button
                                                  onClick={async (e) => {
                                                    e.stopPropagation()
                                                    setChoiceToDelete({
                                                      choiceId: choice.id,
                                                      majorName: choice.enrollmentMajor || '该专业'
                                                    })
                                                    setDeleteConfirmOpen(true)
                                                  }}
                                                  className="intended-majors-page__wishlist-item-plan-action intended-majors-page__wishlist-item-plan-action--remove"
                                                  size="sm"
                                                  variant="ghost"
                                                >
                                                  <Text className="intended-majors-page__wishlist-item-plan-action-text">移除</Text>
                                                </Button>
                                                {/* 上移按钮：不是第一个时可以上移 */}
                                                {choiceIdx > 0 && (
                                                  <Button
                                                    onClick={async (e) => {
                                                      e.stopPropagation()
                                                      if (choice.id) {
                                                        await adjustMajorIndex(choice.id, { direction: 'up' as Direction })
                                                        await loadChoicesFromAPI()
                                                        Taro.showToast({
                                                          title: '移动成功',
                                                          icon: 'success',
                                                          duration: 1500
                                                        })
                                                      }
                                                    }}
                                                    className="intended-majors-page__wishlist-item-plan-action intended-majors-page__wishlist-item-plan-action--move"
                                                    size="sm"
                                                    variant="ghost"
                                                  >
                                                    <Text className="intended-majors-page__wishlist-item-plan-action-text">上移</Text>
                                                  </Button>
                                                )}
                                                {/* 下移按钮：不是最后一个时可以下移 */}
                                                {choiceIdx < sortedChoices.length - 1 && (
                                                  <Button
                                                    onClick={async (e) => {
                                                      e.stopPropagation()
                                                      if (choice.id) {
                                                        await adjustMajorIndex(choice.id, { direction: 'down' as Direction })
                                                        await loadChoicesFromAPI()
                                                        Taro.showToast({
                                                          title: '移动成功',
                                                          icon: 'success',
                                                          duration: 1500
                                                        })
                                                      }
                                                    }}
                                                    className="intended-majors-page__wishlist-item-plan-action intended-majors-page__wishlist-item-plan-action--move"
                                                    size="sm"
                                                    variant="ghost"
                                                  >
                                                    <Text className="intended-majors-page__wishlist-item-plan-action-text">下移</Text>
                                                  </Button>
                                                )}
                                              </View>
                                            </View>
                                          )}
                                          {/* remark */}
                                          {choice.remark && (
                                            <View className="intended-majors-page__wishlist-item-plan-remark">
                                              <Text className="intended-majors-page__wishlist-item-plan-remark-text">{choice.remark}</Text>
                                            </View>
                                          )}
                                          {/* 招生人数/专业组（不显示选科） */}
                                          {(choice.enrollmentQuota || majorGroupName) && (
                                            <View className="intended-majors-page__wishlist-item-plan-info">
                                              {choice.enrollmentQuota && (
                                                <Text className="intended-majors-page__wishlist-item-plan-info-text">
                                                  招生人数: {choice.enrollmentQuota}
                                                </Text>
                                              )}
                                              {majorGroupName && mgId && (
                                                <Text 
                                                  className="intended-majors-page__wishlist-item-plan-info-text intended-majors-page__wishlist-item-plan-info-group" 
                                                  data-major-group-button="true"
                                                  onClick={async (e) => {
                                                    e.stopPropagation()
                                                    try {
                                                      setLoadingGroupInfo(true)
                                                      setSelectedGroupInfo({
                                                        schoolName: school?.name || '',
                                                        majorGroupName: majorGroupName,
                                                        majorGroupId: mgId,
                                                      })
                                                      setSelectedSchoolData({
                                                        schoolName: school?.name || '',
                                                        schoolNature: school?.nature || 'public',
                                                        rankDiffPer: 0,
                                                        group: 0,
                                                        historyScores: [],
                                                        schoolFeature: schoolFeatures,
                                                        belong: belong,
                                                        provinceName: provinceName,
                                                        cityName: cityName,
                                                        enrollmentRate: enrollmentRate,
                                                        employmentRate: employmentRate,
                                                        majorGroupName: majorGroupName,
                                                        majorGroupId: mgId,
                                                      })
                                                      setSelectedPlanData({
                                                        enrollmentMajor: choice.enrollmentMajor || null,
                                                        remark: choice.remark || null,
                                                        subjectSelectionMode: choice.subjectSelectionMode || null,
                                                        enrollmentQuota: choice.enrollmentQuota || null,
                                                        studyPeriod: choice.studyPeriod || null,
                                                        tuitionFee: choice.tuitionFee || null,
                                                        batch: choice.batch || null,
                                                        majorGroupId: mgId,
                                                      } as any)
                                                      
                                                      // 调用 API 获取专业组信息
                                                      // 确保 mgId 是数字类型
                                                      const mgIdNumber = typeof mgId === 'string' ? parseInt(mgId, 10) : mgId
                                                      if (!mgIdNumber || isNaN(mgIdNumber)) {
                                                        Taro.showToast({
                                                          title: '专业组ID无效',
                                                          icon: 'none'
                                                        })
                                                        return
                                                      }
                                                      const groupInfo = await getMajorGroupInfo(mgIdNumber)
                                                      setGroupInfoData(groupInfo)
                                                      setGroupDialogOpen(true)
                                                    } catch (error) {
                                                      console.error('获取专业组信息失败:', error)
                                                      Taro.showToast({
                                                        title: '获取专业组信息失败',
                                                        icon: 'none',
                                                      })
                                                    } finally {
                                                      setLoadingGroupInfo(false)
                                                    }
                                                  }}
                                                >
                                                  {choice.enrollmentQuota ? ' · ' : ''}专业组{majorGroupName ? `: ${majorGroupName}` : ''} 👁️
                                                </Text>
                                              )}
                                            </View>
                                          )}
                                          {/* 分数信息 */}
                                          {choice.majorScores && choice.majorScores.length > 0 && (
                                            <View className="intended-majors-page__wishlist-item-plan-scores" data-scores="true">
                                              {choice.majorScores.map((score, scoreIndex) => (
                                                <View key={scoreIndex} className="intended-majors-page__wishlist-item-plan-score">
                                                  {score.minScore !== null && score.minScore !== undefined && (
                                                    <Text className="intended-majors-page__wishlist-item-plan-score-text" data-score="true">
                                                      {score.year}年最低分数: {Math.floor(score.minScore)}
                                                    </Text>
                                                  )}
                                                  {score.minRank !== null && (
                                                    <Text className="intended-majors-page__wishlist-item-plan-score-text" data-score="true">
                                                      最低位次: {score.minRank}
                                                    </Text>
                                                  )}
                                                </View>
                                              ))}
                                            </View>
                                          )}
                                        </View>
                                      )
                                    })}
                                  </View>
                                )}
                              </View>
                            )
                          })}
                        </View>
                      </Card>
                    )
                  })
              ) : (
                <View className="intended-majors-page__empty">
                  <Text className="intended-majors-page__empty-icon">📚</Text>
                  <Text className="intended-majors-page__empty-text">暂无志愿数据</Text>
                  <Text className="intended-majors-page__empty-desc">请先进行院校探索，添加心仪的志愿</Text>
                </View>
              )}
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
                            // 传递 majorId、majorCode 和 majorName，院校列表页面可以根据 majorId 调用 API
                            const majorNameParam = encodeURIComponent(major.name || '')
                            Taro.navigateTo({
                              url: `/pages/majors/intended/schools/index?majorCode=${majorCode}&majorId=${major.id}&majorName=${majorNameParam}`
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
                              // 教育层次映射：ben -> 本科, zhuan -> 专科, gao_ben -> 本科(职业)
                              const eduLevelMap: Record<string, string> = {
                                'ben': '本科',
                                'zhuan': '专科',
                                'gao_ben': '本科(职业)'
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
                ? `确定要删除专业"${choiceToDelete?.majorName || ''}"吗？此操作无法撤销。`
                : groupToDelete 
                ? `确定要删除"${groupToDelete?.schoolName || ''} - ${groupToDelete?.majorGroupName || ''}"专业组吗？此操作将删除该专业组下的所有志愿项，且无法撤销。`
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
      <Dialog 
        open={groupDialogOpen} 
        onOpenChange={(open) => {
          setGroupDialogOpen(open)
          if (!open) {
            // 关闭时清空数据
            setGroupInfoData([])
            setSelectedGroupInfo(null)
            setSelectedSchoolData(null)
            setSelectedPlanData(null)
            setLoadingGroupInfo(false)
            setExpandedScores(new Set()) // 清空 scores 展开状态
          }
        }}
      >
        <DialogContent className="intended-majors-page__group-dialog">
          <DialogHeader>
            <DialogTitle>
              {selectedGroupInfo?.schoolName} - {selectedGroupInfo?.majorGroupName} 专业组信息
            </DialogTitle>
          </DialogHeader>
          <View className="intended-majors-page__group-dialog-content">
            {loadingGroupInfo ? (
              <View className="intended-majors-page__group-dialog-empty">
                <Text>加载中...</Text>
              </View>
            ) : groupInfoData.length === 0 ? (
              <View className="intended-majors-page__group-dialog-empty">
                <Text>暂无专业组信息</Text>
                <Text className="intended-majors-page__group-dialog-empty-desc">数据未加载或为空</Text>
              </View>
            ) : (
              groupInfoData.map((plan, planIdx) => {
                // 处理热爱能量值：如果值在0-1之间，乘以100取整
                const normalizeLoveEnergy = (value: number | null): number | null => {
                  if (value === null || value === undefined) return null
                  if (value > 0 && value < 1) {
                    return Math.floor(value * 100)
                  }
                  return value
                }

                const isScoresExpanded = expandedScores.has(planIdx)
                const scoresCount = plan.scores?.length || 0
                const isSingleScore = scoresCount === 1
                
                // 单个 score 时，获取热爱能量值
                const singleLoveEnergy = isSingleScore && plan.scores?.[0] 
                  ? normalizeLoveEnergy(plan.scores[0].loveEnergy) 
                  : null

                return (
                  <View key={planIdx} className="intended-majors-page__group-section-new">
                    {/* 第一行：enrollmentMajor + 加入志愿/删除志愿按钮 */}
                    {plan.enrollmentMajor && (
                      <View className="intended-majors-page__group-major-row">
                        <View className="intended-majors-page__group-major-name-wrapper">
                          <Text className="intended-majors-page__group-major-name">{plan.enrollmentMajor}</Text>
                          {/* 如果只有一个 score，在 enrollmentMajor 后面显示热爱能量 */}
                          {isSingleScore && singleLoveEnergy !== null && (
                            <Text className="intended-majors-page__group-major-energy">
                              热爱能量：{singleLoveEnergy}
                            </Text>
                          )}
                        </View>
                        {(() => {
                          const { isIn, choiceId } = isPlanInWishlist(plan)
                          if (isIn && choiceId) {
                            return (
                              <Text
                                className="intended-majors-page__group-major-action intended-majors-page__group-major-action--remove"
                                onClick={() => handleAddPlanToWishlist(plan)}
                              >
                                移除志愿
                              </Text>
                            )
                          }
                          return (
                            <Text
                              className="intended-majors-page__group-major-action"
                              onClick={() => handleAddPlanToWishlist(plan)}
                            >
                              加入志愿
                            </Text>
                          )
                        })()}
                      </View>
                    )}

                    {/* 第二行：remark */}
                    {plan.remark && (
                      <View className="intended-majors-page__group-remark">
                        <Text>{plan.remark}</Text>
                      </View>
                    )}

                    {/* 多个 scores 时，在 remark 下面显示 */}
                    {!isSingleScore && plan.scores && plan.scores.length > 0 && (
                      <View className="intended-majors-page__group-scores-multiple">
                        <View className={`intended-majors-page__group-scores-row ${isScoresExpanded ? 'intended-majors-page__group-scores-row--expanded' : ''}`}>
                          {plan.scores.map((score: any, idx: number) => {
                            const loveEnergy = normalizeLoveEnergy(score.loveEnergy)
                            return (
                              <View key={idx} className="intended-majors-page__group-score-item-inline">
                                <Text className="intended-majors-page__group-score-major">{score.majorName}</Text>
                                <Text className="intended-majors-page__group-score-energy">：{loveEnergy !== null ? loveEnergy : '-'}</Text>
                              </View>
                            )
                          })}
                          {/* 未展开时，在行末显示向下箭头 */}
                          {!isScoresExpanded && (
                            <View
                              className="intended-majors-page__group-scores-arrow"
                              onClick={() => {
                                setExpandedScores((prev) => {
                                  const newSet = new Set(prev)
                                  newSet.add(planIdx)
                                  return newSet
                                })
                              }}
                            >
                              <Text className="intended-majors-page__group-scores-arrow-icon">▼</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* 第三行：学制：studyPeriod 招生人数：enrollmentQuota */}
                    <View className="intended-majors-page__group-info-row">
                      <Text>学制：{plan.studyPeriod || '-'}</Text>
                      <Text>招生人数：{plan.enrollmentQuota || '-'}</Text>
                    </View>
                  </View>
                )
              })
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

