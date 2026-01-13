import { get, post, del, patch } from './api'

/**
 * 专业分数项
 */
export interface MajorScoreItem {
  schoolCode?: string
  province?: string | null
  year?: string | null
  subjectSelectionMode?: string | null
  batch?: string | null
  minScore?: number | null
  minRank?: number | null
  admitCount?: number | null
  enrollmentType?: string | null
}

/**
 * 创建志愿选择请求
 */
export interface CreateChoiceDto {
  mgId?: number | null
  schoolCode?: string | null
  enrollmentMajor?: string | null
  batch?: string | null
  rank?: number | null
  majorGroupInfo?: string | null
  subjectSelectionMode?: string | null
  studyPeriod?: string | null
  enrollmentQuota?: string | null
  remark?: string | null
  tuitionFee?: string | null
  curUnit?: string | null
  majorScores?: MajorScoreItem[] | null
}

/**
 * 简化的学校信息
 */
export interface SchoolSimple {
  code: string
  name: string | null
  provinceName: string | null
  cityName: string | null
  nature: string | null
  belong: string | null
  features: string | null
  enrollmentRate: number | null
  employmentRate: number | null
}

/**
 * 简化的专业组信息
 */
export interface MajorGroupSimple {
  schoolCode: string
  province: string | null
  year: string | null
  subjectSelectionMode: string | null
  batch: string | null
  mgId: number | null
  mgName: string | null
  mgInfo: string | null
}

/**
 * 志愿选择响应
 */
export interface ChoiceResponse {
  id: number
  userId: number
  schoolCode: string
  majorGroupId: number | null
  mgIndex: number | null
  majorIndex: number | null
  majorGroupInfo: string | null
  province: string | null
  year: string | null
  batch: string | null
  subjectSelectionMode: string | null
  studyPeriod: string | null
  enrollmentQuota: string | null
  enrollmentType: string | null
  remark: string | null
  tuitionFee: string | null
  enrollmentMajor: string | null
  curUnit: string | null
  majorGroup: MajorGroupSimple | null
  majorScores: MajorScoreItem[]
  school: SchoolSimple | null
}

/**
 * 分组结构中的志愿选择
 */
export interface ChoiceInGroup {
  id: number
  userId: number
  schoolCode: string
  majorGroupId: number | null
  mgIndex: number | null
  majorIndex: number | null
  majorGroupInfo: string | null
  province: string | null
  year: string | null
  batch: string | null
  subjectSelectionMode: string | null
  studyPeriod: string | null
  enrollmentQuota: string | null
  enrollmentType: string | null
  remark: string | null
  tuitionFee: string | null
  enrollmentMajor: string | null
  curUnit: string | null
  majorScores: MajorScoreItem[]
}

/**
 * 专业组分组
 */
export interface MajorGroupGroup {
  majorGroup: MajorGroupSimple
  choices: ChoiceInGroup[]
}

/**
 * 学校分组
 */
export interface SchoolGroup {
  mgIndex: number | null
  school: SchoolSimple
  majorGroups: MajorGroupGroup[]
}

/**
 * 志愿统计信息
 */
export interface VolunteerStatistics {
  selected: number
  total: number
}

/**
 * 分组后的志愿选择响应
 */
export interface GroupedChoiceResponse {
  volunteers: SchoolGroup[]
  statistics: VolunteerStatistics
}

/**
 * 调整方向
 */
export enum Direction {
  UP = 'up',
  DOWN = 'down'
}

/**
 * 调整专业组索引请求
 */
export interface AdjustMgIndexDto {
  mgIndex: number
  direction: Direction
}

/**
 * 调整专业索引请求
 */
export interface AdjustMajorIndexDto {
  direction: Direction
}

/**
 * 创建志愿选择
 * @param createChoiceDto 创建志愿的 DTO
 * @returns 创建的志愿选择记录
 */
export const createChoice = async (createChoiceDto: CreateChoiceDto): Promise<ChoiceResponse> => {
  try {
    const response: any = await post<ChoiceResponse>('/choices', createChoiceDto)
    
    // 响应拦截器可能返回原始数据或 BaseResponse 格式
    if (response && typeof response === 'object') {
      // 如果包含 data 字段，提取 data
      if (response.data && typeof response.data === 'object') {
        return response.data
      }
      // 如果直接是 ChoiceResponse 格式，直接返回
      if (response.id !== undefined) {
        return response
      }
    }
    throw new Error('创建志愿选择失败：响应格式不正确')
  } catch (error) {
    console.error('创建志愿选择失败:', error)
    throw error
  }
}

/**
 * 获取用户的志愿选择列表（分组）
 * @param year 年份（可选），如果不传则从配置中读取
 * @returns 分组后的志愿选择列表
 */
export const getChoices = async (year?: string): Promise<GroupedChoiceResponse> => {
  try {
    const params = year ? { year } : {}
    const response: any = await get<GroupedChoiceResponse>('/choices', params)
    
    // 响应拦截器可能返回原始数据或 BaseResponse 格式
    if (response && typeof response === 'object') {
      // 如果包含 data 字段，提取 data
      if (response.data && typeof response.data === 'object') {
        return response.data
      }
      // 如果直接是 GroupedChoiceResponse 格式，直接返回
      if (response.volunteers !== undefined) {
        return response
      }
    }
    throw new Error('获取志愿选择列表失败：响应格式不正确')
  } catch (error) {
    console.error('获取志愿选择列表失败:', error)
    throw error
  }
}

/**
 * 删除志愿选择
 * @param id 志愿选择ID
 * @returns 删除结果
 */
export const deleteChoice = async (id: number): Promise<void> => {
  try {
    await del(`/choices/${id}`)
  } catch (error) {
    console.error('删除志愿选择失败:', error)
    throw error
  }
}

/**
 * 调整专业组索引（上移或下移）
 * @param adjustMgIndexDto 调整专业组索引的 DTO
 * @returns 调整结果
 */
export const adjustMgIndex = async (adjustMgIndexDto: AdjustMgIndexDto): Promise<void> => {
  try {
    await patch('/choices/adjust-mg-index', adjustMgIndexDto)
  } catch (error) {
    console.error('调整专业组索引失败:', error)
    throw error
  }
}

/**
 * 调整专业索引（上移或下移）
 * @param id 志愿选择ID
 * @param adjustMajorIndexDto 调整专业索引的 DTO
 * @returns 调整结果
 */
export const adjustMajorIndex = async (id: number, adjustMajorIndexDto: AdjustMajorIndexDto): Promise<void> => {
  try {
    await patch(`/choices/${id}/adjust-major-index`, adjustMajorIndexDto)
  } catch (error) {
    console.error('调整专业索引失败:', error)
    throw error
  }
}

/**
 * 修复所有记录的 mgIndex 和 majorIndex
 * @returns 修复结果
 */
export const fixIndexes = async (): Promise<void> => {
  try {
    await post('/choices/fix-indexes')
  } catch (error) {
    console.error('修复索引失败:', error)
    throw error
  }
}
