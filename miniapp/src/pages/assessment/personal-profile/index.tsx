// 个人特质报告页面
import React, { useState, useEffect, useMemo, useRef,useCallback } from 'react'
import { View, Text, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { BottomNav } from '@/components/BottomNav'
import { getUserPortrait, Portrait } from '@/services/portraits'
import './index.less'

// 七维度配置（对应7种颜色）
const DIMENSIONS = ['看', '听', '说', '记', '想', '做', '运动'] as const

// 维度颜色映射
const DIMENSION_COLORS: Record<string, string> = {
  看: '#3B82F6', // 蓝色
  听: '#8B5CF6', // 紫色
  说: '#10B981', // 绿色
  记: '#F59E0B', // 橙色
  想: '#EF4444', // 红色
  做: '#EC4899', // 粉色
  运动: '#06B6D4' // 青色
}

// 维度颜色映射（浅色版本，用于背景）
const DIMENSION_LIGHT_COLORS: Record<string, string> = {
  看: '#DBEAFE', // 浅蓝色
  听: '#EDE9FE', // 浅紫色
  说: '#D1FAE5', // 浅绿色
  记: '#FEF3C7', // 浅橙色
  想: '#FEE2E2', // 浅红色
  做: '#FCE7F3', // 浅粉色
  运动: '#CFFAFE' // 浅青色
}

// 节点尺寸常量（统一管理，确保绘制和点击检测一致）
const DEFAULT_NODE_RADIUS = 38 // 节点半径（选中和未选中都使用相同大小）
const SELECTED_NODE_RADIUS = 38 // 与默认相同，保持大小一致
const CLICK_TOLERANCE = 10 // 点击容差

/**
 * 解析核心特质文本为列表
 */
function parseTraits(description: string): string[] {
  if (!description) return []
  // 按句号、分号或换行符分割
  const traits = description
    .split(/[。；\n]/)
    .map(t => t.trim())
    .filter(t => t.length > 0)
  return traits
}

/**
 * 解析适配角色文本为列表
 */
function parseRoles(rolesText: string): string[] {
  if (!rolesText) return []
  // 按逗号、分号或换行符分割
  const roles = rolesText
    .split(/[，,；;\n]/)
    .map(r => r.trim())
    .filter(r => r.length > 0)
  return roles
}

/**
 * 七维度可视化图表组件（使用Canvas实现）
 */
function DimensionsChart({
  dimensions,
  portraitsMap,
  selectedDimension,
  onSelectDimension
}: {
  dimensions: typeof DIMENSIONS
  portraitsMap: Map<string, Portrait>
  selectedDimension: string | null
  onSelectDimension: (dim: string) => void
}) {
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 })
  
  // 使用统一的常量
  const NODE_RADIUS = 32
  const CLICK_TOLERANCE = 15
  
  // 使用ref来避免重新计算导致位置变化
  const positionsRef = useRef<any[]>([])
  
  // 计算维度位置
  const dimensionPositions = useMemo(() => {
    const centerX = canvasSize.width / 2
    const centerY = canvasSize.height / 2
    const margin = 15
    const radius = Math.min(canvasSize.width, canvasSize.height) / 2 - NODE_RADIUS - margin
    
    const positions = dimensions.map((dim, index) => {
      const angle = (index * 2 * Math.PI) / dimensions.length - Math.PI / 2
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      return {
        dim,
        x,
        y,
        hasPortrait: portraitsMap.has(dim)
      }
    })
    
    positionsRef.current = positions
    return positions
  }, [dimensions, portraitsMap, canvasSize])

  // 绘制Canvas
  const drawCanvas = useCallback(() => {
    if (canvasSize.width === 0) return
    
    const query = Taro.createSelectorQuery()
    query
      .select('#dimensions-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        
        // 确保Canvas尺寸
        if (canvas.width !== canvasSize.width || canvas.height !== canvasSize.height) {
          canvas.width = canvasSize.width
          canvas.height = canvasSize.height
        }
        
        // 完全清空画布
        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)
        
        const centerX = canvasSize.width / 2
        const centerY = canvasSize.height / 2
        
        // 1. 先绘制所有连接线
        positionsRef.current.forEach((pos) => {
          ctx.beginPath()
          ctx.moveTo(centerX, centerY)
          ctx.lineTo(pos.x, pos.y)
          ctx.strokeStyle = '#e5e7eb'
          ctx.lineWidth = 1.5
          ctx.setLineDash([3, 3])
          ctx.stroke()
          ctx.setLineDash([])
        })
        
        // 2. 绘制所有维度节点（未选中状态）
        positionsRef.current.forEach((pos) => {
          const color = DIMENSION_COLORS[pos.dim]
          const isSelected = selectedDimension === pos.dim
          const hasPortrait = pos.hasPortrait
          
          // 如果选中，先绘制外圈
          if (isSelected) {
            ctx.beginPath()
            ctx.arc(pos.x, pos.y, NODE_RADIUS + 6, 0, 2 * Math.PI)
            ctx.fillStyle = color
            ctx.globalAlpha = 0.15
            ctx.fill()
            ctx.globalAlpha = 1
          }
          
          // 绘制主圆（大小始终不变）
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, 2 * Math.PI)
          ctx.fillStyle = isSelected ? color : '#fff'
          ctx.fill()
          
          // 边框
          ctx.strokeStyle = color
          ctx.lineWidth = 2  // 固定边框宽度
          ctx.globalAlpha = hasPortrait ? 1 : 0.5
          ctx.stroke()
          ctx.globalAlpha = 1
          
          // 文字 - 关键：完全相同的样式
          ctx.fillStyle = isSelected ? '#fff' : color
          ctx.font = 'bold 24px "PingFang SC", "Microsoft YaHei", sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(pos.dim, pos.x, pos.y - 1)
        })
        
        // 3. 绘制中心圆和文字
        ctx.beginPath()
        ctx.arc(centerX, centerY, 36, 0, 2 * Math.PI)
        ctx.fillStyle = '#f5f5f5'
        ctx.fill()
        ctx.strokeStyle = '#e5e7eb'
        ctx.lineWidth = 1.5
        ctx.stroke()
        
        ctx.fillStyle = '#666'
        ctx.font = 'bold 22px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('七维度', centerX, centerY - 1)
      })
  }, [canvasSize, selectedDimension])

  // 绘制Canvas
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // 初始化Canvas尺寸
  useEffect(() => {
    const windowInfo = Taro.getWindowInfo()
    const windowWidth = windowInfo.windowWidth
    const canvasWidth = (600 / 750) * windowWidth
    
    // 设置初始尺寸
    setCanvasSize({ width: canvasWidth, height: canvasWidth })
    
    // 初始绘制完成后强制重绘一次，确保样式稳定
    const timer = setTimeout(() => {
      drawCanvas()
    }, 50)
    
    return () => clearTimeout(timer)
  }, [drawCanvas])

  // 处理Canvas点击事件
  const handleCanvasClick = (e: any) => {
    console.log('点击事件:', e.type)
    
    const query = Taro.createSelectorQuery()
    query
      .select('#dimensions-canvas')
      .boundingClientRect((rect: any) => {
        if (!rect) return
        
        console.log('Canvas rect:', rect)
        console.log('Canvas逻辑尺寸:', canvasSize)
        
        let clickX = 0
        let clickY = 0
        
        // 获取点击位置
        if (e.detail && typeof e.detail.x === 'number') {
          clickX = e.detail.x
          clickY = e.detail.y
        } else if (e.touches && e.touches.length > 0) {
          clickX = e.touches[0].clientX
          clickY = e.touches[0].clientY
        } else if (e.changedTouches && e.changedTouches.length > 0) {
          clickX = e.changedTouches[0].clientX
          clickY = e.changedTouches[0].clientY
        } else {
          return
        }
        
        console.log('原始点击坐标:', { clickX, clickY })
        
        // 转换为Canvas相对坐标
        const relativeX = clickX - rect.left
        const relativeY = clickY - rect.top
        
        console.log('相对Canvas坐标:', { relativeX, relativeY })
        
        // 检查点击了哪个节点
        const positions = positionsRef.current
        let clickedDim = null
        
        for (const pos of positions) {
          const dist = Math.sqrt(
            Math.pow(relativeX - pos.x, 2) + Math.pow(relativeY - pos.y, 2)
          )
          
          if (dist < NODE_RADIUS + CLICK_TOLERANCE) {
            clickedDim = pos.dim
            // 检查是否有画像数据
            if (!pos.hasPortrait) {
              // 无画像时显示提示
              Taro.showToast({
                title: `${pos.dim}维度暂无画像数据`,
                icon: 'none',
                duration: 2000
              })
            } else {
              // 有画像数据时，更新选中状态
              onSelectDimension(pos.dim)
            }
            break
          }
        }
      })
      .exec()
  }

  return (
    <View className="personal-profile-page__chart-container">
      <View className="personal-profile-page__chart-tip">
        <Text className="personal-profile-page__chart-tip-text">
          👆 点击维度圆圈查看详情
        </Text>
      </View>
      
      <View className="personal-profile-page__chart-wrapper">
        <Canvas
          id="dimensions-canvas"
          type="2d"
          className="personal-profile-page__chart-canvas"
          style={{
            width: `${canvasSize.width}px`,
            height: `${canvasSize.height}px`
          }}
          onTap={handleCanvasClick}
          onTouchEnd={handleCanvasClick}
        />
      </View>
    </View>
  )
}

