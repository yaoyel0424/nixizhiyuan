// 高考信息对话框组件
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { getStorage, setStorage, removeStorage } from '@/utils/storage'
import { getExamInfo, updateExamInfo, getGaokaoConfig, getScoreRange, ExamInfo, GaokaoSubjectConfig, ScoreRangeBatchItem } from '@/services/exam-info'
import './index.less'

/** 3+3 选科模式省份列表（与 intended 页保持一致） */
const PROVINCES_3_3_MODE = ['北京', '上海', '浙江', '天津', '山东', '海南', '西藏', '新疆']

// 高考信息对话框组件
export function ExamInfoDialog({ 
  open, 
  onOpenChange,
  examInfo,
  onUpdate
}: { 
  open: boolean
  onOpenChange: (open: boolean) => void
  examInfo?: ExamInfo
  onUpdate?: (updatedInfo?: ExamInfo) => void
}) {
  const [selectedProvince, setSelectedProvince] = useState<string>('四川')
  const [firstChoice, setFirstChoice] = useState<string | null>(null)
  const [optionalSubjects, setOptionalSubjects] = useState<Set<string>>(new Set())
  const [totalScore, setTotalScore] = useState<string>('580')
  const [ranking, setRanking] = useState<string>('9150')
  const [gaokaoConfig, setGaokaoConfig] = useState<GaokaoSubjectConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false)
  const [isUpdatingProvince, setIsUpdatingProvince] = useState(false)
  const [isFetchingRank, setIsFetchingRank] = useState(false)
  /** score-range 返回的批次列表，用于下拉展示 */
  const [batchList, setBatchList] = useState<ScoreRangeBatchItem[]>([])
  /** 当前选中的批次名称，默认使用 matchedBatch */
  const [selectedBatch, setSelectedBatch] = useState<string>('')
  const [showBatchDropdown, setShowBatchDropdown] = useState(false)
  const scoreChangeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastProcessedScoreRef = useRef<string | null>(null) // 记录上次处理的分数，避免重复调用
  const isLoadingDataRef = useRef(false) // 标记是否正在加载数据
  const previousProvinceRef = useRef<string | null>(null) // 记录上一次的省份，用于判断是否是用户主动切换

  // 获取当前省份的科目配置
  const currentProvinceConfig = gaokaoConfig.find(config => config.province === selectedProvince)
  // 按接口 mode 区分模式，不再用省名硬编码
  const is3Plus3Mode = currentProvinceConfig?.mode === '3+3' || currentProvinceConfig?.mode === '3+4'
  const isWenliKeMode = currentProvinceConfig?.mode === '文理科'
  // 文理科使用 secondarySubjects 作为科类选项；其他省若接口有 traditionalSubjects 则用其展示「选择科类」
  const keleiSubjects = isWenliKeMode
    ? (currentProvinceConfig?.secondarySubjects?.subjects ?? [])
    : (currentProvinceConfig?.traditionalSubjects ?? [])

  // 获取所有省份列表
  const provinceList = gaokaoConfig.map(config => config.province).sort()

  // 根据省份变化，重置所有科目选择和分数数据（仅在用户主动切换省份时，不是加载数据时）
  useEffect(() => {
    if (currentProvinceConfig && !isLoadingDataRef.current) {
      // 只有当省份真正变化时（不是初始化，且不是从 undefined 变为有值），才清空数据
      // previousProvinceRef.current !== null 表示不是第一次初始化
      // previousProvinceRef.current !== selectedProvince 表示省份确实变化了
      if (previousProvinceRef.current !== null && previousProvinceRef.current !== selectedProvince) {
        // 用户主动切换省份时，清空所有已选数据及批次（批次下拉默认不可选、显示为空白）
        setFirstChoice(null)
        setOptionalSubjects(new Set())
        setTotalScore('')
        setRanking('')
        setBatchList([])
        setSelectedBatch('')
      }
      // 更新记录的省份
      previousProvinceRef.current = selectedProvince
    }
  }, [selectedProvince, currentProvinceConfig])

  // 清理定时器和状态
  useEffect(() => {
    return () => {
      if (scoreChangeTimerRef.current) {
        clearTimeout(scoreChangeTimerRef.current)
        scoreChangeTimerRef.current = null
      }
      // 对话框关闭时，清除上次处理的分数记录
      lastProcessedScoreRef.current = null
    }
  }, [])

  // 从 API 或本地存储加载数据
  useEffect(() => {
    if (open && !isUpdatingProvince) {
      // 对话框打开时，清除上次处理的分数记录，避免影响新的输入
      lastProcessedScoreRef.current = null
      
      const loadData = async () => {
        try {
          // 先加载高考科目配置（如果还没有加载）
          let configList = gaokaoConfig
          if (configList.length === 0) {
            configList = await getGaokaoConfig()
            setGaokaoConfig(configList)
          }

          // 优先使用传入的 examInfo（父组件通常已调 getExamInfo/user/{id}，含 enrollType），避免重复请求
          let dataToUse = examInfo
          let apiExamInfo: ExamInfo | null = null
          if (!dataToUse) {
            // 无传入数据时从本地存储加载
            const savedProvince = await getStorage<string>('examProvince')
            const savedFirstChoice = await getStorage<string>('examFirstChoice')
            const savedOptional = await getStorage<string[]>('examOptionalSubjects')
            const savedScore = await getStorage<string>('examTotalScore')
            const savedRanking = await getStorage<string>('examRanking')
            
            if (savedProvince || savedFirstChoice || savedScore) {
              // 在 3+1+2 模式下，确保 secondarySubjects 不包含 preferredSubjects
              let finalSecondarySubjects: string[] = []
              if (savedOptional && savedOptional.length > 0) {
                finalSecondarySubjects = savedOptional
                // 如果是 3+1+2 模式（非 3+3 模式），过滤掉首选科目
                const is3Plus3Mode = savedProvince && PROVINCES_3_3_MODE.includes(savedProvince)
                if (!is3Plus3Mode && savedFirstChoice) {
                  finalSecondarySubjects = finalSecondarySubjects.filter(subject => subject !== savedFirstChoice)
                }
              }
              
              // 如果有任何本地数据，构建 examInfo 对象
              dataToUse = {
                province: savedProvince || undefined,
                preferredSubjects: savedFirstChoice || undefined,
                secondarySubjects: finalSecondarySubjects.length > 0 ? finalSecondarySubjects.join(',') : undefined,
                score: savedScore ? parseInt(savedScore, 10) : undefined,
                rank: savedRanking ? parseInt(savedRanking, 10) : undefined,
              }
            }
            // 仅在没有传入 examInfo 时请求 user/{id}，用于拿 enrollType 显示批次下拉，避免与父组件重复请求
            try {
              apiExamInfo = await getExamInfo()
            } catch (_) {
              // 未登录或接口失败时忽略
            }
          }
          // 无传入数据时用接口返回的 enrollType 补全，确保批次下拉有默认值
          if (apiExamInfo?.enrollType !== undefined && apiExamInfo?.enrollType !== null && apiExamInfo.enrollType !== '') {
            dataToUse = { ...(dataToUse || {}), enrollType: apiExamInfo.enrollType }
          }
          
          // 使用 dataToUse 设置所有状态
          if (dataToUse) {
            console.log('弹框加载数据 - dataToUse:', dataToUse)
            // 先设置其他状态，最后设置省份（避免触发清空逻辑）
            // 首选科目：如果有值就设置
            if (dataToUse.preferredSubjects) {
              console.log('设置首选科目:', dataToUse.preferredSubjects)
              setFirstChoice(dataToUse.preferredSubjects)
            } else {
              console.log('清空首选科目')
              setFirstChoice(null)
            }
            // 次选科目：如果有值就设置
            if (dataToUse.secondarySubjects) {
              const subjects = dataToUse.secondarySubjects.split(',').map(s => s.trim()).filter(s => s)
              console.log('设置次选科目:', subjects)
              setOptionalSubjects(new Set(subjects))
            } else {
              console.log('清空次选科目')
              setOptionalSubjects(new Set())
            }
            // 分数：如果有值就设置
            if (dataToUse.score !== undefined && dataToUse.score !== null) {
              console.log('设置分数:', dataToUse.score)
              setTotalScore(String(dataToUse.score))
            } else {
              console.log('清空分数')
              setTotalScore('')
            }
            // 排名：如果有值就设置
            if (dataToUse.rank !== undefined && dataToUse.rank !== null) {
              console.log('设置排名:', dataToUse.rank)
              setRanking(String(dataToUse.rank))
            } else {
              console.log('清空排名')
              setRanking('')
            }
            // 省份：最后设置（避免触发清空逻辑）
            if (dataToUse.province) {
              console.log('设置省份:', dataToUse.province)
              setSelectedProvince(dataToUse.province)
            }
            // 批次（enrollType）：先按 user 的 enrollType 显示，下面有分数时会再根据 score-range 结果调整
            if (dataToUse.enrollType) {
              setSelectedBatch(dataToUse.enrollType)
            } else {
              setSelectedBatch('')
            }

            // 用户信息已包含分数时，再调用一次 score-range，用于批次列表与默认选中（enrollType 在 batches 中则显示 enrollType，否则显示 matchedBatch）
            const scoreNum = dataToUse.score
            const hasValidScore = scoreNum !== undefined && scoreNum !== null && !isNaN(Number(scoreNum)) && String(scoreNum).trim() !== ''
            if (hasValidScore && dataToUse.province && dataToUse.preferredSubjects) {
              const provinceConfig = configList.find((c: GaokaoSubjectConfig) => c.province === dataToUse!.province)
              const isWenli = provinceConfig?.mode === '文理科'
              const is33 = provinceConfig?.mode === '3+3' || provinceConfig?.mode === '3+4'
              const subjectType = isWenli ? dataToUse.preferredSubjects! : (is33 ? '综合' : dataToUse.preferredSubjects!)
              try {
                const scoreRangeInfo = await getScoreRange(dataToUse.province!, subjectType, String(scoreNum))
                if (scoreRangeInfo?.batches && scoreRangeInfo.batches.length > 0) {
                  setBatchList(scoreRangeInfo.batches)
                  const enrollType = dataToUse.enrollType
                  const inBatches = enrollType && scoreRangeInfo.batches.some((b: ScoreRangeBatchItem) => b.batch === enrollType)
                  setSelectedBatch(inBatches ? enrollType! : (scoreRangeInfo.matchedBatch ?? scoreRangeInfo.batches[0].batch))
                }
                if (scoreRangeInfo?.rankRange) {
                  const rankMatch = scoreRangeInfo.rankRange.match(/^(\d+)/)
                  if (rankMatch) setRanking(rankMatch[1])
                }
              } catch (_) {
                // 忽略 score-range 失败
              }
            }
          } else {
            console.log('弹框加载数据 - 没有找到数据（examInfo 和本地存储都为空）')
          }
        } catch (error) {
          console.error('加载高考信息失败:', error)
        }
      }
      loadData()
    } else if (!open) {
      // 对话框关闭时，清除定时器和状态
      if (scoreChangeTimerRef.current) {
        clearTimeout(scoreChangeTimerRef.current)
        scoreChangeTimerRef.current = null
      }
      lastProcessedScoreRef.current = null
    }
  }, [open, examInfo])

  // 处理首选科目选择
  const handlePrimarySubjectChange = (subject: string) => {
    if (currentProvinceConfig?.primarySubjects) {
      // 非 3+3/3+4 模式下不能选择「综合」
      if (!is3Plus3Mode && subject === '综合') {
        Taro.showToast({
          title: '非3+3模式不能选择"综合"',
          icon: 'none',
          duration: 2000
        })
        return
      }

      // 切换首选科目（如物理/历史）时清空分数、位次和批次，让用户按新科目重新填写
      setTotalScore('')
      setRanking('')
      setBatchList([])
      setSelectedBatch('')

      if (currentProvinceConfig.primarySubjects.count === 1) {
        // 单选模式
        setFirstChoice(subject === firstChoice ? null : subject)
      } else {
        // 多选模式（虽然目前没有，但预留）
        setFirstChoice(subject)
      }
    }
  }

  // 处理次选科目选择
  const handleSecondarySubjectToggle = (subject: string) => {
    if (!currentProvinceConfig?.secondarySubjects) return
    
    setOptionalSubjects((prev) => {
      const newSet = new Set(prev)
      const maxCount = currentProvinceConfig.secondarySubjects!.count
      
      if (newSet.has(subject)) {
        newSet.delete(subject)
      } else {
        if (newSet.size < maxCount) {
          newSet.add(subject)
        } else {
          Taro.showToast({
            title: `最多只能选择${maxCount}门科目`,
            icon: 'none',
            duration: 2000
          })
        }
      }
      return newSet
    })
  }

  // 处理分数变化，自动获取排名
  const handleScoreChange = async (score: string) => {
    // 如果分数为空或无效，不调用API
    if (!score || score.trim() === '' || isNaN(Number(score))) {
      return
    }
    // 文理科用所选科类（文科/理科），3+3/3+4 用「综合」，其余用首选科目
    const subjectType = isWenliKeMode ? firstChoice : (is3Plus3Mode ? '综合' : firstChoice)
    // 检查必要参数是否齐全
    if (!selectedProvince || !subjectType) {
      return
    }
    
    // 如果分数和上次处理的相同，不重复调用
    if (lastProcessedScoreRef.current === score) {
      return
    }
    
    // 防止重复请求
    if (isFetchingRank) {
      return
    }
    
    // 记录当前要处理的分数
    lastProcessedScoreRef.current = score
    setIsFetchingRank(true)
    
    try {
      // 调用API获取排名信息
      const scoreRangeInfo = await getScoreRange(
        selectedProvince,
        subjectType,
        score
      )
      
      if (scoreRangeInfo && scoreRangeInfo.rankRange) {
        // 解析排名范围，取最小值作为排名
        // rankRange 格式可能是 "1000-2000" 或 "1000"
        const rankMatch = scoreRangeInfo.rankRange.match(/^(\d+)/)
        if (rankMatch) {
          const minRank = rankMatch[1]
          setRanking(minRank)
        }
      }
      // 批次列表与默认选中：使用 batches 和 matchedBatch
      if (scoreRangeInfo) {
        if (scoreRangeInfo.batches && scoreRangeInfo.batches.length > 0) {
          setBatchList(scoreRangeInfo.batches)
          const defaultBatch = scoreRangeInfo.matchedBatch ?? scoreRangeInfo.batches[0].batch
          setSelectedBatch(defaultBatch)
        } else {
          setBatchList([])
          setSelectedBatch('')
        }
      }
    } catch (error) {
      console.error('获取排名信息失败:', error)
      // 不显示错误提示，避免打扰用户输入
      // 如果请求失败，清除记录，允许重试
      lastProcessedScoreRef.current = null
    } finally {
      setIsFetchingRank(false)
    }
  }

  // 处理省份选择
  const handleProvinceChange = async (province: string) => {
    // 防止重复请求
    if (isUpdatingProvince || province === selectedProvince) {
      setShowProvinceDropdown(false)
      return
    }
    
    setIsUpdatingProvince(true)
    setShowProvinceDropdown(false)
    
    // 只更新省份，不清空数据（useEffect 会自动清空）
    setSelectedProvince(province)
    
    // 不调用 API，只有用户点击确认时才更新
    setIsUpdatingProvince(false)
  }

  // 判断是否可以提交
  const canConfirm = useMemo(() => {
    // 文理科：仅需选择科类（文科/理科）
    if (isWenliKeMode) {
      return !!firstChoice
    }
    // 3+3/3+4：次选必须选满要求数量（如 3 门）
    if (is3Plus3Mode) {
      const required = currentProvinceConfig?.secondarySubjects?.count ?? 3
      return optionalSubjects.size === required
    }
    // 其他模式（如 3+1+2）：必须有首选且不能是「综合」
    if (!firstChoice || firstChoice === '综合') {
      return false
    }
    return true
  }, [isWenliKeMode, is3Plus3Mode, currentProvinceConfig?.secondarySubjects?.count, optionalSubjects.size, firstChoice])

  const handleConfirm = async () => {
    try {
      setLoading(true)
      // 文理科：必须选择科类
      if (isWenliKeMode) {
        if (!firstChoice) {
          Taro.showToast({ title: '请选择科类（文科或理科）', icon: 'none', duration: 2000 })
          setLoading(false)
          return
        }
      } else if (is3Plus3Mode) {
        const required = currentProvinceConfig?.secondarySubjects?.count ?? 3
        if (optionalSubjects.size !== required) {
          Taro.showToast({
            title: `次选科目必须选择${required}门`,
            icon: 'none',
            duration: 2000
          })
          setLoading(false)
          return
        }
      } else {
        if (!firstChoice) {
          Taro.showToast({ title: '请选择首选科目', icon: 'none', duration: 2000 })
          setLoading(false)
          return
        }
        if (firstChoice === '综合') {
          Taro.showToast({ title: '非3+3模式不能选择"综合"', icon: 'none', duration: 2000 })
          setLoading(false)
          return
        }
      }
      // 文理科：preferredSubjects 为所选科类，不提交次选；3+3 为「综合」+ 次选；其余为首选 + 次选
      const preferred = isWenliKeMode ? firstChoice : (is3Plus3Mode ? '综合' : firstChoice)
      // 文理科不提交次选；非文理科时，3+1+2 模式下 secondarySubjects 不包含首选科目
      // 次选科目按页面显示顺序（currentProvinceConfig.secondarySubjects.subjects）保存，与界面一致
      let finalSecondarySubjects: string[] = []
      if (!isWenliKeMode && optionalSubjects.size > 0) {
        const displayOrder = currentProvinceConfig?.secondarySubjects?.subjects ?? []
        const orderedSelected = displayOrder.length > 0
          ? displayOrder.filter(s => optionalSubjects.has(s))
          : Array.from(optionalSubjects)
        finalSecondarySubjects = orderedSelected
        if (!is3Plus3Mode && firstChoice) {
          finalSecondarySubjects = finalSecondarySubjects.filter(subject => subject !== firstChoice)
        }
      }
      const updateData: ExamInfo = {
        province: selectedProvince,
        preferredSubjects: preferred || undefined,
        secondarySubjects: finalSecondarySubjects.length > 0 ? finalSecondarySubjects.join(',') : undefined,
        score: totalScore ? parseInt(totalScore, 10) : undefined,
        rank: ranking ? parseInt(ranking, 10) : undefined,
        enrollType: selectedBatch || undefined,
      }
      const updatedInfo = await updateExamInfo(updateData)
      await setStorage('examProvince', selectedProvince)
      if (preferred) {
        await setStorage('examFirstChoice', preferred)
      }
      // 本地存储的次选科目也按页面显示顺序保存，与提交的 secondarySubjects 一致
      const orderedOptional = currentProvinceConfig?.secondarySubjects?.subjects
        ? currentProvinceConfig.secondarySubjects.subjects.filter(s => optionalSubjects.has(s))
        : Array.from(optionalSubjects)
      await setStorage('examOptionalSubjects', isWenliKeMode ? [] : orderedOptional)
      await setStorage('examTotalScore', totalScore)
      await setStorage('examRanking', ranking)

      // 修改高考信息后，删除本地分数区间，让系统根据新的分数重新计算
      try {
        await removeStorage('scoreRange')
      } catch (error) {
        console.error('删除本地分数区间失败:', error)
      }

      Taro.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      })

      // 通知父组件更新（传入更新后的信息，避免重复调用 API）
      if (onUpdate) {
        onUpdate(updatedInfo)
      }
    } catch (error) {
      console.error('保存高考信息失败:', error)
      Taro.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000
      })
    } finally {
      setLoading(false)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="exam-info-dialog">
        <DialogHeader>
          <DialogTitle>高考信息</DialogTitle>
        </DialogHeader>
        <View className="exam-info-dialog__content">
          {/* 高考省份选择 */}
          <View className="exam-info-dialog__row">
            <Text className="exam-info-dialog__label">高考省份</Text>
            <View className="exam-info-dialog__province-select-wrapper">
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowProvinceDropdown(!showProvinceDropdown)
                  setShowBatchDropdown(false)
                }}
                className="exam-info-dialog__province-button"
                variant="outline"
              >
                <Text>{selectedProvince || '请选择省份'}</Text>
                <Text className={`exam-info-dialog__province-arrow ${showProvinceDropdown ? 'exam-info-dialog__province-arrow--open' : ''}`}>▼</Text>
              </Button>
              
              {/* 浮动下拉框 */}
              {showProvinceDropdown && (
                <View className="exam-info-dialog__province-dropdown">
                  <View className="exam-info-dialog__province-dropdown-content">
                    {provinceList.length === 0 ? (
                      <View className="exam-info-dialog__province-dropdown-loading">
                        <Text>加载中...</Text>
                      </View>
                    ) : (
                      <View className="exam-info-dialog__province-dropdown-grid">
                        {provinceList.map((province) => (
                          <Button
                            key={province}
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              if (!isUpdatingProvince) {
                                handleProvinceChange(province)
                              }
                            }}
                            disabled={isUpdatingProvince}
                            className={`exam-info-dialog__province-dropdown-item ${selectedProvince === province ? 'exam-info-dialog__province-dropdown-item--active' : ''}`}
                            variant={selectedProvince === province ? 'default' : 'ghost'}
                          >
                            {province}
                          </Button>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* 选择科目 */}
          {currentProvinceConfig && (
            <View className="exam-info-dialog__section">
              <Text className="exam-info-dialog__section-title">
                选择科目 ({currentProvinceConfig.mode})
              </Text>
              {/* 文理科：仅展示「选择科类」（文科/理科），不展示首选、次选 */}
              {isWenliKeMode && keleiSubjects.length > 0 && (
                <>
                  <View className="exam-info-dialog__divider">
                    <Text className="exam-info-dialog__divider-text">选择科类</Text>
                  </View>
                  <View className="exam-info-dialog__button-group">
                    {keleiSubjects.map((subject) => (
                      <Button
                        key={subject}
                        onClick={() => setFirstChoice(subject)}
                        className={`exam-info-dialog__button ${firstChoice === subject ? 'exam-info-dialog__button--active' : ''}`}
                      >
                        {subject}
                      </Button>
                    ))}
                  </View>
                </>
              )}
              {/* 非文理科：首选科目 */}
              {!isWenliKeMode && currentProvinceConfig.primarySubjects && currentProvinceConfig.primarySubjects.count > 0 && (
                <>
                  <View className="exam-info-dialog__divider">
                    <Text className="exam-info-dialog__divider-text">
                      首选 ({currentProvinceConfig.primarySubjects.count}选{currentProvinceConfig.primarySubjects.count})
                    </Text>
                  </View>
                  <View className="exam-info-dialog__button-group">
                    {currentProvinceConfig.primarySubjects.subjects.map((subject) => (
                      <Button
                        key={subject}
                        onClick={() => handlePrimarySubjectChange(subject)}
                        className={`exam-info-dialog__button ${firstChoice === subject ? 'exam-info-dialog__button--active' : ''}`}
                      >
                        {subject}
                      </Button>
                    ))}
                  </View>
                </>
              )}
              {/* 非文理科：次选科目 */}
              {!isWenliKeMode && currentProvinceConfig.secondarySubjects && currentProvinceConfig.secondarySubjects.count > 0 && (
                <>
                  <View className="exam-info-dialog__divider">
                    <Text className="exam-info-dialog__divider-text">
                      次选 ({currentProvinceConfig.secondarySubjects.subjects.length}选{currentProvinceConfig.secondarySubjects.count})
                    </Text>
                  </View>
                  <View className={!is3Plus3Mode ? 'exam-info-dialog__secondary-row' : 'exam-info-dialog__button-grid exam-info-dialog__button-grid--three-col'}>
                    {currentProvinceConfig.secondarySubjects.subjects.map((subject) => (
                      <Button
                        key={subject}
                        onClick={() => handleSecondarySubjectToggle(subject)}
                        disabled={!optionalSubjects.has(subject) && optionalSubjects.size >= currentProvinceConfig.secondarySubjects!.count}
                        className={`exam-info-dialog__button ${optionalSubjects.has(subject) ? 'exam-info-dialog__button--active' : ''}`}
                      >
                        {subject}
                      </Button>
                    ))}
                  </View>
                </>
              )}
              {/* 非文理科、接口带 traditionalSubjects 时的「选择科类」 */}
              {!isWenliKeMode && keleiSubjects.length > 0 && (
                <>
                  <View className="exam-info-dialog__divider">
                    <Text className="exam-info-dialog__divider-text">选择科类</Text>
                  </View>
                  <View className="exam-info-dialog__button-group">
                    {keleiSubjects.map((subject) => (
                      <Button
                        key={subject}
                        onClick={() => setFirstChoice(subject)}
                        className={`exam-info-dialog__button ${firstChoice === subject ? 'exam-info-dialog__button--active' : ''}`}
                      >
                        {subject}
                      </Button>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {/* 未选择省份时的提示 */}
          {!currentProvinceConfig && gaokaoConfig.length > 0 && (
            <View className="exam-info-dialog__tip">
              <Text className="exam-info-dialog__tip-icon">⚠️</Text>
              <Text className="exam-info-dialog__tip-text">请先选择省份</Text>
            </View>
          )}

          {/* 预估或实际总分 */}
          <View className="exam-info-dialog__row">
            <Text className="exam-info-dialog__label">我的分数</Text>
            <Input
              type="number"
              value={totalScore}
              onInput={(e) => {
                // 使用防抖，延迟500ms后调用API
                const score = e.detail.value
                setTotalScore(score)
                
                // 清除之前的定时器
                if (scoreChangeTimerRef.current) {
                  clearTimeout(scoreChangeTimerRef.current)
                  scoreChangeTimerRef.current = null
                }
                
                // 如果分数为空或无效，不设置定时器并清空批次
                if (!score || score.trim() === '' || isNaN(Number(score))) {
                  lastProcessedScoreRef.current = null
                  setBatchList([])
                  setSelectedBatch('')
                  return
                }
                
                // 设置新的定时器
                scoreChangeTimerRef.current = setTimeout(() => {
                  handleScoreChange(score)
                  scoreChangeTimerRef.current = null
                }, 500)
              }}
              className="exam-info-dialog__input"
            />
            {isFetchingRank && (
              <Text className="exam-info-dialog__loading-text">正在获取排名...</Text>
            )}
          </View>

          {/* 高考排名 */}
          <View className="exam-info-dialog__row">
            <Text className="exam-info-dialog__label">我的位次</Text>
            <Input
              type="number"
              value={ranking}
              onInput={(e) => setRanking(e.detail.value)}
              className="exam-info-dialog__input"
            />
          </View>

          {/* 批次选择（默认显示；无数据时显示空白且不可选，接口返回 batches 后可选并默认选中 matchedBatch） */}
          <View className="exam-info-dialog__row">
            <Text className="exam-info-dialog__label">批次</Text>
            <View className="exam-info-dialog__province-select-wrapper">
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  if (batchList.length === 0) return
                  setShowBatchDropdown(!showBatchDropdown)
                  setShowProvinceDropdown(false)
                }}
                disabled={batchList.length === 0}
                className={`exam-info-dialog__province-button ${batchList.length === 0 ? 'exam-info-dialog__province-button--disabled' : ''}`}
                variant="outline"
              >
                <Text>{selectedBatch || ' '}</Text>
                <Text className={`exam-info-dialog__province-arrow ${showBatchDropdown ? 'exam-info-dialog__province-arrow--open' : ''}`}>▼</Text>
              </Button>
              {showBatchDropdown && batchList.length > 0 && (
                <View className="exam-info-dialog__province-dropdown">
                  <View className="exam-info-dialog__province-dropdown-content">
                    <View className="exam-info-dialog__batch-dropdown-list">
                      {batchList.map((item) => (
                        <Button
                          key={item.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedBatch(item.batch)
                            setShowBatchDropdown(false)
                          }}
                          className={`exam-info-dialog__province-dropdown-item ${selectedBatch === item.batch ? 'exam-info-dialog__province-dropdown-item--active' : ''}`}
                          variant={selectedBatch === item.batch ? 'default' : 'ghost'}
                        >
                          {item.batch}
                        </Button>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* 确认按钮 */}
          <Button
            onClick={handleConfirm}
            className="exam-info-dialog__confirm-button"
            size="lg"
            disabled={!canConfirm || loading}
          >
            确认
          </Button>
          {/* 提示：3+3/3+4 模式下次选未选满 */}
          {is3Plus3Mode && optionalSubjects.size !== (currentProvinceConfig?.secondarySubjects?.count ?? 3) && (
            <View className="exam-info-dialog__tip">
              <Text className="exam-info-dialog__tip-icon">⚠️</Text>
              <Text className="exam-info-dialog__tip-text">次选科目须选择{currentProvinceConfig?.secondarySubjects?.count ?? 3}门</Text>
            </View>
          )}
          {/* 提示：文理科未选择科类 */}
          {isWenliKeMode && !firstChoice && (
            <View className="exam-info-dialog__tip">
              <Text className="exam-info-dialog__tip-icon">⚠️</Text>
              <Text className="exam-info-dialog__tip-text">请选择科类（文科或理科）</Text>
            </View>
          )}
          {/* 提示：非 3+3、非文理科 且未选首选 */}
          {!is3Plus3Mode && !isWenliKeMode && !firstChoice && currentProvinceConfig?.primarySubjects && currentProvinceConfig.primarySubjects.count > 0 && (
            <View className="exam-info-dialog__tip">
              <Text className="exam-info-dialog__tip-icon">⚠️</Text>
              <Text className="exam-info-dialog__tip-text">请选择首选科目</Text>
            </View>
          )}
        </View>
      </DialogContent>

    </Dialog>
  )
}