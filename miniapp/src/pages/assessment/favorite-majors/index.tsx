// 心动专业页面
import React, { useState, useEffect } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { BottomNav } from '@/components/BottomNav'
import { TopNav } from '@/components/TopNav'
import { getStorage, setStorage } from '@/utils/storage'
import userScoreData from '@/assets/data/user-score.json'
import intentionData from '@/assets/data/intention.json'
import './index.less'

interface MajorScore {
  majorCode: string
  majorName: string
  majorBrief: string
  eduLevel: string
  score: string
  lexueScore: string
  shanxueScore: string
  schoolCount: string
}

interface UserScoreData {
  userId: string
  scores: MajorScore[]
}

export default function FavoriteMajorsPage() {
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [intendedMajors, setIntendedMajors] = useState<Set<string>>(new Set())
  const [allMajorsData, setAllMajorsData] = useState<UserScoreData | null>(null)
  const [expandedBriefs, setExpandedBriefs] = useState<Set<string>>(new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [majorToDelete, setMajorToDelete] = useState<string | null>(null)

  // 从本地存储读取心动专业列表
  useEffect(() => {
    const loadData = async () => {
      try {
        const stored = await getStorage<string[]>('intendedMajors')
        if (stored) {
          setIntendedMajors(new Set(stored))
        }
      } catch (error) {
        console.error('加载心动专业失败:', error)
      }
    }
    loadData()
  }, [])

  // 加载所有专业数据
  useEffect(() => {
    try {
      const data = userScoreData as any
      setAllMajorsData(data.data || data)
      setLoading(false)
    } catch (error) {
      console.error('加载专业数据失败:', error)
      setLoading(false)
    }
  }, [])

  // 打开删除确认对话框
  const handleDeleteClick = (majorCode: string) => {
    setMajorToDelete(majorCode)
    setDeleteConfirmOpen(true)
  }

  // 确认删除心动专业
  const confirmDelete = async () => {
    if (majorToDelete) {
      const newSet = new Set(intendedMajors)
      newSet.delete(majorToDelete)
      setIntendedMajors(newSet)
      try {
        await setStorage('intendedMajors', Array.from(newSet))
      } catch (error) {
        console.error('保存心动专业失败:', error)
      }
    }
    setDeleteConfirmOpen(false)
    setMajorToDelete(null)
  }

  const toggleBrief = (majorCode: string) => {
    setExpandedBriefs((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(majorCode)) {
        newSet.delete(majorCode)
      } else {
        newSet.add(majorCode)
      }
      return newSet
    })
  }

  // 获取心动专业列表
  const favoriteMajors = allMajorsData?.scores.filter((major) => intendedMajors.has(major.majorCode)) || []

  // 过滤搜索结果
  const filteredMajors = favoriteMajors.filter((major) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return major.majorName.toLowerCase().includes(query) || major.majorCode.toLowerCase().includes(query)
  })

  // 计算热爱能量前20%的专业
  const allMajorsWithScores = (intentionData as any[])
    .map((item: any) => ({
      code: item.major.code,
      name: item.major.name,
      score: parseFloat(item.major.score || '0')
    }))
    .filter((major: any) => major.score > 0)
  
  const sortedAllMajors = [...allMajorsWithScores].sort((a: any, b: any) => b.score - a.score)
  const top20PercentThresholdIndex = sortedAllMajors.length > 0 
    ? Math.ceil(sortedAllMajors.length * 0.2) 
    : 0
  const top20PercentMajorCodes = new Set(
    sortedAllMajors.slice(0, top20PercentThresholdIndex).map((m: any) => m.code)
  )
  const top20PercentInFavorites = favoriteMajors.filter((major) => {
    return top20PercentMajorCodes.has(major.majorCode)
  })
  const top20PercentCount = top20PercentInFavorites.length

  if (loading) {
    return (
      <View className="favorite-majors-page">
        <TopNav />
        <View className="favorite-majors-page__loading">
          <Text>加载中...</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className="favorite-majors-page">
      <TopNav />
      
      {/* 头部 */}
      <View className="favorite-majors-page__header">
        <View className="favorite-majors-page__header-content">
          <Text className="favorite-majors-page__title">心动专业列表</Text>
          <Text className="favorite-majors-page__subtitle">共 {intendedMajors.size} 个心动专业</Text>
        </View>
        <View className="favorite-majors-page__wave" />
      </View>

      {/* 内容区域 */}
      <View className="favorite-majors-page__content">
        {/* 搜索框 */}
        <View className="favorite-majors-page__search">
          <Input
            placeholder="搜索专业名称或代码..."
            value={searchQuery}
            onInput={(e) => setSearchQuery(e.detail.value)}
            className="favorite-majors-page__search-input"
          />
          <Text className="favorite-majors-page__search-icon">🔍</Text>
        </View>

        {/* 心动专业列表 */}
        {filteredMajors.length === 0 ? (
          <Card className="favorite-majors-page__empty">
            {intendedMajors.size === 0 ? (
              <View className="favorite-majors-page__empty-content">
                <Text className="favorite-majors-page__empty-icon">⭐</Text>
                <Text className="favorite-majors-page__empty-text">暂无心动专业</Text>
                <Text className="favorite-majors-page__empty-desc">
                  在专业列表页面点击星星图标可以添加心动专业
                </Text>
                <Button
                  onClick={() => {
                    Taro.navigateTo({
                      url: '/pages/majors/index'
                    })
                  }}
                  className="favorite-majors-page__empty-button"
                >
                  前往所有专业页面探索 →
                </Button>
              </View>
            ) : (
              <View className="favorite-majors-page__empty-content">
                <Text className="favorite-majors-page__empty-icon">🔍</Text>
                <Text className="favorite-majors-page__empty-text">未找到匹配的专业</Text>
                <Text className="favorite-majors-page__empty-desc">请尝试其他搜索关键词</Text>
              </View>
            )}
          </Card>
        ) : (
          <View className="favorite-majors-page__list">
            {filteredMajors.map((major) => (
              <Card key={major.majorCode} className="favorite-majors-page__item">
                <View className="favorite-majors-page__item-content">
                  <View className="favorite-majors-page__item-header">
                    <View className="favorite-majors-page__item-title-section">
                      <Text className="favorite-majors-page__item-name">{major.majorName}</Text>
                      <Text className="favorite-majors-page__item-code">({major.majorCode})</Text>
                      <View className="favorite-majors-page__item-score-badge">
                        <Text>热爱能量: {major.score}</Text>
                      </View>
                    </View>
                  </View>

                  <View className="favorite-majors-page__item-brief">
                    <Text 
                      className={`favorite-majors-page__item-brief-text ${expandedBriefs.has(major.majorCode) ? '' : 'favorite-majors-page__item-brief-text--clamped'}`}
                    >
                      {major.majorBrief}
                    </Text>
                    <Button
                      onClick={() => toggleBrief(major.majorCode)}
                      className="favorite-majors-page__item-brief-toggle"
                      size="sm"
                      variant="ghost"
                    >
                      {expandedBriefs.has(major.majorCode) ? '收起 ↑' : '展开 ↓'}
                    </Button>
                  </View>

                  {/* 操作按钮区域 */}
                  <View className="favorite-majors-page__item-actions">
                    <Button
                      onClick={() => handleDeleteClick(major.majorCode)}
                      className="favorite-majors-page__item-delete-button"
                      size="sm"
                      variant="outline"
                    >
                      🗑️ 删除
                    </Button>
                    <Button
                      onClick={() => {
                        Taro.showToast({
                          title: '深度了解功能开发中',
                          icon: 'none'
                        })
                      }}
                      className="favorite-majors-page__item-view-button"
                      size="sm"
                      variant="outline"
                    >
                      👁️ 深度了解
                    </Button>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* 提示信息 */}
        {top20PercentCount > 0 && (
          <Card className="favorite-majors-page__tip">
            <Text className="favorite-majors-page__tip-text">
              💡 您的心动专业中有 {top20PercentCount} 个属于热爱能量前20%的专业
            </Text>
          </Card>
        )}
      </View>

      <BottomNav />

      {/* 删除确认对话框 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要从心动专业列表中删除此专业吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setDeleteConfirmOpen(false)}
              variant="outline"
            >
              取消
            </Button>
            <Button
              onClick={confirmDelete}
              className="favorite-majors-page__delete-confirm-button"
            >
              确定删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}

