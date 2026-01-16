// 教育数据工具函数
import educationDataJson from '@/data/education-level-info.json'

export interface MajorNode {
  id: number
  name: string
  code: number
  edu_level: string
  level: number
  parent_id: number | null
  children: MajorNode[]
}

export interface EducationData {
  ben: MajorNode[]
  gao_ben: MajorNode[]
  zhuan: MajorNode[]
}

export function getEducationData(): EducationData {
  return educationDataJson as EducationData
}

export function getEducationLevelLabel(level: string): string {
  switch (level) {
    case "ben":
      return "本科"
    case "gao_ben":
      return "本科(职业)"
    case "zhuan":
      return "专科"
    default:
      return level
  }
}

