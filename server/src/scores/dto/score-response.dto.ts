import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * 专业分数响应 DTO
 */
export class ScoreResponseDto {
  @ApiProperty({ description: '专业ID' })
  @Expose()
  majorId: number;

  @ApiProperty({ description: '专业代码' })
  @Expose()
  majorCode: string;

  @ApiProperty({ description: '专业名称' })
  @Expose()
  majorName: string;

  @ApiProperty({ description: '专业简介', nullable: true })
  @Expose()
  majorBrief: string | null;

  @ApiProperty({ description: '教育层次' })
  @Expose()
  eduLevel: string;

  @ApiProperty({ description: '厌学扣分' })
  @Expose()
  yanxueDeduction: number;

  @ApiProperty({ description: '挑战扣分' })
  @Expose()
  tiaozhanDeduction: number;

  @ApiProperty({ description: '总分' })
  @Expose()
  score: number;

  @ApiProperty({ description: '乐学分数' })
  @Expose()
  lexueScore: number;

  @ApiProperty({ description: '善学分数' })
  @Expose()
  shanxueScore: number;
}

/**
 * 专业分数简要项（仅 majorId、score，用于后 20% 等接口）
 */
export class ScoreSummaryItemDto {
  @ApiProperty({ description: '专业ID' })
  majorId: number;

  @ApiProperty({ description: '匹配分数' })
  score: number;
}



