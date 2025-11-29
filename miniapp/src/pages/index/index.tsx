// 首页
import React, { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { BottomNav } from '@/components/BottomNav'
import { TopNav } from '@/components/TopNav'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { getStorage } from '@/utils/storage'
import questionnaireData from '@/data/questionnaire.json'
import './index.less'

const STORAGE_KEY = "questionnaire_answers"

function loadAnswersFromStorage(): Record<number, number> {
  // Taro 小程序环境，使用同步方式
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    return {}
  }
}

export default function IndexPage() {
  const [isGuideDialogOpen, setIsGuideDialogOpen] = useState(false)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const storedAnswers = loadAnswersFromStorage()
    setAnswers(storedAnswers)
  }, [])

  // 当对话框打开时，重新读取本地数据
  useEffect(() => {
    if (isGuideDialogOpen && isClient) {
      const storedAnswers = loadAnswersFromStorage()
      setAnswers(storedAnswers)
    }
  }, [isGuideDialogOpen, isClient])

  const totalQuestions = (questionnaireData as any[]).length
  const answeredCount = Object.keys(answers).length
  const isCompleted = answeredCount === totalQuestions && totalQuestions > 0
  
  // 完成168个题目后解锁三个功能
  const UNLOCK_THRESHOLD = 168
  const isUnlocked = isClient && answeredCount >= UNLOCK_THRESHOLD

  const handleConfirmStart = () => {
    setIsGuideDialogOpen(false)
    // 使用 reLaunch 跳转到探索成果页面
    Taro.reLaunch({
      url: '/pages/assessment/all-majors/index'
    })
  }

  // 处理三个功能的点击事件
  const handleMajorExploration = () => {
    if (!isUnlocked) {
      Taro.showToast({
        title: `完成${UNLOCK_THRESHOLD}个题目后即可解锁此功能`,
        icon: 'none'
      })
      return
    }
    setIsGuideDialogOpen(false)
    // 使用 reLaunch 跳转到志愿方案页面
    Taro.reLaunch({
      url: '/pages/majors/index'
    })
  }

  const handleCityExploration = () => {
    if (!isUnlocked) {
      Taro.showToast({
        title: `完成${UNLOCK_THRESHOLD}个题目后即可解锁此功能`,
        icon: 'none'
      })
      return
    }
    setIsGuideDialogOpen(false)
    Taro.navigateTo({
      url: '/pages/assessment/provinces/index'
    })
  }

  const handleSchoolExploration = () => {
    if (!isUnlocked) {
      Taro.showToast({
        title: `完成${UNLOCK_THRESHOLD}个题目后即可解锁此功能`,
        icon: 'none'
      })
      return
    }
    setIsGuideDialogOpen(false)
    Taro.navigateTo({
      url: '/pages/majors/intended/index?tab=专业赛道'
    })
  }

  // 处理深度自我洞察点击事件
  const handleSelfInsight = () => {
    setIsGuideDialogOpen(false)
    // 使用 reLaunch 跳转到探索成果页面
    Taro.reLaunch({
      url: '/pages/assessment/all-majors/index'
    })
  }

  const handleQuickAssessment = () => {
    Taro.navigateTo({
      url: '/pages/assessment/popular-majors/index'
    })
  }

  return (
    <View className="index-page">
      <TopNav />
      
      {/* 头部横幅 */}
      <View className="index-page__banner">
        <View className="index-page__banner-content">
          <Text className="index-page__banner-title">找到你的喜欢与天赋</Text>
          <Text className="index-page__banner-subtitle">不被分数定义，用选择创造未来！</Text>
        </View>
      </View>

      {/* 主要内容 */}
      <View className="index-page__content">
        {/* 快速测评卡片 */}
        <View className="index-page__card" onClick={handleQuickAssessment}>
          <Card className="index-page__card-inner">
            <View className="index-page__card-header">
              <View className="index-page__card-icon index-page__card-icon--quick">
                <Text className="index-page__card-icon-text">⚡</Text>
              </View>
              <View className="index-page__card-title-section">
                <Text className="index-page__card-title">快速测评</Text>
                <Text className="index-page__card-time">约3分钟</Text>
              </View>
            </View>
            <Text className="index-page__card-desc">
              发现与你特质契合的<Text className="index-page__card-desc-highlight">热门专业</Text>方向
            </Text>
            <Button className="index-page__card-button" size="lg">
              ⚡ 立即开始
            </Button>
          </Card>
        </View>

        {/* 全面评估卡片 */}
        <View className="index-page__card" onClick={() => setIsGuideDialogOpen(true)}>
          <Card className="index-page__card-inner">
            <View className="index-page__card-header">
              <View className="index-page__card-icon index-page__card-icon--full">
                <Text className="index-page__card-icon-text">📊</Text>
              </View>
              <View className="index-page__card-title-section">
                <Text className="index-page__card-title">全面评估</Text>
                <View className="index-page__card-tags">
                  <Text className="index-page__card-tag">📊 168题</Text>
                  <Text className="index-page__card-tag">📈 全面数据</Text>
                </View>
                <Text className="index-page__card-time">约40分钟</Text>
              </View>
            </View>
            <Text className="index-page__card-desc">
              全面解锁你的喜欢与天赋，定制<Text className="index-page__card-desc-highlight">专属志愿规划</Text>
            </Text>
            <Button className="index-page__card-button index-page__card-button--orange" size="lg">
              🎯 开启探索
            </Button>
          </Card>
        </View>
      </View>

      {/* 探索之旅说明模态框 */}
      <Dialog open={isGuideDialogOpen} onOpenChange={setIsGuideDialogOpen}>
        <DialogContent className="index-page__dialog">
          <DialogHeader>
            <DialogTitle className="index-page__dialog-title">
              【探索之旅说明】
            </DialogTitle>
            <DialogDescription>
              <Text className="index-page__dialog-desc">
                欢迎开启你的深度探索！为了给你最精准的规划，请按顺序完成以下步骤：
              </Text>
            </DialogDescription>
          </DialogHeader>

          <View className="index-page__dialog-steps">
            {/* 第一步 */}
            <View className="index-page__dialog-step" onClick={handleSelfInsight}>
              <Text className="index-page__dialog-step-icon">🔓</Text>
              <View className="index-page__dialog-step-content">
                <View className="index-page__dialog-step-header">
                  <Text className="index-page__dialog-step-title">深度自我洞察</Text>
                  {isClient && (
                    <Text className="index-page__dialog-step-progress">
                      ({answeredCount}/{totalQuestions})
                    </Text>
                  )}
                  <Text className="index-page__dialog-step-badge">您在此处</Text>
                </View>
                <Text className="index-page__dialog-step-desc">
                  完成168题科学测评，解锁你的核心特质报告。
                </Text>
              </View>
            </View>

            {/* 第二步 */}
            <View 
              className={`index-page__dialog-step ${isUnlocked ? 'index-page__dialog-step--unlocked' : ''}`}
              onClick={handleMajorExploration}
            >
              <Text className="index-page__dialog-step-icon">{isUnlocked ? '🔓' : '🔒'}</Text>
              <View className="index-page__dialog-step-content">
                <View className="index-page__dialog-step-header">
                  <Text className={`index-page__dialog-step-title ${!isUnlocked ? 'index-page__dialog-step-title--locked' : ''}`}>
                    发现契合专业
                  </Text>
                  <Text className={`index-page__dialog-step-badge ${isUnlocked ? 'index-page__dialog-step-badge--unlocked' : 'index-page__dialog-step-badge--locked'}`}>
                    {isUnlocked ? '已解锁' : '完成后解锁'}
                  </Text>
                </View>
                <Text className={`index-page__dialog-step-desc ${!isUnlocked ? 'index-page__dialog-step-desc--locked' : ''}`}>
                  基于你的特质报告，匹配最适合的专业方向。
                </Text>
              </View>
            </View>

            {/* 第三步 */}
            <View 
              className={`index-page__dialog-step ${isUnlocked ? 'index-page__dialog-step--unlocked' : ''}`}
              onClick={handleCityExploration}
            >
              <Text className="index-page__dialog-step-icon">{isUnlocked ? '🔓' : '🔒'}</Text>
              <View className="index-page__dialog-step-content">
                <View className="index-page__dialog-step-header">
                  <Text className={`index-page__dialog-step-title ${!isUnlocked ? 'index-page__dialog-step-title--locked' : ''}`}>
                    圈定理想城市
                  </Text>
                  <Text className={`index-page__dialog-step-badge ${isUnlocked ? 'index-page__dialog-step-badge--unlocked' : 'index-page__dialog-step-badge--locked'}`}>
                    {isUnlocked ? '已解锁' : '完成后解锁'}
                  </Text>
                </View>
                <Text className={`index-page__dialog-step-desc ${!isUnlocked ? 'index-page__dialog-step-desc--locked' : ''}`}>
                  结合你的偏好，找到理想的城市圈。
                </Text>
              </View>
            </View>

            {/* 第四步 */}
            <View 
              className={`index-page__dialog-step ${isUnlocked ? 'index-page__dialog-step--unlocked' : ''}`}
              onClick={handleSchoolExploration}
            >
              <Text className="index-page__dialog-step-icon">{isUnlocked ? '🔓' : '🔒'}</Text>
              <View className="index-page__dialog-step-content">
                <View className="index-page__dialog-step-header">
                  <Text className={`index-page__dialog-step-title ${!isUnlocked ? 'index-page__dialog-step-title--locked' : ''}`}>
                    锁定目标院校
                  </Text>
                  <Text className={`index-page__dialog-step-badge ${isUnlocked ? 'index-page__dialog-step-badge--unlocked' : 'index-page__dialog-step-badge--locked'}`}>
                    {isUnlocked ? '已解锁' : '完成后解锁'}
                  </Text>
                </View>
                <Text className={`index-page__dialog-step-desc ${!isUnlocked ? 'index-page__dialog-step-desc--locked' : ''}`}>
                  综合所有信息，生成你的个性化院校清单。
                </Text>
              </View>
            </View>

            {/* 行动按钮 */}
            {!isUnlocked && (
              <View className="index-page__dialog-footer">
                <Button onClick={handleConfirmStart} size="lg" className="index-page__dialog-button">
                  我明白了，立即开始答题 →
                </Button>
              </View>
            )}
          </View>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </View>
  )
}
