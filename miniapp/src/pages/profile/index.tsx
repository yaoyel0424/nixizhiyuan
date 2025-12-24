// 个人中心页面
import React, { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { clearUserInfo } from '@/store/slices/userSlice'
import { logout } from '@/services/auth'
import { PageContainer } from '@/components/PageContainer'
import { Card } from '@/components/ui/Card'
import { BottomNav } from '@/components/BottomNav'
import { ShareModal } from '@/components/ShareModal'
import './index.less'

// 模拟用户状态类型
type AssessmentStatus = "not_started" | "in_progress" | "completed"

export default function ProfilePage() {
  const dispatch = useAppDispatch()
  // 从 Redux store 中获取用户信息
  const { userInfo, isLogin } = useAppSelector((state) => state.user)
  
  // 模拟数据 - 仅用于UI展示
  const [assessmentStatus] = useState<AssessmentStatus>("in_progress") // 测评状态
  const [progress] = useState(45) // 测评进度百分比
  const [currentQuestion] = useState(76) // 当前题目编号（如果有未完成测评）
  const [avatarError, setAvatarError] = useState(false) // 头像加载失败标志
  const [shareModalOpen, setShareModalOpen] = useState(false) // 分享弹窗显示状态
  
  // 从用户信息中获取昵称和头像
  const userName = userInfo?.nickname || userInfo?.username || '未来的同学'
  const userAvatar = userInfo?.avatar || ''
  const isLoggedIn = isLogin && !!userInfo
  const shouldShowAvatar = userAvatar && !avatarError // 是否显示头像
  
  // 当用户信息或头像变化时，重置头像错误状态
  useEffect(() => {
    setAvatarError(false)
  }, [userInfo?.avatar])

  // 根据状态获取头部副标题和图标
  const getStatusInfo = () => {
    switch (assessmentStatus) {
      case "not_started":
        return {
          text: "你的探索之旅尚未开始",
          icon: null,
        }
      case "in_progress":
        return {
          text: `探索完成度：${progress}%`,
          icon: null,
        }
      case "completed":
        return {
          text: "恭喜你！已完成自我探索",
          icon: "🎉",
        }
      default:
        return { text: "", icon: null }
    }
  }

  const statusInfo = getStatusInfo()

  const handleRestartAssessment = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要重新开始测评吗？',
      success: (res) => {
        if (res.confirm) {
          Taro.navigateTo({
            url: '/pages/assessment/questionnaire/index'
          })
        }
      }
    })
  }

  const handleViewReport = () => {
    if (assessmentStatus !== "completed") {
      Taro.showToast({
        title: '请先完成测评',
        icon: 'none'
      })
      return
    }
    Taro.navigateTo({
      url: '/pages/assessment/report/index'
    })
  }

  const handleContinueAssessment = () => {
    Taro.navigateTo({
      url: '/pages/assessment/questionnaire/index'
    })
  }

  const handleFeedback = () => {
    Taro.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  }

  const handleAbout = () => {
    Taro.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  }

  /**
   * 处理分享功能
   */
  const handleShare = () => {
    setShareModalOpen(true)
  }

  /**
   * 小程序分享配置
   * 当用户点击右上角分享或使用 Button 的 openType="share" 时会触发
   */
  useShareAppMessage(() => {
    return {
      title: '逆袭智愿 - 让「喜欢」和「天赋」，带你找到答案',
      path: '/pages/index/index',
      imageUrl: '', // 可选：分享图片 URL
    }
  })

  /**
   * 处理退出登录
   */
  const handleLogout = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 调用退出登录接口
            await logout()
            
            // 清除本地存储的 token 和 refreshToken
            Taro.removeStorageSync('token')
            Taro.removeStorageSync('refreshToken')
            
            // 清除 Redux 中的用户信息
            dispatch(clearUserInfo())
            
            // 显示退出成功提示
            Taro.showToast({
              title: '已退出登录',
              icon: 'success',
              duration: 1500
            })
            
            // 跳转到登录页（清除页面栈）
            setTimeout(() => {
              Taro.reLaunch({
                url: '/pages/login/index'
              })
            }, 1500)
          } catch (error: any) {
            // 即使接口调用失败，也清除本地状态并跳转
            console.error('退出登录失败:', error)
            Taro.removeStorageSync('token')
            Taro.removeStorageSync('refreshToken')
            dispatch(clearUserInfo())
            
            Taro.showToast({
              title: error?.message || '退出登录失败',
              icon: 'none',
              duration: 1500
            })
            
            setTimeout(() => {
              Taro.reLaunch({
                url: '/pages/login/index'
              })
            }, 1500)
          }
        }
      }
    })
  }

  return (
    <PageContainer>
      <View className="profile-page">
        {/* 头部：个人身份与进度总览 */}
        <View className="profile-page__header">
          <View className="profile-page__header-content">
            {/* 头像 */}
            <View className="profile-page__avatar">
              {shouldShowAvatar ? (
                <Image
                  src={userAvatar}
                  className="profile-page__avatar-img"
                  mode="aspectFill"
                  onError={() => {
                    // 头像加载失败时显示占位符
                    setAvatarError(true)
                  }}
                />
              ) : null}
              <View className="profile-page__avatar-fallback">
                <Text className="profile-page__avatar-text">
                  {isLoggedIn && userName ? userName.charAt(0) : "未"}
                </Text>
              </View>
            </View>

            {/* 昵称 */}
            <View className="profile-page__info">
              <Text className="profile-page__name">
                你好，{isLoggedIn ? userName : "未来的同学"}
              </Text>
              {/* 副标题/状态 */}
              <View className="profile-page__status">
                {statusInfo.icon && (
                  <Text className="profile-page__status-icon">{statusInfo.icon}</Text>
                )}
                <Text className="profile-page__status-text">{statusInfo.text}</Text>
              </View>
            </View>

            {/* 环形进度条（仅测评中时显示） */}
            {assessmentStatus === "in_progress" && (
              <View className="profile-page__progress-ring">
                <View className="profile-page__progress-svg">
                  {/* 使用 View 模拟 SVG 圆环 */}
                  <View className="profile-page__progress-bg" />
                  <View 
                    className="profile-page__progress-fill"
                    style={{ 
                      transform: `rotate(${(progress / 100) * 360 - 90}deg)`,
                      opacity: progress > 0 ? 1 : 0
                    }}
                  />
                </View>
                <View className="profile-page__progress-text">
                  <Text className="profile-page__progress-value">{progress}%</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View className="profile-page__content">
          {/* 核心功能卡片：我的探索之旅 */}
          <Card className="profile-page__card">
            <View className="profile-page__card-header">
              <Text className="profile-page__card-title">我的探索之旅</Text>
            </View>
            <View className="profile-page__card-body">
              {/* 重启自我测评 */}
              <View className="profile-page__card-item" onClick={handleRestartAssessment}>
                <View className="profile-page__card-icon profile-page__card-icon--restart">
                  <Text className="profile-page__card-icon-text">🔄</Text>
                </View>
                <View className="profile-page__card-item-content">
                  <Text className="profile-page__card-item-title">重新开始自我测评</Text>
                  <Text className="profile-page__card-item-desc">重新答题，刷新你的专属地图</Text>
                </View>
                <Text className="profile-page__card-arrow">›</Text>
              </View>

              {/* 查看我的报告 */}
              <View 
                className={`profile-page__card-item ${assessmentStatus !== "completed" ? 'profile-page__card-item--disabled' : ''}`}
                onClick={handleViewReport}
              >
                <View className={`profile-page__card-icon ${assessmentStatus === "completed" ? 'profile-page__card-icon--report' : 'profile-page__card-icon--disabled'}`}>
                  <Text className="profile-page__card-icon-text">📊</Text>
                </View>
                <View className="profile-page__card-item-content">
                  <Text className={`profile-page__card-item-title ${assessmentStatus !== "completed" ? 'profile-page__card-item-title--disabled' : ''}`}>
                    查看我的天赋洞察报告
                  </Text>
                  <Text className={`profile-page__card-item-desc ${assessmentStatus !== "completed" ? 'profile-page__card-item-desc--disabled' : ''}`}>
                    {assessmentStatus === "completed" ? "回顾你的核心特质、专业与院校地图" : "待生成"}
                  </Text>
                </View>
                <Text className={`profile-page__card-arrow ${assessmentStatus !== "completed" ? 'profile-page__card-arrow--disabled' : ''}`}>›</Text>
              </View>

              {/* 继续未完成测评（仅当有未完成测评时显示） */}
              {assessmentStatus === "in_progress" && (
                <View className="profile-page__card-item" onClick={handleContinueAssessment}>
                  <View className="profile-page__card-icon profile-page__card-icon--continue">
                    <Text className="profile-page__card-icon-text">🚀</Text>
                  </View>
                  <View className="profile-page__card-item-content">
                    <Text className="profile-page__card-item-title">继续未完成的探索</Text>
                    <Text className="profile-page__card-item-desc">从中断的第{currentQuestion}题继续</Text>
                  </View>
                  <Text className="profile-page__card-arrow">›</Text>
                </View>
              )}
            </View>
          </Card>

          {/* 通用设置卡片：更多 */}
          <Card className="profile-page__card">
            <View className="profile-page__card-header">
              <Text className="profile-page__card-title">更多</Text>
            </View>
            <View className="profile-page__card-body">
              {/* 用户反馈 */}
              <View className="profile-page__card-item" onClick={handleFeedback}>
                <View className="profile-page__card-icon profile-page__card-icon--feedback">
                  <Text className="profile-page__card-icon-text">💬</Text>
                </View>
                <View className="profile-page__card-item-content">
                  <Text className="profile-page__card-item-title">意见反馈</Text>
                  <Text className="profile-page__card-item-desc">帮助我们做得更好</Text>
                </View>
                <Text className="profile-page__card-arrow">›</Text>
              </View>

              {/* 关于我们 */}
              <View className="profile-page__card-item" onClick={handleAbout}>
                <View className="profile-page__card-icon profile-page__card-icon--about">
                  <Text className="profile-page__card-icon-text">ℹ️</Text>
                </View>
                <View className="profile-page__card-item-content">
                  <Text className="profile-page__card-item-title">关于我们</Text>
                  <Text className="profile-page__card-item-desc">了解我们的理念与使命</Text>
                </View>
                <Text className="profile-page__card-arrow">›</Text>
              </View>

              {/* 分享给朋友 */}
              <View className="profile-page__card-item" onClick={handleShare}>
                <View className="profile-page__card-icon profile-page__card-icon--share">
                  <Text className="profile-page__card-icon-text">📤</Text>
                </View>
                <View className="profile-page__card-item-content">
                  <Text className="profile-page__card-item-title">分享给朋友</Text>
                  <Text className="profile-page__card-item-desc">帮更多同学找到方向</Text>
                </View>
                <Text className="profile-page__card-arrow">›</Text>
              </View>
            </View>
          </Card>

          {/* 退出登录/账号管理 */}
          <Card className="profile-page__card">
            {isLoggedIn ? (
              <View className="profile-page__logout" onClick={handleLogout}>
                <Text className="profile-page__logout-icon">🚪</Text>
                <Text className="profile-page__logout-text">退出登录</Text>
              </View>
            ) : (
              <View className="profile-page__login" onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}>
                <Text className="profile-page__login-icon">🔑</Text>
                <Text className="profile-page__login-text">登录/注册</Text>
              </View>
            )}
          </Card>
        </View>
      </View>
      <BottomNav />
      
      {/* 分享弹窗 */}
      <ShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </PageContainer>
  )
}

