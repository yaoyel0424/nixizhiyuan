import { useState, useEffect } from 'react'
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
 * @returns { isCompleted: boolean, isLoading: boolean, answerCount: number }
 */
export function useQuestionnaireCheck() {
  const [isCompleted, setIsCompleted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [answerCount, setAnswerCount] = useState(0)

  useEffect(() => {
    const checkQuestionnaire = async () => {
      try {
        setIsLoading(true)
        
        // 优先从 API 获取数据
        try {
          const data = await getUserRelatedDataCount()
          const count = data.scaleAnswersCount || 0
          setAnswerCount(count)
          setIsCompleted(count >= UNLOCK_THRESHOLD)
        } catch (error) {
          console.error('获取问卷完成状态失败，使用本地数据:', error)
          // API 失败时，降级使用本地存储数据
          const storedAnswers = loadAnswersFromStorage()
          const count = Object.keys(storedAnswers).length
          setAnswerCount(count)
          setIsCompleted(count >= UNLOCK_THRESHOLD)
        }
      } catch (error) {
        console.error('检查问卷完成状态失败:', error)
        // 出错时默认未完成
        setIsCompleted(false)
        setAnswerCount(0)
      } finally {
        setIsLoading(false)
      }
    }

    checkQuestionnaire()
  }, [])

  return { isCompleted, isLoading, answerCount }
}
