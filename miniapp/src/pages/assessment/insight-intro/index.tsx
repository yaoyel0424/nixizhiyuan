/**
 * 深度自我洞察：进入 168 题前的引导页（与小程序全局浅蓝风格一致）
 */
import React, { useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { withErrorHandler } from '@/utils/errorHandler'
import './index.less'

export default function InsightIntroPage() {
  const router = useRouter()
  const isContinue =
    router.params?.continue === '1' || router.params?.continue === 'true'

  const targetUrl = useMemo(
    () =>
      isContinue
        ? '/pages/assessment/all-majors/index?continue=1'
        : '/pages/assessment/all-majors/index',
    [isContinue]
  )

  /** 进入 168 题答题页（replace 当前引导页） */
  const handleStart = withErrorHandler(() => {
    Taro.redirectTo({ url: targetUrl })
  }, '进入答题失败，请稍后重试')

  return (
    <ErrorBoundary fallbackTitle="页面异常" fallbackMessage="请返回重试。">
      <View className="insight-intro-page">
        <View className="insight-intro-page__inner">
          <Text className="insight-intro-page__title">深度自我洞察</Text>

          <View className="insight-intro-page__card">
            <Text className="insight-intro-page__num">168</Text>
            <Text className="insight-intro-page__num-desc">次选择，勾勒更贴近你的画像</Text>
            <View className="insight-intro-page__rule" />
            <Text className="insight-intro-page__verse">
              168 次本能的反应，是带你抵达热爱的 168 个精准坐标。
            </Text>
            <Text className="insight-intro-page__verse">
              这里的每一个选项，都是你身体里原本就有的节奏。
            </Text>
            <Text className="insight-intro-page__verse">
              顺着直觉走，去遇见那个最自然的自己。
            </Text>
          </View>
        </View>

        <View className="insight-intro-page__footer">
          <Button className="insight-intro-page__cta" size="lg" onClick={handleStart}>
            从这里开始，看见原本的你
          </Button>
        </View>
      </View>
    </ErrorBoundary>
  )
}
