import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

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
}

