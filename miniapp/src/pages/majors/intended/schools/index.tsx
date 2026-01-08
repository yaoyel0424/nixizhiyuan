// 院校列表页面
import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { BottomNav } from '@/components/BottomNav'
import { getStorage, setStorage } from '@/utils/storage'
import intentionData from '@/assets/data/intention.json'
import groupData from '@/assets/data/group.json'
import { getEnrollmentPlansByMajorId, EnrollmentPlanWithScores, getMajorGroupInfo, MajorGroupInfo } from '@/services/enroll-plan'
import './index.less'

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
  studyPeriod?: string | null
  tuitionFee?: string | null
}

interface IntentionMajor {
  major: {
    code: string
    name: string
  }
  schools: School[]
}

export default function IntendedMajorsSchoolsPage() {
  const router = useRouter()
  const majorCode = router.params?.majorCode || ''
  const majorIdParam = router.params?.majorId || ''
  const majorId = majorIdParam ? parseInt(majorIdParam, 10) : null
  
  const [data, setData] = useState<IntentionMajor | null>(null)
  const [loading, setLoading] = useState(true)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [groupDataList, setGroupDataList] = useState<any[]>([])
  const [selectedGroupInfo, setSelectedGroupInfo] = useState<{
    schoolName: string
    majorGroupName: string
    majorGroupId?: number
  } | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [majorName, setMajorName] = useState<string>('')
  const [groupInfoData, setGroupInfoData] = useState<MajorGroupInfo[]>([])
  const [loadingGroupInfo, setLoadingGroupInfo] = useState(false)

  // 将 API 返回的数据转换为页面需要的格式
  const convertApiDataToSchoolList = (apiData: EnrollmentPlanWithScores[], majorCode: string): IntentionMajor | null => {
    if (!apiData || apiData.length === 0) {
      return null
    }

    // 从第一个招生计划中获取专业名称
    let majorName = majorCode
    if (apiData[0]?.plans?.[0]?.enrollmentMajor) {
      majorName = apiData[0].plans[0].enrollmentMajor
    }

    const schools: School[] = apiData.map((item) => {
      // 获取第一个招生计划的专业组信息
      const firstPlan = item.plans[0]
      const majorGroupName = firstPlan?.majorGroup?.mgName || firstPlan?.majorGroupInfo || null
      // 从 plan 对象上直接获取 majorGroupId，而不是从 majorGroup.mgId
      const majorGroupId = firstPlan?.majorGroupId || firstPlan?.majorGroup?.mgId || null
      const studyPeriod = firstPlan?.studyPeriod || null
      const tuitionFee = firstPlan?.tuitionFee || null
      
      // 构建历史分数数据（从所有 plans 的 majorScores 中提取）
      const historyScores: HistoryScore[] = []
      
      // 收集所有年份的分数数据
      const scoresByYear = new Map<string, Array<{ minScore: number | null; minRank: number | null; admitCount: number | null; batch?: string | null }>>()
      
      item.plans.forEach((plan) => {
        if (plan.majorScores && plan.majorScores.length > 0) {
          plan.majorScores.forEach((score) => {
            const year = score.year || '2024'
            if (!scoresByYear.has(year)) {
              scoresByYear.set(year, [])
            }
            scoresByYear.get(year)!.push({
              minScore: score.minScore,
              minRank: score.minRank,
              admitCount: score.admitCount,
              batch: plan.batch,
            })
          })
        }
      })

      // 转换为历史分数格式
      const historyScoreData: Array<{ [key: string]: string }> = []
      let firstYear: number | null = null
      
      scoresByYear.forEach((scores, year) => {
        // 取最低分数和最低位次
        const validScores = scores.filter(s => s.minScore !== null && s.minRank !== null)
        if (validScores.length > 0) {
          const minScore = Math.min(...validScores.map(s => s.minScore!))
          const minRank = Math.min(...validScores.map(s => s.minRank!))
          const totalAdmitCount = scores.reduce((sum, s) => sum + (s.admitCount || 0), 0)
          const batch = scores[0]?.batch || ''
          
          if (!firstYear) {
            firstYear = parseInt(year)
          }
          
          historyScoreData.push({
            [year]: `${minScore},${minRank},${totalAdmitCount}`
          })
        }
      })

      if (historyScoreData.length > 0 && firstYear) {
        historyScores.push({
          year: firstYear,
          historyScore: historyScoreData,
          remark: firstPlan?.remark || '',
          planNum: firstPlan?.enrollmentQuota ? parseInt(firstPlan.enrollmentQuota) : 0,
          batch: firstPlan?.batch || undefined,
          majorGroupName: majorGroupName,
        })
      }

      // 计算位次变化百分比（这里简化处理，实际应该根据用户位次计算）
      const rankDiffPer = 0 // 暂时设为0，后续可以根据用户位次计算

      return {
        schoolName: item.school.name,
        schoolNature: item.school.nature || '',
        rankDiffPer: rankDiffPer,
        group: 0,
        historyScores: historyScores,
        schoolFeature: item.school.features || '',
        belong: item.school.belong || '',
        provinceName: item.school.provinceName || '',
        cityName: item.school.cityName || '',
        enrollmentRate: item.school.enrollmentRate ? `${item.school.enrollmentRate}` : '0',
        employmentRate: item.school.employmentRate ? `${item.school.employmentRate}` : '0',
        majorGroupName: majorGroupName,
        majorGroupId: majorGroupId || undefined,
        studyPeriod: studyPeriod || undefined,
        tuitionFee: tuitionFee || undefined,
      }
    })

    return {
      major: {
        code: majorCode,
        name: majorName,
      },
      schools: schools,
    }
  }

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        // 如果有 majorId，优先从 API 获取数据
        if (majorId && majorCode) {
          console.log('从 API 加载院校列表数据，majorId:', majorId, 'majorCode:', majorCode)
          try {
            const apiData = await getEnrollmentPlansByMajorId(majorId)
            console.log('API 返回的数据:', apiData)
            
            if (apiData && apiData.length > 0) {
              // 从第一个学校数据中获取专业名称
              const majorNameFromApi = apiData[0]?.plans[0]?.enrollmentMajor || majorCode
              setMajorName(majorNameFromApi)
              
              const convertedData = convertApiDataToSchoolList(apiData, majorCode)
              console.log('转换后的数据:', convertedData)
              setData(convertedData)
              setLoading(false)
              return
            } else {
              console.warn('API 返回数据为空，降级使用静态数据')
            }
          } catch (error) {
            console.error('从 API 加载数据失败，降级使用静态数据:', error)
          }
        }

        // 降级：从静态 JSON 文件加载数据
        console.log('从静态 JSON 加载数据，majorCode:', majorCode)
        const allData = intentionData as IntentionMajor[]
        const majorData = allData.find((item) => item.major.code === majorCode)
        setData(majorData || null)
        setLoading(false)
      } catch (error) {
        console.error('加载数据失败:', error)
        setLoading(false)
      }
    }

    const loadGroupData = async () => {
      try {
        const groupJson = groupData as any
        console.log('group.json 加载结果:', groupJson)
        if (groupJson.data && Array.isArray(groupJson.data)) {
          console.log('设置 groupData，数量:', groupJson.data.length)
          setGroupDataList(groupJson.data)
        } else {
          console.warn('group.json 数据格式不正确:', groupJson)
        }
      } catch (error) {
        console.error('加载专业组数据失败:', error)
      }
    }

    // 无论是否有 majorCode，都加载专业组数据
    loadGroupData()
    
    if (majorCode) {
      loadData()
    }

    // 加载志愿列表
    const loadWishlist = async () => {
      try {
        const saved = await getStorage<string[]>('school-wishlist')
        if (saved) {
          setWishlist(new Set(saved))
        }
      } catch (error) {
        console.error('加载志愿列表失败:', error)
      }
    }
    loadWishlist()
  }, [majorCode, majorId])

  const toggleWishlist = async (schoolKey: string, schoolData: School) => {
    setWishlist((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(schoolKey)) {
        newSet.delete(schoolKey)
      } else {
        newSet.add(schoolKey)
      }

      // 保存到本地存储
      setStorage('school-wishlist', Array.from(newSet)).catch((error) => {
        console.error('保存志愿列表失败:', error)
      })

      // 更新 wishlist-items
      if (newSet.has(schoolKey)) {
        // 添加到 wishlist-items
        getStorage<any[]>('wishlist-items').then((existingItems) => {
          const items = existingItems || []
          const wishlistItem = {
            key: schoolKey,
            majorCode: majorCode,
            majorName: data?.major.name || '',
            schoolName: schoolData.schoolName,
            schoolCode: schoolData.schoolName,
            provinceName: schoolData.provinceName,
            cityName: schoolData.cityName,
            belong: schoolData.belong,
            schoolFeature: schoolData.schoolFeature || '',
            schoolNature: schoolData.schoolNature || 'public',
            group: schoolData.group || 0,
            historyScore: schoolData.historyScores || [],
            enrollmentRate: schoolData.enrollmentRate || '0',
            employmentRate: schoolData.employmentRate || '0',
            Rankdiff: 0,
            RankdiffPer: schoolData.rankDiffPer || 0,
            score: '0',
            developmentPotential: '0',
            selected: true,
            batch: schoolData.historyScores?.[0]?.batch || null,
            majorGroupName: schoolData.majorGroupName || null,
          }
          const exists = items.some((item: any) => item.key === schoolKey)
          if (!exists) {
            items.push(wishlistItem)
            setStorage('wishlist-items', items).catch((error) => {
              console.error('保存志愿项失败:', error)
            })
          }
        }).catch((error) => {
          console.error('获取志愿项失败:', error)
        })
      } else {
        // 从 wishlist-items 中删除
        getStorage<any[]>('wishlist-items').then((existingItems) => {
          const items = existingItems || []
          const newItems = items.filter((item: any) => item.key !== schoolKey)
          setStorage('wishlist-items', newItems).catch((error) => {
            console.error('删除志愿项失败:', error)
          })
        }).catch((error) => {
          console.error('获取志愿项失败:', error)
        })
      }

      return newSet
    })
  }

  if (loading) {
    return (
      <View className="schools-page">
        <View className="schools-page__loading">
          <Text>加载中...</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  if (!data || !majorCode) {
    return (
      <View className="schools-page">
        <View className="schools-page__empty">
          <Text>未找到专业信息</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className="schools-page">
      
      {/* 头部 */}
      <View className="schools-page__header">
        <View className="schools-page__header-content">
          <Text className="schools-page__title">
            {majorName || data.major.name} ({data.major.code}) - 院校列表
          </Text>
        </View>
        <View className="schools-page__wave" />
      </View>

      {/* 内容 */}
      <View className="schools-page__content">
        <View className="schools-page__schools-list">
          {data.schools.map((school, idx) => {
            const schoolKey = `${majorCode}-${school.schoolName}`
            const isInWishlist = wishlist.has(schoolKey)

            return (
              <Card key={idx} className="schools-page__school-item">
                <View className="schools-page__school-item-content">
                  <View className="schools-page__school-item-header">
                    <View className="schools-page__school-item-header-left">
                      <Text className="schools-page__school-item-name">{school.schoolName}</Text>
                      {school.majorGroupId && (
                        <Button
                          onClick={async (e) => {
                            e.stopPropagation()
                            const mgId = school.majorGroupId
                            if (!mgId) return
                            
                            try {
                              setLoadingGroupInfo(true)
                              setSelectedGroupInfo({
                                schoolName: school.schoolName,
                                majorGroupName: school.majorGroupName || '专业组',
                                majorGroupId: mgId,
                              })
                              
                              // 调用 API 获取专业组信息
                              const groupInfo = await getMajorGroupInfo(mgId)
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
                          className="schools-page__school-item-group-button"
                          size="sm"
                          variant="default"
                        >
                          <Text className="schools-page__school-item-group-icon">📋</Text>
                          <Text className="schools-page__school-item-group-text">
                            专业组{school.majorGroupName ? `: ${school.majorGroupName}` : ''}
                          </Text>
                          <Text className="schools-page__school-item-group-arrow">→</Text>
                        </Button>
                      )}
                    </View>
                    <View className="schools-page__school-item-actions">
                      <View className={`schools-page__school-item-rank ${school.rankDiffPer > 0 ? 'schools-page__school-item-rank--positive' : 'schools-page__school-item-rank--negative'}`}>
                        <Text className="schools-page__school-item-rank-text">
                          您的位次比去年
                        </Text>
                        <Text className="schools-page__school-item-rank-icon">
                          {school.rankDiffPer > 0 ? '↑' : '↓'}
                        </Text>
                        <Text className="schools-page__school-item-rank-value">
                          {Math.abs(school.rankDiffPer).toFixed(1)}%
                        </Text>
                      </View>
                      <Button
                        onClick={() => toggleWishlist(schoolKey, school)}
                        className={`schools-page__school-item-wishlist-button ${isInWishlist ? 'schools-page__school-item-wishlist-button--active' : ''}`}
                        size="sm"
                      >
                        {isInWishlist ? '已加入志愿' : '加入志愿'}
                      </Button>
                    </View>
                  </View>

                  <View className="schools-page__school-item-info">
                    <View className="schools-page__school-item-location">
                      <Text>📍 {school.provinceName} · {school.cityName}</Text>
                      <Text>🏛️ {school.belong}</Text>
                    </View>

                    {(() => {
                      const validFeatures = school.schoolFeature 
                        ? school.schoolFeature.split(',').filter(feature => feature.trim())
                        : []
                      return validFeatures.length > 0 ? (
                        <View className="schools-page__school-item-features">
                          {validFeatures.map((feature, i) => (
                            <Text key={i} className="schools-page__school-item-feature">
                              {feature.trim()}
                            </Text>
                          ))}
                        </View>
                      ) : null
                    })()}

                    <View className="schools-page__school-item-rates">
                      <View className="schools-page__school-item-rate">
                        <Text className="schools-page__school-item-rate-label">升学率:</Text>
                        <Text className="schools-page__school-item-rate-value">{school.enrollmentRate}%</Text>
                      </View>
                      <View className="schools-page__school-item-rate">
                        <Text className="schools-page__school-item-rate-label">就业率:</Text>
                        <Text className="schools-page__school-item-rate-value">{school.employmentRate}%</Text>
                      </View>
                      {school.studyPeriod && (
                        <View className="schools-page__school-item-rate">
                          <Text className="schools-page__school-item-rate-label">学制:</Text>
                          <Text className="schools-page__school-item-rate-value">{school.studyPeriod}</Text>
                        </View>
                      )}
                      {school.tuitionFee && (
                        <View className="schools-page__school-item-rate">
                          <Text className="schools-page__school-item-rate-label">学费:</Text>
                          <Text className="schools-page__school-item-rate-value">
                            {school.tuitionFee.includes('元') ? school.tuitionFee : `${school.tuitionFee}元`}
                          </Text>
                        </View>
                      )}
                    </View>

                    {school.historyScores.length > 0 && school.historyScores[0].historyScore && (
                      <View className="schools-page__school-item-history">
                        <View className="schools-page__school-item-history-table">
                          <View className="schools-page__school-item-history-header">
                            <Text>年份</Text>
                            <Text>最低分数</Text>
                            <Text>最低位次</Text>
                            <Text>招生人数</Text>
                          </View>
                          {school.historyScores[0].historyScore.map((score, i) => {
                            const [year, data] = Object.entries(score)[0]
                            const [minScore, minRank, planNum] = data.split(',')
                            return (
                              <View key={i} className="schools-page__school-item-history-row">
                                <Text>{year}</Text>
                                <Text>{minScore}</Text>
                                <Text>{minRank}</Text>
                                <Text>{planNum}</Text>
                              </View>
                            )
                          })}
                        </View>
                        {(school.historyScores[0].batch || school.historyScores[0].remark) && (
                          <View className="schools-page__school-item-history-batch">
                            {school.historyScores[0].batch && (
                              <Text className="schools-page__school-item-history-batch-text">
                                {school.historyScores[0].batch}
                              </Text>
                            )}
                            {school.historyScores[0].remark && (
                              <Text>{school.historyScores[0].remark}</Text>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            )
          })}
        </View>
      </View>

      <BottomNav />

      {/* 专业组信息弹出框 */}
      <Dialog 
        open={groupDialogOpen} 
        onOpenChange={(open) => {
          setGroupDialogOpen(open)
          if (!open) {
            // 关闭时清空数据
            setGroupInfoData([])
            setSelectedGroupInfo(null)
            setLoadingGroupInfo(false)
          }
        }}
      >
        <DialogContent className="schools-page__group-dialog">
          <DialogHeader>
            <DialogTitle>
              {selectedGroupInfo?.schoolName} - {selectedGroupInfo?.majorGroupName} 专业组信息
            </DialogTitle>
          </DialogHeader>
          <View className="schools-page__group-dialog-content">
            {loadingGroupInfo ? (
              <View className="schools-page__group-dialog-empty">
                <Text>加载中...</Text>
              </View>
            ) : groupInfoData.length === 0 ? (
              <View className="schools-page__group-dialog-empty">
                <Text>暂无专业组信息</Text>
                <Text className="schools-page__group-dialog-empty-desc">数据未加载或为空</Text>
              </View>
            ) : (
              groupInfoData.map((plan, planIdx) => {
                // 找出最低的热爱能量分数
                const scores = plan.scores
                  .map(s => s.loveEnergy)
                  .filter(s => s !== null && s > 0) as number[]
                const minScore = scores.length > 0 ? Math.min(...scores) : null
                
                // 找出所有最低分数的专业（包括并列最低的，如51和52都是最低时）
                const lowestScoreMajors = minScore !== null 
                  ? plan.scores.filter(s => {
                      return s.loveEnergy !== null && s.loveEnergy > 0 && 
                        (s.loveEnergy === minScore || s.loveEnergy === minScore + 1)
                    })
                  : []
                
                return (
                  <View key={planIdx} className="schools-page__group-section">
                    {lowestScoreMajors.length > 0 && (
                      <View className="schools-page__group-warning">
                        <Text className="schools-page__group-warning-title">⚠️ 提醒</Text>
                        <Text className="schools-page__group-warning-text">
                          该专业组中包含热爱能量低的专业，选择该专业组可能会被调剂到这些专业，请谨慎选择。
                        </Text>
                      </View>
                    )}
                    {plan.enrollmentMajor && (
                      <Text className="schools-page__group-section-title">{plan.enrollmentMajor}</Text>
                    )}
                    {plan.remark && (
                      <Text className="schools-page__group-section-remark">{plan.remark}</Text>
                    )}
                    <View className="schools-page__group-table">
                      <View className="schools-page__group-table-header">
                        <Text>专业</Text>
                        <Text>招生人数</Text>
                        <Text>学制</Text>
                        <Text>热爱能量</Text>
                      </View>
                      {plan.scores.map((score, idx) => {
                        const loveEnergy = score.loveEnergy
                        const isLowest = minScore !== null && loveEnergy !== null && loveEnergy > 0 && 
                          (loveEnergy === minScore || loveEnergy === minScore + 1)
                        
                        return (
                          <View 
                            key={idx} 
                            className={`schools-page__group-table-row ${isLowest ? 'schools-page__group-table-row--warning' : ''}`}
                          >
                            <View className="schools-page__group-table-major">
                              <Text className="schools-page__group-table-major-name">{score.majorName}</Text>
                              <Text className="schools-page__group-table-major-code">{score.majorCode}</Text>
                            </View>
                            <Text>{plan.enrollmentQuota || '-'}</Text>
                            <Text>{plan.studyPeriod || '-'}</Text>
                            <View className="schools-page__group-table-score">
                              <Text className={isLowest ? 'schools-page__group-table-score--low' : ''}>
                                {loveEnergy !== null ? loveEnergy : '-'}
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
            )}
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}
