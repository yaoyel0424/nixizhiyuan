import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Card } from '@/components/ui/Card'
import { BottomNav } from '@/components/BottomNav'
import {
  GaokaoMathModuleStat,
  getGaokaoMathStatsByProvince,
  getUserLearningStepContent,
  LearningStepDetail,
  LearningStepItem,
  mergeLearningStepsByStep,
} from '@/services/learning-step'
import { getUserRelatedDataCount } from '@/services/user'
import './index.less'

function getItemTitle(item: LearningStepItem): string {
  return (
    item.methodTitle ||
    item.startDoingMethod ||
    item.redlightBehavior ||
    item.elementName ||
    '学习项'
  )
}

function getItemDesc(item: LearningStepItem): string {
  return (
    item.methodContent ||
    item.examExample ||
    item.stopLossTip ||
    item.physiologyReason ||
    item.physiologyMechanism ||
    ''
  )
}

/**
 * 第一步 item：红灯行为文案（接口字段 redlightBehavior）
 */
function getFirstStepBehavior(item: LearningStepItem): string {
  const v = item.redlightBehavior
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

/**
 * 第一步 item：止损提示（接口字段 stopLossTip）
 */
function getFirstStepStopLoss(item: LearningStepItem): string {
  const v = item.stopLossTip
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

/**
 * 第一步 item：生理归因（接口字段 physiologyReason），仅在「更多」中展示
 */
function getFirstStepPhysiologyReason(item: LearningStepItem): string {
  const v = item.physiologyReason
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

function toKeyPoints(text?: string | null, max = 3): string[] {
  if (!text) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, max)
}

/** 第一步：阶段下无条目时的占位文案（替代「无」） */
const FIRST_STEP_PHASE_EMPTY_TEXT =
  '恭喜！🌸未发现明显“红灯区”，你可自由通行！ '

/** 第二步：所有阶段均无条目时的「绿灯区」引导文案（按行展示） */
const SECOND_STEP_GREEN_ZONE_LINES = [
  '探索你的专属"绿灯区"：',
  '和你最喜欢的同学一起学习，',
  '请教你最喜欢的老师，',
  '多用你"过程体验更愉快、效率更高、效果更好"的方法，',
  '开心探索独属于你的数学学习"绿灯区"吧！ ',
  '别忘记回来分享你的探索成果哦！',
]

/** 第三步 subStep=2：所有 phase 都无条目时的引导文案 */
const THIRD_STEP_MEMORY_ROUTE_LINES = [
  '探索你的专属“记忆高速路”：',
  '和你最喜欢的同学一起学习，',
  '请教你最喜欢的老师，',
  '多用你“过程体验更愉快、效率更高、效果更好”的方法记忆，',
  '开心探索独属于你的“记忆高速路”吧！ ',
  '别忘记回来分享你的探索成果哦！',
]

/** 省份下拉选项（每行展示 5 个） */
const PROVINCE_OPTIONS = [
  '北京', '天津', '河北', '山西', '内蒙古',
  '辽宁', '吉林', '黑龙江', '上海', '江苏',
  '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南', '广东', '广西',
  '海南', '重庆', '四川', '贵州', '云南',
  '西藏', '陕西', '甘肃', '青海', '宁夏',
  '新疆',
]

/**
 * 将省份名转换为题面里更自然的前缀（直辖市不加“省”）
 */
function formatProvinceExamPrefix(province: string): string {
  if (['北京', '天津', '上海', '重庆'].includes(province)) {
    return province
  }
  return `${province}省`
}

/**
 * 第三步文案变量替换：把固定省份与固定占比改为动态数据
 */
function interpolateThirdStepText(
  text: string,
  selectedProvince: string,
  functionProportion: string
): string {
  const provinceExamPrefix = formatProvinceExamPrefix(selectedProvince)
  const replaceAllSafe = (source: string, search: string, replacement: string): string =>
    source.split(search).join(replacement)
  return [
    ['分值占比大（21%-23%）', `分值占比大（${functionProportion}）`],
    ['分值占比大(21%-23%)', `分值占比大(${functionProportion})`],
    ['过去三年广东省高考', `过去三年${provinceExamPrefix}高考`],
    ['广东省高考', `${provinceExamPrefix}高考`],
    ['广东省', provinceExamPrefix],
  ].reduce(
    (acc, [search, replacement]) => replaceAllSafe(acc, search, replacement),
    text
  )
}

/**
 * 第三步固定长文：按“标题/编号/标签/正文”分行渲染，提升可读性。
 * 约定：后端数据通过 `\n` 分段，这里按行判断类型。
 */
function renderStructuredBottomLines(text: string): Array<React.ReactNode> {
  const lines = text.split('\n')
  const nodes: Array<React.ReactNode> = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line) continue

    const isNum = /^\d、/.test(line) || /^\d\./.test(line)
    const isHeading = line.includes('为什么选它') || line.endsWith('？') || line.endsWith('：')
    const isTag =
      line.startsWith('极简') ||
      line.startsWith('必考') ||
      line.startsWith('秒懂') ||
      line.includes('死命令') ||
      line.includes('死命令：')

    if (isNum) {
      nodes.push(
        <Text key={`b-${i}`} className='learning-step-page__bottom-line learning-step-page__bottom-line--num'>
          {raw}
        </Text>,
      )
      continue
    }

    if (isTag && !isHeading) {
      nodes.push(
        <Text key={`b-${i}`} className='learning-step-page__bottom-line learning-step-page__bottom-line--tag'>
          {raw}
        </Text>,
      )
      continue
    }

    if (isHeading) {
      nodes.push(
        <Text key={`b-${i}`} className='learning-step-page__bottom-line learning-step-page__bottom-line--heading'>
          {raw}
        </Text>,
      )
      continue
    }

    nodes.push(
      <Text key={`b-${i}`} className='learning-step-page__bottom-line'>
        {raw}
      </Text>,
    )
  }

  return nodes
}

