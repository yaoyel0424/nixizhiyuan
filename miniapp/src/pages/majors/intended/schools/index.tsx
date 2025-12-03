// 院校列表页面
import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { BottomNav } from '@/components/BottomNav'
import { TopNav } from '@/components/TopNav'
import { getStorage, setStorage } from '@/utils/storage'
import intentionData from '@/assets/data/intention.json'
import groupData from '@/assets/data/group.json'
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
  
  const [data, setData] = useState<IntentionMajor | null>(null)
  const [loading, setLoading] = useState(true)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [groupDataList, setGroupDataList] = useState<any[]>([])
  const [selectedGroupInfo, setSelectedGroupInfo] = useState<{
    schoolName: string
    majorGroupName: string
  } | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
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
        if (groupJson.data && Array.isArray(groupJson.data)) {
          setGroupDataList(groupJson.data)
        }
      } catch (error) {
        console.error('加载专业组数据失败:', error)
      }
    }

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
  }, [majorCode])

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
        <TopNav />
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
        <TopNav />
        <View className="schools-page__empty">
          <Text>未找到专业信息</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className="schools-page">
      <TopNav />
      
      {/* 头部 */}
      <View className="schools-page__header">
        <View className="schools-page__header-content">
          <Text className="schools-page__title">
            {data.major.name} ({data.major.code}) - 院校列表
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
                    <View>
                      <Text className="schools-page__school-item-name">{school.schoolName}</Text>
                      {school.majorGroupName && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedGroupInfo({
                              schoolName: school.schoolName,
                              majorGroupName: school.majorGroupName || '',
                            })
                            setGroupDialogOpen(true)
                          }}
                          className="schools-page__school-item-group-link"
                          size="sm"
                          variant="ghost"
                        >
                          专业组: {school.majorGroupName}
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

                    {school.schoolFeature && (
                      <View className="schools-page__school-item-features">
                        {school.schoolFeature.split(',').map((feature, i) => (
                          <Text key={i} className="schools-page__school-item-feature">
                            {feature}
                          </Text>
                        ))}
                      </View>
                    )}

                    <View className="schools-page__school-item-rates">
                      <View className="schools-page__school-item-rate">
                        <Text className="schools-page__school-item-rate-label">升学率:</Text>
                        <Text className="schools-page__school-item-rate-value">{school.enrollmentRate}%</Text>
                      </View>
                      <View className="schools-page__school-item-rate">
                        <Text className="schools-page__school-item-rate-label">就业率:</Text>
                        <Text className="schools-page__school-item-rate-value">{school.employmentRate}%</Text>
                      </View>
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
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="schools-page__group-dialog">
          <DialogHeader>
            <DialogTitle>
              {selectedGroupInfo?.schoolName} - {selectedGroupInfo?.majorGroupName} 专业组信息
            </DialogTitle>
          </DialogHeader>
          <View className="schools-page__group-dialog-content">
            {groupDataList.length === 0 ? (
              <View className="schools-page__group-dialog-empty">
                <Text>暂无专业组信息</Text>
                <Text className="schools-page__group-dialog-empty-desc">数据未加载或为空</Text>
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
                  const scores = majors
                    .map(m => parseInt(m.developmentPotential || '0'))
                    .filter(s => s > 0)
                  const minScore = scores.length > 0 ? Math.min(...scores) : null
                  const lowestScoreMajors = minScore !== null 
                    ? majors.filter(m => {
                        const score = parseInt(m.developmentPotential || '0')
                        return score > 0 && (score === minScore || score === minScore + 1)
                      })
                    : []
                  
                  return (
                    <View key={groupInfo} className="schools-page__group-section">
                      {lowestScoreMajors.length > 0 && (
                        <View className="schools-page__group-warning">
                          <Text className="schools-page__group-warning-title">⚠️ 提醒</Text>
                          <Text className="schools-page__group-warning-text">
                            该专业组中包含热爱能量低的专业，选择该专业组可能会被调剂到这些专业，请谨慎选择。
                          </Text>
                        </View>
                      )}
                      <Text className="schools-page__group-section-title">{groupInfo}</Text>
                      <View className="schools-page__group-table">
                        <View className="schools-page__group-table-header">
                          <Text>专业</Text>
                          <Text>批次</Text>
                          <Text>招生人数</Text>
                          <Text>学费</Text>
                          <Text>学制</Text>
                          <Text>热爱能量</Text>
                        </View>
                        {majors.map((major, idx) => {
                          const score = parseInt(major.developmentPotential || '0')
                          const isLowest = minScore !== null && score > 0 && (score === minScore || score === minScore + 1)
                          
                          return (
                            <View 
                              key={idx} 
                              className={`schools-page__group-table-row ${isLowest ? 'schools-page__group-table-row--warning' : ''}`}
                            >
                              <View>
                                <Text className="schools-page__group-table-major-name">{major.majorName}</Text>
                                <Text className="schools-page__group-table-major-code">{major.majorCode}</Text>
                              </View>
                              <Text>{major.batch || '-'}</Text>
                              <Text>{major.num || '-'}</Text>
                              <Text>{major.tuition ? `${major.tuition}元` : '-'}</Text>
                              <Text>{major.studyPeriod || '-'}</Text>
                              <View className="schools-page__group-table-score">
                                <Text className={isLowest ? 'schools-page__group-table-score--low' : ''}>
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

