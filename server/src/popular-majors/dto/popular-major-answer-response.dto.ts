import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 热门专业问卷答案响应 DTO
 * 使用 class-transformer 进行序列化
 */
export class PopularMajorAnswerResponseDto {
  @ApiProperty({
    description: '答案ID',
    example: 1,
    type: Number,
  })
  @Expose()
  id: number;

  @ApiProperty({
    description: '用户ID',
    example: 1,
    type: Number,
  })
  @Expose()
  userId: number;

  @ApiProperty({
    description: '热门专业ID',
    example: 1,
    type: Number,
  })
  @Expose()
  popularMajorId: number;

  @ApiProperty({
    description: '量表ID（问卷题目ID）',
    example: 100,
    type: Number,
  })
  @Expose()
  scaleId: number;

  @ApiProperty({
    description: '得分（值范围为 -2 到 2）',
    example: 1.5,
    type: Number,
    minimum: -2,
    maximum: 2,
  })
  @Expose()
  score: number;

  @ApiProperty({
    description: '提交时间',
    example: '2024-01-01T00:00:00.000Z',
    type: Date,
  })
  @Expose()
  submittedAt: Date;
}

