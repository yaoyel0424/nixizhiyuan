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
import intentionData from '@/assets/data/intention.json'
import groupData from '@/assets/data/group.json'
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
  // 检查问卷完成状态
  const { isCompleted: isQuestionnaireCompleted, isLoading: isCheckingQuestionnaire, answerCount } = useQuestionnaireCheck()
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  
  const router = useRouter()
  const majorCode = router.params?.majorCode || ''
  const majorIdParam = router.params?.majorId || ''
  const majorId = majorIdParam ? parseInt(majorIdParam, 10) : null
  
  const [data, setData] = useState<IntentionMajor | null>(null)
  const [apiData, setApiData] = useState<EnrollmentPlanWithScores[]>([]) // 保存原始API数据
  const [loading, setLoading] = useState(true)
  const [wishlist, setWishlist] = useState<Set<string>>(new Set())
  const [groupedChoices, setGroupedChoices] = useState<GroupedChoiceResponse | null>(null) // 已加入的志愿列表
  const [choiceIdMap, setChoiceIdMap] = useState<Map<string, number>>(new Map()) // 保存学校代码+专业组ID到choiceId的映射
  const [groupDataList, setGroupDataList] = useState<any[]>([])
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

  // 检查问卷完成状态
  useEffect(() => {
    if (!isCheckingQuestionnaire && !isQuestionnaireCompleted) {
      setShowQuestionnaireModal(true)
    }
  }, [isCheckingQuestionnaire, isQuestionnaireCompleted])

  // 对话框打开时，重新加载志愿状态
  useEffect(() => {
    if (groupDialogOpen) {
      const reloadChoices = async () => {
        try {
          // 重新从API加载志愿列表
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
        } catch (error) {
          console.error('重新加载志愿列表失败:', error)
        }
      }
      reloadChoices()
    }
  }, [groupDialogOpen])

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
            [year]: `${minScore},${minRank},${totalAdmitCount}`
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

      // 计算位次变化百分比（这里简化处理，实际应该根据用户位次计算）
      const rankDiffPer = 0 // 暂时设为0，后续可以根据用户位次计算

      return {
        schoolName: item.school.name,
        schoolNature: item.school.nature || '',
        rankDiffPer: rankDiffPer,
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
    const loadData = async () => {
      try {
        // 如果有 majorId，优先从 API 获取数据
        if (majorId && majorCode) {
          console.log('从 API 加载院校列表数据，majorId:', majorId, 'majorCode:', majorCode)
          try {
            const apiData = await getEnrollmentPlansByMajorId(majorId)
            console.log('API 返回的数据:', apiData)
            
            if (apiData && apiData.length > 0) {
              // 保存原始API数据
              setApiData(apiData)
              // 从第一个学校数据中获取专业名称
              const majorNameFromApi = apiData[0]?.plans[0]?.enrollmentMajor || majorCode
              setMajorName(majorNameFromApi)
              
              const convertedData = convertApiDataToSchoolList(apiData, majorCode)
              console.log('转换后的数据:', convertedData)
              setData(convertedData)
              setLoading(false)
              return
            } else {
              console.warn('API 返回数据为空，降级使用静态数据')
            }
          } catch (error) {
            console.error('从 API 加载数据失败，降级使用静态数据:', error)
          }
        }

        // 降级：从静态 JSON 文件加载数据
        console.log('从静态 JSON 加载数据，majorCode:', majorCode)
        const allData = intentionData as IntentionMajor[]
        const majorData = allData.find((item) => item.major.code === majorCode)
        setData(majorData || null)
        setLoading(false)
      } catch (error) {
        console.error('加载数据失败:', error)
        setLoading(false)
      }
    }

    const loadGroupData = async () => {
      try {
        const groupJson = groupData as any
        console.log('group.json 加载结果:', groupJson)
        if (groupJson.data && Array.isArray(groupJson.data)) {
          console.log('设置 groupData，数量:', groupJson.data.length)
          setGroupDataList(groupJson.data)
        } else {
          console.warn('group.json 数据格式不正确:', groupJson)
        }
      } catch (error) {
        console.error('加载专业组数据失败:', error)
      }
    }

    // 无论是否有 majorCode，都加载专业组数据
    loadGroupData()
    
    if (majorCode) {
      loadData()
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
        // 降级：从本地存储加载
        const saved = await getStorage<string[]>('school-wishlist').catch(() => [])
        if (saved) {
          setWishlist(new Set(saved))
        }
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
    
    // 降级：使用choiceIdMap判断
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
    
    // 最后降级：使用旧的wishlist判断
    const schoolKey = `${majorCode}-${schoolData.schoolName}`
    return { isIn: wishlist.has(schoolKey) }
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

  // 判断plan是否已加入志愿
  const isPlanInWishlist = (plan: MajorGroupInfo): { isIn: boolean; choiceId?: number } => {
    if (!selectedSchoolData || !apiData.length || !choiceIdMap.size) {
      return { isIn: false }
    }
    
    // 从apiData中找到学校代码
    const apiSchoolData = apiData.find(item => item.school.name === selectedSchoolData.schoolName)
    if (!apiSchoolData) {
      return { isIn: false }
    }
    
    const schoolCode = apiSchoolData.school.code
    const mgId = selectedGroupInfo?.majorGroupId || selectedPlanData?.majorGroupId
    
    // 构建key：schoolCode-majorGroupId
    const key = `${schoolCode}-${mgId || 'no-group'}`
    const choiceId = choiceIdMap.get(key)
    
    return { isIn: choiceId !== undefined, choiceId }
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

      {/* 内容 */}
      <View className="schools-page__content">
        <View className="schools-page__schools-list">
          {data.schools.map((school, idx) => {
            const schoolKey = `${majorCode}-${school.schoolName}`
            const { isIn: isInWishlist, choiceId } = isSchoolInWishlist(school)

            return (
              <Card key={idx} className="schools-page__school-item">
                <View className="schools-page__school-item-content">
                  <View className="schools-page__school-item-header">
                    <View className="schools-page__school-item-header-left">
                      <Text className="schools-page__school-item-name">{school.schoolName}</Text>
                      {school.majorGroupId && (
                        <Button
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
                          className="schools-page__school-item-group-button"
                          size="sm"
                          variant="default"
                        >
                          <Text className="schools-page__school-item-group-icon">📋</Text>
                          <Text className="schools-page__school-item-group-text">
                            专业组{school.majorGroupName ? `: ${school.majorGroupName}` : ''}
                          </Text>
                          <Text className="schools-page__school-item-group-arrow">→</Text>
                        </Button>
                      )}
                    </View>
                    <View className="schools-page__school-item-actions">
                      <View className={`schools-page__school-item-rank ${school.rankDiffPer > 0 ? 'schools-page__school-item-rank--positive' : 'schools-page__school-item-rank--negative'}`}>
                        <Text className="schools-page__school-item-rank-text">
                          您的位次比去年
                        </Text>
                        <Text className="schools-page__school-item-rank-icon">
                          {school.rankDiffPer > 0 ? '↑' : '↓'}
                        </Text>
                        <Text className="schools-page__school-item-rank-value">
                          {Math.abs(school.rankDiffPer).toFixed(1)}%
                        </Text>
                      </View>
                      {isInWishlist && choiceId ? (
                        <Button
                          onClick={() => handleRemoveChoice(choiceId, school)}
                          className="schools-page__school-item-wishlist-button schools-page__school-item-wishlist-button--remove"
                          size="sm"
                        >
                          移除志愿
                        </Button>
                      ) : (
                        <Button
                          onClick={() => toggleWishlist(schoolKey, school)}
                          className="schools-page__school-item-wishlist-button"
                          size="sm"
                        >
                          加入志愿
                        </Button>
                      )}
                    </View>
                  </View>

                  <View className="schools-page__school-item-info">
                    <View className="schools-page__school-item-location">
                      <Text>📍 {school.provinceName} · {school.cityName}</Text>
                      <Text>🏛️ {school.belong}</Text>
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
                        <Text className="schools-page__school-item-rate-value">{school.enrollmentRate}%</Text>
                      </View>
                      <View className="schools-page__school-item-rate">
                        <Text className="schools-page__school-item-rate-label">就业率:</Text>
                        <Text className="schools-page__school-item-rate-value">{school.employmentRate}%</Text>
                      </View>
                      {school.studyPeriod && (
                        <View className="schools-page__school-item-rate">
                          <Text className="schools-page__school-item-rate-label">学制:</Text>
                          <Text className="schools-page__school-item-rate-value">{school.studyPeriod}</Text>
                        </View>
                      )}
                      {school.tuitionFee && (
                        <View className="schools-page__school-item-rate">
                          <Text className="schools-page__school-item-rate-label">学费:</Text>
                          <Text className="schools-page__school-item-rate-value">
                            {school.tuitionFee.includes('元') ? school.tuitionFee : `${school.tuitionFee}元`}
                          </Text>
                        </View>
                      )}
                    </View>

                    {school.historyScores.length > 0 && school.historyScores[0].historyScore && (
                      <View className="schools-page__school-item-history">
                        <View className="schools-page__school-item-history-table">
                          <View className="schools-page__school-item-history-header">
                            <Text>年份</Text>
                            <Text>最低分数</Text>
                            <Text>最低位次</Text>
                            <Text>招生人数</Text>
                          </View>
                          {school.historyScores[0].historyScore.map((score, i) => {
                            const [year, data] = Object.entries(score)[0]
                            const [minScore, minRank, planNum] = data.split(',')
                            return (
                              <View key={i} className="schools-page__school-item-history-row">
                                <Text>{year}</Text>
                                <Text>{minScore}</Text>
                                <Text>{minRank}</Text>
                                <Text>{planNum}</Text>
                              </View>
                            )
                          })}
                        </View>
                        {(school.historyScores[0].batch || school.historyScores[0].remark) && (
                          <View className="schools-page__school-item-history-batch">
                            {school.historyScores[0].batch && (
                              <Text className="schools-page__school-item-history-batch-text">
                                {school.historyScores[0].batch}
                              </Text>
                            )}
                            {school.historyScores[0].remark && (
                              <Text>{school.historyScores[0].remark}</Text>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            )
          })}
        </View>
      </View>

      <BottomNav />

      {/* 删除确认对话框 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
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
                // 找出最低的热爱能量分数
                const scores = plan.scores
                  .map(s => s.loveEnergy)
                  .filter(s => s !== null && s > 0) as number[]
                const minScore = scores.length > 0 ? Math.min(...scores) : null
                
                // 找出所有最低分数的专业（包括并列最低的，如51和52都是最低时）
                const lowestScoreMajors = minScore !== null 
                  ? plan.scores.filter(s => {
                      return s.loveEnergy !== null && s.loveEnergy > 0 && 
                        (s.loveEnergy === minScore || s.loveEnergy === minScore + 1)
                    })
                  : []
                
                return (
                  <View key={planIdx} className="schools-page__group-section">
                    {lowestScoreMajors.length > 0 && (
                      <View className="schools-page__group-warning">
                        <Text className="schools-page__group-warning-title">⚠️ 提醒</Text>
                        <Text className="schools-page__group-warning-text">
                          该专业组中包含热爱能量低的专业，选择该专业组可能会被调剂到这些专业，请谨慎选择。
                        </Text>
                      </View>
                    )}
                    {plan.enrollmentMajor && (
                      <Text className="schools-page__group-section-title">{plan.enrollmentMajor}</Text>
                    )}
                    {plan.remark && (
                      <Text className="schools-page__group-section-remark">{plan.remark}</Text>
                    )}
                    <View className="schools-page__group-table">
                      <View className="schools-page__group-table-header">
                        <Text>专业</Text>
                        <Text>招生人数</Text>
                        <Text>学制</Text>
                        <Text>热爱能量</Text>
                      </View>
                      {plan.scores.map((score, idx) => {
                        const loveEnergy = score.loveEnergy
                        const isLowest = minScore !== null && loveEnergy !== null && loveEnergy > 0 && 
                          (loveEnergy === minScore || loveEnergy === minScore + 1)
                        
                        return (
                          <View 
                            key={idx} 
                            className={`schools-page__group-table-row ${isLowest ? 'schools-page__group-table-row--warning' : ''}`}
                          >
                            <View className="schools-page__group-table-major">
                              <Text className="schools-page__group-table-major-name">{score.majorName}</Text>
                              <Text className="schools-page__group-table-major-code">{score.majorCode}</Text>
                            </View>
                            <Text>{plan.enrollmentQuota || '-'}</Text>
                            <Text>{plan.studyPeriod || '-'}</Text>
                            <View className="schools-page__group-table-score">
                              <Text className={isLowest ? 'schools-page__group-table-score--low' : ''}>
                                {loveEnergy !== null ? loveEnergy : '-'}
                              </Text>
                              {isLowest && <Text>⚠️</Text>}
                            </View>
                          </View>
                        )
                      })}
                    </View>
                    {/* 加入/移除志愿按钮 */}
                    <View className="schools-page__group-section-actions">
                      {(() => {
                        const { isIn, choiceId } = isPlanInWishlist(plan)
                        if (isIn && choiceId) {
                          return (
                            <Button
                              onClick={() => handleAddPlanToWishlist(plan)}
                              className="schools-page__group-section-add-button schools-page__group-section-add-button--remove"
                              size="sm"
                              variant="default"
                            >
                              移除志愿
                            </Button>
                          )
                        }
                        return (
                          <Button
                            onClick={() => handleAddPlanToWishlist(plan)}
                            className="schools-page__group-section-add-button"
                            size="sm"
                            variant="default"
                          >
                            加入志愿
                          </Button>
                        )
                      })()}
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
