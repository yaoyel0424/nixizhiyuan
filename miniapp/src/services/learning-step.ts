import { get } from './api'

export interface LearningStepItem {
  id: number
  elementId: number
  elementName?: string
  elementDimension?: string
  sortOrder: number
  [key: string]: any
}

export interface LearningStepPhase {
  id: number
  stepId: number
  phaseType: string
  title: string
  sortOrder: number
  items: LearningStepItem[]
}

export interface LearningStepDetail {
  id: number
  type: string
  step: string
  subStep: number
  title: string
  content?: string | null
  bottomTitle?: string | null
  bottom?: string | null
  phases: LearningStepPhase[]
}

/**
 * 数学高考模块统计（按省份）
 */
export interface GaokaoMathModuleStat {
  id: number
  province: string
  sortOrder: number
  moduleName: string
  isTotalRow: boolean
  scoreRange2023?: string | null
  scoreRange2024?: string | null
  scoreRange2025?: string | null
  threeYearMean?: number | null
  proportionRange?: string | null
}

/**
 * 按 item 的 sortOrder、id 排序，保证合并后顺序稳定
 */
function sortLearningStepItems(a: LearningStepItem, b: LearningStepItem): number {
  return a.sortOrder - b.sortOrder || a.id - b.id
}

/**
 * 将同一「步」（step 字段相同）的多条卡片合并为一条
 * - 标题、正文、底部文案：去重后按顺序拼接
 * - 阶段：按 phaseType + 阶段标题 合并，相同阶段下的 items 去重后合并
 */
export function mergeLearningStepsByStep(steps: LearningStepDetail[]): LearningStepDetail[] {
  if (!steps.length) {
    return []
  }

  /** 保持接口返回顺序下「步」首次出现的顺序 */
  const stepOrder: string[] = []
  const byStep = new Map<string, LearningStepDetail[]>()
  for (const s of steps) {
    if (!byStep.has(s.step)) {
      stepOrder.push(s.step)
      byStep.set(s.step, [])
    }
    byStep.get(s.step)!.push(s)
  }

  return stepOrder.map((stepKey) => {
    const group = byStep.get(stepKey)!
    group.sort((a, b) => a.subStep - b.subStep || a.id - b.id)
    return mergeOneStepGroup(group)
  })
}

/**
 * 合并同一 step 下的多条 LearningStepDetail
 */
function mergeOneStepGroup(group: LearningStepDetail[]): LearningStepDetail {
  const first = group[0]
  const titles = [...new Set(group.map((g) => g.title).filter(Boolean))]
  const title = titles.join(' · ')

  const contentParts = group
    .map((g) => g.content)
    .filter((c): c is string => !!c && c.trim().length > 0)
  const content = contentParts.length ? contentParts.join('\n\n') : null

  const bottomTitleParts = [...new Set(group.map((g) => g.bottomTitle).filter(Boolean) as string[])]
  const bottomTitle = bottomTitleParts.length ? bottomTitleParts.join(' · ') : null

  const bottomParts = group
    .map((g) => g.bottom)
    .filter((b): b is string => !!b && b.trim().length > 0)
  const bottom = bottomParts.length ? bottomParts.join('\n\n') : null

  const phaseMap = new Map<string, LearningStepPhase>()
  const phaseOrderKeys: string[] = []

  for (const card of group) {
    for (const ph of card.phases ?? []) {
      const key = `${ph.phaseType}|${ph.title}`
      const existing = phaseMap.get(key)
      if (!existing) {
        phaseOrderKeys.push(key)
        phaseMap.set(key, {
          ...ph,
          items: [...(ph.items ?? [])].sort(sortLearningStepItems),
        })
      } else {
        const idSet = new Set(existing.items.map((i) => i.id))
        for (const it of ph.items ?? []) {
          if (!idSet.has(it.id)) {
            existing.items.push(it)
            idSet.add(it.id)
          }
        }
        existing.items.sort(sortLearningStepItems)
        existing.sortOrder = Math.min(existing.sortOrder, ph.sortOrder)
      }
    }
  }

  const phases = phaseOrderKeys
    .map((k) => phaseMap.get(k)!)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)

  return {
    id: first.id,
    type: first.type,
    step: first.step,
    subStep: first.subStep,
    title,
    content,
    bottomTitle,
    bottom,
    phases,
  }
}

/**
 * 兼容拦截器返回结构，提取数组数据
 */
function extractArrayData<T>(response: any): T[] {
  const data = response?.data ?? response
  return Array.isArray(data) ? data : []
}

/**
 * 获取学习方法探索数据（按用户喜欢/天赋筛选后）
 */
export async function getUserLearningStepContent(): Promise<LearningStepDetail[]> {
  const response: any = await get<LearningStepDetail[]>('/learning-step/user-content')
  return extractArrayData<LearningStepDetail>(response)
}

/**
 * 按省份获取数学高考模块统计
 */
export async function getGaokaoMathStatsByProvince(
  province: string
): Promise<GaokaoMathModuleStat[]> {
  const response: any = await get<GaokaoMathModuleStat[]>(
    '/learning-step/gaokao-math/province',
    { province }
  )
  return extractArrayData<GaokaoMathModuleStat>(response)
}

