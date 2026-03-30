// 深度探索页面
import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/Collapsible'
import { BottomNav } from '@/components/BottomNav'
import { QuestionnaireRequiredModal } from '@/components/QuestionnaireRequiredModal'
import { useQuestionnaireCheck } from '@/hooks/useQuestionnaireCheck'
import { getMajorDetailByCode, getPopularMajorDetailByCode, unfavoriteMajor } from '@/services/majors'
import { getScalesByElementId, getScalesByElementIdForPopularMajor } from '@/services/scales'
import { MajorDetailInfo } from '@/types/api'
import { Scale, ScaleAnswer } from '@/types/api'
import './index.less'

const STORAGE_KEY = 'questionnaire_answers'

// 元素分析类型配置（与专业详情页一致，含 desc）
const ELEMENT_ANALYSIS_TYPES = {
  lexue: { label: '乐学', desc: '始终保有学习动力', color: '#4CAF50' },
  shanxue: { label: '善学', desc: '学习更轻松高效', color: '#2196F3' },
  yanxue: { label: '厌学', desc: '学习动力逐步衰减', color: '#FF9800' },
  tiaozhan: { label: '阻学', desc: '学习效率持续损耗', color: '#F44336' },
} as const

// 状态条颜色：乐学/善学 4-6 绿、-4～-6 黄；厌学/阻学 相反
const SCORE_BAR_GREEN = '#4CAF50'
const SCORE_BAR_YELLOW = '#FFC107'

/** 根据类型返回「学习动力」或「学习效率」及是否为正向维度（乐学/善学为正，厌学/阻学为反） */
function getScoreBarConfig(type: string | null): { label: string; isPositive: boolean } {
  if (type === 'lexue' || type === 'yanxue') return { label: '学习动力', isPositive: type === 'lexue' }
  if (type === 'shanxue' || type === 'tiaozhan') return { label: '学习效率', isPositive: type === 'shanxue' }
  return { label: '学习动力', isPositive: true }
}

// 字段标签映射（与专业详情页一致）
const FIELD_LABELS: Record<string, string> = {
  educationLevel: '学历',
  studyPeriod: '学制',
  awardedDegree: '学位',
} as const

const INLINE_FIELDS = ['educationLevel', 'studyPeriod', 'awardedDegree'] as const

// 学历转换映射（与专业详情页一致）
const EDUCATION_LEVEL_MAP: Record<string, string> = {
  ben: '本科',
  gao_ben: '本科(职业)',
  zhuan: '专科',
}

/**
 * 转换学历字段
 */
function formatEducationLevel(value: string): string {
  return EDUCATION_LEVEL_MAP[value] || value
}

/**
 * 内联字段显示组件（与专业详情页一致）
 */
function InlineFieldsDisplay({ data }: { data: Record<string, any> }) {
  const inlineData = INLINE_FIELDS
    .filter((key) => data[key] !== undefined && data[key] !== null)
    .map((key) => {
      let value = data[key]
      // 转换学历字段
      if (key === 'educationLevel' && typeof value === 'string') {
        value = formatEducationLevel(value)
      }
      return {
        key,
        value,
        label: FIELD_LABELS[key] || String(key),
      }
    })

  if (inlineData.length === 0) return null

  return (
    <View className="single-major-page__inline-fields">
      {inlineData.map(({ key, value, label }) => (
        <View key={String(key)} className="single-major-page__inline-field">
          <Text className="single-major-page__inline-field-label">{label}:</Text>
          <Text className="single-major-page__inline-field-value">{String(value)}</Text>
        </View>
      ))}
    </View>
  )
}

