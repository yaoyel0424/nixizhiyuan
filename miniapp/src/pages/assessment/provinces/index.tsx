// 省份选择页面
import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PageContainer } from '@/components/PageContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { QuestionnaireRequiredModal } from '@/components/QuestionnaireRequiredModal'
import { useQuestionnaireCheck } from '@/hooks/useQuestionnaireCheck'
import {
  getProvinces,
  getFavoriteProvinces,
  favoriteProvince,
  unfavoriteProvince,
  batchAddFavorites,
  batchRemoveFavorites,
  checkFavoriteProvince,
  getFavoriteCount
} from '@/services/provinces'
import { ProvinceResponse } from '@/types/api'
import './index.less'

export default function ProvincesPage() {
  // 检查问卷完成状态
  const { isCompleted: isQuestionnaireCompleted, isLoading: isCheckingQuestionnaire, answerCount } = useQuestionnaireCheck()
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  
  const [provinces, setProvinces] = useState<ProvinceResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [favoriteProvinceIds, setFavoriteProvinceIds] = useState<Set<number>>(new Set())
  const [selectedProvince, setSelectedProvince] = useState<ProvinceResponse | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('全部')
  const [favoriteCount, setFavoriteCount] = useState(0)

  // 检查问卷完成状态
  useEffect(() => {
    if (!isCheckingQuestionnaire && !isQuestionnaireCompleted) {
      setShowQuestionnaireModal(true)
    }
  }, [isCheckingQuestionnaire, isQuestionnaireCompleted])

  // 加载省份数据
  useEffect(() => {
    loadProvinces()
  }, [])

  // 加载收藏列表
  useEffect(() => {
    loadFavoriteProvinces()
    loadFavoriteCount()
  }, [])

  /**
   * 加载省份列表
   */
  const loadProvinces = async () => {
    try {
      setLoading(true)
      const response = await getProvinces()
      setProvinces(response.items || [])
    } catch (error) {
      console.error('加载省份数据失败:', error)
      Taro.showToast({
        title: '加载省份数据失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * 加载收藏列表
   */
  const loadFavoriteProvinces = async () => {
    try {
      const response = await getFavoriteProvinces()
      const favoriteIds = new Set<number>()
      response.items?.forEach((item) => {
        if (item.provinceId) {
          favoriteIds.add(item.provinceId)
        }
      })
      setFavoriteProvinceIds(favoriteIds)
    } catch (error) {
      console.error('加载收藏列表失败:', error)
    }
  }

  /**
   * 加载收藏数量
   */
  const loadFavoriteCount = async () => {
    try {
      const response = await getFavoriteCount()
      setFavoriteCount(response.count || 0)
    } catch (error) {
      console.error('加载收藏数量失败:', error)
    }
  }

  // 获取所有唯一的type
  const provinceTypes = useMemo(() => {
    const types = new Set<string>()
    provinces.forEach((p) => types.add(p.type))
    return Array.from(types).sort()
  }, [provinces])

  /**
   * 切换省份收藏状态
   */
  const toggleProvince = async (provinceId: number) => {
    try {
      const isFavorited = favoriteProvinceIds.has(provinceId)
      
      if (isFavorited) {
        // 取消收藏
        await unfavoriteProvince(provinceId)
        setFavoriteProvinceIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(provinceId)
          return newSet
        })
        setFavoriteCount((prev) => Math.max(0, prev - 1))
        Taro.showToast({
          title: '已取消收藏',
          icon: 'success'
        })
      } else {
        // 收藏
        await favoriteProvince({ provinceId })
        setFavoriteProvinceIds((prev) => {
          const newSet = new Set(prev)
          newSet.add(provinceId)
          return newSet
        })
        setFavoriteCount((prev) => prev + 1)
        Taro.showToast({
          title: '收藏成功',
          icon: 'success'
        })
      }
    } catch (error) {
      console.error('切换收藏状态失败:', error)
      Taro.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      })
    }
  }

  /**
   * 处理删除省份
   */
  const handleDeleteClick = (provinceId: number) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要从已选择列表中删除此省份吗？此操作无法撤销。',
      confirmText: '确定删除',
      confirmColor: '#dc2626',
      success: async (res) => {
        if (res.confirm) {
          try {
            await unfavoriteProvince(provinceId)
            setFavoriteProvinceIds((prev) => {
              const newSet = new Set(prev)
              newSet.delete(provinceId)
              return newSet
            })
            setFavoriteCount((prev) => Math.max(0, prev - 1))
            Taro.showToast({
              title: '已取消收藏',
              icon: 'success'
            })
          } catch (error) {
            console.error('取消收藏失败:', error)
            Taro.showToast({
              title: '操作失败，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  }

  /**
   * 打开省份详情
   */
  const openDetail = (province: ProvinceResponse) => {
    setSelectedProvince(province)
    setShowDetail(true)
  }

  /** 当前类型文案（用于提示） */
  const typeLabel = selectedType === '全部' ? '全部' : selectedType

  /**
   * 添加全部：添加当前 type 下的未选省份，先弹窗确认再执行，提示带类型信息
   */
  const handleAddAll = async () => {
    const toAddIds = filteredProvinces.filter((p) => !favoriteProvinceIds.has(p.id)).map((p) => p.id)
    if (toAddIds.length === 0) {
      Taro.showToast({ title: `当前类型【${typeLabel}】下已全部选择`, icon: 'none' })
      return
    }
    Taro.showModal({
      title: '确认添加全部',
      content: `确定要添加当前类型【${typeLabel}】下的 ${toAddIds.length} 个省份吗？`,
      confirmText: '确定',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const { added } = await batchAddFavorites(toAddIds)
          setFavoriteProvinceIds((prev) => {
            const next = new Set(prev)
            toAddIds.forEach((id) => next.add(id))
            return next
          })
          setFavoriteCount((prev) => prev + added)
          Taro.showToast({
            title: added > 0 ? `已添加 ${added} 个省份（当前类型：${typeLabel}）` : `当前类型【${typeLabel}】下已全部选择`,
            icon: 'success'
          })
        } catch (error) {
          console.error('添加全部失败:', error)
          Taro.showToast({ title: '操作失败，请重试', icon: 'none' })
        }
      }
    })
  }

  /**
   * 删除全部：仅删除当前 type 下的已选省份，提示带类型信息
   */
  const handleRemoveAll = async () => {
    const toRemoveIds = filteredProvinces.filter((p) => favoriteProvinceIds.has(p.id)).map((p) => p.id)
    if (toRemoveIds.length === 0) {
      Taro.showToast({ title: `当前类型【${typeLabel}】下暂无已选省份`, icon: 'none' })
      return
    }
    Taro.showModal({
      title: '确认删除全部',
      content: `确定要取消已选择的 ${toRemoveIds.length} 个【${typeLabel}】省份吗？`,
      confirmText: '确定',
      confirmColor: '#dc2626',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await batchRemoveFavorites(toRemoveIds)
          setFavoriteProvinceIds((prev) => {
            const next = new Set(prev)
            toRemoveIds.forEach((id) => next.delete(id))
            return next
          })
          setFavoriteCount((prev) => Math.max(0, prev - toRemoveIds.length))
          Taro.showToast({ title: `已清空【${typeLabel}】的已选省份`, icon: 'success' })
        } catch (error) {
          console.error('删除全部失败:', error)
          Taro.showToast({ title: '操作失败，请重试', icon: 'none' })
        }
      }
    })
  }

  // 根据type筛选省份
  const filteredProvinces = useMemo(() => {
    if (selectedType === '全部') {
      return provinces
    }
    return provinces.filter((p) => p.type === selectedType)
  }, [provinces, selectedType])

  // 获取已选省份的详细信息
  const selectedProvinceDetails = useMemo(() => {
    return provinces.filter((p) => favoriteProvinceIds.has(p.id))
  }, [provinces, favoriteProvinceIds])

  if (loading) {
    return (
      <PageContainer>
        <View className="provinces-page">
          <View className="provinces-page__loading">
            <Text>加载中...</Text>
          </View>
        </View>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <View className="provinces-page">
        <ScrollView className="provinces-page__content" scrollY>
          {/* 类型筛选标签 */}
          <View className="provinces-page__filters">
            <View
              className={`provinces-page__filter-tag ${selectedType === '全部' ? 'provinces-page__filter-tag--active' : ''}`}
              onClick={() => setSelectedType('全部')}
            >
              <Text className="provinces-page__filter-tag-text">全部</Text>
            </View>
            {provinceTypes.map((type) => (
              <View
                key={type}
                className={`provinces-page__filter-tag ${selectedType === type ? 'provinces-page__filter-tag--active' : ''}`}
                onClick={() => setSelectedType(type)}
              >
                <Text className="provinces-page__filter-tag-text">{type}</Text>
              </View>
            ))}
            <Text className="provinces-page__filter-link" onClick={handleAddAll}>添加全部</Text>
            <Text className="provinces-page__filter-link" onClick={handleRemoveAll}>删除全部</Text>
          </View>

          {/* 已选择的省份 */}
          {selectedProvinceDetails.length > 0 && (
            <View className="provinces-page__selected">
              <View className="provinces-page__selected-header">
                <Text className="provinces-page__selected-title">
                  已选择 ({favoriteCount > 0 ? favoriteCount : selectedProvinceDetails.length})
                </Text>
                <Text className="provinces-page__selected-desc">
                  系统根据选择的省份匹配院校
                </Text>
              </View>
              <View className="provinces-page__selected-list">
                {selectedProvinceDetails.map((province) => {
                  return (
                    <View key={province.id} className="provinces-page__selected-item">
                      <Text className="provinces-page__selected-item-text">{province.name}</Text>
                      <View
                        className="provinces-page__selected-item-close"
                        onClick={() => handleDeleteClick(province.id)}
                      >
                        <Text className="provinces-page__selected-item-close-icon">×</Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          {/* 省份列表 */}
          <View className="provinces-page__list">
            {filteredProvinces.map((province) => {
              const isSelected = favoriteProvinceIds.has(province.id)

              return (
                <Card
                  key={province.id}
                  className={`provinces-page__card ${isSelected ? 'provinces-page__card--selected' : ''}`}
                  onClick={() => openDetail(province)}
                >
                  <View className="provinces-page__card-content">
                    <View className="provinces-page__card-main">
                      <View className="provinces-page__card-header">
                        <Text className={`provinces-page__card-icon ${isSelected ? 'provinces-page__card-icon--selected' : ''}`}>📍</Text>
                        <Text className={`provinces-page__card-name ${isSelected ? 'provinces-page__card-name--selected' : ''}`}>
                          {province.name}
                        </Text>
                        <Text className="provinces-page__card-type">{province.type}</Text>
                        {isSelected && (
                          <Text className="provinces-page__card-check">✓</Text>
                        )}
                      </View>
                      <Text className="provinces-page__card-desc" numberOfLines={2}>
                        {province.overallImpression || '暂无描述'}
                      </Text>
                    </View>
                    <View className="provinces-page__card-actions" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="provinces-page__card-detail-btn"
                        onClick={() => openDetail(province)}
                      >
                        详情
                      </Button>
                      <Button
                        variant={isSelected ? 'outline' : 'default'}
                        size="sm"
                        className={`provinces-page__card-select-btn ${isSelected ? 'provinces-page__card-select-btn--selected' : ''}`}
                        onClick={() => toggleProvince(province.id)}
                      >
                        {isSelected ? '已选择' : '选择'}
                      </Button>
                    </View>
                  </View>
                </Card>
              )
            })}
          </View>
        </ScrollView>

        {/* 详情对话框 */}
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="provinces-page__detail-dialog">
            <DialogHeader>
              <DialogTitle className="provinces-page__detail-title">
                {selectedProvince?.name}
              </DialogTitle>
              <DialogDescription className="provinces-page__detail-type">
                {selectedProvince?.type}
              </DialogDescription>
            </DialogHeader>

            {selectedProvince && (
              <ScrollView className="provinces-page__detail-content" scrollY>
                {selectedProvince.overallImpression && (
                  <View className="provinces-page__detail-section">
                    <Text className="provinces-page__detail-section-title">整体印象</Text>
                    <Text className="provinces-page__detail-section-text">
                      {selectedProvince.overallImpression}
                    </Text>
                  </View>
                )}

                {selectedProvince.livingCost && (
                  <View className="provinces-page__detail-section">
                    <Text className="provinces-page__detail-section-title">生活成本</Text>
                    <Text className="provinces-page__detail-section-text">
                      {selectedProvince.livingCost}
                    </Text>
                  </View>
                )}

                {selectedProvince.suitablePerson && (
                  <View className="provinces-page__detail-section">
                    <Text className="provinces-page__detail-section-title">适合人群</Text>
                    <Text className="provinces-page__detail-section-text">
                      {selectedProvince.suitablePerson}
                    </Text>
                  </View>
                )}

                {selectedProvince.keyIndustries && (
                  <View className="provinces-page__detail-section">
                    <Text className="provinces-page__detail-section-title">重点产业</Text>
                    <Text className="provinces-page__detail-section-text">
                      {selectedProvince.keyIndustries}
                    </Text>
                  </View>
                )}

                {selectedProvince.typicalEmployers && (
                  <View className="provinces-page__detail-section">
                    <Text className="provinces-page__detail-section-title">典型企业</Text>
                    <Text className="provinces-page__detail-section-text">
                      {selectedProvince.typicalEmployers}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            <DialogFooter className="provinces-page__detail-footer">
              <Button
                className="provinces-page__detail-action-btn"
                variant={selectedProvince && favoriteProvinceIds.has(selectedProvince.id) ? 'outline' : 'default'}
                onClick={() => {
                  if (selectedProvince) {
                    // 已选择时：仅关闭弹窗，不取消选择
                    if (favoriteProvinceIds.has(selectedProvince.id)) {
                      setShowDetail(false)
                      return
                    }

                    // 未选择时：选择省份并关闭弹窗
                    toggleProvince(selectedProvince.id)
                    setShowDetail(false)
                  }
                }}
              >
                {selectedProvince && favoriteProvinceIds.has(selectedProvince.id) ? '关闭' : '选择此省份'}
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
    </PageContainer>
  )
}
