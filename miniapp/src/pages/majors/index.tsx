// 专业探索页面
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card } from '@/components/ui/Card'
import { BottomNav } from '@/components/BottomNav'
import { getAllScores } from '@/services/scores'
import { 
  getFavoriteMajors, 
  favoriteMajor, 
  unfavoriteMajor, 
  checkFavoriteMajor,
  getFavoriteMajorsCount
} from '@/services/majors'
import { MajorScoreResponse } from '@/types/api'
import { getStorage, setStorage } from '@/utils/storage'
import './index.less'

// 每页显示的数据量
const PAGE_SIZE = 30

export default function MajorsPage() {
  const [activeTab, setActiveTab] = useState<string>("本科")
  // 存储所有数据（缓存）
  const [allMajors, setAllMajors] = useState<MajorScoreResponse[]>([])
  // 当前显示的数据（分页后的数据）
  const [displayedMajors, setDisplayedMajors] = useState<MajorScoreResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  // 数据缓存：避免切换标签时重复请求
  const dataCacheRef = useRef<Record<string, MajorScoreResponse[]>>({})
  // 心动专业列表（存储专业代码）
  const [favoriteMajors, setFavoriteMajors] = useState<Set<string>>(new Set())
  // 展开的专业简介（存储专业代码）
  const [expandedBriefs, setExpandedBriefs] = useState<Set<string>>(new Set())
  // 展开的分数详情（存储专业代码）
  const [expandedScores, setExpandedScores] = useState<Set<string>>(new Set())
  // 浮动按钮位置
  const [floatButtonTop, setFloatButtonTop] = useState<number>(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [dragStartTop, setDragStartTop] = useState(0)
  // 引导相关状态
  const [showGuide, setShowGuide] = useState(false)
  const [guideStep, setGuideStep] = useState<1 | 2 | null>(null) // 1: 收藏专业, 2: 查看心动专业

  // 教育层次映射：页面标签 -> API 参数
  const eduLevelMap: Record<string, string> = {
    '本科': 'ben',
    '高职本科': 'gao_ben',
    '专科': 'zhuan'
  }

  // 加载所有专业分数数据（一次性加载，然后缓存）
  const loadAllMajors = useCallback(async (tab: string, useCache: boolean = true) => {
    const eduLevel = eduLevelMap[tab]
    const cacheKey = eduLevel || 'all'
    
    // 如果缓存中有数据，直接使用
    if (useCache && dataCacheRef.current[cacheKey]) {
      const cachedData = dataCacheRef.current[cacheKey]
      setAllMajors(cachedData)
      // 重置分页
      setCurrentPage(1)
      setHasMore(cachedData.length > PAGE_SIZE)
      // 显示第一页数据
      setDisplayedMajors(cachedData.slice(0, PAGE_SIZE))
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await getAllScores(eduLevel)
      
      // 按分数降序排序（处理字符串类型的分数）
      const sortedData = [...data].sort((a, b) => {
        const scoreA = typeof a.score === 'string' ? parseFloat(a.score) : a.score
        const scoreB = typeof b.score === 'string' ? parseFloat(b.score) : b.score
        return scoreB - scoreA
      })
      
      // 缓存数据
      dataCacheRef.current[cacheKey] = sortedData
      setAllMajors(sortedData)
      
      // 重置分页
      setCurrentPage(1)
      setHasMore(sortedData.length > PAGE_SIZE)
      
      // 显示第一页数据
      setDisplayedMajors(sortedData.slice(0, PAGE_SIZE))
    } catch (error) {
      console.error('加载专业分数失败:', error)
      Taro.showToast({
        title: '加载数据失败',
        icon: 'none'
      })
      setAllMajors([])
      setDisplayedMajors([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载心动专业列表
  useEffect(() => {
    const loadFavoriteMajors = async () => {
      try {
        const favorites = await getFavoriteMajors()
        const majorCodes = favorites.map(fav => fav.majorCode)
        setFavoriteMajors(new Set(majorCodes))
      } catch (error: any) {
        console.error('加载心动专业失败:', error)
        // API调用失败，显示错误提示
        const errorMsg = error?.message || '加载收藏列表失败'
        Taro.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 2000
        })
        // 不设置任何数据，保持空状态
        setFavoriteMajors(new Set())
      }
    }
    loadFavoriteMajors()
  }, [])

  // 检查是否需要显示引导
  useEffect(() => {
    const checkGuide = async () => {
      try {
        const guideShown = await getStorage<boolean>('majorsPageGuideShown')
        if (!guideShown && displayedMajors.length > 0) {
          // 延迟显示引导，确保页面已渲染
          setTimeout(() => {
            setShowGuide(true)
            setGuideStep(1)
          }, 500)
        }
      } catch (error) {
        console.error('检查引导状态失败:', error)
      }
    }
    if (!loading && displayedMajors.length > 0) {
      checkGuide()
    }
  }, [loading, displayedMajors.length])

  // 初始加载和标签切换时加载数据
  useEffect(() => {
    loadAllMajors(activeTab)
  }, [activeTab, loadAllMajors])

  // 处理标签切换
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
  }

  // 加载更多数据（前端分页）
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) {
      return
    }

    const nextPage = currentPage + 1
    const startIndex = currentPage * PAGE_SIZE
    const endIndex = startIndex + PAGE_SIZE
    const nextData = allMajors.slice(startIndex, endIndex)

    if (nextData.length > 0) {
      setLoadingMore(true)
      // 模拟加载延迟，提升用户体验
      setTimeout(() => {
        setDisplayedMajors(prev => [...prev, ...nextData])
        setCurrentPage(nextPage)
        setHasMore(endIndex < allMajors.length)
        setLoadingMore(false)
      }, 300)
    } else {
      setHasMore(false)
    }
  }, [currentPage, allMajors, hasMore, loadingMore])

  // 处理滚动到底部
  const handleScrollToLower = useCallback(() => {
    loadMore()
  }, [loadMore])

  // 切换心动专业
  const toggleFavorite = useCallback(async (majorCode: string) => {
    // 获取当前状态
    const isCurrentlyFavorited = favoriteMajors.has(majorCode)
    
    // 乐观更新：先更新UI状态
    const newFavorites = new Set(favoriteMajors)
    if (isCurrentlyFavorited) {
      newFavorites.delete(majorCode)
    } else {
      newFavorites.add(majorCode)
    }
    setFavoriteMajors(newFavorites)
    
    try {
      if (isCurrentlyFavorited) {
        // 取消收藏
        await unfavoriteMajor(majorCode)
        Taro.showToast({
          title: '已取消心动',
          icon: 'none',
          duration: 1500
        })
      } else {
        // 添加收藏
        await favoriteMajor(majorCode)
        Taro.showToast({
          title: '已添加心动',
          icon: 'success',
          duration: 1500
        })
        
        // 如果是在引导步骤1，完成第一步，进入第二步
        if (guideStep === 1) {
          setGuideStep(2)
        }
      }
    } catch (error: any) {
      // API调用失败，回滚UI状态
      setFavoriteMajors(prev => {
        const rollbackFavorites = new Set(prev)
        if (isCurrentlyFavorited) {
          rollbackFavorites.add(majorCode)
        } else {
          rollbackFavorites.delete(majorCode)
        }
        return rollbackFavorites
      })
      console.error('切换收藏状态失败:', error)
      const errorMsg = error?.message || '操作失败，请稍后重试'
      Taro.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 2000
      })
    }
  }, [favoriteMajors, guideStep])

  // 跳转到心动专业列表
  const navigateToFavoriteList = useCallback(async () => {
    // 如果正在拖动或刚拖动完，不触发跳转
    if (isDragging) {
      return
    }
    
    // 如果是在引导步骤2，完成引导
    if (guideStep === 2) {
      setShowGuide(false)
      setGuideStep(null)
      try {
        await setStorage('majorsPageGuideShown', true)
      } catch (error) {
        console.error('保存引导状态失败:', error)
      }
    }
    
    // 延迟检查，避免拖动结束后立即触发点击
    setTimeout(() => {
      if (!isDragging) {
        Taro.navigateTo({
          url: '/pages/assessment/favorite-majors/index'
        })
      }
    }, 150)
  }, [isDragging, guideStep])

  // 跳过引导
  const skipGuide = useCallback(async () => {
    setShowGuide(false)
    setGuideStep(null)
    try {
      await setStorage('majorsPageGuideShown', true)
    } catch (error) {
      console.error('保存引导状态失败:', error)
    }
  }, [])

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

  // 切换专业简介展开状态
  const toggleBrief = useCallback((majorCode: string) => {
    setExpandedBriefs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(majorCode)) {
        newSet.delete(majorCode)
      } else {
        newSet.add(majorCode)
      }
      return newSet
    })
  }, [])

  // 切换分数详情展开状态
  const toggleScores = useCallback((majorCode: string) => {
    setExpandedScores(prev => {
      const newSet = new Set(prev)
      if (newSet.has(majorCode)) {
        newSet.delete(majorCode)
      } else {
        newSet.add(majorCode)
      }
      return newSet
    })
  }, [])

  // 格式化分数显示（处理字符串和数字类型）
  const formatScore = (score: number | string): string => {
    const numScore = typeof score === 'string' ? parseFloat(score) : score
    if (isNaN(numScore)) {
      return '0.00'
    }
    return numScore.toFixed(2)
  }

  return (
    <View className="majors-page">
      
      {/* 头部 */}
      <View className="majors-page__header">
        <View className="majors-page__header-content">
          <View className="majors-page__header-top">
            <Text className="majors-page__title">专业探索</Text>
          </View>
          <Text className="majors-page__subtitle">发现适合你的专业方向</Text>

          {/* 标签页 */}
          <View className="majors-page__tabs">
            {["本科", "高职本科", "专科"].map((tab) => (
              <View
                key={tab}
                className={`majors-page__tab ${activeTab === tab ? 'majors-page__tab--active' : ''}`}
                onClick={() => handleTabChange(tab)}
              >
                <Text className="majors-page__tab-text">{tab}</Text>
              </View>
            ))}
          </View>
        </View>
        {/* 波浪效果 */}
        <View className="majors-page__wave" />
      </View>

      {/* 内容区域 */}
      <ScrollView
        className="majors-page__scroll-view"
        scrollY
        onScrollToLower={handleScrollToLower}
        lowerThreshold={100}
        enableBackToTop
      >
        <View className="majors-page__content">
          {loading ? (
            <View className="majors-page__loading">
              <Text className="majors-page__loading-text">加载中...</Text>
            </View>
          ) : displayedMajors.length === 0 ? (
            <View className="majors-page__empty">
              <Text className="majors-page__empty-text">暂无专业数据</Text>
              <Text className="majors-page__empty-desc">请先完成专业测评问卷</Text>
            </View>
          ) : (
            <>
              <View className="majors-page__majors-list">
                {displayedMajors.map((major, index) => {
                  // 计算全局排名（在所有数据中的位置）
                  const globalIndex = allMajors.findIndex(m => m.majorCode === major.majorCode)
                  const rank = globalIndex >= 0 ? globalIndex + 1 : index + 1
                  
                  return (
                    <Card key={major.majorCode} className="majors-page__major-card">
                      <View className="majors-page__major-header">
                        <View className="majors-page__major-rank">
                          <Text className="majors-page__major-rank-text">{rank}</Text>
                        </View>
                        <View className="majors-page__major-info">
                          <Text className="majors-page__major-name">{major.majorName}</Text>
                          <Text className="majors-page__major-code">专业代码：{major.majorCode}</Text>
                        </View>
                        <View className="majors-page__major-score">
                          <View className="majors-page__major-score-content">
                            <Text className="majors-page__major-score-value">{formatScore(major.score)}</Text>
                            <Text className="majors-page__major-score-label">匹配分</Text>
                          </View>
                          <View 
                            className={`majors-page__favorite-star ${favoriteMajors.has(major.majorCode) ? 'majors-page__favorite-star--active' : ''} ${guideStep === 1 && index === 0 ? 'majors-page__favorite-star--guide' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFavorite(major.majorCode)
                            }}
                          >
                            <Text className="majors-page__favorite-star-icon">⭐</Text>
                          </View>
                        </View>
                      </View>
                      {major.majorBrief && (
                        <View 
                          className="majors-page__major-brief"
                          onClick={() => toggleBrief(major.majorCode)}
                        >
                          <View className="majors-page__major-brief-content">
                            <Text 
                              className={`majors-page__major-brief-text ${expandedBriefs.has(major.majorCode) ? '' : 'majors-page__major-brief-text--clamped'}`}
                            >
                              {major.majorBrief}
                            </Text>
                            {major.majorBrief.length > 30 && (
                              <Text className="majors-page__major-brief-toggle">
                                {expandedBriefs.has(major.majorCode) ? '收起' : '展开'}
                              </Text>
                            )}
                          </View>
                        </View>
                      )}
                      <View 
                        className="majors-page__major-scores-toggle"
                        onClick={() => toggleScores(major.majorCode)}
                      >
                        <Text className="majors-page__major-scores-toggle-text">
                          {expandedScores.has(major.majorCode) ? '收起分数详情' : '展开分数详情'}
                        </Text>
                        <Text className={`majors-page__major-scores-toggle-icon ${expandedScores.has(major.majorCode) ? 'majors-page__major-scores-toggle-icon--expanded' : ''}`}>
                          ▼
                        </Text>
                      </View>
                      {expandedScores.has(major.majorCode) && (
                        <View className="majors-page__major-scores-detail">
                          <View className="majors-page__score-item">
                            <Text className="majors-page__score-item-label">乐学分数</Text>
                            <Text className="majors-page__score-item-value">{formatScore(major.lexueScore)}</Text>
                          </View>
                          <View className="majors-page__score-item">
                            <Text className="majors-page__score-item-label">善学分数</Text>
                            <Text className="majors-page__score-item-value">{formatScore(major.shanxueScore)}</Text>
                          </View>
                          <View className="majors-page__score-item">
                            <Text className="majors-page__score-item-label">阻学分数</Text>
                            <Text className="majors-page__score-item-value">{formatScore(major.tiaozhanDeduction)}</Text>
                          </View>
                          {(() => {
                            const yanxue = typeof major.yanxueDeduction === 'string' 
                              ? parseFloat(major.yanxueDeduction) 
                              : major.yanxueDeduction
                            return yanxue > 0 ? (
                              <View className="majors-page__score-item">
                                <Text className="majors-page__score-item-label">厌学扣分</Text>
                                <Text className="majors-page__score-item-value majors-page__score-item-value--deduction">
                                  -{formatScore(yanxue)}
                                </Text>
                              </View>
                            ) : null
                          })()}
                        </View>
                      )}
                    </Card>
                  )
                })}
              </View>
              
              {/* 加载更多提示 */}
              {loadingMore && (
                <View className="majors-page__load-more">
                  <Text className="majors-page__load-more-text">加载中...</Text>
                </View>
              )}
              
              {/* 没有更多数据提示 */}
              {!hasMore && displayedMajors.length > 0 && (
                <View className="majors-page__no-more">
                  <Text className="majors-page__no-more-text">
                    已加载全部 {allMajors.length} 条数据
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* 浮动按钮：显示已选中心动专业数量 */}
      {favoriteMajors.size > 0 && (
        <View 
          className={`majors-page__float-button ${isDragging ? 'majors-page__float-button--dragging' : ''} ${guideStep === 2 ? 'majors-page__float-button--guide' : ''}`}
          style={{ 
            bottom: floatButtonTop > 0 ? 'auto' : '160rpx',
            top: floatButtonTop > 0 ? `${floatButtonTop}px` : 'auto',
            transform: isDragging ? 'scale(1.05)' : 'scale(1)'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={navigateToFavoriteList}
        >
          <View className="majors-page__float-button-icon">
            <Text className="majors-page__float-button-star">⭐</Text>
            {favoriteMajors.size > 0 && (
              <View className="majors-page__float-button-badge">
                <Text className="majors-page__float-button-count">{favoriteMajors.size}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* 引导遮罩层 */}
      {showGuide && (
        <View className="majors-page__guide-overlay" onClick={skipGuide}>
          {guideStep === 1 && (
            <View className="majors-page__guide-tip majors-page__guide-tip--star">
              <View className="majors-page__guide-tip-content">
                <Text className="majors-page__guide-tip-title">点击收藏专业</Text>
                <Text className="majors-page__guide-tip-desc">点击五角星图标可以将专业添加到心动列表</Text>
                <View className="majors-page__guide-tip-arrow majors-page__guide-tip-arrow--down" />
              </View>
            </View>
          )}
          {guideStep === 2 && (
            <View className="majors-page__guide-tip majors-page__guide-tip--button">
              <View className="majors-page__guide-tip-content">
                <Text className="majors-page__guide-tip-title">查看心动专业</Text>
                <Text className="majors-page__guide-tip-desc">点击右下角按钮查看所有收藏的专业</Text>
                <View className="majors-page__guide-tip-arrow majors-page__guide-tip-arrow--up" />
              </View>
            </View>
          )}
          <View className="majors-page__guide-skip" onClick={(e) => { e.stopPropagation(); skipGuide(); }}>
            <Text className="majors-page__guide-skip-text">跳过</Text>
          </View>
        </View>
      )}

      <BottomNav />
    </View>
  )
}

