// 所有专业评估页面
import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/Button'
import { BottomNav } from '@/components/BottomNav'
import './index.less'

export default function AllMajorsPage() {
  const handleStartQuestionnaire = () => {
    Taro.navigateTo({
      url: '/pages/assessment/questionnaire/index'
    })
  }

  return (
    <PageContainer>
      <View className="all-majors-page">
        <View className="all-majors-page__content">
          <Text className="all-majors-page__title">深度自我洞察</Text>
          <Text className="all-majors-page__desc">
            完成168题科学测评，解锁你的核心特质报告
          </Text>
          <Button 
            onClick={handleStartQuestionnaire}
            className="all-majors-page__button"
            size="lg"
          >
            开始答题
          </Button>
        </View>
      </View>
      <BottomNav />
    </PageContainer>
  )
}

