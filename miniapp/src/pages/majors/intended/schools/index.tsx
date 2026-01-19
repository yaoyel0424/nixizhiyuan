// 院校列表页面
import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { BottomNav } from '@/components/BottomNav'
import { QuestionnaireRequiredModal } from '@/components/QuestionnaireRequiredModal'
import { useQuestionnaireCheck } from '@/hooks/useQuestionnaireCheck'
import { getStorage, setStorage } from '@/utils/storage'
import { getEnrollmentPlansByMajorId, EnrollmentPlanWithScores, getMajorGroupInfo, MajorGroupInfo, EnrollmentPlanItem } from '@/services/enroll-plan'
import { createChoice, CreateChoiceDto, getChoices, deleteChoice, GroupedChoiceResponse } from '@/services/choices'
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
  const { isCompleted: isQuestionnaireCompleted, isLoading: isCheckingQuestionnaire, answerCount } = useQuestionnaireCheck()
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  
  const router = useRouter()
  const majorCode = router.params?.majorCode || ''
  const majorIdParam = router.params?.majorId || ''
  const majorId = majorIdParam ? parseInt(majorIdParam, 10) : null
  const majorNameParam = router.params?.majorName || ''
  
  const [data, setData] = useState<IntentionMajor | null>(null)
  const [apiData, setApiData] = useState<EnrollmentPlanWithScores[]>([]) // 保存原始API数据
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

  // 从 apiData 中提取并去重省份列表
  const provinces = React.useMemo(() => {
    if (!apiData || apiData.length === 0) return []
    const provinceSet = new Set<string>()
    apiData.forEach((item) => {
      if (item.school?.provinceName) {
        provinceSet.add(item.school.provinceName)
      }
    })
    return Array.from(provinceSet).sort()
  }, [apiData])

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

  // 检查问卷完成状态
  useEffect(() => {
    if (!isCheckingQuestionnaire && !isQuestionnaireCompleted) {
      setShowQuestionnaireModal(true)
    }
  }, [isCheckingQuestionnaire, isQuestionnaireCompleted])

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

  // 将 API 返回的数据转换为页面需要的格式
  const convertApiDataToSchoolList = (apiData: EnrollmentPlanWithScores[], majorCode: string): IntentionMajor | null => {
    if (!apiData || apiData.length === 0) {
      return null
    }

    // 从第一个招生计划中获取专业名称
    let majorName = majorCode
    if (apiData[0]?.plans?.[0]?.enrollmentMajor) {
      majorName = apiData[0].plans[0].enrollmentMajor
    }

    const schools: School[] = apiData.map((item) => {
      // 获取第一个招生计划的专业组信息
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

        const apiData = await getEnrollmentPlansByMajorId(majorId)
        
        if (!apiData || apiData.length === 0) {
          console.warn('API 返回数据为空')
          setData(null)
          setLoading(false)
          return
        }

        // 保存原始API数据
        setApiData(apiData)
        // 如果路由参数中没有 majorName，则从 API 数据中获取
        if (!majorNameParam) {
          const majorNameFromApi = apiData[0]?.plans[0]?.enrollmentMajor || majorCode
          setMajorName(majorNameFromApi)
        }
        
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
  }, [majorCode, majorId])

  // 判断学校是否已加入志愿
  const isSchoolInWishlist = (schoolData: School): { isIn: boolean; choiceId?: number } => {
    // 优先使用groupedChoices判断（最准确，直接从API返回的数据判断）
    if (groupedChoices && groupedChoices.volunteers.length > 0) {
      // 查找匹配的学校
      const volunteer = groupedChoices.volunteers.find(v => v.school.name === schoolData.schoolName)
      if (volunteer) {
        // 查找匹配的专业组
        const mgId = schoolData.majorGroupId
        for (const majorGroup of volunteer.majorGroups) {
          if (majorGroup.majorGroup.mgId === mgId || (!mgId && majorGroup.majorGroup.mgId === null)) {
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
    if (choiceIdMap.size > 0 && apiData.length > 0) {
      const apiSchoolData = apiData.find(item => item.school.name === schoolData.schoolName)
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
        const apiSchoolData = apiData.find(item => item.school.name === choiceToDelete.schoolData.schoolName)
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
    const { isIn, choiceId } = isSchoolInWishlist(schoolData)
    
    if (isIn && choiceId) {
      // 移除志愿
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
    } catch (error: any) {
      console.error('加入志愿失败:', error)
      Taro.showToast({
        title: error?.message || '加入志愿失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  }

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
    
    if (!targetMajorGroupName && !targetMajorGroupId) {
      return { isIn: false }
    }
    
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
              
              // 匹配备注（如果招生专业已匹配，备注匹配要求可以放宽）
              // 如果目标备注和choice备注都存在，尝试匹配（允许部分匹配或都为空）
              // 如果都不存在，认为匹配
              // 如果只有一个存在，也认为匹配（因为备注可能不完整）
              let isRemarkMatch = false
              if (!targetRemark && !choiceRemark) {
                // 都不存在，认为匹配
                isRemarkMatch = true
              } else if (targetRemark && choiceRemark) {
                // 都存在，尝试精确匹配或部分匹配
                const targetRemarkTrim = targetRemark.trim()
                const choiceRemarkTrim = choiceRemark.trim()
                isRemarkMatch = (
                  choiceRemarkTrim === targetRemarkTrim ||
                  choiceRemarkTrim.includes(targetRemarkTrim) ||
                  targetRemarkTrim.includes(choiceRemarkTrim)
                )
              } else {
                // 只有一个存在，也认为匹配（备注可能不完整）
                isRemarkMatch = true
              }
              
              // 当专业组匹配、招生专业匹配、且备注匹配时，认为已加入志愿
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
        remark: plan.remark || matchedPlan.remark || null,
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

  return (
    <View className="schools-page">
      
      {/* 头部 */}
      <View className="schools-page__header">
        <View className="schools-page__header-content">
          <Text className="schools-page__title">
            {majorName || data.major.name} ({data.major.code}) - 院校列表
          </Text>
        </View>
        <View className="schools-page__wave" />
      </View>

      {/* 省份筛选 */}
      {provinces.length > 0 && (
        <View className="schools-page__province-filter">
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
        </View>
      )}

      {/* 内容 */}
      <View className="schools-page__content">
        <View className="schools-page__schools-list">
          {displayData.schools.length > 0 ? (
            displayData.schools.map((school, idx) => {
              const schoolKey = `${majorCode}-${school.schoolName}`
              const { isIn: isInWishlist, choiceId } = isSchoolInWishlist(school)

              return (
                <Card key={idx} className="schools-page__school-item">
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
                                        const volunteer = groupedChoices.volunteers.find(v => v.school.name === school.schoolName)
                                        if (volunteer) {
                                          for (const majorGroup of volunteer.majorGroups) {
                                            for (const choice of majorGroup.choices) {
                                              // 匹配条件：学校代码、专业组ID、招生专业
                                              const isSchoolMatch = choice.schoolCode === schoolApiData.school.code
                                              const isGroupMatch = (choice.majorGroupId === plan.majorGroupId) || 
                                                                   (plan.majorGroupId && majorGroup.majorGroup.mgId === plan.majorGroupId)
                                              const isMajorMatch = choice.enrollmentMajor === plan.enrollmentMajor
                                              
                                              if (isSchoolMatch && isGroupMatch && isMajorMatch) {
                                                isPlanInWishlist = true
                                                planChoiceId = choice.id
                                                break
                                              }
                                            }
                                            if (isPlanInWishlist) break
                                          }
                                        }
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
                                
                                {school.majorGroupId && (
                                  <View className="schools-page__school-item-plan-group-button-wrapper">
                                    <Text 
                                      className="schools-page__school-item-plan-group-button"
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        const mgId = school.majorGroupId
                                        if (!mgId) return
                                        
                                        try {
                                          setLoadingGroupInfo(true)
                                          setSelectedGroupInfo({
                                            schoolName: school.schoolName,
                                            majorGroupName: school.majorGroupName || '专业组',
                                            majorGroupId: mgId,
                                          })
                                          // 保存学校数据，用于后续加入志愿
                                          setSelectedSchoolData(school)
                                          
                                          // 找到对应的plan数据（从apiData中）
                                          let matchedPlan: EnrollmentPlanItem | null = null
                                          if (apiData.length > 0) {
                                            const schoolData = apiData.find(item => item.school.name === school.schoolName)
                                            if (schoolData) {
                                              // 找到匹配的plan（通过majorGroupId）
                                              matchedPlan = schoolData.plans.find(p => 
                                                (p.majorGroupId && p.majorGroupId === mgId) ||
                                                (p.majorGroup?.mgId && p.majorGroup.mgId === mgId)
                                              ) || schoolData.plans[0] || null
                                            }
                                          }
                                          setSelectedPlanData(matchedPlan)
                                          
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
                                      查看专业组{school.majorGroupName ? `: ${school.majorGroupName}` : ''} 👁️
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
            })
          ) : (
            <View className="schools-page__empty">
              <Text>暂无符合条件的院校</Text>
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
            <DialogTitle>
              {selectedGroupInfo?.schoolName} - {selectedGroupInfo?.majorGroupName} 专业组信息
            </DialogTitle>
          </DialogHeader>
          <View className="schools-page__group-dialog-content">
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
                        </View>
                        {(() => {
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
