import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 专业信息响应 DTO（关联的 Major 实体）
 */
export class MajorInfoDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  code: string;

  @Expose()
  level: number;
}

/**
 * 专业详情信息响应 DTO（关联的 MajorDetail 实体）
 */
export class MajorDetailInfoDto {
  @Expose()
  id: number;

  @Expose()
  name: string;

  @Expose()
  code: string;

  @Expose()
  educationLevel: string | null;

  @Expose()
  studyPeriod: string | null;

  @Expose()
  awardedDegree: string | null;

  @Expose()
  majorBrief: string | null;
 
}

/**
 * 填写进度响应 DTO
 */
export class ProgressDto {
  @ApiProperty({ description: '已填写问卷数量' })
  @Expose()
  completedCount: number;

  @ApiProperty({ description: '总问卷数量' })
  @Expose()
  totalCount: number;

  @ApiProperty({ description: '是否已完成所有问卷' })
  @Expose()
  isCompleted: boolean;
}

/**
 * 专业分数响应 DTO
 */
export class ScoreDto {
  @ApiProperty({ description: '总分' })
  @Expose()
  score: number;

  @ApiProperty({ description: '乐学分数' })
  @Expose()
  lexueScore: number;

  @ApiProperty({ description: '善学分数' })
  @Expose()
  shanxueScore: number;

  @ApiProperty({ description: '厌学扣分' })
  @Expose()
  yanxueDeduction: number;

  @ApiProperty({ description: '挑战扣分' })
  @Expose()
  tiaozhanDeduction: number;
}

/**
 * 热门专业响应 DTO
 * 使用 class-transformer 进行序列化
 */
export class PopularMajorResponseDto {
  @Expose()
  id: number; 

  @Expose()
  averageSalary: string | null; 

  @Expose()
  @Type(() => MajorDetailInfoDto)
  majorDetail?: MajorDetailInfoDto;

  @ApiProperty({
    description: '填写进度（当提供 userId 时返回）',
    type: ProgressDto,
    required: false,
  })
  @Expose()
  @Type(() => ProgressDto)
  progress?: ProgressDto;

  @ApiProperty({
    description: '专业匹配分数（当提供 userId 且完成所有问卷时返回）',
    type: ScoreDto,
    required: false,
    nullable: true,
  })
  @Expose()
  @Type(() => ScoreDto)
  score?: ScoreDto | null;
}

