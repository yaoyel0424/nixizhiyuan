// 热门专业评估页面
import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/Button'
import './index.less'

export default function PopularMajorsPage() {
  const handleStartQuickAssessment = () => {
    Taro.showToast({
      title: '快速测评功能开发中',
      icon: 'none'
    })
  }

  return (
    <PageContainer>
      <View className="popular-majors-page">
        <View className="popular-majors-page__content">
          <Text className="popular-majors-page__title">快速测评</Text>
          <Text className="popular-majors-page__desc">发现与你特质契合的热门专业方向</Text>
          <Text className="popular-majors-page__time">约3分钟</Text>
          <Button 
            onClick={handleStartQuickAssessment}
            className="popular-majors-page__button"
            size="lg"
          >
            立即开始
          </Button>
        </View>
      </View>
    </PageContainer>
  )
}

