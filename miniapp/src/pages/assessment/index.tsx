// 探索成果主页面
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { BottomNav } from '@/components/BottomNav'
import { getStorage } from '@/utils/storage'
import { getUserRelatedDataCount } from '@/services/user'
import './index.less'

const STORAGE_KEY = 'questionnaire_answers'
const DIMENSION_ORDER = ['看', '听', '说', '记', '想', '做', '运动']

// 加载答案
function loadAnswersFromStorage(): Record<number, number> {
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.error('加载答案失败:', error)
    return {}
  }
}

export default function AssessmentPage() {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [intendedMajorsCount, setIntendedMajorsCount] = useState(0)
  const [scaleAnswersCount, setScaleAnswersCount] = useState(0) // 量表答案数量
  const [loading, setLoading] = useState(false)
  const fetchingRef = useRef(false) // 使用 ref 来防止重复调用

  /**
   * 小程序分享给朋友
   */
  useShareAppMessage(() => {
    return {
      title: '逆袭智愿 - 让「喜欢」和「天赋」，带你找到答案',
      path: '/pages/assessment/index',
      imageUrl: '', // 可选：分享图片 URL
    }
  })

  /**
   * 小程序分享到朋友圈
   */
  useShareTimeline(() => {
    return {
      title: '逆袭智愿 - 让「喜欢」和「天赋」，带你找到答案',
      query: '',
      imageUrl: '',
    }
  })

  // 从接口获取用户相关数据统计
  const fetchUserRelatedData = useCallback(async () => {
    // 如果正在加载中，避免重复调用
    if (fetchingRef.current) {
      return
    }

    try {
      fetchingRef.current = true
      setLoading(true)
      const data = await getUserRelatedDataCount()
      // 使用接口返回的数据
      setIntendedMajorsCount(data.majorFavoritesCount || 0)
      setScaleAnswersCount(data.scaleAnswersCount || 0)
    } catch (error) {
      console.error('获取用户统计数据失败:', error)
      // 如果接口调用失败，降级使用本地存储数据
      try {
        const storedMajors = await getStorage<string[]>('intendedMajors')
        if (storedMajors) {
          setIntendedMajorsCount(Array.isArray(storedMajors) ? storedMajors.length : 0)
        }
        // 降级时无法获取 scaleAnswersCount，使用本地答案数量
        const storedAnswers = loadAnswersFromStorage()
        setScaleAnswersCount(Object.keys(storedAnswers).length)
      } catch (storageError) {
        console.error('读取本地存储失败:', storageError)
      }
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  // 组件挂载时加载数据
  useEffect(() => {
    const loadData = async () => {
      const storedAnswers = loadAnswersFromStorage()
      setAnswers(storedAnswers)
      
      // 从接口获取统计数据
      await fetchUserRelatedData()
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 只在组件挂载时执行一次

  // 页面显示时重新加载数据（从其他页面返回时刷新）
  useDidShow(() => {
    // 重新加载答案数据
    const storedAnswers = loadAnswersFromStorage()
    setAnswers(storedAnswers)
    
    // 重新获取统计数据（心动专业、量表答案数量）
    fetchUserRelatedData()
  })

  // 根据 scaleAnswersCount 计算评估进度
  const TOTAL_QUESTIONS = 168 // 总题目数
  const TOTAL_DIMENSIONS = 7 // 总维度数
  const QUESTIONS_PER_DIMENSION = TOTAL_QUESTIONS / TOTAL_DIMENSIONS // 每个维度的题目数 = 24

  // 判断是否完成：scaleAnswersCount 是否等于 168
  const isCompleted = scaleAnswersCount >= TOTAL_QUESTIONS

  // 维度已解锁：scaleAnswersCount 除以 7，取整，但不超过 7
  const completedDimensionsCount = Math.min(Math.floor(scaleAnswersCount / 7), TOTAL_DIMENSIONS)
  
  // 已解锁特质数：根据 scaleAnswersCount 计算，每个维度有 24 题
  // 特质数 = scaleAnswersCount / 24，取整，但不超过 7
  const completedTraitsCount = Math.min(Math.floor(scaleAnswersCount / QUESTIONS_PER_DIMENSION), TOTAL_DIMENSIONS)

  // 计算已匹配专业数（每20题一个专业）
  const matchedMajorsCount = Math.floor(scaleAnswersCount / 20)

  // 根据 scaleAnswersCount 计算进度百分比
  const assessmentProgress = Math.min((scaleAnswersCount / TOTAL_QUESTIONS) * 100, 100)
  const completedCount = completedDimensionsCount
  const totalCount = TOTAL_DIMENSIONS

  // 判断院校探索是否解锁
  // 解锁条件：问卷完成（scaleAnswersCount >= 168）且心动专业数量 > 0
  const isSchoolExplorationUnlocked = 
    scaleAnswersCount >= TOTAL_QUESTIONS && 
    intendedMajorsCount > 0

  return (
    <View className="assessment-page">
      
      {/* 头部 */}
      <View className="index-page__banner">
        <View className="index-page__banner-content">
          <Text className="index-page__banner-title">我的天赋逆袭中心</Text>
          <Text className="index-page__banner-subtitle">
            {isCompleted ? '查看您的深度分析报告' : '了解自己，发现潜能，科学规划未来'}
          </Text>
        </View>
      </View>

      {/* 内容区域 */}
      <View className="assessment-page__content">
        {!isCompleted && (
          <Card className="assessment-page__progress-card">
            <View className="assessment-page__progress-header">
              <Text className="assessment-page__progress-title">评估进度</Text>
              <Text className="assessment-page__progress-percent">
                {Math.round(assessmentProgress)}%
              </Text>
            </View>
            <View className="assessment-page__progress-bar">
              <View 
                className="assessment-page__progress-fill"
                style={{ width: `${assessmentProgress}%` }}
              />
            </View>
            <View className="assessment-page__progress-info">
              <Text className="assessment-page__progress-text">
                维度已解锁 {completedCount}/{totalCount}
              </Text>
              <Text className="assessment-page__progress-text">
                已解锁特质{completedTraitsCount}项，已匹配专业{matchedMajorsCount}个
              </Text>
            </View>
            <Button
              onClick={() => {
                Taro.navigateTo({
                  url: '/pages/assessment/all-majors/index'
                })
              }}
              className="assessment-page__continue-button"
              size="lg"
            >
              继续作答 →
            </Button>
          </Card>
        )}

        {/* 探索成果 */}
        <View className="assessment-page__results">
          <Text className="assessment-page__results-title">探索成果</Text>
          <View className="assessment-page__results-list">
            {/* 个人特质报告 */}
            <Card 
              className="assessment-page__result-card"
              onClick={() => {
                Taro.navigateTo({
                  url: '/pages/assessment/personal-profile/index'
                })
              }}
            >
              <View className="assessment-page__result-card-content">
                <View className="assessment-page__result-card-icon assessment-page__result-card-icon--blue">
                  <Text>👤</Text>
                </View>
                <View className="assessment-page__result-card-info">
                  <Text className="assessment-page__result-card-title assessment-page__result-card-title--blue">
                    个人特质报告
                  </Text>
                  <Text className="assessment-page__result-card-desc">
                    全面了解自己与众不同的特质、面临的挑战和应对策略
                  </Text>
                </View>
              </View>
            </Card>

            {/* 学习方法探索 */}
            <Card
              className="assessment-page__result-card"
              onClick={() => {
                Taro.navigateTo({
                  url: '/pages/assessment/learning-step/index'
                })
              }}
            >
              <View className="assessment-page__result-card-content">
                <View className="assessment-page__result-card-icon assessment-page__result-card-icon--orange">
                  <Text>📚</Text>
                </View>
                <View className="assessment-page__result-card-info">
                  <Text className="assessment-page__result-card-title assessment-page__result-card-title--orange">
                    学习方法探索
                  </Text>
                  <Text className="assessment-page__result-card-desc">
                    根据喜欢与天赋，探索更适合你的学习策略与提分路径
                  </Text>
                </View>
              </View>
            </Card>

            {/* 心动专业 */}
            <Card 
              className="assessment-page__result-card"
              onClick={() => {
                Taro.navigateTo({
                  url: '/pages/assessment/favorite-majors/index'
                })
              }}
            >
              <View className="assessment-page__result-card-content">
                <View className="assessment-page__result-card-icon assessment-page__result-card-icon--orange">
                  <Text>❤️</Text>
                </View>
                <View className="assessment-page__result-card-info">
                  <View className="assessment-page__result-card-header">
                    <Text className="assessment-page__result-card-title assessment-page__result-card-title--orange">
                      心动专业
                    </Text>
                    {intendedMajorsCount > 0 && (
                      <View className="assessment-page__result-card-badge assessment-page__result-card-badge--orange">
                        <Text>{intendedMajorsCount}个</Text>
                      </View>
                    )}
                  </View>
                  <Text className="assessment-page__result-card-desc">
                    匹配喜欢与天赋，锁定适配度高的专业
                  </Text>
                </View>
              </View>
            </Card>

            {/* 院校探索 */}
            <Card 
              className="assessment-page__result-card"
              onClick={() => {
                if (!isSchoolExplorationUnlocked) {
                  // 不解锁时显示友好提示
                  let message = '院校探索功能暂未解锁\n\n'
                  const conditions: string[] = []
                  if (scaleAnswersCount < TOTAL_QUESTIONS) {
                    conditions.push('完成全部问卷（168题）')
                  }
                  if (intendedMajorsCount === 0) {
                    conditions.push('添加心动专业')
                  }
                  message += `请先${conditions.join('、')}`
                  
                  Taro.showModal({
                    title: '提示',
                    content: message,
                    showCancel: false,
                    confirmText: '我知道了'
                  })
                  return
                }
                Taro.navigateTo({
                  url: '/pages/majors/intended/index?tab=专业赛道'
                })
              }}
            >
              <View className="assessment-page__result-card-content">
                <View className="assessment-page__result-card-icon assessment-page__result-card-icon--orange">
                  <Text>🏛️</Text>
                </View>
                <View className="assessment-page__result-card-info">
                  <View className="assessment-page__result-card-header">
                    <Text className="assessment-page__result-card-title assessment-page__result-card-title--orange">
                      院校探索
                    </Text>
                    {!isSchoolExplorationUnlocked && (
                      <View className="assessment-page__result-card-lock">
                        <Text className="assessment-page__result-card-lock-icon">🔒</Text>
                      </View>
                    )}
                  </View>
                  <Text className="assessment-page__result-card-desc">
                    汇总特质与专业信息，生成专属高考志愿
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        </View>

        {/* 提示信息 */}
        <Card className="assessment-page__tip-card">
          <View className="assessment-page__tip-content">
            <Text className="assessment-page__tip-icon">💡</Text>
            <Text className="assessment-page__tip-text">
              建议按顺序完成所有评估，系统将为您生成更准确的专业和院校推荐。
            </Text>
          </View>
        </Card>
      </View>

      <BottomNav />
    </View>
  )
}

