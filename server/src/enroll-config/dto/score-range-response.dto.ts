import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ProvinceBatchItemDto } from '@/users/dto/province-batches-response.dto';

/**
 * 分数范围响应 DTO
 */
export class ScoreRangeResponseDto {
  @ApiProperty({
    description: '人数',
    example: 1000,
  })
  @Expose()
  num: number;

  @ApiProperty({
    description: '总人数',
    example: 50000,
  })
  @Expose()
  total: number;

  @ApiProperty({
    description: '排名范围',
    example: '1000-2000',
  })
  @Expose()
  rankRange: string;

  @ApiProperty({
    description: '批次名称',
    example: '本科一批',
  })
  @Expose()
  batchName: string;

  @ApiProperty({
    description: '控制分数线',
    example: 600,
  })
  @Expose()
  controlScore: number;

  @ApiProperty({
    description: '最符合分数的批次名称（当传入 score 时有值）',
    required: false,
  })
  @Expose()
  matchedBatch?: string | null;

  @ApiProperty({
    description: '该省份该年下所有批次列表',
    type: [ProvinceBatchItemDto],
  })
  @Expose()
  @Type(() => ProvinceBatchItemDto)
  batches: ProvinceBatchItemDto[];
}

