// 志愿方案页面
import React, { useState, useEffect, useRef } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { BottomNav } from '@/components/BottomNav'
import { getStorage, setStorage } from '@/utils/storage'
import { getExamInfo, updateExamInfo, getGaokaoConfig, getScoreRange, ExamInfo, GaokaoSubjectConfig } from '@/services/exam-info'
import { getCurrentUserDetail } from '@/services/user'
import { getUserEnrollmentPlans, UserEnrollmentPlan, getProvincialControlLines, ProvincialControlLine } from '@/services/enroll-plan'
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
  onUpdate?: () => void
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

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scoreChangeTimerRef.current) {
        clearTimeout(scoreChangeTimerRef.current)
        scoreChangeTimerRef.current = null
      }
    }
  }, [])

  // 从 API 或本地存储加载数据
  useEffect(() => {
    if (open && !isUpdatingProvince) {
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
    
    // 防止重复请求
    if (isFetchingRank) {
      return
    }
    
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
      await updateExamInfo(updatedInfo)
      
      // 更新成功后刷新数据（只刷新，不再次更新）
      if (onUpdate) {
        onUpdate()
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

      // 通知父组件更新（传入更新后的信息）
      if (onUpdate) {
        onUpdate()
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
  const router = useRouter()
  const tabParam = router.params?.tab || '意向志愿'
  const activeTab = tabParam === '意向志愿' ? '意向志愿' : '专业赛道'
  
  const [data, setData] = useState<IntentionMajor[]>([])
  const [enrollmentPlans, setEnrollmentPlans] = useState<UserEnrollmentPlan[]>([]) // 用户招生计划数据
  const [loading, setLoading] = useState(true)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [wishlistItems, setWishlistItems] = useState<any[]>([])
  const [wishlistCounts, setWishlistCounts] = useState<Record<string, number>>({})
  const [showExamInfoDialog, setShowExamInfoDialog] = useState(false)
  const [currentScore, setCurrentScore] = useState<number>(580)
  const [scoreRange, setScoreRange] = useState<[number, number]>([500, 650])
  const [minControlScore, setMinControlScore] = useState<number>(0) // 省份最低省控线
  const [expandedHistoryScores, setExpandedHistoryScores] = useState<Set<number>>(new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)
  const [selectedGroupInfo, setSelectedGroupInfo] = useState<{
    schoolName: string
    majorGroupName: string
  } | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupDataList, setGroupDataList] = useState<any[]>([])
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [examInfo, setExamInfo] = useState<ExamInfo | null>(null)

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

  // 加载志愿列表
  useEffect(() => {
    const loadWishlist = async () => {
      try {
        const saved = await getStorage<string[]>('school-wishlist')
        if (saved) {
          setWishlist(new Set(saved))
        }
        const savedItems = await getStorage<any[]>('wishlist-items')
        if (savedItems) {
          setWishlistItems(savedItems)
          const counts: Record<string, number> = {}
          savedItems.forEach((item: any) => {
            if (item.majorCode) {
              counts[item.majorCode] = (counts[item.majorCode] || 0) + 1
            }
          })
          setWishlistCounts(counts)
        }
      } catch (error) {
        console.error('加载志愿列表失败:', error)
      }
    }
    loadWishlist()
  }, [])

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
  const loadExamInfo = async () => {
    try {
      const info = await getExamInfo()
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
    if (itemToDelete === null) return
    
    const deletedItem = wishlistItems[itemToDelete]
    const newItems = wishlistItems.filter((_, i) => i !== itemToDelete)
    
    try {
      await setStorage('wishlist-items', newItems)
      setWishlistItems(newItems)
      
      if (deletedItem?.key) {
        const newSet = new Set(wishlist)
        newSet.delete(deletedItem.key)
        setWishlist(newSet)
        await setStorage('school-wishlist', Array.from(newSet))
      }
    } catch (error) {
      console.error('删除志愿项失败:', error)
    }
    
    setDeleteConfirmOpen(false)
    setItemToDelete(null)
  }

  // 移动志愿项（上移/下移）
  const moveWishlistItem = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === wishlistItems.length - 1) return

    const newItems = [...wishlistItems]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const temp = newItems[index]
    newItems[index] = newItems[targetIndex]
    newItems[targetIndex] = temp

    try {
      await setStorage('wishlist-items', newItems)
      setWishlistItems(newItems)
    } catch (error) {
      console.error('移动志愿项失败:', error)
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
              {wishlistItems.map((item, idx) => {
                const itemKey = item.key || `${item.majorCode}-${item.schoolName}-${idx}`
                return (
                  <Card key={itemKey} className="intended-majors-page__wishlist-item">
                    <View className="intended-majors-page__wishlist-item-content">
                      <View className="intended-majors-page__wishlist-item-header">
                        <View className="intended-majors-page__wishlist-item-title-section">
                          <View className="intended-majors-page__wishlist-item-number">
                            <Text>{idx + 1}</Text>
                          </View>
                          <View>
                            <Text className="intended-majors-page__wishlist-item-school">{item.schoolName}</Text>
                            {item.schoolFeature && (
                              <View className="intended-majors-page__wishlist-item-features">
                                {item.schoolFeature.split(',').slice(0, 3).map((feature: string, i: number) => (
                                  <Text key={i} className="intended-majors-page__wishlist-item-feature">
                                    {feature}
                                  </Text>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                        <View className="intended-majors-page__wishlist-item-actions">
                          <View className="intended-majors-page__wishlist-item-move-buttons">
                            <Button
                              onClick={() => moveWishlistItem(idx, 'up')}
                              className="intended-majors-page__wishlist-item-move-button"
                              size="sm"
                              variant="ghost"
                              disabled={idx === 0}
                            >
                              ↑
                            </Button>
                            <Button
                              onClick={() => moveWishlistItem(idx, 'down')}
                              className="intended-majors-page__wishlist-item-move-button"
                              size="sm"
                              variant="ghost"
                              disabled={idx === wishlistItems.length - 1}
                            >
                              ↓
                            </Button>
                          </View>
                          <Button
                            onClick={() => handleDeleteClick(idx)}
                            className="intended-majors-page__wishlist-item-delete"
                            size="sm"
                            variant="ghost"
                          >
                            🗑️
                          </Button>
                        </View>
                      </View>
                      <View className="intended-majors-page__wishlist-item-info">
                        <Text className="intended-majors-page__wishlist-item-major">
                          {item.majorName} ({item.majorCode})
                        </Text>
                        {item.majorGroupName && (
                          <Button
                            onClick={() => {
                              setSelectedGroupInfo({
                                schoolName: item.schoolName,
                                majorGroupName: item.majorGroupName || '',
                              })
                              setGroupDialogOpen(true)
                            }}
                            className="intended-majors-page__wishlist-item-group-link"
                            size="sm"
                            variant="ghost"
                          >
                            专业组: {item.majorGroupName}
                          </Button>
                        )}
                        {item.score && (
                          <View className="intended-majors-page__wishlist-item-score">
                            <Text className="intended-majors-page__wishlist-item-score-label">热爱能量:</Text>
                            <Text className="intended-majors-page__wishlist-item-score-value">{item.score}</Text>
                          </View>
                        )}
                      </View>
                      <View className="intended-majors-page__wishlist-item-location">
                        <Text>📍 {item.provinceName} · {item.cityName}</Text>
                        <Text>🏛️ {item.belong}</Text>
                      </View>
                      {(item.enrollmentRate || item.employmentRate) && (
                        <View className="intended-majors-page__wishlist-item-rates">
                          {item.enrollmentRate && (
                            <Text>升学率: {item.enrollmentRate}%</Text>
                          )}
                          {item.employmentRate && (
                            <Text>就业率: {item.employmentRate}%</Text>
                          )}
                        </View>
                      )}
                      {item.historyScore && item.historyScore.length > 0 && item.historyScore[0].historyScore && (
                        <View className="intended-majors-page__wishlist-item-history">
                          <Button
                            onClick={() => {
                              setExpandedHistoryScores((prev) => {
                                const newSet = new Set(prev)
                                if (newSet.has(idx)) {
                                  newSet.delete(idx)
                                } else {
                                  newSet.add(idx)
                                }
                                return newSet
                              })
                            }}
                            className="intended-majors-page__wishlist-item-history-toggle"
                            size="sm"
                            variant="ghost"
                          >
                            <Text>历年分数</Text>
                            <Text className={expandedHistoryScores.has(idx) ? 'intended-majors-page__wishlist-item-history-arrow--expanded' : ''}>
                              ▼
                            </Text>
                          </Button>
                          {expandedHistoryScores.has(idx) && (
                            <View className="intended-majors-page__wishlist-item-history-content">
                              <View className="intended-majors-page__wishlist-item-history-table">
                                <View className="intended-majors-page__wishlist-item-history-row">
                                  <Text>年份</Text>
                                  <Text>最低分</Text>
                                  <Text>最低位次</Text>
                                  <Text>招生数</Text>
                                </View>
                                {item.historyScore[0].historyScore.slice(0, 3).map((score: any, i: number) => {
                                  const [year, data] = Object.entries(score)[0]
                                  const [minScore, minRank, planNum] = String(data).split(',')
                                  return (
                                    <View key={i} className="intended-majors-page__wishlist-item-history-row">
                                      <Text>{year}</Text>
                                      <Text>{minScore}</Text>
                                      <Text>{minRank}</Text>
                                      <Text>{planNum}</Text>
                                    </View>
                                  )
                                })}
                              </View>
                              {(item.historyScore[0].batch || item.historyScore[0].remark) && (
                                <View className="intended-majors-page__wishlist-item-history-batch">
                                  {item.historyScore[0].batch && (
                                    <Text className="intended-majors-page__wishlist-item-history-batch-text">
                                      {item.historyScore[0].batch}
                                    </Text>
                                  )}
                                  {item.historyScore[0].remark && (
                                    <Text>{item.historyScore[0].remark}</Text>
                                  )}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </Card>
                )
              })}
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
                          <Text className="intended-majors-page__major-item-name">{major.name}</Text>
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
                              // 处理 score 值：可能是数字或字符串
                              if (plan.score === null || plan.score === undefined) {
                                return '-'
                              }
                              // 转换为数字（支持字符串类型）
                              const scoreNum = typeof plan.score === 'string' 
                                ? parseFloat(plan.score) 
                                : Number(plan.score)
                              // 检查是否为有效数字
                              if (isNaN(scoreNum)) {
                                return '-'
                              }
                              // 四舍五入到整数
                              return Math.round(scoreNum).toString()
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
            <DialogDescription>确定要删除此志愿项吗？此操作无法撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setDeleteConfirmOpen(false)}
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
                  const majorsList = majors as any[]
                  const scores = majorsList
                    .map((m: any) => parseInt(m.developmentPotential || '0'))
                    .filter((s: number) => s > 0)
                  const minScore = scores.length > 0 ? Math.min(...scores) : null
                  const lowestScoreMajors = minScore !== null 
                    ? majorsList.filter((m: any) => {
                        const score = parseInt(m.developmentPotential || '0')
                        return score > 0 && (score === minScore || score === minScore + 1)
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
                          const score = parseInt(major.developmentPotential || '0')
                          const isLowest = minScore !== null && score > 0 && (score === minScore || score === minScore + 1)
                          
                          return (
                            <View 
                              key={idx} 
                              className={`intended-majors-page__group-table-row ${isLowest ? 'intended-majors-page__group-table-row--warning' : ''}`}
                            >
                              <View>
                                <Text className="intended-majors-page__group-table-major-name">{major.majorName}</Text>
                                <Text className="intended-majors-page__group-table-major-code">{major.majorCode}</Text>
                              </View>
                              <Text>{major.batch || '-'}</Text>
                              <Text>{major.num || '-'}</Text>
                              <Text>{major.tuition ? `${major.tuition}元` : '-'}</Text>
                              <Text>{major.studyPeriod || '-'}</Text>
                              <View className="intended-majors-page__group-table-score">
                                <Text className={isLowest ? 'intended-majors-page__group-table-score--low' : ''}>
                                  {major.developmentPotential || '-'}
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
    </View>
  )
}

