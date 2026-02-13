// 志愿方案页面
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, ScrollView, Checkbox, Canvas } from '@tarojs/components'
import Taro, { useRouter, useDidShow, useShareAppMessage, useReachBottom } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { BottomNav } from '@/components/BottomNav'
import { QuestionnaireRequiredModal } from '@/components/QuestionnaireRequiredModal'
import { ExportProgressDialog } from '@/components/ExportProgressDialog'
import { ExportCompleteDialog } from '@/components/ExportCompleteDialog'
import { useQuestionnaireCheck } from '@/hooks/useQuestionnaireCheck'
import { getStorage, setStorage, removeStorage } from '@/utils/storage'
import { getExamInfo, updateExamInfo, getGaokaoConfig, getScoreRange, ExamInfo, GaokaoSubjectConfig } from '@/services/exam-info'
import { getCurrentUserDetail, getUserRelatedDataCount } from '@/services/user'
import type { UserEnrollmentPlan, ProvincialControlLine, MajorGroupInfo } from '@/services/enroll-plan'
import * as enrollPlan from '@/services/enroll-plan'
import { getBottom20Scores } from '@/services/scores'
import { getChoices, deleteChoice, removeMultipleChoices, adjustMgIndex, adjustMajorIndex, GroupedChoiceResponse, ChoiceInGroup, ChoiceResponse, Direction, createChoice, CreateChoiceDto } from '@/services/choices'
import { RangeSlider } from '@/components/RangeSlider'
import { exportWishlistToPdf } from '@/utils/exportPdf'
import { ExamInfoDialog } from '@/components/ExamInfoDialog'
import './index.less'

// 从 enroll-plan 命名空间解构到模块级常量，避免打包后闭包中引用导致 is not defined
const { getUserEnrollmentPlans, getProvincialControlLines, getMajorGroupInfo, getLevel3MajorIdsByMajorGroupIds } = enrollPlan

interface Major {
  code: string
  name: string
  displayName: string
  developmentPotential: string
  score: string
  opportunityScore: string
  academicDevelopmentScore: string
  careerDevelopmentScore: string
  growthPotentialScore: string
  industryProspectsScore: string
  lexueScore: string
  shanxueScore: string
  yanxueDeduction: string
  tiaozhanDeduction: string
  eduLevel?: string
}

interface HistoryScore {
  year: number
  historyScore: Array<{ [key: string]: string }>
  remark: string
  planNum: number
  batch?: string
  majorGroupName?: string | null
}

interface School {
  schoolName: string
  schoolNature: string
  rankDiffPer: number
  group: number
  historyScores: HistoryScore[]
  schoolFeature: string
  belong: string
  provinceName: string
  cityName: string
  enrollmentRate: string
  employmentRate: string
  majorGroupName?: string | null
  majorGroupId?: number
}

interface IntentionMajor {
  major: Major
  schools: School[]
}

// 3+3模式省份列表（提交时 preferredSubjects 统一填写"综合"）
const PROVINCES_3_3_MODE = ['北京', '上海', '浙江', '天津', '山东', '海南', '西藏', '新疆']

// 高考信息对话框组件已移至 @/components/ExamInfoDialog

