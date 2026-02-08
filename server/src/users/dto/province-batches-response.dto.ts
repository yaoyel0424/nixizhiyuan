import { ApiProperty } from '@nestjs/swagger';

/**
 * 单个批次项（含是否最符合分数标记）
 */
export class ProvinceBatchItemDto {
  @ApiProperty({ description: '批次主键ID' })
  id: number;

  @ApiProperty({ description: '批次名称' })
  batch: string;

  @ApiProperty({ description: '最低分/分数线', nullable: true })
  minScore: number | null;
  
}

/**
 * 省份+年份下所有批次及最符合分数批次的响应
 */
export class ProvinceBatchesResponseDto {
  @ApiProperty({ description: '省份' })
  province: string;

  @ApiProperty({ description: '年份' })
  year: string;

  @ApiProperty({ description: '用于匹配的分数（可选，未传则不标记 isMatch）', required: false })
  score?: number | null;

  @ApiProperty({ description: '最符合分数的批次名称（当传入 score 时有值）', required: false })
  matchedBatch?: string | null;

  @ApiProperty({ description: '该省份该年下所有批次列表', type: [ProvinceBatchItemDto] })
  batches: ProvinceBatchItemDto[];
}