/**
 * `learning-step-page__item-text` 固定模板结构化排版：
 * 识别 “轻松搞懂 + Step 1/2/3” 的文案，按卡片样式展示，提升美观与可读性。
 */
function renderLearningMethodProcessTemplate(text?: string | null): React.ReactNode {
  const raw = (text ?? '').trim()
  if (!raw) return null

  const normalized = raw.replace(/\r\n/g, '\n')
  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const heroIdx = lines.findIndex((l) => l.includes('轻松搞懂'))
  const showHero = heroIdx >= 0
  const stepLines = showHero ? lines.slice(heroIdx + 1) : lines

  const stepTitleReg = /^Step\s*([123])\s*[：:]\s*(.+)$/
  const steps: Array<{ num: number; title: string; content: string[] }> = []
  let current: { num: number; title: string; content: string[] } | null = null

  for (const l of stepLines) {
    const m = l.match(stepTitleReg)
    if (m) {
      current = { num: Number(m[1]), title: m[2] || '', content: [] }
      steps.push(current)
      continue
    }
    if (current) current.content.push(l)
  }

  // 模板不匹配则回退为原样文本
  if (!showHero || steps.length !== 3) {
    return <Text className='learning-step-page__item-text'>{raw}</Text>
  }

  const leadLines = heroIdx > 0 ? lines.slice(0, heroIdx) : []
  const themeByStep: Record<
    number,
    { accent: string; pillBg: string; pillBorder: string; cardBorder: string }
  > = {
    1: {
      accent: '#1a4099',
      pillBg: '#eef4ff',
      pillBorder: '#d7e6ff',
      cardBorder: '#dbe7ff',
    },
    2: {
      accent: '#0f766e',
      pillBg: '#ecfdf5',
      pillBorder: '#a7f3d0',
      cardBorder: '#d1fae5',
    },
    3: {
      accent: '#7c3aed',
      pillBg: '#f5f3ff',
      pillBorder: '#ddd6fe',
      cardBorder: '#e9d5ff',
    },
  }

  return (
    <View
      className='learning-step-page__item-text'
      style={{
        textAlign: 'left',
        paddingTop: '10rpx',
        paddingBottom: '10rpx',
      }}
    >
      {leadLines.length > 0 && (
        <View>
          {leadLines.map((l, idx) => (
            <Text
              key={`lead-${idx}`}
              style={{ display: 'block', fontSize: '24rpx', color: '#374151', lineHeight: 1.7 }}
            >
              {l}
            </Text>
          ))}
        </View>
      )}

      <Text
        style={{
          display: 'block',
          margin: '8rpx 0 12rpx',
          padding: '8rpx 12rpx',
          fontSize: '26rpx',
          fontWeight: 800,
          color: '#1a4099',
          textAlign: 'center',
          background: '#eef4ff',
          border: '1rpx solid #d7e6ff',
          borderRadius: '999rpx',
          lineHeight: 1.3,
          whiteSpace: 'pre-wrap',
        }}
      >
        轻松搞懂
      </Text>

      {steps.map((s) => (
        <View
          key={`step-${s.num}`}
          style={{
            marginTop: '12rpx',
            padding: '10rpx 12rpx',
            background: '#ffffff',
            border: `1rpx solid ${themeByStep[s.num]?.cardBorder ?? themeByStep[1].cardBorder}`,
            borderRadius: '12rpx',
          }}
        >
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{
                display: 'inline-block',
                padding: '4rpx 10rpx',
                borderRadius: '999rpx',
                background: themeByStep[s.num]?.pillBg ?? themeByStep[1].pillBg,
                border: `1rpx solid ${themeByStep[s.num]?.pillBorder ?? themeByStep[1].pillBorder}`,
                color: themeByStep[s.num]?.accent ?? themeByStep[1].accent,
                fontSize: '22rpx',
                fontWeight: 800,
                marginRight: '10rpx',
                lineHeight: 1.2,
                whiteSpace: 'pre-wrap',
              }}
            >
              {`Step ${s.num}`}
            </Text>
            <Text style={{ fontSize: '24rpx', fontWeight: 800, color: '#111827' }}>
              {s.title}
            </Text>
          </View>

          {s.content.length > 0 && (
            <View style={{ marginTop: '8rpx' }}>
              {s.content.map((l, idx) => (
                <Text
                  key={`s-${s.num}-${idx}`}
                  style={{
                    display: 'block',
                    fontSize: '22rpx',
                    color: '#374151',
                    lineHeight: 1.65,
                    marginTop: idx === 0 ? 0 : '6rpx',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {l}
                </Text>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  )
}

/**
 * 第二步：是否存在至少一个 phase 且其 items 非空
 */
function secondStepHasAnyPhaseItems(step: LearningStepDetail): boolean {
  return (step.phases ?? []).some((p) => (p.items?.length ?? 0) > 0)
}

/**
 * 是否为「第一步」（与接口 step 字段一致，如「第一步」）
 */
function isFirstLearningStep(step: LearningStepDetail): boolean {
  return step.step.trim() === '第一步'
}

/**
 * 是否为「第二步」（与接口 step 字段一致，如「第二步」）
 */
function isSecondLearningStep(step: LearningStepDetail): boolean {
  return step.step.trim() === '第二步'
}

/**
 * 是否为「第三步」（与接口 step 字段一致，如「第三步」）
 */
function isThirdLearningStep(step: LearningStepDetail): boolean {
  return step.step.trim() === '第三步'
}

/**
 * 是否为「第四步」（与接口 step 字段一致，如「第四步」）
 */
function isFourthLearningStep(step: LearningStepDetail): boolean {
  return step.step.trim() === '第四步'
}

function trimStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * 第二步：极致学习方法正文（startDoingMethod）
 */
function getSecondStepMethodText(item: LearningStepItem): string {
  return trimStr(item.startDoingMethod) || ''
}

/**
 * 第二步：零门槛启动（quickStartAction）
 */
function getSecondStepQuickStartText(item: LearningStepItem): string {
  return trimStr(item.quickStartAction) || ''
}

/**
 * 第二步：是否还有可放入「更多」的字段（不含子维度）
 */
function hasSecondStepMoreFields(item: LearningStepItem): boolean {
  return !!(
    trimStr(item.physiologyMechanism) ||
    trimStr(item.examExample) ||
    trimStr(item.bestTool)
  )
}

/**
 * 阶段无 items 时的占位文案：第一步用祝贺语，其余为「无」
 */
function getPhaseEmptyText(step: LearningStepDetail): string {
  return isFirstLearningStep(step) ? FIRST_STEP_PHASE_EMPTY_TEXT : '无'
}

export default function LearningStepPage() {
  const [loading, setLoading] = useState(true)
  const [steps, setSteps] = useState<LearningStepDetail[]>([])
  const [selectedProvince, setSelectedProvince] = useState('北京')
  const [provinceReady, setProvinceReady] = useState(false)
  const [provinceMenuOpen, setProvinceMenuOpen] = useState(false)
  const [beijingGaokaoStats, setBeijingGaokaoStats] = useState<GaokaoMathModuleStat[]>([])
  const [beijingGaokaoLoading, setBeijingGaokaoLoading] = useState(false)
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({})
  /** 第一步：各 item「更多」是否展开（key 为 item.id） */
  const [firstStepMoreOpen, setFirstStepMoreOpen] = useState<Record<number, boolean>>({})
  /** 第二步：各 item「更多」是否展开（key 为 `${stepId}-${itemId}`，避免与其它步 id 冲突） */
  const [secondStepMoreOpen, setSecondStepMoreOpen] = useState<Record<string, boolean>>({})
  /** 第三步：各 item「更多」是否展开（key 为 `${stepId}-${itemId}`） */
  const [thirdStepMoreOpen, setThirdStepMoreOpen] = useState<Record<string, boolean>>({})
  const [activeSubject, setActiveSubject] = useState<'math' | 'english' | 'chinese'>('math')
  const showUnderDevelopment = activeSubject !== 'math'

  /** 相同「步」合并为一条，仅展示「第几步」 */
  const displaySteps = useMemo(() => mergeLearningStepsByStep(steps), [steps])
  /** 第三步按原始 subStep 顺序展示 */
  const thirdStepSubSteps = useMemo(
    () =>
      steps
        .filter((s) => s.step.trim() === '第三步')
        .sort((a, b) => a.subStep - b.subStep || a.id - b.id),
    [steps]
  )
  /** 第三步函数模块占比（优先用接口返回） */
  const functionProportion = useMemo(() => {
    const functionRow = beijingGaokaoStats.find((row) =>
      row.moduleName?.includes('函数')
    )
    return functionRow?.proportionRange || '21%-23%'
  }, [beijingGaokaoStats])

  /**
   * 主数据加载：仅受学科切换影响，避免省份切换触发整页回到顶部
   */
  useEffect(() => {
    const fetchSteps = async () => {
      if (activeSubject !== 'math') {
        setLoading(false)
        setSteps([])
        setBeijingGaokaoStats([])
        setProvinceMenuOpen(false)
        return
      }
      try {
        setLoading(true)
        const data = await getUserLearningStepContent()
        setSteps(data || [])
      } finally {
        setLoading(false)
      }
    }
    fetchSteps()
  }, [activeSubject])

  /**
   * 省份初始化：页面加载时先获取用户相关数据省份，用于决定 gaokao API 的 province 参数。
   * 如果 province 为 null/空，则默认北京。
   */
  useEffect(() => {
    const fetchProvince = async () => {
      try {
        const data = await getUserRelatedDataCount()
        const p = typeof data?.province === 'string' ? data.province.trim() : ''
        setSelectedProvince(p || '北京')
      } catch (error) {
        console.error('获取用户省份失败，默认使用北京:', error)
        setSelectedProvince('北京')
      } finally {
        setProvinceReady(true)
      }
    }

    fetchProvince()
  }, [])

  /**
   * 省份数据加载：仅刷新第三步统计，不影响主列表 loading 与滚动位置
   */
  useEffect(() => {
    const fetchGaokaoStats = async () => {
      if (activeSubject !== 'math' || !provinceReady) return
      try {
        setBeijingGaokaoLoading(true)
        const gaokaoStats = await getGaokaoMathStatsByProvince(selectedProvince)
        setBeijingGaokaoStats(gaokaoStats || [])
      } finally {
        setBeijingGaokaoLoading(false)
      }
    }
    fetchGaokaoStats()
  }, [activeSubject, selectedProvince, provinceReady])

  return (
    <View className='learning-step-page'>
      <View className='learning-step-page__subject-tabs'>
        <View
          className={`learning-step-page__subject-tab ${activeSubject === 'math' ? 'is-active' : ''}`}
          onClick={() => {
            setActiveSubject('math')
          }}
        >
          <Text>数学</Text>
        </View>
        <View
          className={`learning-step-page__subject-tab ${activeSubject === 'english' ? 'is-active' : ''}`}
          onClick={() => {
            setActiveSubject('english')
          }}
        >
          <Text>英语</Text>
        </View>
        <View
          className={`learning-step-page__subject-tab ${activeSubject === 'chinese' ? 'is-active' : ''}`}
          onClick={() => {
            setActiveSubject('chinese')
          }}
        >
          <Text>语文</Text>
        </View>
      </View>

      <ScrollView scrollY className='learning-step-page__scroll'>
        {showUnderDevelopment && (
          <View className='learning-step-page__empty'>
            <Text>正在研发中</Text>
          </View>
        )}

        {!showUnderDevelopment && loading && (
          <View className='learning-step-page__loading'>
            <Text>学习方法加载中...</Text>
          </View>
        )}

        {!showUnderDevelopment && !loading && displaySteps.length === 0 && (
          <View className='learning-step-page__empty'>
            <Text>暂无学习方法数据</Text>
          </View>
        )}

        {!showUnderDevelopment && !loading && displaySteps.map((step) => (
          <Card
            key={step.id}
            className={
              isFourthLearningStep(step)
                ? 'learning-step-page__card learning-step-page__card--fourth'
                : 'learning-step-page__card'
            }
          >
            {isFourthLearningStep(step) ? (
              !!(step.bottom || step.bottomTitle) ? (
                <View className='learning-step-page__detail learning-step-page__detail--fourth-flat'>
                  <View className='learning-step-page__header'>
                    <Text className='learning-step-page__step'>
                      {step.step}
                    </Text>
                    <Text className='learning-step-page__title'>{step.title}</Text>
                  </View>
                  {!!step.bottomTitle && (
                    <Text className='learning-step-page__bottom-title'>{step.bottomTitle}</Text>
                  )}
                  {!!step.bottom && (
                    <View className='learning-step-page__bottom'>
                      {renderStructuredBottomLines(step.bottom)}
                    </View>
                  )}
                </View>
              ) : (
                <View className='learning-step-page__empty'>
                  <Text>暂无详情内容</Text>
                </View>
              )
            ) : (
              <>
            <View className='learning-step-page__header'>
              <Text className='learning-step-page__step'>
                {step.step}
              </Text>
              <Text className='learning-step-page__title'>{step.title}</Text>
            </View>

            {isThirdLearningStep(step) && (
              <View className='learning-step-page__third-container'>
                {thirdStepSubSteps.map((subStep, idx) => (
                  <View key={subStep.id} className='learning-step-page__third-block'>
                    {!!subStep.content && (
                      (() => {
                        const text = interpolateThirdStepText(
                          subStep.content,
                          selectedProvince,
                          functionProportion
                        )

                        // subStep=1 会在表格区块单独显示「首先，了解全局」标题，这里去掉重复行
                        const lines = text
                          .split('\n')
                          .map((l) => l.trim())
                          .filter((l) => l.length > 0)
                          .filter((l) => {
                            if (subStep.subStep !== 1) return true
                            return l !== '首先，了解全局' && l !== '首先，了解全局。'
                          })

                        if (lines.length === 0) return null

                        return (
                          <Text className='learning-step-page__item-text'>
                            {lines.join('\n')}
                          </Text>
                        )
                      })()
                    )}

                    {subStep.subStep === 1 && (
                      <View className='learning-step-page__gaokao-section'>
                        <View className='learning-step-page__gaokao-selector'>
                          <Text className='learning-step-page__gaokao-title'>首先，了解全局</Text>
                          <Text
                            className='learning-step-page__province-trigger'
                            onClick={() => setProvinceMenuOpen((prev) => !prev)}
                          >
                            {`${selectedProvince} ${provinceMenuOpen ? '▲' : '▼'}`}
                          </Text>
                        </View>
                        {provinceMenuOpen && (
                          <View className='learning-step-page__province-menu'>
                            {PROVINCE_OPTIONS.map((province) => (
                              <Text
                                key={province}
                                className={`learning-step-page__province-item ${
                                  selectedProvince === province
                                    ? 'learning-step-page__province-item--active'
                                    : ''
                                }`}
                                onClick={() => {
                                  setSelectedProvince(province)
                                  setProvinceMenuOpen(false)
                                }}
                              >
                                {province}
                              </Text>
                            ))}
                          </View>
                        )}
                        {beijingGaokaoLoading ? (
                          <Text className='learning-step-page__gaokao-empty'>
                            {`${selectedProvince}数据加载中...`}
                          </Text>
                        ) : beijingGaokaoStats.length === 0 ? (
                          <Text className='learning-step-page__gaokao-empty'>
                            {`暂无${selectedProvince}高考数学模块数据`}
                          </Text>
                        ) : (
                          <View className='learning-step-page__gaokao-list'>
                            <View className='learning-step-page__gaokao-table-header'>
                              <Text className='learning-step-page__gaokao-cell learning-step-page__gaokao-cell--module'>
                                模块
                              </Text>
                              <Text className='learning-step-page__gaokao-cell'>2023</Text>
                              <Text className='learning-step-page__gaokao-cell'>2024</Text>
                              <Text className='learning-step-page__gaokao-cell'>2025</Text>
                              <Text className='learning-step-page__gaokao-cell'>均值</Text>
                              <Text className='learning-step-page__gaokao-cell'>占比</Text>
                            </View>
                            {beijingGaokaoStats
                              .filter((row) => !row.isTotalRow && row.moduleName !== '合计')
                              .map((row) => (
                                <View key={row.id} className='learning-step-page__gaokao-row'>
                                  <Text className='learning-step-page__gaokao-cell learning-step-page__gaokao-cell--module'>
                                    {row.moduleName}
                                  </Text>
                                  <Text className='learning-step-page__gaokao-cell'>{row.scoreRange2023 || '-'}</Text>
                                  <Text className='learning-step-page__gaokao-cell'>{row.scoreRange2024 || '-'}</Text>
                                  <Text className='learning-step-page__gaokao-cell'>{row.scoreRange2025 || '-'}</Text>
                                  <Text className='learning-step-page__gaokao-cell'>{row.threeYearMean ?? '-'}</Text>
                                  <Text className='learning-step-page__gaokao-cell'>{row.proportionRange || '-'}</Text>
                                </View>
                              ))}
                          </View>
                        )}
                      </View>
                    )}

                    {subStep.subStep === 2 && (() => {
                      const nonEmptyPhases = (subStep.phases ?? []).filter(
                        (phase) => (phase.items?.length ?? 0) > 0
                      )

                      if (nonEmptyPhases.length === 0) {
                        return (
                          <View className='learning-step-page__second-green-zone'>
                            {THIRD_STEP_MEMORY_ROUTE_LINES.map((line, idx2) => (
                              <Text
                                key={`${subStep.id}-memory-${idx2}`}
                                className='learning-step-page__second-green-zone-line'
                              >
                                {line}
                              </Text>
                            ))}
                          </View>
                        )
                      }

                      return nonEmptyPhases.map((phase) => (
                        <View key={phase.id} className='learning-step-page__phase'>
                          <Text className='learning-step-page__phase-title'>{phase.title}</Text>
                          {phase.items.map((item) => (
                            <View key={item.id} className='learning-step-page__item'>
                              <Text className='learning-step-page__second-inline'>
                                <Text className='learning-step-page__second-inline-label'>
                                  高效学习法：
                                </Text>
                                <Text className='learning-step-page__second-inline-desc'>
                                  {trimStr(item.startDoingMethod || item.methodTitle)
                                    ? `${trimStr(item.startDoingMethod || item.methodTitle)}${
                                        trimStr(item.methodContent)
                                          ? `\n${trimStr(item.methodContent)}`
                                          : ''
                                      }`
                                    : (trimStr(item.methodContent) || '—')}
                                </Text>
                              </Text>

                              <View
                                className={
                                  trimStr(item.physiologyMechanism)
                                    ? 'learning-step-page__second-quick-wrap learning-step-page__second-quick-wrap--has-more'
                                    : 'learning-step-page__second-quick-wrap'
                                }
                              >
                                <Text className='learning-step-page__second-inline learning-step-page__second-inline--quick'>
                                  <Text className='learning-step-page__second-inline-label'>
                                    专属实战示例：
                                  </Text>
                                  <Text className='learning-step-page__second-inline-desc'>
                                    {trimStr(item.examExample) || '—'}
                                  </Text>
                                </Text>

                                {!!trimStr(item.physiologyMechanism) && (
                                  <Text
                                    className='learning-step-page__item-more-toggle learning-step-page__second-more-toggle'
                                    onClick={() => {
                                      const k = `${subStep.id}-${item.id}`
                                      setThirdStepMoreOpen((prev) => ({
                                        ...prev,
                                        [k]: !prev[k],
                                      }))
                                    }}
                                  >
                                    {thirdStepMoreOpen[`${subStep.id}-${item.id}`] ? '收起' : '更多'}
                                  </Text>
                                )}
                              </View>

                              {!!trimStr(item.physiologyMechanism) &&
                                thirdStepMoreOpen[`${subStep.id}-${item.id}`] && (
                                  <View className='learning-step-page__item-more-body'>
                                    <View className='learning-step-page__second-more-block'>
                                      <Text className='learning-step-page__second-more-subtitle'>
                                        生理机制
                                      </Text>
                                      <Text className='learning-step-page__second-more-text'>
                                        {trimStr(item.physiologyMechanism)}
                                      </Text>
                                    </View>
                                  </View>
                                )}
                            </View>
                          ))}
                        </View>
                      ))
                    })()}

                    {!!subStep.bottom && (
                      <View className='learning-step-page__bottom'>
                        {renderStructuredBottomLines(
                          interpolateThirdStepText(
                            subStep.bottom,
                            selectedProvince,
                            functionProportion
                          )
                        )}
                      </View>
                    )}

                    {idx < thirdStepSubSteps.length - 1 && (
                      <View className='learning-step-page__third-divider' />
                    )}
                  </View>
                ))}
              </View>
            )}

            {!isThirdLearningStep(step) && !!step.content && (
              <View className='learning-step-page__keypoints'>
                {toKeyPoints(step.content, 2).map((line, idx) => (
                  <View key={`${step.id}-content-${idx}`} className='learning-step-page__keypoint'>
                    <Text className='learning-step-page__dot'>•</Text>
                    <Text className='learning-step-page__keypoint-text'>{line}</Text>
                  </View>
                ))}
              </View>
            )}

            {!isThirdLearningStep(step) && isSecondLearningStep(step) && !secondStepHasAnyPhaseItems(step) && (
              <View className='learning-step-page__second-green-zone'>
                {SECOND_STEP_GREEN_ZONE_LINES.map((line, idx) => (
                  <Text
                    key={`${step.id}-green-${idx}`}
                    className='learning-step-page__second-green-zone-line'
                  >
                    {line}
                  </Text>
                ))}
              </View>
            )}

            {!isThirdLearningStep(step) && step.phases?.map((phase) => {
              if (isSecondLearningStep(step) && !phase.items?.length) {
                return null
              }
              return (
              <View key={phase.id} className='learning-step-page__phase'>
                <Text className='learning-step-page__phase-title'>{phase.title}</Text>
                {phase.items?.length ? (
                  phase.items.map((item, behaviorIdx) => (
                    <View key={item.id} className='learning-step-page__item'>
                      {isFirstLearningStep(step) ? (
                        <>
                          <Text className='learning-step-page__first-inline'>
                            <Text className='learning-step-page__first-inline-label'>
                              {phase.items.length > 1
                                ? `行为${behaviorIdx + 1}：`
                                : '行为：'}
                            </Text>
                            <Text className='learning-step-page__first-inline-desc'>
                              {getFirstStepBehavior(item) || '—'}
                            </Text>
                          </Text>
                          <View
                            className={
                              getFirstStepPhysiologyReason(item)
                                ? 'learning-step-page__first-stop-wrap learning-step-page__first-stop-wrap--has-more'
                                : 'learning-step-page__first-stop-wrap'
                            }
                          >
                            <Text className='learning-step-page__first-inline learning-step-page__first-inline--stop'>
                              <Text className='learning-step-page__first-inline-label'>止损：</Text>
                              <Text className='learning-step-page__first-inline-desc'>
                                {getFirstStepStopLoss(item) || '—'}
                              </Text>
                            </Text>
                            {!!getFirstStepPhysiologyReason(item) && (
                              <Text
                                className='learning-step-page__item-more-toggle learning-step-page__first-stop-more'
                                onClick={() =>
                                  setFirstStepMoreOpen((prev) => ({
                                    ...prev,
                                    [item.id]: !prev[item.id],
                                  }))
                                }
                              >
                                {firstStepMoreOpen[item.id] ? '收起' : '更多'}
                              </Text>
                            )}
                          </View>
                          {!!getFirstStepPhysiologyReason(item) && firstStepMoreOpen[item.id] && (
                            <View className='learning-step-page__item-more-body'>
                              <Text className='learning-step-page__item-more-title'>生理归因</Text>
                              <Text className='learning-step-page__item-more-text'>
                                {getFirstStepPhysiologyReason(item)}
                              </Text>
                            </View>
                          )}
                        </>
                      ) : isSecondLearningStep(step) ? (
                        <>
                          <Text className='learning-step-page__second-inline'>
                            <Text className='learning-step-page__second-inline-label'>
                              {phase.items.length > 1
                                ? `极致学习方法${behaviorIdx + 1}：`
                                : '极致学习方法：'}
                            </Text>
                            <Text className='learning-step-page__second-inline-desc'>
                              {getSecondStepMethodText(item) || '—'}
                            </Text>
                          </Text>
                          <View
                            className={
                              hasSecondStepMoreFields(item)
                                ? 'learning-step-page__second-quick-wrap learning-step-page__second-quick-wrap--has-more'
                                : 'learning-step-page__second-quick-wrap'
                            }
                          >
                            <Text className='learning-step-page__second-inline learning-step-page__second-inline--quick'>
                              <Text className='learning-step-page__second-inline-label'>零门槛启动：</Text>
                              <Text className='learning-step-page__second-inline-desc'>
                                {getSecondStepQuickStartText(item) || '—'}
                              </Text>
                            </Text>
                            {hasSecondStepMoreFields(item) && (
                              <Text
                                className='learning-step-page__item-more-toggle learning-step-page__second-more-toggle'
                                onClick={() => {
                                  const k = `${step.id}-${item.id}`
                                  setSecondStepMoreOpen((prev) => ({
                                    ...prev,
                                    [k]: !prev[k],
                                  }))
                                }}
                              >
                                {secondStepMoreOpen[`${step.id}-${item.id}`] ? '收起' : '更多'}
                              </Text>
                            )}
                          </View>
                          {hasSecondStepMoreFields(item) &&
                            secondStepMoreOpen[`${step.id}-${item.id}`] && (
                              <View className='learning-step-page__item-more-body'>
                                {!!trimStr(item.physiologyMechanism) && (
                                  <View className='learning-step-page__second-more-block'>
                                    <Text className='learning-step-page__second-more-subtitle'>生理机制</Text>
                                    <Text className='learning-step-page__second-more-text'>
                                      {trimStr(item.physiologyMechanism)}
                                    </Text>
                                  </View>
                                )}
                                {!!trimStr(item.examExample) && (
                                  <View className='learning-step-page__second-more-block'>
                                    <Text className='learning-step-page__second-more-subtitle'>专属实战示例</Text>
                                    <Text className='learning-step-page__second-more-text'>
                                      {trimStr(item.examExample)}
                                    </Text>
                                  </View>
                                )}
                                {!!trimStr(item.bestTool) && (
                                  <View className='learning-step-page__second-more-block'>
                                    <Text className='learning-step-page__second-more-subtitle'>最佳武器</Text>
                                    <Text className='learning-step-page__second-more-text'>
                                      {trimStr(item.bestTool)}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            )}
                        </>
                      ) : (
                        <>
                          <Text className='learning-step-page__item-title'>{getItemTitle(item)}</Text>
                          {!!getItemDesc(item) &&
                            renderLearningMethodProcessTemplate(getItemDesc(item))}
                        </>
                      )}
                    </View>
                  ))
                ) : (
                  <Text
                    className={
                      isFirstLearningStep(step)
                        ? 'learning-step-page__phase-empty learning-step-page__phase-empty--first-step'
                        : 'learning-step-page__phase-empty'
                    }
                  >
                    {getPhaseEmptyText(step)}
                  </Text>
                )}
              </View>
              )
            })}

            {!isThirdLearningStep(step) && !!step.bottom && (
              <View className='learning-step-page__detail'>
                <Text
                  className='learning-step-page__detail-toggle'
                  onClick={() =>
                    setExpandedMap((prev) => ({ ...prev, [step.id]: !prev[step.id] }))
                  }
                >
                  {expandedMap[step.id] ? '收起详情' : '展开详情'}
                </Text>
                {!!step.bottomTitle && (
                  <Text className='learning-step-page__bottom-title'>{step.bottomTitle}</Text>
                )}
                {expandedMap[step.id] && (
                  <>
                    <View className='learning-step-page__keypoints'>
                      {toKeyPoints(step.bottom, 6).map((line, idx) => (
                        <View key={`${step.id}-bottom-${idx}`} className='learning-step-page__keypoint'>
                          <Text className='learning-step-page__dot'>•</Text>
                          <Text className='learning-step-page__keypoint-text'>{line}</Text>
                        </View>
                      ))}
                    </View>
                    <View className='learning-step-page__bottom'>
                      {renderStructuredBottomLines(step.bottom)}
                    </View>
                  </>
                )}
              </View>
            )}
              </>
            )}
          </Card>
        ))}
      </ScrollView>

      <BottomNav />
    </View>
  )
}