export default function IntendedMajorsPage() {
  // 检查问卷完成状态（复用同一份 related-data-count 数据，避免页面再请求一次）
  const {
    isCompleted: isQuestionnaireCompleted,
    isLoading: isCheckingQuestionnaire,
    answerCount,
    majorFavoritesCount,
    provinceFavoritesCount: relatedProvinceFavoritesCount,
    preferredSubjects: relatedPreferredSubjects,
  } = useQuestionnaireCheck()
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  
  const router = useRouter()
  const tabParam = router.params?.tab || '意向志愿'
  const activeTab = tabParam === '意向志愿' ? '意向志愿' : '专业赛道'

  /**
   * 小程序分享配置
   * 当用户点击右上角分享或使用 Button 的 openType="share" 时会触发
   * 分享样式与个人中心的"分享给朋友"保持一致
   */
  useShareAppMessage(() => {
    // 构建分享路径，包含当前tab参数
    const sharePath = `/pages/majors/intended/index?tab=${encodeURIComponent(activeTab)}`
    
    return {
      title: '逆袭智愿 - 让「喜欢」和「天赋」，带你找到答案',
      path: sharePath,
      imageUrl: '', // 可选：分享图片 URL
    }
  })
  
  const [data, setData] = useState<IntentionMajor[]>([])
  const [enrollmentPlans, setEnrollmentPlans] = useState<UserEnrollmentPlan[]>([]) // 用户招生计划数据
  const [loading, setLoading] = useState(true)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [wishlistItems, setWishlistItems] = useState<any[]>([])
  const [wishlistCounts, setWishlistCounts] = useState<Record<string, number>>({})
  const [groupedChoices, setGroupedChoices] = useState<GroupedChoiceResponse | null>(null) // API返回的分组数据
  const [showExamInfoDialog, setShowExamInfoDialog] = useState(false)
  const [currentScore, setCurrentScore] = useState<number>(580)
  const [scoreRange, setScoreRange] = useState<[number, number]>([500, 650])
  // 分数区间是否已从本地存储/高考信息初始化完成（避免用默认值触发一次错误请求）
  const [scoreRangeReady, setScoreRangeReady] = useState(false)
  // 是否启用分数区间筛选（院校探索页默认勾选）
  const [enableScoreFilter, setEnableScoreFilter] = useState<boolean>(true)
  // 区间输入框的临时值（用于实时显示，不立即更新 scoreRange）
  // 使用 null 表示未编辑状态，字符串表示正在编辑
  const [tempMinValue, setTempMinValue] = useState<string | null>(null)
  const [tempMaxValue, setTempMaxValue] = useState<string | null>(null)
  const [minControlScore, setMinControlScore] = useState<number>(0) // 省份最低省控线
  const [expandedHistoryScores, setExpandedHistoryScores] = useState<Set<string>>(new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)
  const [groupToDelete, setGroupToDelete] = useState<{ items: any[], schoolName: string, majorGroupName: string } | null>(null)
  const [choiceToDelete, setChoiceToDelete] = useState<{ choiceId: number; majorName: string } | null>(null) // 要删除的单个专业
  const [selectedGroupInfo, setSelectedGroupInfo] = useState<{
    schoolName: string
    majorGroupName: string
    majorGroupId?: number
  } | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [examInfo, setExamInfo] = useState<ExamInfo | null>(null)
  const [expandedMajorGroups, setExpandedMajorGroups] = useState<Set<string>>(new Set()) // 展开的专业组
  const [groupInfoData, setGroupInfoData] = useState<MajorGroupInfo[]>([]) // 专业组详细信息
  const [loadingGroupInfo, setLoadingGroupInfo] = useState(false)
  const [selectedSchoolData, setSelectedSchoolData] = useState<School | null>(null)
  const [selectedPlanData, setSelectedPlanData] = useState<any | null>(null) // 保存选中的plan数据
  const [expandedChoicesInGroup, setExpandedChoicesInGroup] = useState<Set<string>>(new Set()) // 展开的专业组内的志愿列表
  const [expandedScores, setExpandedScores] = useState<Set<number>>(new Set()) // 展开的 scores 列表索引（用于多个 scores 的展开）
  const [expandedLoveEnergyChoiceIds, setExpandedLoveEnergyChoiceIds] = useState<Set<number>>(new Set()) // 展开的热爱能量（意向志愿）
  // 包含「分数后20%」专业的专业组 ID，用于标记警示符号；后20%最高分用于弹框内标记
  const [warningMajorGroupIds, setWarningMajorGroupIds] = useState<Set<number>>(new Set())
  const [bottom20MaxScore, setBottom20MaxScore] = useState<number | null>(null)
  // 移动动画标记：记录需要高亮的组件ID（志愿的mgIndex或专业的choice.id）
  const [highlightedVolunteerId, setHighlightedVolunteerId] = useState<number | null>(null) // 高亮的志愿ID（mgIndex）
  const [highlightedChoiceId, setHighlightedChoiceId] = useState<number | null>(null) // 高亮的专业ID（choice.id）

  // 志愿列表分段加载：每次展示 10 条，滑动触底自动加载
  const VOLUNTEER_PAGE_SIZE = 10
  const [visibleVolunteerCount, setVisibleVolunteerCount] = useState(VOLUNTEER_PAGE_SIZE)

  // 导出相关状态
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState('')
  const [showExportProgress, setShowExportProgress] = useState(false)
  const [showExportComplete, setShowExportComplete] = useState(false)
  const [exportFilePath, setExportFilePath] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [exportPaused, setExportPaused] = useState(false)
  const exportCancelRef = useRef(false)

  // 志愿列表是否已加载完成（用于避免在请求未完成时显示「暂无志愿数据」）
  const [choicesLoaded, setChoicesLoaded] = useState(false)
  // 志愿列表刷新：合并短时间内的多次写操作，避免频繁请求与重渲染
  const fetchingChoicesRef = useRef(false)
  const refreshChoicesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * 格式化百分比展示
   * - 为 0（含字符串 '0'/'0.0'）时显示 '-'
   * - 其他情况显示 `{value}%`
   */
  const formatRatePercent = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '-'
    const num = typeof value === 'string' ? parseFloat(value) : Number(value)
    if (Number.isNaN(num) || num === 0) return '-'
    return `${value}%`
  }

  /**
   * 标准化热爱能量值
   * - 如果值在 0-1 之间，乘以 100 取整
   * - 其他情况四舍五入
   */
  const normalizeLoveEnergy = (value: unknown): string | null => {
    if (value === null || value === undefined) return null
    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
    if (Number.isNaN(numValue)) return null
    if (numValue > 0 && numValue < 1) {
      return Math.floor(numValue * 100).toString()
    }
    return Math.round(numValue).toString()
  }

  /**
   * 获取意向志愿中用于展示的热爱能量 scores 列表
   * - 优先从 majorScores[*].scores 读取（兼容后端可能嵌套在 majorScores 中的结构）
   * - 如果不存在，则回退到 choice.scores（兼容后端 ChoiceInGroupDto 的 scores 字段）
   */
  const getChoiceLoveEnergyScores = (choice: any): any[] => {
    const majorScores = Array.isArray(choice?.majorScores) ? choice.majorScores : []
    const nestedScores = majorScores.flatMap((ms: any) => (Array.isArray(ms?.scores) ? ms.scores : []))
    if (nestedScores.length > 0) return nestedScores
    return Array.isArray(choice?.scores) ? choice.scores : []
  }

  /**
   * 处理导出志愿方案
   */
  const handleExportWishlist = async () => {
    // 防止重复点击
    if (isExporting) {
      Taro.showToast({
        title: '正在导出中，请稍候...',
        icon: 'none',
        duration: 2000,
      })
      return
    }

    // 检查是否有志愿数据
    if (!groupedChoices || !groupedChoices.volunteers || groupedChoices.volunteers.length === 0) {
      Taro.showToast({
        title: '暂无志愿数据，无法导出',
        icon: 'none',
      })
      return
    }

    try {
      setIsExporting(true)
      setExportProgress(0)
      setExportStatus('正在初始化...')
      setExportPaused(false)
      exportCancelRef.current = false
      setShowExportProgress(true)

      // 创建暂停ref，用于在导出函数中获取最新的暂停状态
      const pausedRef = { current: exportPaused }
      
      // 监听暂停状态变化，实时更新ref
      const pauseCheckInterval = setInterval(() => {
        pausedRef.current = exportPaused
      }, Math.max(50, 1))

      try {
        // 调用导出函数
        const filePath = await exportWishlistToPdf(
          groupedChoices,
          examInfo,
          {
            onProgress: (progress, status) => {
              if (!exportCancelRef.current) {
                setExportProgress(progress)
                setExportStatus(status)
                // 注意：不在这里关闭进度对话框，等待导出函数返回后再统一处理
              }
            },
            paused: exportPaused,
            pausedRef: pausedRef,
          }
        )

        if (!exportCancelRef.current) {
          // 导出成功，设置文件路径
          setExportFilePath(filePath)
          // 延迟关闭进度对话框，让用户看到100%完成状态
          setTimeout(() => {
            if (!exportCancelRef.current) {
              setShowExportProgress(false)
              // 显示完成对话框
              setShowExportComplete(true)
            }
          }, 500) // 500ms延迟，确保用户看到完成状态
        }
      } finally {
        clearInterval(pauseCheckInterval)
      }

    } catch (error: any) {
      console.error('导出失败:', error)
      Taro.showToast({
        title: error?.message || '导出失败，请重试',
        icon: 'none',
        duration: 2000,
      })
      setShowExportProgress(false)
    } finally {
      setIsExporting(false)
      setExportPaused(false)
    }
  }

  /**
   * 处理暂停导出
   */
  const handlePauseExport = () => {
    setExportPaused(true)
    setExportStatus('已暂停')
  }

  /**
   * 处理恢复导出
   */
  const handleResumeExport = () => {
    setExportPaused(false)
    setExportStatus('继续导出中...')
  }

  /**
   * 处理取消导出
   */
  const handleCancelExport = () => {
    exportCancelRef.current = true
    setExportPaused(false)
    setIsExporting(false)
    setShowExportProgress(false)
    setExportProgress(0)
    setExportStatus('')
    Taro.showToast({
      title: '已取消导出',
      icon: 'none',
    })
  }

  /**
   * 检查是否正在导出，如果是则提示用户
   */
  const checkExporting = (): boolean => {
    if (isExporting) {
      Taro.showModal({
        title: '提示',
        content: '正在导出志愿方案，请等待导出完成后再进行操作',
        showCancel: false,
        confirmText: '知道了',
      })
      return true
    }
    return false
  }

  // 检查问卷完成状态
  useEffect(() => {
    if (!isCheckingQuestionnaire && !isQuestionnaireCompleted) {
      setShowQuestionnaireModal(true)
    }
  }, [isCheckingQuestionnaire, isQuestionnaireCompleted])

  // 使用 ref 防止重复调用招生计划接口
  const fetchingEnrollmentPlansRef = useRef(false)
  // 使用 ref 保存最新 scoreRange，避免 setTimeout/闭包拿到旧值导致请求参数不一致
  const scoreRangeRef = useRef<[number, number]>(scoreRange)
  useEffect(() => {
    scoreRangeRef.current = scoreRange
  }, [scoreRange])
  // 分数区间拖动时，防抖刷新院校探索数据，避免频繁请求
  const refreshEnrollmentPlansTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 使用 ref 防止页面显示时重复刷新
  const refreshingOnShowRef = useRef(false)
  // 首次进入页面时，useDidShow 也会触发：用 ref 避免首次就刷新导致重复请求
  const hasDidShowOnceRef = useRef(false)
  // 仅在“高考信息弹窗从打开->关闭”时刷新：避免初始 showExamInfoDialog=false 也触发刷新导致重复请求
  const prevShowExamInfoDialogRef = useRef(showExamInfoDialog)
  // 是否已用 useQuestionnaireCheck 的 related 数据初始化过 storage/弹窗（只做一次，避免重复）
  const hasInitializedRelatedStorageRef = useRef(false)

  // 加载数据（院校探索页面和意向志愿页面都使用API数据）
  useEffect(() => {
    const loadData = async () => {
      try {
        if (activeTab === '专业赛道') {
          // 分数区间未初始化完成时，不发起请求，避免 minScore/maxScore 与滑块显示不一致
          if (!scoreRangeReady) {
            return
          }
          // 院校探索页面：调用API获取用户招生计划（使用最新滑块值）
          // 注意：不要在这里手动操作 fetchingEnrollmentPlansRef，避免与 refreshEnrollmentPlans 内部的并发控制冲突
          await refreshEnrollmentPlans()
        } else {
          // 意向志愿：数据由 loadChoicesFromAPI -> applyGroupedChoicesToState 统一加载并同步 data，此处不再重复请求 /choices
          setLoading(false)
        }
        setLoading(false)
      } catch (error) {
        console.error('加载数据失败:', error)
        setLoading(false)
      }
    }
    loadData()
  }, [activeTab, scoreRangeReady])

  // 将API返回的分组数据转换为扁平化的列表
  const convertGroupedChoicesToItems = (groupedData: GroupedChoiceResponse): any[] => {
    const items: any[] = []
    
    // 按mgIndex排序
    const sortedVolunteers = [...groupedData.volunteers].sort((a, b) => {
      const aIndex = a.mgIndex ?? 999999
      const bIndex = b.mgIndex ?? 999999
      return aIndex - bIndex
    })
    
    sortedVolunteers.forEach((volunteer) => {
      volunteer.majorGroups.forEach((majorGroup) => {
        // 按majorIndex排序
        const sortedChoices = [...majorGroup.choices].sort((a, b) => {
          const aIndex = a.majorIndex ?? 999999
          const bIndex = b.majorIndex ?? 999999
          return aIndex - bIndex
        })
        
        sortedChoices.forEach((choice) => {
          items.push({
            id: choice.id,
            key: `${choice.schoolCode}-${choice.majorGroupId || 'no-group'}-${choice.id}`,
            majorCode: '', // API数据中没有majorCode，需要从其他地方获取
            majorName: choice.enrollmentMajor || '',
            schoolName: volunteer.school.name || '',
            schoolCode: choice.schoolCode,
            provinceName: volunteer.school.provinceName || '',
            cityName: volunteer.school.cityName || '',
            belong: volunteer.school.belong || '',
            schoolFeature: volunteer.school.features || '',
            schoolNature: volunteer.school.nature || 'public',
            enrollmentRate: volunteer.school.enrollmentRate ? `${volunteer.school.enrollmentRate}` : '0',
            employmentRate: volunteer.school.employmentRate ? `${volunteer.school.employmentRate}` : '0',
            majorGroupName: majorGroup.majorGroup?.mgName || choice.majorGroupInfo || null,
            majorGroupId: choice.majorGroupId || majorGroup.majorGroup?.mgId || null,
            batch: choice.batch || null,
            studyPeriod: choice.studyPeriod || null,
            tuitionFee: choice.tuitionFee || null,
            remark: choice.remark || null,
            enrollmentMajor: choice.enrollmentMajor || null,
            subjectSelectionMode: choice.subjectSelectionMode || majorGroup.majorGroup?.subjectSelectionMode || null,
            enrollmentQuota: choice.enrollmentQuota || null,
            // 历史分数数据（从majorScores转换）
            historyScore: choice.majorScores.length > 0 ? [{
              year: choice.majorScores[0].year ? parseInt(choice.majorScores[0].year) : 2024,
              historyScore: choice.majorScores.map(score => ({
                [score.year || '2024']: `${score.minScore || ''},${score.minRank || ''},${score.admitCount || 0}`
              })),
              remark: choice.remark || '',
              planNum: choice.majorScores[0]?.admitCount || 0,
              batch: choice.batch || undefined,
              majorGroupName: majorGroup.majorGroup?.mgName || null,
            }] : [],
            mgIndex: volunteer.mgIndex,
            majorIndex: choice.majorIndex,
          })
        })
      })
    })
    
    return items
  }

  /**
   * 将 groupedChoices 同步到页面 state（groupedChoices / wishlistItems / wishlistCounts）
   * - 作为该页面“志愿列表”的单一更新入口，避免到处重复 setState
   * - 刷新后保留当前已展示条数：若用户已加载超过 10 条（如上移/下移/删除前在看第 11+ 条），
   *   不重置为仅前 10 条，避免操作后列表“缩回”导致找不到当前上下文
   */
  /**
   * 将 items 转为 IntentionMajor[]（按专业分组），用于头部前 20% 等统计
   */
  const itemsToIntentionMajors = (items: any[]): IntentionMajor[] => {
    const majorMap = new Map<string, IntentionMajor>()
    items.forEach((item: any) => {
      const majorKey = item.majorName || item.enrollmentMajor || 'unknown'
      if (!majorMap.has(majorKey)) {
        majorMap.set(majorKey, {
          major: {
            code: item.majorCode || '',
            name: item.majorName || item.enrollmentMajor || '',
            displayName: item.majorName || item.enrollmentMajor || '',
            developmentPotential: '',
            score: '',
            opportunityScore: '',
            academicDevelopmentScore: '',
            careerDevelopmentScore: '',
            growthPotentialScore: '',
            industryProspectsScore: '',
            lexueScore: '',
            shanxueScore: '',
            yanxueDeduction: '',
            tiaozhanDeduction: '',
            eduLevel: ''
          },
          schools: []
        })
      }
      const intentionMajor = majorMap.get(majorKey)!
      intentionMajor.schools.push({
        schoolName: item.schoolName || '',
        schoolNature: item.schoolNature || 'public',
        rankDiffPer: 0,
        group: 0,
        historyScores: item.historyScore || [],
        schoolFeature: item.schoolFeature || '',
        belong: item.belong || '',
        provinceName: item.provinceName || '',
        cityName: item.cityName || '',
        enrollmentRate: item.enrollmentRate || '0',
        employmentRate: item.employmentRate || '0',
        majorGroupName: item.majorGroupName || null,
        majorGroupId: item.majorGroupId || null
      })
    })
    return Array.from(majorMap.values())
  }

  const applyGroupedChoicesToState = (groupedData: GroupedChoiceResponse | null) => {
    setGroupedChoices(groupedData)
    const newTotal = groupedData?.volunteers?.length ?? 0
    setVisibleVolunteerCount((prev) =>
      Math.max(VOLUNTEER_PAGE_SIZE, Math.min(prev, newTotal || VOLUNTEER_PAGE_SIZE))
    )
    const items = groupedData ? convertGroupedChoicesToItems(groupedData) : []
    setWishlistItems(items)

    const counts: Record<string, number> = {}
    items.forEach((item: any) => {
      if (item.majorCode) {
        counts[item.majorCode] = (counts[item.majorCode] || 0) + 1
      }
    })
    setWishlistCounts(counts)
    // 同步 data（IntentionMajor[]），供头部前 20% 等统计使用
    setData(groupedData ? itemsToIntentionMajors(items) : [])
  }

  /**
   * 本地移除若干 choiceId（用于“移除志愿/批量删除”后即时刷新 UI）
   */
  const removeChoiceIdsLocally = (ids: number[]) => {
    if (!groupedChoices || !Array.isArray(ids) || ids.length === 0) return

    const idSet = new Set(ids)
    const nextVolunteers = (groupedChoices.volunteers || [])
      .map((vol) => ({
        ...vol,
        majorGroups: (vol.majorGroups || [])
          .map((mg) => ({
            ...mg,
            choices: (mg.choices || []).filter((c) => !idSet.has(c.id)),
          }))
          .filter((mg) => (mg.choices || []).length > 0),
      }))
      .filter((vol) => (vol.majorGroups || []).length > 0)

    // statistics.selected 的语义：mgIndex 唯一数量（后端注释已说明）
    const uniqueMgIndexes = new Set<number>()
    nextVolunteers.forEach((v) => {
      if (typeof v.mgIndex === 'number') uniqueMgIndexes.add(v.mgIndex)
    })

    const nextGrouped: GroupedChoiceResponse = {
      ...groupedChoices,
      volunteers: nextVolunteers as any,
      statistics: {
        ...groupedChoices.statistics,
        selected: uniqueMgIndexes.size,
      },
    }

    applyGroupedChoicesToState(nextGrouped)
  }

  /**
   * 本地插入/更新一条 choice（用于“加入志愿”后即时切换按钮与列表）
   * - 后续仍会后台刷新一次，保证最终态与后端一致
   */
  const upsertChoiceLocally = (choice: ChoiceResponse) => {
    if (!choice) return

    const schoolCode = choice.schoolCode || choice.school?.code
    if (!schoolCode) return

    const majorGroupId = choice.majorGroupId ?? choice.majorGroup?.mgId ?? null
    const mgIndex = choice.mgIndex ?? null

    const safeGrouped: GroupedChoiceResponse = groupedChoices || ({
      volunteers: [],
      statistics: { selected: 0, total: 0 },
    } as any)

    // 复制 volunteers
    const volunteers = [...(safeGrouped.volunteers || [])]
    const volunteerIndex = volunteers.findIndex((v) => {
      const matchByIndex = mgIndex !== null && v.mgIndex === mgIndex
      const matchBySchool = v.school?.code === schoolCode
      return matchBySchool && (mgIndex === null ? true : matchByIndex)
    })

    let volunteer = volunteerIndex >= 0 ? (volunteers[volunteerIndex] as any) : null

    if (!volunteer) {
      volunteer = {
        mgIndex,
        school: (choice.school || {
          code: schoolCode,
          name: null,
          provinceName: null,
          cityName: null,
          nature: null,
          belong: null,
          features: null,
          enrollmentRate: null,
          employmentRate: null,
        }) as any,
        majorGroups: [],
      } as any
      volunteers.push(volunteer)
    }

    const majorGroups = [...(volunteer.majorGroups || [])]
    const majorGroupIndex = majorGroups.findIndex((mg) => {
      const mgId = mg.majorGroup?.mgId ?? null
      if (majorGroupId !== null && mgId !== null) {
        return Number(mgId) === Number(majorGroupId) || String(mgId) === String(majorGroupId)
      }
      // 回退：用名称匹配
      const mgName = mg.majorGroup?.mgName ?? null
      const targetName = choice.majorGroupInfo ?? choice.majorGroup?.mgName ?? null
      if (mgName && targetName) return String(mgName).trim() === String(targetName).trim()
      return false
    })

    let majorGroupGroup = majorGroupIndex >= 0 ? (majorGroups[majorGroupIndex] as any) : null

    if (!majorGroupGroup) {
      majorGroupGroup = {
        majorGroup: (choice.majorGroup || {
          schoolCode: schoolCode,
          province: choice.province ?? null,
          year: choice.year ?? null,
          subjectSelectionMode: choice.subjectSelectionMode ?? null,
          batch: choice.batch ?? null,
          mgId: majorGroupId,
          mgName: choice.majorGroupInfo ?? null,
          mgInfo: null,
        }) as any,
        choices: [],
      } as any
      majorGroups.push(majorGroupGroup)
    }

    const choices = [...(majorGroupGroup.choices || [])]
    const existingIndex = choices.findIndex((c) => c.id === choice.id)
    const nextChoiceInGroup: ChoiceInGroup = {
      id: choice.id,
      userId: choice.userId,
      schoolCode: choice.schoolCode,
      majorGroupId: choice.majorGroupId,
      mgIndex: choice.mgIndex,
      majorIndex: choice.majorIndex,
      majorGroupInfo: choice.majorGroupInfo,
      province: choice.province,
      year: choice.year,
      batch: choice.batch,
      subjectSelectionMode: choice.subjectSelectionMode,
      studyPeriod: choice.studyPeriod,
      enrollmentQuota: choice.enrollmentQuota,
      enrollmentType: choice.enrollmentType,
      remark: choice.remark,
      tuitionFee: choice.tuitionFee,
      enrollmentMajor: choice.enrollmentMajor,
      curUnit: choice.curUnit,
      majorScores: choice.majorScores || [],
      school: choice.school || null,
    } as any

    if (existingIndex >= 0) {
      choices[existingIndex] = nextChoiceInGroup
    } else {
      choices.push(nextChoiceInGroup)
    }

    // 回写 majorGroupGroup
    const nextMajorGroupGroup = { ...majorGroupGroup, choices } as any
    const writeMajorGroupIndex = majorGroupIndex >= 0 ? majorGroupIndex : majorGroups.length - 1
    majorGroups[writeMajorGroupIndex] = nextMajorGroupGroup

    // 回写 volunteer
    const nextVolunteer = { ...volunteer, majorGroups } as any
    const writeVolunteerIndex = volunteerIndex >= 0 ? volunteerIndex : volunteers.length - 1
    volunteers[writeVolunteerIndex] = nextVolunteer

    const uniqueMgIndexes = new Set<number>()
    volunteers.forEach((v) => {
      if (typeof v.mgIndex === 'number') uniqueMgIndexes.add(v.mgIndex)
    })

    const nextGrouped: GroupedChoiceResponse = {
      ...safeGrouped,
      volunteers: volunteers as any,
      statistics: {
        ...safeGrouped.statistics,
        selected: uniqueMgIndexes.size,
      },
    }

    applyGroupedChoicesToState(nextGrouped)
  }

  // 加载志愿列表（从API）
  const loadChoicesFromAPI = async () => {
    if (fetchingChoicesRef.current) return
    try {
      fetchingChoicesRef.current = true
      const groupedData = await getChoices()
      applyGroupedChoicesToState(groupedData)
    } catch (error) {
      console.error('从API加载志愿列表失败:', error)
      // 降级：从本地存储加载
      const savedItems = await getStorage<any[]>('wishlist-items').catch(() => [])
      if (savedItems && savedItems.length > 0) {
        setWishlistItems(savedItems)
      }
    } finally {
      fetchingChoicesRef.current = false
      setChoicesLoaded(true) // 标记志愿列表已加载完成，再决定显示空状态或列表
    }
  }

  /**
   * 后台刷新志愿列表（防抖 + 合并多次写操作）
   * - 不阻塞当前 UI（按钮状态已通过本地更新即时变化）
   */
  const scheduleRefreshChoices = (delay = 400) => {
    if (refreshChoicesTimerRef.current) {
      clearTimeout(refreshChoicesTimerRef.current)
    }
    refreshChoicesTimerRef.current = setTimeout(() => {
      refreshChoicesTimerRef.current = null
      loadChoicesFromAPI()
    }, delay)
  }

  // 加载志愿列表
  useEffect(() => {
    if (activeTab === '意向志愿') {
      loadChoicesFromAPI()
    }
  }, [activeTab])

  // 意向志愿：请求后20%分数（用于「低于后20%线」标记）；若有专业组则再请求 level3 并计算专业组警示
  useEffect(() => {
    if (activeTab !== '意向志愿' || !groupedChoices?.volunteers?.length) {
      return
    }
    const majorGroupIdSet = new Set<number>()
    groupedChoices.volunteers.forEach((v) => {
      v.majorGroups?.forEach((mg) => {
        const mgId = mg.majorGroup?.mgId
        if (mgId != null && Number(mgId) > 0) majorGroupIdSet.add(Number(mgId))
      })
    })
    const allMajorGroupIds = Array.from(majorGroupIdSet)
    let cancelled = false
    // 始终请求 bottom-20，保证院校+专业模式下也能拿到 maxScore 做「低于后20%线」标记
    const bottom20Promise = getBottom20Scores()
    const level3Promise = allMajorGroupIds.length > 0
      ? getLevel3MajorIdsByMajorGroupIds(allMajorGroupIds)
      : Promise.resolve([])
    Promise.all([bottom20Promise, level3Promise]).then(([bottom20Res, level3Result]) => {
      if (cancelled) return
      setBottom20MaxScore(bottom20Res.maxScore)
      if (allMajorGroupIds.length === 0) {
        setWarningMajorGroupIds(new Set())
        return
      }
      const bottom20MajorIdSet = new Set(bottom20Res.items.map((r) => r.majorId))
      const warningIds = new Set<number>()
      level3Result.forEach(({ majorGroupId, level3MajorIds }) => {
        if (level3MajorIds?.some((id) => bottom20MajorIdSet.has(id))) {
          warningIds.add(majorGroupId)
        }
      })
      setWarningMajorGroupIds(warningIds)
    }).catch((err) => {
      if (!cancelled) {
        console.error('意向志愿警示数据加载失败:', err)
        setWarningMajorGroupIds(new Set())
        setBottom20MaxScore(null)
      }
    })
    return () => { cancelled = true }
  }, [activeTab, groupedChoices])

  /**
   * 根据省份获取最高分限制
   * @param province 省份名称
   * @returns 最高分限制
   */
  const getMaxScoreByProvince = (province: string | null | undefined): number => {
    if (province === '海南') return 900
    if (province === '上海') return 660
    return 750
  }

  // 获取省份最低省控线（通过 provincial-control-lines 接口）
  const getMinControlScore = async () => {
    try {
      // 调用接口获取省控线列表（根据当前用户信息自动查询）
      const controlLines = await getProvincialControlLines()
      
      if (!controlLines || controlLines.length === 0) {
        console.warn('未获取到省控线数据')
        return 0
      }
      
      // 从省控线列表中找出最低的分数
      const scores = controlLines
        .map(line => line.score)
        .filter((score): score is number => score !== null && score !== undefined && score > 0)
      
      if (scores.length === 0) {
        console.warn('省控线数据中没有有效的分数')
        return 0
      }
      
      const minScore = Math.min(...scores)
      console.log('获取省控线成功:', {
        controlLinesCount: controlLines.length,
        minControlScore: minScore,
        allScores: scores
      })
      
      return minScore
    } catch (error) {
      console.error('获取省控线失败:', error)
      return 0
    }
  }

  // 从本地存储加载高考信息（页面加载时，不调用 API）
  const loadExamInfoFromStorage = async () => {
    try {
      const savedProvince = await getStorage<string>('examProvince')
      const savedFirstChoice = await getStorage<string>('examFirstChoice')
      const savedOptional = await getStorage<string[]>('examOptionalSubjects')
      const savedScore = await getStorage<string>('examTotalScore')
      const savedRanking = await getStorage<string>('examRanking')
      
      // 在 3+1+2 模式下，确保 secondarySubjects 不包含 preferredSubjects
      let finalSecondarySubjects: string[] = []
      if (savedOptional && savedOptional.length > 0) {
        finalSecondarySubjects = savedOptional
        // 如果是 3+1+2 模式（非 3+3 模式），过滤掉首选科目
        const PROVINCES_3_3_MODE = ['北京', '上海', '浙江', '天津', '山东', '海南', '西藏', '新疆']
        const is3Plus3Mode = savedProvince && PROVINCES_3_3_MODE.includes(savedProvince)
        if (!is3Plus3Mode && savedFirstChoice) {
          finalSecondarySubjects = finalSecondarySubjects.filter(subject => subject !== savedFirstChoice)
        }
      }
      
      const info: ExamInfo = {
        province: savedProvince || undefined,
        preferredSubjects: savedFirstChoice || undefined,
        secondarySubjects: finalSecondarySubjects.length > 0 ? finalSecondarySubjects.join(',') : undefined,
        score: savedScore ? parseInt(savedScore, 10) : undefined,
        rank: savedRanking ? parseInt(savedRanking, 10) : undefined,
      }
      
      setExamInfo(info)
      
      // 更新分数相关状态
      const score = info.score || 580
      setCurrentScore(score)
      
      // 如果省份和首选科目都有值，立即获取省控线（不等待useEffect）
      if (info.province && info.preferredSubjects && !fetchingControlScoreRef.current) {
        const updateControlScore = async () => {
          if (fetchingControlScoreRef.current) {
            return
          }
          try {
            fetchingControlScoreRef.current = true
            const controlScore = await getMinControlScore()
            setMinControlScore(controlScore)
          } catch (error) {
            console.error('获取省控线失败:', error)
          } finally {
            fetchingControlScoreRef.current = false
          }
        }
        updateControlScore()
      }
      
      // 优先从本地存储读取 scoreRange
      try {
        const savedScoreRange = await getStorage<[number, number]>('scoreRange')
        if (savedScoreRange && Array.isArray(savedScoreRange) && savedScoreRange.length === 2) {
          // 如果本地存储中有数据，直接使用
          setScoreRange(savedScoreRange)
          setScoreRangeReady(true)
          return
        }
      } catch (error) {
        console.error('读取本地存储的分数区间失败:', error)
      }
      
      // 如果没有本地数据，根据 currentScore 计算初始值
      const maxScoreLimit = getMaxScoreByProvince(info.province)
      const minScore = Math.max(0, score - 30)
      const maxScore = Math.min(maxScoreLimit, score + 20)
      setScoreRange([minScore, maxScore])
      // 保存初始分数区间
      try {
        await setStorage('scoreRange', [minScore, maxScore])
      } catch (error) {
        console.error('保存初始分数区间失败:', error)
      }
      setScoreRangeReady(true)
    } catch (error) {
      console.error('从本地存储加载高考信息失败:', error)
      setCurrentScore(580)
      // 即使失败，也允许后续按默认区间请求
      setScoreRangeReady(true)
    }
  }

  // 从 API 加载高考信息（仅在需要时调用，如更新后刷新）
  // 如果提供了 updatedInfo，直接使用，避免重复调用 API
  // 刷新招生计划数据的函数
  // - 支持传入指定区间，避免 setTimeout 闭包拿到旧 scoreRange
  // - 支持传入 shouldUseScoreFilter 参数，避免状态更新延迟导致的问题
  const refreshEnrollmentPlans = async (range?: [number, number], shouldUseScoreFilter?: boolean) => {
    if (activeTab === '专业赛道' && !fetchingEnrollmentPlansRef.current) {
      try {
        fetchingEnrollmentPlansRef.current = true
        // 如果启用了分数区间筛选，才传入 minScore 和 maxScore
        // 优先使用传入的 shouldUseScoreFilter，否则使用当前的 enableScoreFilter 状态
        const useFilter = shouldUseScoreFilter !== undefined ? shouldUseScoreFilter : enableScoreFilter
        let minScore: number | undefined
        let maxScore: number | undefined
        if (useFilter) {
          const [min, max] = range || scoreRangeRef.current
          minScore = min
          maxScore = max
        }
        console.log('refreshEnrollmentPlans 调用:', { useFilter, minScore, maxScore, shouldUseScoreFilter, enableScoreFilter })
        const plans = await getUserEnrollmentPlans(minScore, maxScore)
        setEnrollmentPlans(plans)
        console.log('重新获取用户招生计划成功:', plans)
      } catch (error) {
        console.error('重新获取用户招生计划失败:', error)
      } finally {
        fetchingEnrollmentPlansRef.current = false
      }
    }
  }

  const loadExamInfo = async (updatedInfo?: ExamInfo) => {
    try {
      // 如果提供了更新后的信息，直接使用，不调用 API
      const info = updatedInfo || await getExamInfo()
      
      // 在更新之前保存旧值，用于比较是否发生变化
      const previousProvince = examInfo?.province
      const previousScore = examInfo?.score
      const previousRank = examInfo?.rank
      const previousPreferredSubjects = examInfo?.preferredSubjects
      const previousSecondarySubjects = examInfo?.secondarySubjects
      
      setExamInfo(info)
      
      // 更新分数相关状态
      const score = info.score || 580
      setCurrentScore(score)
      
      // 如果省份和首选科目都有值，立即获取省控线（不等待useEffect）
      if (info.province && info.preferredSubjects && !fetchingControlScoreRef.current) {
        const updateControlScore = async () => {
          if (fetchingControlScoreRef.current) {
            return
          }
          try {
            fetchingControlScoreRef.current = true
            const controlScore = await getMinControlScore()
            setMinControlScore(controlScore)
            // 如果当前分数区间的最小值低于省控线，则更新左侧滑块位置
            setScoreRange((prevRange) => {
              if (prevRange[0] < controlScore) {
                const newMinValue = Math.max(controlScore, prevRange[0])
                const newRange: [number, number] = [newMinValue, prevRange[1]]
                // 保存更新后的区间
                setStorage('scoreRange', newRange).catch((error) => {
                  console.error('保存分数区间失败:', error)
                })
                return newRange
              }
              return prevRange
            })
          } catch (error) {
            console.error('获取省控线失败:', error)
          } finally {
            fetchingControlScoreRef.current = false
          }
        }
        updateControlScore()
      }
      
      // 如果高考信息或意向省份被更新，且当前是"专业赛道"页面，需要重新加载招生计划数据
      // 因为后台返回的数据会根据高考信息和意向省份变化
      if (updatedInfo) {
        // 检查省份是否发生变化
        const provinceChanged = previousProvince !== info.province
        // 检查其他关键信息是否变化（分数、位次、选科等）
        const scoreChanged = previousScore !== info.score
        const rankChanged = previousRank !== info.rank
        const subjectsChanged = previousPreferredSubjects !== info.preferredSubjects || 
                                previousSecondarySubjects !== info.secondarySubjects
        
        // 如果任何关键信息发生变化，都需要刷新数据
        if (provinceChanged || scoreChanged || rankChanged || subjectsChanged) {
          console.log('检测到高考信息变化，刷新招生计划数据:', {
            provinceChanged,
            scoreChanged,
            rankChanged,
            subjectsChanged,
            previousProvince,
            newProvince: info.province
          })
          await refreshEnrollmentPlans()
        }
      }
      
      // 优先从本地存储读取 scoreRange
      try {
        const savedScoreRange = await getStorage<[number, number]>('scoreRange')
        if (savedScoreRange && Array.isArray(savedScoreRange) && savedScoreRange.length === 2) {
          // 如果本地存储中有数据，直接使用
          setScoreRange(savedScoreRange)
          setScoreRangeReady(true)
          return
        }
      } catch (error) {
        console.error('读取本地存储的分数区间失败:', error)
      }
      
      // 如果没有本地数据，根据 currentScore 计算初始值
      const maxScoreLimit = getMaxScoreByProvince(info.province)
      const minScore = Math.max(0, score - 30)
      const maxScore = Math.min(maxScoreLimit, score + 20)
      setScoreRange([minScore, maxScore])
      // 保存初始分数区间
      try {
        await setStorage('scoreRange', [minScore, maxScore])
      } catch (error) {
        console.error('保存初始分数区间失败:', error)
      }
      setScoreRangeReady(true)
    } catch (error) {
      console.error('从 API 加载高考信息失败:', error)
      // 如果 API 失败，从本地存储加载
      await loadExamInfoFromStorage()
    }
  }

  // 页面加载时，先从本地存储加载（快速显示），然后从 API 获取最新数据
  useEffect(() => {
    const loadData = async () => {
      // 先从本地存储加载，快速显示
      await loadExamInfoFromStorage()
      // 然后从 API 获取最新数据（静默更新，不阻塞页面显示）
      // 仅在此处请求 getExamInfo（即 users/{id}），不再在 fetchUserDetail 中重复请求
      try {
        const latestInfo = await getExamInfo()
        if (latestInfo && (latestInfo.province || latestInfo.preferredSubjects || latestInfo.score)) {
          setExamInfo(latestInfo)
        }
      } catch (error) {
        console.error('从 API 获取高考信息失败:', error)
        // 如果 API 失败，继续使用本地存储的数据
      }
      // related-data-count 由 useQuestionnaireCheck 统一请求，此处不再重复调用
    }
    loadData()
  }, [])

  // 使用 useQuestionnaireCheck 返回的 related 数据初始化 storage 并决定是否弹出高考信息对话框（只执行一次）
  useEffect(() => {
    if (isCheckingQuestionnaire || relatedPreferredSubjects === undefined || hasInitializedRelatedStorageRef.current) {
      return
    }
    hasInitializedRelatedStorageRef.current = true
    const init = async () => {
      try {
        if (relatedProvinceFavoritesCount !== undefined) {
          await setStorage('previousProvinceFavoritesCount', relatedProvinceFavoritesCount)
        }
        if (majorFavoritesCount !== undefined) {
          await setStorage('previousMajorFavoritesCount', majorFavoritesCount)
        }
        if (!relatedPreferredSubjects || relatedPreferredSubjects === null || relatedPreferredSubjects === '') {
          setShowExamInfoDialog(true)
        }
      } catch (error) {
        console.error('初始化意向省份/心动专业数量失败:', error)
      }
    }
    init()
  }, [isCheckingQuestionnaire, relatedPreferredSubjects, relatedProvinceFavoritesCount, majorFavoritesCount])

  // 监听高考信息对话框关闭，刷新数据
  // 当对话框关闭时，如果是"专业赛道"页面，重新获取高考信息并刷新招生计划数据
  // 这样可以确保返回页面时数据是最新的（即使没有检测到变化，也刷新一次以确保数据同步）
  useEffect(() => {
    const wasOpen = prevShowExamInfoDialogRef.current
    prevShowExamInfoDialogRef.current = showExamInfoDialog

    // 仅当对话框从"打开"变为"关闭"时触发刷新（避免初始渲染重复请求）
    if (wasOpen && !showExamInfoDialog && activeTab === '专业赛道') {
      const refreshOnClose = async () => {
        try {
          // 重新获取最新的高考信息
          const latestInfo = await getExamInfo()
          
          // 更新 examInfo 状态（确保状态是最新的）
          setExamInfo(latestInfo)
          
          // 检查用户是否填写了高考信息（preferredSubjects）
          // 只有在未填写时才显示友好提示（已填写的用户不需要提示）
          const hasPreferredSubjects = latestInfo?.preferredSubjects && 
                                      latestInfo.preferredSubjects !== null && 
                                      latestInfo.preferredSubjects !== ''
          
          if (!hasPreferredSubjects) {
            Taro.showToast({
              title: '温馨提示：未填写高考信息将无法推荐院校，建议完善信息以获得更好的推荐体验',
              icon: 'none',
              duration: 3000,
              mask: false
            })
          }
          
          // 刷新招生计划数据（无论是否有变化，都刷新一次以确保数据同步）
          console.log('高考信息对话框关闭，刷新招生计划数据')
          await refreshEnrollmentPlans()
        } catch (error) {
          console.error('刷新数据失败:', error)
        }
      }
      
      // 延迟执行，确保对话框完全关闭
      const timer = setTimeout(() => {
        refreshOnClose()
      }, 300)
      
      return () => clearTimeout(timer)
    }
  }, [showExamInfoDialog, activeTab])

  // 监听页面显示事件（从其他页面返回时触发）
  // 当从意向省份页面返回时，检查高考信息是否变化并刷新数据
  useDidShow(() => {
    // 注意：首次进入页面也会执行 useDidShow，这里跳过首次，避免与首次加载逻辑叠加导致重复请求
    if (!hasDidShowOnceRef.current) {
      hasDidShowOnceRef.current = true
      return
    }
    
    // 处理 '意向志愿' 标签页：检查是否需要刷新志愿列表
    if (activeTab === '意向志愿' && !refreshingOnShowRef.current) {
      refreshingOnShowRef.current = true
      
      const checkAndRefreshChoices = async () => {
        try {
          // 检查是否有刷新标记
          const needRefresh = await getStorage<boolean>('needRefreshChoices')
          if (needRefresh) {
            console.log('检测到志愿变化标记，刷新列表')
            // 清除标记
            await setStorage('needRefreshChoices', false)
            // 刷新志愿列表
            await loadChoicesFromAPI()
          }
        } catch (error) {
          console.error('检查刷新标记失败:', error)
        } finally {
          refreshingOnShowRef.current = false
        }
      }
      
      // 延迟执行，确保页面完全显示
      setTimeout(() => {
        checkAndRefreshChoices()
      }, 300)
      return
    }
    
    if (activeTab === '专业赛道' && !refreshingOnShowRef.current) {
      refreshingOnShowRef.current = true
      
      const refreshOnShow = async () => {
        try {
          // 调用 related-data-count 接口检查用户是否填写了高考信息和意向省份数量
          let relatedData: any = null
          try {
            relatedData = await getUserRelatedDataCount()
            // 如果 preferredSubjects 为空或 null，自动打开高考信息对话框
            if (!relatedData.preferredSubjects || relatedData.preferredSubjects === null || relatedData.preferredSubjects === '') {
              console.log('页面显示时检测到用户未填写高考信息，自动打开高考信息对话框')
              setShowExamInfoDialog(true)
            }
          } catch (error) {
            console.error('获取用户相关数据统计失败:', error)
            // 如果接口调用失败，不阻止页面正常加载
          }
          
          // 检查意向省份（收藏省份）数量是否变化
          const previousProvinceFavoritesCount = await getStorage<number>('previousProvinceFavoritesCount')
          const currentProvinceFavoritesCount = relatedData?.provinceFavoritesCount || 0
          const provinceFavoritesCountChanged = previousProvinceFavoritesCount !== currentProvinceFavoritesCount
          
          // 如果意向省份数量变化，更新本地存储
          if (provinceFavoritesCountChanged) {
            await setStorage('previousProvinceFavoritesCount', currentProvinceFavoritesCount)
            console.log('页面显示时检测到意向省份变化，刷新招生计划数据:', {
              previousCount: previousProvinceFavoritesCount,
              currentCount: currentProvinceFavoritesCount
            })
          }

          // 检查心动专业数量是否变化（从专业探索页添加/删除专业后返回需刷新）
          const previousMajorFavoritesCount = await getStorage<number>('previousMajorFavoritesCount')
          const currentMajorFavoritesCount = relatedData?.majorFavoritesCount ?? 0
          const majorFavoritesCountChanged = previousMajorFavoritesCount !== currentMajorFavoritesCount
          if (majorFavoritesCountChanged) {
            await setStorage('previousMajorFavoritesCount', currentMajorFavoritesCount)
            console.log('页面显示时检测到心动专业变化，刷新招生计划数据:', {
              previousCount: previousMajorFavoritesCount,
              currentCount: currentMajorFavoritesCount
            })
          }
          
          // 优先从本地存储获取高考信息，避免频繁调用可能有问题的接口
          const savedProvince = await getStorage<string>('examProvince')
          const savedFirstChoice = await getStorage<string>('examFirstChoice')
          const savedOptional = await getStorage<string[]>('examOptionalSubjects')
          const savedScore = await getStorage<string>('examTotalScore')
          const savedRanking = await getStorage<string>('examRanking')
          
          // 在 3+1+2 模式下，确保 secondarySubjects 不包含 preferredSubjects
          let finalSecondarySubjects: string[] = []
          if (savedOptional && savedOptional.length > 0) {
            finalSecondarySubjects = savedOptional
            // 如果是 3+1+2 模式（非 3+3 模式），过滤掉首选科目
            const PROVINCES_3_3_MODE = ['北京', '上海', '浙江', '天津', '山东', '海南', '西藏', '新疆']
            const is3Plus3Mode = savedProvince && PROVINCES_3_3_MODE.includes(savedProvince)
            if (!is3Plus3Mode && savedFirstChoice) {
              finalSecondarySubjects = finalSecondarySubjects.filter(subject => subject !== savedFirstChoice)
            }
          }
          
          // 构建本地存储的高考信息
          const localInfo: ExamInfo = {
            province: savedProvince || undefined,
            preferredSubjects: savedFirstChoice || undefined,
            secondarySubjects: finalSecondarySubjects.length > 0 ? finalSecondarySubjects.join(',') : undefined,
            score: savedScore ? parseInt(savedScore, 10) : undefined,
            rank: savedRanking ? parseInt(savedRanking, 10) : undefined,
          }
          
          // 比较关键信息是否变化
          const provinceChanged = examInfo?.province !== localInfo.province
          const scoreChanged = examInfo?.score !== localInfo.score
          const rankChanged = examInfo?.rank !== localInfo.rank
          const subjectsChanged = examInfo?.preferredSubjects !== localInfo.preferredSubjects ||
                                  examInfo?.secondarySubjects !== localInfo.secondarySubjects
          
          // 如果任何关键信息发生变化（包括意向省份、心动专业），刷新数据
          if (provinceChanged || scoreChanged || rankChanged || subjectsChanged || provinceFavoritesCountChanged || majorFavoritesCountChanged) {
            console.log('页面显示时检测到信息变化，刷新招生计划数据:', {
              provinceChanged,
              scoreChanged,
              rankChanged,
              subjectsChanged,
              provinceFavoritesCountChanged,
              majorFavoritesCountChanged,
              oldProvince: examInfo?.province,
              newProvince: localInfo.province,
              previousProvinceFavoritesCount,
              currentProvinceFavoritesCount
            })
            // 更新 examInfo 状态
            if (provinceChanged || scoreChanged || rankChanged || subjectsChanged) {
              setExamInfo(localInfo)
            }
            // 刷新招生计划数据
            await refreshEnrollmentPlans()
          }
        } catch (error) {
          console.error('页面显示时刷新数据失败:', error)
        } finally {
          refreshingOnShowRef.current = false
        }
      }
      
      // 延迟执行，确保页面完全显示
      setTimeout(() => {
        refreshOnShow()
      }, 300)
    }
  })

  // 使用 ref 防止重复调用省控线接口
  const fetchingControlScoreRef = useRef(false)

  // 监听 examInfo 变化，更新省控线（统一在这里处理，避免重复调用）
  useEffect(() => {
    if (examInfo?.province && examInfo?.preferredSubjects && !fetchingControlScoreRef.current) {
      const updateControlScore = async () => {
        // 如果正在获取中，避免重复调用
        if (fetchingControlScoreRef.current) {
          return
        }
        
        try {
          fetchingControlScoreRef.current = true
          const controlScore = await getMinControlScore()
          setMinControlScore(controlScore)
          // 如果当前分数区间的最小值低于省控线，则更新左侧滑块位置
          setScoreRange((prevRange) => {
            if (prevRange[0] < controlScore) {
              const newMinValue = Math.max(controlScore, prevRange[0])
              const newRange: [number, number] = [newMinValue, prevRange[1]]
              // 保存更新后的区间
              setStorage('scoreRange', newRange).catch((error) => {
                console.error('保存分数区间失败:', error)
              })
              return newRange
            }
            return prevRange
          })
        } finally {
          fetchingControlScoreRef.current = false
        }
      }
      updateControlScore()
    }
  }, [examInfo?.province, examInfo?.preferredSubjects])

  // 用户详情/高考信息已在 loadData 中通过 getExamInfo（即 users/{id}）统一请求，不再单独 useEffect 重复请求

  // 监听 wishlistItems 变化，更新志愿数量
  useEffect(() => {
    const counts: Record<string, number> = {}
    wishlistItems.forEach((item: any) => {
      if (item.majorCode) {
        counts[item.majorCode] = (counts[item.majorCode] || 0) + 1
      }
    })
    setWishlistCounts(counts)
  }, [wishlistItems])

  // 监听滚动，显示返回顶部按钮
  useEffect(() => {
    // 小程序中需要使用 Taro 的页面滚动事件
    // 这里使用一个简单的方案：当列表项超过一定数量时显示返回顶部按钮
    if (activeTab === '意向志愿' && wishlistItems.length > 5) {
      setShowBackToTop(true)
    } else {
      setShowBackToTop(false)
    }
  }, [activeTab, wishlistItems.length])

  // 当省控线或省份最高分变化时，确保分数区间在有效范围内（min 和 max 之间）
  useEffect(() => {
    if (activeTab === '专业赛道' && scoreRangeReady) {
      const maxScoreLimit = getMaxScoreByProvince(examInfo?.province)
      const minLimit = minControlScore || 0
      const maxLimit = maxScoreLimit
      
      // 使用函数式更新，确保使用最新的 scoreRange 值
      setScoreRange(prevRange => {
        let newMin = prevRange[0]
        let newMax = prevRange[1]
        let needUpdate = false
        
        // 如果最小值小于 min，调整到 min
        if (prevRange[0] < minLimit) {
          newMin = minLimit
          needUpdate = true
        }
        
        // 如果最大值大于 max，调整到 max
        if (prevRange[1] > maxLimit) {
          newMax = maxLimit
          needUpdate = true
        }
        
        // 确保最小值不超过最大值
        if (newMin > newMax) {
          newMin = minLimit
          newMax = maxLimit
          needUpdate = true
        }
        
        if (needUpdate && newMin <= newMax) {
          const adjustedRange: [number, number] = [newMin, newMax]
          // 保存调整后的范围
          setStorage('scoreRange', adjustedRange).catch(error => {
            console.error('保存调整后的分数区间失败:', error)
          })
          // 仅在启用筛选时刷新院校探索数据
          if (enableScoreFilter) {
            refreshEnrollmentPlans(adjustedRange)
          }
          return adjustedRange
        }
        
        return prevRange
      })
    }
  }, [minControlScore, examInfo?.province, activeTab, scoreRangeReady, enableScoreFilter])

  // 处理最低分输入框的变化
  const handleMinInputChange = async (value: string) => {
    if (!enableScoreFilter) return
    
    const minValue = parseInt(value, 10)
    if (isNaN(minValue)) {
      return
    }
    
    // 验证范围：使用 RangeSlider 的 min 和 max
    const maxScoreLimit = getMaxScoreByProvince(examInfo?.province)
    const minLimit = minControlScore || 0
    const maxLimit = maxScoreLimit
    
    // 验证 min 是否在有效范围内
    if (minValue < minLimit || minValue > maxLimit) {
      Taro.showToast({
        title: `最低分必须在 ${minLimit}-${maxLimit} 之间`,
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    // 验证 min 不能大于当前的 max
    if (minValue > scoreRange[1]) {
      Taro.showToast({
        title: '最低分不能大于最高分',
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    // 更新 scoreRange
    const newRange: [number, number] = [minValue, scoreRange[1]]
    await handleScoreRangeChange(newRange)
  }

  // 处理最高分输入框的变化
  const handleMaxInputChange = async (value: string) => {
    const maxValue = parseInt(value, 10)
    if (isNaN(maxValue)) {
      return
    }
    
    // 验证范围：使用 RangeSlider 的 min 和 max
    const maxScoreLimit = getMaxScoreByProvince(examInfo?.province)
    const minLimit = minControlScore || 0
    const maxLimit = maxScoreLimit
    
    // 验证 max 是否在有效范围内
    if (maxValue < minLimit || maxValue > maxLimit) {
      Taro.showToast({
        title: `最高分必须在 ${minLimit}-${maxLimit} 之间`,
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    // 验证 max 不能小于当前的 min
    if (maxValue < scoreRange[0]) {
      Taro.showToast({
        title: '最高分不能小于最低分',
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    // 更新 scoreRange
    const newRange: [number, number] = [scoreRange[0], maxValue]
    await handleScoreRangeChange(newRange)
  }

  // 处理分数区间变化
  const handleScoreRangeChange = async (newRange: [number, number]) => {
    // 使用 RangeSlider 的 min 和 max 作为限制范围
    const maxScoreLimit = getMaxScoreByProvince(examInfo?.province)
    const minLimit = minControlScore || 0
    const maxLimit = maxScoreLimit
    
    // 确保最小值不低于省控线（min）
    const minValue = Math.max(newRange[0], minLimit)
    // 确保最大值不超过省份最高分限制（max）
    const maxValue = Math.min(newRange[1], maxLimit)
    const finalRange: [number, number] = [minValue, maxValue]
    
    if (finalRange[0] <= finalRange[1]) {
      setScoreRange(finalRange)
      try {
        await setStorage('scoreRange', finalRange)
      } catch (error) {
        console.error('保存分数区间失败:', error)
      }

      // 专业赛道：分数区间变化后，防抖刷新院校探索数据（仅在启用筛选时）
      if (activeTab === '专业赛道' && enableScoreFilter) {
        if (refreshEnrollmentPlansTimerRef.current) {
          clearTimeout(refreshEnrollmentPlansTimerRef.current)
        }
        refreshEnrollmentPlansTimerRef.current = setTimeout(() => {
          refreshEnrollmentPlansTimerRef.current = null
          // 直接使用本次滑块的最新值，避免闭包拿到旧 scoreRange
          refreshEnrollmentPlans(finalRange)
        }, 400)
      }
    }
  }

  // 删除志愿项
  const handleDeleteClick = (index: number) => {
    setItemToDelete(index)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteWishlistItem = async () => {
    try {
      // 如果是删除单个专业
      if (choiceToDelete) {
        await deleteChoice(choiceToDelete.choiceId)

        // 最佳实践：先本地更新 UI，再后台刷新校准
        removeChoiceIdsLocally([choiceToDelete.choiceId])
        scheduleRefreshChoices()
        
        Taro.showToast({
          title: '删除成功',
          icon: 'success',
          duration: 2000
        })
        
        setChoiceToDelete(null)
      } else if (groupToDelete) {
        // 如果是删除专业组
        const ids = Array.from(
          new Set(
            (groupToDelete.items || [])
              .map((item: any) => item?.id)
              .filter((id: any) => typeof id === 'number' && !Number.isNaN(id)),
          ),
        )

        if (ids.length === 0) {
          Taro.showToast({
            title: '没有可删除的志愿项',
            icon: 'none',
            duration: 2000,
          })
          setGroupToDelete(null)
          setDeleteConfirmOpen(false)
          return
        }

        const result = await removeMultipleChoices(ids)

        // 最佳实践：先本地更新 UI，再后台刷新校准
        removeChoiceIdsLocally(ids)
        scheduleRefreshChoices()
        
        const failedCount = result?.failed?.length || 0
        if (failedCount > 0) {
          Taro.showToast({
            title: `删除完成：成功${result.deleted || 0}条，失败${failedCount}条`,
            icon: 'none',
            duration: 2500,
          })
        } else {
          Taro.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 2000,
          })
        }
        
        setGroupToDelete(null)
      } else if (itemToDelete !== null) {
        // 删除单个志愿项
        const deletedItem = wishlistItems[itemToDelete]
        
        if (deletedItem?.id) {
          await deleteChoice(deletedItem.id)

          // 最佳实践：先本地更新 UI，再后台刷新校准
          removeChoiceIdsLocally([deletedItem.id])
          scheduleRefreshChoices()
          
          Taro.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 2000
          })
        } else {
          // 降级：从本地存储删除
          const newItems = wishlistItems.filter((_, i) => i !== itemToDelete)
          await setStorage('wishlist-items', newItems)
          setWishlistItems(newItems)
        }
        
        setItemToDelete(null)
      }
    } catch (error: any) {
      console.error('删除失败:', error)
      Taro.showToast({
        title: error?.message || '删除失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
    
    setDeleteConfirmOpen(false)
  }

  // 移动志愿项（上移/下移）
  const moveWishlistItem = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === wishlistItems.length - 1) return

    const currentItem = wishlistItems[index]
    const targetItem = wishlistItems[direction === 'up' ? index - 1 : index + 1]

    try {
      // 判断是移动专业组还是移动专业
      // 如果mgIndex相同，则是移动专业（使用adjustMajorIndex）
      // 如果mgIndex不同，则是移动专业组（使用adjustMgIndex）
      if (currentItem.mgIndex === targetItem.mgIndex && currentItem.mgIndex !== null) {
        // 移动专业：使用adjustMajorIndex
        if (currentItem.id) {
          await adjustMajorIndex(currentItem.id, { direction: direction as Direction })
        }
      } else {
        // 移动专业组：使用adjustMgIndex
        if (currentItem.mgIndex !== null) {
          await adjustMgIndex({ 
            mgIndex: currentItem.mgIndex, 
            direction: direction as Direction 
          })
        }
      }

      // 重新加载志愿列表
      await loadChoicesFromAPI()

      Taro.showToast({
        title: '移动成功',
        icon: 'success',
        duration: 1500
      })
    } catch (error: any) {
      console.error('移动志愿项失败:', error)
      Taro.showToast({
        title: error?.message || '移动失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  }

  // 返回顶部
  const scrollToTop = () => {
    Taro.pageScrollTo({
      scrollTop: 0,
      duration: 300
    })
  }

  /** 志愿卡片整体上移/下移前：捕获当前滚动与卡片位置，用于移动后恢复视口 */
  const captureScrollForVolunteerMove = (cardIndex: number, direction: 'up' | 'down') => {
    return new Promise<{ oldRectTop: number; newIndex: number }>((resolve, reject) => {
      const query = Taro.createSelectorQuery()
      query.selectViewport().scrollOffset()
      query.selectAll('.intended-majors-page__wishlist-item').boundingClientRect()
      query.exec((res) => {
        if (res?.[0] && res?.[1]) {
          const rects = res[1] as { top: number }[]
          if (rects.length <= cardIndex) {
            reject(new Error('rects'))
            return
          }
          const oldRectTop = rects[cardIndex].top
          const newIndex = direction === 'up' ? cardIndex - 1 : cardIndex + 1
          resolve({ oldRectTop, newIndex })
        } else {
          reject(new Error('query'))
        }
      })
    })
  }

  /** 志愿卡片整体移动后：根据捕获的位置恢复滚动，使被移动的卡片仍在原视口位置 */
  const restoreScrollAfterVolunteerMove = (saved: { oldRectTop: number; newIndex: number }) => {
    setTimeout(() => {
      const query = Taro.createSelectorQuery()
      query.selectViewport().scrollOffset()
      query.selectAll('.intended-majors-page__wishlist-item').boundingClientRect()
      query.exec((res) => {
        if (!res?.[0] || !res?.[1]) return
        const scrollTop1 = (res[0] as { scrollTop: number }).scrollTop
        const rects1 = res[1] as { top: number }[]
        if (rects1.length <= saved.newIndex) return
        const targetScroll = scrollTop1 + rects1[saved.newIndex].top - saved.oldRectTop
        Taro.pageScrollTo({ scrollTop: Math.max(0, targetScroll), duration: 0 })
      })
    }, 150)
  }

  /** 专业组内上移/下移前：捕获当前 scrollTop，移动后恢复 */
  const captureScrollTop = () => {
    return new Promise<number>((resolve) => {
      const query = Taro.createSelectorQuery()
      query.selectViewport().scrollOffset()
      query.exec((res) => {
        resolve((res?.[0] as { scrollTop: number })?.scrollTop ?? 0)
      })
    })
  }

  // 意向志愿列表：滑动触底自动加载下一批（每批 10 条）
  useReachBottom(() => {
    if (activeTab !== '意向志愿') return
    if (!groupedChoices?.volunteers?.length) return
    const total = groupedChoices.volunteers.length
    if (visibleVolunteerCount >= total) return
    setVisibleVolunteerCount((prev) => Math.min(prev + VOLUNTEER_PAGE_SIZE, total))
  })

  // 判断plan是否已加入志愿（根据专业组名称和备注匹配）
  const isPlanInWishlist = (plan: MajorGroupInfo): { isIn: boolean; choiceId?: number } => {
    if (!selectedSchoolData || !selectedGroupInfo) {
      return { isIn: false }
    }
    
    // 获取目标专业组信息
    const targetMajorGroupName = selectedGroupInfo.majorGroupName
    // 从 selectedGroupInfo 或 selectedPlanData 获取 majorGroupId
    const targetMajorGroupId = selectedGroupInfo.majorGroupId || selectedPlanData?.majorGroupId || selectedPlanData?.majorGroup?.mgId || null
    // 优先使用当前 plan 的 remark 和 enrollmentMajor，而不是 selectedPlanData 的
    // 因为 selectedPlanData 可能是第一个 plan 的数据，不是当前 plan 的数据
    const targetRemark = plan.remark || null
    const targetEnrollmentMajor = plan.enrollmentMajor || null
    
    // 院校模式下 targetMajorGroupId 和 targetMajorGroupName 可能都为空，仍可仅凭学校+备注+招生专业匹配，不在此处提前返回
    // if (!targetMajorGroupName && !targetMajorGroupId) return { isIn: false } 已移除

    // 获取学校代码（从 groupedChoices 中获取）
    let schoolCode: string | undefined
    if (groupedChoices && groupedChoices.volunteers.length > 0) {
      const volunteer = groupedChoices.volunteers.find(v => v.school.name === selectedSchoolData.schoolName)
      schoolCode = volunteer?.school.code
    }
    
    // 优先从 groupedChoices 中查找（最准确，直接从API返回的数据判断）
    if (groupedChoices && groupedChoices.volunteers.length > 0) {
      // 遍历所有志愿者，查找匹配的学校
      for (const volunteer of groupedChoices.volunteers) {
        // 匹配学校：优先通过学校代码，其次通过学校名称
        const isSchoolMatch = 
          (schoolCode && volunteer.school.code === schoolCode) ||
          volunteer.school.name === selectedSchoolData.schoolName ||
          volunteer.school.name?.trim() === selectedSchoolData.schoolName?.trim()
        
        if (isSchoolMatch) {
          // 遍历该学校下的所有专业组
          for (const majorGroup of volunteer.majorGroups) {
            // 遍历该专业组下的所有 choice
            for (const choice of majorGroup.choices) {
              // 获取志愿中的专业组信息
              const choiceMajorGroupName = choice.majorGroupInfo || majorGroup.majorGroup?.mgName || null
              const choiceMajorGroupId = choice.majorGroupId || majorGroup.majorGroup?.mgId || null
              const choiceRemark = choice.remark || null
              const choiceEnrollmentMajor = choice.enrollmentMajor || null
              
              // 优先使用 majorGroupId 匹配（最准确）
              let isGroupMatch = false
              if (targetMajorGroupId && choiceMajorGroupId) {
                // 确保类型一致（都转为数字或字符串）
                isGroupMatch = (
                  Number(targetMajorGroupId) === Number(choiceMajorGroupId) ||
                  String(targetMajorGroupId) === String(choiceMajorGroupId)
                )
              } else if (targetMajorGroupName && choiceMajorGroupName) {
                // 如果没有 majorGroupId，则使用名称匹配（精确匹配）
                isGroupMatch = (
                  choiceMajorGroupName === targetMajorGroupName ||
                  choiceMajorGroupName.trim() === targetMajorGroupName.trim()
                )
              } else if (!targetMajorGroupId && !choiceMajorGroupId) {
                // 院校模式：双方都无专业组 ID，同一学校下视为同一组，仅用备注+招生专业区分
                isGroupMatch = true
              }
              
              if (!isGroupMatch) {
                // 如果专业组不匹配，直接跳过
                continue
              }
              
              // 匹配备注（必须精确匹配）
              let isRemarkMatch = false
              if (!targetRemark && !choiceRemark) {
                isRemarkMatch = true
              } else if (targetRemark && choiceRemark) {
                isRemarkMatch = (
                  choiceRemark === targetRemark ||
                  choiceRemark.trim() === targetRemark.trim()
                )
              } else {
                isRemarkMatch = false
              }
              
              // 匹配招生专业（必须精确匹配）
              let isEnrollmentMajorMatch = false
              const targetMajor = targetEnrollmentMajor?.trim() || null
              const choiceMajor = choiceEnrollmentMajor?.trim() || null
              
              if (!targetMajor && !choiceMajor) {
                isEnrollmentMajorMatch = true
              } else if (targetMajor && choiceMajor) {
                isEnrollmentMajorMatch = (choiceMajor === targetMajor)
              } else {
                isEnrollmentMajorMatch = false
              }
              
              // 只有当专业组名称匹配，且备注和招生专业都匹配时，才认为已加入志愿
              if (isRemarkMatch && isEnrollmentMajorMatch) {
                return { isIn: true, choiceId: choice.id }
              }
            }
          }
        }
      }
    }
    
    return { isIn: false }
  }

  // 处理plan加入志愿
  const handleAddPlanToWishlist = async (plan: MajorGroupInfo) => {
    if (!selectedSchoolData || !selectedGroupInfo) {
      Taro.showToast({
        title: '学校信息缺失',
        icon: 'none'
      })
      return
    }

    const { isIn, choiceId } = isPlanInWishlist(plan)
    
    if (isIn && choiceId) {
      // 移除志愿（显示确认框）
      setChoiceToDelete({
        choiceId,
        majorName: plan.enrollmentMajor || '该专业'
      })
      setDeleteConfirmOpen(true)
      return
    }

    try {
      // 找到对应的plan数据
      let matchedPlan: any = selectedPlanData
      
      if (!matchedPlan) {
        // 如果没有 selectedPlanData，尝试从 groupedChoices 中获取信息
        // 或者使用 plan 数据本身
        matchedPlan = {
          majorGroupId: selectedGroupInfo.majorGroupId || null,
          schoolCode: groupedChoices?.volunteers.find(v => v.school.name === selectedSchoolData.schoolName)?.school.code || null,
          enrollmentMajor: plan.enrollmentMajor || null,
          batch: null,
          majorGroupInfo: null,
          subjectSelectionMode: null,
          studyPeriod: plan.studyPeriod || null,
          enrollmentQuota: plan.enrollmentQuota || null,
          remark: plan.remark || null,
          tuitionFee: null,
          curUnit: null,
          majorScores: null,
        }
      }

      // 构建创建志愿的DTO
      const createChoiceDto: CreateChoiceDto = {
        mgId: matchedPlan.majorGroupId || selectedGroupInfo.majorGroupId || null,
        schoolCode: matchedPlan.schoolCode || groupedChoices?.volunteers.find(v => v.school.name === selectedSchoolData.schoolName)?.school.code || null,
        enrollmentMajor: plan.enrollmentMajor || matchedPlan.enrollmentMajor || null,
        batch: matchedPlan.batch || null,
        majorGroupInfo: matchedPlan.majorGroupInfo || null,
        subjectSelectionMode: matchedPlan.subjectSelectionMode || null,
        studyPeriod: plan.studyPeriod || matchedPlan.studyPeriod || null,
        enrollmentQuota: plan.enrollmentQuota || matchedPlan.enrollmentQuota || null,
        // 优先使用当前 plan 的 remark，即使为空字符串也要使用（不能回退到 matchedPlan.remark）
        remark: plan.remark !== undefined && plan.remark !== null ? plan.remark : (matchedPlan?.remark || null),
        tuitionFee: matchedPlan.tuitionFee || null,
        curUnit: matchedPlan.curUnit || null,
        majorScores: matchedPlan.majorScores?.map((score: any) => ({
          schoolCode: score.schoolCode,
          province: score.province,
          year: score.year,
          subjectSelectionMode: score.subjectSelectionMode,
          batch: score.batch,
          minScore: score.minScore,
          minRank: score.minRank,
          admitCount: score.admitCount,
          enrollmentType: score.enrollmentType,
        })) || null,
      }

      // 调用API创建志愿
      const createdChoice = await createChoice(createChoiceDto)

      // 最佳实践：先本地更新 UI，再后台刷新校准
      upsertChoiceLocally(createdChoice)
      scheduleRefreshChoices()

      Taro.showToast({
        title: '已加入志愿',
        icon: 'success',
        duration: 2000
      })
    } catch (error: any) {
      console.error('加入志愿失败:', error)
      Taro.showToast({
        title: error?.message || '加入志愿失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  }

  const pageTitle = activeTab === '意向志愿' ? '志愿填报' : '院校探索'
  const pageDescription = activeTab === '意向志愿' 
    ? '基于特质匹配的志愿推荐' 
    : '探索各专业对应的院校'
  const isProfessionalTrack = activeTab !== '意向志愿'

  if (loading) {
    return (
      <View className="intended-majors-page">
        <View className="intended-majors-page__loading">
          <Text>加载中...</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  // 计算前20%的专业
  const allMajorsWithScores = data
    .map(item => ({
      code: item.major.code,
      name: item.major.name,
      score: parseFloat(item.major.score || '0')
    }))
    .filter(major => major.score > 0)
  
  const sortedAllMajors = [...allMajorsWithScores].sort((a, b) => b.score - a.score)
  const top20PercentThresholdIndex = sortedAllMajors.length > 0 
    ? Math.ceil(sortedAllMajors.length * 0.2) 
    : 0
  const top20PercentMajorCodes = new Set(
    sortedAllMajors.slice(0, top20PercentThresholdIndex).map(m => m.code)
  )
  const top20PercentInWishlist = wishlistItems.filter(item => {
    return top20PercentMajorCodes.has(item.majorCode)
  })
  const top20PercentCount = top20PercentInWishlist.length

  return (
    <View className="intended-majors-page">
      
      {/* 头部 */}
      <View className="intended-majors-page__header">
        <View className="intended-majors-page__header-content">
          <View className="intended-majors-page__header-top">
            <View className="intended-majors-page__header-title-section">
              <Text className="intended-majors-page__title">{pageTitle}</Text>
              <Text className="intended-majors-page__subtitle">{pageDescription}</Text>
            </View>
            <View className="intended-majors-page__header-actions">
              {activeTab !== '意向志愿' && (
                <Button
                  onClick={() => setShowExamInfoDialog(true)}
                  className="intended-majors-page__action-button"
                  size="sm"
                >
                  高考信息
                </Button>
              )}
              {activeTab === '意向志愿' ? (
                <Button
                  onClick={handleExportWishlist}
                  className="intended-majors-page__action-button"
                  size="sm"
                  disabled={isExporting || !groupedChoices || !groupedChoices.volunteers || groupedChoices.volunteers.length === 0}
                >
                  {isExporting ? '导出中...' : '📄 导出志愿'}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    Taro.navigateTo({
                      url: '/pages/assessment/provinces/index'
                    })
                  }}
                  className="intended-majors-page__action-button"
                  size="sm"
                >
                  意向省份
                </Button>
              )}
            </View>
          </View>
        </View>
        <View className="intended-majors-page__wave" />
      </View>

      {/* 分数区间筛选条 - 仅在专业赛道tab显示 */}
      {isProfessionalTrack && (
        <View className="intended-majors-page__score-filter">
          <View className="intended-majors-page__score-filter-content">
            <View className="intended-majors-page__score-filter-header">
              <View 
                className="intended-majors-page__score-filter-checkbox-wrapper"
                onClick={(e) => {
                  e.stopPropagation()
                  const newValue = !enableScoreFilter
                  console.log('Checkbox clicked:', { 
                    current: enableScoreFilter, 
                    newValue,
                    willBeDisabled: !newValue
                  })
                  setEnableScoreFilter(newValue)
                  // 立即刷新数据，传入新的筛选状态，避免状态更新延迟导致的问题
                  refreshEnrollmentPlans(undefined, newValue)
                }}
                onTouchStart={(e) => {
                  e.stopPropagation()
                  console.log('Checkbox touch start')
                }}
              >
                <View 
                  className={`intended-majors-page__score-filter-checkbox ${enableScoreFilter ? 'intended-majors-page__score-filter-checkbox--checked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log('Checkbox inner clicked')
                  }}
                >
                  {enableScoreFilter && (
                    <Text className="intended-majors-page__score-filter-checkbox-icon">✓</Text>
                  )}
                </View>
              </View>
              <Text className="intended-majors-page__score-filter-tip">
                使用分数区间筛选院校
              </Text>
            </View>
            <View className="intended-majors-page__slider-container">
              <RangeSlider
                min={minControlScore || 0}
                max={getMaxScoreByProvince(examInfo?.province)}
                value={scoreRange}
                onChange={handleScoreRangeChange}
                step={1}
                currentScore={currentScore}
                disabled={!enableScoreFilter}
              />
              <View className="intended-majors-page__slider-labels">
                <View className="intended-majors-page__slider-label">
                  <Text className="intended-majors-page__slider-label-text">最低:</Text>
                  <Text className="intended-majors-page__slider-label-value">{minControlScore || 0}</Text>
                </View>
                <View className="intended-majors-page__slider-label">
                  <Text className="intended-majors-page__slider-label-text">区间:</Text>
                  <View className="intended-majors-page__slider-label-range-inputs">
                    <Input
                      type="number"
                      value={tempMinValue !== null ? tempMinValue : String(scoreRange[0])}
                      disabled={!enableScoreFilter}
                      onInput={(e) => {
                        if (!enableScoreFilter) return
                        // 用户输入时，实时更新临时值（允许为空，让用户继续输入）
                        setTempMinValue(e.detail.value)
                      }}
                      onBlur={(e) => {
                        if (!enableScoreFilter) return
                        const value = e.detail.value
                        // 清空临时值，恢复显示 scoreRange 的值
                        setTempMinValue(null)
                        // 只有在有值且有效时才更新
                        if (value !== undefined && value !== null && value !== '') {
                          handleMinInputChange(value)
                        }
                        // 如果输入为空或无效，不更新，value 会自动恢复为 scoreRange[0]
                      }}
                      className="intended-majors-page__slider-label-input"
                    />
                    <Text className="intended-majors-page__slider-label-separator">-</Text>
                    <Input
                      type="number"
                      value={tempMaxValue !== null ? tempMaxValue : String(scoreRange[1])}
                      disabled={!enableScoreFilter}
                      onInput={(e) => {
                        if (!enableScoreFilter) return
                        // 用户输入时，实时更新临时值（允许为空，让用户继续输入）
                        setTempMaxValue(e.detail.value)
                      }}
                      onBlur={(e) => {
                        if (!enableScoreFilter) return
                        const value = e.detail.value
                        // 清空临时值，恢复显示 scoreRange 的值
                        setTempMaxValue(null)
                        // 只有在有值且有效时才更新
                        if (value !== undefined && value !== null && value !== '') {
                          handleMaxInputChange(value)
                        }
                        // 如果输入为空或无效，不更新，value 会自动恢复为 scoreRange[1]
                      }}
                      className="intended-majors-page__slider-label-input"
                    />
                  </View>
                </View>
                <View className="intended-majors-page__slider-label">
                  <Text className="intended-majors-page__slider-label-text">最高:</Text>
                  <Text className="intended-majors-page__slider-label-value">{getMaxScoreByProvince(examInfo?.province)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 内容区域 */}
      <View className="intended-majors-page__content">
        {activeTab === '意向志愿' ? (
          // 意向志愿tab：等志愿列表加载完成后再判断显示空状态或列表
          !choicesLoaded ? (
            <View className="intended-majors-page__empty">
              <Text className="intended-majors-page__empty-icon">⏳</Text>
              <Text className="intended-majors-page__empty-text">加载志愿列表中...</Text>
            </View>
          ) : wishlistItems.length === 0 ? (
            <View className="intended-majors-page__empty">
              <Text className="intended-majors-page__empty-icon">🔍</Text>
              <Text className="intended-majors-page__empty-text">暂无志愿数据</Text>
              {majorFavoritesCount === 0 ? (
                <View
                  className="intended-majors-page__empty-desc intended-majors-page__empty-desc--link"
                  onClick={() => Taro.navigateTo({ url: '/pages/majors/index' })}
                >
                  <Text>点击探索心动专业</Text>
                </View>
              ) : (
                <Text className="intended-majors-page__empty-desc">
                  请先进行院校探索，添加心仪的志愿
                </Text>
              )}
              <Button
                disabled={majorFavoritesCount === 0}
                onClick={() => {
                  Taro.navigateTo({
                    url: '/pages/majors/intended/index?tab=专业赛道'
                  })
                }}
                className="intended-majors-page__empty-button"
              >
                前往院校探索
              </Button>
            </View>
          ) : (
            <View className="intended-majors-page__wishlist">
              {groupedChoices && groupedChoices.volunteers.length > 0 ? (
                // 直接使用 groupedChoices 的数据结构，按 mgIndex 排序，分段加载（每次 10 条，滑动触底自动加载）
                (() => {
                  const sortedVolunteers = [...groupedChoices.volunteers].sort(
                    (a, b) => (a.mgIndex ?? 999999) - (b.mgIndex ?? 999999)
                  )
                  const volunteersToShow = sortedVolunteers.slice(0, visibleVolunteerCount)
                  // 院校+专业模式：没有任何专业组信息时，说明文案不同
                  const hasAnyMajorGroup = groupedChoices.volunteers.some((v) =>
                    v.majorGroups?.some((mg) => mg.majorGroup != null)
                  )
                  const warningLegendText = hasAnyMajorGroup
                    ? '⚠️表示该专业组包含热爱能量低的专业'
                    : '⚠️表示该专业的热爱能量低'
                  return (
                    <>
                      <Text className="intended-majors-page__warning-legend">{warningLegendText}</Text>
                  {volunteersToShow.map((volunteer, volunteerIdx) => {
                    const volunteerNumber = volunteerIdx + 1
                    const school = volunteer.school
                    const schoolFeatures = school?.features || ''
                    const provinceName = school?.provinceName || ''
                    const cityName = school?.cityName || ''
                    const belong = school?.belong || ''
                    const enrollmentRate = school?.enrollmentRate ? `${school.enrollmentRate}` : '0'
                    const employmentRate = school?.employmentRate ? `${school.employmentRate}` : '0'
                    
                    // 处理学校特征标签
                    let validFeatures: string[] = []
                    if (schoolFeatures) {
                      const featureStr = String(schoolFeatures).trim()
                      if (featureStr && featureStr !== '[]' && featureStr !== 'null' && featureStr !== 'undefined') {
                        try {
                          const parsed = JSON.parse(featureStr)
                          if (Array.isArray(parsed)) {
                            validFeatures = parsed.filter((f: any) => f && String(f).trim())
                          } else {
                            validFeatures = featureStr.split(',').filter((f: string) => f.trim())
                          }
                        } catch {
                          validFeatures = featureStr.split(',').filter((f: string) => f.trim())
                        }
                      }
                    }
                    
                    return (
                      <Card 
                        key={`volunteer-${volunteer.mgIndex}`} 
                        className={`intended-majors-page__wishlist-item ${highlightedVolunteerId === volunteer.mgIndex ? 'intended-majors-page__wishlist-item--highlighted' : ''}`}
                      >
                        <View className="intended-majors-page__wishlist-item-content">
                          {/* 志愿编号和操作按钮（删除、上移、下移）- 同一行 */}
                          <View className="intended-majors-page__wishlist-item-header-row">
                            <View className="intended-majors-page__wishlist-item-volunteer-badge">
                              <Text className="intended-majors-page__wishlist-item-volunteer-text">志愿{volunteerNumber}</Text>
                            </View>
                            {/* 专业组的删除、上移、下移按钮 - 放到志愿编号同一行的右侧 */}
                            <View className="intended-majors-page__wishlist-item-volunteer-actions">
                              {/* 删除按钮：删除整个志愿（所有 majorGroups） */}
                              <Button
                                onClick={async () => {
                                  if (checkExporting()) return
                                  // 收集所有 choices
                                  const allChoices = volunteer.majorGroups.flatMap(mg => mg.choices)
                                  setGroupToDelete({
                                    items: allChoices.map(c => ({ id: c.id, enrollmentMajor: c.enrollmentMajor })),
                                    schoolName: school?.name || '',
                                    majorGroupName: '该志愿'
                                  })
                                  setDeleteConfirmOpen(true)
                                }}
                                className="intended-majors-page__wishlist-item-major-group-delete"
                                size="sm"
                                variant="ghost"
                              >
                                <Text className="intended-majors-page__wishlist-item-major-group-delete-text">删除</Text>
                              </Button>
                              {/* 上移按钮：移动整个志愿 - 始终显示 */}
                              {(() => {
                                const currentVolunteerIndex = groupedChoices?.volunteers.findIndex(v => v.mgIndex === volunteer.mgIndex) ?? -1
                                const canMoveUp = currentVolunteerIndex > 0
                                
                                return (
                                  <Button
                                    onClick={async () => {
                                      if (!canMoveUp || volunteer.mgIndex === null) return
                                      
                                      // 记录移动前的mgIndex，移动后新的mgIndex会是 mgIndex - 1
                                      const originalMgIndex = volunteer.mgIndex
                                      const newMgIndex = originalMgIndex - 1
                                      // 移动前捕获滚动与卡片位置，移动后恢复使卡片仍在原视口位置
                                      let scrollSaved: { oldRectTop: number; newIndex: number } | null = null
                                      try {
                                        scrollSaved = await captureScrollForVolunteerMove(currentVolunteerIndex, 'up')
                                      } catch (_) {}
                                      
                                      await adjustMgIndex({ 
                                        mgIndex: originalMgIndex, 
                                        direction: 'up' as Direction 
                                      })
                                      await loadChoicesFromAPI()
                                      if (scrollSaved) restoreScrollAfterVolunteerMove(scrollSaved)
                                      
                                      // 移动完成后，高亮移动后的新位置（发出移动指令的组件）
                                      setHighlightedVolunteerId(newMgIndex)
                                      setTimeout(() => {
                                        setHighlightedVolunteerId(null)
                                      }, 1200) // 1.2秒后清除高亮
                                      
                                      Taro.showToast({
                                        title: '移动成功',
                                        icon: 'success',
                                        duration: 1500
                                      })
                                    }}
                                    className="intended-majors-page__wishlist-item-major-group-move"
                                    size="sm"
                                    variant="ghost"
                                    disabled={!canMoveUp || volunteer.mgIndex === null}
                                  >
                                    <Text className="intended-majors-page__wishlist-item-major-group-move-text">上移</Text>
                                  </Button>
                                )
                              })()}
                              {/* 下移按钮：移动整个志愿 - 始终显示 */}
                              {(() => {
                                const currentVolunteerIndex = groupedChoices?.volunteers.findIndex(v => v.mgIndex === volunteer.mgIndex) ?? -1
                                const canMoveDown = currentVolunteerIndex < (groupedChoices?.volunteers.length ?? 0) - 1
                                
                                return (
                                  <Button
                                    onClick={async () => {
                                      if (!canMoveDown || volunteer.mgIndex === null) return
                                      
                                      // 记录移动前的mgIndex，移动后新的mgIndex会是 mgIndex + 1
                                      const originalMgIndex = volunteer.mgIndex
                                      const newMgIndex = originalMgIndex + 1
                                      // 移动前捕获滚动与卡片位置，移动后恢复使卡片仍在原视口位置
                                      let scrollSaved: { oldRectTop: number; newIndex: number } | null = null
                                      try {
                                        scrollSaved = await captureScrollForVolunteerMove(currentVolunteerIndex, 'down')
                                      } catch (_) {}
                                      
                                      await adjustMgIndex({ 
                                        mgIndex: originalMgIndex, 
                                        direction: 'down' as Direction 
                                      })
                                      await loadChoicesFromAPI()
                                      if (scrollSaved) restoreScrollAfterVolunteerMove(scrollSaved)
                                      
                                      // 移动完成后，高亮移动后的新位置（发出移动指令的组件）
                                      setHighlightedVolunteerId(newMgIndex)
                                      setTimeout(() => {
                                        setHighlightedVolunteerId(null)
                                      }, 1200) // 1.2秒后清除高亮
                                      
                                      Taro.showToast({
                                        title: '移动成功',
                                        icon: 'success',
                                        duration: 1500
                                      })
                                    }}
                                    className="intended-majors-page__wishlist-item-major-group-move"
                                    size="sm"
                                    variant="ghost"
                                    disabled={!canMoveDown || volunteer.mgIndex === null}
                                  >
                                    <Text className="intended-majors-page__wishlist-item-major-group-move-text">下移</Text>
                                  </Button>
                                )
                              })()}
                            </View>
                          </View>
                          
                          {/* 学校相关信息 - 放到志愿编号下面 */}
                          <View className="intended-majors-page__wishlist-item-school-section">
                            {/* 学校名称 + 省份/城市/归属（同一行） */}
                            <View className="intended-majors-page__wishlist-item-name-row">
                              <Text className="intended-majors-page__wishlist-item-school">
                                {school?.name || ''}
                              </Text>
                              {(() => {
                                const locationParts: string[] = []
                                if (provinceName) locationParts.push(provinceName)
                                if (cityName) locationParts.push(cityName)
                                if (belong) locationParts.push(belong)
                                
                                return locationParts.length > 0 ? (
                                  <Text className="intended-majors-page__wishlist-item-location-inline">
                                    {locationParts.join(' · ')}
                                  </Text>
                                ) : null
                              })()}
                            </View>
                            {/* features（下一行，如果有） */}
                            {validFeatures.length > 0 && (
                              <View className="intended-majors-page__wishlist-item-features">
                                {validFeatures.map((feature, i) => (
                                  <Text key={i} className="intended-majors-page__wishlist-item-feature">
                                    {feature.trim()}
                                  </Text>
                                ))}
                              </View>
                            )}
                            {/* 升学率/就业率（下一行） */}
                            <View className="intended-majors-page__wishlist-item-rates">
                              <View className="intended-majors-page__wishlist-item-rate">
                                <Text className="intended-majors-page__wishlist-item-rate-label">升学率:</Text>
                                <Text className="intended-majors-page__wishlist-item-rate-value">{formatRatePercent(enrollmentRate)}</Text>
                              </View>
                              <View className="intended-majors-page__wishlist-item-rate">
                                <Text className="intended-majors-page__wishlist-item-rate-label">就业率:</Text>
                                <Text className="intended-majors-page__wishlist-item-rate-value">{formatRatePercent(employmentRate)}</Text>
                              </View>
                            </View>
                          </View>
                          
                          {/* 先显示 majorGroups */}
                          {volunteer.majorGroups.map((majorGroup, mgIdx) => {
                            const majorGroupName = majorGroup.majorGroup?.mgName || ''
                            // 使用 majorGroup.majorGroup.mgId 作为专业组ID
                            const mgId = majorGroup.majorGroup?.mgId
                            const majorGroupInfo = majorGroup.choices[0]?.majorGroupInfo || majorGroup.majorGroup?.mgInfo || ''
                            const groupKey = `${volunteer.mgIndex}-${mgId}-${mgIdx}`
                            const isChoicesExpanded = expandedChoicesInGroup.has(groupKey)
                            const choicesCount = majorGroup.choices.length
                            const sortedChoices = [...majorGroup.choices].sort((a, b) => (a.majorIndex ?? 999999) - (b.majorIndex ?? 999999))
                            
                            return (
                              <View key={`majorGroup-${mgIdx}`} className="intended-majors-page__wishlist-item-major-group" data-major-group="true">
                                {/* majorGroup 信息显示区域 - 专业组和选科同一行 */}
                                {majorGroup.majorGroup && (
                                  <View className="intended-majors-page__wishlist-item-major-group-info">
                                    <View className="intended-majors-page__wishlist-item-major-group-header">
                                      <View className="intended-majors-page__wishlist-item-major-group-header-left">
                                        <Text 
                                          className="intended-majors-page__wishlist-item-major-group-name" 
                                          data-major-group-name="true"
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            if (!mgId) {
                                              Taro.showToast({
                                                title: '专业组ID缺失',
                                                icon: 'none'
                                              })
                                              return
                                            }
                                            try {
                                              setLoadingGroupInfo(true)
                                              setSelectedGroupInfo({
                                                schoolName: school?.name || '',
                                                majorGroupName: majorGroupName,
                                                majorGroupId: mgId,
                                              })
                                              setSelectedSchoolData({
                                                schoolName: school?.name || '',
                                                schoolNature: school?.nature || 'public',
                                                rankDiffPer: 0,
                                                group: 0,
                                                historyScores: [],
                                                schoolFeature: schoolFeatures,
                                                belong: belong,
                                                provinceName: provinceName,
                                                cityName: cityName,
                                                enrollmentRate: enrollmentRate,
                                                employmentRate: employmentRate,
                                                majorGroupName: majorGroupName,
                                                majorGroupId: mgId,
                                              })
                                              // 使用第一个 choice 的数据作为 selectedPlanData
                                              const firstChoice = majorGroup.choices[0]
                                              setSelectedPlanData({
                                                enrollmentMajor: firstChoice?.enrollmentMajor || null,
                                                remark: firstChoice?.remark || null,
                                                subjectSelectionMode: firstChoice?.subjectSelectionMode || null,
                                                enrollmentQuota: firstChoice?.enrollmentQuota || null,
                                                studyPeriod: firstChoice?.studyPeriod || null,
                                                tuitionFee: firstChoice?.tuitionFee || null,
                                                batch: firstChoice?.batch || null,
                                                majorGroupId: mgId,
                                              } as any)
                                              
                                              // 调用 API 获取专业组信息
                                              // 确保 mgId 是数字类型
                                              const mgIdNumber = typeof mgId === 'string' ? parseInt(mgId, 10) : mgId
                                              if (!mgIdNumber || isNaN(mgIdNumber)) {
                                                Taro.showToast({
                                                  title: '专业组ID无效',
                                                  icon: 'none'
                                                })
                                                return
                                              }
                                              console.log('准备获取专业组信息，mgId:', mgIdNumber)
                                              const groupInfo = await getMajorGroupInfo(mgIdNumber)
                                              console.log('获取到的专业组信息:', groupInfo)
                                              setGroupInfoData(groupInfo)
                                              setGroupDialogOpen(true)
                                              console.log('设置弹框打开，groupDialogOpen:', true)
                                            } catch (error) {
                                              console.error('获取专业组信息失败:', error)
                                              Taro.showToast({
                                                title: '获取专业组信息失败',
                                                icon: 'none',
                                              })
                                            } finally {
                                              setLoadingGroupInfo(false)
                                            }
                                          }}
                                        >
                                          专业组: {majorGroupName}
                                          {mgId != null && warningMajorGroupIds.has(Number(mgId)) && (
                                            <Text className="intended-majors-page__wishlist-item-plan-warning"> ⚠️</Text>
                                          )}
                                        </Text>
                                        {majorGroupInfo && (
                                          <Text className="intended-majors-page__wishlist-item-major-group-subject">
                                            选科: {majorGroupInfo}
                                          </Text>
                                        )}
                                      </View>
                                      {/* 折叠/展开按钮 - 放到同一行右侧 */}
                                      <Text 
                                        className="intended-majors-page__wishlist-item-major-group-toggle"
                                        onClick={() => {
                                          if (checkExporting()) return
                                          setExpandedChoicesInGroup((prev) => {
                                            const newSet = new Set(prev)
                                            if (isChoicesExpanded) {
                                              newSet.delete(groupKey)
                                            } else {
                                              newSet.add(groupKey)
                                            }
                                            return newSet
                                          })
                                        }}
                                      >
                                        {isChoicesExpanded ? '收起' : '展开'} ({choicesCount})
                                        <Text className={`intended-majors-page__wishlist-item-major-group-arrow ${isChoicesExpanded ? 'intended-majors-page__wishlist-item-major-group-arrow--expanded' : ''}`}>
                                          ▼
                                        </Text>
                                      </Text>
                                    </View>
                                  </View>
                                )}
                                
                                {/* 然后显示 choices：有专业组时需展开才显示，院校模式（majorGroup 为空）时直接显示 */}
                                {(isChoicesExpanded || (!majorGroup.majorGroup && choicesCount > 0)) && (
                                  <View className="intended-majors-page__wishlist-item-plans">
                                    {sortedChoices.map((choice, choiceIdx) => {
                                      const loveEnergyScores = getChoiceLoveEnergyScores(choice)
                                      const loveEnergyItems = loveEnergyScores
                                        .map((s: any) => {
                                          const scoreText = normalizeLoveEnergy(s?.score)
                                          if (!scoreText) return null
                                          return {
                                            majorName: s?.majorName ? String(s.majorName) : '',
                                            scoreText,
                                          }
                                        })
                                        .filter((item: { majorName: string; scoreText: string } | null): item is { majorName: string; scoreText: string } => Boolean(item))
                                      const isSingleLoveEnergy = loveEnergyItems.length === 1
                                      const isLoveEnergyExpandable = loveEnergyItems.length > 1
                                      const isLoveEnergyExpanded = expandedLoveEnergyChoiceIds.has(choice.id)
                                      const loveEnergyDisplayText = isSingleLoveEnergy
                                        ? loveEnergyItems[0].scoreText
                                        : loveEnergyItems
                                          .map((item) => (item.majorName ? `${item.majorName}:${item.scoreText}` : item.scoreText))
                                          .join('、')

                                      // 该条已选专业是否包含「热爱能量低于后20%最高分」的项（与弹框内标记逻辑一致）
                                      const toNum = (v: unknown): number | null => {
                                        if (v == null) return null
                                        const n = typeof v === 'string' ? parseFloat(v) : Number(v)
                                        if (Number.isNaN(n)) return null
                                        if (n > 0 && n < 1) return Math.floor(n * 100)
                                        return n
                                      }
                                      const loveEnergyNums = loveEnergyScores.map((s: any) => toNum(s?.score ?? s?.loveEnergy)).filter((n): n is number => n !== null)
                                      const hasChoiceScoreBelowMax = bottom20MaxScore != null && loveEnergyNums.some((n) => n < bottom20MaxScore)

                                      return (
                                        <View 
                                          key={choiceIdx} 
                                          className={`intended-majors-page__wishlist-item-plan ${highlightedChoiceId === choice.id ? 'intended-majors-page__wishlist-item-plan--highlighted' : ''}`}
                                        >
                                          {/* enrollmentMajor + 操作按钮（移除、上移、下移） */}
                                          {choice.enrollmentMajor && (
                                            <View className="intended-majors-page__wishlist-item-plan-major">
                                              <Text className="intended-majors-page__wishlist-item-plan-major-value" data-enrollment-major="true">
                                                {choice.enrollmentMajor}
                                                {hasChoiceScoreBelowMax && (
                                                  <Text className="intended-majors-page__wishlist-item-plan-score-warning">⚠️</Text>
                                                )}
                                              </Text>
                                              {/* 操作按钮：移除、上移、下移 */}
                                              <View className="intended-majors-page__wishlist-item-plan-actions-inline">
                                                <Button
                                                  onClick={async (e) => {
                                                    e.stopPropagation()
                                                    if (checkExporting()) return
                                                    setChoiceToDelete({
                                                      choiceId: choice.id,
                                                      majorName: choice.enrollmentMajor || '该专业'
                                                    })
                                                    setDeleteConfirmOpen(true)
                                                  }}
                                                  className="intended-majors-page__wishlist-item-plan-action intended-majors-page__wishlist-item-plan-action--remove"
                                                  size="sm"
                                                  variant="ghost"
                                                >
                                                  <Text className="intended-majors-page__wishlist-item-plan-action-text">移除</Text>
                                                </Button>
                                                {/* 上移按钮：不是第一个时可以上移 */}
                                                {choiceIdx > 0 && (
                                                  <Button
                                                    onClick={async (e) => {
                                                      e.stopPropagation()
                                                      if (choice.id) {
                                                        const choiceIdToHighlight = choice.id
                                                        const scrollTop0 = await captureScrollTop()
                                                        
                                                        await adjustMajorIndex(choice.id, { direction: 'up' as Direction })
                                                        await loadChoicesFromAPI()
                                                        setTimeout(() => {
                                                          Taro.pageScrollTo({ scrollTop: scrollTop0, duration: 0 })
                                                        }, 100)
                                                        
                                                        // 移动完成后设置高亮动画
                                                        setHighlightedChoiceId(choiceIdToHighlight)
                                                        setTimeout(() => {
                                                          setHighlightedChoiceId(null)
                                                        }, 1200) // 1.2秒后清除高亮
                                                        
                                                        Taro.showToast({
                                                          title: '移动成功',
                                                          icon: 'success',
                                                          duration: 1500
                                                        })
                                                      }
                                                    }}
                                                    className="intended-majors-page__wishlist-item-plan-action intended-majors-page__wishlist-item-plan-action--move"
                                                    size="sm"
                                                    variant="ghost"
                                                  >
                                                    <Text className="intended-majors-page__wishlist-item-plan-action-text">上移</Text>
                                                  </Button>
                                                )}
                                                {/* 下移按钮：不是最后一个时可以下移 */}
                                                {choiceIdx < sortedChoices.length - 1 && (
                                                  <Button
                                                    onClick={async (e) => {
                                                      e.stopPropagation()
                                                      if (choice.id) {
                                                        const choiceIdToHighlight = choice.id
                                                        const scrollTop0 = await captureScrollTop()
                                                        
                                                        await adjustMajorIndex(choice.id, { direction: 'down' as Direction })
                                                        await loadChoicesFromAPI()
                                                        setTimeout(() => {
                                                          Taro.pageScrollTo({ scrollTop: scrollTop0, duration: 0 })
                                                        }, 100)
                                                        
                                                        // 移动完成后设置高亮动画
                                                        setHighlightedChoiceId(choiceIdToHighlight)
                                                        setTimeout(() => {
                                                          setHighlightedChoiceId(null)
                                                        }, 1200) // 1.2秒后清除高亮
                                                        
                                                        Taro.showToast({
                                                          title: '移动成功',
                                                          icon: 'success',
                                                          duration: 1500
                                                        })
                                                      }
                                                    }}
                                                    className="intended-majors-page__wishlist-item-plan-action intended-majors-page__wishlist-item-plan-action--move"
                                                    size="sm"
                                                    variant="ghost"
                                                  >
                                                    <Text className="intended-majors-page__wishlist-item-plan-action-text">下移</Text>
                                                  </Button>
                                                )}
                                              </View>
                                            </View>
                                          )}
                                          {/* remark */}
                                          {choice.remark && (
                                            <View className="intended-majors-page__wishlist-item-plan-remark">
                                              <Text className="intended-majors-page__wishlist-item-plan-remark-text">{choice.remark}</Text>
                                            </View>
                                          )}
                                          {/* 招生人数 + 热爱能量 */}
                                          {(choice.enrollmentQuota || loveEnergyItems.length > 0) && (
                                            <View className="intended-majors-page__wishlist-item-plan-info">
                                              {choice.enrollmentQuota && (
                                                <Text className="intended-majors-page__wishlist-item-plan-info-text">
                                                  招生人数: {choice.enrollmentQuota}
                                                </Text>
                                              )}
                                              {loveEnergyItems.length > 0 && (
                                                <View
                                                  className={`intended-majors-page__wishlist-item-plan-love-energy ${isLoveEnergyExpandable ? 'intended-majors-page__wishlist-item-plan-love-energy--separate' : ''}`}
                                                >
                                                  <Text
                                                    className={`intended-majors-page__wishlist-item-plan-love-energy-text ${isLoveEnergyExpanded ? 'intended-majors-page__wishlist-item-plan-love-energy-text--expanded' : ''}`}
                                                  >
                                                    热爱能量: {loveEnergyDisplayText}
                                                  </Text>
                                                  {isLoveEnergyExpandable && (
                                                    <Text
                                                      className="intended-majors-page__wishlist-item-plan-love-energy-toggle"
                                                      onClick={(e) => {
                                                        e?.stopPropagation?.()
                                                        setExpandedLoveEnergyChoiceIds((prev) => {
                                                          const next = new Set(prev)
                                                          if (next.has(choice.id)) {
                                                            next.delete(choice.id)
                                                          } else {
                                                            next.add(choice.id)
                                                          }
                                                          return next
                                                        })
                                                      }}
                                                    >
                                                      {isLoveEnergyExpanded ? '▲' : '▼'}
                                                    </Text>
                                                  )}
                                                </View>
                                              )}
                                            </View>
                                          )}
                                          {/* 分数信息 */}
                                          {choice.majorScores && choice.majorScores.length > 0 && (
                                            <View className="intended-majors-page__wishlist-item-plan-scores" data-scores="true">
                                              {choice.majorScores.map((score, scoreIndex) => (
                                                <View key={scoreIndex} className="intended-majors-page__wishlist-item-plan-score">
                                                  {score.minScore !== null && score.minScore !== undefined && (
                                                    <Text className="intended-majors-page__wishlist-item-plan-score-text" data-score="true">
                                                      {score.year}年最低分数: {Math.floor(score.minScore)}
                                                    </Text>
                                                  )}
                                                  {score.minRank !== null && (
                                                    <Text className="intended-majors-page__wishlist-item-plan-score-text" data-score="true">
                                                      最低位次: {score.minRank}
                                                      {(score as any).rankDiff ? `, ${(score as any).rankDiff}` : ''}
                                                    </Text>
                                                  )}
                                                </View>
                                              ))}
                                            </View>
                                          )}
                                        </View>
                                      )
                                    })}
                                  </View>
                                )}
                              </View>
                            )
                          })}
                        </View>
                      </Card>
                    )
                  })}
                    </>
                  )
                })()
              ) : (
                <View className="intended-majors-page__empty">
                  <Text className="intended-majors-page__empty-icon">📚</Text>
                  <Text className="intended-majors-page__empty-text">暂无志愿数据</Text>
                  <Text className="intended-majors-page__empty-desc">
                    {majorFavoritesCount === 0 ? '请先探索心动专业' : '请先进行院校探索，添加心仪的志愿'}
                  </Text>
                </View>
              )}
              {!loading && groupedChoices?.volunteers && groupedChoices.volunteers.length <= visibleVolunteerCount && (
                <Card 
                  className="intended-majors-page__add-more"
                  onClick={() => {
                    // 使用 navigateTo 保留页面栈，便于从“院校探索”返回到“志愿方案”
                    Taro.navigateTo({
                      url: '/pages/majors/intended/index?tab=专业赛道'
                    })
                  }}
                >
                  <View className="intended-majors-page__add-more-content">
                    <Text className="intended-majors-page__add-more-icon">➕</Text>
                    <Text className="intended-majors-page__add-more-text">
                      已探索{groupedChoices?.statistics?.selected ?? 0}/{groupedChoices?.statistics?.total ?? 0}
                    </Text>
                  </View>
                </Card>
              )}
            </View>
          )
        ) : (
          // 专业赛道tab - 使用API数据（按收藏专业分组）
          enrollmentPlans.length === 0 ? (
            <View className="intended-majors-page__empty">
              <Text className="intended-majors-page__empty-icon">📚</Text>
              <Text className="intended-majors-page__empty-text">暂无数据</Text>
              <Text className="intended-majors-page__empty-desc">暂无院校探索数据，请稍后再试</Text>
            </View>
          ) : (
            <View className="intended-majors-page__majors-list">
              {enrollmentPlans.map((plan) => {
                const major = plan.majorFavorite.major
                const majorCode = plan.majorFavorite.majorCode
                return (
                  <Card key={majorCode} className="intended-majors-page__major-item">
                    <View className="intended-majors-page__major-item-content">
                      <View className="intended-majors-page__major-item-header">
                        <View>
                          <Text 
                            className="intended-majors-page__major-item-name"
                            onClick={() => {
                              // 跳转到专业详情页面
                              Taro.navigateTo({
                                url: `/pages/assessment/single-major/index?code=${majorCode}&name=${encodeURIComponent(major.name || '')}`
                              })
                            }}
                          >
                            {major.name}
                          </Text>
                          <Text className="intended-majors-page__major-item-code">({major.code})</Text>
                          {wishlistCounts[majorCode] > 0 && (
                            <View className="intended-majors-page__major-item-badge">
                              <Text>{wishlistCounts[majorCode]} 个志愿</Text>
                            </View>
                          )}
                        </View>
                        <Button
                          onClick={() => {
                            // 传递 majorId、majorCode 和 majorName，院校列表页面可以根据 majorId 调用 API
                            const majorNameParam = encodeURIComponent(major.name || '')
                            // 如果启用了分数区间筛选，才传递 minScore 和 maxScore
                            let url = `/pages/majors/intended/schools/index?majorCode=${majorCode}&majorId=${major.id}&majorName=${majorNameParam}`
                            if (enableScoreFilter) {
                              url += `&minScore=${scoreRange[0]}&maxScore=${scoreRange[1]}`
                            }
                            Taro.navigateTo({
                              url
                            })
                          }}
                          className="intended-majors-page__major-item-link"
                          variant="ghost"
                        >
                          <Text className="intended-majors-page__major-item-link-number">{plan.schoolCount}所</Text>
                          <Text className="intended-majors-page__major-item-link-arrow">→</Text>
                        </Button>
                      </View>
                      <View className="intended-majors-page__major-item-info">
                        <View className="intended-majors-page__major-item-tag">
                          <Text>
                            {(() => {
                              // 教育层次映射：ben -> 本科, zhuan -> 专科, gao_ben -> 本科(职业)
                              const eduLevelMap: Record<string, string> = {
                                'ben': '本科',
                                'zhuan': '专科',
                                'gao_ben': '本科(职业)'
                              }
                              return eduLevelMap[major.eduLevel || ''] || '本科'
                            })()}
                          </Text>
                        </View>
                        <View className="intended-majors-page__major-item-score">
                          <Text className="intended-majors-page__major-item-score-label">热爱能量:</Text>
                          <Text className="intended-majors-page__major-item-score-value">
                            {(() => {
                              // 标准化热爱能量值：如果值在0-1之间，乘以100取整
                              const normalizeLoveEnergy = (value: number | string | null | undefined): number | null => {
                                if (value === null || value === undefined) return null
                                const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)
                                if (isNaN(numValue)) return null
                                if (numValue > 0 && numValue < 1) {
                                  return Math.floor(numValue * 100)
                                }
                                return Math.round(numValue)
                              }
                              
                              // 处理 score 值：可能是数字或字符串
                              const normalizedScore = normalizeLoveEnergy(plan.score)
                              return normalizedScore !== null ? normalizedScore.toString() : '-'
                            })()}
                          </Text>
                        </View>
                        </View>
                    </View>
                  </Card>
                )
              })}
              <View className="intended-majors-page__add-other-major-wrap">
                <Button
                  className="intended-majors-page__add-other-major-btn"
                  variant="outline"
                  onClick={() => Taro.navigateTo({ url: '/pages/majors/index' })}
                >
                  ＋ 添加其他专业
                </Button>
              </View>
            </View>
          )
        )}
      </View>

      <BottomNav />

      {/* 返回顶部按钮 */}
      {showBackToTop && activeTab === '意向志愿' && (
        <Button
          onClick={scrollToTop}
          className="intended-majors-page__back-to-top"
          size="icon"
        >
          ↑
        </Button>
      )}

      {/* 高考信息对话框 */}
      <ExamInfoDialog 
        open={showExamInfoDialog} 
        onOpenChange={setShowExamInfoDialog}
        examInfo={examInfo || undefined}
        onUpdate={loadExamInfo}
      />

      {/* 导出进度对话框 */}
      <ExportProgressDialog
        open={showExportProgress}
        progress={exportProgress}
        status={exportStatus}
        paused={exportPaused}
        onPause={handlePauseExport}
        onResume={handleResumeExport}
        onCancel={handleCancelExport}
      />

      {/* 导出完成对话框 */}
      <ExportCompleteDialog
        open={showExportComplete}
        onClose={() => setShowExportComplete(false)}
        filePath={exportFilePath}
      />

      {/* 导出用的Canvas（隐藏） */}
      <Canvas
        id="exportCanvas"
        type="2d"
        canvasId="exportCanvas"
        className="intended-majors-page__export-canvas"
      />

      {/* 删除确认对话框 */}
      <Dialog
        className="intended-majors-page__delete-confirm-dialog"
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              {choiceToDelete
                ? `确定要删除专业"${choiceToDelete?.majorName || ''}"吗？`
                : groupToDelete 
                ? `确定要删除"${groupToDelete?.schoolName || ''} - ${groupToDelete?.majorGroupName || ''}"专业组吗？此操作将删除该专业组下的所有志愿项。`
                : '确定要删除此志愿项吗？'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setDeleteConfirmOpen(false)
                setChoiceToDelete(null)
                setGroupToDelete(null)
                setItemToDelete(null)
              }}
              variant="outline"
            >
              取消
            </Button>
            <Button
              onClick={confirmDeleteWishlistItem}
              className="intended-majors-page__delete-button"
            >
              确定删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 专业组信息对话框 */}
      <Dialog 
        className="intended-majors-page__group-dialog-wrapper"
        open={groupDialogOpen} 
        onOpenChange={(open) => {
          setGroupDialogOpen(open)
          if (!open) {
            // 关闭时清空数据
            setGroupInfoData([])
            setSelectedGroupInfo(null)
            setSelectedSchoolData(null)
            setSelectedPlanData(null)
            setLoadingGroupInfo(false)
            setExpandedScores(new Set()) // 清空 scores 展开状态
          }
        }}
      >
        <DialogContent className="intended-majors-page__group-dialog">
          <DialogHeader>
            <View className="intended-majors-page__group-dialog-title-wrapper">
              <Text className="intended-majors-page__group-dialog-title-text">
                {selectedGroupInfo?.schoolName} - {selectedGroupInfo?.majorGroupName} 专业组信息
              </Text>
            </View>
          </DialogHeader>
          <ScrollView className="intended-majors-page__group-dialog-content" scrollY style={{ height: '80vh' }}>
            <View className="intended-majors-page__group-dialog-content-inner">
            {loadingGroupInfo ? (
              <View className="intended-majors-page__group-dialog-empty">
                <Text>加载中...</Text>
              </View>
            ) : groupInfoData.length === 0 ? (
              <View className="intended-majors-page__group-dialog-empty">
                <Text>暂无专业组信息</Text>
                <Text className="intended-majors-page__group-dialog-empty-desc">数据未加载或为空</Text>
              </View>
            ) : (
              groupInfoData.map((plan, planIdx) => {
                // 处理热爱能量值：如果值在0-1之间，乘以100取整
                const normalizeLoveEnergy = (value: number | null): number | null => {
                  if (value === null || value === undefined) return null
                  if (value > 0 && value < 1) {
                    return Math.floor(value * 100)
                  }
                  return value
                }

                const isScoresExpanded = expandedScores.has(planIdx)
                const scoresCount = plan.scores?.length || 0
                const isSingleScore = scoresCount === 1
                
                // 单个 score 时，获取热爱能量值
                const singleLoveEnergy = isSingleScore && plan.scores?.[0] 
                  ? normalizeLoveEnergy(plan.scores[0].loveEnergy) 
                  : null

                // 是否存在分数低于后20%最高分的项（用于弹框内标记）
                const hasScoreBelowMax =
                  bottom20MaxScore != null &&
                  (plan.scores ?? []).some((s) => {
                    const v = normalizeLoveEnergy(s.loveEnergy)
                    return v !== null && v < bottom20MaxScore
                  })

                return (
                  <View key={planIdx} className="intended-majors-page__group-section-new">
                    {/* 第一行：enrollmentMajor + 加入志愿/删除志愿按钮 */}
                    {plan.enrollmentMajor && (
                      <View className="intended-majors-page__group-major-row">
                        <View className="intended-majors-page__group-major-name-wrapper">
                          <Text className="intended-majors-page__group-major-name">{plan.enrollmentMajor}</Text>
                          {/* 如果只有一个 score，在 enrollmentMajor 后面显示热爱能量 */}
                          {isSingleScore && singleLoveEnergy !== null && (
                            <Text className="intended-majors-page__group-major-energy">
                              热爱能量：{singleLoveEnergy}
                            </Text>
                          )}
                          {hasScoreBelowMax && (
                            <Text className="intended-majors-page__group-dialog-score-warning">⚠️</Text>
                          )}
                        </View>
                        {(() => {
                          const { isIn, choiceId } = isPlanInWishlist(plan)
                          if (isIn && choiceId) {
                            return (
                              <Text
                                className="intended-majors-page__group-major-action intended-majors-page__group-major-action--remove"
                                onClick={() => handleAddPlanToWishlist(plan)}
                              >
                                移除志愿
                              </Text>
                            )
                          }
                          return (
                            <Text
                              className="intended-majors-page__group-major-action"
                              onClick={() => handleAddPlanToWishlist(plan)}
                            >
                              加入志愿
                            </Text>
                          )
                        })()}
                      </View>
                    )}

                    {/* 第二行：remark */}
                    {plan.remark && (
                      <View className="intended-majors-page__group-remark">
                        <Text>{plan.remark}</Text>
                      </View>
                    )}

                    {/* 多个 scores 时，在 remark 下面显示 */}
                    {!isSingleScore && plan.scores && plan.scores.length > 0 && (
                      <View className="intended-majors-page__group-scores-multiple">
                        {(() => {
                          // 拼接为一行：majorName:热爱能量、majorName:热爱能量
                          const scoreText = plan.scores
                            .map((score: any) => {
                              const loveEnergy = normalizeLoveEnergy(score.loveEnergy)
                              const energyText = loveEnergy !== null ? String(loveEnergy) : '-'
                              const majorName = score.majorName ? String(score.majorName) : ''
                              return majorName ? `${majorName}:${energyText}` : energyText
                            })
                            .filter((s: string) => s)
                            .join('、')

                          const toggleExpanded = () => {
                            setExpandedScores((prev) => {
                              const newSet = new Set(prev)
                              if (newSet.has(planIdx)) {
                                newSet.delete(planIdx)
                              } else {
                                newSet.add(planIdx)
                              }
                              return newSet
                            })
                          }

                          return (
                            <View
                              className={`intended-majors-page__group-scores-row ${isScoresExpanded ? 'intended-majors-page__group-scores-row--expanded' : ''}`}
                              onClick={toggleExpanded}
                            >
                              <Text className="intended-majors-page__group-scores-text">
                                热爱能量：{scoreText}
                              </Text>
                              <View
                                className="intended-majors-page__group-scores-arrow"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleExpanded()
                                }}
                              >
                                <Text className="intended-majors-page__group-scores-arrow-icon">
                                  {isScoresExpanded ? '▲' : '▼'}
                                </Text>
                              </View>
                            </View>
                          )
                        })()}
                      </View>
                    )}

                    {/* 第三行：学制：studyPeriod 招生人数：enrollmentQuota */}
                    <View className="intended-majors-page__group-info-row">
                      <Text>学制：{plan.studyPeriod || '-'}</Text>
                      <Text>招生人数：{plan.enrollmentQuota || '-'}</Text>
                    </View>
                  </View>
                )
              })
            )}
            </View>
          </ScrollView>

          {/* 底部浮动关闭按钮：不随内容滚动 */}
          <View className="intended-majors-page__group-dialog-footer">
            <Button
              className="intended-majors-page__group-dialog-close-button"
              onClick={() => setGroupDialogOpen(false)}
            >
              关闭
            </Button>
          </View>
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

