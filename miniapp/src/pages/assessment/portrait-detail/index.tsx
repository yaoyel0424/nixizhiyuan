/**
 * 画像详情页：展示单个画像的完整内容（从「我的画像」词云点击跳转）
 */
import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import type { Portrait } from '@/services/portraits'
import './index.less'

/** 数字转中文序号：一、二、三…十、十一… */
function toChineseOrdinal(n: number): string {
  const map = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (n <= 0) return ''
  if (n <= 10) return map[n]
  if (n < 20) return '十' + map[n - 10]
  if (n < 100) return map[Math.floor(n / 10)] + '十' + (n % 10 ? map[n % 10] : '')
  return String(n)
}

const PORTRAIT_STORAGE_KEY = 'portraitDetail'

function Section({
  title,
  hideTitle,
  description,
  children = null
}: {
  title: string
  hideTitle?: boolean
  /** 作为 section-title 下方描述文字 */
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <View className="portrait-detail-page__section">
      {!hideTitle && <Text className="portrait-detail-page__section-title">{title}</Text>}
      {description != null && (
        <View className="portrait-detail-page__section-desc">
          {description}
        </View>
      )}
      {children != null && children !== false && (
        <View className="portrait-detail-page__section-body">{children}</View>
      )}
    </View>
  )
}

function Block({
  label,
  value,
  hideLabel
}: {
  label: string
  value?: string | null
  hideLabel?: boolean
}) {
  if (value == null || String(value).trim() === '') return null
  return (
    <View className="portrait-detail-page__block">
      {!hideLabel && <Text className="portrait-detail-page__block-label">{label}</Text>}
      <Text className="portrait-detail-page__block-value">{value}</Text>
    </View>
  )
}

