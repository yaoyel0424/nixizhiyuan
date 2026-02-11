import { useState, useEffect, useCallback, useRef } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getUserRelatedDataCount } from '@/services/user'
import { getStorage } from '@/utils/storage'
import Taro from '@tarojs/taro'

const UNLOCK_THRESHOLD = 168
const STORAGE_KEY = 'questionnaire_answers'

/**
 * 从本地存储加载答案
 */
function loadAnswersFromStorage(): Record<number, number> {
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.error('加载答案失败:', error)
    return {}
  }
}

/**
 * 检查问卷是否完成的 Hook
 * @returns { isCompleted: boolean, isLoading: boolean, answerCount: number, majorFavoritesCount: number }
 */
export function useQuestionnaireCheck() {
  const [isCompleted, setIsCompleted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [answerCount, setAnswerCount] = useState(0)
  // 心动专业（专业收藏）数量：用于页面空态提示
  const [majorFavoritesCount, setMajorFavoritesCount] = useState(0)

  const fetchRelatedData = useCallback(async () => {
    try {
      setIsLoading(true)
      try {
        const data = await getUserRelatedDataCount()
        const count = data.scaleAnswersCount || 0
        setAnswerCount(count)
        setIsCompleted(count >= UNLOCK_THRESHOLD)
        setMajorFavoritesCount(data.majorFavoritesCount || 0)
      } catch (error) {
        console.error('获取问卷完成状态失败，使用本地数据:', error)
        const storedAnswers = loadAnswersFromStorage()
        const count = Object.keys(storedAnswers).length
        setAnswerCount(count)
        setIsCompleted(count >= UNLOCK_THRESHOLD)
        setMajorFavoritesCount(0)
      }
    } catch (error) {
      console.error('检查问卷完成状态失败:', error)
      setIsCompleted(false)
      setAnswerCount(0)
      setMajorFavoritesCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const isFirstShowRef = useRef(true)

  useEffect(() => {
    fetchRelatedData()
  }, [fetchRelatedData])

  // 页面再次显示时（如从专业探索页返回）重新拉取心动专业数量等，保证数据最新；跳过首次避免与 useEffect 重复请求
  useDidShow(() => {
    if (isFirstShowRef.current) {
      isFirstShowRef.current = false
      return
    }
    fetchRelatedData()
  })

  return { isCompleted, isLoading, answerCount, majorFavoritesCount }
}
