// 专业探索页面
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { View, Text, ScrollView, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { BottomNav } from '@/components/BottomNav'
import { QuestionnaireRequiredModal } from '@/components/QuestionnaireRequiredModal'
import { useQuestionnaireCheck } from '@/hooks/useQuestionnaireCheck'
import { getAllScores } from '@/services/scores'
import { 
  getFavoriteMajors, 
  favoriteMajor, 
  unfavoriteMajor, 
  checkFavoriteMajor,
  getFavoriteMajorsCount,
  getMajorDetailByCode
} from '@/services/majors'
import { MajorScoreResponse } from '@/types/api'
import { getStorage, setStorage } from '@/utils/storage'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import './index.less'

// 每页显示的数据量
const PAGE_SIZE = 30

export default function MajorsPage() {
  // 检查问卷完成状态
  const { isCompleted: isQuestionnaireCompleted, isLoading: isCheckingQuestionnaire, answerCount } = useQuestionnaireCheck()
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  
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
  // 搜索关键词
  const [searchQuery, setSearchQuery] = useState('')
  // 分享相关状态
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showShareGuide, setShowShareGuide] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  // 检查问卷完成状态
  useEffect(() => {
    if (!isCheckingQuestionnaire && !isQuestionnaireCompleted) {
      setShowQuestionnaireModal(true)
    }
  }, [isCheckingQuestionnaire, isQuestionnaireCompleted])

  // 教育层次映射：页面标签 -> API 参数
  const eduLevelMap: Record<string, string> = {
    '本科': 'ben',
    '本科(职业)': 'gao_ben',
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

  // 生成分享图片（包含前10个专业的详细信息）
  const generateShareImage = async () => {
    try {
      setIsGeneratingImage(true)

      // 获取前10个专业（按分数排序）
      const top10Majors = allMajors.slice(0, 10)

      // 获取每个专业的匹配理由
      Taro.showLoading({ title: '加载专业详情...' })
      const majorsWithReasons = await Promise.all(
        top10Majors.map(async (major) => {
          try {
            const detail = await getMajorDetailByCode(major.majorCode)
            // 提取匹配理由：优先使用得分最高的匹配理由
            const analyses = detail.majorElementAnalyses || detail.analyses || []
            let matchReason = ''
            
            // 筛选出有匹配理由的分析，并按得分排序（得分高的优先）
            const analysesWithReason = analyses
              .filter((a: any) => a.matchReason && (a.userElementScore !== undefined && a.userElementScore !== null))
              .sort((a: any, b: any) => {
                const scoreA = typeof a.userElementScore === 'number' ? a.userElementScore : 0
                const scoreB = typeof b.userElementScore === 'number' ? b.userElementScore : 0
                return scoreB - scoreA // 降序排列
              })
            
            if (analysesWithReason.length > 0) {
              // 使用得分最高的匹配理由
              matchReason = analysesWithReason[0].matchReason
            } else {
              // 如果没有得分，优先查找乐学类型的匹配理由
              const lexueAnalysis = analyses.find((a: any) => a.type === 'lexue' && a.matchReason)
              if (lexueAnalysis) {
                matchReason = lexueAnalysis.matchReason
              } else {
                // 如果没有乐学，查找善学
                const shanxueAnalysis = analyses.find((a: any) => a.type === 'shanxue' && a.matchReason)
                if (shanxueAnalysis) {
                  matchReason = shanxueAnalysis.matchReason
                } else {
                  // 如果都没有，使用第一个有匹配理由的分析
                  const firstWithReason = analyses.find((a: any) => a.matchReason)
                  if (firstWithReason) {
                    matchReason = firstWithReason.matchReason
                  }
                }
              }
            }
            
            return {
              ...major,
              matchReason: matchReason || null
            }
          } catch (error) {
            console.error(`获取专业 ${major.majorCode} 详情失败:`, error)
            return {
              ...major,
              matchReason: null
            }
          }
        })
      )
      Taro.hideLoading()

      // 获取系统信息
      const systemInfo = await Taro.getSystemInfo()
      const { windowWidth } = systemInfo
      const dpr = systemInfo.pixelRatio || 2

      // Canvas 尺寸（设计稿尺寸，单位：rpx）
      const canvasWidth = 750 // rpx
      // 根据内容动态计算高度：标题区域 + 每个专业卡片高度（包含匹配理由时更高）
      const headerHeight = 120 // 标题区域高度（减小）
      const baseCardHeight = 140 // 基础卡片高度（减小）
      const reasonHeight = 100 // 匹配理由额外高度（增加以容纳3行文本）
      const cardSpacing = 16 // 卡片间距（减小）
      const padding = 40 // 上下内边距（减小）
      
      // 计算总高度：标题 + 所有卡片 + 间距 + 内边距
      // majorsWithReasons 已经是前10个专业了
      const totalCardHeight = majorsWithReasons.reduce((sum, major) => {
        return sum + baseCardHeight + (major.matchReason ? reasonHeight : 0) + cardSpacing
      }, 0)
      const canvasHeight = headerHeight + totalCardHeight + padding
      const canvasWidthPx = (canvasWidth / 750) * windowWidth * dpr
      const canvasHeightPx = (canvasHeight / 750) * windowWidth * dpr

      // 创建 Canvas 上下文
      const query = Taro.createSelectorQuery()
      query
        .select('#majorsShareCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            Taro.showToast({
              title: 'Canvas 初始化失败',
              icon: 'none',
            })
            setIsGeneratingImage(false)
            return
          }

          const canvas = res[0].node
          const ctx = canvas.getContext('2d')

          // 设置 Canvas 实际尺寸
          canvas.width = canvasWidthPx
          canvas.height = canvasHeightPx

          // 绘制背景（渐变蓝色）
          const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeightPx)
          gradient.addColorStop(0, '#1A4099')
          gradient.addColorStop(1, '#2563eb')
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx)

          // 绘制标题
          ctx.fillStyle = '#FFFFFF'
          ctx.font = `bold ${44 * dpr}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('专业探索推荐', canvasWidthPx / 2, 50 * dpr)

          // 绘制副标题
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
          ctx.font = `${22 * dpr}px sans-serif`
          ctx.fillText('为您推荐的前10个匹配专业', canvasWidthPx / 2, 85 * dpr)

          // 绘制每个专业信息
          let currentY = 120 * dpr
          const cardPadding = 24 * dpr
          const spacing = cardSpacing * dpr

          // majorsWithReasons 已经是前10个专业了，直接使用
          majorsWithReasons.forEach((major, index) => {
            // 计算当前卡片高度（根据是否有匹配理由）
            const cardHeight = (baseCardHeight + (major.matchReason ? reasonHeight : 0)) * dpr
            
            // 绘制专业卡片背景（白色半透明）
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
            ctx.fillRect(cardPadding, currentY, canvasWidthPx - cardPadding * 2, cardHeight)

            // 绘制排名
            ctx.fillStyle = '#FF7F50'
            ctx.font = `bold ${28 * dpr}px sans-serif`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'top'
            ctx.fillText(`${index + 1}`, cardPadding + 16 * dpr, currentY + 16 * dpr)

            // 绘制专业名称
            ctx.fillStyle = '#FFFFFF'
            ctx.font = `bold ${26 * dpr}px sans-serif`
            ctx.textBaseline = 'top'
            const majorName = major.majorName || '未知专业'
            // 如果名称太长，截断
            const maxNameWidth = canvasWidthPx - cardPadding * 2 - 100 * dpr
            let displayName = majorName
            const nameMetrics = ctx.measureText(majorName)
            if (nameMetrics.width > maxNameWidth) {
              // 截断名称
              let truncated = majorName
              while (ctx.measureText(truncated + '...').width > maxNameWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1)
              }
              displayName = truncated + '...'
            }
            ctx.fillText(displayName, cardPadding + 64 * dpr, currentY + 16 * dpr)

            // 绘制专业代码
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
            ctx.font = `${20 * dpr}px sans-serif`
            ctx.fillText(`代码：${major.majorCode}`, cardPadding + 64 * dpr, currentY + 48 * dpr)

            // 绘制匹配分数
            ctx.fillStyle = '#FF7F50'
            ctx.font = `bold ${32 * dpr}px sans-serif`
            ctx.textAlign = 'right'
            ctx.textBaseline = 'top'
            const scoreText = formatScore(major.score)
            ctx.fillText(scoreText, canvasWidthPx - cardPadding - 16 * dpr, currentY + 16 * dpr)

            // 绘制分数标签
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
            ctx.font = `${18 * dpr}px sans-serif`
            ctx.fillText('匹配分', canvasWidthPx - cardPadding - 16 * dpr, currentY + 52 * dpr)

            // 绘制匹配理由（如果有）
            if (major.matchReason) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
              ctx.font = `bold ${20 * dpr}px sans-serif`
              ctx.textAlign = 'left'
              ctx.textBaseline = 'top'
              ctx.fillText('匹配原因：', cardPadding + 16 * dpr, currentY + 88 * dpr)
              
              // 绘制匹配理由文本（需要换行处理）
              ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
              ctx.font = `${20 * dpr}px sans-serif`
              const reasonText = major.matchReason
              const maxWidth = canvasWidthPx - cardPadding * 2 - 32 * dpr
              const lineHeight = 28 * dpr
              let y = currentY + 112 * dpr
              const maxLines = 3 // 最多显示3行
              const maxY = currentY + cardHeight - 16 * dpr
              
              // 文本换行处理（按字符分割，适合中文）
              const chars = reasonText.split('')
              let line = ''
              let lineCount = 0
              
              for (let i = 0; i < chars.length; i++) {
                const testLine = line + chars[i]
                const metrics = ctx.measureText(testLine)
                
                if (metrics.width > maxWidth && line.length > 0) {
                  // 当前行已满，绘制并换行
                  ctx.fillText(line, cardPadding + 16 * dpr, y)
                  line = chars[i]
                  y += lineHeight
                  lineCount++
                  
                  // 如果超过最大行数或超出卡片范围，截断
                  if (lineCount >= maxLines || y > maxY) {
                    if (i < chars.length - 1) {
                      ctx.fillText(line + '...', cardPadding + 16 * dpr, y)
                    } else {
                      ctx.fillText(line, cardPadding + 16 * dpr, y)
                    }
                    break
                  }
                } else {
                  line = testLine
                }
              }
              
              // 绘制最后一行（如果还有剩余且未超出范围）
              if (line && lineCount < maxLines && y <= maxY) {
                ctx.fillText(line, cardPadding + 16 * dpr, y)
              }
            } else {
              // 如果没有匹配理由，绘制专业简介（如果有且长度合适）
              if (major.majorBrief && major.majorBrief.length > 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
                ctx.font = `${18 * dpr}px sans-serif`
                ctx.textAlign = 'left'
                ctx.textBaseline = 'top'
                const brief = major.majorBrief.length > 50 ? major.majorBrief.substring(0, 50) + '...' : major.majorBrief
                ctx.fillText(brief, cardPadding + 16 * dpr, currentY + 88 * dpr)
              }
            }

            currentY += cardHeight + spacing
          })

          // 绘制底部提示
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
          ctx.font = `${20 * dpr}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText('逆袭智愿 - 让「喜欢」和「天赋」，带你找到答案', canvasWidthPx / 2, currentY + 24 * dpr)

          // 导出图片并预览
          setTimeout(() => {
            Taro.canvasToTempFilePath({
              canvas: canvas,
              success: (exportRes) => {
                setIsGeneratingImage(false)
                setShowShareDialog(false)
                
                // 预览图片，用户可以长按分享
                Taro.previewImage({
                  urls: [exportRes.tempFilePath],
                  current: exportRes.tempFilePath,
                  success: () => {
                    // 预览成功后，显示操作说明
                    setTimeout(() => {
                      setShowShareGuide(true)
                    }, 500)
                  },
                  fail: (err) => {
                    console.error('预览图片失败:', err)
                    Taro.showToast({
                      title: err.errMsg || '预览图片失败',
                      icon: 'none',
                      duration: 2000
                    })
                  },
                })
              },
              fail: (err) => {
                console.error('导出图片失败:', err)
                Taro.showToast({
                  title: err.errMsg || '生成图片失败',
                  icon: 'none',
                  duration: 2000
                })
                setIsGeneratingImage(false)
              },
            })
          }, 500)
        })
    } catch (error: any) {
      console.error('生成分享图片失败:', error)
      Taro.showToast({
        title: error?.message || '操作失败',
        icon: 'none',
        duration: 2000
      })
      setIsGeneratingImage(false)
    }
  }

  // 处理分享按钮点击
  const handleShareClick = () => {
    if (allMajors.length === 0) {
      Taro.showToast({
        title: '暂无专业数据',
        icon: 'none'
      })
      return
    }
    setShowShareDialog(true)
  }

  // 根据搜索关键词过滤专业列表
  const filteredMajors = useMemo(() => {
    if (!searchQuery.trim()) {
      return displayedMajors
    }
    
    const query = searchQuery.trim().toLowerCase()
    return displayedMajors.filter(major => {
      // 搜索专业名称或代码
      const nameMatch = major.majorName?.toLowerCase().includes(query) || false
      const codeMatch = major.majorCode?.toLowerCase().includes(query) || false
      return nameMatch || codeMatch
    })
  }, [displayedMajors, searchQuery])

  return (
    <View className="majors-page">
      
      {/* 头部 */}
      <View className="majors-page__header">
        <View className="majors-page__header-content">
          <View className="majors-page__header-top">
            <View className="majors-page__header-title-wrapper">
              <Text className="majors-page__title">专业探索</Text>
              <Text className="majors-page__subtitle">发现适合你的专业方向</Text>
            </View>
            <View className="majors-page__share-btn" onClick={handleShareClick}>
              <Text className="majors-page__share-icon">📤</Text>
            </View>
          </View>

          {/* 搜索框 */}
          <View className="majors-page__search">
            <View className="majors-page__search-icon">🔍</View>
            <Input
              className="majors-page__search-input"
              placeholder="搜索专业名称或代码..."
              value={searchQuery}
              onInput={(e) => setSearchQuery(e.detail.value)}
            />
          </View>

          {/* 标签页 */}
          <View className="majors-page__tabs">
            {["本科", "本科(职业)", "专科"].map((tab) => (
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
          ) : filteredMajors.length === 0 ? (
            <View className="majors-page__empty">
              <Text className="majors-page__empty-text">未找到匹配的专业</Text>
              <Text className="majors-page__empty-desc">请尝试其他搜索关键词</Text>
            </View>
          ) : (
            <>
              <View className="majors-page__majors-list">
                {filteredMajors.map((major, index) => {
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
                          <View 
                            className="majors-page__major-name majors-page__major-name--clickable"
                            onClick={() => {
                              Taro.navigateTo({
                                url: `/pages/assessment/single-major/index?code=${major.majorCode}&name=${encodeURIComponent(major.majorName || '')}`
                              })
                            }}
                          >
                            <Text>{major.majorName}</Text>
                          </View>
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
              {!hasMore && displayedMajors.length > 0 && !searchQuery.trim() && (
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

      {/* 问卷完成提示弹窗 */}
      <QuestionnaireRequiredModal
        open={showQuestionnaireModal}
        onOpenChange={setShowQuestionnaireModal}
        answerCount={answerCount}
      />

      {/* 分享对话框 */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="majors-page__share-dialog" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>分享专业推荐</DialogTitle>
            <DialogDescription>
              <Text className="majors-page__share-dialog-desc">
                生成包含前10个匹配专业的详细推荐图片，预览后长按即可分享给好友
              </Text>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <View className="majors-page__share-dialog-actions">
              <Button
                className="majors-page__share-dialog-btn"
                onClick={generateShareImage}
                disabled={isGeneratingImage}
                size="lg"
              >
                {isGeneratingImage ? '生成中...' : '📸 生成分享图片'}
              </Button>
              <Button
                variant="outline"
                className="majors-page__share-dialog-btn"
                onClick={() => setShowShareDialog(false)}
                size="lg"
              >
                取消
              </Button>
            </View>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分享操作说明对话框 */}
      <Dialog open={showShareGuide} onOpenChange={setShowShareGuide}>
        <DialogContent className="majors-page__share-guide-dialog" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>如何分享图片给好友</DialogTitle>
          </DialogHeader>
          <View className="majors-page__share-guide-content">
            <View className="majors-page__share-guide-step">
              <View className="majors-page__share-guide-step-number">1</View>
              <View className="majors-page__share-guide-step-content">
                <Text className="majors-page__share-guide-step-title">图片已生成并打开预览</Text>
                <Text className="majors-page__share-guide-step-desc">
                  专业推荐图片已生成，当前正在预览界面
                </Text>
              </View>
            </View>
            <View className="majors-page__share-guide-step">
              <View className="majors-page__share-guide-step-number">2</View>
              <View className="majors-page__share-guide-step-content">
                <Text className="majors-page__share-guide-step-title">长按图片</Text>
                <Text className="majors-page__share-guide-step-desc">
                  在预览界面中，长按图片会弹出分享菜单
                </Text>
              </View>
            </View>
            <View className="majors-page__share-guide-step">
              <View className="majors-page__share-guide-step-number">3</View>
              <View className="majors-page__share-guide-step-content">
                <Text className="majors-page__share-guide-step-title">选择分享方式</Text>
                <Text className="majors-page__share-guide-step-desc">
                  在弹出的菜单中选择"发送给朋友"或"分享到朋友圈"，即可分享给好友
                </Text>
              </View>
            </View>
            <View className="majors-page__share-guide-tip">
              <Text className="majors-page__share-guide-tip-text">
                💡 提示：长按预览中的图片即可快速分享，无需保存到相册
              </Text>
            </View>
          </View>
          <DialogFooter>
            <Button
              className="majors-page__share-guide-btn"
              onClick={() => setShowShareGuide(false)}
              size="lg"
            >
              我知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 隐藏的 Canvas，用于生成分享图片 */}
      <Canvas
        type="2d"
        id="majorsShareCanvas"
        className="majors-page__share-canvas"
        style={{ width: '750rpx', height: '4000rpx', position: 'fixed', top: '-9999rpx', left: '-9999rpx' }}
      />
    </View>
  )
}

