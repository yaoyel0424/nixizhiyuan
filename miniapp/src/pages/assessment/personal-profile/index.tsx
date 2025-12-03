// 个人特质报告页面
import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card } from '@/components/ui/Card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { BottomNav } from '@/components/BottomNav'
import { TopNav } from '@/components/TopNav'
import reportData from '@/assets/data/report.json'
import './index.less'

interface Portrait {
  id: number
  like_id: number
  talent_id: number
  like_obvious: boolean
  talent_obvious: boolean
  name: string
  explain: string
}

interface Challenge {
  id: number
  like_id: number
  talent_id: number
  like_obvious: boolean
  talent_obvious: boolean
  type: string
  name: string
  content: string
  strategy: string
}

interface Element {
  id: number
  name: string
  type: string
  dimension: string
  correlation_talent_id: number | null
}

interface Mechanism {
  id: number
  reason_id: number
  element_id: number
  content: string
  brief: string
  remarks: string | null
}

// Portrait 卡片组件
function PortraitCard({ 
  portrait, 
  challenges, 
  elements, 
  mechanisms 
}: { 
  portrait: Portrait
  challenges: Challenge[]
  elements: Element[]
  mechanisms: Mechanism[]
}) {
  const [expandedChallenges, setExpandedChallenges] = useState(false)
  const [expandedMechanisms, setExpandedMechanisms] = useState(false)
  const [expandedStrategy, setExpandedStrategy] = useState<Record<number, boolean>>({})

  // 根据 portrait 的 like_id 和 talent_id 查找关联的 challenges
  const relatedChallenges = challenges.filter(
    (c) =>
      c.like_id === portrait.like_id &&
      c.talent_id === portrait.talent_id &&
      c.like_obvious === portrait.like_obvious &&
      c.talent_obvious === portrait.talent_obvious
  )

  // 将 challenges 按类型分组
  const challengesByType = {
    自我认知: relatedChallenges.filter((c) => c.type === '自我认知与内驱力管理'),
    人际协作: relatedChallenges.filter((c) => c.type === '人际协作与社会融合'),
    能力构建: relatedChallenges.filter((c) => c.type === '认知策略与能力构建')
  }

  // 根据 portrait 的 like_id 和 talent_id 查找关联的 elements
  const likeElement = elements.find((e) => e.id === portrait.like_id && e.type === 'like')
  const talentElement = elements.find((e) => e.id === portrait.talent_id && e.type === 'talent')

  // 查找关联的 mechanisms
  const likeMechanisms = mechanisms.filter((m) => m.element_id === portrait.like_id)
  const talentMechanisms = mechanisms.filter((m) => m.element_id === portrait.talent_id)

  // 获取分类图标
  const getCategoryIcon = () => {
    if (portrait.like_obvious && portrait.talent_obvious) return '👑'
    if (portrait.like_obvious && !portrait.talent_obvious) return '🚀'
    if (!portrait.like_obvious && portrait.talent_obvious) return '⚡'
    return '🧭'
  }

  return (
    <Card className="personal-profile-page__portrait-card">
      {/* Portrait 基本信息 */}
      <View className="personal-profile-page__portrait-header">
        <Text className="personal-profile-page__portrait-icon">{getCategoryIcon()}</Text>
        <View className="personal-profile-page__portrait-info">
          <Text className="personal-profile-page__portrait-name">{portrait.name}</Text>
          <Text className="personal-profile-page__portrait-explain">{portrait.explain}</Text>
        </View>
      </View>

      {/* 潜在挑战与应对策略 */}
      {relatedChallenges.length > 0 && (
        <View className="personal-profile-page__section">
          <View 
            className="personal-profile-page__section-header"
            onClick={() => setExpandedChallenges(!expandedChallenges)}
          >
            <Text className="personal-profile-page__section-icon">🎯</Text>
            <Text className="personal-profile-page__section-title">潜在挑战与应对策略</Text>
            <Text className={`personal-profile-page__section-arrow ${expandedChallenges ? 'personal-profile-page__section-arrow--expanded' : ''}`}>
              ▼
            </Text>
          </View>
          {expandedChallenges && (
            <View className="personal-profile-page__challenges">
              {Object.entries(challengesByType).map(([type, typeChallenges]) => {
                if (typeChallenges.length === 0) return null
                return (
                  <View key={type} className="personal-profile-page__challenge-type">
                    <Text className="personal-profile-page__challenge-type-title">{type}</Text>
                    {typeChallenges.map((challenge) => (
                      <Card key={challenge.id} className="personal-profile-page__challenge-item">
                        <Text className="personal-profile-page__challenge-name">{challenge.name}</Text>
                        <Text className="personal-profile-page__challenge-content">{challenge.content}</Text>
                        <View 
                          className="personal-profile-page__challenge-strategy-header"
                          onClick={() => setExpandedStrategy({
                            ...expandedStrategy,
                            [challenge.id]: !expandedStrategy[challenge.id]
                          })}
                        >
                          <Text className="personal-profile-page__challenge-strategy-title">应对策略</Text>
                          <Text className={`personal-profile-page__challenge-strategy-arrow ${expandedStrategy[challenge.id] ? 'personal-profile-page__challenge-strategy-arrow--expanded' : ''}`}>
                            ▼
                          </Text>
                        </View>
                        {expandedStrategy[challenge.id] && (
                          <View className="personal-profile-page__challenge-strategy-content">
                            <Text className="personal-profile-page__challenge-strategy-text">{challenge.strategy}</Text>
                          </View>
                        )}
                      </Card>
                    ))}
                  </View>
                )
              })}
            </View>
          )}
        </View>
      )}

      {/* 核心要素与机制解析 */}
      <View className="personal-profile-page__section">
        <View 
          className="personal-profile-page__section-header"
          onClick={() => setExpandedMechanisms(!expandedMechanisms)}
        >
          <Text className="personal-profile-page__section-icon">🧠</Text>
          <Text className="personal-profile-page__section-title">核心要素与机制解析</Text>
          <Text className={`personal-profile-page__section-arrow ${expandedMechanisms ? 'personal-profile-page__section-arrow--expanded' : ''}`}>
            ▼
          </Text>
        </View>
        {expandedMechanisms && (
          <View className="personal-profile-page__mechanisms">
            {/* 喜欢要素 */}
            {likeElement && (
              <Card className="personal-profile-page__element-card personal-profile-page__element-card--like">
                <View className="personal-profile-page__element-header">
                  <Text className="personal-profile-page__element-icon">✨</Text>
                  <Text className="personal-profile-page__element-label">喜欢</Text>
                  <Text className="personal-profile-page__element-name">{likeElement.name}</Text>
                  <View className={`personal-profile-page__element-badge ${portrait.like_obvious ? 'personal-profile-page__element-badge--obvious' : ''}`}>
                    <Text>{portrait.like_obvious ? '明显' : '不明显'}</Text>
                  </View>
                </View>
                {likeMechanisms.length > 0 && (
                  <View className="personal-profile-page__mechanism-list">
                    {likeMechanisms.map((mechanism) => (
                      <View key={mechanism.id} className="personal-profile-page__mechanism-item">
                        <Text className="personal-profile-page__mechanism-text">
                          {mechanism.brief || mechanism.content}
                        </Text>
                        {mechanism.remarks && (
                          <Text className="personal-profile-page__mechanism-remarks">{mechanism.remarks}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            )}

            {/* 天赋要素 */}
            {talentElement && (
              <Card className="personal-profile-page__element-card personal-profile-page__element-card--talent">
                <View className="personal-profile-page__element-header">
                  <Text className="personal-profile-page__element-icon">💡</Text>
                  <Text className="personal-profile-page__element-label">天赋</Text>
                  <Text className="personal-profile-page__element-name">{talentElement.name}</Text>
                  <View className={`personal-profile-page__element-badge ${portrait.talent_obvious ? 'personal-profile-page__element-badge--obvious' : ''}`}>
                    <Text>{portrait.talent_obvious ? '明显' : '不明显'}</Text>
                  </View>
                </View>
                {talentMechanisms.length > 0 && (
                  <View className="personal-profile-page__mechanism-list">
                    {talentMechanisms.map((mechanism) => (
                      <View key={mechanism.id} className="personal-profile-page__mechanism-item">
                        <Text className="personal-profile-page__mechanism-text">
                          {mechanism.brief || mechanism.content}
                        </Text>
                        {mechanism.remarks && (
                          <Text className="personal-profile-page__mechanism-remarks">{mechanism.remarks}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            )}
          </View>
        )}
      </View>
    </Card>
  )
}

export default function PersonalProfilePage() {
  const [portraits, setPortraits] = useState<Portrait[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [elements, setElements] = useState<Element[]>([])
  const [mechanisms, setMechanisms] = useState<Mechanism[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('兴趣强度高')

  useEffect(() => {
    try {
      const data = reportData as any
      setPortraits(data.portrait || [])
      setChallenges(data.challenge || [])
      setElements(data.element || [])
      setMechanisms(data.mechanism || [])
      setLoading(false)
    } catch (error) {
      console.error('加载报告数据失败:', error)
      setLoading(false)
    }
  }, [])

  // 将 portraits 按分类分组
  const portraitsByCategory = {
    兴趣强度高: portraits.filter((p) => p.like_obvious && p.talent_obvious),
    驱动能力强: portraits.filter((p) => p.like_obvious && !p.talent_obvious),
    成果效率高: portraits.filter((p) => !p.like_obvious && p.talent_obvious),
    现状成就低: portraits.filter((p) => !p.like_obvious && !p.talent_obvious)
  }

  if (loading) {
    return (
      <View className="personal-profile-page">
        <TopNav />
        <View className="personal-profile-page__loading">
          <Text>加载中...</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  if (portraits.length === 0) {
    return (
      <View className="personal-profile-page">
        <TopNav />
        <View className="personal-profile-page__empty">
          <Text>暂无画像数据</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className="personal-profile-page">
      <TopNav />
      
      {/* 头部区域 */}
      <View className="personal-profile-page__header">
        <View className="personal-profile-page__header-content">
          <Text className="personal-profile-page__header-title">个人特质分析</Text>
        </View>
        <View className="personal-profile-page__header-wave" />
      </View>

      {/* 维度信息 */}
      <View className="personal-profile-page__dimensions">
        <Card className="personal-profile-page__dimensions-card">
          <Text className="personal-profile-page__dimensions-title">维度分布</Text>
          <View className="personal-profile-page__dimensions-list">
            {['看', '听', '说', '记', '想', '做', '运动'].map((dim) => {
              const dimElements = elements.filter(e => e.dimension === dim)
              return (
                <View key={dim} className="personal-profile-page__dimension-item">
                  <Text className="personal-profile-page__dimension-name">{dim}</Text>
                  <Text className="personal-profile-page__dimension-count">{dimElements.length}</Text>
                </View>
              )
            })}
          </View>
        </Card>
      </View>

      {/* Portrait Tabs */}
      <View className="personal-profile-page__content">
        <Card className="personal-profile-page__tabs-card">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="personal-profile-page__tabs-list">
              <TabsTrigger value="兴趣强度高">
                兴趣强度高
              </TabsTrigger>
              <TabsTrigger value="驱动能力强">
                驱动能力强
              </TabsTrigger>
              <TabsTrigger value="成果效率高">
                成果效率高
              </TabsTrigger>
              <TabsTrigger value="现状成就低">
                现状成就低
              </TabsTrigger>
            </TabsList>

            <TabsContent value="兴趣强度高">
              <View className="personal-profile-page__portraits-list">
                {portraitsByCategory.兴趣强度高.length > 0 ? (
                  portraitsByCategory.兴趣强度高.map((portrait) => (
                    <PortraitCard
                      key={portrait.id}
                      portrait={portrait}
                      challenges={challenges}
                      elements={elements}
                      mechanisms={mechanisms}
                    />
                  ))
                ) : (
                  <View className="personal-profile-page__empty-portraits">
                    <Text>暂无数据</Text>
                  </View>
                )}
              </View>
            </TabsContent>

            <TabsContent value="驱动能力强">
              <View className="personal-profile-page__portraits-list">
                {portraitsByCategory.驱动能力强.length > 0 ? (
                  portraitsByCategory.驱动能力强.map((portrait) => (
                    <PortraitCard
                      key={portrait.id}
                      portrait={portrait}
                      challenges={challenges}
                      elements={elements}
                      mechanisms={mechanisms}
                    />
                  ))
                ) : (
                  <View className="personal-profile-page__empty-portraits">
                    <Text>暂无数据</Text>
                  </View>
                )}
              </View>
            </TabsContent>

            <TabsContent value="成果效率高">
              <View className="personal-profile-page__portraits-list">
                {portraitsByCategory.成果效率高.length > 0 ? (
                  portraitsByCategory.成果效率高.map((portrait) => (
                    <PortraitCard
                      key={portrait.id}
                      portrait={portrait}
                      challenges={challenges}
                      elements={elements}
                      mechanisms={mechanisms}
                    />
                  ))
                ) : (
                  <View className="personal-profile-page__empty-portraits">
                    <Text>暂无数据</Text>
                  </View>
                )}
              </View>
            </TabsContent>

            <TabsContent value="现状成就低">
              <View className="personal-profile-page__portraits-list">
                {portraitsByCategory.现状成就低.length > 0 ? (
                  portraitsByCategory.现状成就低.map((portrait) => (
                    <PortraitCard
                      key={portrait.id}
                      portrait={portrait}
                      challenges={challenges}
                      elements={elements}
                      mechanisms={mechanisms}
                    />
                  ))
                ) : (
                  <View className="personal-profile-page__empty-portraits">
                    <Text>暂无数据</Text>
                  </View>
                )}
              </View>
            </TabsContent>
          </Tabs>
        </Card>
      </View>

      <BottomNav />
    </View>
  )
}

