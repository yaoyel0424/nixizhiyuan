// 院校列表页面
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { BottomNav } from '@/components/BottomNav'
import { QuestionnaireRequiredModal } from '@/components/QuestionnaireRequiredModal'
import { useQuestionnaireCheck } from '@/hooks/useQuestionnaireCheck'
import { getStorage, setStorage, removeStorage } from '@/utils/storage'
import {
  getEnrollmentPlansByMajorId,
  EnrollmentPlanWithScores,
  EnrollmentPlansByScoreRange,
  getMajorGroupInfo,
  MajorGroupInfo,
  EnrollmentPlanItem,
  getLevel3MajorIdsByMajorGroupIds,
} from '@/services/enroll-plan'
import { getBottom20Scores } from '@/services/scores'
import { createChoice, CreateChoiceDto, getChoices, deleteChoice, GroupedChoiceResponse } from '@/services/choices'
import { getExamInfo, updateExamInfo, ExamInfo } from '@/services/exam-info'
import { getUserRelatedDataCount } from '@/services/user'
import { ExamInfoDialog } from '@/components/ExamInfoDialog'
import './index.less'

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
  studyPeriod?: string | null
  tuitionFee?: string | null
}

interface IntentionMajor {
  major: {
    code: string
    name: string
  }
  schools: School[]
}

// 院校列表分页：一次渲染 10 条，避免列表过大卡顿
const SCHOOLS_PAGE_SIZE = 10

