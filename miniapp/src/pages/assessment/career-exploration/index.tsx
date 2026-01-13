// 深度探索页面
import React, { useState, useEffect } from 'react'
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
import { getMajorDetailByCode, unfavoriteMajor } from '@/services/majors'
import { MajorDetailInfo } from '@/types/api'
import questionnaireData from '@/data/questionnaire.json'
import './index.less'

const STORAGE_KEY = 'questionnaire_answers'

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

// 解析指数得分字段（可能包含 "指数得分": "90" 这样的格式）
function parseScoreField(scoreField: any): string {
  if (!scoreField) return ''
  const parsed = parseDataField(scoreField)
  if (typeof parsed === 'number') return String(parsed)
  if (typeof parsed === 'object' && parsed.指数得分) return String(parsed.指数得分)
  if (typeof parsed === 'string') {
    // 提取数字
    const match = parsed.match(/指数得分[：:]\s*"?(\d+)"?/)
    if (match) return match[1]
    // 如果只是数字字符串
    if (parsed.match(/^\d+$/)) return parsed
  }
  return String(parsed || scoreField)
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

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="career-exploration-page__opportunity-trigger">
        {(isOpen?: boolean) => (
          <>
            <View className="career-exploration-page__opportunity-header">
              <Text className="career-exploration-page__opportunity-label">产业前景：</Text>
              {tag && (
                <View className="career-exploration-page__opportunity-tag career-exploration-page__opportunity-tag--purple">
                  <Text>{tag}</Text>
                </View>
              )}
            </View>
            <Text className="career-exploration-page__opportunity-arrow">{isOpen ? '▲' : '▼'}</Text>
          </>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="career-exploration-page__opportunity-content-inner">
        {typeof displayData === 'string' ? (
          <Text className="career-exploration-page__opportunity-text">{displayData}</Text>
        ) : (
          <View className="career-exploration-page__opportunity-details">
            {displayData.指数得分 && (
              <View className="career-exploration-page__opportunity-score-wrapper">
                <Text className="career-exploration-page__opportunity-score-label">指数得分: </Text>
                <Text className="career-exploration-page__opportunity-score-value">
                  {parseScoreField(displayData.指数得分)}
                </Text>
              </View>
            )}
            {displayData.行业前景 && (
              <View className="career-exploration-page__opportunity-text-wrapper">
                <Text className="career-exploration-page__opportunity-text">{String(displayData.行业前景)}</Text>
              </View>
            )}
            {displayData.趋势性风险 && (
              <View className="career-exploration-page__opportunity-risks">
                <Text className="career-exploration-page__opportunity-risks-title">趋势性风险:</Text>
                {(() => {
                  const risks = parseDataField(displayData.趋势性风险)
                  const riskObj = typeof risks === 'object' && risks !== null ? risks : {}
                  return Object.entries(riskObj).map(([key, value]) => (
                    <View key={key} className="career-exploration-page__opportunity-risk-item">
                      <Text className="career-exploration-page__opportunity-risk-key">{key}:</Text>
                      <Text className="career-exploration-page__opportunity-risk-value">{String(value)}</Text>
                    </View>
                  ))
                })()}
              </View>
            )}
          </View>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

// 职业回报卡片组件
function CareerDevelopmentCard({ data, tag }: { data: any; tag?: string }) {
  // 解析数据（可能是 JSON 字符串）
  const parsedData = parseDataField(data)
  const displayData = typeof parsedData === 'object' && parsedData !== null ? parsedData : { 职业回报: parsedData }

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="career-exploration-page__opportunity-trigger">
        {(isOpen?: boolean) => (
          <>
            <View className="career-exploration-page__opportunity-header">
              <Text className="career-exploration-page__opportunity-label">职业回报：</Text>
              {tag && (
                <View className="career-exploration-page__opportunity-tag career-exploration-page__opportunity-tag--orange">
                  <Text>{tag}</Text>
                </View>
              )}
            </View>
            <Text className="career-exploration-page__opportunity-arrow">{isOpen ? '▲' : '▼'}</Text>
          </>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="career-exploration-page__opportunity-content-inner">
        {typeof displayData === 'string' ? (
          <Text className="career-exploration-page__opportunity-text">{displayData}</Text>
        ) : (
          <View className="career-exploration-page__opportunity-details">
            {displayData.指数得分 && (
              <View className="career-exploration-page__opportunity-score-wrapper">
                <Text className="career-exploration-page__opportunity-score-label">指数得分: </Text>
                <Text className="career-exploration-page__opportunity-score-value">
                  {parseScoreField(displayData.指数得分)}
                </Text>
              </View>
            )}
            {displayData.薪酬水平参考 && (
              <View className="career-exploration-page__opportunity-salary">
                {(() => {
                  const salaryRef = parseDataField(displayData.薪酬水平参考)
                  const salaryObj = typeof salaryRef === 'object' && salaryRef !== null ? salaryRef : {}
                  return (
                    <>
                      {salaryObj.起薪区间 && (
                        <View className="career-exploration-page__opportunity-text-wrapper">
                          <Text className="career-exploration-page__opportunity-text">
                            {String(salaryObj.起薪区间)}
                          </Text>
                        </View>
                      )}
                      {salaryObj['3-5年薪资区间'] && (
                        <View className="career-exploration-page__opportunity-text-wrapper">
                          <Text className="career-exploration-page__opportunity-text">
                            {String(salaryObj['3-5年薪资区间'])}
                          </Text>
                        </View>
                      )}
                    </>
                  )
                })()}
              </View>
            )}
          </View>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

// 成长空间卡片组件
function GrowthPotentialCard({ data, tag }: { data: any; tag?: string }) {
  // 解析数据（可能是 JSON 字符串）
  const parsedData = parseDataField(data)
  const displayData = typeof parsedData === 'object' && parsedData !== null ? parsedData : { 成长空间: parsedData }

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="career-exploration-page__opportunity-trigger">
        {(isOpen?: boolean) => (
          <>
            <View className="career-exploration-page__opportunity-header">
              <Text className="career-exploration-page__opportunity-label">成长空间：</Text>
              {tag && (
                <View className="career-exploration-page__opportunity-tag career-exploration-page__opportunity-tag--green">
                  <Text>{tag}</Text>
                </View>
              )}
            </View>
            <Text className="career-exploration-page__opportunity-arrow">{isOpen ? '▲' : '▼'}</Text>
          </>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="career-exploration-page__opportunity-content-inner">
        {typeof displayData === 'string' ? (
          <Text className="career-exploration-page__opportunity-text">{displayData}</Text>
        ) : (
          <View className="career-exploration-page__opportunity-details">
            {displayData.指数得分 && (
              <View className="career-exploration-page__opportunity-score-wrapper">
                <Text className="career-exploration-page__opportunity-score-label">指数得分: </Text>
                <Text className="career-exploration-page__opportunity-score-value">
                  {parseScoreField(displayData.指数得分)}
                </Text>
              </View>
            )}
            {displayData.工作环境提示 && (
              <View className="career-exploration-page__opportunity-text-wrapper">
                <Text className="career-exploration-page__opportunity-text">{String(displayData.工作环境提示)}</Text>
              </View>
            )}
            {displayData.横向发展可能 && (
              <View className="career-exploration-page__opportunity-text-wrapper">
                <Text className="career-exploration-page__opportunity-text">{String(displayData.横向发展可能)}</Text>
              </View>
            )}
          </View>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

// 喜欢与天赋概览组件
function MajorAnalysisActionCard({
  analyses,
  onViewDetail,
}: {
  analyses: any[]
  onViewDetail: () => void
}) {
  const [expandedType, setExpandedType] = useState<'positive' | 'negative' | null>('positive')
  const { positiveCount, negativeCount } = getAnalysisCounts(analyses)
  const totalCount = positiveCount + negativeCount

  // 分组分析数据
  const positiveItems = analyses.filter(
    (a) => a && a.type && (a.type === 'shanxue' || a.type === 'lexue')
  )
  const negativeItems = analyses.filter(
    (a) => a && a.type && (a.type === 'tiaozhan' || a.type === 'yanxue')
  )

  if (totalCount === 0) {
    return (
      <Card className="career-exploration-page__analysis-empty">
        <Text className="career-exploration-page__analysis-empty-text">
          暂无天赋匹配度数据。请先完成问卷。
        </Text>
        <Button
          onClick={() => {
            Taro.navigateTo({
              url: '/pages/assessment/questionnaire/index'
            })
          }}
          className="career-exploration-page__analysis-empty-button"
        >
          🔄 立即进行专业匹配问卷
        </Button>
      </Card>
    )
  }

  const toggleExpanded = (type: 'positive' | 'negative') => {
    setExpandedType(expandedType === type ? null : type)
  }

  return (
    <Card className="career-exploration-page__analysis-card">
      <View className="career-exploration-page__analysis-header">
        <Text className="career-exploration-page__analysis-title">🧠 喜欢与天赋概览</Text>
      </View>
      <View className="career-exploration-page__analysis-buttons">
        <View
          className={`career-exploration-page__analysis-button career-exploration-page__analysis-button--positive ${expandedType === 'positive' ? 'career-exploration-page__analysis-button--active' : ''}`}
          onClick={() => toggleExpanded('positive')}
        >
          <View className="career-exploration-page__analysis-button-content">
            <Text className="career-exploration-page__analysis-button-count career-exploration-page__analysis-button-count--positive">
              {positiveCount}
            </Text>
            <Text className="career-exploration-page__analysis-button-icon">📈</Text>
          </View>
          <Text className="career-exploration-page__analysis-button-label">积极助力项</Text>
        </View>
        <View
          className={`career-exploration-page__analysis-button career-exploration-page__analysis-button--negative ${expandedType === 'negative' ? 'career-exploration-page__analysis-button--active' : ''}`}
          onClick={() => toggleExpanded('negative')}
        >
          <View className="career-exploration-page__analysis-button-content">
            <Text className="career-exploration-page__analysis-button-count career-exploration-page__analysis-button-count--negative">
              {negativeCount}
            </Text>
            <Text className="career-exploration-page__analysis-button-icon">⚠️</Text>
          </View>
          <Text className="career-exploration-page__analysis-button-label">潜在挑战项</Text>
        </View>
      </View>

      {/* 积极助力项列表 */}
      {expandedType === 'positive' && positiveItems.length > 0 && (
        <View className="career-exploration-page__analysis-items career-exploration-page__analysis-items--positive">
          {positiveItems.map((item: any, index: number) => (
            <ItemCard key={index} item={item} type="positive" />
          ))}
        </View>
      )}

      {/* 潜在挑战项列表 */}
      {expandedType === 'negative' && negativeItems.length > 0 && (
        <View className="career-exploration-page__analysis-items career-exploration-page__analysis-items--negative">
          {negativeItems.map((item: any, index: number) => (
            <ItemCard key={index} item={item} type="negative" />
          ))}
        </View>
      )}
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
  const [majorName, setMajorName] = useState('')
  const [loading, setLoading] = useState(true)
  const [majorDetail, setMajorDetail] = useState<MajorDetailInfo | null>(null)
  const [activeTab, setActiveTab] = useState('passion')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 检查问卷完成状态
  useEffect(() => {
    if (!isCheckingQuestionnaire && !isQuestionnaireCompleted) {
      setShowQuestionnaireModal(true)
    }
  }, [isCheckingQuestionnaire, isQuestionnaireCompleted])

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
        const detail = await getMajorDetailByCode(majorCode)
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
        }
        
        setMajorDetail(detail)
        setMajorName(detail.name || detail.code || '')
        
        // 设置页面标题
        if (detail.name || detail.code) {
          Taro.setNavigationBarTitle({
            title: `深度探索 ${detail.name || detail.code}`
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
  }, [majorCode])

  // 处理"该专业不适合我"
  const handleNotSuitable = () => {
    setShowDeleteConfirm(true)
  }

  // 确认删除
  const confirmDeleteFromFavorites = async () => {
    try {
      await unfavoriteMajor(majorCode)
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
      {/* 头部 */}
      <View className="career-exploration-page__header">
        <View className="career-exploration-page__header-content">
          <Text className="career-exploration-page__title">
            深度探索 <Text className="career-exploration-page__title-sub">{majorName}</Text>
          </Text>
        </View>
        <View className="career-exploration-page__wave" />
      </View>

      {/* 内容区域 */}
      <ScrollView className="career-exploration-page__scroll" scrollY>
        <View className="career-exploration-page__content">
          {/* 专业基本信息 */}
          <Card className="career-exploration-page__info-card">
            <View className="career-exploration-page__info-header">
              <Text className="career-exploration-page__info-title">{majorDetail.code} 专业信息</Text>
            </View>
            <View className="career-exploration-page__info-fields">
              {majorDetail.educationLevel && (
                <View className="career-exploration-page__info-field">
                  <Text className="career-exploration-page__info-label">学历层次:</Text>
                  <Text className="career-exploration-page__info-value">{majorDetail.educationLevel}</Text>
                </View>
              )}
              {majorDetail.studyPeriod && (
                <View className="career-exploration-page__info-field">
                  <Text className="career-exploration-page__info-label">学制:</Text>
                  <Text className="career-exploration-page__info-value">{majorDetail.studyPeriod}</Text>
                </View>
              )}
              {majorDetail.awardedDegree && (
                <View className="career-exploration-page__info-field">
                  <Text className="career-exploration-page__info-label">授予学位:</Text>
                  <Text className="career-exploration-page__info-value">{majorDetail.awardedDegree}</Text>
                </View>
              )}
            </View>
            {majorDetail.majorBrief && (
              <View className="career-exploration-page__info-brief">
                <Text className="career-exploration-page__info-brief-text">{majorDetail.majorBrief}</Text>
              </View>
            )}
            {majorDetail.majorKey && (
              <View className="career-exploration-page__info-keywords">
                <Text className="career-exploration-page__info-keywords-label">关键词: </Text>
                <Text className="career-exploration-page__info-keywords-value">{majorDetail.majorKey}</Text>
              </View>
            )}
          </Card>

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
                      onViewDetail={() => setShowDetailModal(true)}
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
                  {majorDetail.academicDevelopmentTag && (
                    <Card className="career-exploration-page__opportunity-card">
                      <View className="career-exploration-page__opportunity-header">
                        <Text className="career-exploration-page__opportunity-label">学业发展：</Text>
                        <View className="career-exploration-page__opportunity-tag career-exploration-page__opportunity-tag--blue">
                          <Text>{majorDetail.academicDevelopmentTag}</Text>
                        </View>
                      </View>
                    </Card>
                  )}
                </View>
              </TabsContent>
            </Tabs>
          </View>

          {/* 该专业不适合按钮 */}
          <View className="career-exploration-page__action-button">
            <Button
              onClick={handleNotSuitable}
              className="career-exploration-page__not-suitable-button"
            >
              ⚠️ 该专业不适合我
            </Button>
          </View>
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
              确定要从心动专业列表中删除此专业吗？此操作无法撤销。
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