// 学习内容显示组件（与专业详情页一致，支持展开/收起）
function StudyContentDisplay({ value }: { value: any }) {
  const [expanded, setExpanded] = useState(false)

  if (!value) {
    return (
      <View className="single-major-page__empty-text">
        <Text>无数据</Text>
      </View>
    )
  }

  // 解析数据
  let parsedData: any = null
  if (typeof value === 'string') {
    try {
      parsedData = JSON.parse(value)
    } catch {
      // 如果不是 JSON，直接作为文本显示
      parsedData = value
    }
  } else if (typeof value === 'object') {
    parsedData = value
  } else {
    parsedData = String(value)
  }

  // 如果是对象，格式化显示
  if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
    return (
      <View className="single-major-page__study-content">
        <View
          className={`single-major-page__study-content-text ${expanded ? 'single-major-page__study-content-text--expanded' : ''}`}
        >
          {/* 专业基础课 */}
          {parsedData.专业基础课 && Array.isArray(parsedData.专业基础课) && parsedData.专业基础课.length > 0 && (
            <View className="single-major-page__study-content-section">
              <Text className="single-major-page__study-content-section-title">专业基础课</Text>
              <View className="single-major-page__study-content-list">
                {parsedData.专业基础课.map((item: string, index: number) => (
                  <View key={index} className="single-major-page__study-content-item">
                    <Text className="single-major-page__study-content-bullet">•</Text>
                    <Text className="single-major-page__study-content-item-text">{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 专业核心课 */}
          {parsedData.专业核心课 && Array.isArray(parsedData.专业核心课) && parsedData.专业核心课.length > 0 && (
            <View className="single-major-page__study-content-section">
              <Text className="single-major-page__study-content-section-title">专业核心课</Text>
              <View className="single-major-page__study-content-list">
                {parsedData.专业核心课.map((item: string, index: number) => (
                  <View key={index} className="single-major-page__study-content-item">
                    <Text className="single-major-page__study-content-bullet">•</Text>
                    <Text className="single-major-page__study-content-item-text">{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 核心实训 */}
          {parsedData.核心实训 && Array.isArray(parsedData.核心实训) && parsedData.核心实训.length > 0 && (
            <View className="single-major-page__study-content-section">
              <Text className="single-major-page__study-content-section-title">核心实训</Text>
              <View className="single-major-page__study-content-list">
                {parsedData.核心实训.map((item: string, index: number) => (
                  <View key={index} className="single-major-page__study-content-item">
                    <Text className="single-major-page__study-content-bullet">•</Text>
                    <Text className="single-major-page__study-content-item-text">{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 一句话总结 */}
          {parsedData.一句话总结 && (
            <View className="single-major-page__study-content-section">
              <Text className="single-major-page__study-content-section-title">一句话总结</Text>
              <Text className="single-major-page__study-content-summary">{parsedData.一句话总结}</Text>
            </View>
          )}
        </View>
        <View
          className="single-major-page__study-content-toggle"
          onClick={() => setExpanded(!expanded)}
        >
          <Text className="single-major-page__study-content-toggle-text">
            {expanded ? '收起' : '展开'}
          </Text>
          <Text
            className={`single-major-page__study-content-toggle-icon ${expanded ? 'single-major-page__study-content-toggle-icon--expanded' : ''}`}
          >
            ▼
          </Text>
        </View>
      </View>
    )
  }

  // 如果是字符串或其他类型，直接显示
  const contentText = typeof parsedData === 'string' ? parsedData : String(parsedData)
  return (
    <View className="single-major-page__study-content">
      <View
        className={`single-major-page__study-content-text ${expanded ? 'single-major-page__study-content-text--expanded' : ''}`}
      >
        <Text className="single-major-page__text-content">{contentText}</Text>
      </View>
      <View
        className="single-major-page__study-content-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <Text className="single-major-page__study-content-toggle-text">
          {expanded ? '收起' : '展开'}
        </Text>
        <Text
          className={`single-major-page__study-content-toggle-icon ${expanded ? 'single-major-page__study-content-toggle-icon--expanded' : ''}`}
        >
          ▼
        </Text>
      </View>
    </View>
  )
}

// 解析数据字段（可能是 JSON 字符串）
function parseDataField(field: any): any {
  if (!field) return null
  if (typeof field === 'object' && !Array.isArray(field)) return field
  if (typeof field === 'string') {
    // 如果是 JSON 字符串，尝试解析
    const trimmed = field.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed)
      } catch (e) {
        // 解析失败，返回原字符串
        return field
      }
    }
    return field
  }
  return field
}

/**
 * 将职业发展相关字段转换成可展示的文本
 * - 字符串：去空格后返回
 * - 数组：递归展开并用“、”拼接
 * - 对象：尝试提取可读内容；无内容返回空字符串
 */
function formatCareerText(value: any): string {
  if (value === null || value === undefined) return ''
  const parsed = parseDataField(value)
  if (parsed === null || parsed === undefined) return ''

  if (typeof parsed === 'string') return parsed.trim()
  if (typeof parsed === 'number' || typeof parsed === 'boolean') return String(parsed)

  if (Array.isArray(parsed)) {
    return parsed
      .map((v) => formatCareerText(v))
      .map((s) => s.trim())
      .filter(Boolean)
      .join('、')
  }

  if (typeof parsed === 'object') {
    const entries = Object.entries(parsed)
      .map(([k, v]) => {
        const text = formatCareerText(v)
        if (!text) return ''
        return `${k}：${text}`
      })
      .filter(Boolean)

    return entries.join('；')
  }

  return String(parsed).trim()
}

// 获取分析数量
function getAnalysisCounts(analyses: any[]) {
  let positiveCount = 0
  let negativeCount = 0
  if (Array.isArray(analyses)) {
    analyses.forEach((a) => {
      if (a && a.type) {
        if (a.type === 'shanxue' || a.type === 'lexue') {
          positiveCount++
        } else if (a.type === 'tiaozhan' || a.type === 'yanxue') {
          negativeCount++
        }
      }
    })
  }
  return { positiveCount, negativeCount }
}

/**
 * 元素类型统计 + 点击切换（与专业详情页一致）
 */
function ElementAnalysesDisplay({
  analyses,
  majorName,
  onToggleType,
  expandedType,
}: {
  analyses: any[] | null | undefined
  majorName: string
  onToggleType: (type: string, analyses: any[], majorName: string) => void
  expandedType: string | null
}) {
  if (!analyses || analyses.length === 0) {
    return null
  }

  // 按类型统计元素数量（兼容两种结构：analysis.elements / analysis.element）
  const typeCounts = analyses.reduce((acc, analysis) => {
    const type = analysis.type
    if (type && (type === 'lexue' || type === 'shanxue' || type === 'yanxue' || type === 'tiaozhan')) {
      if (analysis.elements && Array.isArray(analysis.elements)) {
        acc[type] = analysis.elements.length
      } else if (analysis.element) {
        acc[type] = (acc[type] || 0) + 1
      } else {
        acc[type] = 0
      }
    }
    return acc
  }, {} as Record<string, number>)

  const handleClick = (type: string, e?: any) => {
    if (e) {
      e.stopPropagation()
    }
    onToggleType(type, analyses, majorName)
  }

  return (
    <View className="single-major-page__element-analysis-types">
      {Object.entries(ELEMENT_ANALYSIS_TYPES).map(([type, config]) => {
        const count = typeCounts[type] || 0
        return (
          <View
            key={type}
            className={`single-major-page__element-analysis-item ${expandedType === type ? 'single-major-page__element-analysis-item--active' : ''}`}
            onClick={(e) => handleClick(type, e)}
          >
            <View className="single-major-page__element-analysis-info">
              <Text className="single-major-page__element-analysis-label">{config.label}</Text>
              <Text className="single-major-page__element-analysis-count">{count}项</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

// 条目卡片组件
function ItemCard({ item, type }: { item: any; type: 'positive' | 'negative' }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isPositive = type === 'positive'

  return (
    <View className={`career-exploration-page__item-card career-exploration-page__item-card--${type}`}>
      <View
        className="career-exploration-page__item-card-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <View className="career-exploration-page__item-card-content">
          <Text className="career-exploration-page__item-card-name">
            {item.element?.name || '未命名'}
          </Text>
          {item.summary && (
            <Text className="career-exploration-page__item-card-summary">
              {item.summary}
            </Text>
          )}
        </View>
        <View className="career-exploration-page__item-card-icons">
          <Text className={`career-exploration-page__item-card-icon ${isPositive ? 'career-exploration-page__item-card-icon--positive' : 'career-exploration-page__item-card-icon--negative'}`}>
            {isPositive ? '✓' : '⚠'}
          </Text>
          <Text className="career-exploration-page__item-card-arrow">
            {isExpanded ? '▲' : '▼'}
          </Text>
        </View>
      </View>
      {isExpanded && (
        <View className="career-exploration-page__item-card-expanded">
          {item.matchReason && (
            <View className="career-exploration-page__item-card-field">
              <Text className="career-exploration-page__item-card-field-label">匹配原因</Text>
              <Text className="career-exploration-page__item-card-field-value">{item.matchReason}</Text>
            </View>
          )}
          {item.element?.status && (
            <View className="career-exploration-page__item-card-field">
              <Text className="career-exploration-page__item-card-field-label">状态</Text>
              <Text className="career-exploration-page__item-card-field-value">{item.element.status}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

// 天赋匹配度详细分析显示组件（简化版）
function MajorElementAnalysesDisplay({ analyses }: { analyses: any[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  if (!Array.isArray(analyses) || analyses.length === 0) {
    return (
      <View className="career-exploration-page__empty-text">
        <Text>无数据</Text>
      </View>
    )
  }

  const grouped = analyses.reduce(
    (acc, analysis, index) => {
      const type = analysis.type || '未分类'

      if (type === 'lexue' || type === 'shanxue') {
        if (!acc['积极助力']) {
          acc['积极助力'] = []
        }
        acc['积极助力'].push({ ...analysis, originalIndex: index })
      } else if (type === 'tiaozhan' || type === 'yanxue') {
        if (!acc['潜在挑战']) {
          acc['潜在挑战'] = []
        }
        acc['潜在挑战'].push({ ...analysis, originalIndex: index })
      } else {
        if (!acc[type]) {
          acc[type] = []
        }
        acc[type].push({ ...analysis, originalIndex: index })
      }

      return acc
    },
    {} as Record<string, any[]>,
  )

  const sortedTypes = Object.keys(grouped).sort()

  return (
    <View className="career-exploration-page__element-analyses">
      {sortedTypes.map((type) => {
        const items = grouped[type]
        const isChallengeType = type === '潜在挑战'
        const isPositiveType = type === '积极助力'

        let typeIcon = '⚡'
        let typeColor = '#666'
        let typeBg = 'rgba(156, 163, 175, 0.1)'

        if (isPositiveType) {
          typeIcon = '📈'
          typeColor = '#22c55e'
          typeBg = 'rgba(34, 197, 94, 0.1)'
        } else if (isChallengeType) {
          typeIcon = '⚠️'
          typeColor = '#ef4444'
          typeBg = 'rgba(239, 68, 68, 0.1)'
        }

        return (
          <View key={type} className="career-exploration-page__element-analyses-group">
            <View className="career-exploration-page__element-analyses-group-header" style={{ background: typeBg }}>
              <View className="career-exploration-page__element-analyses-group-icon" style={{ color: typeColor }}>
                <Text>{typeIcon}</Text>
              </View>
              <Text className="career-exploration-page__element-analyses-group-title" style={{ color: typeColor }}>
                {type}
              </Text>
            </View>
            <View className="career-exploration-page__element-analyses-group-content">
              {items.map((item: any) => {
                const isExpanded = expandedIndex === item.originalIndex

                return (
                  <View key={item.originalIndex} className="career-exploration-page__element-analyses-item">
                    <View
                      className={`career-exploration-page__element-analyses-item-trigger ${isExpanded ? 'career-exploration-page__element-analyses-item-trigger--expanded' : ''}`}
                      onClick={() => {
                        setExpandedIndex(isExpanded ? null : item.originalIndex)
                      }}
                    >
                      <Text className="career-exploration-page__element-analyses-item-name">
                        {item.element?.name || '未命名'}
                      </Text>
                      <Text className={`career-exploration-page__element-analyses-item-arrow ${isExpanded ? 'career-exploration-page__element-analyses-item-arrow--expanded' : ''}`}>
                        ▼
                      </Text>
                    </View>
                    {isExpanded && (
                      <View className="career-exploration-page__element-analyses-item-content">
                        {item.summary && (
                          <View className="career-exploration-page__element-analyses-item-field">
                            <Text className="career-exploration-page__element-analyses-item-field-label">摘要</Text>
                            <Text className="career-exploration-page__element-analyses-item-field-value">{item.summary}</Text>
                          </View>
                        )}
                        {item.matchReason && (
                          <View className="career-exploration-page__element-analyses-item-field">
                            <Text className="career-exploration-page__element-analyses-item-field-label">匹配原因</Text>
                            <Text className="career-exploration-page__element-analyses-item-field-value">{item.matchReason}</Text>
                          </View>
                        )}
                        {item.element?.status && (
                          <View className="career-exploration-page__element-analyses-item-field">
                            <Text className="career-exploration-page__element-analyses-item-field-label">状态</Text>
                            <Text className="career-exploration-page__element-analyses-item-field-value">{item.element.status}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          </View>
        )
      })}
    </View>
  )
}

// 产业前景卡片组件
function IndustryProspectsCard({ data, tag }: { data: any; tag?: string }) {
  // 解析数据（可能是 JSON 字符串）
  const parsedData = parseDataField(data)
  const displayData = typeof parsedData === 'object' && parsedData !== null ? parsedData : { 行业前景: parsedData }
  const risks = typeof displayData !== 'string' ? parseDataField(displayData.趋势性风险) : null
  const riskObj = typeof risks === 'object' && risks !== null ? risks : null
  const industryText = typeof displayData === 'object' && displayData !== null
    ? formatCareerText((displayData as any).行业前景)
    : formatCareerText(displayData)

  return (
    <View>
      <View className="career-exploration-page__opportunity-header-row">
        <View className="career-exploration-page__opportunity-header">
          <Text className="career-exploration-page__opportunity-label">产业前景：</Text>
          {tag && (
            <View className="career-exploration-page__opportunity-tag career-exploration-page__opportunity-tag--purple">
              <Text>{tag}</Text>
            </View>
          )}
        </View>
      </View>
      <View className="career-exploration-page__opportunity-content-inner">
        {(industryText || riskObj) ? (
          <View className="career-exploration-page__opportunity-details">
            {industryText && (
              <Text className="career-exploration-page__career-line">{industryText}</Text>
            )}

            {riskObj && (
              <View
                className={`career-exploration-page__opportunity-risks ${industryText ? 'career-exploration-page__opportunity-risks--with-divider' : ''}`}
              >
                <Text className="career-exploration-page__opportunity-risks-title">趋势性风险:</Text>
                {Object.entries(riskObj).map(([key, value]) => (
                  <View key={key} className="career-exploration-page__opportunity-risk-item">
                    <Text className="career-exploration-page__opportunity-risk-key">{key}:</Text>
                    <Text className="career-exploration-page__opportunity-risk-value">
                      {formatCareerText(value) || String(value)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View className="career-exploration-page__career-empty" />
        )}
      </View>
    </View>
  )
}

// 职业回报卡片组件
function CareerDevelopmentCard({ data, tag }: { data: any; tag?: string }) {
  // 解析数据（可能是 JSON 字符串）
  const parsedData = parseDataField(data)
  const displayData = typeof parsedData === 'object' && parsedData !== null ? parsedData : { 职业回报: parsedData }
  const salaryRef = typeof displayData === 'object' && displayData !== null ? parseDataField(displayData.薪酬水平参考) : null
  const salaryObj = typeof salaryRef === 'object' && salaryRef !== null ? salaryRef : null
  const salaryLines: string[] = []
  if (salaryObj) {
    const startSalary = formatCareerText((salaryObj as any).起薪区间)
    const midSalary = formatCareerText((salaryObj as any)['3-5年薪资区间'])
    if (startSalary) salaryLines.push(startSalary)
    if (midSalary) salaryLines.push(midSalary)
  }

  return (
    <View>
      <View className="career-exploration-page__opportunity-header-row">
        <View className="career-exploration-page__opportunity-header">
          <Text className="career-exploration-page__opportunity-label">职业回报：</Text>
          {tag && (
            <View className="career-exploration-page__opportunity-tag career-exploration-page__opportunity-tag--orange">
              <Text>{tag}</Text>
            </View>
          )}
        </View>
      </View>
      <View className="career-exploration-page__opportunity-content-inner">
        {salaryLines.length > 0 ? (
          <View className="career-exploration-page__opportunity-details">
            {salaryLines.map((line, idx) => (
              <Text key={idx} className="career-exploration-page__career-line">{line}</Text>
            ))}
          </View>
        ) : (
          <View className="career-exploration-page__career-empty" />
        )}
      </View>
    </View>
  )
}

// 成长空间卡片组件
function GrowthPotentialCard({ data, tag }: { data: any; tag?: string }) {
  // 解析数据（可能是 JSON 字符串）
  const parsedData = parseDataField(data)
  const displayData = typeof parsedData === 'object' && parsedData !== null ? parsedData : { 成长空间: parsedData }
  const envText = typeof displayData === 'object' && displayData !== null ? formatCareerText(displayData.工作环境提示) : ''
  const devText = typeof displayData === 'object' && displayData !== null ? formatCareerText(displayData.横向发展可能) : ''

  return (
    <View>
      <View className="career-exploration-page__opportunity-header-row">
        <View className="career-exploration-page__opportunity-header">
          <Text className="career-exploration-page__opportunity-label">成长空间：</Text>
          {tag && (
            <View className="career-exploration-page__opportunity-tag career-exploration-page__opportunity-tag--green">
              <Text>{tag}</Text>
            </View>
          )}
        </View>
      </View>
      <View className="career-exploration-page__opportunity-content-inner">
        {envText || devText ? (
          <View className="career-exploration-page__opportunity-details">
            {envText && (
              <Text className="career-exploration-page__career-line">{envText}</Text>
            )}
            {devText && (
              <Text className="career-exploration-page__career-line">{devText}</Text>
            )}
          </View>
        ) : (
          <View className="career-exploration-page__career-empty" />
        )}
      </View>
    </View>
  )
}

// 学业发展卡片组件
function AcademicDevelopmentCard({ data, tag }: { data: any; tag?: string }) {
  // 解析数据（可能是 JSON 字符串）
  const parsedData = parseDataField(data)
  const displayData = typeof parsedData === 'object' && parsedData !== null
    ? parsedData
    : { 学业发展: parsedData }
  
  // 过滤掉指数得分和标签相关的内容
  let academicText = formatCareerText(displayData)
  if (academicText) {
    // 按分号分割，过滤掉包含"指数得分"或"标签"的项
    const parts = academicText.split('；').filter(part => {
      const trimmed = part.trim()
      // 过滤掉包含"指数得分"、"标签"、"得分"等关键词的项
      return !trimmed.includes('指数得分') && 
             !trimmed.includes('标签') && 
             !trimmed.match(/得分[：:]/) &&
             !trimmed.match(/标签[：:]/)
    })
    academicText = parts.join('；')
  }

  return (
    <View>
      <View className="career-exploration-page__opportunity-header-row">
        <View className="career-exploration-page__opportunity-header">
          <Text className="career-exploration-page__opportunity-label">学业发展：</Text>
          {tag && (
            <View className="career-exploration-page__opportunity-tag career-exploration-page__opportunity-tag--blue">
              <Text>{tag}</Text>
            </View>
          )}
        </View>
      </View>
      <View className="career-exploration-page__opportunity-content-inner">
        {academicText ? (
          <View className="career-exploration-page__opportunity-details">
            <Text className="career-exploration-page__career-line">{academicText}</Text>
          </View>
        ) : (
          <View className="career-exploration-page__career-empty" />
        )}
      </View>
    </View>
  )
}

// 喜欢与天赋概览组件（与专业详情页一致）
function MajorAnalysisActionCard({
  analyses,
  majorName,
  isFromPopularMajors = false,
  popularMajorId = null,
}: {
  analyses: any[]
  majorName: string
  isFromPopularMajors?: boolean
  popularMajorId?: number | null
}) {
  const { positiveCount, negativeCount } = getAnalysisCounts(analyses)
  const totalCount = positiveCount + negativeCount
  const [expandedElementType, setExpandedElementType] = useState<string | null>(null)
  const [expandedElementMajorName, setExpandedElementMajorName] = useState<string>('')
  const [expandedElementAnalyses, setExpandedElementAnalyses] = useState<any[] | null>(null)
  const hasAutoExpandedRef = useRef(false)
  const [expandedQuestionnaireElementIds, setExpandedQuestionnaireElementIds] = useState<Set<number>>(
    new Set(),
  )
  const [questionnaireLoadingElementIds, setQuestionnaireLoadingElementIds] = useState<Set<number>>(
    new Set(),
  )
  const [questionnaireErrorByElementId, setQuestionnaireErrorByElementId] = useState<Record<number, string>>(
    {},
  )
  const [questionnaireCacheByElementId, setQuestionnaireCacheByElementId] = useState<
    Record<number, { scales: Scale[]; answers: Array<ScaleAnswer | { scaleId: number; score: number; [key: string]: any }> }>
  >({})

  // 兼容两种数据结构，提取当前类型下的元素列表
  const getElementsByType = (type: string | null, allAnalyses: any[] | null): any[] => {
    if (!type || !allAnalyses) return []
    const elements: any[] = []
    const matchingAnalyses = allAnalyses.filter((a) => a.type === type)
    matchingAnalyses.forEach((analysis) => {
      if (analysis.elements && Array.isArray(analysis.elements)) {
        elements.push(
          ...analysis.elements.map((el: any) => ({
            elementName: el?.elementName || el?.name || el?.element?.name || '未命名',
            elementId: el?.elementId ?? el?.id ?? el?.element?.id ?? null,
            score: el?.score ?? null,
            matchReason: el?.matchReason ?? el?.match_reason ?? analysis.matchReason ?? null,
            // 转化潜力（主要用于厌学/阻学）
            potentialConversionValue:
              el?.potentialConversionValue ?? analysis?.potentialConversionValue ?? null,
            potentialConversionReason:
              el?.potentialConversionReason ?? analysis?.potentialConversionReason ?? null,
          })),
        )
      } else if (analysis.element) {
        elements.push({
          elementName: analysis.element.name || '未命名',
          elementId: analysis.element.id ?? null,
          score: analysis.userElementScore ?? null,
          matchReason: analysis.matchReason ?? null,
          // 转化潜力（主要用于厌学/阻学）
          potentialConversionValue: analysis?.potentialConversionValue ?? null,
          potentialConversionReason: analysis?.potentialConversionReason ?? null,
        })
      }
    })
    return elements
  }

  /**
   * 转化潜力等级映射
   * - high -> 高
   * - medium -> 中
   * - low -> 低
   */
  const getPotentialConversionLabel = (value: any): { level: 'high' | 'medium' | 'low' | 'unknown'; text: string } => {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (raw === 'high') return { level: 'high', text: '高' }
    if (raw === 'medium') return { level: 'medium', text: '中' }
    if (raw === 'low') return { level: 'low', text: '低' }
    if (value === null || value === undefined || raw === '') return { level: 'unknown', text: '' }
    return { level: 'unknown', text: String(value) }
  }

  const handleToggleType = (type: string, allAnalyses: any[], mName: string) => {
    // 用户已交互：不再触发默认展开逻辑
    hasAutoExpandedRef.current = true
    setExpandedElementAnalyses(allAnalyses)
    setExpandedElementMajorName(mName)
    setExpandedElementType((prev) => (prev === type ? null : type))
  }

  const inlineElements = getElementsByType(expandedElementType, expandedElementAnalyses)

  // 默认展开“乐学”，若无数据则按顺序降级
  useEffect(() => {
    if (!analyses || !Array.isArray(analyses) || analyses.length === 0) return
    if (hasAutoExpandedRef.current) return

    const preferredTypes = ['lexue', 'shanxue', 'yanxue', 'tiaozhan']
    const firstAvailable = preferredTypes.find((t) => getElementsByType(t, analyses).length > 0) || 'lexue'

    hasAutoExpandedRef.current = true
    setExpandedElementAnalyses(analyses)
    setExpandedElementMajorName(majorName || '')
    setExpandedElementType(firstAvailable)
  }, [analyses, majorName])
  const reasonKind = expandedElementType === 'yanxue'
    ? 'yanxue'
    : expandedElementType === 'tiaozhan'
      ? 'tiaozhan'
      : 'match'
  const reasonLabel = reasonKind === 'yanxue'
    ? '厌学原因'
    : reasonKind === 'tiaozhan'
      ? '阻学原因'
      : '匹配原因'

  // 获取 element 的问卷与答案（带缓存）
  const fetchElementQuestionnaire = async (elementId: number) => {
    try {
      setQuestionnaireErrorByElementId((prev) => {
        const next = { ...prev }
        delete next[elementId]
        return next
      })
      setQuestionnaireLoadingElementIds((prev) => {
        const next = new Set(prev)
        next.add(elementId)
        return next
      })
      // 根据来源页面决定使用哪个接口
      const res = isFromPopularMajors && popularMajorId !== null
        ? await getScalesByElementIdForPopularMajor(elementId, popularMajorId)
        : await getScalesByElementId(elementId)
      setQuestionnaireCacheByElementId((prev) => ({
        ...prev,
        [elementId]: {
          scales: Array.isArray(res?.scales) ? res.scales : [],
          answers: Array.isArray(res?.answers) ? res.answers : [],
        },
      }))
    } catch (e: any) {
      setQuestionnaireErrorByElementId((prev) => ({
        ...prev,
        [elementId]: e?.message || '获取问卷失败，请稍后重试',
      }))
    } finally {
      setQuestionnaireLoadingElementIds((prev) => {
        const next = new Set(prev)
        next.delete(elementId)
        return next
      })
    }
  }

  // 切换 element 问卷展示
  const toggleElementQuestionnaire = async (elementId: number) => {
    setExpandedQuestionnaireElementIds((prev) => {
      const next = new Set(prev)
      if (next.has(elementId)) next.delete(elementId)
      else next.add(elementId)
      return next
    })
    if (!questionnaireCacheByElementId[elementId] && !questionnaireLoadingElementIds.has(elementId)) {
      await fetchElementQuestionnaire(elementId)
    }
  }

  if (totalCount === 0) {
    return (
      <Card className="single-major-page__analysis-empty-card">
        <View className="single-major-page__analysis-empty-content">
          <Text className="single-major-page__analysis-empty-text">暂无天赋匹配度数据。请先完成问卷。</Text>
          <Button
            onClick={() => {
              Taro.navigateTo({ url: '/pages/assessment/questionnaire/index' })
            }}
            className="single-major-page__analysis-empty-button"
          >
            <Text>🔄 立即进行专业匹配问卷</Text>
          </Button>
        </View>
      </Card>
    )
  }

  return (
    <Card className="single-major-page__analysis-card">
      <View className="single-major-page__analysis-header">
        <Text className="single-major-page__analysis-icon">🧠</Text>
        <Text className="single-major-page__analysis-title">喜欢与天赋概览</Text>
      </View>
      <View className="single-major-page__analysis-content">
        <ElementAnalysesDisplay
          analyses={analyses}
          majorName={majorName || ''}
          onToggleType={handleToggleType}
          expandedType={expandedElementType}
        />

        {expandedElementType && (
          <View className="single-major-page__element-inline">
            <View className="single-major-page__element-inline-header">
              <Text className="single-major-page__element-inline-title">
                {(() => {
                  const key = expandedElementType as keyof typeof ELEMENT_ANALYSIS_TYPES
                  const config = ELEMENT_ANALYSIS_TYPES[key]
                  if (!config) return expandedElementMajorName
                  const label = config.label
                  const desc = 'desc' in config ? config.desc : undefined
                  if (!desc) return `${label} - ${expandedElementMajorName}`
                  return (
                    <>
                      {label}{' '}
                      <Text className="single-major-page__element-inline-title-desc">
                        （{desc}）
                      </Text>
                   
                    </>
                  )
                })()}
              </Text>
              <Text
                className="single-major-page__element-inline-toggle"
                onClick={(e) => {
                  e?.stopPropagation?.()
                  // 用户已交互：不再触发默认展开逻辑
                  hasAutoExpandedRef.current = true
                  setExpandedElementType(null)
                }}
              >
                ▲
              </Text>
            </View>

            {inlineElements.length === 0 ? (
              <View className="single-major-page__element-dialog-empty">
                <Text>暂无数据</Text>
              </View>
            ) : (
              <View className="single-major-page__element-dialog-list">
                {inlineElements.map((element: any, index: number) => {
                  const elementId: number | null = typeof element.elementId === 'number' ? element.elementId : null
                  const { label: scoreBarLabel, isPositive: scoreBarPositive } = getScoreBarConfig(expandedElementType)
                  const numScore = element.score != null ? Math.max(-6, Math.min(6, Number(element.score))) : null
                  // 乐学/善学：正分好，-6→0% 低，6→100% 高；厌学/阻学：负分增强，正分削弱，逻辑相反
                  const rawPercent = numScore != null ? ((numScore + 6) / 12) * 100 : null
                  const markerPercent = rawPercent != null
                    ? (scoreBarPositive ? rawPercent : 100 - rawPercent)
                    : null
                  const barGradient = scoreBarPositive
                    ? `linear-gradient(to right, ${SCORE_BAR_YELLOW} 0%, ${SCORE_BAR_YELLOW} 16.67%, ${SCORE_BAR_GREEN} 83.33%, ${SCORE_BAR_GREEN} 100%)`
                    : `linear-gradient(to right, ${SCORE_BAR_GREEN} 0%, ${SCORE_BAR_GREEN} 16.67%, ${SCORE_BAR_YELLOW} 83.33%, ${SCORE_BAR_YELLOW} 100%)`
                  const isQuestionnaireExpanded = elementId !== null && expandedQuestionnaireElementIds.has(elementId)
                  const isQuestionnaireLoading = elementId !== null && questionnaireLoadingElementIds.has(elementId)
                  const questionnaireError = elementId !== null ? questionnaireErrorByElementId[elementId] : undefined
                  const questionnaireData = elementId !== null ? questionnaireCacheByElementId[elementId] : undefined

                  const answerByScaleId = new Map<number, number>()
                  if (questionnaireData?.answers && Array.isArray(questionnaireData.answers)) {
                    questionnaireData.answers.forEach((a: any) => {
                      // 兼容 ScaleAnswer 和 PopularMajorAnswer 两种类型
                      const scaleId = a?.scaleId ?? a?.scale_id
                      const score = a?.score
                      // 将 score 转换为数字（处理 decimal 类型可能返回字符串的情况）
                      const scoreNum = typeof score === 'number' ? score : (typeof score === 'string' ? parseFloat(score) : null)
                      if (typeof scaleId === 'number' && scoreNum !== null && !isNaN(scoreNum)) {
                        answerByScaleId.set(scaleId, scoreNum)
                      }
                    })
                  }

                  return (
                    <View
                      key={elementId !== null ? `element-${elementId}` : `element-${element.elementName || index}`}
                      className="single-major-page__element-dialog-item"
                    >
                      <Text className="single-major-page__element-dialog-item-name">{element.elementName}</Text>
                      {element.matchReason && (
                        <Text className="single-major-page__element-dialog-item-reason">
                          <Text
                            className={`single-major-page__element-dialog-item-reason-label single-major-page__element-dialog-item-reason-label--${reasonKind}`}
                          >
                            {reasonLabel}：
                          </Text>
                          {element.matchReason}
                        </Text>
                      )}
                      <View className="single-major-page__element-dialog-item-score career-exploration-page__score-result-row">
                        <View className="career-exploration-page__score-result-label-wrap">
                          <Text className="single-major-page__element-dialog-item-score-label">自评结果：</Text>
                        </View>
                        <View className="career-exploration-page__score-bar-wrap">
                          <View className="career-exploration-page__score-bar-inner">
                            <View className="career-exploration-page__score-bar-row">
                              <Text className="career-exploration-page__score-bar-end">
                                减弱
                              </Text>
                              <View className="career-exploration-page__score-bar-track-wrap">
                                {markerPercent != null && (
                                  <View className="career-exploration-page__score-bar-marker-col" style={{ left: `${markerPercent}%` }}>
                                    <Text className="career-exploration-page__score-bar-label">{scoreBarLabel}</Text>
                                    <Text className="career-exploration-page__score-bar-arrow">▼</Text>
                                  </View>
                                )}
                                <View className="career-exploration-page__score-bar-track">
                                  <View
                                    className="career-exploration-page__score-bar-fill"
                                    style={{ background: numScore == null ? '#d1d5db' : barGradient }}
                                  />
                                </View>
                              </View>
                              <Text className="career-exploration-page__score-bar-end">
                               增强 
                              </Text>
                            </View>
                          </View>
                          {numScore == null && (
                            <Text className="career-exploration-page__score-bar-placeholder">待评估</Text>
                          )}
                        </View>
                        {elementId !== null && (
                          <View className="career-exploration-page__score-result-action-wrap">
                            <Text
                              className="single-major-page__element-dialog-item-score-action"
                              onClick={() => toggleElementQuestionnaire(elementId)}
                            >
                              查看问卷
                              <Text className="single-major-page__element-dialog-item-score-action-icon">
                                {isQuestionnaireExpanded ? '▲' : '▼'}
                              </Text>
                            </Text>
                          </View>
                        )}
                      </View>

                      {(() => {
                        // 仅在“厌学/阻学”元素下展示转化潜力（放在“评估结果”下面）
                        const shouldShowConversion = reasonKind === 'yanxue' || reasonKind === 'tiaozhan'
                        if (!shouldShowConversion) return null
                        const { level, text } = getPotentialConversionLabel(element?.potentialConversionValue)
                        const reasonText = element?.potentialConversionReason ? String(element.potentialConversionReason) : ''
                        if (!text && !reasonText) return null

                        return (
                          <View className="single-major-page__element-dialog-item-conversion">
                            {text && (
                              <View className="single-major-page__element-dialog-item-conversion-row">
                                <Text className="single-major-page__element-dialog-item-conversion-label">
                                  转化潜力：
                                </Text>
                                <Text
                                  className={`single-major-page__element-dialog-item-conversion-tag single-major-page__element-dialog-item-conversion-tag--${level}`}
                                >
                                  {text}
                                </Text>
                              </View>
                            )}
                            {reasonText && (
                              <Text className="single-major-page__element-dialog-item-conversion-reason">
                                {reasonText}
                              </Text>
                            )}
                          </View>
                        )
                      })()}

                      {elementId !== null && isQuestionnaireExpanded && (
                        <View className="single-major-page__element-questionnaire">
                          {isQuestionnaireLoading && (
                            <Text className="single-major-page__element-questionnaire-loading">加载中...</Text>
                          )}
                          {!isQuestionnaireLoading && questionnaireError && (
                            <View className="single-major-page__element-questionnaire-error">
                              <Text className="single-major-page__element-questionnaire-error-text">{questionnaireError}</Text>
                              <Text
                                className="single-major-page__element-questionnaire-retry"
                                onClick={() => fetchElementQuestionnaire(elementId)}
                              >
                                点击重试
                              </Text>
                            </View>
                          )}
                          {!isQuestionnaireLoading && !questionnaireError && questionnaireData && (
                            <View className="single-major-page__element-questionnaire-content">
                              {questionnaireData.scales.length === 0 ? (
                                <Text className="single-major-page__element-questionnaire-empty">暂无问卷内容</Text>
                              ) : (
                                questionnaireData.scales.map((scale, scaleIndex) => {
                                  const selectedScore = answerByScaleId.get(scale.id)
                                  const options = Array.isArray(scale.options) ? [...scale.options] : []
                                  options.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                                  return (
                                    <View key={scale.id} className="single-major-page__element-questionnaire-scale">
                                      <Text className="single-major-page__element-questionnaire-scale-content">
                                        {scaleIndex + 1}. {scale.content}
                                      </Text>
                                      <View className="single-major-page__element-questionnaire-options">
                                        {options.map((opt) => {
                                          const isSelected =
                                            typeof selectedScore === 'number' &&
                                            typeof opt.optionValue === 'number' &&
                                            opt.optionValue === selectedScore
                                          return (
                                            <View
                                              key={opt.id}
                                              className={`single-major-page__element-questionnaire-option ${isSelected ? 'single-major-page__element-questionnaire-option--selected' : ''}`}
                                            >
                                              <View className="single-major-page__element-questionnaire-option-header">
                                                <Text className="single-major-page__element-questionnaire-option-name">{opt.optionName}</Text>
                                                {isSelected && (
                                                  <Text className="single-major-page__element-questionnaire-option-badge">你的选择</Text>
                                                )}
                                              </View>
                                              {opt.additionalInfo && String(opt.additionalInfo).trim() && (
                                                <Text className="single-major-page__element-questionnaire-option-info">{opt.additionalInfo}</Text>
                                              )}
                                            </View>
                                          )
                                        })}
                                      </View>
                                    </View>
                                  )
                                })
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}
      </View>
    </Card>
  )
}

// 热爱能量显示组件
function MajorScoreDisplay({ majorData }: { majorData: any }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!majorData || typeof majorData !== 'object') {
    return (
      <View className="career-exploration-page__empty-text">
        <Text>无数据</Text>
      </View>
    )
  }

  return (
    <View className="career-exploration-page__score-display">
      {/* 热爱能量分数 */}
      {majorData.score !== undefined && (
        <View className="career-exploration-page__score-main">
          <Text className="career-exploration-page__score-value">
            {typeof majorData.score === 'string' ? parseFloat(majorData.score).toFixed(2) : majorData.score.toFixed(2)}
          </Text>
          <Text className="career-exploration-page__score-label">热爱能量得分</Text>
        </View>
      )}

      {/* 详细分解 */}
      <View className="career-exploration-page__score-details">
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger
            className="career-exploration-page__score-details-trigger"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Text className="career-exploration-page__score-details-title">详细分解</Text>
            <Text className="career-exploration-page__score-details-arrow">
              {isExpanded ? '▲' : '▼'}
            </Text>
          </CollapsibleTrigger>
          <CollapsibleContent className="career-exploration-page__score-details-content">
            <View className="career-exploration-page__score-details-grid">
              {majorData.lexueScore !== undefined && (
                <View className="career-exploration-page__score-detail-item">
                  <Text className="career-exploration-page__score-detail-label">乐学:</Text>
                  <Text className="career-exploration-page__score-detail-value career-exploration-page__score-detail-value--positive">
                    +{typeof majorData.lexueScore === 'string' ? parseFloat(majorData.lexueScore).toFixed(2) : majorData.lexueScore.toFixed(2)}
                  </Text>
                </View>
              )}
              {majorData.shanxueScore !== undefined && (
                <View className="career-exploration-page__score-detail-item">
                  <Text className="career-exploration-page__score-detail-label">善学:</Text>
                  <Text className="career-exploration-page__score-detail-value career-exploration-page__score-detail-value--positive">
                    +{typeof majorData.shanxueScore === 'string' ? parseFloat(majorData.shanxueScore).toFixed(2) : majorData.shanxueScore.toFixed(2)}
                  </Text>
                </View>
              )}
              {majorData.yanxueDeduction !== undefined && (
                <View className="career-exploration-page__score-detail-item">
                  <Text className="career-exploration-page__score-detail-label">厌学:</Text>
                  <Text className="career-exploration-page__score-detail-value career-exploration-page__score-detail-value--negative">
                    -{typeof majorData.yanxueDeduction === 'string' ? parseFloat(majorData.yanxueDeduction).toFixed(2) : majorData.yanxueDeduction.toFixed(2)}
                  </Text>
                </View>
              )}
              {majorData.tiaozhanDeduction !== undefined && (
                <View className="career-exploration-page__score-detail-item">
                  <Text className="career-exploration-page__score-detail-label">阻学:</Text>
                  <Text className="career-exploration-page__score-detail-value career-exploration-page__score-detail-value--negative">
                    -{typeof majorData.tiaozhanDeduction === 'string' ? parseFloat(majorData.tiaozhanDeduction).toFixed(2) : majorData.tiaozhanDeduction.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          </CollapsibleContent>
        </Collapsible>
      </View>
    </View>
  )
}

export default function CareerExplorationPage() {
  // 检查问卷完成状态
  const { isCompleted: isQuestionnaireCompleted, isLoading: isCheckingQuestionnaire, answerCount } = useQuestionnaireCheck()
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  
  const router = useRouter()
  const majorCode = router.params?.code || ''
  const fromPage = router.params?.from || '' // 获取来源页面参数
  const popularMajorId = router.params?.majorId ? Number(router.params.majorId) : null // 获取热门专业ID
  /** 专业探索/心动专业未缴费时传的 sign，用于详情与取消收藏请求 */
  const signParam = router.params?.sign || null
  const [majorName, setMajorName] = useState('')
  const [loading, setLoading] = useState(true)
  const [majorDetail, setMajorDetail] = useState<MajorDetailInfo | null>(null)
  const [activeTab, setActiveTab] = useState('passion')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  // 学习内容字段兼容：不同接口可能在顶层或 major 内返回
  const studyContentValue =
    (majorDetail as any)?.studyContent ??
    (majorDetail as any)?.major?.studyContent ??
    (majorDetail as any)?.study_content ??
    null
  
  // 判断是否从热门专业页面跳转过来（从热门专业进入不校验 168 题完成）
  const isFromPopularMajors = fromPage === 'popular-majors'

  // 检查问卷完成状态（从热门专业进入时跳过校验）
  useEffect(() => {
    if (isFromPopularMajors) return
    if (!isCheckingQuestionnaire && !isQuestionnaireCompleted) {
      setShowQuestionnaireModal(true)
    }
  }, [isFromPopularMajors, isCheckingQuestionnaire, isQuestionnaireCompleted])

  // 加载专业详情
  useEffect(() => {
    if (!majorCode) {
      Taro.showToast({
        title: '缺少专业代码',
        icon: 'none',
        duration: 2000
      })
      setLoading(false)
      return
    }

    const loadMajorDetail = async () => {
      try {
        setLoading(true)
        // 根据来源页面决定使用哪个接口
        const detail = isFromPopularMajors
          ? await getPopularMajorDetailByCode(majorCode)
          : await getMajorDetailByCode(majorCode, signParam || undefined)
        // API 返回的字段可能是 analyses，统一转换为 majorElementAnalyses
        if (detail && !detail.majorElementAnalyses && (detail as any).analyses) {
          detail.majorElementAnalyses = (detail as any).analyses
        }
        
        // 解析可能以 JSON 字符串形式存储的字段
        if (detail) {
          // 解析产业前景
          if (detail.industryProspects && typeof detail.industryProspects === 'string') {
            detail.industryProspects = parseDataField(detail.industryProspects)
          }
          // 解析职业回报
          if (detail.careerDevelopment && typeof detail.careerDevelopment === 'string') {
            detail.careerDevelopment = parseDataField(detail.careerDevelopment)
          }
          // 解析成长空间
          if (detail.growthPotential && typeof detail.growthPotential === 'string') {
            detail.growthPotential = parseDataField(detail.growthPotential)
          }
          // 解析学业发展
          if ((detail as any).academicDevelopment && typeof (detail as any).academicDevelopment === 'string') {
            ;(detail as any).academicDevelopment = parseDataField((detail as any).academicDevelopment)
          }
        }
        
        setMajorDetail(detail)
        setMajorName(detail.name || detail.code || '')
        
        // 设置页面标题
        if (detail.name || detail.code) {
          Taro.setNavigationBarTitle({
            title: `${detail.name || detail.code}`
          })
        }
      } catch (err: any) {
        console.error('加载专业详情失败:', err)
        Taro.showToast({
          title: err?.message || '加载失败',
          icon: 'none',
          duration: 2000
        })
      } finally {
        setLoading(false)
      }
    }

    loadMajorDetail()
  }, [majorCode, isFromPopularMajors, signParam])

  // 删除心动专业（从收藏中移除）
  const handleDeleteFromFavorites = () => {
    setShowDeleteConfirm(true)
  }

  // 确认删除（未缴费前五条需传 sign）
  const confirmDeleteFromFavorites = async () => {
    try {
      await unfavoriteMajor(majorCode, signParam || undefined)
      Taro.showToast({
        title: '已从心动专业中移除',
        icon: 'success',
        duration: 1500
      })
      setShowDeleteConfirm(false)
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error: any) {
      console.error('删除失败:', error)
      Taro.showToast({
        title: error?.message || '删除失败，请重试',
        icon: 'none',
        duration: 2000
      })
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <View className="career-exploration-page">
        <View className="career-exploration-page__loading">
          <Text>加载中...</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  if (!majorDetail) {
    return (
      <View className="career-exploration-page">
        <View className="career-exploration-page__error">
          <Text className="career-exploration-page__error-title">加载失败</Text>
          <Text className="career-exploration-page__error-message">未找到专业数据</Text>
          <Button
            onClick={() => Taro.navigateBack()}
            className="career-exploration-page__error-button"
          >
            返回
          </Button>
        </View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className="career-exploration-page">
      {/* 内容区域 */}
      <ScrollView className="career-exploration-page__scroll" scrollY>
        <View className="career-exploration-page__content">
          {/* 专业基本信息 */}
          <Card className="career-exploration-page__info-card">
            {majorName && (
              <Text className="single-major-page__major-name">{majorName}</Text>
            )}
            <InlineFieldsDisplay data={majorDetail as any} />
          </Card>

          {/* 快速扫描和核心价值（与专业详情页一致） */}
          {(majorDetail.majorKey || majorDetail.majorBrief) && (
            <View className="single-major-page__value-cards">
              {majorDetail.majorKey && (
                <Card className="single-major-page__value-card">
                  <View className="single-major-page__value-card-header">
                    <Text className="single-major-page__value-card-icon">🧠</Text>
                    <Text className="single-major-page__value-card-title">快速扫描</Text>
                  </View>
                  <View className="single-major-page__value-card-content">
                    <Text className="single-major-page__value-card-text">{majorDetail.majorKey}</Text>
                  </View>
                </Card>
              )}
              {majorDetail.majorBrief && (
                <Card className="single-major-page__value-card">
                  <View className="single-major-page__value-card-header">
                    <Text className="single-major-page__value-card-icon">📖</Text>
                    <Text className="single-major-page__value-card-title">核心价值</Text>
                  </View>
                  <View className="single-major-page__value-card-content">
                    <Text className="single-major-page__value-card-text">{majorDetail.majorBrief}</Text>
                  </View>
                </Card>
              )}
            </View>
          )}

          {/* Tabs */}
          <View className="career-exploration-page__tabs-wrapper">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="career-exploration-page__tabs-list">
                <TabsTrigger value="passion" className="career-exploration-page__tabs-trigger">
                  <View className="career-exploration-page__tabs-trigger-content">
                    <Text className="career-exploration-page__tabs-trigger-icon">❤️</Text>
                    <Text className="career-exploration-page__tabs-trigger-text">热爱能量</Text>
                  </View>
                </TabsTrigger>
                <TabsTrigger value="opportunity" className="career-exploration-page__tabs-trigger">
                  <View className="career-exploration-page__tabs-trigger-content">
                    <Text className="career-exploration-page__tabs-trigger-icon">🎯</Text>
                    <Text className="career-exploration-page__tabs-trigger-text">职业发展</Text>
                  </View>
                </TabsTrigger>
              </TabsList>

              {/* 热爱能量 Tab */}
              <TabsContent value="passion" className="career-exploration-page__tabs-content">
                <View className="career-exploration-page__passion-content">
                  {/* 热爱能量显示 */}
                  {majorDetail?.major && (
                    <Card className="career-exploration-page__score-card">
                      <MajorScoreDisplay majorData={majorDetail.major} />
                    </Card>
                  )}

                  {/* 喜欢与天赋概览 */}
                  {majorDetail?.majorElementAnalyses && (
                    <MajorAnalysisActionCard
                      analyses={majorDetail.majorElementAnalyses}
                      majorName={majorName}
                      isFromPopularMajors={isFromPopularMajors}
                      popularMajorId={popularMajorId}
                    />
                  )}
                </View>
              </TabsContent>

              {/* 职业发展 Tab */}
              <TabsContent value="opportunity" className="career-exploration-page__tabs-content">
                <View className="career-exploration-page__opportunity-content">
                  {/* 产业前景 */}
                  {majorDetail.industryProspects && (
                    <Card className="career-exploration-page__opportunity-card">
                      <IndustryProspectsCard data={majorDetail.industryProspects} tag={majorDetail.industryProspectsTag} />
                    </Card>
                  )}

                  {/* 职业回报 */}
                  {majorDetail.careerDevelopment && (
                    <Card className="career-exploration-page__opportunity-card">
                      <CareerDevelopmentCard data={majorDetail.careerDevelopment} tag={majorDetail.careerDevelopmentTag} />
                    </Card>
                  )}

                  {/* 成长空间 */}
                  {majorDetail.growthPotential && (
                    <Card className="career-exploration-page__opportunity-card">
                      <GrowthPotentialCard data={majorDetail.growthPotential} tag={majorDetail.growthPotentialTag} />
                    </Card>
                  )}

                  {/* 学业发展 */}
                  {((majorDetail as any).academicDevelopment || majorDetail.academicDevelopmentTag) && (
                    <Card className="career-exploration-page__opportunity-card">
                      <AcademicDevelopmentCard
                        data={(majorDetail as any).academicDevelopment}
                        tag={majorDetail.academicDevelopmentTag}
                      />
                    </Card>
                  )}
                </View>
              </TabsContent>
            </Tabs>
          </View>

          {/* 学习内容（放在原有内容最下方） */}
          {studyContentValue && (
            <Card className="single-major-page__detail-card">
              <View className="single-major-page__detail-header">
                <Text className="single-major-page__detail-icon">📚</Text>
                <Text className="single-major-page__detail-title">学习内容</Text>
              </View>
              <View className="single-major-page__detail-content">
                <StudyContentDisplay value={studyContentValue} />
              </View>
            </Card>
          )}

          {/* 删除心动专业按钮 - 仅从心动专业页跳转过来时显示 */}
          {fromPage === 'favorite-majors' && (
            <View className="career-exploration-page__action-button">
              <Button
                onClick={handleDeleteFromFavorites}
                className="career-exploration-page__delete-favorite-button"
              >
                🗑️ 删除心动专业
              </Button>
            </View>
          )}
        </View>
      </ScrollView>

      <BottomNav />

      {/* 天赋匹配度详细分析对话框 */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="career-exploration-page__detail-dialog">
          <DialogHeader>
            <DialogTitle>天赋匹配度详细分析</DialogTitle>
          </DialogHeader>
          <ScrollView className="career-exploration-page__detail-dialog-content" scrollY>
            {majorDetail?.majorElementAnalyses && (
              <MajorElementAnalysesDisplay analyses={majorDetail.majorElementAnalyses} />
            )}
          </ScrollView>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要从心动专业列表中删除此专业吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setShowDeleteConfirm(false)}
              variant="outline"
            >
              取消
            </Button>
            <Button
              onClick={confirmDeleteFromFavorites}
              className="career-exploration-page__delete-confirm-button"
            >
              确定删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 问卷完成提示弹窗 */}
      <QuestionnaireRequiredModal
        open={showQuestionnaireModal}
        onOpenChange={setShowQuestionnaireModal}
        answerCount={answerCount}
      />
    </View>
  )
}

