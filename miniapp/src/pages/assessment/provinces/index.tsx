// 省份选择页面
import React from 'react'
import { View, Text } from '@tarojs/components'
import { PageContainer } from '@/components/PageContainer'
import { Card } from '@/components/ui/Card'
import './index.less'

export default function ProvincesPage() {
  return (
    <PageContainer>
      <View className="provinces-page">
        <View className="provinces-page__content">
          <Card className="provinces-page__card">
            <Text className="provinces-page__title">圈定理想城市</Text>
            <Text className="provinces-page__desc">结合你的偏好，找到理想的城市圈</Text>
            <Text className="provinces-page__tip">功能开发中...</Text>
          </Card>
        </View>
      </View>
    </PageContainer>
  )
}
