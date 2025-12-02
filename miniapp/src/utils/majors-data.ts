// 专业数据工具函数
import Taro from '@tarojs/taro'

export interface Major {
  name: string
  code: number
  edu_level: string
  level: number
  parent_id: string
}

const CSV_URL =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/data-1760626614500-oohOM3ml1TK3ck6N5Y3D5DPgWyKj5F.csv"

export async function fetchMajorsData(): Promise<Major[]> {
  try {
    const response = await Taro.request({
      url: CSV_URL,
      method: 'GET',
    })
    
    if (response.statusCode !== 200) {
      return []
    }
    
    const csvText = response.data as string
    const lines = csvText.trim().split("\n")
    const majors: Major[] = []

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue

      const values = lines[i].split(",")
      if (values.length >= 5) {
        majors.push({
          name: values[0].trim(),
          code: Number.parseInt(values[1]),
          edu_level: values[2].trim(),
          level: Number.parseInt(values[3]),
          parent_id: values[4].trim(),
        })
      }
    }

    return majors
  } catch (error) {
    console.error("Error fetching majors data:", error)
    return []
  }
}

export function groupByEduLevel(majors: Major[]): Record<string, Major[]> {
  return majors.reduce(
    (acc, major) => {
      if (!acc[major.edu_level]) {
        acc[major.edu_level] = []
      }
      acc[major.edu_level].push(major)
      return acc
    },
    {} as Record<string, Major[]>,
  )
}

export function buildHierarchy(majors: Major[]): Major[] {
  // Sort by level to ensure parents come before children
  return majors.sort((a, b) => a.level - b.level)
}

export const EDU_LEVEL_LABELS: Record<string, string> = {
  gao_ben: "高职本科",
  zhuan_ke: "专科",
  ben_ke: "本科",
}

