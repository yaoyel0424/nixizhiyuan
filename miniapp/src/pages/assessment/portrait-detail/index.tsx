/**
 * 画像详情页：展示单个画像的完整内容（从「我的画像」词云点击跳转）
 */
import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Portrait } from '@/services/portraits'
import './index.less'

const PORTRAIT_STORAGE_KEY = 'portraitDetail'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="portrait-detail-page__section">
      <Text className="portrait-detail-page__section-title">{title}</Text>
      <View className="portrait-detail-page__section-body">{children}</View>
    </View>
  )
}

function Block({ label, value }: { label: string; value?: string | null }) {
  if (value == null || String(value).trim() === '') return null
  return (
    <View className="portrait-detail-page__block">
      <Text className="portrait-detail-page__block-label">{label}</Text>
      <Text className="portrait-detail-page__block-value">{value}</Text>
    </View>
  )
}

export default function PortraitDetailPage() {
  const [portrait, setPortrait] = useState<Portrait | null>(null)

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
            {portrait.quadrant.name} · {portrait.quadrant.title}
          </Text>
        )}
      </View>

      <ScrollView className="portrait-detail-page__body" scrollY>
        {(portrait.status || portrait.partOneDescription) && (
          <Section title="画像概述">
            {portrait.status && <Block label="状态描述" value={portrait.status} />}
            {portrait.partOneMainTitle && <Block label="主标题" value={portrait.partOneMainTitle} />}
            {portrait.partOneSubTitle && <Block label="副标题" value={portrait.partOneSubTitle} />}
            <Block label="第一部分描述" value={portrait.partOneDescription} />
            <Block label="第二部分描述" value={portrait.partTwoDescription} />
          </Section>
        )}

        <Section title="元素">
          <Block label="喜欢元素" value={portrait.likeElement?.name} />
          <Block label="天赋元素" value={portrait.talentElement?.name} />
        </Section>

        {portrait.quadrant1Challenges && portrait.quadrant1Challenges.length > 0 && (
          <Section title="第一象限 · 挑战（双刃剑与应对）">
            {portrait.quadrant1Challenges.map((c) => (
              <View key={c.id} className="portrait-detail-page__card">
                <Text className="portrait-detail-page__card-title">{c.name}</Text>
                <Text className="portrait-detail-page__card-meta">类型：{c.type}</Text>
                <Block label="描述" value={c.description} />
                <Block label="培养策略" value={c.cultivationStrategy} />
                <Block label="即时策略" value={c.strategy} />
                <Block label="能力建设" value={c.capabilityBuilding} />
              </View>
            ))}
          </Section>
        )}
        {portrait.quadrant1Niches && portrait.quadrant1Niches.length > 0 && (
          <Section title="第一象限 · 生态位">
            {portrait.quadrant1Niches.map((n) => (
              <View key={n.id} className="portrait-detail-page__card">
                <Text className="portrait-detail-page__card-title">{n.title}</Text>
                <Block label="描述" value={n.description} />
                <Block label="可能的角色" value={n.possibleRoles} />
                <Block label="探索建议" value={n.explorationSuggestions} />
              </View>
            ))}
          </Section>
        )}

        {portrait.quadrant2LifeChallenges && portrait.quadrant2LifeChallenges.length > 0 && (
          <Section title="第二象限 · 生活挑战">
            {portrait.quadrant2LifeChallenges.map((c) => (
              <View key={c.id} className="portrait-detail-page__card">
                <Text className="portrait-detail-page__card-title">{c.name}</Text>
                <Text className="portrait-detail-page__card-meta">类型：{c.type}</Text>
                <Block label="描述" value={c.description} />
                <Block label="培养策略" value={c.cultivationStrategy} />
                <Block label="即时策略" value={c.strategy} />
                <Block label="能力建设" value={c.capabilityBuilding} />
              </View>
            ))}
          </Section>
        )}
        {portrait.quadrant2FeasibilityStudies && portrait.quadrant2FeasibilityStudies.length > 0 && (
          <Section title="第二象限 · 可行性研究">
            {portrait.quadrant2FeasibilityStudies.map((s) => (
              <View key={s.id} className="portrait-detail-page__card">
                <Text className="portrait-detail-page__card-title">{s.title}</Text>
                <Block label="天赋价值" value={s.talentValue} />
                <Block label="探索参考" value={s.exploratoryReference} />
                <Block label="场景设置" value={s.sceneSetting} />
              </View>
            ))}
          </Section>
        )}

        {portrait.quadrant3Weaknesses && portrait.quadrant3Weaknesses.length > 0 && (
          <Section title="第三象限 · 弱点与应对">
            {portrait.quadrant3Weaknesses.map((w) => (
              <View key={w.id} className="portrait-detail-page__card">
                <Text className="portrait-detail-page__card-title">{w.name}</Text>
                <Text className="portrait-detail-page__card-meta">类型：{w.type}</Text>
                <Block label="描述" value={w.description} />
                <Block label="培养策略" value={w.cultivationStrategy} />
                <Block label="即时策略" value={w.strategy} />
                <Block label="能力建设" value={w.capabilityBuilding} />
              </View>
            ))}
          </Section>
        )}
        {portrait.quadrant3Compensations && portrait.quadrant3Compensations.length > 0 && (
          <Section title="第三象限 · 补偿策略">
            {portrait.quadrant3Compensations.map((c) => (
              <View key={c.id} className="portrait-detail-page__card">
                <Text className="portrait-detail-page__card-title">{c.name}</Text>
                <Block label="描述" value={c.description} />
              </View>
            ))}
          </Section>
        )}

        {portrait.quadrant4Dilemmas && portrait.quadrant4Dilemmas.length > 0 && (
          <Section title="第四象限 · 困境与应对">
            {portrait.quadrant4Dilemmas.map((d) => (
              <View key={d.id} className="portrait-detail-page__card">
                <Text className="portrait-detail-page__card-title">{d.name}</Text>
                <Text className="portrait-detail-page__card-meta">类型：{d.type}</Text>
                <Block label="描述" value={d.description} />
                <Block label="培养策略" value={d.cultivationStrategy} />
                <Block label="具体策略" value={d.strategy} />
                <Block label="能力建设" value={d.capabilityBuilding} />
              </View>
            ))}
          </Section>
        )}
        {portrait.quadrant4GrowthPaths && portrait.quadrant4GrowthPaths.length > 0 && (
          <Section title="第四象限 · 成长路径">
            {portrait.quadrant4GrowthPaths.map((g) => (
              <View key={g.id} className="portrait-detail-page__card">
                <Text className="portrait-detail-page__card-title">{g.title}</Text>
                <Block label="描述" value={g.description} />
                <Block label="可能的角色" value={g.possibleRoles} />
                <Block label="探索建议" value={g.explorationSuggestions} />
              </View>
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  )
}
