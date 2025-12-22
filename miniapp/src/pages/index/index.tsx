// 首页
import React, { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { BottomNav } from '@/components/BottomNav'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { getStorage } from '@/utils/storage'
import questionnaireData from '@/data/questionnaire.json'
import './index.less'

// 步骤完成状态类型
type StepStatus = 'completed' | 'current' | 'locked'

// 自定义系统导航栏组件（用于首页）
function SystemNavBar() {
  const [systemInfo, setSystemInfo] = useState<any>(null)

  useEffect(() => {
    const info = Taro.getSystemInfoSync()
    setSystemInfo(info)
  }, [])

  if (!systemInfo) return null

  const statusBarHeight = systemInfo.statusBarHeight || 0
  const navigationBarHeight = 44 // 微信导航栏标准高度（px）

  return (
    <View 
      className="system-nav-bar"
      style={{ 
        height: `${statusBarHeight + navigationBarHeight}px`,
        paddingTop: `${statusBarHeight}px`,
        backgroundColor: '#f0f7ff'
      }}
    >
      <View className="system-nav-bar__content">
        <View className="system-nav-bar__title">首页</View>
      </View>
    </View>
  )
}

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
  const [systemInfo, setSystemInfo] = useState<any>(null)
  const [intendedMajorsCount, setIntendedMajorsCount] = useState(0)
  const [selectedProvincesCount, setSelectedProvincesCount] = useState(0)
  const [hasVisitedMajors, setHasVisitedMajors] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const storedAnswers = loadAnswersFromStorage()
    setAnswers(storedAnswers)
    
    // 获取系统信息，用于计算导航栏高度
    const info = Taro.getSystemInfoSync()
    setSystemInfo(info)
  }, [])

  // 当对话框打开时，重新读取本地数据
  useEffect(() => {
    if (isGuideDialogOpen && isClient) {
      const storedAnswers = loadAnswersFromStorage()
      setAnswers(storedAnswers)
      
      // 读取心动专业数量
      getStorage<string[]>('intendedMajors').then((storedMajors) => {
        if (storedMajors) {
          setIntendedMajorsCount(Array.isArray(storedMajors) ? storedMajors.length : 0)
        } else {
          setIntendedMajorsCount(0)
        }
      }).catch(() => {
        setIntendedMajorsCount(0)
      })

      // 读取意向省份数量
      getStorage<string[]>('selectedProvinces').then((storedProvinces) => {
        if (storedProvinces) {
          setSelectedProvincesCount(Array.isArray(storedProvinces) ? storedProvinces.length : 0)
        } else {
          setSelectedProvincesCount(0)
        }
      }).catch(() => {
        setSelectedProvincesCount(0)
      })

      // 检查是否访问过专业页面（通过检查是否有专业相关数据）
      getStorage<any[]>('wishlist-items').then((wishlistItems) => {
        setHasVisitedMajors(Array.isArray(wishlistItems) && wishlistItems.length > 0)
      }).catch(() => {
        // 如果 wishlist-items 不存在，检查是否有其他专业相关数据
        getStorage<string[]>('intendedMajors').then((intendedMajors) => {
          setHasVisitedMajors(Array.isArray(intendedMajors) && intendedMajors.length > 0)
        }).catch(() => {
          setHasVisitedMajors(false)
        })
      })
    }
  }, [isGuideDialogOpen, isClient])

  const totalQuestions = (questionnaireData as any[]).length
  const answeredCount = Object.keys(answers).length
  const isCompleted = answeredCount === totalQuestions && totalQuestions > 0
  
  // 完成168个题目后解锁三个功能
  const UNLOCK_THRESHOLD = 168
  const isUnlocked = isClient && answeredCount >= UNLOCK_THRESHOLD

  // 计算每个步骤的完成状态
  // 步骤1：深度自我洞察 - 完成168题
  const step1Completed = isCompleted
  // 步骤2：发现契合专业 - 已解锁且访问过专业页面
  const step2Completed = isUnlocked && hasVisitedMajors
  // 步骤3：圈定理想城市 - 有选择的省份
  const step3Completed = selectedProvincesCount > 0
  // 步骤4：锁定目标院校 - 有选择的专业
  const step4Completed = intendedMajorsCount > 0

  // 确定当前步骤（显示"您探索到此处"的步骤）
  const getCurrentStep = (): number => {
    if (!step1Completed) return 1
    if (!step2Completed) return 2
    if (!step3Completed) return 3
    if (!step4Completed) return 4
    return 4 // 所有步骤都完成时，显示在最后一步
  }

  const currentStep = getCurrentStep()

  // 获取步骤状态
  const getStepStatus = (stepNumber: number): StepStatus => {
    if (stepNumber < currentStep) return 'completed'
    if (stepNumber === currentStep) return 'current'
    return 'locked'
  }

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

  // 处理步骤点击（带锁定检查）
  const handleStepClick = (stepNumber: number, handler: () => void) => {
    const status = getStepStatus(stepNumber)
    if (status === 'locked') {
      Taro.showToast({
        title: '请先完成上面的操作解锁',
        icon: 'none',
        duration: 2000
      })
      return
    }
    handler()
  }

  const handleQuickAssessment = () => {
    Taro.navigateTo({
      url: '/pages/assessment/popular-majors/index'
    })
  }

  // 计算顶部间距（系统导航栏高度）
  const statusBarHeight = systemInfo?.statusBarHeight || 0
  const navigationBarHeight = 44
  const topPadding = statusBarHeight + navigationBarHeight

  return (
    <View className="index-page" style={{ paddingTop: `${topPadding}px` }}>
      <SystemNavBar />
      
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
                <Text className="index-page__card-time">🕒 需时约40分钟</Text>
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
        
        {/* 信任背书 */}
        <View className="index-page__trust-badge">
          <Text className="index-page__trust-text">基于 教育部 官方数据</Text>
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
            {(() => {
              const status = getStepStatus(1)
              const isStepCompleted = status === 'completed'
              const isStepCurrent = status === 'current'
              const isStepLocked = status === 'locked'
              return (
                <View 
                  className={`index-page__dialog-step ${!isStepLocked ? 'index-page__dialog-step--unlocked' : 'index-page__dialog-step--locked'}`}
                  onClick={() => handleStepClick(1, handleSelfInsight)}
                >
                  <Text className="index-page__dialog-step-icon">
                    {isStepCompleted ? '✅' : isStepCurrent ? '📍' : '🔒'}
                  </Text>
                  <Text className={`index-page__dialog-step-badge ${
                    isStepCompleted 
                      ? 'index-page__dialog-step-badge--completed' 
                      : isStepCurrent 
                        ? 'index-page__dialog-step-badge--current'
                        : 'index-page__dialog-step-badge--locked'
                  }`}>
                    {isStepCompleted ? '已完成' : isStepCurrent ? '您探索到此处' : '完成后解锁'}
                  </Text>
                  <View className="index-page__dialog-step-content">
                    <View className="index-page__dialog-step-header">
                      <Text className={`index-page__dialog-step-title ${isStepLocked ? 'index-page__dialog-step-title--locked' : ''}`}>
                        深度自我洞察
                      </Text>
                      {isClient && (
                        <Text className="index-page__dialog-step-progress">
                          ({answeredCount}/{totalQuestions})
                        </Text>
                      )}
                    </View>
                    <Text className={`index-page__dialog-step-desc ${isStepLocked ? 'index-page__dialog-step-desc--locked' : ''}`}>
                      完成168题科学测评，解锁你的核心特质报告。
                    </Text>
                  </View>
                </View>
              )
            })()}

            {/* 第二步 */}
            {(() => {
              const status = getStepStatus(2)
              const isStepCompleted = status === 'completed'
              const isStepCurrent = status === 'current'
              const isStepLocked = status === 'locked'
              return (
                <View 
                  className={`index-page__dialog-step ${!isStepLocked ? 'index-page__dialog-step--unlocked' : 'index-page__dialog-step--locked'}`}
                  onClick={() => handleStepClick(2, handleMajorExploration)}
                >
                  <Text className="index-page__dialog-step-icon">
                    {isStepCompleted ? '✅' : isStepCurrent ? '📍' : '🔒'}
                  </Text>
                  <Text className={`index-page__dialog-step-badge ${
                    isStepCompleted 
                      ? 'index-page__dialog-step-badge--completed' 
                      : isStepCurrent 
                        ? 'index-page__dialog-step-badge--current'
                        : 'index-page__dialog-step-badge--locked'
                  }`}>
                    {isStepCompleted ? '已完成' : isStepCurrent ? '您探索到此处' : '完成后解锁'}
                  </Text>
                  <View className="index-page__dialog-step-content">
                    <View className="index-page__dialog-step-header">
                      <Text className={`index-page__dialog-step-title ${isStepLocked ? 'index-page__dialog-step-title--locked' : ''}`}>
                        发现契合专业
                      </Text>
                    </View>
                    <Text className={`index-page__dialog-step-desc ${isStepLocked ? 'index-page__dialog-step-desc--locked' : ''}`}>
                      基于你的特质报告，匹配最适合的专业方向。
                    </Text>
                  </View>
                </View>
              )
            })()}

            {/* 第三步 */}
            {(() => {
              const status = getStepStatus(3)
              const isStepCompleted = status === 'completed'
              const isStepCurrent = status === 'current'
              const isStepLocked = status === 'locked'
              return (
                <View 
                  className={`index-page__dialog-step ${!isStepLocked ? 'index-page__dialog-step--unlocked' : 'index-page__dialog-step--locked'}`}
                  onClick={() => handleStepClick(3, handleCityExploration)}
                >
                  <Text className="index-page__dialog-step-icon">
                    {isStepCompleted ? '✅' : isStepCurrent ? '📍' : '🔒'}
                  </Text>
                  <Text className={`index-page__dialog-step-badge ${
                    isStepCompleted 
                      ? 'index-page__dialog-step-badge--completed' 
                      : isStepCurrent 
                        ? 'index-page__dialog-step-badge--current'
                        : 'index-page__dialog-step-badge--locked'
                  }`}>
                    {isStepCompleted ? '已完成' : isStepCurrent ? '您探索到此处' : '完成后解锁'}
                  </Text>
                  <View className="index-page__dialog-step-content">
                    <View className="index-page__dialog-step-header">
                      <Text className={`index-page__dialog-step-title ${isStepLocked ? 'index-page__dialog-step-title--locked' : ''}`}>
                        圈定理想城市
                      </Text>
                    </View>
                    <Text className={`index-page__dialog-step-desc ${isStepLocked ? 'index-page__dialog-step-desc--locked' : ''}`}>
                      结合你的偏好，找到理想的城市圈。
                    </Text>
                  </View>
                </View>
              )
            })()}

            {/* 第四步 */}
            {(() => {
              const status = getStepStatus(4)
              const isStepCompleted = status === 'completed'
              const isStepCurrent = status === 'current'
              const isStepLocked = status === 'locked'
              return (
                <View 
                  className={`index-page__dialog-step ${!isStepLocked ? 'index-page__dialog-step--unlocked' : 'index-page__dialog-step--locked'}`}
                  onClick={() => handleStepClick(4, handleSchoolExploration)}
                >
                  <Text className="index-page__dialog-step-icon">
                    {isStepCompleted ? '✅' : isStepCurrent ? '📍' : '🔒'}
                  </Text>
                  <Text className={`index-page__dialog-step-badge ${
                    isStepCompleted 
                      ? 'index-page__dialog-step-badge--completed' 
                      : isStepCurrent 
                        ? 'index-page__dialog-step-badge--current'
                        : 'index-page__dialog-step-badge--locked'
                  }`}>
                    {isStepCompleted ? '已完成' : isStepCurrent ? '您探索到此处' : '完成后解锁'}
                  </Text>
                  <View className="index-page__dialog-step-content">
                    <View className="index-page__dialog-step-header">
                      <Text className={`index-page__dialog-step-title ${isStepLocked ? 'index-page__dialog-step-title--locked' : ''}`}>
                        锁定目标院校
                      </Text>
                    </View>
                    <Text className={`index-page__dialog-step-desc ${isStepLocked ? 'index-page__dialog-step-desc--locked' : ''}`}>
                      综合所有信息，生成你的个性化院校清单。
                    </Text>
                  </View>
                </View>
              )
            })()}

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
