import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 量表答案响应 DTO
 * 使用 class-transformer 进行序列化
 */
export class ScaleAnswerResponseDto {
  @ApiProperty({
    description: '答案ID',
    example: 1,
    type: Number,
  })
  @Expose()
  id: number;

  @ApiProperty({
    description: '量表ID',
    example: 1,
    type: Number,
  })
  @Expose()
  scaleId: number;

  @ApiProperty({
    description: '用户ID',
    example: 1,
    type: Number,
  })
  @Expose()
  userId: number;

  @ApiProperty({
    description: '得分',
    example: 5,
    type: Number,
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