/**
 * Portrait 详情卡片组件
 */
function PortraitDetailCard({ 
  portrait, 
  dimension,
  color,
  lightColor
}: { 
  portrait: Portrait
  dimension: string
  color: string
  lightColor: string
}) {
  const [expanded, setExpanded] = useState(false)

  // 解析核心特质
  const traits = useMemo(() => {
    return parseTraits(portrait.partOneDescription || portrait.status || '')
  }, [portrait.partOneDescription, portrait.status])

  // 解析适配角色
  const roles = useMemo(() => {
    if (portrait.quadrant1Niches && portrait.quadrant1Niches.length > 0) {
      // 合并所有生态位的possibleRoles
      const allRoles = portrait.quadrant1Niches
        .map(niche => niche.possibleRoles)
        .join('，')
      return parseRoles(allRoles)
    }
    return []
  }, [portrait.quadrant1Niches])

  // 获取核心维度显示文本
  const getDimensionText = () => {
    // 如果有partOneSubTitle，使用"维度-子类型"格式
    if (portrait.partOneSubTitle) {
      return `${dimension}-${portrait.partOneSubTitle}`
    }
    // 否则只显示维度
    return dimension
  }

  // 处理查看完整分析
  const handleViewDetail = () => {
    setExpanded(!expanded)
  }

  return (
    <View className="personal-profile-page__detail-card">
      {/* 彩色头部 */}
      <View 
        className="personal-profile-page__detail-header"
        style={{ backgroundColor: color }}
      >
        <Text className="personal-profile-page__detail-title">{portrait.name}</Text>
        <Text className="personal-profile-page__detail-id">
          ID: {portrait.id} | {getDimensionText()}
        </Text>
      </View>

      {/* 卡片内容 */}
      <View className="personal-profile-page__detail-body">
        {/* 核心特质 */}
        {traits.length > 0 && (
          <View className="personal-profile-page__detail-section">
            <Text className="personal-profile-page__detail-section-title">核心特质</Text>
            <View className="personal-profile-page__detail-traits">
              {traits.map((trait, index) => (
                <View key={index} className="personal-profile-page__detail-trait-item">
                  <View className="personal-profile-page__detail-trait-dot" />
                  <Text className="personal-profile-page__detail-trait-text">{trait}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 展开的详细内容 */}
        {expanded && (
          <View className="personal-profile-page__detail-expanded">
            {/* 核心双刃剑 */}
            {portrait.partTwoDescription && (
              <View className="personal-profile-page__detail-section">
                <Text className="personal-profile-page__detail-section-title">
                  核心双刃剑
                </Text>
                <Text className="personal-profile-page__detail-double-edged">
                  {portrait.partTwoDescription}
                          </Text>
                        </View>
            )}

            {/* 适配角色 */}
            {roles.length > 0 && (
              <View className="personal-profile-page__detail-section">
                <Text className="personal-profile-page__detail-section-title">适配角色</Text>
                <View className="personal-profile-page__detail-roles">
                  {roles.map((role, index) => (
                    <View 
                      key={index} 
                      className="personal-profile-page__detail-role-pill"
                      style={{ backgroundColor: lightColor, color: color }}
                    >
                      <Text className="personal-profile-page__detail-role-text">{role}</Text>
                          </View>
                    ))}
                  </View>
            </View>
          )}
        </View>
      )}

        {/* 查看完整分析链接 */}
        <View 
          className="personal-profile-page__detail-link"
          onClick={handleViewDetail}
        >
          <Text 
            className="personal-profile-page__detail-link-text"
            style={{ color: color }}
          >
            {expanded ? '收起' : '查看完整分析'} &gt;
          </Text>
        </View>
      </View>
    </View>
  )
}

export default function PersonalProfilePage() {
  const [portraits, setPortraits] = useState<Portrait[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null)

  useEffect(() => {
    // 加载用户画像数据
    const loadPortraitData = async () => {
      try {
        setLoading(true)
        const data = await getUserPortrait()
        const portraitsList = data.portrait || []
        setPortraits(portraitsList)
        
        // 自动选择第一个有数据的维度
        if (portraitsList.length > 0) {
          const firstPortrait = portraitsList[0]
          const firstDimension = firstPortrait.likeElement?.dimension || 
                                 firstPortrait.talentElement?.dimension || 
                                 DIMENSIONS[0]
          setSelectedDimension(firstDimension)
        }
      } catch (error) {
        console.error('加载用户画像数据失败:', error)
        Taro.showToast({
          title: '加载数据失败，请稍后重试',
          icon: 'none',
          duration: 2000
        })
      } finally {
        setLoading(false)
      }
    }
    
    loadPortraitData()
  }, [])

  // 将portraits按维度分组
  const portraitsByDimension = useMemo(() => {
    const map = new Map<string, Portrait>()
    
    portraits.forEach(portrait => {
      // 优先使用likeElement的维度，如果没有则使用talentElement的维度
      let dimension = portrait.likeElement?.dimension || 
                     portrait.talentElement?.dimension || 
                     ''
      
      // 如果仍然没有维度，尝试从name或status中提取维度信息
      if (!dimension) {
        for (const dim of DIMENSIONS) {
          if (portrait.name?.includes(dim) || portrait.status?.includes(dim)) {
            dimension = dim
            break
          }
        }
      }
      
      // 如果还是没有找到维度，按索引分配维度
      if (!dimension || !DIMENSIONS.includes(dimension as any)) {
        const index = portraits.indexOf(portrait)
        dimension = DIMENSIONS[index % DIMENSIONS.length]
      }
      
      // 如果该维度还没有portrait，或者当前portrait的ID更小，则使用当前portrait
      if (!map.has(dimension) || portrait.id < (map.get(dimension)?.id || 0)) {
        map.set(dimension, portrait)
      }
    })
    
    return map
  }, [portraits])

  // 获取当前选中的portrait
  const selectedPortrait = useMemo(() => {
    if (!selectedDimension) return null
    return portraitsByDimension.get(selectedDimension) || null
  }, [selectedDimension, portraitsByDimension])

  if (loading) {
    return (
      <View className="personal-profile-page">
        <View className="personal-profile-page__loading">
          <Text>加载中...</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  if (portraits.length === 0) {
    return (
      <View className="personal-profile-page">
        <View className="personal-profile-page__empty">
          <Text>暂无画像数据</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View 
      className="personal-profile-page"
      onTouchStart={(e) => {
        // 只在图表区域外的触摸才阻止，避免影响图表交互
        const target = e.target as any
        if (target && !target.closest?.('.personal-profile-page__chart-wrapper')) {
          // 图表外的触摸可以正常处理
        }
      }}
    >
      {/* 头部区域 */}
      <View className="personal-profile-page__header">
        <View className="personal-profile-page__header-content">
          <Text className="personal-profile-page__header-title">个人特质分析</Text>
        </View>
        <View className="personal-profile-page__header-wave" />
      </View>

      {/* 内容区域 */}
      <View className="personal-profile-page__content">
        {/* 七维度可视化图表 */}
        <DimensionsChart
          dimensions={DIMENSIONS}
          portraitsMap={portraitsByDimension}
          selectedDimension={selectedDimension}
          onSelectDimension={setSelectedDimension}
        />

        {/* 详情卡片 */}
        {selectedPortrait && selectedDimension && (
          <View className="personal-profile-page__detail-container">
            <PortraitDetailCard
              portrait={selectedPortrait}
              dimension={selectedDimension}
              color={DIMENSION_COLORS[selectedDimension]}
              lightColor={DIMENSION_LIGHT_COLORS[selectedDimension]}
            />
                  </View>
                )}
      </View>

      <BottomNav />
    </View>
  )
}
