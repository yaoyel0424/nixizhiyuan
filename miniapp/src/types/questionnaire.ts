// 问卷相关类型定义
export interface QuestionOption {
  id: number
  scaleId: number
  optionName: string
  optionValue: number
  displayOrder: number
  additionalInfo: string
}

export interface Question {
  id: number
  content: string
  elementId: number
  type: string
  direction: string
  dimension: string
  action: string
  options: QuestionOption[]
}

