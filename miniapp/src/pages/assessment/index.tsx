// 探索成果主页面
import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { BottomNav } from '@/components/BottomNav'
import { TopNav } from '@/components/TopNav'
import { getStorage } from '@/utils/storage'
import questionnaireData from '@/data/questionnaire.json'
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
  const [selectedProvincesCount, setSelectedProvincesCount] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      const storedAnswers = loadAnswersFromStorage()
      setAnswers(storedAnswers)

      // 读取心动专业数量
      try {
        const storedMajors = await getStorage<string[]>('intendedMajors')
        if (storedMajors) {
          setIntendedMajorsCount(Array.isArray(storedMajors) ? storedMajors.length : 0)
        }
      } catch (error) {
        setIntendedMajorsCount(0)
      }

      // 读取意向省份数量
      try {
        const storedProvinces = await getStorage<string[]>('selectedProvinces')
        if (storedProvinces) {
          setSelectedProvincesCount(Array.isArray(storedProvinces) ? storedProvinces.length : 0)
        }
      } catch (error) {
        setSelectedProvincesCount(0)
      }
    }
    loadData()
  }, [])

  // 使用 Taro 的页面生命周期钩子
  useEffect(() => {
    // 页面显示时更新数据
    const updateData = async () => {
      try {
        const storedMajors = await getStorage<string[]>('intendedMajors')
        if (storedMajors) {
          setIntendedMajorsCount(Array.isArray(storedMajors) ? storedMajors.length : 0)
        } else {
          setIntendedMajorsCount(0)
        }

        const storedProvinces = await getStorage<string[]>('selectedProvinces')
        if (storedProvinces) {
          setSelectedProvincesCount(Array.isArray(storedProvinces) ? storedProvinces.length : 0)
        } else {
          setSelectedProvincesCount(0)
        }
      } catch (error) {
        console.error('更新数据失败:', error)
      }
    }

    // 定期更新数据（用于监听其他页面的变化）
    const interval = setInterval(updateData, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  // 计算已解锁特质数（已完成的维度数）
  const completedDimensionsCount = DIMENSION_ORDER.filter((dim) => {
    const dimQuestions = (questionnaireData as any[]).filter(
      (q) => q.dimension === dim
    )
    const dimAnswered = dimQuestions.filter((q) => q.id in answers).length
    return dimAnswered === dimQuestions.length && dimQuestions.length > 0
  }).length

  // 计算已匹配专业数（每20题一个专业）
  const answeredCount = Object.keys(answers).length
  const matchedMajorsCount = Math.floor(answeredCount / 20)

  // 根据解锁维度计算进度
  const dimensionProgress = (completedDimensionsCount / DIMENSION_ORDER.length) * 100
  const assessmentProgress = dimensionProgress
  const completedCount = completedDimensionsCount
  const totalCount = DIMENSION_ORDER.length
  const isCompleted = assessmentProgress >= 100

  return (
    <View className="assessment-page">
      <TopNav />
      
      {/* 头部 */}
      <View className="assessment-page__header">
        <View className="assessment-page__header-content">
          <Text className="assessment-page__header-title">我的天赋逆袭中心</Text>
          <Text className="assessment-page__header-subtitle">
            {isCompleted ? '查看您的深度分析报告' : '了解自己，发现潜能，科学规划未来'}
          </Text>
        </View>
        <View className="assessment-page__header-wave" />
      </View>

      {/* 内容区域 */}
      <View className="assessment-page__content">
        {!isCompleted ? (
          <Card className="assessment-page__progress-card">
            <View className="assessment-page__progress-header">
              <Text className="assessment-page__progress-title">测评进度</Text>
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
                已解锁特质{completedDimensionsCount}项，已匹配专业{matchedMajorsCount}个
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
        ) : (
          <Card className="assessment-page__completed-card">
            <View className="assessment-page__completed-header">
              <View className="assessment-page__completed-icon">
                <Text>🏆</Text>
              </View>
              <View>
                <Text className="assessment-page__completed-title">测评已完成</Text>
                <Text className="assessment-page__completed-desc">您的特质报告已生成</Text>
              </View>
            </View>
            <Button
              onClick={() => {
                Taro.navigateTo({
                  url: '/pages/assessment/all-majors/index'
                })
              }}
              className="assessment-page__view-button"
              size="lg"
            >
              查看问卷 →
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
                        <Text>{intendedMajorsCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="assessment-page__result-card-desc">
                    深度探索喜欢的专业
                  </Text>
                </View>
              </View>
            </Card>

            {/* 意向省份 */}
            <Card 
              className="assessment-page__result-card"
              onClick={() => {
                Taro.navigateTo({
                  url: '/pages/assessment/provinces/index'
                })
              }}
            >
              <View className="assessment-page__result-card-content">
                <View className="assessment-page__result-card-icon assessment-page__result-card-icon--blue">
                  <Text>📍</Text>
                </View>
                <View className="assessment-page__result-card-info">
                  <View className="assessment-page__result-card-header">
                    <Text className="assessment-page__result-card-title assessment-page__result-card-title--blue">
                      意向省份
                    </Text>
                    {selectedProvincesCount > 0 && (
                      <View className="assessment-page__result-card-badge assessment-page__result-card-badge--blue">
                        <Text>{selectedProvincesCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="assessment-page__result-card-desc">
                    设置意向省份
                  </Text>
                </View>
              </View>
            </Card>

            {/* 院校探索 */}
            <Card 
              className="assessment-page__result-card"
              onClick={() => {
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
                  <Text className="assessment-page__result-card-title assessment-page__result-card-title--orange">
                    院校探索
                  </Text>
                  <Text className="assessment-page__result-card-desc">
                    探索各专业对应的院校
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
              建议按顺序完成所有测评，系统将为您生成更准确的专业和院校推荐。
            </Text>
          </View>
        </Card>
      </View>

      <BottomNav />
    </View>
  )
}