export default function IntendedMajorsSchoolsPage() {
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

  // 检查问卷完成状态
  const { isCompleted: isQuestionnaireCompleted, isLoading: isCheckingQuestionnaire, answerCount, repeatCount } = useQuestionnaireCheck()
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  
  const router = useRouter()
  const majorCode = router.params?.majorCode || ''
  const majorIdParam = router.params?.majorId || ''
  const majorId = majorIdParam ? parseInt(majorIdParam, 10) : null
  const majorNameParam = router.params?.majorName || ''
  // 分数段筛选（从志愿方案页传递过来）
  const minScoreParam = router.params?.minScore
  const maxScoreParam = router.params?.maxScore
  const minScore = minScoreParam ? Number(minScoreParam) : undefined
  const maxScore = maxScoreParam ? Number(maxScoreParam) : undefined
  // 判断是否从热门专业页面跳转过来（从热门专业进入不校验 168 题完成）
  const fromPage = router.params?.from || ''
  const isFromPopularMajors = fromPage === 'popular-majors'

  const [data, setData] = useState<IntentionMajor | null>(null)
  // 保存接口返回的两组数据
  const [inRangeApiData, setInRangeApiData] = useState<EnrollmentPlanWithScores[]>([])
  const [notInRangeApiData, setNotInRangeApiData] = useState<EnrollmentPlanWithScores[]>([])
  // 当前页面用于渲染/计算的 apiData（默认展示 inRange）
  const [apiData, setApiData] = useState<EnrollmentPlanWithScores[]>([])
  // 其他院校（notInRange）是否已展开展示
  const [showNotInRange, setShowNotInRange] = useState(false)
  // 其他院校分段展示：当前已展示的院校条数
  const [visibleNotInRangeSchoolCount, setVisibleNotInRangeSchoolCount] = useState<number>(SCHOOLS_PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [groupedChoices, setGroupedChoices] = useState<GroupedChoiceResponse | null>(null) // 已加入的志愿列表
  const [choiceIdMap, setChoiceIdMap] = useState<Map<string, number>>(new Map()) // 保存学校代码+专业组ID到choiceId的映射
  const [selectedGroupInfo, setSelectedGroupInfo] = useState<{
    schoolName: string
    majorGroupName: string
    majorGroupId?: number
  } | null>(null)
  const [selectedSchoolData, setSelectedSchoolData] = useState<School | null>(null)
  const [selectedPlanData, setSelectedPlanData] = useState<EnrollmentPlanItem | null>(null) // 保存选中的plan数据
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [majorName, setMajorName] = useState<string>('')
  const [groupInfoData, setGroupInfoData] = useState<MajorGroupInfo[]>([])
  const [loadingGroupInfo, setLoadingGroupInfo] = useState(false)
  const [planWishlistKeys, setPlanWishlistKeys] = useState<Set<string>>(new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [choiceToDelete, setChoiceToDelete] = useState<{ choiceId: number; schoolData: School } | null>(null)
  const [expandedPlans, setExpandedPlans] = useState<Set<number>>(new Set()) // 展开的 plan 索引（用于旧结构，保留兼容）
  const [expandedScores, setExpandedScores] = useState<Set<number>>(new Set()) // 展开的 scores 列表索引（用于多个 scores 的展开）
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null) // 选中的省份
  // 高考信息弹框状态
  const [showExamInfoDialog, setShowExamInfoDialog] = useState(false)
  const [examInfo, setExamInfo] = useState<ExamInfo | undefined>(undefined)
  // 从热门专业进入时，用户修改高考信息后触发页面数据刷新
  const [dataRefreshTrigger, setDataRefreshTrigger] = useState(0)
  // 分段展示：当前已展示的院校条数
  const [visibleSchoolCount, setVisibleSchoolCount] = useState<number>(SCHOOLS_PAGE_SIZE)
  // 从接口返回的省份列表
  const [apiProvinces, setApiProvinces] = useState<string[] | null>(null) // 使用 null 来区分"未设置"和"空数组"
  // 省份列表是否展开
  const [isProvincesExpanded, setIsProvincesExpanded] = useState(false)
  // 省份列表是否超过一行
  const [isProvincesOverflow, setIsProvincesOverflow] = useState(false)
  // 省份列表容器的 ref
  const provinceFilterRef = useRef<HTMLDivElement>(null)
  // 包含「分数后20%」专业的 majorId 集合，用于标记需警告的专业组
  const [warningMajorGroupIds, setWarningMajorGroupIds] = useState<Set<number>>(new Set())
  // 后20%数据中的最高分，用于弹框内标记「分数低于此值的项」
  const [bottom20MaxScore, setBottom20MaxScore] = useState<number | null>(null)

  // 优先使用接口返回的 provinces，如果没有则从数据中提取
  const provinces = React.useMemo(() => {
    // 如果 apiProvinces 不为 null，说明接口返回了 provinces（可能是空数组），直接使用
    if (apiProvinces !== null) {
      return apiProvinces
    }
    // 降级方案：从 inRange/notInRange 中提取并去重省份列表
    const all = [...(inRangeApiData || []), ...(notInRangeApiData || [])]
    if (all.length === 0) return []
    const provinceSet = new Set<string>()
    all.forEach((item) => {
      if (item.school?.provinceName) {
        provinceSet.add(item.school.provinceName)
      }
    })
    return Array.from(provinceSet).sort()
  }, [apiProvinces, inRangeApiData, notInRangeApiData])

  // 根据选中的省份筛选数据
  const filteredData = React.useMemo(() => {
    if (!data) return null

    let filteredSchools = data.schools

    // 按省份筛选
    if (selectedProvince) {
      filteredSchools = filteredSchools.filter(
        (school) => school.provinceName === selectedProvince
      )
    }

    return {
      ...data,
      schools: filteredSchools,
    }
  }, [data, selectedProvince])

  // notInRange：转换为页面结构，并复用同一个省份筛选条件
  const notInRangeData = React.useMemo(() => {
    return convertApiDataToSchoolList(notInRangeApiData, majorCode)
  }, [notInRangeApiData, majorCode])

  const filteredNotInRangeSchools = React.useMemo(() => {
    let schools = notInRangeData.schools
    if (selectedProvince) {
      schools = schools.filter((school) => school.provinceName === selectedProvince)
    }
    return schools
  }, [notInRangeData, selectedProvince])

  // 检查问卷完成状态（从热门专业进入时跳过校验）
  useEffect(() => {
    if (isFromPopularMajors) return
    if (!isCheckingQuestionnaire && !isQuestionnaireCompleted && repeatCount <= 0) {
      setShowQuestionnaireModal(true)
    }
  }, [isFromPopularMajors, isCheckingQuestionnaire, isQuestionnaireCompleted])

  // 对话框打开时，重新加载志愿状态
  useEffect(() => {
    if (groupDialogOpen && selectedSchoolData && selectedGroupInfo) {
      const reloadChoices = async () => {
        try {
          // 重新从API加载志愿列表
          const choicesData = await getChoices()
          setGroupedChoices(choicesData)
          
          // 更新choiceId映射（支持多种key格式）
          const idMap = new Map<string, number>()
          choicesData.volunteers.forEach((volunteer) => {
            volunteer.majorGroups.forEach((majorGroup) => {
              majorGroup.choices.forEach((choice) => {
                // 优先使用 choice.majorGroupId，如果没有则使用 majorGroup.majorGroup.mgId
                const mgId = choice.majorGroupId ?? majorGroup.majorGroup?.mgId
                
                if (mgId !== null && mgId !== undefined) {
                  // 添加多种key格式，确保能匹配到（数字、字符串格式）
                  const keys = [
                    `${choice.schoolCode}-${mgId}`,
                    `${choice.schoolCode}-${Number(mgId)}`,
                    `${choice.schoolCode}-${String(mgId)}`
                  ]
                  keys.forEach(key => {
                    idMap.set(key, choice.id)
                  })
                  
                } else {
                  idMap.set(`${choice.schoolCode}-no-group`, choice.id)
                }
              })
            })
          })
          setChoiceIdMap(idMap)
          
        } catch (error) {
          console.error('重新加载志愿列表失败:', error)
        }
      }
      reloadChoices()
    }
  }, [groupDialogOpen, selectedSchoolData, selectedGroupInfo])

  /**
   * 将 API 返回的数据转换为页面需要的结构
   * 注意：这里使用函数声明，避免在 useMemo 中提前调用时报 “is not a function”
   */
  function convertApiDataToSchoolList(
    apiData: EnrollmentPlanWithScores[],
    majorCode: string,
  ): IntentionMajor {
    if (!apiData || apiData.length === 0) {
      // 允许空列表渲染：用于 inRange 为空但 notInRange 有数据时，仍然展示页面并提供“其他院校”切换
      return {
        major: {
          code: majorCode,
          name: majorNameParam ? decodeURIComponent(majorNameParam) : majorCode,
        },
        schools: [],
      }
    }

    // 从第一个招生计划中获取专业名称
    let majorName = majorCode
    if (apiData[0]?.plans?.[0]?.enrollmentMajor) {
      majorName = apiData[0].plans[0].enrollmentMajor
    }

    const schools: School[] = apiData.map((item) => {
      // 获取第一个招生计划的专业组信息（用于学校级别显示）
      const firstPlan = item.plans[0]
      const majorGroupName = firstPlan?.majorGroup?.mgName || firstPlan?.majorGroupInfo || null
      // 从 plan 对象上直接获取 majorGroupId，而不是从 majorGroup.mgId
      const majorGroupId = firstPlan?.majorGroupId || firstPlan?.majorGroup?.mgId || null
      const studyPeriod = firstPlan?.studyPeriod || null
      const tuitionFee = firstPlan?.tuitionFee || null
      
      // 构建历史分数数据（从所有 plans 的 majorScores 中提取）
      const historyScores: HistoryScore[] = []
      
      // 收集所有年份的分数数据
      const scoresByYear = new Map<string, Array<{ minScore: number | null; minRank: number | null; admitCount: number | null; batch?: string | null }>>()
      
      item.plans.forEach((plan) => {
        if (plan.majorScores && plan.majorScores.length > 0) {
          plan.majorScores.forEach((score) => {
            const year = score.year || '2024'
            if (!scoresByYear.has(year)) {
              scoresByYear.set(year, [])
            }
            scoresByYear.get(year)!.push({
              minScore: score.minScore,
              minRank: score.minRank,
              admitCount: score.admitCount,
              batch: plan.batch,
            })
          })
        }
      })

      // 转换为历史分数格式
      const historyScoreData: Array<{ [key: string]: string }> = []
      let firstYear: number | null = null
      
      scoresByYear.forEach((scores, year) => {
        // 取最低分数和最低位次
        const validScores = scores.filter(s => s.minScore !== null && s.minRank !== null)
        if (validScores.length > 0) {
          const minScore = Math.min(...validScores.map(s => s.minScore!))
          const minRank = Math.min(...validScores.map(s => s.minRank!))
          const totalAdmitCount = scores.reduce((sum, s) => sum + (s.admitCount || 0), 0)
          const batch = scores[0]?.batch || ''
          
          if (!firstYear) {
            firstYear = parseInt(year)
          }
          
          historyScoreData.push({
            [year]: `${Math.floor(minScore)},${minRank},${totalAdmitCount}`
          })
        }
      })

      if (historyScoreData.length > 0 && firstYear) {
        const firstPlan = item.plans[0]
        historyScores.push({
          year: firstYear,
          historyScore: historyScoreData,
          remark: firstPlan?.remark || '',
          planNum: firstPlan?.enrollmentQuota ? parseInt(firstPlan.enrollmentQuota) : 0,
          batch: firstPlan?.batch || undefined,
          majorGroupName: majorGroupName,
        })
      }

      return {
        schoolName: item.school.name,
        schoolNature: item.school.nature || '',
        group: 0,
        historyScores: historyScores,
        schoolFeature: (() => {
          // 处理 features：可能是数组或字符串
          const features = item.school.features
          if (!features) return ''
          if (Array.isArray(features)) {
            return features.filter(f => f && String(f).trim()).join(',')
          }
          const featureStr = String(features).trim()
          // 如果是 "[]" 或空数组字符串，返回空字符串
          if (featureStr === '[]' || featureStr === 'null' || featureStr === 'undefined') {
            return ''
          }
          return featureStr
        })(),
        belong: item.school.belong || '',
        provinceName: item.school.provinceName || '',
        cityName: item.school.cityName || '',
        enrollmentRate: item.school.enrollmentRate ? `${item.school.enrollmentRate}` : '0',
        employmentRate: item.school.employmentRate ? `${item.school.employmentRate}` : '0',
        majorGroupName: majorGroupName,
        majorGroupId: majorGroupId || undefined,
        studyPeriod: studyPeriod || undefined,
        tuitionFee: tuitionFee || undefined,
      }
    })

    return {
      major: {
        code: majorCode,
        name: majorName,
      },
      schools: schools,
    }
  }

  // 加载数据
  useEffect(() => {
    // 如果路由参数中有 majorName，优先使用它
    if (majorNameParam) {
      setMajorName(decodeURIComponent(majorNameParam))
    }

    const loadData = async () => {
      try {
        // 必须有 majorId 和 majorCode 才能加载数据
        if (!majorId || !majorCode) {
          console.error('缺少必要参数: majorId 或 majorCode')
          setLoading(false)
          return
        }

        // 页面加载时同时请求分数后20%专业（与招生计划接口并行）
        const bottom20Promise = getBottom20Scores()

        const grouped: EnrollmentPlansByScoreRange = await getEnrollmentPlansByMajorId(
          majorId,
          Number.isFinite(minScore as number) ? (minScore as number) : undefined,
          Number.isFinite(maxScore as number) ? (maxScore as number) : undefined,
        )
        const inRangeList = grouped?.inRange || []
        const notInRangeList = grouped?.notInRange || []
        // 保存接口返回的省份列表（只要接口返回了 provinces，就使用它）
        if (grouped?.provinces !== undefined) {
          setApiProvinces(grouped.provinces)
        } else {
          // 如果接口没有返回 provinces，设置为 null，使用降级方案
          setApiProvinces(null)
        }
        setInRangeApiData(inRangeList)
        setNotInRangeApiData(notInRangeList)
        // 默认展示 inRange
        const apiData = inRangeList
        setApiData(apiData)
        setShowNotInRange(false)
        setVisibleNotInRangeSchoolCount(SCHOOLS_PAGE_SIZE)

        // 如果路由参数中没有 majorName，则从 API 数据中获取（优先 inRange，其次 notInRange）
        if (!majorNameParam) {
          const majorNameFromApi =
            inRangeList[0]?.plans?.[0]?.enrollmentMajor ||
            notInRangeList[0]?.plans?.[0]?.enrollmentMajor ||
            majorCode
          setMajorName(majorNameFromApi)
        }

        // 从 inRange 和 notInRange 的 plans 中收集所有 majorGroupId，请求 level3-major-ids-by-major-group
        const majorGroupIdSet = new Set<number>()
        ;[...inRangeList, ...notInRangeList].forEach((item) => {
          item.plans?.forEach((plan) => {
            const mgId = plan.majorGroupId ?? plan.majorGroup?.mgId
            if (mgId != null && mgId > 0) majorGroupIdSet.add(mgId)
          })
        })
        const allMajorGroupIds = Array.from(majorGroupIdSet)
        const level3Result =
          allMajorGroupIds.length > 0
            ? await getLevel3MajorIdsByMajorGroupIds(allMajorGroupIds)
            : []

        const bottom20Res = await bottom20Promise
        const bottom20List = bottom20Res.items
        setBottom20MaxScore(bottom20Res.maxScore)
        const bottom20MajorIdSet = new Set(bottom20List.map((r) => r.majorId))
        const warningIds = new Set<number>()
        level3Result.forEach(({ majorGroupId, level3MajorIds }) => {
          if (
            level3MajorIds.some((id) => bottom20MajorIdSet.has(id))
          ) {
            warningIds.add(majorGroupId)
          }
        })
        setWarningMajorGroupIds(warningIds)

        const convertedData = convertApiDataToSchoolList(apiData, majorCode)
        setData(convertedData)
        setLoading(false)
      } catch (error) {
        console.error('从 API 加载数据失败:', error)
        setData(null)
        setLoading(false)
      }
    }
    
    if (majorCode && majorId) {
      loadData()
    } else {
      setLoading(false)
    }

    // 加载已加入的志愿列表（从API）
    const loadChoicesFromAPI = async () => {
      try {
        const choicesData = await getChoices()
        setGroupedChoices(choicesData)
        
        // 构建choiceId映射：key为 schoolCode-majorGroupId，value为choiceId
        const idMap = new Map<string, number>()
        choicesData.volunteers.forEach((volunteer) => {
          volunteer.majorGroups.forEach((majorGroup) => {
            majorGroup.choices.forEach((choice) => {
              const key = `${choice.schoolCode}-${choice.majorGroupId || 'no-group'}`
              idMap.set(key, choice.id)
            })
          })
        })
        setChoiceIdMap(idMap)
        
        // 更新wishlist状态（用于兼容旧逻辑）
        const wishlistSet = new Set<string>()
        choicesData.volunteers.forEach((volunteer) => {
          volunteer.majorGroups.forEach((majorGroup) => {
            majorGroup.choices.forEach((choice) => {
              const key = `${majorCode}-${volunteer.school.name}`
              wishlistSet.add(key)
            })
          })
        })
        setWishlist(wishlistSet)
      } catch (error) {
        console.error('从API加载志愿列表失败:', error)
      }
    }
    
    // 加载plan的志愿列表
    const loadPlanWishlist = async () => {
      try {
        const savedItems = await getStorage<any[]>('wishlist-items')
        if (savedItems) {
          const planKeys = new Set<string>()
          savedItems.forEach((item: any) => {
            if (item.planKey) {
              planKeys.add(item.planKey)
            }
          })
          setPlanWishlistKeys(planKeys)
        }
      } catch (error) {
        console.error('加载plan志愿列表失败:', error)
      }
    }
    
    loadChoicesFromAPI()
    loadPlanWishlist()
    
    // 如果从热门专业页面跳转过来，检查高考信息
    if (isFromPopularMajors) {
      const checkExamInfo = async () => {
        try {
          const relatedData = await getUserRelatedDataCount()
          // 如果 preferredSubjects 为空或 null，自动打开高考信息对话框
          if (!relatedData.preferredSubjects || relatedData.preferredSubjects === null || relatedData.preferredSubjects === '') {
            // 先获取高考信息
            const examInfoData = await getExamInfo()
            setExamInfo(examInfoData)
            setShowExamInfoDialog(true)
          }
        } catch (error) {
          console.error('检查高考信息失败:', error)
        }
      }
      checkExamInfo()
    }
  }, [majorCode, majorId, minScoreParam, maxScoreParam, isFromPopularMajors, dataRefreshTrigger])

  // 检测省份列表是否超过一行（使用估算方法，避免 Taro 查询问题）
  useEffect(() => {
    if (provinces.length === 0) {
      setIsProvincesOverflow(false)
      setIsProvincesExpanded(false) // 重置展开状态
      return
    }
    
    // 使用估算方法：根据省份数量和屏幕宽度估算
    // 估算：每个省份项大约 80-120rpx 宽（包括文字和 padding）
    // 屏幕宽度约 750rpx，一行大约可以放 5-6 个省份
    // 如果省份数量（包括"全部"）超过 6 个，很可能超过一行
    const totalItems = provinces.length + 1 // 包括"全部"按钮
    const likelyOverflow = totalItems > 6
    
    setIsProvincesOverflow(likelyOverflow)
    // 如果超过一行，默认折叠
    if (likelyOverflow) {
      setIsProvincesExpanded(false)
    }
  }, [provinces])

  // 当筛选条件变化/重新加载数据时，重置分页展示数量
  useEffect(() => {
    setVisibleSchoolCount(SCHOOLS_PAGE_SIZE)
  }, [majorCode, majorId, selectedProvince, apiData.length])

  // 当其他院校展开/筛选条件变化时，重置其他院校分页展示数量
  useEffect(() => {
    if (!showNotInRange) return
    setVisibleNotInRangeSchoolCount(SCHOOLS_PAGE_SIZE)
  }, [showNotInRange, selectedProvince, notInRangeApiData.length])

  // 判断学校是否已加入志愿（需要传入对应分组的 apiData，避免同校在两组中时取错 plans）
  const isSchoolInWishlist = (
    schoolData: School,
    apiSource: EnrollmentPlanWithScores[],
  ): { isIn: boolean; choiceId?: number } => {
    // 优先使用groupedChoices判断（最准确，直接从API返回的数据判断）
    if (groupedChoices && groupedChoices.volunteers.length > 0) {
      // 查找匹配的学校
      const volunteer = groupedChoices.volunteers.find(v => v.school.name === schoolData.schoolName)
      if (volunteer) {
        // 查找匹配的专业组
        const mgId = schoolData.majorGroupId
        for (const majorGroup of volunteer.majorGroups) {
          const groupMgId = majorGroup.majorGroup?.mgId
          if (groupMgId === mgId || (!mgId && groupMgId === null)) {
            // 找到匹配的专业组，返回第一个choice的ID
            if (majorGroup.choices.length > 0) {
              return { isIn: true, choiceId: majorGroup.choices[0].id }
            }
          }
        }
        // 如果学校匹配但专业组不匹配，检查是否有任何choice
        for (const majorGroup of volunteer.majorGroups) {
          if (majorGroup.choices.length > 0) {
            // 如果学校已加入但专业组不同，也返回true（用于兼容）
            return { isIn: true, choiceId: majorGroup.choices[0].id }
          }
        }
      }
    }
    
    // 使用choiceIdMap判断
    if (choiceIdMap.size > 0 && apiSource.length > 0) {
      const apiSchoolData = apiSource.find(item => item.school.name === schoolData.schoolName)
      if (apiSchoolData) {
        const schoolCode = apiSchoolData.school.code
        const mgId = schoolData.majorGroupId
        const key = `${schoolCode}-${mgId || 'no-group'}`
        const choiceId = choiceIdMap.get(key)
        if (choiceId !== undefined) {
          return { isIn: true, choiceId }
        }
      }
    }
    
    return { isIn: false }
  }

  // 确认删除志愿
  const confirmDeleteChoice = async () => {
    if (!choiceToDelete) return
    
    try {
      await deleteChoice(choiceToDelete.choiceId)
      
      // 立即更新choiceIdMap（移除对应的key）
      setChoiceIdMap((prev) => {
        const newMap = new Map(prev)
        // 找到对应的key并删除
        const apiSchoolData = [...(inRangeApiData || []), ...(notInRangeApiData || [])].find(
          item => item.school.name === choiceToDelete.schoolData.schoolName,
        )
        if (apiSchoolData) {
          const schoolCode = apiSchoolData.school.code
          const mgId = choiceToDelete.schoolData.majorGroupId
          const key = `${schoolCode}-${mgId || 'no-group'}`
          newMap.delete(key)
        }
        return newMap
      })
      
      // 立即更新wishlist状态
      const schoolKey = `${majorCode}-${choiceToDelete.schoolData.schoolName}`
      setWishlist((prev) => {
        const newSet = new Set(prev)
        newSet.delete(schoolKey)
        return newSet
      })
      
      // 重新加载志愿列表（确保数据同步）
      const choicesData = await getChoices()
      setGroupedChoices(choicesData)
      
      // 更新choiceId映射
      const idMap = new Map<string, number>()
      choicesData.volunteers.forEach((volunteer) => {
        volunteer.majorGroups.forEach((majorGroup) => {
          majorGroup.choices.forEach((choice) => {
            const key = `${choice.schoolCode}-${choice.majorGroupId || 'no-group'}`
            idMap.set(key, choice.id)
          })
        })
      })
      setChoiceIdMap(idMap)
      
      // 更新wishlist状态
      const wishlistSet = new Set<string>()
      choicesData.volunteers.forEach((volunteer) => {
        volunteer.majorGroups.forEach((majorGroup) => {
          majorGroup.choices.forEach((choice) => {
            const key = `${majorCode}-${volunteer.school.name}`
            wishlistSet.add(key)
          })
        })
      })
      setWishlist(wishlistSet)
      
      setDeleteConfirmOpen(false)
      setChoiceToDelete(null)
      
      Taro.showToast({
        title: '已移除志愿',
        icon: 'success',
        duration: 2000
      })

      // 设置刷新标记，通知父页面返回时需要刷新
      await setStorage('needRefreshChoices', true)
    } catch (error: any) {
      console.error('移除志愿失败:', error)
      Taro.showToast({
        title: error?.message || '移除失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  }

  // 移除志愿（显示确认框）
  const handleRemoveChoice = (choiceId: number, schoolData: School) => {
    setChoiceToDelete({ choiceId, schoolData })
    setDeleteConfirmOpen(true)
  }

  const toggleWishlist = async (schoolKey: string, schoolData: School) => {
    const { isIn, choiceId } = isSchoolInWishlist(
      schoolData,
      [...(inRangeApiData || []), ...(notInRangeApiData || [])],
    )
    
    if (isIn && choiceId) {
      // 移除志愿（会触发确认框，确认后会在 confirmDeleteChoice 中设置标记）
      await handleRemoveChoice(choiceId, schoolData)
      return
    }

    // 添加志愿：找到对应的plan数据并调用API
    try {
      // 从apiData中找到对应的学校数据
      let matchedPlan: EnrollmentPlanItem | null = null
      if (apiData.length > 0) {
        const apiSchoolData = apiData.find(item => item.school.name === schoolData.schoolName)
        if (apiSchoolData && apiSchoolData.plans.length > 0) {
          // 使用第一个plan，或者找到匹配majorGroupId的plan
          matchedPlan = apiSchoolData.plans.find(p => 
            p.majorGroupId === schoolData.majorGroupId
          ) || apiSchoolData.plans[0] || null
        }
      }

      if (!matchedPlan) {
        Taro.showToast({
          title: '未找到对应的招生计划数据',
          icon: 'none'
        })
        return
      }

      // 构建创建志愿的DTO
      const createChoiceDto: CreateChoiceDto = {
        mgId: matchedPlan.majorGroupId || matchedPlan.majorGroup?.mgId || schoolData.majorGroupId || null,
        schoolCode: matchedPlan.schoolCode || apiData.find(item => item.school.name === schoolData.schoolName)?.school?.code || null,
        enrollmentMajor: matchedPlan.enrollmentMajor || null,
        batch: matchedPlan.batch || schoolData.historyScores?.[0]?.batch || null,
        majorGroupInfo: matchedPlan.majorGroupInfo || matchedPlan.majorGroup?.mgInfo || null,
        subjectSelectionMode: matchedPlan.subjectSelectionMode || matchedPlan.majorGroup?.subjectSelectionMode || null,
        studyPeriod: matchedPlan.studyPeriod || schoolData.studyPeriod || null,
        enrollmentQuota: matchedPlan.enrollmentQuota || null,
        remark: matchedPlan.remark || null,
        tuitionFee: matchedPlan.tuitionFee || schoolData.tuitionFee || null,
        curUnit: matchedPlan.curUnit || null,
        majorScores: matchedPlan.majorScores?.map(score => ({
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

      // 立即更新choiceIdMap（添加新的choice）
      const schoolCode = createChoiceDto.schoolCode
      const mgId = createChoiceDto.mgId
      if (schoolCode && createdChoice.id) {
        setChoiceIdMap((prev) => {
          const newMap = new Map(prev)
          const key = `${schoolCode}-${mgId || 'no-group'}`
          newMap.set(key, createdChoice.id)
          return newMap
        })
      }
      
      // 立即更新wishlist状态
      const schoolKey = `${majorCode}-${schoolData.schoolName}`
      setWishlist((prev) => {
        const newSet = new Set(prev)
        newSet.add(schoolKey)
        return newSet
      })

      // 重新加载志愿列表（确保数据同步）
      const choicesData = await getChoices()
      setGroupedChoices(choicesData)
      
      // 更新choiceId映射
      const idMap = new Map<string, number>()
      choicesData.volunteers.forEach((volunteer) => {
        volunteer.majorGroups.forEach((majorGroup) => {
          majorGroup.choices.forEach((choice) => {
            const key = `${choice.schoolCode}-${choice.majorGroupId || 'no-group'}`
            idMap.set(key, choice.id)
          })
        })
      })
      setChoiceIdMap(idMap)
      
      // 更新wishlist状态
      const wishlistSet = new Set<string>()
      choicesData.volunteers.forEach((volunteer) => {
        volunteer.majorGroups.forEach((majorGroup) => {
          majorGroup.choices.forEach((choice) => {
            const key = `${majorCode}-${volunteer.school.name}`
            wishlistSet.add(key)
          })
        })
      })
      setWishlist(wishlistSet)

      Taro.showToast({
        title: '已加入志愿',
        icon: 'success',
        duration: 2000
      })

      // 设置刷新标记，通知父页面返回时需要刷新
      await setStorage('needRefreshChoices', true)
    } catch (error: any) {
      console.error('加入志愿失败:', error)
      Taro.showToast({
        title: error?.message || '加入志愿失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  }

  // 判断plan是否已加入志愿（根据同院校、同省份、同批次、同专业组、名称和备注一致才匹配）
  const isPlanInWishlist = (plan: MajorGroupInfo): { isIn: boolean; choiceId?: number } => {
    if (!selectedSchoolData || !selectedGroupInfo) {
      return { isIn: false }
    }
    
    // 获取目标专业组信息
    const targetMajorGroupName = selectedGroupInfo.majorGroupName
    // 从 selectedGroupInfo 或 selectedPlanData 获取 majorGroupId
    const targetMajorGroupId = selectedGroupInfo.majorGroupId || selectedPlanData?.majorGroupId || selectedPlanData?.majorGroup?.mgId || null
    // 优先使用当前 plan 的 remark、enrollmentMajor 和 studyPeriod，而不是 selectedPlanData 的
    // 因为 selectedPlanData 可能是第一个 plan 的数据，不是当前 plan 的数据
    const targetRemark = plan.remark || null
    const targetEnrollmentMajor = plan.enrollmentMajor || null
    const targetStudyPeriod = plan.studyPeriod || null
    // 获取目标批次（MajorGroupInfo 没有 batch 字段，从 selectedPlanData 中获取）
    const targetBatch = selectedPlanData?.batch || null
    // 获取目标省份（应该从 selectedPlanData.province 获取，而不是 selectedSchoolData.provinceName）
    // 因为志愿的省份是招生省份（如"江苏"），而学校的省份是学校所在省份（如"广东"）
    const targetProvince = selectedPlanData?.province || selectedPlanData?.majorScores?.[0]?.province || null
    
    // 院校模式下 targetMajorGroupId 和 targetMajorGroupName 可能都为空，仍可仅凭学校+备注+招生专业等匹配，不在此处提前返回
    // if (!targetMajorGroupName && !targetMajorGroupId) return { isIn: false } 已移除

    // 获取学校代码（优先从apiData中获取）
    let schoolCode: string | undefined
    if (apiData.length > 0) {
      const apiSchoolData = apiData.find(item => item.school.name === selectedSchoolData.schoolName)
      schoolCode = apiSchoolData?.school.code
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
              const choiceBatch = choice.batch || null
              const choiceProvince = choice.province || null
              
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
                // 院校模式：双方都无专业组 ID，同一学校下视为同一组，仅用备注+招生专业等字段区分
                isGroupMatch = true
              } else if (!choiceMajorGroupId && !majorGroup.majorGroup) {
                // 已选志愿为院校模式（无专业组），列表/弹框 plan 可能有 majorGroupId，仍按学校+备注+招生专业等匹配
                isGroupMatch = true
              }
              
              if (!isGroupMatch) {
                // 如果专业组不匹配，直接跳过
                continue
              }
              
              // 匹配招生专业（必须精确匹配）
              // 招生专业是区分不同志愿的关键字段，必须严格匹配
              // 如果目标招生专业存在，choice招生专业也必须存在且完全匹配
              // 如果目标招生专业不存在，choice招生专业也必须不存在
              let isEnrollmentMajorMatch = false
              
              // 处理空字符串的情况（空字符串视为不存在）
              const targetMajor = targetEnrollmentMajor?.trim() || null
              const choiceMajor = choiceEnrollmentMajor?.trim() || null
              
              if (!targetMajor && !choiceMajor) {
                // 都不存在，认为匹配
                isEnrollmentMajorMatch = true
              } else if (targetMajor && choiceMajor) {
                // 都存在，必须精确匹配（去除首尾空格后比较）
                isEnrollmentMajorMatch = (choiceMajor === targetMajor)
              } else {
                // 只有一个存在，不匹配（这是关键：如果目标有招生专业，choice必须有且匹配）
                isEnrollmentMajorMatch = false
              }
              
              // 如果招生专业不匹配，直接跳过
              if (!isEnrollmentMajorMatch) {
                continue
              }
              
              // 匹配学制（必须精确匹配）
              // 学制是区分不同志愿的关键字段（如八年制和五年制），必须严格匹配
              // 如果目标学制为空，则跳过学制匹配（认为匹配）
              // 如果目标学制不为空，则必须精确匹配
              let isStudyPeriodMatch = true
              if (targetStudyPeriod) {
                const choiceStudyPeriod = choice.studyPeriod || null
                if (choiceStudyPeriod) {
                  isStudyPeriodMatch = (
                    choiceStudyPeriod === targetStudyPeriod ||
                    choiceStudyPeriod.trim() === targetStudyPeriod.trim()
                  )
                } else {
                  // 目标有学制但choice没有，不匹配
                  isStudyPeriodMatch = false
                }
              }
              // 如果目标学制为空，认为匹配（跳过学制检查）
              
              // 如果学制不匹配，直接跳过
              if (!isStudyPeriodMatch) {
                continue
              }
              
              // 匹配省份（必须精确匹配）
              // 如果目标省份为空，则跳过省份匹配（认为匹配）
              // 如果目标省份不为空，则必须精确匹配
              let isProvinceMatch = true
              if (targetProvince) {
                if (choiceProvince) {
                  isProvinceMatch = (
                    choiceProvince === targetProvince ||
                    choiceProvince.trim() === targetProvince.trim()
                  )
                } else {
                  // 目标有省份但choice没有，不匹配
                  isProvinceMatch = false
                }
              }
              // 如果目标省份为空，认为匹配（跳过省份检查）
              
              // 如果省份不匹配，直接跳过
              if (!isProvinceMatch) {
                continue
              }
              
              // 匹配批次（必须精确匹配）
              // 如果目标批次为空，则跳过批次匹配（认为匹配）
              // 如果目标批次不为空，则必须精确匹配
              let isBatchMatch = true
              if (targetBatch) {
                if (choiceBatch) {
                  isBatchMatch = (
                    choiceBatch === targetBatch ||
                    choiceBatch.trim() === targetBatch.trim()
                  )
                } else {
                  // 目标有批次但choice没有，不匹配
                  isBatchMatch = false
                }
              }
              // 如果目标批次为空，认为匹配（跳过批次检查）
              
              // 如果批次不匹配，直接跳过
              if (!isBatchMatch) {
                continue
              }
              
              // 匹配备注（精确匹配）
              // 备注是区分同专业组下同名专业的关键字段，必须严格匹配
              // 如果备注都为空，认为匹配；如果都有备注，必须完全相等；如果只有一个有备注，不匹配（它们是不同的专业）
              let isRemarkMatch = false
              const targetRemarkTrimmed = targetRemark?.trim() || null
              const choiceRemarkTrimmed = choiceRemark?.trim() || null
              if (!targetRemarkTrimmed && !choiceRemarkTrimmed) {
                // 都不存在，认为匹配
                isRemarkMatch = true
              } else if (targetRemarkTrimmed && choiceRemarkTrimmed) {
                // 都存在，必须精确匹配（完全相等）
                isRemarkMatch = (choiceRemarkTrimmed === targetRemarkTrimmed)
              } else {
                // 只有一个存在，不匹配（它们是不同的专业）
                isRemarkMatch = false
              }
              
              // 当学校、省份、批次、专业组、招生专业、学制、备注都匹配时，认为已加入志愿
              if (isRemarkMatch) {
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
      handleRemoveChoice(choiceId, selectedSchoolData)
      return
    }

    try {
      // 找到对应的plan数据（从apiData中，通过enrollmentMajor匹配）
      let matchedPlan: EnrollmentPlanItem | null = selectedPlanData
      
      if (!matchedPlan && apiData.length > 0) {
        const schoolData = apiData.find(item => item.school.name === selectedSchoolData.schoolName)
        if (schoolData) {
          // 通过enrollmentMajor匹配plan
          matchedPlan = schoolData.plans.find(p => 
            p.enrollmentMajor === plan.enrollmentMajor
          ) || schoolData.plans[0] || null
        }
      }

      if (!matchedPlan) {
        Taro.showToast({
          title: '未找到对应的招生计划数据',
          icon: 'none'
        })
        return
      }

      // 构建创建志愿的DTO
      const createChoiceDto: CreateChoiceDto = {
        mgId: matchedPlan.majorGroupId || matchedPlan.majorGroup?.mgId || selectedGroupInfo.majorGroupId || null,
        schoolCode: matchedPlan.schoolCode || apiData.find(item => item.school.name === selectedSchoolData.schoolName)?.school.code || null,
        enrollmentMajor: plan.enrollmentMajor || matchedPlan.enrollmentMajor || null,
        batch: matchedPlan.batch || null,
        majorGroupInfo: matchedPlan.majorGroupInfo || matchedPlan.majorGroup?.mgInfo || null,
        subjectSelectionMode: matchedPlan.subjectSelectionMode || matchedPlan.majorGroup?.subjectSelectionMode || null,
        studyPeriod: plan.studyPeriod || matchedPlan.studyPeriod || null,
        enrollmentQuota: plan.enrollmentQuota || matchedPlan.enrollmentQuota || null,
        // 优先使用当前 plan 的 remark，即使为空字符串也要使用（不能回退到 matchedPlan.remark）
        remark: plan.remark !== undefined && plan.remark !== null ? plan.remark : (matchedPlan?.remark || null),
        tuitionFee: matchedPlan.tuitionFee || null,
        curUnit: matchedPlan.curUnit || null,
        majorScores: matchedPlan.majorScores?.map(score => ({
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

      // 立即更新choiceIdMap（添加新的choice）
      const schoolCode = createChoiceDto.schoolCode
      const mgId = createChoiceDto.mgId
      if (schoolCode && createdChoice.id) {
        setChoiceIdMap((prev) => {
          const newMap = new Map(prev)
          const key = `${schoolCode}-${mgId || 'no-group'}`
          newMap.set(key, createdChoice.id)
          return newMap
        })
      }
      
      // 立即更新wishlist状态
      const schoolKey = `${majorCode}-${selectedSchoolData.schoolName}`
      setWishlist((prev) => {
        const newSet = new Set(prev)
        newSet.add(schoolKey)
        return newSet
      })

      // 重新加载志愿列表（确保数据同步）
      const choicesData = await getChoices()
      setGroupedChoices(choicesData)
      
      // 更新choiceId映射
      const idMap = new Map<string, number>()
      choicesData.volunteers.forEach((volunteer) => {
        volunteer.majorGroups.forEach((majorGroup) => {
          majorGroup.choices.forEach((choice) => {
            const key = `${choice.schoolCode}-${choice.majorGroupId || 'no-group'}`
            idMap.set(key, choice.id)
          })
        })
      })
      setChoiceIdMap(idMap)
      
      // 更新wishlist状态
      const wishlistSet = new Set<string>()
      choicesData.volunteers.forEach((volunteer) => {
        volunteer.majorGroups.forEach((majorGroup) => {
          majorGroup.choices.forEach((choice) => {
            const key = `${majorCode}-${volunteer.school.name}`
            wishlistSet.add(key)
          })
        })
      })
      setWishlist(wishlistSet)

      Taro.showToast({
        title: '已加入志愿',
        icon: 'success',
        duration: 2000
      })

      // 设置刷新标记，通知父页面返回时需要刷新
      await setStorage('needRefreshChoices', true)
    } catch (error: any) {
      console.error('加入志愿失败:', error)
      Taro.showToast({
        title: error?.message || '加入志愿失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  }

  if (loading) {
    return (
      <View className="schools-page">
        <View className="schools-page__loading">
          <Text>加载中...</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  if (!data || !majorCode) {
    return (
      <View className="schools-page">
        <View className="schools-page__empty">
          <Text>未找到专业信息</Text>
        </View>
        <BottomNav />
      </View>
    )
  }

  // 使用筛选后的数据
  const displayData = filteredData || data
  // 当前页展示的数据（只渲染一部分，避免一次性渲染过多导致卡顿）
  const totalSchoolCount = displayData.schools.length
  const pagedSchools = displayData.schools.slice(0, visibleSchoolCount)
  const hasMoreSchools = visibleSchoolCount < totalSchoolCount

  // 按模式选择警示说明：有专业组时为专业组说明，院校+专业模式时为专业说明（依据接口数据中的 plan 是否有专业组）
  const allApiItems = [...(inRangeApiData || []), ...(notInRangeApiData || [])]
  const hasAnyMajorGroup = allApiItems.some((item) =>
    item.plans?.some((p: EnrollmentPlanItem) => (p.majorGroupId != null && p.majorGroupId > 0 &&  p.majorGroupId != 98746631) || p.majorGroup != null )
  )
  const warningLegendText = hasAnyMajorGroup
    ? '⚠️表示该专业组包含热爱能量低的专业'
    : '该专业的热爱能量低'

  // 其他院校（notInRange）分段展示
  const totalNotInRangeSchoolCount = filteredNotInRangeSchools.length
  const pagedNotInRangeSchools = filteredNotInRangeSchools.slice(0, visibleNotInRangeSchoolCount)
  const hasMoreNotInRangeSchools = visibleNotInRangeSchoolCount < totalNotInRangeSchoolCount

  /**
   * 渲染单个院校卡片（复用同一套 UI）
   * @param school 学校数据
   * @param idx 渲染序号
   * @param apiSource 对应分组的原始接口数据（用于取 plans）
   * @param keyPrefix React key 前缀（避免两段列表 key 冲突）
   */
  const renderSchoolCard = (
    school: School,
    idx: number,
    apiSource: EnrollmentPlanWithScores[],
    keyPrefix: string,
  ) => {
    // 关键：用局部变量遮蔽 apiData，复用原有渲染逻辑（避免复制一整套代码）
    const apiData = apiSource
    const { isIn: isInWishlist, choiceId } = isSchoolInWishlist(school, apiSource)
    void isInWishlist
    void choiceId

    return (
      <Card key={`${keyPrefix}-${idx}`} className="schools-page__school-item">
        <View className="schools-page__school-item-content">
          <View className="schools-page__school-item-header">
          <View className="schools-page__school-item-header-left">
            <View className="schools-page__school-item-name-row">
              <Text className="schools-page__school-item-name">{school.schoolName}</Text>
              {(() => {
                const locationParts: string[] = []
                if (school.provinceName) locationParts.push(school.provinceName)
                if (school.cityName) locationParts.push(school.cityName)
                if (school.belong) locationParts.push(school.belong)
                
                return locationParts.length > 0 ? (
                  <Text className="schools-page__school-item-location-inline">
                    {locationParts.join(' · ')}
                  </Text>
                ) : null
              })()}
            </View>
            {(() => {
              // 处理 features：可能是字符串、数组或空值
              let validFeatures: string[] = []
              if (school.schoolFeature) {
                // 如果是字符串，先检查是否是 "[]"
                const featureStr = String(school.schoolFeature).trim()
                if (featureStr && featureStr !== '[]' && featureStr !== 'null' && featureStr !== 'undefined') {
                  // 尝试解析为数组，如果不是数组则按逗号分割
                  try {
                    const parsed = JSON.parse(featureStr)
                    if (Array.isArray(parsed)) {
                      validFeatures = parsed.filter((f: any) => f && String(f).trim())
                    } else {
                      validFeatures = featureStr.split(',').filter(f => f.trim())
                    }
                  } catch {
                    // 不是 JSON，按逗号分割
                    validFeatures = featureStr.split(',').filter(f => f.trim())
                  }
                }
              }
              return validFeatures.length > 0 ? (
                <View className="schools-page__school-item-features">
                  {validFeatures.map((feature, i) => (
                    <Text key={i} className="schools-page__school-item-feature">
                      {feature.trim()}
                    </Text>
                  ))}
                </View>
              ) : null
            })()}
            <View className="schools-page__school-item-rates">
              <View className="schools-page__school-item-rate">
                <Text className="schools-page__school-item-rate-label">升学率:</Text>
                <Text className="schools-page__school-item-rate-value">{formatRatePercent(school.enrollmentRate)}</Text>
              </View>
              <View className="schools-page__school-item-rate">
                <Text className="schools-page__school-item-rate-label">就业率:</Text>
                <Text className="schools-page__school-item-rate-value">{formatRatePercent(school.employmentRate)}</Text>
              </View>
            </View>
            
            {(() => {
              // 找到当前学校对应的 apiData
              const schoolApiData = apiData.find(item => item.school.name === school.schoolName)
              if (!schoolApiData || !schoolApiData.plans || schoolApiData.plans.length === 0) {
                return null
              }
              
              return (
                <View className="schools-page__school-item-plans">
                  {schoolApiData.plans.map((plan, planIndex) => (
                    <View key={planIndex} className="schools-page__school-item-plan">
                      {plan.enrollmentMajor && (
                        <View className="schools-page__school-item-plan-major">
                          <Text className="schools-page__school-item-plan-major-value">
                            {plan.enrollmentMajor}
                          </Text>
                          {(() => {
                            // 判断当前 plan 是否已加入志愿
                            let isPlanInWishlist = false
                            let planChoiceId: number | undefined = undefined
                            
                            if (groupedChoices && groupedChoices.volunteers.length > 0) {
                              // 获取所有匹配的volunteer（同一个学校可能有多个volunteer，每个volunteer包含不同的专业组）
                              const matchedVolunteers = groupedChoices.volunteers.filter(v => v.school.name === school.schoolName)
                              if (matchedVolunteers.length > 0) {
                                // 获取目标省份和批次
                                // 省份应该从 plan.province 获取，而不是 school.provinceName
                                // 因为志愿的省份是招生省份（如"江苏"），而学校的省份是学校所在省份（如"广东"）
                                const targetProvince = plan.province || plan.majorScores?.[0]?.province || null
                                const targetBatch = plan.batch || null
                                
                                // 遍历所有匹配的volunteer
                                for (const volunteer of matchedVolunteers) {
                                  for (const majorGroup of volunteer.majorGroups) {
                                    for (const choice of majorGroup.choices) {
                                      // 匹配条件：学校代码、省份、批次、专业组ID、招生专业、备注（精确匹配）
                                      const isSchoolMatch = choice.schoolCode === schoolApiData.school.code
                                      
                                      // 如果学校代码不匹配，直接跳过
                                      if (!isSchoolMatch) {
                                        continue
                                      }
                                      
                                      // 专业组匹配（优先使用 majorGroupId，确保类型一致）
                                      let isGroupMatch = false
                                      const planMajorGroupId = plan.majorGroupId || plan.majorGroup?.mgId
                                      const choiceMajorGroupId = choice.majorGroupId
                                      const majorGroupMgId = majorGroup.majorGroup?.mgId
                                      
                                      // 优先使用 choice.majorGroupId 匹配
                                      if (planMajorGroupId && choiceMajorGroupId) {
                                        // 确保类型一致（都转为数字或字符串）
                                        isGroupMatch = (
                                          Number(planMajorGroupId) === Number(choiceMajorGroupId) ||
                                          String(planMajorGroupId) === String(choiceMajorGroupId)
                                        )
                                      }
                                      
                                      // 如果 choice.majorGroupId 为空或未匹配，尝试使用 majorGroup.majorGroup.mgId
                                      if (!isGroupMatch && planMajorGroupId && majorGroupMgId !== null && majorGroupMgId !== undefined) {
                                        isGroupMatch = (
                                          Number(planMajorGroupId) === Number(majorGroupMgId) ||
                                          String(planMajorGroupId) === String(majorGroupMgId)
                                        )
                                      }
                                      
                                      // 院校模式：双方都无专业组 ID，同一学校下视为同一组，仅用备注+招生专业等区分
                                      if (!isGroupMatch && !planMajorGroupId && !choiceMajorGroupId && (majorGroupMgId === null || majorGroupMgId === undefined)) {
                                        isGroupMatch = true
                                      }
                                      // 列表 plan 有 majorGroupId 但已选志愿是院校模式（choice 无 majorGroupId）：仍按学校+备注+招生专业等匹配
                                      if (!isGroupMatch && !choiceMajorGroupId && (majorGroupMgId === null || majorGroupMgId === undefined)) {
                                        isGroupMatch = true
                                      }
                                      
                                      // 专业组ID是区分不同志愿的关键字段，必须严格匹配
                                      // 如果专业组不匹配，直接跳过，不使用备选匹配逻辑
                                      if (!isGroupMatch) {
                                        continue
                                      }
                                      
                                      // 备注匹配（精确匹配）
                                      // 备注是区分同专业组下同名专业的关键字段，必须严格匹配
                                      // 如果备注都为空，认为匹配；如果都有备注，必须完全相等；如果只有一个有备注，不匹配（它们是不同的专业）
                                      let isRemarkMatchForGroup = false
                                      const planRemark = plan.remark?.trim() || null
                                      const choiceRemark = choice.remark?.trim() || null
                                      if (!planRemark && !choiceRemark) {
                                        // 都不存在，认为匹配
                                        isRemarkMatchForGroup = true
                                      } else if (planRemark && choiceRemark) {
                                        // 都存在，必须精确匹配（完全相等）
                                        isRemarkMatchForGroup = (choiceRemark === planRemark)
                                      } else {
                                        // 只有一个存在，不匹配（它们是不同的专业）
                                        isRemarkMatchForGroup = false
                                      }
                                      
                                      // 如果备注不匹配，直接跳过（即使专业组ID匹配，备注不同也认为是不同的志愿）
                                      if (!isRemarkMatchForGroup) {
                                        continue
                                      }
                                      
                                      // 招生专业匹配（必须精确匹配）
                                      // 招生专业是区分不同志愿的关键字段，必须严格匹配
                                      // 如果目标招生专业存在，choice招生专业也必须存在且完全匹配
                                      // 如果目标招生专业不存在，choice招生专业也必须不存在
                                      let isMajorMatch = false
                                      
                                      // 处理空字符串的情况（空字符串视为不存在）
                                      const targetMajor = plan.enrollmentMajor?.trim() || null
                                      const choiceMajor = choice.enrollmentMajor?.trim() || null
                                      
                                      if (!targetMajor && !choiceMajor) {
                                        // 都不存在，认为匹配
                                        isMajorMatch = true
                                      } else if (targetMajor && choiceMajor) {
                                        // 都存在，必须精确匹配（去除首尾空格后比较）
                                        isMajorMatch = (choiceMajor === targetMajor)
                                      } else {
                                        // 只有一个存在，不匹配（这是关键：如果目标有招生专业，choice必须有且匹配）
                                        isMajorMatch = false
                                      }
                                      
                                      // 如果招生专业不匹配，直接跳过
                                      if (!isMajorMatch) {
                                        continue
                                      }
                                      
                                      // 学制匹配（必须精确匹配）
                                      // 学制是区分不同志愿的关键字段（如八年制和五年制），必须严格匹配
                                      // 如果目标学制为空，则跳过学制匹配（认为匹配）
                                      // 如果目标学制不为空，则必须精确匹配
                                      let isStudyPeriodMatch = true
                                      const targetStudyPeriod = plan.studyPeriod?.trim() || null
                                      if (targetStudyPeriod) {
                                        const choiceStudyPeriod = choice.studyPeriod?.trim() || null
                                        if (choiceStudyPeriod) {
                                          isStudyPeriodMatch = (
                                            choiceStudyPeriod === targetStudyPeriod ||
                                            choiceStudyPeriod.trim() === targetStudyPeriod.trim()
                                          )
                                        } else {
                                          // 目标有学制但choice没有，不匹配
                                          isStudyPeriodMatch = false
                                        }
                                      }
                                      // 如果目标学制为空，认为匹配（跳过学制检查）
                                      
                                      // 如果学制不匹配，直接跳过
                                      if (!isStudyPeriodMatch) {
                                        continue
                                      }
                                      
                                      // 省份匹配（必须精确匹配）
                                      // 如果目标省份为空，则跳过省份匹配（认为匹配）
                                      // 如果目标省份不为空，则必须精确匹配
                                      let isProvinceMatch = true
                                      if (targetProvince) {
                                        const choiceProvince = choice.province || null
                                        if (choiceProvince) {
                                          isProvinceMatch = (
                                            choiceProvince === targetProvince ||
                                            choiceProvince.trim() === targetProvince.trim()
                                          )
                                        } else {
                                          // 目标有省份但choice没有，不匹配
                                          isProvinceMatch = false
                                        }
                                      }
                                      // 如果目标省份为空，认为匹配（跳过省份检查）
                                      
                                      // 如果省份不匹配，直接跳过
                                      if (!isProvinceMatch) {
                                        continue
                                      }
                                      
                                      // 批次匹配（必须精确匹配）
                                      // 如果目标批次为空，则跳过批次匹配（认为匹配）
                                      // 如果目标批次不为空，则必须精确匹配
                                      let isBatchMatch = true
                                      if (targetBatch) {
                                        const choiceBatch = choice.batch || null
                                        if (choiceBatch) {
                                          isBatchMatch = (
                                            choiceBatch === targetBatch ||
                                            choiceBatch.trim() === targetBatch.trim()
                                          )
                                        } else {
                                          // 目标有批次但choice没有，不匹配
                                          isBatchMatch = false
                                        }
                                      }
                                      // 如果目标批次为空，认为匹配（跳过批次检查）
                                      
                                      // 如果批次不匹配，直接跳过
                                      if (!isBatchMatch) {
                                        continue
                                      }
                                      
                                      // 当学校、专业组、备注、招生专业、学制、省份、批次都匹配时，认为已加入志愿
                                      // 备注已经在专业组匹配后检查过了（isRemarkMatchForGroup），所以这里直接认为匹配
                                      isPlanInWishlist = true
                                      planChoiceId = choice.id
                                      break
                                    }
                                    if (isPlanInWishlist) break
                                  }
                                  // 如果在这个volunteer中找到了匹配，退出外层循环
                                  if (isPlanInWishlist) break
                                }
                              }
                            }
                            
                            // 如果从热门专业页面跳转过来，不显示添加志愿按钮
                            if (isFromPopularMajors) {
                              return null
                            }
                            
                            return (
                              <Text 
                                className={`schools-page__school-item-plan-major-action ${isPlanInWishlist ? 'schools-page__school-item-plan-major-action--active' : ''}`}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (isPlanInWishlist && planChoiceId) {
                                    await handleRemoveChoice(planChoiceId, school)
                                  } else {
                                    try {
                                      // 构建创建志愿的DTO
                                      const createChoiceDto: CreateChoiceDto = {
                                        mgId: plan.majorGroupId || plan.majorGroup?.mgId || school.majorGroupId || null,
                                        schoolCode: schoolApiData.school.code,
                                        enrollmentMajor: plan.enrollmentMajor || null,
                                        batch: plan.batch || null,
                                        majorGroupInfo: plan.majorGroupInfo || plan.majorGroup?.mgInfo || null,
                                        subjectSelectionMode: plan.subjectSelectionMode || plan.majorGroup?.subjectSelectionMode || null,
                                        studyPeriod: plan.studyPeriod || null,
                                        enrollmentQuota: plan.enrollmentQuota || null,
                                        remark: plan.remark || null,
                                        tuitionFee: plan.tuitionFee || null,
                                        curUnit: plan.curUnit || null,
                                        majorScores: plan.majorScores?.map(score => ({
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
                                      
                                      await createChoice(createChoiceDto)
                                      
                                      // 重新加载志愿列表
                                      const choicesData = await getChoices()
                                      setGroupedChoices(choicesData)
                                      
                                      // 更新choiceId映射
                                      const idMap = new Map<string, number>()
                                      choicesData.volunteers.forEach((volunteer) => {
                                        volunteer.majorGroups.forEach((majorGroup) => {
                                          majorGroup.choices.forEach((choice) => {
                                            const key = `${choice.schoolCode}-${choice.majorGroupId || 'no-group'}`
                                            idMap.set(key, choice.id)
                                          })
                                        })
                                      })
                                      setChoiceIdMap(idMap)
                                      
                                      // 更新wishlist状态
                                      const wishlistSet = new Set<string>()
                                      choicesData.volunteers.forEach((volunteer) => {
                                        volunteer.majorGroups.forEach((majorGroup) => {
                                          majorGroup.choices.forEach((choice) => {
                                            const key = `${majorCode}-${volunteer.school.name}`
                                            wishlistSet.add(key)
                                          })
                                        })
                                      })
                                      setWishlist(wishlistSet)
                                      
                                      Taro.showToast({
                                        title: '已加入志愿',
                                        icon: 'success',
                                        duration: 2000
                                      })

                                      // 设置刷新标记，通知父页面返回时需要刷新
                                      await setStorage('needRefreshChoices', true)
                                    } catch (error: any) {
                                      console.error('加入志愿失败:', error)
                                      Taro.showToast({
                                        title: error?.message || '加入志愿失败，请重试',
                                        icon: 'none',
                                        duration: 2000
                                      })
                                    }
                                  }
                                }}
                              >
                                {isPlanInWishlist ? '移除志愿' : '加入志愿'}
                              </Text>
                            )
                          })()}
                        </View>
                      )}
                      {plan.remark && (
                        <View className="schools-page__school-item-plan-remark">
                          <Text className="schools-page__school-item-plan-remark-text">{plan.remark}</Text>
                        </View>
                      )}
                      
                      {(plan.majorGroupInfo || plan.enrollmentQuota) && (
                        <View className="schools-page__school-item-plan-info">
                          {plan.majorGroupInfo && (
                            <Text className="schools-page__school-item-plan-info-text">
                              选科: {plan.majorGroupInfo}
                            </Text>
                          )}
                          {plan.enrollmentQuota && (
                            <Text className="schools-page__school-item-plan-info-text">
                              {plan.majorGroupInfo ? ' · ' : ''}招生人数: {plan.enrollmentQuota}
                            </Text>
                          )}
                        </View>
                      )}
                      
                      {/* majorGroup 为 null 时不显示查看专业组按钮 */}
                      {plan.majorGroup != null && (plan.majorGroupId || plan.majorGroup?.mgId) && (
                        <View className="schools-page__school-item-plan-group-button-wrapper">
                          <Text 
                            className="schools-page__school-item-plan-group-button"
                            onClick={async (e) => {
                              e.stopPropagation()
                              const mgId = plan.majorGroupId || plan.majorGroup?.mgId
                              if (!mgId) return
                              
                              try {
                                setLoadingGroupInfo(true)
                                const planMajorGroupName = plan.majorGroup?.mgName || plan.majorGroupInfo || '专业组'
                                setSelectedGroupInfo({
                                  schoolName: school.schoolName,
                                  majorGroupName: planMajorGroupName,
                                  majorGroupId: mgId,
                                })
                                // 保存学校数据，用于后续加入志愿
                                setSelectedSchoolData(school)
                                // 保存当前plan数据
                                setSelectedPlanData(plan)
                                
                                // 调用 API 获取专业组信息
                                const groupInfo = await getMajorGroupInfo(mgId)
                                setGroupInfoData(groupInfo)
                                setGroupDialogOpen(true)
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
                            查看专业组{plan.majorGroup?.mgName ? `: ${plan.majorGroup.mgName}` : ''}
                            {(plan.majorGroupId != null || plan.majorGroup?.mgId != null) &&
                              warningMajorGroupIds.has(plan.majorGroupId ?? plan.majorGroup?.mgId ?? 0) && (
                              <Text className="schools-page__school-item-plan-warning"> ⚠️</Text>
                            )}
                          </Text>
                        </View>
                      )}
                      
                      {plan.majorScores && plan.majorScores.length > 0 && (
                        <View className="schools-page__school-item-plan-scores">
                          {plan.majorScores.map((score, scoreIndex) => (
                            <View key={scoreIndex} className="schools-page__school-item-plan-score">
                              {score.minScore !== null && (
                                <Text className="schools-page__school-item-plan-score-text">
                                  {score.year}年最低分数: {Math.floor(score.minScore)}
                                </Text>
                              )}
                              {score.minRank !== null && (
                                <Text className="schools-page__school-item-plan-score-text">
                                  最低位次: {score.minRank}
                                  {(score as any).rankDiff ? `, ${(score as any).rankDiff}` : ''}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )
            })()}
          </View>
        </View>
      </View>
      </Card>
    )
  }

  return (
    <View className="schools-page">
      
      {/* 头部 */}
      <View className="schools-page__header">
        <View className="schools-page__header-content">
          <Text className="schools-page__title">
            {majorName || data.major.name} ({data.major.code}) - 院校列表
          </Text>
          {/* 如果从热门专业页面跳转过来，显示高考信息按钮 */}
          {isFromPopularMajors && (
            <Button
              size="sm"
              variant="outline"
              className="schools-page__exam-info-button"
              onClick={() => {
                // 打开弹框前先获取最新的高考信息
                getExamInfo().then((info) => {
                  setExamInfo(info)
                  setShowExamInfoDialog(true)
                }).catch((error) => {
                  console.error('获取高考信息失败:', error)
                  setShowExamInfoDialog(true)
                })
              }}
            >
              高考信息
            </Button>
          )}
        </View>
        <View className="schools-page__wave" />
      </View>

      {/* 省份筛选 */}
      {provinces.length > 0 && (
        <View className="schools-page__province-filter-wrapper">
          <View 
            ref={provinceFilterRef as any}
            className={`schools-page__province-filter ${isProvincesExpanded ? 'schools-page__province-filter--expanded' : (isProvincesOverflow ? 'schools-page__province-filter--collapsed' : '')}`}
          >
            <View className="schools-page__province-filter-content">
              <View className="schools-page__province-filter-item" onClick={() => setSelectedProvince(null)}>
                <Text className={`schools-page__province-filter-text ${selectedProvince === null ? 'schools-page__province-filter-text--active' : ''}`}>
                  全部
                </Text>
              </View>
              {provinces.map((province) => (
                <View
                  key={province}
                  className="schools-page__province-filter-item"
                  onClick={() => setSelectedProvince(province)}
                >
                  <Text className={`schools-page__province-filter-text ${selectedProvince === province ? 'schools-page__province-filter-text--active' : ''}`}>
                    {province}
                  </Text>
                </View>
              ))}
              {isProvincesOverflow && (
                <View 
                  className={`schools-page__province-filter-toggle ${isProvincesExpanded ? 'schools-page__province-filter-toggle--inline' : 'schools-page__province-filter-toggle--absolute'}`}
                  onClick={() => setIsProvincesExpanded(!isProvincesExpanded)}
                >
                  <Text className="schools-page__province-filter-toggle-text">
                    {isProvincesExpanded ? '收起' : '展开'}
                  </Text>
                  <Text className={`schools-page__province-filter-toggle-icon ${isProvincesExpanded ? 'schools-page__province-filter-toggle-icon--expanded' : ''}`}>
                    ▼
                  </Text>
                </View>
              )}
            </View>
          </View>
          {hasAnyMajorGroup && (
            <Text className="schools-page__warning-legend">{warningLegendText}</Text>
          )}
        </View>
      )}

      {/* 内容 */}
      <View className="schools-page__content">
        <View className="schools-page__schools-list">
          {displayData.schools.length > 0 ? (
            pagedSchools.map((school, idx) => renderSchoolCard(school, idx, inRangeApiData, 'inRange'))
          ) : (
            <View className="schools-page__empty">
              <Text>暂无符合条件的院校</Text>
            </View>
          )}

          {/* 分段加载：一次追加 10 条 */}
          {displayData.schools.length > 0 && hasMoreSchools && (
            <View className="schools-page__load-more">
              <Button
                variant="outline"
                onClick={() => {
                  setVisibleSchoolCount((prev) => Math.min(prev + SCHOOLS_PAGE_SIZE, totalSchoolCount))
                }}
              >
                加载更多（已显示 {Math.min(visibleSchoolCount, totalSchoolCount)}/{totalSchoolCount}）
              </Button>
            </View>
          )}

          {/* 其他院校：点击展开，再次点击可收起（不显示数量） */}
          {filteredNotInRangeSchools.length > 0 && (
            <View className="schools-page__load-more">
              <Button
                onClick={() => {
                  setShowNotInRange((prev) => {
                    const next = !prev
                    // 收起时重置“其他院校”分页状态
                    if (!next) {
                      setVisibleNotInRangeSchoolCount(SCHOOLS_PAGE_SIZE)
                    }
                    // 展开时也确保从 10 条开始
                    if (next) {
                      setVisibleNotInRangeSchoolCount(SCHOOLS_PAGE_SIZE)
                    }
                    return next
                  })
                }}
              >
                {showNotInRange ? '收起其他院校' : '其他院校'}
              </Button>
            </View>
          )}

          {showNotInRange && (
            <View>
              <View className="schools-page__load-more">
                <Text>其他院校</Text>
              </View>
              {totalNotInRangeSchoolCount > 0 ? (
                <>
                  {pagedNotInRangeSchools.map((school, idx) =>
                    renderSchoolCard(school, idx, notInRangeApiData, 'notInRange'),
                  )}

                  {hasMoreNotInRangeSchools && (
                    <View className="schools-page__load-more">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setVisibleNotInRangeSchoolCount((prev) =>
                            Math.min(prev + SCHOOLS_PAGE_SIZE, totalNotInRangeSchoolCount),
                          )
                        }}
                      >
                        加载更多（已显示 {Math.min(visibleNotInRangeSchoolCount, totalNotInRangeSchoolCount)}/
                        {totalNotInRangeSchoolCount}）
                      </Button>
                    </View>
                  )}
                </>
              ) : (
                <View className="schools-page__empty">
                  <Text>暂无其他院校</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      <BottomNav />

      {/* 删除确认对话框 */}
      <Dialog 
        open={deleteConfirmOpen} 
        onOpenChange={setDeleteConfirmOpen}
        className="schools-page__delete-confirm-dialog-wrapper"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认移除</DialogTitle>
            <DialogDescription>确定要从志愿中移除此院校专业吗？此操作无法撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setDeleteConfirmOpen(false)
                setChoiceToDelete(null)
              }}
              variant="outline"
            >
              取消
            </Button>
            <Button
              onClick={confirmDeleteChoice}
              className="schools-page__delete-button"
            >
              确定移除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 专业组信息弹出框 */}
      <Dialog 
        className="schools-page__group-dialog-wrapper"
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
            setExpandedPlans(new Set()) // 清空展开状态
            setExpandedScores(new Set()) // 清空 scores 展开状态
          }
        }}
      >
        <DialogContent className="schools-page__group-dialog">
          <DialogHeader>
            <View className="schools-page__group-dialog-title-wrapper">
              <Text className="schools-page__group-dialog-title-text">
                {selectedGroupInfo?.schoolName} - {selectedGroupInfo?.majorGroupName} 专业组信息
              </Text>
            </View>
          </DialogHeader>
          <ScrollView className="schools-page__group-dialog-content" scrollY style={{ height: '80vh' }}>
            <View className="schools-page__group-dialog-content-inner">
            {loadingGroupInfo ? (
              <View className="schools-page__group-dialog-empty">
                <Text>加载中...</Text>
              </View>
            ) : groupInfoData.length === 0 ? (
              <View className="schools-page__group-dialog-empty">
                <Text>暂无专业组信息</Text>
                <Text className="schools-page__group-dialog-empty-desc">数据未加载或为空</Text>
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
                  <View key={planIdx} className="schools-page__group-section-new">
                    {/* 第一行：enrollmentMajor + 加入志愿/删除志愿按钮 */}
                    {plan.enrollmentMajor && (
                      <View className="schools-page__group-major-row">
                        <View className="schools-page__group-major-name-wrapper">
                          <Text className="schools-page__group-major-name">{plan.enrollmentMajor}</Text>
                          {/* 如果只有一个 score，在 enrollmentMajor 后面显示热爱能量 */}
                          {isSingleScore && singleLoveEnergy !== null && (
                            <Text className="schools-page__group-major-energy">
                              热爱能量：{singleLoveEnergy}
                            </Text>
                          )}
                          {/* 该专业存在分数低于后20%最高分时显示标记 */}
                          {hasScoreBelowMax && (
                            <Text className="schools-page__group-dialog-score-warning"> ⚠️</Text>
                          )}
                        </View>
                        {(() => {
                          // 如果从热门专业页面跳转过来，不显示添加志愿按钮
                          if (isFromPopularMajors) {
                            return null
                          }
                          
                          const { isIn, choiceId } = isPlanInWishlist(plan)
                          if (isIn && choiceId) {
                            return (
                              <Text
                                className="schools-page__group-major-action schools-page__group-major-action--remove"
                                onClick={() => handleAddPlanToWishlist(plan)}
                              >
                                移除志愿
                              </Text>
                            )
                          }
                          return (
                            <Text
                              className="schools-page__group-major-action"
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
                      <View className="schools-page__group-remark">
                        <Text>{plan.remark}</Text>
                      </View>
                    )}

                    {/* 多个 scores 时，在 remark 下面显示 */}
                    {!isSingleScore && plan.scores && plan.scores.length > 0 && (
                      <View className="schools-page__group-scores-multiple">
                        {(() => {
                          // 拼接为一行：majorName:热爱能量、majorName:热爱能量
                          const scoreText = plan.scores
                            .map((score) => {
                              const loveEnergy = normalizeLoveEnergy(score.loveEnergy)
                              const energyText = loveEnergy !== null ? String(loveEnergy) : '-'
                              const majorName = score.majorName ? String(score.majorName) : ''
                              return majorName ? `${majorName}:${energyText}` : energyText
                            })
                            .filter((s) => s)
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
                              className={`schools-page__group-scores-row ${isScoresExpanded ? 'schools-page__group-scores-row--expanded' : ''}`}
                              onClick={toggleExpanded}
                            >
                              <Text className="schools-page__group-scores-text">
                                热爱能量：{scoreText}
                              </Text>
                              <View
                                className="schools-page__group-scores-arrow"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleExpanded()
                                }}
                              >
                                <Text className="schools-page__group-scores-arrow-icon">
                                  {isScoresExpanded ? '▲' : '▼'}
                                </Text>
                              </View>
                            </View>
                          )
                        })()}
                      </View>
                    )}

                    {/* 第三行：学制：studyPeriod 招生人数：enrollmentQuota */}
                    <View className="schools-page__group-info-row">
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
          <View className="schools-page__group-dialog-footer">
            <Button
              className="schools-page__group-dialog-close-button"
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
        repeatCount={repeatCount}
      />

      {/* 高考信息对话框 */}
      {isFromPopularMajors && (
        <ExamInfoDialog
          open={showExamInfoDialog}
          onOpenChange={setShowExamInfoDialog}
          examInfo={examInfo}
          onUpdate={(updatedInfo) => {
            if (updatedInfo) {
              setExamInfo(updatedInfo)
              // 从热门专业进入时，修改高考信息后重新获取院校列表等数据
              setDataRefreshTrigger((prev) => prev + 1)
            }
          }}
        />
      )}
    </View>
  )
}
