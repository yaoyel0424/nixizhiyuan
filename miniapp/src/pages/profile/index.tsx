// 个人中心页面
import React, { useState, useEffect } from 'react'
import { View, Text, Image, Button as TaroButton } from '@tarojs/components'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { store } from '@/store'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { clearUserInfo, updateUserInfo, setUserInfo } from '@/store/slices/userSlice'
import { logout, checkToken } from '@/services/auth'
import { silentLogin, getUserInfoFromStorage } from '@/utils/auth'
import { getUserRelatedDataCount, updateCurrentUserNickname } from '@/services/user'
import { deleteScaleAnswers } from '@/services/scales'
import { PageContainer } from '@/components/PageContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { BottomNav } from '@/components/BottomNav'
import { ShareModal } from '@/components/ShareModal'
import './index.less'

// 用户状态类型
type AssessmentStatus = "not_started" | "in_progress" | "completed"

// 量表总题数
const TOTAL_QUESTIONS = 168

export default function ProfilePage() {
  const dispatch = useAppDispatch()
  // 从 Redux store 中获取用户信息
  const { userInfo, isLogin } = useAppSelector((state) => state.user)
  
  // 用户数据统计
  const [scaleAnswersCount, setScaleAnswersCount] = useState(0) // 量表答案数量
  const [majorFavoritesCount, setMajorFavoritesCount] = useState(0) // 专业收藏数量
  const [provinceFavoritesCount, setProvinceFavoritesCount] = useState(0) // 省份收藏数量
  const [choicesCount, setChoicesCount] = useState(0) // 备选方案数量
  const [repeatCount, setRepeatCount] = useState(0) // 二次答题标识，>0 表示已完成过一轮
  const [dataLoaded, setDataLoaded] = useState(false) // 数据是否已加载
  
  // 判断各个维度是否完成（大于0）
  const hasScaleAnswers = scaleAnswersCount > 0
  const hasMajorFavorites = majorFavoritesCount > 0
  const hasProvinceFavorites = provinceFavoritesCount > 0
  const hasChoices = choicesCount > 0
  
  // 判断是否所有维度都完成（所有字段都大于0）
  const allDimensionsCompleted = 
    hasScaleAnswers && 
    hasMajorFavorites && 
    hasProvinceFavorites && 
    hasChoices
  
  // 判断是否未开始（所有字段都为0）
  const allDimensionsEmpty = 
    scaleAnswersCount === 0 && 
    majorFavoritesCount === 0 && 
    provinceFavoritesCount === 0 && 
    choicesCount === 0
  
  // 计算测评状态
  const assessmentStatus: AssessmentStatus = 
    allDimensionsEmpty 
      ? "not_started" 
      : allDimensionsCompleted 
      ? "completed" 
      : "in_progress"
  
  // 计算当前题目编号（如果有未完成测评）
  const currentQuestion = scaleAnswersCount > 0 ? scaleAnswersCount + 1 : 1
  
  const [avatarError, setAvatarError] = useState(false) // 头像加载失败标志
  const [shareModalOpen, setShareModalOpen] = useState(false) // 分享弹窗显示状态

  // 昵称编辑弹窗
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false)
  const [nicknameDraft, setNicknameDraft] = useState('')
  const [nicknameSaving, setNicknameSaving] = useState(false)
  
  // 从用户信息中获取昵称和头像
  const userName = userInfo?.nickname || userInfo?.username || '未来的同学'
  const userAvatar = userInfo?.avatar || ''
  const isLoggedIn = isLogin && !!userInfo
  const shouldShowAvatar = userAvatar && !avatarError // 是否显示头像
  
  // 当用户信息或头像变化时，重置头像错误状态
  useEffect(() => {
    setAvatarError(false)
  }, [userInfo?.avatar])

  // iOS 等真机兜底：Redux 未登录但本地有 token 时，从 storage 恢复；若 storage 无则用 check-token 拉取
  useEffect(() => {
    const tryRestore = () => {
      const hasUser = !!store.getState().user?.userInfo
      const token = Taro.getStorageSync('token')
      if (hasUser) return
      if (!token) return
      let formatted = getUserInfoFromStorage(token)
      if (formatted) {
        dispatch(setUserInfo(formatted))
        return
      }
      checkToken()
        .then((data: any) => {
          const user = data?.user ?? data?.userInfo ?? data
          const nickname = (user?.nickname ?? user?.nickName ?? user?.username ?? '').toString().trim()
          const id = user?.id ?? user?.userId ?? ''
          if (!id && !nickname) return
          const next = {
            id: String(id || ''),
            username: nickname || '微信用户',
            nickname: nickname || '微信用户',
            avatar: (user?.avatar ?? user?.avatarUrl ?? '').toString(),
            phone: (user?.phone ?? '').toString(),
            email: (user?.email ?? '').toString(),
            token,
          }
          dispatch(setUserInfo(next))
          Taro.setStorageSync('userInfo', next)
        })
        .catch(() => {})
    }
    tryRestore()
    const t = setTimeout(tryRestore, 300)
    return () => clearTimeout(t)
  }, [dispatch])

  // 个人中心页：调用 /auth/check-token 获取最新 nickname 并同步到 Redux
  useEffect(() => {
    if (!isLoggedIn) return
    checkToken()
      .then((data: any) => {
        const nextNickname =
          (data?.nickname ?? data?.user?.nickname ?? data?.userInfo?.nickname ?? '').toString().trim()
        const nextAvatar =
          (data?.avatar ?? data?.avatarUrl ?? data?.user?.avatar ?? data?.user?.avatarUrl ?? '')
            .toString()
            .trim()

        // 只在有值且确实变化时才更新，避免重复刷新
        if (nextNickname && nextNickname !== (userInfo?.nickname || '')) {
          dispatch(updateUserInfo({ nickname: nextNickname }))
        }
        if (nextAvatar && nextAvatar !== (userInfo?.avatar || '')) {
          dispatch(updateUserInfo({ avatar: nextAvatar }))
        }
      })
      .catch((error) => {
        // token 失效或网络失败时不打扰用户（登录态由其他流程处理）
        console.error('检查登录态失败:', error)
      })
  }, [isLoggedIn, userInfo?.nickname, userInfo?.avatar, dispatch])

  // 获取用户相关数据统计
  useEffect(() => {
    if (isLogin && userInfo) {
      getUserRelatedDataCount()
        .then((data) => {
          setScaleAnswersCount(data.scaleAnswersCount || 0)
          setMajorFavoritesCount(data.majorFavoritesCount || 0)
          setProvinceFavoritesCount(data.provinceFavoritesCount || 0)
          setChoicesCount(data.choicesCount || 0)
          setRepeatCount(data.repeatCount ?? 0)
          setDataLoaded(true)
        })
        .catch((error) => {
          console.error('获取用户统计数据失败:', error)
          // 失败时保持默认值（0）
          setDataLoaded(false)
        })
    } else {
      // 未登录时重置数据
      setScaleAnswersCount(0)
      setMajorFavoritesCount(0)
      setProvinceFavoritesCount(0)
      setChoicesCount(0)
      setRepeatCount(0)
      setDataLoaded(false)
    }
  }, [isLogin, userInfo])

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
          text: "",
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

  /** repeatCount > 0 且未答完 168 题：继续完成，不调用删除接口，跳转并定位未答题、带上次答题标记 */
  const handleContinueSelfAssessment = () => {
    Taro.navigateTo({
      url: '/pages/assessment/all-majors/index?continue=1'
    })
  }

  /**
   * 重新开始自我测评：仅当已答完 168 题时调用清除接口；repeatCount > 0 且未答完时由「继续完成」处理，不调用删除
   */
  const handleRestartAssessment = () => {
    if (scaleAnswersCount < TOTAL_QUESTIONS) {
      if (repeatCount > 0) {
        handleContinueSelfAssessment()
        return
      }
      Taro.showToast({
        title: '请先完成全部168题后再重新开始',
        icon: 'none',
        duration: 2500
      })
      return
    }
    Taro.showModal({
      title: '谨慎操作',
      content: '重新开始将清除所有答题数据，此操作不可恢复。确定要继续吗？',
      confirmText: '确定清除',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        try {
          Taro.showLoading({ title: '清除中...', mask: true })
          await deleteScaleAnswers()
          Taro.removeStorageSync('questionnaire_answers')
          Taro.removeStorageSync('questionnaire_previous_answers')
          Taro.hideLoading()
          Taro.showToast({ title: '已清空答题记录', icon: 'success', duration: 1500 })
          setScaleAnswersCount(0)
          Taro.navigateTo({
            url: '/pages/assessment/all-majors/index?restart=true'
          })
        } catch (error) {
          Taro.hideLoading()
          console.error('清除答案失败:', error)
          Taro.showToast({
            title: (error as Error)?.message || '操作失败，请重试',
            icon: 'none',
            duration: 2000
          })
        }
      }
    })
  }

  const handleViewReport = () => {
    // 完成168题就可以查看
    if (scaleAnswersCount < TOTAL_QUESTIONS) {
      Taro.showToast({
        title: '请先完成168题测评',
        icon: 'none'
      })
      return
    }
    Taro.navigateTo({
      url: '/pages/assessment/personal-profile/index'
    })
  }

  const handleContinueAssessment = () => {
    Taro.navigateTo({
      url: '/pages/assessment/questionnaire/index'
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
            
            // 静默登录模式：跳转首页
            setTimeout(() => {
              Taro.reLaunch({
                url: '/pages/index/index'
              })
            }, 1500)
          } catch (error: any) {
            // 即使接口调用失败，也清除本地状态并跳转首页
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
                url: '/pages/index/index'
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
              <View className="profile-page__name-row">
                <Text className="profile-page__name">
                  你好，{isLoggedIn ? userName : '未来的同学'}
                </Text>
                {isLoggedIn && (
                  <Text
                    className="profile-page__name-edit"
                    onClick={() => {
                      setNicknameDraft((userInfo?.nickname || '').trim())
                      setNicknameDialogOpen(true)
                    }}
                  >
                    修改
                  </Text>
                )}
              </View>
              {/* 副标题/状态 */}
              <View className="profile-page__status">
                {statusInfo.icon && (
                  <Text className="profile-page__status-icon">{statusInfo.icon}</Text>
                )}
                <Text className="profile-page__status-text">{statusInfo.text}</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="profile-page__content">
          {/* 核心功能卡片：我的探索之旅 */}
          <Card className="profile-page__card">
            <View className="profile-page__card-header">
              <Text className="profile-page__card-title">我的探索之旅</Text>
            </View>
            <View className="profile-page__card-body">
              {/* repeatCount > 0 且未答完：继续完成自我测评（不调删除）；答完 168 题：重新开始（调删除）；否则禁用 */}
              <View
                className={`profile-page__card-item ${scaleAnswersCount < TOTAL_QUESTIONS && repeatCount === 0 ? 'profile-page__card-item--disabled' : ''}`}
                onClick={handleRestartAssessment}
              >
                <View className={`profile-page__card-icon ${scaleAnswersCount >= TOTAL_QUESTIONS ? 'profile-page__card-icon--restart' : repeatCount > 0 ? 'profile-page__card-icon--continue' : 'profile-page__card-icon--disabled'}`}>
                  <Text className="profile-page__card-icon-text">{scaleAnswersCount >= TOTAL_QUESTIONS ? '🔄' : repeatCount > 0 ? '📝' : '🔄'}</Text>
                </View>
                <View className="profile-page__card-item-content">
                  <Text className={`profile-page__card-item-title ${scaleAnswersCount < TOTAL_QUESTIONS && repeatCount === 0 ? 'profile-page__card-item-title--disabled' : ''}`}>
                    {scaleAnswersCount >= TOTAL_QUESTIONS ? '重新开始自我测评' : repeatCount > 0 ? '继续完成自我测评' : '重新开始自我测评'}
                  </Text>
                  <Text className={`profile-page__card-item-desc ${scaleAnswersCount < TOTAL_QUESTIONS && repeatCount === 0 ? 'profile-page__card-item-desc--disabled' : ''}`}>
                    {scaleAnswersCount >= TOTAL_QUESTIONS ? '清除数据后重新答题，请谨慎操作' : repeatCount > 0 ? '定位到未答题，并参考上次答题内容' : '完成168题后可重新开始'}
                  </Text>
                </View>
                <Text className={`profile-page__card-arrow ${scaleAnswersCount < TOTAL_QUESTIONS && repeatCount === 0 ? 'profile-page__card-arrow--disabled' : ''}`}>›</Text>
              </View>

              {/* 查看我的报告 */}
              <View 
                className={`profile-page__card-item ${scaleAnswersCount < TOTAL_QUESTIONS ? 'profile-page__card-item--disabled' : ''}`}
                onClick={handleViewReport}
              >
                <View className={`profile-page__card-icon ${scaleAnswersCount >= TOTAL_QUESTIONS ? 'profile-page__card-icon--report' : 'profile-page__card-icon--disabled'}`}>
                  <Text className="profile-page__card-icon-text">📊</Text>
                </View>
                <View className="profile-page__card-item-content">
                  <Text className={`profile-page__card-item-title ${scaleAnswersCount < TOTAL_QUESTIONS ? 'profile-page__card-item-title--disabled' : ''}`}>
                    查看我的特质报告
                  </Text>
                  <Text className={`profile-page__card-item-desc ${scaleAnswersCount < TOTAL_QUESTIONS ? 'profile-page__card-item-desc--disabled' : ''}`}>
                    {scaleAnswersCount >= TOTAL_QUESTIONS ? "全面了解自己与众不同的特质、面临的挑战和应对策略" : "完成168题后可查看"}
                  </Text>
                </View>
                <Text className={`profile-page__card-arrow ${scaleAnswersCount < TOTAL_QUESTIONS ? 'profile-page__card-arrow--disabled' : ''}`}>›</Text>
              </View>

              {/* 继续未完成测评（仅当有未完成测评时显示） */}
              {/* {assessmentStatus === "in_progress" && (
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
              )} */}
            </View>
          </Card>

          {/* 通用设置卡片：更多 */}
          <Card className="profile-page__card">
            <View className="profile-page__card-header">
              <Text className="profile-page__card-title">更多</Text>
            </View>
            <View className="profile-page__card-body">
              {/* 联系客服：使用小程序客服功能 */}
              <TaroButton className="profile-page__card-item profile-page__card-item--contact" openType="contact">
                <View className="profile-page__card-icon profile-page__card-icon--feedback">
                  <Text className="profile-page__card-icon-text">💬</Text>
                </View>
                <View className="profile-page__card-item-content">
                  <Text className="profile-page__card-item-title">联系客服</Text>
                  <Text className="profile-page__card-item-desc">直接联系客服</Text>
                </View>
                <Text className="profile-page__card-arrow">›</Text>
              </TaroButton>

              {/* 关于我们 */}
              {/* <View className="profile-page__card-item" onClick={handleAbout}>
                <View className="profile-page__card-icon profile-page__card-icon--about">
                  <Text className="profile-page__card-icon-text">ℹ️</Text>
                </View>
                <View className="profile-page__card-item-content">
                  <Text className="profile-page__card-item-title">关于我们</Text>
                  <Text className="profile-page__card-item-desc">了解我们的理念与使命</Text>
                </View>
                <Text className="profile-page__card-arrow">›</Text>
              </View> */}

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
              <View
                className="profile-page__login"
                onClick={async () => {
                  Taro.showLoading({ title: '登录中…' })
                  const ok = await silentLogin()
                  Taro.hideLoading()
                  if (ok) {
                    Taro.showToast({ title: '登录成功', icon: 'success' })
                  } else {
                    Taro.showToast({ title: '登录失败，请重新打开小程序', icon: 'none' })
                  }
                }}
              >
                <Text className="profile-page__login-icon">🔑</Text>
                <Text className="profile-page__login-text">重新登录</Text>
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

      {/* 修改昵称弹窗 */}
      <Dialog
        open={nicknameDialogOpen}
        onOpenChange={(open) => {
          setNicknameDialogOpen(open)
          if (!open) {
            setNicknameSaving(false)
          }
        }}
      >
        <DialogContent className="profile-page__nickname-dialog" showCloseButton={!nicknameSaving}>
          <DialogHeader>
            <DialogTitle>修改昵称</DialogTitle>
          </DialogHeader>

          <View className="profile-page__nickname-form">
            <Input
              value={nicknameDraft}
              placeholder="请输入昵称"
              maxlength={50}
              disabled={nicknameSaving}
              onInput={(e) => {
                setNicknameDraft(e.detail.value)
              }}
            />
          </View>

          <DialogFooter className="profile-page__nickname-footer">
            <Button
              variant="outline"
              disabled={nicknameSaving}
              onClick={() => setNicknameDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              disabled={nicknameSaving}
              onClick={async () => {
                const nextNickname = (nicknameDraft || '').trim()
                if (!nextNickname) {
                  Taro.showToast({
                    title: '昵称不能为空',
                    icon: 'none',
                    duration: 2000,
                  })
                  return
                }

                try {
                  setNicknameSaving(true)
                  await updateCurrentUserNickname(nextNickname)

                  // 本地立即更新 Redux，驱动页面昵称刷新
                  dispatch(updateUserInfo({ nickname: nextNickname }))

                  Taro.showToast({
                    title: '修改成功',
                    icon: 'success',
                    duration: 1500,
                  })

                  setNicknameDialogOpen(false)
                } catch (error: any) {
                  console.error('更新昵称失败:', error)
                  Taro.showToast({
                    title: error?.message || '更新昵称失败，请重试',
                    icon: 'none',
                    duration: 2000,
                  })
                } finally {
                  setNicknameSaving(false)
                }
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

