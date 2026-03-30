// 心动专业页面
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { BottomNav } from '@/components/BottomNav'
import { QuestionnaireRequiredModal } from '@/components/QuestionnaireRequiredModal'
import { useQuestionnaireCheck } from '@/hooks/useQuestionnaireCheck'
import { 
  getFavoriteMajors, 
  unfavoriteMajor, 
  getFavoriteMajorsCount
} from '@/services/majors'
import './index.less'

// 合并后的专业数据接口（与 getFavoriteMajors 返回结构对齐，含 major、分数、未缴费时的 sign）
interface FavoriteMajorWithScore {
  majorCode: string
  majorName: string
  majorBrief: string | null
  eduLevel: string
  score: number | string
  lexueScore?: number | string
  shanxueScore?: number | string
  yanxueDeduction?: number | string
  tiaozhanDeduction?: number | string
  favoriteId?: number
  favoriteCreatedAt?: string
  /** 未缴费时接口返回的 sign，查看详情与取消收藏请求需带上 */
  sign?: string | null
}

export default function FavoriteMajorsPage() {
  // 检查问卷完成状态
  const { isCompleted, isLoading: isCheckingQuestionnaire, answerCount } = useQuestionnaireCheck()
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  
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
  const windowInfoRef = useRef<{ windowWidth: number; windowHeight: number } | null>(null)

  // 检查问卷完成状态
  useEffect(() => {
    if (!isCheckingQuestionnaire && !isCompleted) {
      setShowQuestionnaireModal(true)
    }
  }, [isCheckingQuestionnaire, isCompleted])

  useEffect(() => {
    Promise.resolve(Taro.getWindowInfo()).then((info) => {
      windowInfoRef.current = { windowWidth: info.windowWidth, windowHeight: info.windowHeight }
    })
  }, [])

  // 加载心动专业列表（不再请求 scores/all，避免长耗时）
  useEffect(() => {
    const loadFavoriteMajors = async () => {
      try {
        setLoading(true)

        const [favorites, count] = await Promise.all([
          getFavoriteMajors(),
          getFavoriteMajorsCount()
        ])

        const favoritesList = Array.isArray(favorites) ? favorites : []
        const mergedList: FavoriteMajorWithScore[] = favoritesList
          .map((fav: any) => {
            if (!fav || !fav.majorCode) return null
            const major = fav.major
            return {
              majorCode: fav.majorCode,
              majorName: major?.name ?? fav.majorName ?? fav.majorCode,
              majorBrief: major?.brief ?? null,
              eduLevel: major?.eduLevel ?? '',
              score: fav.score ?? 0,
              lexueScore: fav.lexueScore ?? 0,
              shanxueScore: fav.shanxueScore ?? 0,
              yanxueDeduction: fav.yanxueDeduction ?? 0,
              tiaozhanDeduction: fav.tiaozhanDeduction ?? 0,
              favoriteId: fav.id,
              favoriteCreatedAt: fav.createdAt,
              sign: fav.sign ?? null
            }
          })
          .filter((major): major is FavoriteMajorWithScore => major !== null && !!major.majorCode)

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
      const major = favoriteMajorsList.find((m) => m.majorCode === majorToDelete)
      await unfavoriteMajor(majorToDelete, major?.sign ?? undefined)
      
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

  // 处理深度了解 - 跳转到深度探索页面（未缴费时带 sign 以便详情/删除请求通过）
  const handleViewDetail = (majorCode: string, sign?: string | null) => {
    const signQuery = sign ? `&sign=${encodeURIComponent(sign)}` : ''
    Taro.navigateTo({
      url: `/pages/assessment/career-exploration/index?code=${majorCode}${signQuery}&from=favorite-majors`
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
    const win = windowInfoRef.current || { windowWidth: 375, windowHeight: 667 }
    const defaultBottom = 160 * (win.windowWidth / 750) // rpx转px
    const currentTop = floatButtonTop > 0 
      ? floatButtonTop 
      : win.windowHeight - defaultBottom - 112 * (win.windowWidth / 750)
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
      const win = windowInfoRef.current || { windowWidth: 375, windowHeight: 667 }
      const rpxToPx = win.windowWidth / 750
      const buttonHeight = 112 * rpxToPx // 按钮高度
      const bottomNavHeight = 100 * rpxToPx // 底部导航栏高度
      const headerHeight = 200 * rpxToPx // 顶部区域高度
      const minTop = headerHeight
      const maxTop = win.windowHeight - buttonHeight - bottomNavHeight
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
              <Card
                key={major.majorCode}
                className="favorite-majors-page__item"
                onClick={() => handleViewDetail(major.majorCode, major.sign)}
              >
                <View className="favorite-majors-page__item-content">
                  <View className="favorite-majors-page__item-header">
                    <View className="favorite-majors-page__item-title-section">
                      <Text 
                        className="favorite-majors-page__item-name favorite-majors-page__item-name--clickable"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewDetail(major.majorCode, major.sign)
                        }}
                      >
                        {major.majorName}
                      </Text>
                      <Text className="favorite-majors-page__item-code">({major.majorCode})</Text>
                      <View className="favorite-majors-page__item-score-badge">
                        <Text>热爱能量: {typeof major.score === 'string' ? parseFloat(major.score).toFixed(2) : major.score.toFixed(2)}</Text>
                      </View>
                    </View>
                    <View
                      className="favorite-majors-page__item-delete-icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteClick(major.majorCode)
                      }}
                    >
                      <Text className="favorite-majors-page__item-delete-icon-text">🗑️</Text>
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
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleBrief(major.majorCode)
                      }}
                      className="favorite-majors-page__item-brief-toggle"
                      size="sm"
                      variant="ghost"
                    >
                      {expandedBriefs.has(major.majorCode) ? '收起 ↑' : '展开 ↓'}
                    </Button>
                    </View>
                  )}

                </View>
              </Card>
            ))}
          </View>
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
              确定要从心动专业列表中删除此专业吗？
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

      {/* 问卷完成提示弹窗 */}
      <QuestionnaireRequiredModal
        open={showQuestionnaireModal}
        onOpenChange={setShowQuestionnaireModal}
        answerCount={answerCount}
      />

    </View>
  )
}

