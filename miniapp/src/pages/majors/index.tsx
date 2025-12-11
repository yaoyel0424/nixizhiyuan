// 专业探索页面
import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { BottomNav } from '@/components/BottomNav'
import './index.less'

export default function MajorsPage() {
  const [activeTab, setActiveTab] = useState<string>("本科")

  const handleBack = () => {
    Taro.navigateBack()
  }

  return (
    <View className="majors-page">
      
      {/* 头部 */}
      <View className="majors-page__header">
        <View className="majors-page__header-content">
          <View className="majors-page__header-top">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="majors-page__back-btn"
            >
              ←
            </Button>
            <Text className="majors-page__title">专业探索</Text>
          </View>
          <Text className="majors-page__subtitle">发现适合你的专业方向</Text>

          {/* 标签页 */}
          <View className="majors-page__tabs">
            {["本科", "高职本科", "专科"].map((tab) => (
              <View
                key={tab}
                className={`majors-page__tab ${activeTab === tab ? 'majors-page__tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <Text className="majors-page__tab-text">{tab}</Text>
              </View>
            ))}
          </View>
        </View>
        {/* 波浪效果 */}
        <View className="majors-page__wave" />
      </View>

      {/* 内容区域 */}
      <View className="majors-page__content">
        <Text className="majors-page__placeholder">专业列表内容（待实现）</Text>
        <Text className="majors-page__placeholder-desc">当前选择：{activeTab}</Text>
      </View>

      <BottomNav />
    </View>
  )
}

