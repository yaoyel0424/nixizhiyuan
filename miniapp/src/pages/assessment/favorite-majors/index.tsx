// 心动专业页面
import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { BottomNav } from '@/components/BottomNav'
import { 
  getFavoriteMajors, 
  unfavoriteMajor, 
  getFavoriteMajorsCount,
  getMajorDetailByCode
} from '@/services/majors'
import { getAllScores } from '@/services/scores'
import { MajorScoreResponse, MajorDetailInfo } from '@/types/api'
import intentionData from '@/assets/data/intention.json'
import './index.less'

// 合并后的专业数据接口
interface FavoriteMajorWithScore extends MajorScoreResponse {
  favoriteId?: number
  favoriteCreatedAt?: string
}

export default function FavoriteMajorsPage() {
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [favoriteMajorsList, setFavoriteMajorsList] = useState<FavoriteMajorWithScore[]>([])
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [expandedBriefs, setExpandedBriefs] = useState<Set<string>>(new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [majorToDelete, setMajorToDelete] = useState<string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedMajorDetail, setSelectedMajorDetail] = useState<MajorDetailInfo | null>(null)
  const [selectedMajorName, setSelectedMajorName] = useState<string>('')
  const [loadingDetail, setLoadingDetail] = useState(false)

  // 加载心动专业列表
  useEffect(() => {
    const loadFavoriteMajors = async () => {
      try {
        setLoading(true)
        
        // 并行获取收藏列表和收藏数量
        const [favorites, count, allScores] = await Promise.all([
          getFavoriteMajors(),
          getFavoriteMajorsCount(),
          getAllScores()
        ])

        // 创建专业代码到分数的映射
        const scoreMap = new Map<string, MajorScoreResponse>()
        allScores.forEach(score => {
          scoreMap.set(score.majorCode, score)
        })

        // 合并收藏列表和专业分数数据
        const mergedList: FavoriteMajorWithScore[] = favorites
          .map(fav => {
            const scoreData = scoreMap.get(fav.majorCode)
            if (scoreData) {
              return {
                ...scoreData,
                favoriteId: fav.id,
                favoriteCreatedAt: fav.createdAt
              }
            }
            // 如果没有分数数据，至少返回基本信息
            return {
              majorCode: fav.majorCode,
              majorName: fav.majorName || fav.majorCode,
              majorBrief: null,
              eduLevel: '',
              score: '0',
              lexueScore: '0',
              shanxueScore: '0',
              yanxueDeduction: '0',
              tiaozhanDeduction: '0',
              favoriteId: fav.id,
              favoriteCreatedAt: fav.createdAt
            }
          })
          .filter(major => major.majorCode) // 过滤掉无效数据

        setFavoriteMajorsList(mergedList)
        setFavoriteCount(count)
      } catch (error: any) {
        console.error('加载心动专业失败:', error)
        Taro.showToast({
          title: error?.message || '加载收藏列表失败',
          icon: 'none',
          duration: 2000
        })
        setFavoriteMajorsList([])
        setFavoriteCount(0)
      } finally {
        setLoading(false)
      }
    }

    loadFavoriteMajors()
  }, [])

  // 打开删除确认对话框
  const handleDeleteClick = (majorCode: string) => {
    setMajorToDelete(majorCode)
    setDeleteConfirmOpen(true)
  }

  // 确认删除心动专业
  const confirmDelete = async () => {
    if (!majorToDelete) {
      setDeleteConfirmOpen(false)
      setMajorToDelete(null)
      return
    }

    try {
      // 调用 API 删除收藏
      await unfavoriteMajor(majorToDelete)
      
      // 更新本地状态
      setFavoriteMajorsList(prev => prev.filter(major => major.majorCode !== majorToDelete))
      setFavoriteCount(prev => Math.max(0, prev - 1))
      
      Taro.showToast({
        title: '已取消收藏',
        icon: 'success',
        duration: 1500
      })
    } catch (error: any) {
      console.error('删除收藏失败:', error)
      Taro.showToast({
        title: error?.message || '删除失败，请重试',
        icon: 'none',
        duration: 2000
      })
    } finally {
      setDeleteConfirmOpen(false)
      setMajorToDelete(null)
    }
  }

  // 处理深度了解
  const handleViewDetail = async (majorCode: string) => {
    try {
      setLoadingDetail(true)
      setDetailDialogOpen(true)
      
      // 从收藏列表中获取专业名称
      const major = favoriteMajorsList.find(m => m.majorCode === majorCode)
      if (major) {
        setSelectedMajorName(major.majorName)
      }
      
      const detail = await getMajorDetailByCode(majorCode)
      setSelectedMajorDetail(detail)
    } catch (error: any) {
      console.error('获取专业详情失败:', error)
      Taro.showToast({
        title: error?.message || '获取专业详情失败',
        icon: 'none',
        duration: 2000
      })
      setDetailDialogOpen(false)
    } finally {
      setLoadingDetail(false)
    }
  }

  const toggleBrief = (majorCode: string) => {
    setExpandedBriefs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(majorCode)) {
        newSet.delete(majorCode)
      } else {
        newSet.add(majorCode)
      }
      return newSet
    })
  }

  // 过滤搜索结果
  const filteredMajors = useMemo(() => {
    return favoriteMajorsList.filter((major) => {
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      return major.majorName.toLowerCase().includes(query) || major.majorCode.toLowerCase().includes(query)
    })
  }, [favoriteMajorsList, searchQuery])

  // 计算热爱能量前20%的专业
  const top20PercentCount = useMemo(() => {
    try {
      const allMajorsWithScores = (intentionData as any[])
        .map((item: any) => ({
          code: item.major.code,
          name: item.major.name,
          score: parseFloat(item.major.score || '0')
        }))
        .filter((major: any) => major.score > 0)
      
      const sortedAllMajors = [...allMajorsWithScores].sort((a: any, b: any) => b.score - a.score)
      const top20PercentThresholdIndex = sortedAllMajors.length > 0 
        ? Math.ceil(sortedAllMajors.length * 0.2) 
        : 0
      const top20PercentMajorCodes = new Set(
        sortedAllMajors.slice(0, top20PercentThresholdIndex).map((m: any) => m.code)
      )
      const top20PercentInFavorites = filteredMajors.filter((major) => {
        return top20PercentMajorCodes.has(major.majorCode)
      })
      return top20PercentInFavorites.length
    } catch (error) {
      console.error('计算前20%专业失败:', error)
      return 0
    }
  }, [filteredMajors])

  if (loading) {
    return (
      <View className="favorite-majors-page">
        <View className="favorite-majors-page__loading">
          <Text>加载中...</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className="favorite-majors-page">
      
      {/* 头部 */}
      <View className="favorite-majors-page__header">
        <View className="favorite-majors-page__header-content">
          <Text className="favorite-majors-page__title">心动专业列表</Text>
          <Text className="favorite-majors-page__subtitle">共 {favoriteCount} 个心动专业</Text>
        </View>
        <View className="favorite-majors-page__wave" />
      </View>

      {/* 内容区域 */}
      <View className="favorite-majors-page__content">
        {/* 搜索框 */}
        <View className="favorite-majors-page__search">
          <Input
            placeholder="搜索专业名称或代码..."
            value={searchQuery}
            onInput={(e) => setSearchQuery(e.detail.value)}
            className="favorite-majors-page__search-input"
          />
          <Text className="favorite-majors-page__search-icon">🔍</Text>
        </View>

        {/* 心动专业列表 */}
        {filteredMajors.length === 0 ? (
          <Card className="favorite-majors-page__empty">
            {favoriteCount === 0 ? (
              <View className="favorite-majors-page__empty-content">
                <Text className="favorite-majors-page__empty-icon">⭐</Text>
                <Text className="favorite-majors-page__empty-text">暂无心动专业</Text>
                <Text className="favorite-majors-page__empty-desc">
                  在专业列表页面点击星星图标可以添加心动专业
                </Text>
                <Button
                  onClick={() => {
                    Taro.redirectTo({
                      url: '/pages/majors/index'
                    })
                  }}
                  className="favorite-majors-page__empty-button"
                >
                  前往所有专业页面探索 →
                </Button>
              </View>
            ) : (
              <View className="favorite-majors-page__empty-content">
                <Text className="favorite-majors-page__empty-icon">🔍</Text>
                <Text className="favorite-majors-page__empty-text">未找到匹配的专业</Text>
                <Text className="favorite-majors-page__empty-desc">请尝试其他搜索关键词</Text>
              </View>
            )}
          </Card>
        ) : (
          <View className="favorite-majors-page__list">
            {filteredMajors.map((major) => (
              <Card key={major.majorCode} className="favorite-majors-page__item">
                <View className="favorite-majors-page__item-content">
                  <View className="favorite-majors-page__item-header">
                    <View className="favorite-majors-page__item-title-section">
                      <Text className="favorite-majors-page__item-name">{major.majorName}</Text>
                      <Text className="favorite-majors-page__item-code">({major.majorCode})</Text>
                      <View className="favorite-majors-page__item-score-badge">
                        <Text>热爱能量: {typeof major.score === 'string' ? parseFloat(major.score).toFixed(2) : major.score.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>

                  {major.majorBrief && (
                    <View className="favorite-majors-page__item-brief">
                      <Text 
                        className={`favorite-majors-page__item-brief-text ${expandedBriefs.has(major.majorCode) ? '' : 'favorite-majors-page__item-brief-text--clamped'}`}
                      >
                        {major.majorBrief}
                      </Text>
                    <Button
                      onClick={() => toggleBrief(major.majorCode)}
                      className="favorite-majors-page__item-brief-toggle"
                      size="sm"
                      variant="ghost"
                    >
                      {expandedBriefs.has(major.majorCode) ? '收起 ↑' : '展开 ↓'}
                    </Button>
                    </View>
                  )}

                  {/* 操作按钮区域 */}
                  <View className="favorite-majors-page__item-actions">
                    <Button
                      onClick={() => handleDeleteClick(major.majorCode)}
                      className="favorite-majors-page__item-delete-button"
                      size="sm"
                      variant="outline"
                    >
                      🗑️ 删除
                    </Button>
                    <Button
                      onClick={() => handleViewDetail(major.majorCode)}
                      className="favorite-majors-page__item-view-button"
                      size="sm"
                      variant="outline"
                    >
                      👁️ 深度了解
                    </Button>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* 提示信息 */}
        {top20PercentCount > 0 && (
          <Card className="favorite-majors-page__tip">
            <Text className="favorite-majors-page__tip-text">
              💡 您的心动专业中有 {top20PercentCount} 个属于热爱能量前20%的专业
            </Text>
          </Card>
        )}
      </View>

      <BottomNav />

      {/* 删除确认对话框 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要从心动专业列表中删除此专业吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setDeleteConfirmOpen(false)}
              variant="outline"
            >
              取消
            </Button>
            <Button
              onClick={confirmDelete}
              className="favorite-majors-page__delete-confirm-button"
            >
              确定删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 专业详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>专业详情</DialogTitle>
            <DialogDescription>
              {loadingDetail ? '加载中...' : selectedMajorDetail ? '专业详细信息' : ''}
            </DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <View style={{ padding: '20px', textAlign: 'center' }}>
              <Text>加载中...</Text>
            </View>
          ) : selectedMajorDetail ? (
            <View style={{ padding: '20px' }}>
              <View style={{ marginBottom: '16px' }}>
                {selectedMajorName && (
                  <Text style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '4px', display: 'block' }}>
                    {selectedMajorName}
                  </Text>
                )}
                <Text style={{ color: '#666', fontSize: '14px', marginBottom: '12px', display: 'block' }}>
                  专业代码: {selectedMajorDetail.code}
                </Text>
                {selectedMajorDetail.educationLevel && (
                  <Text style={{ color: '#666', marginBottom: '4px', display: 'block' }}>
                    学历层次: {selectedMajorDetail.educationLevel}
                  </Text>
                )}
                {selectedMajorDetail.studyPeriod && (
                  <Text style={{ color: '#666', marginBottom: '4px', display: 'block' }}>
                    修业年限: {selectedMajorDetail.studyPeriod}
                  </Text>
                )}
                {selectedMajorDetail.awardedDegree && (
                  <Text style={{ color: '#666', marginBottom: '4px', display: 'block' }}>
                    授予学位: {selectedMajorDetail.awardedDegree}
                  </Text>
                )}
              </View>
              {selectedMajorDetail.majorBrief && (
                <View style={{ marginTop: '16px' }}>
                  <Text style={{ fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>
                    专业简介:
                  </Text>
                  <Text style={{ lineHeight: '1.6', color: '#333' }}>
                    {selectedMajorDetail.majorBrief}
                  </Text>
                </View>
              )}
            </View>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => setDetailDialogOpen(false)}
              variant="outline"
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}

