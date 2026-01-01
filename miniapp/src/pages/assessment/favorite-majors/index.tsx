// 心动专业页面
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { BottomNav } from '@/components/BottomNav'
import { 
  getFavoriteMajors, 
  unfavoriteMajor, 
  getFavoriteMajorsCount
} from '@/services/majors'
import { getAllScores } from '@/services/scores'
import { MajorScoreResponse } from '@/types/api'
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
  // 浮动按钮位置
  const [floatButtonTop, setFloatButtonTop] = useState<number>(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartTop, setDragStartTop] = useState(0)

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
        // 确保 allScores 是数组
        if (Array.isArray(allScores)) {
          allScores.forEach(score => {
            if (score && score.majorCode) {
              scoreMap.set(score.majorCode, score)
            }
          })
        }

        // 合并收藏列表和专业分数数据
        // 确保 favorites 是数组
        const favoritesList = Array.isArray(favorites) ? favorites : []
        const mergedList: FavoriteMajorWithScore[] = favoritesList
          .map(fav => {
            if (!fav || !fav.majorCode) {
              return null
            }
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
          .filter((major): major is FavoriteMajorWithScore => major !== null && !!major.majorCode) // 过滤掉无效数据

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

  // 处理深度了解 - 跳转到深度探索页面
  const handleViewDetail = (majorCode: string) => {
    Taro.navigateTo({
      url: `/pages/assessment/career-exploration/index?code=${majorCode}`
    })
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

  // 跳转到所有专业列表
  const navigateToAllMajors = useCallback(() => {
    // 如果正在拖动或刚拖动完，不触发跳转
    if (isDragging) {
      return
    }
    
    // 延迟检查，避免拖动结束后立即触发点击
    setTimeout(() => {
      if (!isDragging) {
        Taro.navigateTo({
          url: '/pages/majors/index'
        })
      }
    }, 150)
  }, [isDragging])

  // 处理拖动开始
  const handleTouchStart = useCallback((e: any) => {
    e.stopPropagation()
    const touch = e.touches[0]
    setIsDragging(false) // 先设为false，等待移动距离判断
    setDragStartY(touch.clientY || touch.y)
    // 如果已经有位置，使用当前位置；否则使用默认位置
    const systemInfo = Taro.getSystemInfoSync()
    const defaultBottom = 160 * (systemInfo.windowWidth / 750) // rpx转px
    const currentTop = floatButtonTop > 0 
      ? floatButtonTop 
      : systemInfo.windowHeight - defaultBottom - 112 * (systemInfo.windowWidth / 750)
    setDragStartTop(currentTop)
  }, [floatButtonTop])

  // 处理拖动中
  const handleTouchMove = useCallback((e: any) => {
    e.stopPropagation()
    const touch = e.touches[0]
    const currentY = touch.clientY || touch.y
    const deltaY = Math.abs(currentY - dragStartY)
    
    // 如果移动距离超过5px，认为是拖动
    if (deltaY > 5) {
      setIsDragging(true)
    }
    
    if (deltaY > 5) {
      const newTop = dragStartTop + (currentY - dragStartY)
      
      // 获取系统信息，计算可拖动范围
      const systemInfo = Taro.getSystemInfoSync()
      const windowHeight = systemInfo.windowHeight
      const rpxToPx = systemInfo.windowWidth / 750
      const buttonHeight = 112 * rpxToPx // 按钮高度
      const bottomNavHeight = 100 * rpxToPx // 底部导航栏高度
      const headerHeight = 200 * rpxToPx // 顶部区域高度
      
      // 限制拖动范围：不能超出屏幕上下边界
      const minTop = headerHeight
      const maxTop = windowHeight - buttonHeight - bottomNavHeight
      
      const clampedTop = Math.max(minTop, Math.min(maxTop, newTop))
      setFloatButtonTop(clampedTop)
    }
  }, [dragStartY, dragStartTop])

  // 处理拖动结束
  const handleTouchEnd = useCallback((e: any) => {
    e.stopPropagation()
    // 延迟重置拖动状态，避免立即触发点击事件
    setTimeout(() => {
      setIsDragging(false)
    }, 100)
  }, [])

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
                      <Text 
                        className="favorite-majors-page__item-name favorite-majors-page__item-name--clickable"
                        onClick={() => {
                          Taro.navigateTo({
                            url: `/pages/assessment/single-major/index?code=${major.majorCode}&name=${encodeURIComponent(major.majorName || '')}`
                          })
                        }}
                      >
                        {major.majorName}
                      </Text>
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

      {/* 浮动按钮：跳转到所有专业列表 */}
      <View 
        className={`favorite-majors-page__float-button ${isDragging ? 'favorite-majors-page__float-button--dragging' : ''}`}
        style={{ 
          bottom: floatButtonTop > 0 ? 'auto' : '160rpx',
          top: floatButtonTop > 0 ? `${floatButtonTop}px` : 'auto',
          transform: isDragging ? 'scale(1.05)' : 'scale(1)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={navigateToAllMajors}
      >
        <View className="favorite-majors-page__float-button-content">
          <Text className="favorite-majors-page__float-button-text">所有专业</Text>
        </View>
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

    </View>
  )
}

