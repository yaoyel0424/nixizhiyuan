// 双向滑动条组件
import React, { useState, useRef, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.less'

interface RangeSliderProps {
  min: number
  max: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  step?: number
  currentScore?: number // 用户当前分数，用于显示指示器
  disabled?: boolean // 是否禁用
}

/**
 * 双向滑动条组件
 * 支持左右两个滑块独立控制范围
 */
export const RangeSlider: React.FC<RangeSliderProps> = ({
  min,
  max,
  value,
  onChange,
  step = 1,
  currentScore,
  disabled = false,
}) => {
  const [minValue, maxValue] = value
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null)
  const trackRef = useRef<any>(null)
  const [trackInfo, setTrackInfo] = useState<{ left: number; width: number } | null>(null)

  // 获取滑动条轨道信息
  useEffect(() => {
    const updateTrackInfo = () => {
      const query = Taro.createSelectorQuery()
      query.select('.range-slider__track').boundingClientRect((rect: any) => {
        if (rect) {
          setTrackInfo({
            left: rect.left,
            width: rect.width,
          })
        }
      }).exec()
    }
    
    // 延迟获取，确保DOM已渲染
    const timer = setTimeout(updateTrackInfo, 100)
    return () => clearTimeout(timer)
  }, [])

  // 将值转换为百分比位置
  const valueToPercent = (val: number) => {
    return ((val - min) / (max - min)) * 100
  }

  // 将百分比位置转换为值
  const percentToValue = (percent: number) => {
    const rawValue = min + (percent / 100) * (max - min)
    return Math.max(min, Math.min(max, Math.round(rawValue / step) * step))
  }

  // 处理触摸开始
  const handleTouchStart = (type: 'min' | 'max', e: any) => {
    if (disabled) return // 禁用状态下不处理触摸事件
    e.stopPropagation()
    setIsDragging(type)
    // 更新轨道信息
    const query = Taro.createSelectorQuery()
    query.select('.range-slider__track').boundingClientRect((rect: any) => {
      if (rect) {
        setTrackInfo({
          left: rect.left,
          width: rect.width,
        })
      }
    }).exec()
  }

  // 处理触摸移动
  const handleTouchMove = (e: any) => {
    if (!isDragging) return

    // 阻止默认行为和事件冒泡
    if (e.preventDefault) {
      e.preventDefault()
    }
    if (e.stopPropagation) {
      e.stopPropagation()
    }

    const touch = e.touches?.[0] || e.changedTouches?.[0] || e.detail?.touches?.[0]
    if (!touch) return

    // 获取触摸坐标（兼容不同平台）
    const clientX = touch.clientX || touch.x || (touch.pageX ? touch.pageX - (typeof window !== 'undefined' ? window.scrollX : 0) : 0)
    
    // 实时更新轨道信息并计算位置
    const query = Taro.createSelectorQuery()
    query.select('.range-slider__track').boundingClientRect((rect: any) => {
      if (rect) {
        const trackLeft = rect.left
        const trackWidth = rect.width
        
        // 计算触摸点相对于轨道的X坐标
        const x = clientX - trackLeft
        const percent = Math.max(0, Math.min(100, (x / trackWidth) * 100))
        const newValue = percentToValue(percent)

        if (isDragging === 'min') {
          const newMin = Math.max(min, Math.min(newValue, maxValue - step))
          onChange([newMin, maxValue])
        } else {
          const newMax = Math.min(max, Math.max(newValue, minValue + step))
          onChange([minValue, newMax])
        }
      }
    }).exec()
  }

  // 处理触摸结束
  const handleTouchEnd = () => {
    setIsDragging(null)
  }

  const minPercent = valueToPercent(minValue)
  const maxPercent = valueToPercent(maxValue)
  const currentScorePercent = currentScore ? valueToPercent(currentScore) : null

  return (
    <View className={`range-slider ${disabled ? 'range-slider--disabled' : ''}`}>
      <View 
        className="range-slider__container"
      >
        {/* 用户分数指示器 - 放在容器级别，确保可见 */}
        {currentScore !== undefined && currentScore !== null && currentScore >= min && currentScore <= max && (
          <View 
            className="range-slider__current-score-indicator"
            style={{ left: `${valueToPercent(currentScore)}%` }}
          >
            <View className="range-slider__current-score-bubble">
              <Text className="range-slider__current-score-text">您的分数: {currentScore}</Text>
            </View>
            <View className="range-slider__current-score-arrow" />
          </View>
        )}

        {/* 滑动条轨道 */}
        <View className="range-slider__track">
          {/* 未选中区域（左侧） */}
          <View 
            className="range-slider__track-bg range-slider__track-bg--left"
            style={{ width: `${minPercent}%` }}
          />
          
          {/* 选中区域 */}
          <View 
            className="range-slider__track-bg range-slider__track-bg--active"
            style={{ 
              left: `${minPercent}%`,
              width: `${maxPercent - minPercent}%`
            }}
          />
          
          {/* 未选中区域（右侧） */}
          <View 
            className="range-slider__track-bg range-slider__track-bg--right"
            style={{ 
              left: `${maxPercent}%`,
              width: `${100 - maxPercent}%`
            }}
          />

          {/* 最小值滑块 */}
          <View
            className={`range-slider__thumb range-slider__thumb--min ${isDragging === 'min' ? 'range-slider__thumb--active' : ''}`}
            style={{ left: `${minPercent}%` }}
            onTouchStart={(e) => handleTouchStart('min', e)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <View className="range-slider__thumb-inner" />
          </View>

          {/* 最大值滑块 */}
          <View
            className={`range-slider__thumb range-slider__thumb--max ${isDragging === 'max' ? 'range-slider__thumb--active' : ''}`}
            style={{ left: `${maxPercent}%` }}
            onTouchStart={(e) => handleTouchStart('max', e)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <View className="range-slider__thumb-inner" />
          </View>
        </View>
      </View>
    </View>
  )
}
