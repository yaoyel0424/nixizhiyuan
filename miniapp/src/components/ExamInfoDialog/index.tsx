// 高考信息对话框组件
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { getStorage, setStorage, removeStorage } from '@/utils/storage'
import { getExamInfo, updateExamInfo, getGaokaoConfig, getScoreRange, ExamInfo, GaokaoSubjectConfig } from '@/services/exam-info'
import './index.less'

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
  const scoreChangeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastProcessedScoreRef = useRef<string | null>(null) // 记录上次处理的分数，避免重复调用
  const isLoadingDataRef = useRef(false) // 标记是否正在加载数据
  const previousProvinceRef = useRef<string | null>(null) // 记录上一次的省份，用于判断是否是用户主动切换

  // 获取当前省份的科目配置
  const currentProvinceConfig = gaokaoConfig.find(config => config.province === selectedProvince)
  
  // 获取所有省份列表
  const provinceList = gaokaoConfig.map(config => config.province).sort()

  // 根据省份变化，重置所有科目选择和分数数据（仅在用户主动切换省份时，不是加载数据时）
  useEffect(() => {
    if (currentProvinceConfig && !isLoadingDataRef.current) {
      // 只有当省份真正变化时（不是初始化，且不是从 undefined 变为有值），才清空数据
      // previousProvinceRef.current !== null 表示不是第一次初始化
      // previousProvinceRef.current !== selectedProvince 表示省份确实变化了
      if (previousProvinceRef.current !== null && previousProvinceRef.current !== selectedProvince) {
        // 用户主动切换省份时，清空所有已选数据
        setFirstChoice(null)
        setOptionalSubjects(new Set())
        setTotalScore('')
        setRanking('')
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
          if (gaokaoConfig.length === 0) {
            const config = await getGaokaoConfig()
            setGaokaoConfig(config)
          }

          // 优先使用传入的 examInfo，如果 examInfo 为空，则从本地存储加载
          let dataToUse = examInfo
          if (!dataToUse) {
            // 从本地存储加载
            const savedProvince = await getStorage<string>('examProvince')
            const savedFirstChoice = await getStorage<string>('examFirstChoice')
            const savedOptional = await getStorage<string[]>('examOptionalSubjects')
            const savedScore = await getStorage<string>('examTotalScore')
            const savedRanking = await getStorage<string>('examRanking')
            
            if (savedProvince || savedFirstChoice || savedScore) {
              // 如果有任何本地数据，构建 examInfo 对象
              dataToUse = {
                province: savedProvince || undefined,
                preferredSubjects: savedFirstChoice || undefined,
                secondarySubjects: savedOptional && savedOptional.length > 0 ? savedOptional.join(',') : undefined,
                score: savedScore ? parseInt(savedScore, 10) : undefined,
                rank: savedRanking ? parseInt(savedRanking, 10) : undefined,
              }
            }
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
      const is3Plus3Mode = PROVINCES_3_3_MODE.includes(selectedProvince)
      // 如果不是3+3模式，不能选择"综合"
      if (!is3Plus3Mode && subject === '综合') {
        Taro.showToast({
          title: '非3+3模式不能选择"综合"',
          icon: 'none',
          duration: 2000
        })
        return
      }
      
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
    
    // 判断是否为3+3模式省份
    const is3Plus3Mode = PROVINCES_3_3_MODE.includes(selectedProvince)
    // 3+3模式省份使用"综合"，其他模式需要 firstChoice
    const subjectType = is3Plus3Mode ? '综合' : firstChoice
    
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
    const is3Plus3Mode = PROVINCES_3_3_MODE.includes(selectedProvince)
    
    // 如果是3+3模式（首选科目是"综合"），次选科目必须选择三科
    if (is3Plus3Mode) {
      return optionalSubjects.size === 3
    }
    
    // 如果不是3+3模式，必须要有首选科目，且不能是"综合"
    if (!is3Plus3Mode) {
      // 必须有首选科目
      if (!firstChoice) {
        return false
      }
      // 首选科目不能是"综合"
      if (firstChoice === '综合') {
        return false
      }
    }
    
    return true
  }, [selectedProvince, optionalSubjects.size, firstChoice])

  const handleConfirm = async () => {
    try {
      setLoading(true)
      
      // 判断是否为3+3模式省份
      const is3Plus3Mode = PROVINCES_3_3_MODE.includes(selectedProvince)
      
      // 验证：如果首选科目是"综合"，次选科目必须选择三科
      if (is3Plus3Mode && optionalSubjects.size !== 3) {
        Taro.showToast({
          title: '次选科目必须选择三科',
          icon: 'none',
          duration: 2000
        })
        setLoading(false)
        return
      }
      
      // 验证：如果不是3+3模式，必须要有首选科目，且不能是"综合"
      if (!is3Plus3Mode) {
        if (!firstChoice) {
          Taro.showToast({
            title: '请选择首选科目',
            icon: 'none',
            duration: 2000
          })
          setLoading(false)
          return
        }
        if (firstChoice === '综合') {
          Taro.showToast({
            title: '非3+3模式不能选择"综合"',
            icon: 'none',
            duration: 2000
          })
          setLoading(false)
          return
        }
      }
      
      // 准备更新数据
      const updateData: ExamInfo = {
        province: selectedProvince,
        // 3+3模式省份：preferredSubjects 统一填写"综合"，选科信息放在 secondarySubjects
        preferredSubjects: is3Plus3Mode ? '综合' : (firstChoice || undefined),
        secondarySubjects: optionalSubjects.size > 0 ? Array.from(optionalSubjects).join(',') : undefined,
        score: totalScore ? parseInt(totalScore, 10) : undefined,
        rank: ranking ? parseInt(ranking, 10) : undefined,
      }

      // 调用 API 更新
      const updatedInfo = await updateExamInfo(updateData)

      // 同时保存到本地存储（作为备份）
      await setStorage('examProvince', selectedProvince)
      // 3+3模式省份保存"综合"，其他模式保存 firstChoice
      const savedFirstChoice = is3Plus3Mode ? '综合' : firstChoice
      if (savedFirstChoice) {
        await setStorage('examFirstChoice', savedFirstChoice)
      }
      await setStorage('examOptionalSubjects', Array.from(optionalSubjects))
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
              
              {/* 首选科目 */}
              {currentProvinceConfig.primarySubjects && currentProvinceConfig.primarySubjects.count > 0 && (
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

              {/* 次选科目 */}
              {currentProvinceConfig.secondarySubjects && currentProvinceConfig.secondarySubjects.count > 0 && (
                <>
                  <View className="exam-info-dialog__divider">
                    <Text className="exam-info-dialog__divider-text">
                      次选 ({currentProvinceConfig.secondarySubjects.subjects.length}选{currentProvinceConfig.secondarySubjects.count})
                    </Text>
                  </View>
                  <View className="exam-info-dialog__button-grid">
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

              {/* 传统文理科模式 */}
              {currentProvinceConfig.traditionalSubjects && currentProvinceConfig.traditionalSubjects.length > 0 && (
                <>
                  <View className="exam-info-dialog__divider">
                    <Text className="exam-info-dialog__divider-text">选择科类</Text>
                  </View>
                  <View className="exam-info-dialog__button-group">
                    {currentProvinceConfig.traditionalSubjects.map((subject) => (
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
            <Text className="exam-info-dialog__label">预估或实际总分</Text>
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
                
                // 如果分数为空或无效，不设置定时器
                if (!score || score.trim() === '' || isNaN(Number(score))) {
                  // 清除上次处理的分数记录
                  lastProcessedScoreRef.current = null
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
            <Text className="exam-info-dialog__label">高考排名</Text>
            <Input
              type="number"
              value={ranking}
              onInput={(e) => setRanking(e.detail.value)}
              className="exam-info-dialog__input"
            />
          </View>

          {/* 提示信息 */}
          <View className="exam-info-dialog__tip">
            <Text className="exam-info-dialog__tip-icon">💡</Text>
            <Text className="exam-info-dialog__tip-text">输入分数后系统将自动获取排名位次</Text>
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
          {/* 提示信息：如果首选科目是"综合"但次选科目未选择三科 */}
          {PROVINCES_3_3_MODE.includes(selectedProvince) && optionalSubjects.size !== 3 && (
            <View className="exam-info-dialog__tip">
              <Text className="exam-info-dialog__tip-icon">⚠️</Text>
              <Text className="exam-info-dialog__tip-text">次选科目必须选择三科</Text>
            </View>
          )}
          {/* 提示信息：如果不是3+3模式，必须选择首选科目 */}
          {!PROVINCES_3_3_MODE.includes(selectedProvince) && !firstChoice && currentProvinceConfig?.primarySubjects && currentProvinceConfig.primarySubjects.count > 0 && (
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