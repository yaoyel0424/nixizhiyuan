import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 元素信息 DTO
 */
export class ElementInfoDto {
  /**
   * 元素ID
   */
  @ApiProperty({ description: '元素ID', example: 1 })
  @Expose()
  id: number;

  /**
   * 元素名称
   */
  @ApiProperty({ description: '元素名称', example: '逻辑思维' })
  @Expose()
  name: string;

  /**
   * 元素类型
   */
  @ApiProperty({ description: '元素类型', example: 'like', enum: ['like', 'talent'] })
  @Expose()
  type: 'like' | 'talent';

  /**
   * 维度
   */
  @ApiProperty({ description: '维度', example: '想' })
  @Expose()
  dimension: string;

  /**
   * 拥有时的自然状态
   */
  @ApiProperty({ description: '拥有时的自然状态', example: '...' })
  @Expose()
  ownedNaturalState: string;

  /**
   * 未拥有时的自然状态
   */
  @ApiProperty({ description: '未拥有时的自然状态', example: '...' })
  @Expose()
  unownedNaturalState: string;
}

/**
 * 专业元素分析信息 DTO
 */
export class MajorElementAnalysisDto {
  /**
   * 分析记录ID
   */
  @ApiProperty({ description: '分析记录ID', example: 1 })
  @Expose()
  id: number;

  /**
   * 类型（lexue/shanxue）
   */
  @ApiProperty({ description: '类型', example: 'lexue', enum: ['lexue', 'shanxue'] })
  @Expose()
  type: 'lexue' | 'shanxue';

  /**
   * 权重
   */
  @ApiProperty({ description: '权重', example: 1 })
  @Expose()
  weight: number;

  /**
   * 元素信息
   */
  @ApiProperty({ description: '元素信息', type: ElementInfoDto })
  @Expose()
  @Type(() => ElementInfoDto)
  element: ElementInfoDto;

  /**
   * 简述
   */
  @ApiProperty({ description: '简述', required: false })
  @Expose()
  summary?: string;

  /**
   * 匹配原因
   */
  @ApiProperty({ description: '匹配原因', required: false })
  @Expose()
  matchReason?: string;

  /**
   * 理论依据
   */
  @ApiProperty({ description: '理论依据', required: false })
  @Expose()
  theoryBasis?: string;

  /**
   * 用户对该元素的分数
   */
  @ApiProperty({ description: '用户对该元素的分数', example: 85.5, required: false })
  @Expose()
  userElementScore?: number;
}

/**
 * 专业详情响应 DTO
 */
export class MajorDetailResponseDto {
  /**
   * 专业详情ID
   */
  @ApiProperty({ description: '专业详情ID', example: 1 })
  @Expose()
  id: number;

  /**
   * 专业代码
   */
  @ApiProperty({ description: '专业代码', example: '010101' })
  @Expose()
  code: string;

  /**
   * 学历层次
   */
  @ApiProperty({ description: '学历层次', example: '本科', required: false })
  @Expose()
  educationLevel?: string | null;

  /**
   * 修业年限
   */
  @ApiProperty({ description: '修业年限', example: '四年', required: false })
  @Expose()
  studyPeriod?: string | null;

  /**
   * 授予学位
   */
  @ApiProperty({ description: '授予学位', example: '哲学学士', required: false })
  @Expose()
  awardedDegree?: string | null;

  /**
   * 专业简介
   */
  @ApiProperty({ description: '专业简介', required: false })
  @Expose()
  majorBrief?: string | null;

  /**
   * 专业关键词
   */
  @ApiProperty({ description: '专业关键词', required: false })
  @Expose()
  majorKey?: string | null;

  /**
   * 学业发展标签
   */
  @ApiProperty({ description: '学业发展标签', required: false })
  @Expose()
  academicDevelopmentTag?: string | null;

  /**
   * 职业发展标签
   */
  @ApiProperty({ description: '职业发展标签', required: false })
  @Expose()
  careerDevelopmentTag?: string | null;

  /**
   * 成长潜力标签
   */
  @ApiProperty({ description: '成长潜力标签', required: false })
  @Expose()
  growthPotentialTag?: string | null;

  /**
   * 行业前景标签
   */
  @ApiProperty({ description: '行业前景标签', required: false })
  @Expose()
  industryProspectsTag?: string | null;

  /**
   * 学习内容
   */
  @ApiProperty({ description: '学习内容（JSON格式）', required: false })
  @Expose()
  studyContent?: any | null;

  /**
   * 学业发展
   */
  @ApiProperty({ description: '学业发展（JSON格式）', required: false })
  @Expose()
  academicDevelopment?: any | null;

  /**
   * 职业发展
   */
  @ApiProperty({ description: '职业发展（JSON格式）', required: false })
  @Expose()
  careerDevelopment?: any | null;

  /**
   * 行业前景
   */
  @ApiProperty({ description: '行业前景（JSON格式）', required: false })
  @Expose()
  industryProspects?: any | null;

  /**
   * 成长潜力
   */
  @ApiProperty({ description: '成长潜力（JSON格式）', required: false })
  @Expose()
  growthPotential?: any | null;

  /**
   * 专业元素分析列表
   */
  @ApiProperty({ description: '专业元素分析列表', type: [MajorElementAnalysisDto] })
  @Expose()
  @Type(() => MajorElementAnalysisDto)
  analyses: MajorElementAnalysisDto[];
}

