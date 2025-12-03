// 志愿方案页面
import React, { useState, useEffect } from 'react'
import { View, Text, Slider } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { BottomNav } from '@/components/BottomNav'
import { TopNav } from '@/components/TopNav'
import { getStorage, setStorage } from '@/utils/storage'
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
function ExamInfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [selectedProvince, setSelectedProvince] = useState<string>('四川')
  const [firstChoice, setFirstChoice] = useState<'物理' | '历史' | null>('历史')
  const [optionalSubjects, setOptionalSubjects] = useState<Set<string>>(new Set(['政治', '地理']))
  const [totalScore, setTotalScore] = useState<string>('580')
  const [ranking, setRanking] = useState<string>('9150')

  // 从本地存储加载数据
  useEffect(() => {
    if (open) {
      const loadData = async () => {
        try {
          const savedProvince = await getStorage<string>('examProvince')
          if (savedProvince) {
            setSelectedProvince(savedProvince)
          }
          const savedFirstChoice = await getStorage<'物理' | '历史'>('examFirstChoice')
          if (savedFirstChoice) {
            setFirstChoice(savedFirstChoice)
          }
          const savedOptional = await getStorage<string[]>('examOptionalSubjects')
          if (savedOptional) {
            setOptionalSubjects(new Set(savedOptional))
          }
          const savedScore = await getStorage<string>('examTotalScore')
          if (savedScore) {
            setTotalScore(savedScore)
          }
          const savedRanking = await getStorage<string>('examRanking')
          if (savedRanking) {
            setRanking(savedRanking)
          }
        } catch (error) {
          console.error('加载高考信息失败:', error)
        }
      }
      loadData()
    }
  }, [open])

  const handleOptionalToggle = (subject: string) => {
    setOptionalSubjects((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(subject)) {
        newSet.delete(subject)
      } else {
        if (newSet.size < 2) {
          newSet.add(subject)
        }
      }
      return newSet
    })
  }

  const handleConfirm = async () => {
    try {
      await setStorage('examProvince', selectedProvince)
      if (firstChoice) {
        await setStorage('examFirstChoice', firstChoice)
      }
      await setStorage('examOptionalSubjects', Array.from(optionalSubjects))
      await setStorage('examTotalScore', totalScore)
      await setStorage('examRanking', ranking)
    } catch (error) {
      console.error('保存高考信息失败:', error)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="exam-info-dialog">
        <DialogHeader>
          <DialogTitle>高考信息</DialogTitle>
        </DialogHeader>
        <View className="exam-info-dialog__content">
          {/* 高考省份 */}
          <View className="exam-info-dialog__row">
            <Text className="exam-info-dialog__label">高考省份</Text>
            <View className="exam-info-dialog__value">
              <Text>{selectedProvince}</Text>
            </View>
          </View>

          {/* 选择科目 */}
          <View className="exam-info-dialog__section">
            <Text className="exam-info-dialog__section-title">选择科目</Text>
            
            {/* 首选 (2选1) */}
            <View className="exam-info-dialog__divider">
              <Text className="exam-info-dialog__divider-text">首选 (2选1)</Text>
            </View>
            <View className="exam-info-dialog__button-group">
              <Button
                onClick={() => setFirstChoice('物理')}
                className={`exam-info-dialog__button ${firstChoice === '物理' ? 'exam-info-dialog__button--active' : ''}`}
              >
                物理
              </Button>
              <Button
                onClick={() => setFirstChoice('历史')}
                className={`exam-info-dialog__button ${firstChoice === '历史' ? 'exam-info-dialog__button--active' : ''}`}
              >
                历史
              </Button>
            </View>

            {/* 可选 (4选2) */}
            <View className="exam-info-dialog__divider">
              <Text className="exam-info-dialog__divider-text">可选 (4选2)</Text>
            </View>
            <View className="exam-info-dialog__button-grid">
              {['化学', '生物', '政治', '地理'].map((subject) => (
                <Button
                  key={subject}
                  onClick={() => handleOptionalToggle(subject)}
                  disabled={!optionalSubjects.has(subject) && optionalSubjects.size >= 2}
                  className={`exam-info-dialog__button ${optionalSubjects.has(subject) ? 'exam-info-dialog__button--active' : ''}`}
                >
                  {subject}
                </Button>
              ))}
            </View>
          </View>

          {/* 预估或实际总分 */}
          <View className="exam-info-dialog__row">
            <Text className="exam-info-dialog__label">预估或实际总分</Text>
            <Input
              type="number"
              value={totalScore}
              onInput={(e) => setTotalScore(e.detail.value)}
              className="exam-info-dialog__input"
            />
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
  const [loading, setLoading] = useState(true)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [wishlistItems, setWishlistItems] = useState<any[]>([])
  const [wishlistCounts, setWishlistCounts] = useState<Record<string, number>>({})
  const [showExamInfoDialog, setShowExamInfoDialog] = useState(false)
  const [currentScore, setCurrentScore] = useState<number>(580)
  const [scoreRange, setScoreRange] = useState<[number, number]>([500, 650])
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

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setData(intentionData as unknown as IntentionMajor[])
        setLoading(false)
      } catch (error) {
        console.error('加载数据失败:', error)
        setLoading(false)
      }
    }
    loadData()
  }, [])

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

  // 从本地存储加载分数
  useEffect(() => {
    const loadScore = async () => {
      try {
        const savedScore = await getStorage<string>('examTotalScore')
        let parsedScore = 580
        if (savedScore) {
          const parsed = parseInt(savedScore, 10)
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 750) {
            parsedScore = parsed
          }
        }
        setCurrentScore(parsedScore)
        
        const savedRange = await getStorage<[number, number]>('scoreRange')
        if (savedRange && Array.isArray(savedRange) && savedRange.length === 2) {
          setScoreRange([savedRange[0], savedRange[1]])
        } else {
          const minScore = Math.max(0, parsedScore - 50)
          const maxScore = Math.min(750, parsedScore + 50)
          setScoreRange([minScore, maxScore])
        }
      } catch (error) {
        console.error('加载分数失败:', error)
      }
    }
    loadScore()
  }, [])

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
  const handleScoreRangeChange = async (value: number) => {
    // Taro Slider 的 onChange 事件返回的是单个值，需要处理双滑块
    // 这里简化处理，使用当前值更新区间
    const newRange: [number, number] = [scoreRange[0], value]
    if (newRange[0] <= newRange[1]) {
      setScoreRange(newRange)
      try {
        await setStorage('scoreRange', newRange)
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
        <TopNav />
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
      <TopNav />
      
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
              <Slider
                value={scoreRange[1]}
                min={0}
                max={750}
                step={1}
                activeColor="#1A4099"
                backgroundColor="#e5e7eb"
                blockColor="#1A4099"
                blockSize={20}
                onChange={(e) => handleScoreRangeChange(e.detail.value)}
                className="intended-majors-page__slider"
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
          // 专业赛道tab
          data.length === 0 ? (
            <View className="intended-majors-page__empty">
              <Text>暂无意向专业</Text>
            </View>
          ) : (
            <View className="intended-majors-page__majors-list">
              {data.map((item) => (
                <Card key={item.major.code} className="intended-majors-page__major-item">
                  <View className="intended-majors-page__major-item-content">
                    <View className="intended-majors-page__major-item-header">
                      <View>
                        <Text className="intended-majors-page__major-item-name">{item.major.name}</Text>
                        <Text className="intended-majors-page__major-item-code">({item.major.code})</Text>
                        {wishlistCounts[item.major.code] > 0 && (
                          <View className="intended-majors-page__major-item-badge">
                            <Text>{wishlistCounts[item.major.code]} 个志愿</Text>
                          </View>
                        )}
                      </View>
                      <Button
                        onClick={() => {
                          Taro.navigateTo({
                            url: `/pages/majors/intended/schools/index?majorCode=${item.major.code}`
                          })
                        }}
                        className="intended-majors-page__major-item-link"
                        variant="ghost"
                      >
                        <Text className="intended-majors-page__major-item-link-number">{item.schools.length}所</Text>
                        <Text className="intended-majors-page__major-item-link-arrow">→</Text>
                      </Button>
                    </View>
                    <View className="intended-majors-page__major-item-info">
                      <View className="intended-majors-page__major-item-tag">
                        <Text>本科</Text>
                      </View>
                      <View className="intended-majors-page__major-item-score">
                        <Text className="intended-majors-page__major-item-score-label">热爱能量:</Text>
                        <Text className="intended-majors-page__major-item-score-value">{item.major.score}</Text>
                      </View>
                    </View>
                  </View>
                </Card>
              ))}
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
      <ExamInfoDialog open={showExamInfoDialog} onOpenChange={setShowExamInfoDialog} />

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