export default function PortraitDetailPage() {
  const [portrait, setPortrait] = useState<Portrait | null>(null)
  // 第一象限·挑战 Tab 当前选中的类型（id）
  const [challengeTab, setChallengeTab] = useState<string>('')
  // 第一象限·生态位 Tab 当前选中的索引
  const [nicheTab, setNicheTab] = useState<string>('0')
  // 第二～四象限 Tab 当前选中（id 或索引字符串）
  const [quadrant2LifeTab, setQuadrant2LifeTab] = useState<string>('')
  const [quadrant2StudyTab, setQuadrant2StudyTab] = useState<string>('0')
  const [quadrant3WeaknessTab, setQuadrant3WeaknessTab] = useState<string>('')
  const [quadrant3CompensationTab, setQuadrant3CompensationTab] = useState<string>('0')
  const [quadrant4DilemmaTab, setQuadrant4DilemmaTab] = useState<string>('')
  const [quadrant4GrowthTab, setQuadrant4GrowthTab] = useState<string>('0')

  useEffect(() => {
    try {
      const raw = Taro.getStorageSync(PORTRAIT_STORAGE_KEY)
      if (raw) {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw
        setPortrait(data as Portrait)
      }
    } catch (e) {
      console.warn('portrait detail parse:', e)
    }
  }, [])

  // 挑战列表加载后默认选中第一项
  useEffect(() => {
    if (portrait?.quadrant1Challenges?.length && !challengeTab) {
      setChallengeTab(String(portrait.quadrant1Challenges[0].id))
    }
  }, [portrait?.quadrant1Challenges, challengeTab])
  // 第二～四象限 Tab 默认选中第一项
  useEffect(() => {
    if (portrait?.quadrant2LifeChallenges?.length && !quadrant2LifeTab) {
      setQuadrant2LifeTab(String(portrait.quadrant2LifeChallenges[0].id))
    }
  }, [portrait?.quadrant2LifeChallenges, quadrant2LifeTab])
  useEffect(() => {
    if (portrait?.quadrant3Weaknesses?.length && !quadrant3WeaknessTab) {
      setQuadrant3WeaknessTab(String(portrait.quadrant3Weaknesses[0].id))
    }
  }, [portrait?.quadrant3Weaknesses, quadrant3WeaknessTab])
  useEffect(() => {
    if (portrait?.quadrant4Dilemmas?.length && !quadrant4DilemmaTab) {
      setQuadrant4DilemmaTab(String(portrait.quadrant4Dilemmas[0].id))
    }
  }, [portrait?.quadrant4Dilemmas, quadrant4DilemmaTab])

  if (!portrait) {
    return (
      <View className="portrait-detail-page">
        <View className="portrait-detail-page__empty">
          <Text className="portrait-detail-page__empty-text">暂无画像数据，请返回我的画像页选择</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="portrait-detail-page">
      <View className="portrait-detail-page__header">
        <Text className="portrait-detail-page__title">{portrait.name}</Text>
        {portrait.quadrant?.name && (
          <Text className="portrait-detail-page__quadrant">
             {portrait.quadrant.title}
          </Text>
        )}
      </View>

      <ScrollView className="portrait-detail-page__body" scrollY>
        {/* 第一块：status */}
        {portrait.status && (
          <View className="portrait-detail-page__chunk portrait-detail-page__chunk--1">
            <Section title="画像概述" hideTitle description={<Text className="portrait-detail-page__section-desc-text">{portrait.status}</Text>} />
          </View>
        )}

        {/* 第二块：partOneMainTitle + partOneSubTitle + partOneDescription（在上） + 三大核心挑战战场 + 第四象限·三大核心挑战 + 第二象限·生活挑战 + 第三象限·弱点与应对（同块） */}
        {(portrait.partOneMainTitle || portrait.partOneSubTitle || portrait.partOneDescription || (portrait.quadrant1Challenges && portrait.quadrant1Challenges.length > 0) || (portrait.quadrant4Dilemmas && portrait.quadrant4Dilemmas.length > 0) || (portrait.quadrant2LifeChallenges && portrait.quadrant2LifeChallenges.length > 0) || (portrait.quadrant3Weaknesses && portrait.quadrant3Weaknesses.length > 0)) && (
          <View className="portrait-detail-page__chunk portrait-detail-page__chunk--2">
            {(portrait.partOneMainTitle || portrait.partOneSubTitle || portrait.partOneDescription) && (
              <View className="portrait-detail-page__section-desc-lines">
                {portrait.partOneMainTitle ? <Text className="portrait-detail-page__section-title">{portrait.partOneMainTitle}</Text> : null}
                {portrait.partOneSubTitle ? <Text className="portrait-detail-page__section-desc-text portrait-detail-page__section-desc-text--bold">{portrait.partOneSubTitle}</Text> : null}
                {portrait.partOneDescription ? <Text className="portrait-detail-page__section-desc-text portrait-detail-page__section-desc-text--small">{portrait.partOneDescription}</Text> : null}
              </View>
            )}
            <Section title="三大核心挑战战场">
              {portrait.quadrant1Challenges && portrait.quadrant1Challenges.length > 0 ? (
                <Tabs
                  className="portrait-detail-page__tabs"
                  value={challengeTab || String(portrait.quadrant1Challenges[0].id)}
                  onValueChange={setChallengeTab}
                >
                  <TabsList className="portrait-detail-page__tabs-list">
                    {portrait.quadrant1Challenges.map((c) => (
                      <TabsTrigger key={c.id} value={String(c.id)} className="portrait-detail-page__tabs-trigger">
                        {c.type}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {portrait.quadrant1Challenges.map((c) => (
                    <TabsContent key={c.id} value={String(c.id)} className="portrait-detail-page__tabs-content">
                      <View className="portrait-detail-page__tabs-inner">
                        {c.name ? <Text className="portrait-detail-page__tabs-inner-title">{c.name}</Text> : null}
                        {c.description ? <Text className="portrait-detail-page__tabs-inner-text">{c.description}</Text> : null}
                        {c.cultivationStrategy ? <Text className="portrait-detail-page__tabs-inner-text portrait-detail-page__tabs-inner-text--bold">{c.cultivationStrategy}</Text> : null}
                        {c.strategy ? <Text className="portrait-detail-page__tabs-inner-text">{c.strategy}</Text> : null}
                        {c.capabilityBuilding ? <Text className="portrait-detail-page__tabs-inner-text">{c.capabilityBuilding}</Text> : null}
                      </View>
                    </TabsContent>
                  ))}
                </Tabs>
              ) : null}
            </Section>
            {portrait.quadrant4Dilemmas && portrait.quadrant4Dilemmas.length > 0 && (
              <Section title="第四象限 · 三大核心挑战" hideTitle>
                <Tabs
                  className="portrait-detail-page__tabs"
                  value={quadrant4DilemmaTab || String(portrait.quadrant4Dilemmas[0].id)}
                  onValueChange={setQuadrant4DilemmaTab}
                >
                  <TabsList className="portrait-detail-page__tabs-list">
                    {portrait.quadrant4Dilemmas.map((d) => (
                      <TabsTrigger key={d.id} value={String(d.id)} className="portrait-detail-page__tabs-trigger">
                        {d.type}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {portrait.quadrant4Dilemmas.map((d) => (
                    <TabsContent key={d.id} value={String(d.id)} className="portrait-detail-page__tabs-content">
                      <View className="portrait-detail-page__tabs-inner">
                        {d.name ? <Text className="portrait-detail-page__tabs-inner-title">{d.name}</Text> : null}
                        {d.description ? <Text className="portrait-detail-page__tabs-inner-text">{d.description}</Text> : null}
                        {d.cultivationStrategy ? <Text className="portrait-detail-page__tabs-inner-text portrait-detail-page__tabs-inner-text--bold">{d.cultivationStrategy}</Text> : null}
                        {d.strategy ? <Text className="portrait-detail-page__tabs-inner-text">{d.strategy}</Text> : null}
                        {d.capabilityBuilding ? <Text className="portrait-detail-page__tabs-inner-text">{d.capabilityBuilding}</Text> : null}
                      </View>
                    </TabsContent>
                  ))}
                </Tabs>
              </Section>
            )}
            {portrait.quadrant2LifeChallenges && portrait.quadrant2LifeChallenges.length > 0 && (
              <Section title="第二象限 · 生活挑战" hideTitle>
                <Tabs
                  className="portrait-detail-page__tabs portrait-detail-page__tabs--q2"
                  value={quadrant2LifeTab || String(portrait.quadrant2LifeChallenges[0].id)}
                  onValueChange={setQuadrant2LifeTab}
                >
                  <TabsList className="portrait-detail-page__tabs-list">
                    {portrait.quadrant2LifeChallenges.map((c) => (
                      <TabsTrigger key={c.id} value={String(c.id)} className="portrait-detail-page__tabs-trigger">
                        {c.type}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {portrait.quadrant2LifeChallenges.map((c) => (
                    <TabsContent key={c.id} value={String(c.id)} className="portrait-detail-page__tabs-content">
                      <View className="portrait-detail-page__tabs-inner">
                        {c.name ? <Text className="portrait-detail-page__tabs-inner-title">{c.name}</Text> : null}
                        {c.description ? <Text className="portrait-detail-page__tabs-inner-text">{c.description}</Text> : null}
                        {c.cultivationStrategy ? <Text className="portrait-detail-page__tabs-inner-text portrait-detail-page__tabs-inner-text--bold">{c.cultivationStrategy}</Text> : null}
                        {c.strategy ? <Text className="portrait-detail-page__tabs-inner-text">{c.strategy}</Text> : null}
                        {c.capabilityBuilding ? <Text className="portrait-detail-page__tabs-inner-text">{c.capabilityBuilding}</Text> : null}
                      </View>
                    </TabsContent>
                  ))}
                </Tabs>
              </Section>
            )}
            {portrait.quadrant3Weaknesses && portrait.quadrant3Weaknesses.length > 0 && (
              <Section title="第三象限 · 弱点与应对" hideTitle>
                <Tabs
                  className="portrait-detail-page__tabs"
                  value={quadrant3WeaknessTab || String(portrait.quadrant3Weaknesses[0].id)}
                  onValueChange={setQuadrant3WeaknessTab}
                >
                  <TabsList className="portrait-detail-page__tabs-list">
                    {portrait.quadrant3Weaknesses.map((w) => (
                      <TabsTrigger key={w.id} value={String(w.id)} className="portrait-detail-page__tabs-trigger">
                        {w.type}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {portrait.quadrant3Weaknesses.map((w) => (
                    <TabsContent key={w.id} value={String(w.id)} className="portrait-detail-page__tabs-content">
                      <View className="portrait-detail-page__tabs-inner">
                        {w.name ? <Text className="portrait-detail-page__tabs-inner-title">{w.name}</Text> : null}
                        {w.description ? <Text className="portrait-detail-page__tabs-inner-text">{w.description}</Text> : null}
                        {w.cultivationStrategy ? <Text className="portrait-detail-page__tabs-inner-text portrait-detail-page__tabs-inner-text--bold">{w.cultivationStrategy}</Text> : null}
                        {w.strategy ? <Text className="portrait-detail-page__tabs-inner-text">{w.strategy}</Text> : null}
                        {w.capabilityBuilding ? <Text className="portrait-detail-page__tabs-inner-text">{w.capabilityBuilding}</Text> : null}
                      </View>
                    </TabsContent>
                  ))}
                </Tabs>
              </Section>
            )}
          </View>
        )}

        {/* 第三块：你的独特价值生态位 */}
        {portrait.quadrant1Niches && portrait.quadrant1Niches.length > 0 && (
          <View className="portrait-detail-page__chunk portrait-detail-page__chunk--3">
            <Section
              title="你的独特价值生态位"
              description={
                portrait.partTwoDescription ? (
                  <Text className="portrait-detail-page__section-desc-text portrait-detail-page__section-desc-text--small">{portrait.partTwoDescription}</Text>
                ) : undefined
              }
            >
              <Tabs className="portrait-detail-page__tabs" value={nicheTab} onValueChange={setNicheTab}>
                <TabsList className="portrait-detail-page__tabs-list">
                  {portrait.quadrant1Niches.map((n, i) => (
                    <TabsTrigger key={n.id} value={String(i)} className="portrait-detail-page__tabs-trigger">
                      生态位{toChineseOrdinal(i + 1)}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {portrait.quadrant1Niches.map((n, i) => (
                  <TabsContent key={n.id} value={String(i)} className="portrait-detail-page__tabs-content">
                    <View className="portrait-detail-page__tabs-inner">
                      {n.title ? <Text className="portrait-detail-page__tabs-inner-title">{n.title}</Text> : null}
                      {n.description ? <Text className="portrait-detail-page__tabs-inner-text">{n.description}</Text> : null}
                      {n.possibleRoles ? (
                        <View className="portrait-detail-page__tabs-inner-block">
                          <Text className="portrait-detail-page__tabs-inner-label">可能的角色</Text>
                          <Text className="portrait-detail-page__tabs-inner-text">{n.possibleRoles}</Text>
                        </View>
                      ) : null}
                      {n.explorationSuggestions ? (
                        <View className="portrait-detail-page__tabs-inner-block">
                          <Text className="portrait-detail-page__tabs-inner-label">微型创造</Text>
                          <Text className="portrait-detail-page__tabs-inner-text">{n.explorationSuggestions}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TabsContent>
                ))}
              </Tabs>
            </Section>
          </View>
        )}


        {portrait.quadrant4GrowthPaths && portrait.quadrant4GrowthPaths.length > 0 && (
          <View className="portrait-detail-page__chunk portrait-detail-page__chunk--q4">
            <Section title="成长路径">
              <Tabs className="portrait-detail-page__tabs" value={quadrant4GrowthTab} onValueChange={setQuadrant4GrowthTab}>
                <TabsList className="portrait-detail-page__tabs-list">
                  {portrait.quadrant4GrowthPaths.map((g, i) => (
                    <TabsTrigger key={g.id} value={String(i)} className="portrait-detail-page__tabs-trigger">
                      路径{toChineseOrdinal(i + 1)}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {portrait.quadrant4GrowthPaths.map((g, i) => (
                  <TabsContent key={g.id} value={String(i)} className="portrait-detail-page__tabs-content">
                    <View className="portrait-detail-page__tabs-inner">
                      {g.title ? <Text className="portrait-detail-page__tabs-inner-title">{g.title}</Text> : null}
                      {g.description ? <Text className="portrait-detail-page__tabs-inner-text">{g.description}</Text> : null}
                      {g.possibleRoles ? (
                        <View className="portrait-detail-page__tabs-inner-block">
                          <Text className="portrait-detail-page__tabs-inner-label">可能的角色</Text>
                          <Text className="portrait-detail-page__tabs-inner-text">{g.possibleRoles}</Text>
                        </View>
                      ) : null}
                      {g.explorationSuggestions ? (
                        <View className="portrait-detail-page__tabs-inner-block">
                          <Text className="portrait-detail-page__tabs-inner-label">微型创造</Text>
                          <Text className="portrait-detail-page__tabs-inner-text">{g.explorationSuggestions}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TabsContent>
                ))}
              </Tabs>
            </Section>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
