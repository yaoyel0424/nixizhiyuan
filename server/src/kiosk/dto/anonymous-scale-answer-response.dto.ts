import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 匿名量表答案响应 DTO（与 ScaleAnswerResponseDto 字段语义对齐，userId 换为 anonymousUserId）
 */
export class AnonymousScaleAnswerResponseDto {
  @ApiProperty({ description: '答案ID', example: 1, type: Number })
  @Expose()
  id: number;

  @ApiProperty({ description: '量表ID', example: 1, type: Number })
  @Expose()
  scaleId: number;

  @ApiProperty({ description: '匿名用户ID', example: 1, type: Number })
  @Expose()
  anonymousUserId: number;

  @ApiProperty({ description: '得分', example: 5, type: Number })
  @Expose()
  score: number;

  @ApiProperty({ description: '提交时间', example: '2024-01-01T00:00:00.000Z', type: Date })
  @Expose()
  submittedAt: Date;
}
